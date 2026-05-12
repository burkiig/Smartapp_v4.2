"""
3-step attendance pipeline: QR → Face → Location
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config.settings import settings
from app.models.attendance import AttendanceAttempt
from app.models.user import User
from app.repositories.attendance_repo import (
    AttendanceAttemptRepository,
    FinalAttendanceRepository,
)
from app.repositories.course_repo import CourseRepository, EnrollmentRepository
from app.repositories.session_repo import SessionRepository
from app.services.audit_service import log_action
from app.services.face_service import FaceService
from app.utils.gps_retry import increment_fake_gps_counter, reset_fake_gps_counter
from app.utils.location import check_gps_plausibility, verify_location
from app.utils.push import send_expo_push


class AttendancePipelineService:
    def __init__(self, db: Session):
        self.db = db
        self.session_repo = SessionRepository(db)
        self.enrollment_repo = EnrollmentRepository(db)
        self.attempt_repo = AttendanceAttemptRepository(db)
        self.final_repo = FinalAttendanceRepository(db)
        self.face_service = FaceService(db)

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 1 — QR Scan
    # ─────────────────────────────────────────────────────────────────────────

    def scan_qr(
        self, student: User, session_id: int, qr_token: str
    ) -> AttendanceAttempt:
        session = self.session_repo.get_by_id(session_id)
        if not session or session.status != "active":
            raise HTTPException(status_code=404, detail="Aktif oturum bulunamadı")

        is_dynamic = session.qr_token == qr_token
        is_static  = bool(session.static_qr_token) and session.static_qr_token == qr_token

        if not is_dynamic and not is_static:
            raise HTTPException(
                status_code=400, detail="QR kod geçersiz veya süresi dolmuş"
            )

        # Dinamik QR için TTL kontrolü — statik QR TTL'den muaf
        if is_dynamic:
            qr_ttl = settings.QR_TOKEN_TTL_SECONDS
            try:
                from app.api.admin_settings import get_setting_value
                ttl_str = get_setting_value(self.db, "qr_token_ttl_seconds")
                if ttl_str:
                    qr_ttl = int(ttl_str)
            except Exception:
                pass

            if session.qr_token_issued_at is None:
                raise HTTPException(
                    status_code=400,
                    detail="QR kodunun süresi dolmuş. Lütfen yeni kodu taratın.",
                )
            issued_at = session.qr_token_issued_at
            if issued_at.tzinfo is None:
                issued_at = issued_at.replace(tzinfo=timezone.utc)
            age_seconds = (datetime.now(timezone.utc) - issued_at).total_seconds()
            if age_seconds > qr_ttl:
                raise HTTPException(
                    status_code=400,
                    detail="QR kodunun süresi dolmuş. Lütfen yeni kodu taratın.",
                )

        if not self.enrollment_repo.student_can_attend_course(student.id, session.course_id):
            raise HTTPException(status_code=403, detail="Bu derse kayıtlı değilsiniz")

        # Duplicate final record check
        existing_final = self.final_repo.get_by_student_session(student.id, session_id)
        if existing_final:
            raise HTTPException(
                status_code=409, detail="Bu oturum için zaten yoklama işaretlediniz"
            )

        # Tekrar tarama engeli — QR zaten taranmışsa reddet
        attempt = self.attempt_repo.get_by_student_session(student.id, session_id)
        if attempt and attempt.qr_status == "verified":
            raise HTTPException(
                status_code=409, detail="Bu oturum için QR zaten tarandı. Yüz doğrulama adımına geçin."
            )
        if not attempt:
            attempt = self.attempt_repo.create(student.id, session_id)

        attempt = self.attempt_repo.update(attempt, qr_status="verified")
        return attempt

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 2 — Face Verification
    # ─────────────────────────────────────────────────────────────────────────

    def verify_face(
        self,
        student: User,
        session_id: int,
        image_base64: str,
        image_base64_2: Optional[str] = None,
    ) -> AttendanceAttempt:
        attempt = self.attempt_repo.get_by_student_session(student.id, session_id)
        if not attempt or attempt.qr_status != "verified":
            raise HTTPException(status_code=400, detail="Önce QR kodu taratın")

        # If face engine is unavailable, simulate verification — will be flagged at location step
        if not self.face_service.engine.is_available:
            attempt = self.attempt_repo.update(
                attempt, face_status="verified", face_confidence=0.0
            )
            return attempt

        verified, confidence = self.face_service.verify(
            student.id,
            image_base64,
            image_base64_2,
            accessed_by="attendance.verify_face",
        )
        # Only "verified" is success — pending/failed both mean not verified
        status = "verified" if verified else "failed"
        attempt = self.attempt_repo.update(
            attempt, face_status=status, face_confidence=confidence
        )

        if not verified:
            raise HTTPException(
                status_code=400,
                detail=f"Yüz doğrulaması başarısız (benzerlik: {confidence:.2f}, eşik: {settings.FACE_SIMILARITY_THRESHOLD})",
            )
        return attempt

    # ─────────────────────────────────────────────────────────────────────────
    # STEP 3 — Location Verification + Finalize
    # ─────────────────────────────────────────────────────────────────────────

    def verify_location(
        self,
        student: User,
        session_id: int,
        latitude: float,
        longitude: float,
        accuracy: Optional[float] = None,
        is_mocked: Optional[bool] = None,
    ) -> dict:
        attempt = self.attempt_repo.get_by_student_session(student.id, session_id)
        if not attempt or attempt.qr_status != "verified":
            raise HTTPException(
                status_code=400, detail="Önce QR kodu taratın"
            )
        if attempt.face_status != "verified":
            raise HTTPException(
                status_code=400, detail="Önce yüz doğrulaması yapın"
            )

        session = self.session_repo.get_by_id(session_id)

        # Location check
        inside = True
        distance_m = None
        location_skipped = False

        if session.latitude is not None and session.longitude is not None:
            if accuracy is not None and accuracy > settings.GPS_ACCURACY_THRESHOLD:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Konum doğrulaması başarısız. GPS doğruluğu çok düşük "
                        f"(±{accuracy:.1f}m, maksimum: ±{settings.GPS_ACCURACY_THRESHOLD:.1f}m)."
                    ),
                )
            # Oda bazlı geofence: oturumda geofence_radius varsa onu kullan
            effective_radius = session.geofence_radius or settings.DEFAULT_GEOFENCE_RADIUS_M
            inside, distance_m = verify_location(
                latitude,
                longitude,
                session.latitude,
                session.longitude,
                radius_m=effective_radius,
                accuracy_m=accuracy,
                max_accuracy_m=settings.MAX_GPS_ACCURACY_M,
            )
        else:
            location_skipped = True

        loc_status = "verified" if (inside or location_skipped) else "failed"
        attempt = self.attempt_repo.update(
            attempt,
            location_status=loc_status,
            location_distance_m=distance_m,
        )

        if not inside and not location_skipped:
            raise HTTPException(
                status_code=400,
                detail=f"Konum doğrulaması başarısız. Mesafe: {distance_m:.0f}m (izin verilen: {effective_radius}m)",
            )

        attempt = self.attempt_repo.update(
            attempt, completed_at=datetime.now(timezone.utc)
        )

        # ── GPS plausibility checks ───────────────────────────────────────────
        # Öncelik sırası: fake_gps > suspicious_accuracy > low_accuracy
        #                 > face_simulated > location_skipped
        gps_issues = check_gps_plausibility(accuracy, is_mocked)

        accuracy_above_threshold = (
            accuracy is not None and accuracy > settings.GPS_ACCURACY_THRESHOLD
        )
        low_accuracy = (
            accuracy is not None and 30 < accuracy <= settings.GPS_ACCURACY_THRESHOLD
        )
        # fake_gps: cihazın is_mocked bildirimi VEYA eşik aşımı
        fake_gps_detected = bool(is_mocked) or accuracy_above_threshold
        # suspicious_accuracy: sub-metre hassasiyet → donanım üretemez → yazılım sahtesi
        suspicious_accuracy = "suspicious_accuracy" in gps_issues

        flag_reason = None
        is_flagged = False

        if fake_gps_detected:
            # ── Retry counter: eşiğe ulaşmadan kayıt oluşturma ──────────────
            max_attempts = 3
            try:
                from app.api.admin_settings import get_setting_value
                val = get_setting_value(self.db, "fake_gps_max_attempts")
                if val:
                    max_attempts = int(val)
            except Exception:
                pass

            attempt_count = increment_fake_gps_counter(student.id, session_id)

            if attempt_count < max_attempts:
                # Henüz eşiğe ulaşmadı — location_status'u pending'e çek
                # böylece öğrenci gerçek GPS ile tekrar deneyebilir
                self.attempt_repo.update(attempt, location_status="pending")
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Sahte GPS tespit edildi. Lütfen konum simülatörünü kapatıp "
                        f"tekrar deneyin. ({attempt_count}/{max_attempts})"
                    ),
                )

            # Eşiğe ulaşıldı — kayıt oluştur + öğretmeni bildir
            flag_reason = "fake_gps_detected"
            is_flagged = True
        elif suspicious_accuracy:
            flag_reason = "suspicious_accuracy"
            is_flagged = True
        elif low_accuracy:
            flag_reason = "low_accuracy"
            is_flagged = True
        elif not self.face_service.engine.is_available:
            flag_reason = "face_simulated"
            is_flagged = True
        elif location_skipped:
            flag_reason = "location_skipped"
            is_flagged = True

        # Flagged records go to "pending_review" — instructor must explicitly approve
        record_status = "pending_review" if is_flagged else "present"

        verification_steps = {
            "qr_ok": attempt.qr_status == "verified",
            "face_ok": attempt.face_status == "verified",
            "location_ok": loc_status == "verified",
            "face_confidence": attempt.face_confidence,
            "location_distance_m": distance_m,
            "location_skipped": location_skipped,
            "gps_accuracy_m": accuracy,
            "is_mocked": bool(is_mocked),
            "fake_gps_detected": fake_gps_detected,
            "suspicious_accuracy": suspicious_accuracy,
            "gps_issues": gps_issues,
        }

        final_record = self.final_repo.create(
            student_id=student.id,
            session_id=session_id,
            course_id=session.course_id,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            verification_steps=verification_steps,
            status=record_status,
        )

        # Başarılı kayıt (veya eşik aşıldı ve kaydedildi) → retry sayacını sıfırla
        reset_fake_gps_counter(student.id, session_id)

        log_action(
            self.db,
            "attendance_marked",
            actor_id=student.id,
            actor_role="student",
            resource="final_attendance_record",
            resource_id=final_record.id,
            detail={
                "session_id": session_id,
                "status": record_status,
                "is_flagged": is_flagged,
                "flag_reason": flag_reason,
            },
        )

        if is_flagged:
            self._notify_instructor_flagged(session, student, flag_reason)

        return {
            "success": True,
            "message": "Yoklama başarıyla kaydedildi"
            if not is_flagged
            else "Yoklama kaydedildi, öğretmen incelemesi gerekiyor",
            "attendance_record": final_record,
            "is_flagged": is_flagged,
            "flag_reason": flag_reason,
            "status": record_status,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Manual attendance (by instructor/admin with face)
    # ─────────────────────────────────────────────────────────────────────────

    def manual_attendance(
        self,
        session_id: int,
        student_id: int,
        image_base64: Optional[str] = None,
        instructor_id: Optional[int] = None,
    ) -> dict:
        session = self.session_repo.get_by_id(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Oturum bulunamadı")
        if session.status == "cancelled":
            raise HTTPException(status_code=400, detail="İptal edilmiş oturum için yoklama kaydedilemez")
        # active ve closed oturumlara manuel yoklama izin verilir

        # Instructor scope check — instructor can only mark for their own courses
        if instructor_id is not None:
            course_repo = CourseRepository(self.db)
            my_course_ids = {c.id for c in course_repo.get_by_instructor(instructor_id)}
            if session.course_id not in my_course_ids:
                raise HTTPException(
                    status_code=403, detail="Bu oturum için yetkiniz yok"
                )

        existing = self.final_repo.get_by_student_session(student_id, session_id)
        if existing:
            raise HTTPException(
                status_code=409, detail="Bu öğrenci için yoklama zaten kaydedildi"
            )

        if not self.enrollment_repo.student_can_attend_course(student_id, session.course_id):
            raise HTTPException(status_code=403, detail="Bu öğrenci bu derse kayıtlı değil")

        face_used = False
        confidence = 0.0
        is_flagged = True
        flag_reason = "manual_no_face"

        if image_base64 and self.face_service.engine.is_available:
            try:
                verified, confidence = self.face_service.verify(
                    student_id, image_base64, accessed_by="attendance.manual_attendance"
                )
                if not verified:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Yüz doğrulaması başarısız (benzerlik: {confidence:.2f})",
                    )
                face_used = True
                is_flagged = False
                flag_reason = None
            except HTTPException as e:
                if e.status_code == 404:
                    flag_reason = "manual_no_face_ref"
                else:
                    raise

        record_status = "pending_review" if is_flagged else "present"
        record = self.final_repo.create(
            student_id=student_id,
            session_id=session_id,
            course_id=session.course_id,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            verification_steps={
                "manual": True,
                "face_used": face_used,
                "face_confidence": confidence,
            },
            status=record_status,
        )
        return {
            "success": True,
            "message": "Manuel yoklama kaydedildi",
            "attendance_record": {
                "id": record.id,
                "student_id": record.student_id,
                "session_id": record.session_id,
                "course_id": record.course_id,
                "status": record.status,
                "is_flagged": record.is_flagged,
                "flag_reason": record.flag_reason,
                "verification_steps": record.verification_steps,
                "marked_at": record.marked_at.isoformat() if record.marked_at else None,
            },
            "status": record_status,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # WEB ATTENDANCE — Face + GPS (no QR, for browser clients)
    # ─────────────────────────────────────────────────────────────────────────

    def web_attend(
        self,
        student: User,
        session_id: int,
        image_base64: str,
        latitude: float,
        longitude: float,
        accuracy: Optional[float] = None,
        is_mocked: Optional[bool] = None,
    ) -> dict:
        session = self.session_repo.get_by_id(session_id)
        if not session or session.status != "active":
            raise HTTPException(status_code=404, detail="Aktif oturum bulunamadı")

        if not self.enrollment_repo.student_can_attend_course(student.id, session.course_id):
            raise HTTPException(status_code=403, detail="Bu derse kayıtlı değilsiniz")

        existing = self.final_repo.get_by_student_session(student.id, session_id)
        if existing:
            raise HTTPException(
                status_code=409, detail="Bu oturum için zaten yoklama işaretlediniz"
            )

        # ── Face verification ────────────────────────────────────────────────
        face_ok = False
        face_confidence = 0.0
        face_reason = None
        try:
            face_ok, face_confidence = self.face_service.verify(
                student.id, image_base64, accessed_by="attendance.web_attend"
            )
        except HTTPException as e:
            face_reason = "face_not_enrolled" if e.status_code == 404 else "face_error"
            face_ok = False

        if not face_ok and not face_reason:
            face_reason = f"face_failed (confidence: {face_confidence:.2f})"

        # ── Location verification ────────────────────────────────────────────
        location_ok = True
        distance_m = None
        location_skipped = False
        if session.latitude is not None and session.longitude is not None:
            location_ok, distance_m = verify_location(
                latitude,
                longitude,
                session.latitude,
                session.longitude,
                radius_m=settings.DEFAULT_GEOFENCE_RADIUS_M,
                accuracy_m=accuracy,
                max_accuracy_m=settings.MAX_GPS_ACCURACY_M,
            )
        else:
            location_skipped = True

        # ── GPS plausibility checks ───────────────────────────────────────────
        gps_issues = check_gps_plausibility(accuracy, is_mocked)
        gps_fake = bool(is_mocked)
        gps_suspicious = "suspicious_accuracy" in gps_issues

        # ── If BOTH face and location fail, reject entirely ──────────────────
        if not face_ok and not (location_ok or location_skipped):
            raise HTTPException(
                status_code=400,
                detail="Hem yüz doğrulaması hem de konum doğrulaması başarısız. Yoklama kaydedilmedi.",
            )

        # ── Determine flagging ───────────────────────────────────────────────
        reasons = []
        if not face_ok:
            reasons.append(face_reason or "face_failed")
        if not location_ok and not location_skipped:
            reasons.append(
                f"location_failed ({distance_m:.0f}m)"
                if distance_m
                else "location_failed"
            )
        if gps_fake:
            reasons.append("fake_gps_detected")
        elif gps_suspicious:
            reasons.append("suspicious_accuracy")

        is_flagged = bool(reasons)
        flag_reason = " + ".join(reasons) if reasons else None

        # Flagged → pending_review; clean → present
        record_status = "pending_review" if is_flagged else "present"

        verification_steps = {
            "qr_ok": False,
            "qr_skipped": True,
            "face_ok": face_ok,
            "location_ok": location_ok or location_skipped,
            "face_confidence": face_confidence,
            "location_distance_m": distance_m,
            "location_skipped": location_skipped,
            "gps_accuracy_m": accuracy,
            "is_mocked": bool(is_mocked),
            "fake_gps_detected": gps_fake,
            "suspicious_accuracy": gps_suspicious,
            "gps_issues": gps_issues,
            "web": True,
        }

        final_record = self.final_repo.create(
            student_id=student.id,
            session_id=session_id,
            course_id=session.course_id,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            verification_steps=verification_steps,
            status=record_status,
        )

        if is_flagged:
            self._notify_instructor_flagged(
                session, student, flag_reason or "web_verification_failed"
            )

        return {
            "success": True,
            "message": "Yoklama kaydedildi"
            if not is_flagged
            else "Yoklama kaydedildi, öğretmen incelemesi gerekiyor",
            "is_flagged": is_flagged,
            "flag_reason": flag_reason,
            "face_ok": face_ok,
            "location_ok": location_ok or location_skipped,
            "location_distance_m": distance_m,
            "location_skipped": location_skipped,
            "status": record_status,
        }

    def _notify_instructor_flagged(self, session, student: User, flag_reason: str):
        """
        Notify the course instructor (push + DB) and the student (DB only)
        when an attendance record is flagged for review.

        Push is best-effort — any exception is silently logged so it never
        breaks the attendance pipeline.
        """
        try:
            from app.services.notification_service import create_notification

            REASON_LABELS = {
                "face_simulated": "Yüz tanıma simüle edildi",
                "location_skipped": "GPS koordinatı tanımlı değil",
                "manual_no_face": "Manuel yoklama (yüzsüz)",
                "manual_no_face_ref": "Yüz referansı bulunamadı",
                "fake_gps_detected": "Sahte GPS / düşük doğruluk tespit edildi",
                "suspicious_accuracy": "Şüpheli GPS hassasiyeti (sub-metre değer, donanımla üretilemez)",
                "low_accuracy": "GPS doğruluğu düşük (inceleme gerekli)",
            }
            label = REASON_LABELS.get(flag_reason, flag_reason)
            course_code = (
                session.course.code if session.course else f"Ders #{session.course_id}"
            )
            notif_data = {
                "type": "flagged_attendance",
                "session_id": session.id,
                "student_id": student.id,
            }

            # ── Tüm öğretmenlere: DB notification + push ─────────────────────
            if session.course:
                from app.repositories.course_repo import CourseRepository
                instructors = CourseRepository(self.db).get_instructors_for_course(
                    session.course_id
                )
                instructor_title = "⚠️ Şüpheli Yoklama"
                instructor_body = f"{course_code} — {student.name}: {label}"
                for instructor in instructors:
                    instr_notif = create_notification(
                        db=self.db,
                        user_id=instructor.id,
                        type="flagged_attendance",
                        title=instructor_title,
                        body=instructor_body,
                        data=notif_data,
                    )
                    if instructor.push_token:
                        push_data = {
                            **notif_data,
                            "notificationId": instr_notif.id if instr_notif else None,
                        }
                        send_expo_push(
                            tokens=[instructor.push_token],
                            title=instructor_title,
                            body=instructor_body,
                            data=push_data,
                        )

            # ── Student: DB notification (no push — they initiated the flow) ─
            create_notification(
                db=self.db,
                user_id=student.id,
                type="flagged_attendance",
                title="Yoklamanız İncelemeye Alındı",
                body=f"{course_code} dersi yoklamanız öğretmen incelemesine gönderildi: {label}",
                data=notif_data,
            )
        except Exception as exc:
            import logging

            logging.getLogger(__name__).warning(
                "_notify_instructor_flagged failed (non-critical): %s", exc
            )
