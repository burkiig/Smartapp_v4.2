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
from app.utils.gps_retry import (
    increment_fake_gps_counter,
    increment_location_retry_counter,
    reset_fake_gps_counter,
    reset_location_retry_counter,
)
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
        self._default_location_retry_max_attempts = 2

    def _build_flag_reasons(
        self,
        *,
        face_ok: bool,
        face_reason: Optional[str],
        location_ok: bool,
        location_skipped: bool,
        distance_m: Optional[float],
        accuracy: Optional[float],
        is_mocked: Optional[bool],
        include_face_simulated: bool = False,
    ) -> tuple[list[str], list[str]]:
        """
        Build normalized risk reasons used by both mobile and web attendance flows.
        """
        gps_issues = check_gps_plausibility(accuracy, is_mocked)
        fake_gps_detected = bool(is_mocked)
        suspicious_accuracy = "suspicious_accuracy" in gps_issues
        low_accuracy = (
            accuracy is not None and 30 < accuracy <= settings.GPS_ACCURACY_THRESHOLD
        )

        reasons: list[str] = []
        if not face_ok:
            reasons.append(face_reason or "face_failed")

        if not location_ok and not location_skipped:
            reasons.append("location_failed")

        if fake_gps_detected:
            reasons.append("fake_gps_detected")
        elif suspicious_accuracy:
            reasons.append("suspicious_accuracy")
        elif low_accuracy:
            reasons.append("low_accuracy")

        if include_face_simulated:
            reasons.append("face_simulated")

        if location_skipped:
            reasons.append("location_skipped")

        return reasons, gps_issues

    def _enforce_fake_gps_retry_threshold(
        self,
        *,
        student_id: int,
        session_id: int,
        attempt: AttendanceAttempt,
        is_mocked: Optional[bool],
    ) -> None:
        """
        Enforce fake GPS retry policy before creating a final flagged record.
        """
        if not bool(is_mocked):
            return

        max_attempts = 3
        try:
            from app.api.admin_settings import get_setting_value
            val = get_setting_value(self.db, "fake_gps_max_attempts")
            if val:
                max_attempts = int(val)
        except Exception:
            pass

        attempt_count = increment_fake_gps_counter(student_id, session_id)
        if attempt_count < max_attempts:
            # Keep step open so student can retry after disabling mock location.
            self.attempt_repo.update(attempt, location_status="pending")
            raise HTTPException(
                status_code=400,
                detail=(
                    "Konum doğrulaması için lütfen cihazınızın gerçek konumunu kullanın. "
                    "Konum simülasyonu ve VPN/proxy kapalı olmalıdır. "
                    f"({attempt_count}/{max_attempts})"
                ),
            )

    def _location_retry_limit(self) -> int:
        max_attempts = self._default_location_retry_max_attempts
        try:
            from app.api.admin_settings import get_setting_value
            val = get_setting_value(
                self.db, "location_verify_max_attempts", str(max_attempts)
            )
            if val:
                max_attempts = int(val)
        except Exception:
            pass
        return max(1, max_attempts)

    def _enforce_location_retry_threshold(
        self,
        *,
        student_id: int,
        session_id: int,
        distance_m: Optional[float],
        allowed_radius_m: Optional[float],
    ) -> None:
        """
        Allow a limited retry budget for geofence mismatches before finalizing flagged.
        """
        max_attempts = self._location_retry_limit()
        attempt_count = increment_location_retry_counter(student_id, session_id)
        if attempt_count < max_attempts:
            distance_text = (
                f"{distance_m:.0f}m" if distance_m is not None and distance_m >= 0 else "belirsiz"
            )
            radius_text = (
                f"{allowed_radius_m:.0f}m" if allowed_radius_m is not None else "belirsiz"
            )
            raise HTTPException(
                status_code=400,
                detail=(
                    "Konum doğrulaması başarısız. Sınıfa yaklaşın ve tekrar deneyin. "
                    f"Mevcut mesafe: {distance_text} (izin verilen: {radius_text}). "
                    f"({attempt_count}/{max_attempts})"
                ),
            )

    def _resolve_attendance_course_id(self, student_id: int, session_course_id: int) -> int:
        """
        Resolve the credited course for attendance in parallel-class scenarios.
        """
        try:
            resolved = self.enrollment_repo.resolve_attendance_course_id(
                student_id,
                session_course_id,
                strict_ambiguous=True,
            )
        except ValueError as exc:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Aynı paralel grupta birden fazla ders kaydı tespit edildi. "
                    "Lütfen yöneticinizle iletişime geçin."
                ),
            ) from exc
        if resolved is None:
            raise HTTPException(status_code=403, detail="Bu derse kayıtlı değilsiniz")
        return resolved

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

        # Yüz motoru yoksa adımı geçme — 503 döndür (güvenlik: face bypass yok)
        if not self.face_service.engine.is_available:
            raise HTTPException(
                status_code=503,
                detail="Yüz tanıma servisi şu an kullanılamıyor. Lütfen öğretmeninizle iletişime geçin.",
            )

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
        effective_radius: Optional[float] = None

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

        self._enforce_fake_gps_retry_threshold(
            student_id=student.id,
            session_id=session_id,
            attempt=attempt,
            is_mocked=is_mocked,
        )

        # Geofence mismatch: give student limited retries before final flagged review.
        if not inside and not location_skipped and not bool(is_mocked):
            self._enforce_location_retry_threshold(
                student_id=student.id,
                session_id=session_id,
                distance_m=distance_m,
                allowed_radius_m=effective_radius,
            )

        reasons, gps_issues = self._build_flag_reasons(
            face_ok=True,
            face_reason=None,
            location_ok=inside,
            location_skipped=location_skipped,
            distance_m=distance_m,
            accuracy=accuracy,
            is_mocked=is_mocked,
            include_face_simulated=not self.face_service.engine.is_available,
        )
        is_flagged = bool(reasons)
        flag_reason = " + ".join(reasons) if reasons else None

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
            "fake_gps_detected": "fake_gps_detected" in reasons,
            "suspicious_accuracy": "suspicious_accuracy" in reasons,
            "gps_issues": gps_issues,
        }

        # completed_at yalnızca kayıt başarıyla oluşturulduğunda işaretlenir
        attempt = self.attempt_repo.update(
            attempt, completed_at=datetime.now(timezone.utc)
        )

        attendance_course_id = self._resolve_attendance_course_id(student.id, session.course_id)
        final_record = self.final_repo.create(
            student_id=student.id,
            session_id=session_id,
            course_id=attendance_course_id,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            verification_steps=verification_steps,
            status=record_status,
        )

        # Başarılı/finalized kayıt → retry sayaçlarını sıfırla
        reset_fake_gps_counter(student.id, session_id)
        reset_location_retry_counter(student.id, session_id)

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
        attendance_course_id = self._resolve_attendance_course_id(student_id, session.course_id)
        record = self.final_repo.create(
            student_id=student_id,
            session_id=session_id,
            course_id=attendance_course_id,
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
        effective_radius: Optional[float] = None
        if session.latitude is not None and session.longitude is not None:
            # Use session-level geofence radius (set from room) with settings fallback
            effective_radius = session.geofence_radius or settings.DEFAULT_GEOFENCE_RADIUS_M
            location_ok, distance_m = verify_location(
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

        # ── If BOTH face and location fail, reject entirely ──────────────────
        if not face_ok and not (location_ok or location_skipped):
            raise HTTPException(
                status_code=400,
                detail="Hem yüz doğrulaması hem de konum doğrulaması başarısız. Yoklama kaydedilmedi.",
            )

        if not location_ok and not location_skipped and not bool(is_mocked):
            self._enforce_location_retry_threshold(
                student_id=student.id,
                session_id=session_id,
                distance_m=distance_m,
                allowed_radius_m=effective_radius,
            )

        reasons, gps_issues = self._build_flag_reasons(
            face_ok=face_ok,
            face_reason=face_reason,
            location_ok=location_ok,
            location_skipped=location_skipped,
            distance_m=distance_m,
            accuracy=accuracy,
            is_mocked=is_mocked,
        )

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
            "fake_gps_detected": "fake_gps_detected" in reasons,
            "suspicious_accuracy": "suspicious_accuracy" in reasons,
            "gps_issues": gps_issues,
            "web": True,
        }

        attendance_course_id = self._resolve_attendance_course_id(student.id, session.course_id)
        final_record = self.final_repo.create(
            student_id=student.id,
            session_id=session_id,
            course_id=attendance_course_id,
            is_flagged=is_flagged,
            flag_reason=flag_reason,
            verification_steps=verification_steps,
            status=record_status,
        )

        if is_flagged:
            self._notify_instructor_flagged(
                session, student, flag_reason or "web_verification_failed"
            )
        reset_location_retry_counter(student.id, session_id)

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
            from app.repositories.course_repo import CourseRepository as _CourseRepo

            REASON_LABELS = {
                "face_simulated": "Yüz tanıma simüle edildi",
                "location_skipped": "GPS koordinatı tanımlı değil",
                "manual_no_face": "Manuel yoklama (yüzsüz)",
                "manual_no_face_ref": "Yüz referansı bulunamadı",
                "fake_gps_detected": "Sahte GPS tespit edildi",
                "suspicious_accuracy": "Şüpheli GPS hassasiyeti (sub-metre değer)",
                "low_accuracy": "GPS doğruluğu düşük (inceleme gerekli)",
                "location_failed": "Konum doğrulaması başarısız",
                "face_failed": "Yüz doğrulaması başarısız",
            }
            label = REASON_LABELS.get(flag_reason, flag_reason)
            # course_code: detached session.course lazy load yerine doğrudan sorgu
            course = _CourseRepo(self.db).get_by_id(session.course_id)
            course_code = course.code if course else f"Ders #{session.course_id}"
            notif_data = {
                "type": "flagged_attendance",
                "session_id": session.id,
                "student_id": student.id,
            }

            # ── Tüm öğretmenlere: DB notification + push ─────────────────────
            if course:
                instructors = _CourseRepo(self.db).get_instructors_for_course(
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
