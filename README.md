# Smart Attendance System

Yüz tanıma, QR kod ve GPS doğrulama kullanan üç aşamalı akıllı yoklama sistemi.

**API Sürümü:** v4.2.1 &nbsp;|&nbsp; **Backend:** FastAPI &nbsp;|&nbsp; **DB:** PostgreSQL &nbsp;|&nbsp; **Deployment:** Docker + Tailscale

---

## Son Güncelleme — v4.2.1 (8 Haziran 2026)

Mobil–web özellik eşitliği, çoklu dil desteği ve öğretmen paneli hata düzeltmeleri.

### Mobil — Çoklu Dil (TR/EN)

| Alan | Detay |
|------|--------|
| **Bileşen** | `mobile-app/src/components/LanguageToggle.js` — `compact` (TR/EN pill) ve `full` (etiketli) varyantlar |
| **Giriş ekranı** | `app/index.js` — üst çubukta dil seçici |
| **Öğrenci ana sayfa** | `app/components/home/Header.js` — bildirim ikonunun solunda |
| **Öğretmen paneli** | `app/(tabs)/dashboard.js`, `src/screens/InstructorHome.js` — bildirim yanında |
| **Ayarlar** | `app/settings.js` — aynı bileşen `full` modda |
| **Teknoloji** | `react-i18next`; tercih `AsyncStorage` ile kalıcı |

### Web & Mobil — Öğrenci Listesi (Derse Göre Filtre)

| Platform | Dosya | Davranış |
|----------|-------|----------|
| **Web** | `useStudents.js`, `StudentsPage.jsx` | Öğretmenin dersleri yüklenir; dropdown ile `GET /courses/{id}/students` veya tüm öğrenciler |
| **Mobil** | `app/students.js`, `app/(tabs)/more.js` | Ders chip'leri + arama; `more` sekmesinden "Öğrenciler" girişi |
| **i18n** | `students.allCourses`, `students.noStudentsInCourse` (TR/EN) | |

### Mobil — Yoklama & Bildirim Düzeltmeleri

| # | Sorun | Düzeltme |
|---|-------|----------|
| M17 | **course-detail.js** — `page_size=1000` → API 422 (`le=200`); boş kayıt döngüsü terminal spam | Sayfalı `fetchAllCourseRecords()` (200/sayfa); `summaryStatus` state makinesi + yeniden dene UI |
| M18 | **history.js** — `renderCourseCard` içinde `t` değişkeni i18n `t()` ile çakışıyordu | `courseTime` olarak yeniden adlandırıldı; sekme çökmesi giderildi |
| M19 | **attendance.js** — `flag_reason` ham kod olarak görünüyordu; web ile uyumsuz bildirim | `useFlagReasonLabel()` + `attendance.flagReasons.*` çevirileri; odaklanınca yenileme + 30 sn poll |
| M20 | Öğretmen bildirim rozeti yalnızca `stats.flagged_records` kullanıyordu | `useNotificationBadge` — `GET /notifications/count` (20 sn); artışta `REFRESH_FLAGGED` event |
| M21 | Push yokken (Expo Go) şüpheli yoklama güncellenmiyordu | `_layout.js` push/banner'da `REFRESH_FLAGGED`; polling yedek mekanizma olarak çalışır |

> **API notu:** `GET /attendance/records` için `page_size` üst sınırı **200**'dür (`backend/app/api/attendance.py`). İstemciler daha büyük değer göndermemelidir.

### Paralel Ders Grupları (`shared_class_id`)

Aynı fiziksel sınıfta paralel işlenen dersler (ör. İngilizce A / İngilizce B) tek yoklama havuzunda birleştirilir.

| Katman | Açıklama |
|--------|----------|
| **Veritabanı** | `courses.shared_class_id` (nullable int); aynı ID = aynı grup |
| **Migration** | `f2a3b4c5d6e7_course_shared_class_id.py` |
| **Backend** | `student_can_attend_course`, `get_parallel_enrolled_student_ids`; oturum kapanışında tüm paralel gruba otomatik devamsızlık |
| **Admin UI** | `AdminDashboardPage.jsx` — ders ekle/düzenle: **Paralel Ders Grubu ID** alanı |

**Yapılandırma:** Paralel derslere aynı pozitif tam sayıyı verin (ör. her iki derste `shared_class_id: 101`). Bağımsız derslerde alanı boş bırakın.

---

## Son Güncelleme — v4.2.0 (4 Haziran 2026)

Bu sürümde kapsamlı bir mühendislik denetimi yapılmış; 47 sorun tespit edilmiş ve tamamı giderilmiştir.

---

### Kritik Güvenlik ve İşlevsellik Düzeltmeleri

#### Mobil Uygulama

| # | Sorun | Düzeltme |
|---|-------|----------|
| 1 | **face-scan.js** — `onFacesDetected` expo-camera 17'de çalışmıyor; scan butonu kalıcı disabled kalıyordu | `onFacesDetected` → `onCameraReady` ile değiştirildi; buton kamera hazır olunca aktifleşiyor |
| 2 | **apiAdapter.js + authService.js** — Token refresh sonrası yeni `refresh_token` kaydedilmiyordu; kullanıcılar ilk yenilemeden sonra force logout oluyordu | Her `tryRefreshToken` çağrısında `refresh_token` da SecureStore'a kaydediliyor |
| 3 | **apiAdapter.js** — 401 sonrası retry isteğinde `AbortController` eksikti; timeout'lar sessizce askıda kalıyordu | Retry isteğine ayrı `AbortController` + `clearTimeout` eklendi |
| 4 | **qr-scan.js** — 409 hatası (QR zaten tarandı) error ekranı açıyordu; öğrenci tıkanıyordu | 409 alındığında yüz doğrulama adımına (`/face-scan`) yönlendirme yapılıyor |
| 5 | **qr-scan.js** — `parts` değişkeni `try` bloğu içinde tanımlanmıştı; catch bloğu `ReferenceError` fırlatıyordu | `parts = {}` try bloğunun dışına taşındı |
| 6 | **locationService.js** — expo-location'da geçersiz `timeout` parametresi kullanılıyordu; konum alınamıyordu | `timeout` → `maximumAge` olarak düzeltildi |
| 7 | **gps-verify.js** — Backend'den dönmeyen `room_name` alanı UI'da `—` gösteriyordu | Gereksiz alan UI'dan kaldırıldı |

#### Backend

| # | Sorun | Düzeltme |
|---|-------|----------|
| 8 | **attendance_service.py** — InsightFace yüklü değilse yüz adımı otomatik `verified` dönüyordu (güvenlik açığı) | Motor yoksa 503 fırlatılıyor; bypass tamamen kaldırıldı |
| 9 | **sessions.py** — `GET /sessions/{id}` endpoint'inde instructor scope kontrolü yoktu; herhangi bir instructor başka öğretmenin session'ına erişebiliyordu (IDOR) | `is_instructor_of_course()` kontrolü eklendi |
| 10 | **attendance_service.py** — `completed_at` başarılı kayıt oluşturulmadan önce set ediliyordu; fake-GPS retry atılırsa kayıt "tamamlanmış" görünüyordu | `completed_at` yalnızca `final_repo.create()` başarılı olduktan sonra set ediliyor |
| 11 | **attendance_service.py** — `accuracy_above_threshold` dead code olarak `fake_gps_detected` hesabına karışıyordu | Temizlendi; yalnızca `is_mocked` bayrağı kullanılıyor |
| 12 | **attendance_service.py** — `_notify_instructor_flagged` lazy load `session.course` detached state riski | `_CourseRepo(self.db).get_by_id()` ile doğrudan sorgu yapılıyor |
| 13 | **face.py** — `enroll-multi` API minimum 1 görüntü kabul ediyor, servis minimum 2 istiyor | API validator 2'ye güncellendi |
| 14 | **sanitization.py** — `Content-Length` gönderilmemiş isteklerde body cap çalışmıyordu; path prefix eşleşmesi yanlıştı | No-Content-Length body okuma eklendi; path segmentleri düzeltildi |
| 15 | **push.py** — Expo push ticket hataları loglanmıyor, `raise_for_status` eksikti | Ticket bazlı hata loglama ve `raise_for_status` eklendi |
| 16 | **face_repo.py** — `datetime.utcnow()` deprecated kullanımı | `datetime.now(timezone.utc)` ile değiştirildi |
| 17 | **attendance_repo.py** — Date filter naive datetime ile karşılaştırma | `tzinfo=timezone.utc` eklendi |
| 18 | **sessions.py** — `if not end_time and not data.end_time` redundant çift kontrol | `if not end_time` ile sadeleştirildi |

#### Web Panel

| # | Sorun | Düzeltme |
|---|-------|----------|
| 19 | **apiBaseUrl.js** — Production'da `localhost:8000` hardcoded fallback; gerçek sunucuda yanlış origin'e istek atılıyordu | Same-origin fallback eklendi; proxy üzerinden `/api/...` yönlendirmesi varsayılan |
| 20 | **AdminDashboardPage.jsx** — CSV import `window.__API_BASE_URL__` kullanıyordu (hiç set edilmez); production'da 404 alıyordu | `getApiBaseUrl()` ile değiştirildi |
| 21 | **apiClient.js** — FastAPI validation hataları (`detail` array) `[object Object]` olarak görünüyordu | Array `detail` join ile okunabilir mesaja dönüştürülüyor |
| 22 | **StudentsPage.jsx** — Instructor "Öğrenci Sil" butonu her zaman 403 dönüyordu (backend admin require) | Buton yalnızca `role === 'admin'` için gösteriliyor |
| 23 | **useAttendance.js** — Undo sonrası optimistic state `'present'` set ediyordu; backend `pending_review` döndürüyor | `status: 'pending_review'` olarak düzeltildi |
| 24 | **AuditLogPage.jsx** — Filter `useEffect` sadece mount'ta çalışıyordu; dropdown değişikliği yenileme yapmıyordu | `useCallback` deps zinciri düzeltildi: `[load]` |

---

### Kalibrasyon Güncellemeleri

| Ayar | Eski | Yeni | Neden |
|------|------|------|-------|
| `GPS_ACCURACY_THRESHOLD` | 80m | **40m** | 80m çok gevşek; şehir içi mobil GPS için 40m gerçekçi eşik |
| `DEFAULT_GEOFENCE_RADIUS_M` | 50m | **100m** | 50m sınıf ortasından köşeye bile yetmez |
| `QR_TOKEN_TTL_SECONDS` | 60s | **90s** | Yavaş bağlantılarda 60s zaman aşımı çok sık görülüyordu |
| `FACE_LIVENESS_THRESHOLD` | 0.5 (kullanılmıyordu) | **0.15** (aktif) | `check_liveness()` artık `settings` değerini okuyor |
| `FACE_SIMILARITY_THRESHOLD` | 0.5 | **0.42** | Gerçek ortam testlerine göre gevşetildi |
| InsightFace `det_size` | (320, 320) | **(480, 480)** | Uzak mesafede / düşük çözünürlükte daha iyi algılama |

---

### Yüz Tanıma İyileştirmeleri

- **Thread lock** (`threading.Lock`) ile eş zamanlı ONNX inference yarış koşulu önlendi
- Tüm `print()` çağrıları `logger` ile değiştirildi (production log yönetimi)
- `check_liveness()` artık `FACE_LIVENESS_THRESHOLD` env değişkenini kullanıyor
- `face-scan.js` — Liveness countdown UI eklendi; ikinci kare isteği opsiyonel hale getirildi (login akışıyla tutarlı)

---

### Dead Code Temizliği

**Mobil (silindi):**
- `src/utils/tokenStorage.js` — `apiAdapter.js` ile duplicate
- `src/services/attendanceService.js` — `api.js` ile duplicate

**Web Panel (silindi):**
- `features/attendance/hooks/useClassDetails.js` — hiçbir sayfada import edilmiyordu
- `features/dashboard/hooks/useDashboard.js` — `DashboardView.js` kendi fetch'ini yapıyor
- `features/students/components/StudentRegistration.js` — hiçbir yerde kullanılmıyordu
- `shared/hooks/useCamera.js` — web kamera özelliği yoktu

---

### Altyapı

- **`DOCKER_MIGRATION.md`** oluşturuldu — Supabase'den kendi Linux sunucusuna Docker + Tailscale ile geçiş rehberi (10 bölüm, kontrol listesiyle)
- `docker-compose.yml` güncellendi — web panel servisi eklendi
- Alembic migration sorunları belgelendi (`alembic stamp head` → `alembic upgrade head` çözümü)

---

## Proje Genel Bakış

Bu sistem; öğretmenlerin yoklama oturumu başlatıp QR kod ürettiği, öğrencilerin ise QR tarama → yüz doğrulama → konum doğrulama adımlarını sırasıyla tamamlayarak yoklamasını aldığı bütünleşik bir çözümdür.

Proje üç ana bileşenden oluşur:

| Bileşen | Teknoloji | Port | Açıklama |
|---|---|---|---|
| **Backend** | FastAPI + SQLAlchemy | `8000` | REST API, iş mantığı, veritabanı |
| **Web Panel** | React.js (CRA) | `3000` | Admin ve öğretmen arayüzü |
| **Mobile App** | React Native (Expo) | `8081` | Öğrenci ve öğretmen mobil uygulaması |

---

## Son Güncellemeler

### v4.2.1 — 8 Haziran 2026

Özet: Mobil TR/EN dil anahtarı; web ve mobilde öğrenci listesi derse göre filtre; mobil genel yoklama özeti düzeltmesi; şüpheli yoklama bildirimleri web ile hizalandı; paralel ders grupları belgelendi. Ayrıntılar için yukarıdaki **Son Güncelleme — v4.2.1** bölümüne bakın.

### Burak Gedikli — 5/21/26

**Liderlik Analitik Paneli (MVP) — Web only**

| Alan | Detay |
|------|--------|
| **Yeni roller** | `dean` (Dekan), `rector` (Rektör) |
| **Backend API** | `GET /api/v1/leadership/overview`, `/departments`, `/at-risk` |
| **Güvenlik** | `require_leadership` dependency; dekan scope'u sunucuda zorunlu (`scope_value` — istek parametresiyle bypass edilemez) |
| **User modeli** | `scope_type`, `scope_value` kolonları (Alembic: `h4i5j6k7l8m9_user_leadership_scope`) |
| **Admin panel** | Kullanıcı ekle/düzenle formunda Dekan & Rektör; bölüm dropdown (`GET /api/v1/admin/distinct-departments`) |
| **Yetki koruması** | `user_privileges.py` — admin olmayan kullanıcı role/scope değiştiremez (403) |
| **Web sayfası** | `web-panel/src/pages/LeadershipDashboardPage.jsx` — KPI, bar chart, risk tablosu, mock “Danışmana Bildir” |
| **i18n** | TR/EN `leadership.*` çeviri anahtarları |
| **Düzeltme** | Dekan görünümünde PostgreSQL JSON `distinct` hatası giderildi (`Course.schedule`) |

**Not:** Mock seed veri eklenmedi; panel mevcut veritabanı verisini kullanır. CSV import hâlâ yalnızca `student | instructor | admin` rollerini destekler.

**Henüz yapılmadı (planlanan):** SSO, multi-tenancy, offline queue, audit immutability, gerçek danışman bildirimi, nightly analytics job.

---

## Proje Yapısı

```
Smart_Attendance_System/
├── docker-compose.yml              # API + PostgreSQL servislerini ayağa kaldırır
├── .env                            # Root ortam değişkenleri (git'e ekleme!)
│
├── backend/                        # FastAPI backend
│   ├── main.py                     # Uygulama giriş noktası (v3.0.0)
│   ├── requirements.txt            # Python bağımlılıkları (tam — prod)
│   ├── requirements-test.txt       # Hafif CI bağımlılıkları (ML paketleri hariç)
│   ├── .dockerignore               # Docker build'dan çıkarılacak dosyalar
│   ├── Dockerfile                  # Backend container tanımı
│   ├── entrypoint.sh               # Docker başlangıç scripti (migration + server)
│   ├── pytest.ini                  # Test konfigürasyonu
│   ├── .env.example                # Ortam değişkenleri şablonu
│   ├── alembic.ini                 # Alembic konfigürasyonu
│   │
│   ├── alembic/                    # Veritabanı migration'ları
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 0000_baseline.py
│   │       ├── 7f45f11dd6c4_initial_schema.py
│   │       ├── b373651be828_initial_schema.py
│   │       ├── a1b2c3d4e5f6_new_features.py
│   │       ├── d9e8f7a6b5c4_postgres_hardening.py
│   │       ├── f1e2d3c4b5a6_notifications_table.py
│   │       ├── e1f2a3b4c5d6_excuse_unique_constraint.py
│   │       ├── c1d2e3f4a5b6_add_performance_indexes.py
│   │       ├── d4e5f6a7b8c9_dispute_attendance_record_fk.py
│   │       ├── g3h4i5j6k7l8_course_instructors_table.py
│   │       ├── f2a3b4c5d6e7_course_shared_class_id.py
│   │       └── h4i5j6k7l8m9_user_leadership_scope.py
│   │
│   ├── scripts/
│   │   └── encrypt_existing_embeddings.py      # Eski embedding'leri şifreler
│   │
│   ├── tests/                      # Pytest test suite
│   │   ├── conftest.py             # Fixture'lar, test DB kurulumu
│   │   ├── test_admin_settings.py  # Admin sistem ayarları testleri
│   │   ├── test_auth.py
│   │   ├── test_attendance.py
│   │   ├── test_courses.py
│   │   ├── test_dashboard.py
│   │   ├── test_disputes.py        # Dispute submission & review testleri
│   │   ├── test_face.py
│   │   ├── test_health.py
│   │   ├── test_new_features.py    # Genel entegrasyon testleri
│   │   ├── test_notifications.py   # Bildirim endpoint testleri
│   │   ├── test_rbac.py
│   │   ├── test_rooms.py           # Room CRUD testleri
│   │   ├── test_sessions.py
│   │   ├── test_users.py
│   │   ├── test_leadership.py        # Liderlik paneli RBAC & scope testleri
│   │   └── test_user_privileges.py   # Role/scope privilege escalation testleri
│   │
│   └── app/
│       ├── adapters/               # Storage soyutlama katmanı
│       │   ├── storage_adapter.py  # Abstract StorageAdapter arayüzü
│       │   └── supabase_storage.py # Supabase Storage implementasyonu
│       │
│       ├── api/                    # HTTP route'ları
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── courses.py
│       │   ├── rooms.py
│       │   ├── sessions.py
│       │   ├── attendance.py
│       │   ├── face.py
│       │   ├── excuses.py
│       │   ├── dashboard.py
│       │   ├── notifications.py
│       │   ├── audit_logs.py
│       │   ├── disputes.py
│       │   ├── admin_settings.py
│       │   ├── leadership.py       # YENİ (5/21/26): dekan/rektör analitik API
│       │   └── admin.py            # YENİ (5/21/26): distinct-departments vb.
│       │
│       ├── config/
│       │   └── settings.py         # Ortam değişkenleri (python-dotenv + os.getenv)
│       │
│       ├── core/
│       │   └── startup.py          # DB başlatma, admin seed, scheduler başlatma
│       │
│       ├── database/
│       │   ├── connection.py       # SQLAlchemy engine, session, Base
│       │   └── types.py            # Özel kolon tipleri (JSON uyumlu)
│       │
│       ├── integrations/
│       │   ├── face_engine.py      # InsightFace yüz tanıma motoru
│       │   └── supabase_client.py  # Supabase API istemcisi
│       │
│       ├── middleware/
│       │   └── sanitization.py     # YENİ: body boyutu, content-type, pattern tarama
│       │
│       ├── models/                 # SQLAlchemy ORM modelleri
│       │   ├── user.py
│       │   ├── course.py
│       │   ├── room.py
│       │   ├── session.py
│       │   ├── attendance.py
│       │   ├── face_reference.py
│       │   ├── excuse.py
│       │   ├── notification.py     # YENİ
│       │   ├── audit_log.py        # YENİ
│       │   ├── dispute.py          # YENİ
│       │   └── system_setting.py   # YENİ
│       │
│       ├── repositories/           # Veritabanı CRUD katmanı
│       │   ├── user_repo.py
│       │   ├── course_repo.py
│       │   ├── room_repo.py
│       │   ├── session_repo.py
│       │   ├── attendance_repo.py
│       │   ├── face_repo.py
│       │   ├── excuse_repo.py
│       │   └── notification_repo.py  # YENİ
│       │
│       ├── schemas/                # Pydantic doğrulama şemaları
│       │   ├── user.py
│       │   ├── course.py
│       │   ├── room.py
│       │   ├── session.py
│       │   ├── attendance.py
│       │   └── excuse.py
│       │
│       ├── security/
│       │   ├── jwt.py              # Token oluşturma (access + refresh)
│       │   ├── password.py         # bcrypt hash/verify
│       │   ├── dependencies.py     # get_current_user, require_leadership vb.
│       │   ├── user_privileges.py  # YENİ (5/21/26): role/scope escalation koruması
│       │   ├── crypto.py           # Fernet tabanlı embedding şifreleme
│       │   └── rate_limit.py       # YENİ: IP bazlı sabit pencere hız sınırı (Redis/bellek)
│       │
│       ├── services/               # İş mantığı katmanı
│       │   ├── auth_service.py
│       │   ├── session_service.py
│       │   ├── attendance_service.py   # 3 aşamalı yoklama pipeline
│       │   ├── face_service.py
│       │   ├── excuse_service.py       # YENİ: mazeret iş mantığı
│       │   ├── notification_service.py # YENİ: bildirim oluşturma & broadcast
│       │   ├── audit_service.py
│       │   ├── leadership_service.py   # YENİ (5/21/26): liderlik analitik sorguları
│       │   └── scheduler.py
│       │
│       └── utils/
│           ├── qr.py               # QR token üretme ve base64 görsel
│           ├── location.py         # Haversine mesafe, geofence, GPS plausibility kontrolü
│           └── push.py             # Expo push notification gönderimi
│
├── web-panel/                      # React admin/öğretmen paneli
│   ├── package.json
│   ├── Dockerfile
│   ├── playwright.config.js        # E2E test konfigürasyonu
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── index.js                # i18n bootstrap
│       ├── i18n/                   # react-i18next — Türkçe / İngilizce
│       │   ├── index.js
│       │   └── locales/
│       │       ├── tr/common.json
│       │       └── en/common.json
│       ├── setupProxy.js           # CRA geliştirme: /api → backend
│       ├── features/
│       │   ├── auth/               # Giriş; oturum httpOnly çerezlerle
│       │   ├── attendance/         # Yoklama, mazeretler, QR / yüz tarama
│       │   │   ├── components/
│       │   │   │   └── ExcuseDetailsModal/
│       │   │   └── services/
│       │   │       └── excuseService.js
│       │   ├── dashboard/
│       │   ├── schedule/
│       │   ├── settings/
│       │   ├── students/
│       │   ├── disputes/
│       │   └── audit/
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   └── LeadershipDashboardPage.jsx  # YENİ (5/21/26): dekan/rektör paneli
│       └── shared/
│           ├── services/
│           │   └── apiClient.js    # fetch + credentials; sessiz token yenileme
│           └── components/
│               ├── layout/Sidebar/
│               ├── LanguageSwitcher/
│               └── NotificationBell/
│
└── mobile-app/                     # React Native (Expo Router) mobil uygulama
    ├── package.json
    ├── app.config.js
    ├── babel.config.js
    ├── tailwind.config.js
    ├── app/                        # Expo Router ekranları
    │   ├── _layout.js
    │   ├── index.js
    │   ├── login-face-verify.js  # İsteğe bağlı: giriş sonrası yüz doğrulama
    │   ├── qr-scan.js
    │   ├── face-scan.js
    │   ├── gps-verify.js
    │   ├── register-face.js
    │   ├── cancel-class.js
    │   ├── excuse-submit.js
    │   ├── class-details.js
    │   ├── course-detail.js
    │   ├── students.js           # Öğretmen: derse göre öğrenci listesi (YENİ v4.2.1)
    │   ├── settings.js
    │   ├── (tabs)/               # Ana sekmeler
    │   │   ├── home.js
    │   │   ├── attendance.js
    │   │   ├── history.js
    │   │   ├── schedule.js
    │   │   ├── profile.js
    │   │   ├── dashboard.js
    │   │   ├── reports.js
    │   │   └── more.js
    │   └── components/
    │       └── home/             # Ana sayfa bileşenleri
    └── src/
        ├── config/env.js         # EXPO_PUBLIC_API_URL vb.
        ├── context/UserContext.js
        ├── hooks/
        │   └── useNotificationBadge.js  # Okunmamış bildirim sayacı (YENİ v4.2.1)
        ├── i18n/                 # react-i18next — tr/en JSON + helpers
        │   └── helpers.js        # useFlagReasonLabel, tarih/yoklama etiketleri
        ├── services/             # api, auth, attendance, bildirim…
        ├── utils/apiAdapter.js   # SecureStore + istekler
        ├── screens/              # Öğretmen ekranları (Instructor*)
        └── components/
            └── LanguageToggle.js # TR/EN dil anahtarı (YENİ v4.2.1)
```

---

## Nasıl Çalışır?

### Yoklama Akışı (3 Adım)

```
Öğretmen                        Öğrenci
   │                               │
   ├─ Oturum başlat               │
   ├─ QR kod üretilir             │
   │                               │
   │                    ┌──────────┤
   │                    │ ADIM 1   │ QR Tarama
   │                    │          │ → qr_token + session_id gönderir
   │                    │          │ → Backend: token geçerliliği kontrol
   │                    ├──────────┤
   │                    │ ADIM 2   │ Yüz Doğrulama
   │                    │          │ → 2 kare base64 görsel gönderir
   │                    │          │ → Backend: InsightFace embedding karşılaştırma
   │                    │          │ → Pasif canlılık kontrolü (2 kare farkı)
   │                    ├──────────┤
   │                    │ ADIM 3   │ Konum Doğrulama
   │                    │          │ → lat/lon/accuracy gönderir
   │                    │          │ → Backend: Haversine hesaplama
   │                    │          │ → Sınıf yarıçapı içinde mi kontrol
   │                    └──────────┤
   │                               │ ✅ Yoklama onaylandı
   │                               │    FinalAttendanceRecord oluşturulur
```

### Veri Akışı

```
Mobil uygulama                    Web panel
      │                               │
      │  HTTP + Authorization: Bearer  │  HTTP + çerez (httpOnly access/refresh)
      ▼                               ▼
              FastAPI /api/v1/*
      │
      ├─ SanitizationMiddleware (body boyutu, içerik tipi, XSS tarama)
      ├─ Security: JWT decode → get_current_user
      ├─ Router → Service → Repository
      ├─ SQLAlchemy ORM
      ▼
SQLite (dev) / PostgreSQL (prod)
      │
      ├─ Supabase Storage (opsiyonel — yüz görsel depolama)
```

---

## Kurulum

### Seçenek A: Docker Compose (Önerilen)

```bash
# Root .env dosyasını oluştur
cp backend/.env.example .env
# .env içinde SECRET_KEY ve ADMIN_PASSWORD değerlerini mutlaka değiştir!

# Tüm servisleri başlat
docker compose up --build

# Geliştirme araçlarıyla (Adminer DB UI dahil):
docker compose --profile dev up --build
```

Servisler:
- Backend API: `http://localhost:8000`
- Web Panel: `http://localhost:3000`
- Adminer (DB UI): `http://localhost:8080` *(yalnızca dev profiliyle)*

### Seçenek B: Manuel Kurulum

#### 1. Backend

```bash
cd backend

# Sanal ortam oluştur
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Bağımlılıkları kur
pip install -r requirements.txt

# .env dosyası oluştur
cp .env.example .env
# .env içinde SECRET_KEY'i değiştir!

# Başlat (sadece localhost — web panel için yeterli)
python -m uvicorn main:app --reload

# Başlat (0.0.0.0 — mobil uygulamanın ağdan erişebilmesi için ZORUNLU)
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> **Mobil uygulama bağlanamıyorsa:** Backend mutlaka `--host 0.0.0.0` ile başlatılmalıdır.
> `127.0.0.1` ile başlatılırsa telefon ağdan erişemez → "İstek zaman aşımına uğradı" hatası alınır.
> Windows'ta ayrıca port 8000'i güvenlik duvarından açmak gerekir:
> ```powershell
> New-NetFirewallRule -DisplayName "Smart Attendance API 8000" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
> ```

Backend `http://0.0.0.0:8000` adresinde çalışır (her ağ arayüzünden erişilebilir).
API dokümantasyonu: `http://localhost:8000/docs` *(yalnızca DEBUG=true)*

#### 2. Web Panel

```bash
cd web-panel
npm install
npm start
```

Panel `http://localhost:3000` adresinde açılır.

**Üretim / ayrı backend host:** Kök URL’yi `web-panel/.env` veya derleme ortamında `REACT_APP_API_URL` ile ver (ör. `https://api.ornek.com`). Çerez tabanlı oturum için backend’in `CORS_ORIGINS` ve `COOKIE_*` ayarlarının panel origin’i ile uyumlu olması gerekir.

#### 3. Mobile App

```bash
cd mobile-app
npm install --legacy-peer-deps
npx expo start
```

Expo Go uygulaması veya emülatör ile bağlan.

**API adresi:** Proje kökünde veya `mobile-app` içinde `.env` ile `EXPO_PUBLIC_API_URL` ayarla (`mobile-app/.env.example` şablonuna bak). EAS build için sırları EAS Secrets üzerinden ver.

---

## Veritabanı Migration (Alembic)

```bash
cd backend

# Migration geçmişini gör
alembic history

# Tüm migration'ları uygula
alembic upgrade head

# Yeni migration oluştur (model değişikliği sonrası)
alembic revision --autogenerate -m "açıklama"

# Bir önceki sürüme dön
alembic downgrade -1
```

Docker ile migration otomatik olarak `entrypoint.sh` tarafından çalıştırılır.

---

## Backend Test Standardı

### Docker ile (CI yöntemi — önerilen)

```bash
# Önce image'ı build et:
docker build -t smart-attendance-backend:ci backend/

# Sonra testleri pre-built image üzerinde çalıştır:
docker run --rm \
  -e ENV=test \
  -e TESTING=true \
  -e DATABASE_URL=sqlite:///./test.db \
  -e SECRET_KEY=ci-test-secret-key \
  smart-attendance-backend:ci \
  python -m pytest -v --tb=short
```

### Yerel ortamda (hızlı geliştirme)

```bash
cd backend

# Hafif CI bağımlılıklarını kur (insightface/onnxruntime olmadan ~1 dk):
pip install -r requirements-test.txt

# Testleri çalıştır:
TESTING=true DATABASE_URL=sqlite:///./test.db python -m pytest -v
```

Notlar:
- Test veritabanı SQLite'dır; production yapılandırması etkilenmez.
- `insightface` kurulu değilse yüz tanıma testleri otomatik atlanır (graceful fallback).
- Rate limiter her test öncesi sıfırlanır (`conftest.py` → `reset_for_testing()`).
- Test dosyaları: `tests/test_auth.py`, `test_attendance.py`, `test_rbac.py` vb.

---

## Ortam Değişkenleri (`backend/.env`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./smart_attendance.db` | SQLite veya PostgreSQL bağlantı URL'i |
| `SECRET_KEY` | — | JWT imzalama anahtarı — **production'da uzun rastgele string kullan!** |
| `ENCRYPTION_KEY` | — | Yüz embedding şifreleme anahtarı (Fernet) — 32 byte hex |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token geçerlilik süresi |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token geçerlilik süresi |
| `CORS_ORIGINS` | `localhost:3000,5173,8081` | İzin verilen frontend origin'leri |
| `ADMIN_EMAIL` | `admin@attendance.com` | İlk admin e-postası |
| `ADMIN_USERNAME` | `admin` | İlk admin kullanıcı adı |
| `ADMIN_PASSWORD` | — | İlk admin şifresi — **güçlü bir şifre kullan!** |
| `SUPABASE_URL` | — | Supabase proje URL'i (opsiyonel) |
| `SUPABASE_ANON_KEY` | — | Supabase anon public key (opsiyonel) |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key (opsiyonel, backend only) |
| `FACE_SIMILARITY_THRESHOLD` | `0.5` | Yüz eşleşme eşiği (0–1, düşük = daha katı) |
| `FACE_LIVENESS_THRESHOLD` | `0.5` | Canlılık kontrolü eşiği |
| `DEFAULT_GEOFENCE_RADIUS_M` | `50` | Sınıf yarıçapı (metre) |
| `MAX_GPS_ACCURACY_M` | `80.0` | Maksimum GPS hata toleransı (metre) |
| `GPS_ACCURACY_THRESHOLD` | `80.0` | Bu değerin altındaki accuracy (m) şüpheli sayılır |
| `QR_TOKEN_TTL_SECONDS` | `60` | QR kodunun geçerlilik süresi (saniye) |
| `LOGIN_RATE_LIMIT` | `10/minute` | Giriş denemesi hız sınırı |
| `REDIS_URL` | — | Redis bağlantı URL'i (opsiyonel — yoksa in-memory rate limit kullanılır) |
| `COOKIE_SECURE` | `false` | HTTPS zorunluluğu (production'da `true` yap) |
| `COOKIE_SAMESITE` | `lax` | Cookie SameSite politikası |
| `DEBUG` | `false` | Swagger UI ve detaylı hata mesajları |
| `HOST` | `0.0.0.0` | Sunucu host adresi |
| `PORT` | `8000` | Sunucu portu |

`ENCRYPTION_KEY` oluşturmak için:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## API Endpoint'leri

Tüm endpoint'ler `/api/v1` prefix'i ile başlar. Swagger UI: `http://localhost:8000/docs` *(DEBUG=true gerekli)*

### Auth (`/api/v1/auth`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| POST | `/login` | E-posta veya kullanıcı adı ile giriş; tarayıcıda httpOnly çerez olarak token | Herkese açık |
| POST | `/refresh` | Yeni access token al | Refresh token |
| GET | `/me` | Mevcut kullanıcı bilgisi | Giriş yapılmış |
| POST | `/push-token` | Expo push token kaydet | Giriş yapılmış |
| POST | `/logout` | Çıkış (client token siler) | Giriş yapılmış |

### Users (`/api/v1/users`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/` | Tüm kullanıcılar | Admin |
| POST | `/` | Yeni kullanıcı oluştur | Admin |
| GET | `/{id}` | Kullanıcı detayı | Admin / kendisi |
| PATCH | `/{id}` | Kullanıcı güncelle | Admin |
| DELETE | `/{id}` | Kullanıcı sil | Admin |

### Courses (`/api/v1/courses`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/` | Tüm dersler | Giriş yapılmış |
| POST | `/` | Ders oluştur | Admin |
| POST | `/{id}/enroll` | Öğrenci ekle | Admin/Öğretmen |
| DELETE | `/{id}/enroll/{student_id}` | Öğrenci çıkar | Admin |

### Sessions (`/api/v1/sessions`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/` | Oturumları listele | Giriş yapılmış |
| GET | `/active` | Aktif oturumlar | Giriş yapılmış |
| POST | `/start` | Oturum başlat | Öğretmen/Admin |
| POST | `/{id}/end` | Oturum bitir | Öğretmen/Admin |
| GET | `/{id}/qr` | QR görsel al | Öğretmen/Admin |
| POST | `/cancel` | Ders iptal et | Öğretmen/Admin |

### Attendance (`/api/v1/attendance`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| POST | `/scan-qr` | **ADIM 1** QR tara *(hız sınırlı)* | Öğrenci |
| POST | `/verify-face` | **ADIM 2** Yüz doğrula *(hız sınırlı)* | Öğrenci |
| POST | `/verify-location` | **ADIM 3** Konum doğrula *(hız sınırlı)* | Öğrenci |
| POST | `/web-attend` | Web üzerinden tek adımda yoklama *(hız sınırlı)* | Öğrenci |
| GET | `/my-history` | Öğrencinin kendi geçmişi | Öğrenci |
| GET | `/records` | Tüm kayıtlar (SQL sayfalama, rol filtreli) | Öğretmen/Admin |
| GET | `/session/{id}` | Oturum yoklama listesi | Öğretmen/Admin |
| GET | `/flagged` | İşaretli kayıtlar | Öğretmen/Admin |
| POST | `/manual` | Manuel yoklama | Öğretmen/Admin |
| GET | `/export` | Excel/PDF dışa aktarım (`X-Export-Truncated` header'lı, max 5.000 satır) | Öğretmen/Admin |

### Face (`/api/v1/face`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| POST | `/register` | Yüz vektörü kaydet | Öğrenci |
| GET | `/status` | Yüz kaydı var mı? | Giriş yapılmış |
| DELETE | `/` | Yüz verisini sil | Admin |

### Excuses (`/api/v1/excuses`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| POST | `/` | Mazeret gönder | Öğrenci |
| GET | `/` | Mazeretleri listele | Öğretmen/Admin |
| PATCH | `/{id}/review` | Mazeret onayla/reddet | Öğretmen/Admin |

### Disputes (`/api/v1/disputes`) — YENİ

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| POST | `/` | Yoklama itirazı gönder | Öğrenci |
| GET | `/` | İtirazları listele | Giriş yapılmış (role bazlı) |
| PATCH | `/{id}` | İtirazı onayla/reddet | Öğretmen/Admin |

### Notifications (`/api/v1/notifications`) — YENİ

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/count` | Okunmamış bildirim sayısı (badge için) | Giriş yapılmış |
| GET | `/` | Bildirim listesi (sayfalı) | Giriş yapılmış |
| PATCH | `/{id}/read` | Bildirimi okundu işaretle | Giriş yapılmış |
| PATCH | `/read-all` | Tümünü okundu işaretle | Giriş yapılmış |
| POST | `/broadcast` | Rol bazlı sistem duyurusu gönder | Admin |

### Audit Logs (`/api/v1/audit-logs`) — YENİ

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/` | Denetim kayıtlarını listele (filtrelenebilir) | Admin |

### Admin Settings (`/api/v1/admin/settings`) — YENİ

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/` | Tüm sistem ayarlarını getir | Admin |
| PUT | `/{key}` | Bir ayarı güncelle | Admin |

Dinamik ayarlar: `qr_token_ttl_seconds`, `min_attendance_rate`, `geofence_radius_m`

### Dashboard (`/api/v1/dashboard`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/stats` | Genel istatistikler (role-aware) | Giriş yapılmış |
| GET | `/course-performance` | Ders bazlı devam oranı | Öğretmen/Admin |
| GET | `/recent-activity` | Son aktiviteler | Giriş yapılmış |

### Leadership (`/api/v1/leadership`) — YENİ (5/21/26)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/overview` | KPI özeti (öğrenci sayısı, ort. devam, aktif ders, şüpheli yoklama) | Dekan / Rektör |
| GET | `/departments` | Rektör: bölüm karşılaştırması; Dekan: bölüm içi ders performansı | Dekan / Rektör |
| GET | `/at-risk` | Risk altındaki öğrenciler (`min_attendance_rate` + sayfalama) | Dekan / Rektör |

### Admin (`/api/v1/admin`) — YENİ (5/21/26)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/distinct-departments` | Öğrenci bölümlerinin benzersiz listesi (dekan scope dropdown) | Admin |

### Health

| Method | Path | Açıklama |
|---|---|---|
| GET | `/health` | Temel sağlık kontrolü |
| GET | `/api/v1/health` | API sağlık kontrolü |
| GET | `/health/ready` | DB bağlantısı + storage + pool durumu |

---

## Roller ve Yetkiler

| Rol | Türkçe | Yapabilecekleri |
|---|---|---|
| `admin` | Yönetici | Tüm işlemler, kullanıcı yönetimi, dekan/rektör oluşturma, sistem ayarları, denetim kayıtları |
| `rector` | Rektör | Liderlik analitik paneli (kurum geneli, salt okunur) |
| `dean` | Dekan | Liderlik analitik paneli (kendi bölümü, salt okunur) |
| `instructor` | Öğretmen | Oturum başlat/bitir, QR üret, yoklama gör, mazeret/itiraz incele |
| `student` | Öğrenci | Yoklamaya katıl (3 adım), kendi geçmişini gör, mazeret/itiraz gönder |

**Dekan scope:** `scope_type=department`, `scope_value` = öğrencilerdeki `department` ile birebir eşleşmeli.  
**Rektör scope:** `scope_type=university` (kurum geneli).

---

## Veritabanı Modeli

```
users                           → Tüm kullanıcılar (rol bazlı; scope_type, scope_value dekan/rektör için)
courses                         → Dersler
enrollments                     → Öğrenci-ders kaydı
rooms                           → Sınıflar (lat/lon/yarıçap)
attendance_sessions             → Yoklama oturumları (QR token içerir)
attendance_attempts             → Her öğrencinin pipeline ilerleme durumu
final_attendance_records        → Tamamlanan yoklama kayıtları
class_cancellations             → İptal edilen dersler
face_references                 → Yüz embedding vektörleri (Fernet şifreli)
excuses                         → Mazeretler
attendance_disputes             → Yoklama itirazları (→ final_attendance_records FK)
notifications                   → Kullanıcı bildirimleri
audit_logs                      → Denetim kayıtları
system_settings                 → Dinamik sistem ayarları
```

**Performans indeksleri:** `student_id`, `course_id`, `marked_at` (final_attendance_records), `student_id`, `session_id` (attendance_attempts), `student_id`, `course_id`, `status` (attendance_disputes) kolonlarına indeks eklidir.

---

## Özellikler

### Yüz Tanıma

Sistem **InsightFace `buffalo_l`** modelini kullanır.

- **Embedding çıkarma:** Her yüz için 512 boyutlu vektör üretilir
- **Benzerlik:** Cosine similarity ile karşılaştırma yapılır
- **Eşik:** `FACE_SIMILARITY_THRESHOLD = 0.5` (varsayılan)
- **Canlılık:** Pasif — iki ayrı kare arasındaki embedding farkına bakılır
- **Şifreleme:** Fernet (AES-128-CBC) ile embedding'ler şifreli saklanır
- **Fallback:** insightface kurulu değilse sistem çalışmaya devam eder, yüz adımı otomatik geçer

```bash
# Yüz tanıma için ek kurulum
pip install insightface onnxruntime opencv-python numpy
```

### Yüz Embedding Şifreleme

`ENCRYPTION_KEY` tanımlıysa yüz vektörleri veritabanına şifreli (`v1:<fernet_token>` formatında) yazılır. Mevcut şifresiz embedding'leri şifrelemek için:

```bash
python scripts/encrypt_existing_embeddings.py
```

### Bildirim Sistemi

- Ders iptali → derse kayıtlı öğrencilere otomatik bildirim
- Yoklama itirazı gönderilince → öğretmene DB + Push bildirim
- İtiraz onaylanınca/reddedilince → öğrenciye DB + Push bildirim
- Admin broadcast → rol bazlı sistem duyurusu
- Web panel'de bildirim zili bileşeni (her 15–30 sn badge polling)
- Mobil uygulamada Expo Push API entegrasyonu
- Tüm bildirim çağrıları `try-except` ile sarılıdır; servis hatası ana işlemi kesmez

### Hız Sınırlama (Rate Limiting)

`app/security/rate_limit.py` modülü sabit pencere (fixed window) algoritmasıyla IP bazlı hız sınırı uygular.

- Login, QR tarama, yüz ve konum doğrulama endpoint'leri korunur
- Backend: in-memory dictionary (varsayılan) veya Redis (`REDIS_URL` tanımlıysa otomatik)
- Redis bağlantısı kesilirse in-memory'e düşer (graceful fallback)
- FastAPI `Depends()` factory olarak bağlanır: `Depends(rate_limit("30/minute"))`

### GPS Güçlendirme

Koordinat doğrulaması iki katmanda uygulanır:

| Katman | Kontrol |
|---|---|
| Pydantic şema (`VerifyLocationRequest`, `WebAttendanceRequest`) | Koordinat aralığı (±90°/±180°), Null Island (0,0) reddi |
| Servis katmanı (`check_gps_plausibility`) | Mock GPS tespiti, sub-metre şüpheli accuracy (< 0.5 m) |

`is_mocked: true` gönderilirse veya accuracy şüpheliyse kayıt `is_flagged=true` olarak işaretlenir.

### Yoklama İtiraz Sistemi

Öğrenciler eksik/hatalı yoklama kayıtları için itiraz gönderebilir. Öğretmen itirazı onaylarsa `FinalAttendanceRecord` otomatik güncellenir.

- `attendance_record_id` FK ile itiraz doğrudan kayda bağlıdır (veri bütünlüğü)
- Öğrenci itiraz sonucunu anlık Expo Push bildirimiyle öğrenir
- Öğretmen yeni itiraz geldiğinde bildirim alır

### Denetim Kayıtları (Audit Log)

Kritik işlemler (dispute, mazeret onayı vb.) `audit_logs` tablosuna kaydedilir. Admin panelinden eylem, aktör ve kaynak bazlı filtrelenerek görüntülenebilir.

### Dinamik Sistem Ayarları

Admin panelinden çalışma zamanında değiştirilebilen ayarlar:

| Anahtar | Varsayılan | Açıklama |
|---|---|---|
| `qr_token_ttl_seconds` | `60` | QR kod geçerlilik süresi |
| `min_attendance_rate` | `70` | Minimum devam oranı (%) |
| `geofence_radius_m` | `50` | Konum doğrulama yarıçapı |

### Sanitization Middleware

Her gelen istek için:
- Maksimum body boyutu kontrolü
- Content-Type doğrulaması
- Zararlı pattern taraması (XSS, injection)

### Scheduler (Otomatik Oturum Kapatma)

APScheduler ile her 5 dakikada bir aktif oturumlar kontrol edilir. Bitiş saati geçmiş oturumlar otomatik olarak `completed` durumuna alınır.

---

## Production'a Geçiş

1. `SECRET_KEY` değerini uzun ve rastgele bir string ile değiştir
2. `ENCRYPTION_KEY` oluştur: `python -c "import secrets; print(secrets.token_hex(32))"`
3. `DATABASE_URL` değerini PostgreSQL bağlantı dizisiyle güncelle
4. `ADMIN_PASSWORD` değerini güçlü bir şifreyle değiştir
5. `DEBUG=false` yap (Swagger UI otomatik devre dışı kalır)
6. `COOKIE_SECURE=true` ve `COOKIE_DOMAIN=.yourdomain.com` ayarla
7. Supabase kullanıyorsan `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` ekle
8. (Opsiyonel) Hız sınırlama için `REDIS_URL` ekle; yoksa in-memory kullanılır
9. `docker-compose.yml`'deki PostgreSQL port satırını `127.0.0.1:5432:5432` olarak bırak (zaten ayarlı)
10. Web panel için `npm run build` ile production build al
11. Docker Compose ile başlat: `docker compose up -d`

> **Güvenlik hatırlatması:** `.env.prod`, `mobile-app/.env` ve benzeri tüm ortam dosyaları `.gitignore` ile koruma altındadır. Bu dosyaları **asla** versiyona ekleme. CI/CD sırlarını GitHub Actions → Settings → Secrets bölümüne gir.

Alternatif olarak gunicorn ile:
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## Geliştirme Notları

### Eski Sistemden Farklar

Bu proje, eski Flask tabanlı monolitik `app.py` sisteminin yerine geçen tam yeniden yazımdır.

| Eski Sistem | Yeni Sistem (v3.0.0) |
|---|---|
| Flask (monolitik `app.py`, 73KB) | FastAPI (modüler router/service/repo katmanları) |
| JSON dosya tabanlı veri saklama | SQLAlchemy ORM (SQLite/PostgreSQL) + Alembic migration |
| Mock/sahte data | Gerçek veritabanı kayıtları |
| username bazlı JWT | Web panel: httpOnly çerez; mobil: Bearer JWT + SecureStore |
| passlib (uyumsuz) | Doğrudan bcrypt kullanımı |
| Tek aşamalı yoklama | 3 aşamalı pipeline (QR + Yüz + GPS) |
| Bildirim yok | Expo Push API + in-app bildirim + dispute bildirimleri |
| Scheduler yok | APScheduler (otomatik oturum kapatma) |
| Şifreleme yok | Fernet tabanlı embedding şifreleme |
| İtiraz sistemi yok | Yoklama itiraz & mazeret workflow + direkt FK |
| Denetim kaydı yok | Audit log sistemi |
| Hız sınırı yok | IP bazlı rate limiting (in-memory / Redis) |
| GPS doğrulama yok | Null Island reddi + mock GPS tespiti + accuracy kontrolü |
| N+1 sorgu sorunu | `joinedload` ile tek JOIN sorgusu |
| Sayfalama Python'da | SQL katmanında `WHERE IN` + `COUNT(*)` ile doğru sayfalama |
| İndeks yok | 8 kritik kolona veritabanı indeksi |
| Export sınırı yok | `_EXPORT_LIMIT=5000` + `X-Export-Truncated` header |
| Docker desteği yok | Dockerfile + `.dockerignore` + Docker Compose |
| Test yok | Tam pytest suite + GPS hardening test sınıfı |
| CI yok | GitHub Actions CI (GHA layer cache ile hızlı build) |

### Çok dilli arayüz (Web panel + Mobil)

Her iki istemci **Türkçe** (varsayılan) ve **İngilizce** destekler (`react-i18next`).

| Platform | Bileşen | Tercih saklama |
|----------|---------|----------------|
| **Web panel** | `shared/components/LanguageSwitcher/` | `localStorage` (`i18nextLng`); öğretmen üst çubukta bildirim solunda |
| **Mobil** | `src/components/LanguageToggle.js` | `AsyncStorage`; giriş, ana sayfa, öğretmen paneli ve ayarlarda |

Çeviri dosyaları: `web-panel/src/i18n/locales/{tr,en}/` ve `mobile-app/src/i18n/locales/{tr,en}/` (ekran, yoklama, auth vb. namespace'ler).

### Web Panel Proxy Yapılandırması

`web-panel/src/setupProxy.js` dosyası, geliştirme sırasında yalnızca `/api` ile başlayan istekleri backend’e (varsayılan `http://localhost:8000`) yönlendirir. Statik dosyalar proxy'den geçmez. Üretim derlemesinde istekler doğrudan `REACT_APP_API_URL` üzerinden gider.

### Mobile Uygulama Token Yönetimi

`expo-secure-store` kullanılarak access token ve refresh token güvenli şekilde cihazda saklanır. Token süresi dolduğunda `apiAdapter.js` içindeki interceptor otomatik olarak `/api/v1/auth/refresh` çağırır.

### Supabase Entegrasyonu

Supabase tamamen opsiyoneldir. `SUPABASE_URL` ve `SUPABASE_ANON_KEY` tanımlı değilse sistem yerel modda çalışır ve storage kontrolleri atlanır. Tanımlıysa `/health/ready` endpoint'i Supabase storage erişilebilirliğini de kontrol eder.

---

## CI/CD (GitHub Actions)

Her `push` ve `pull_request`'te `.github/workflows/ci.yml` çalışır:

| Job | Açıklama |
|-----|----------|
| `backend-test` | Pytest + coverage (≥%60 zorunlu) + Alembic `check` |
| `backend-sast` | Bandit ile statik güvenlik taraması |
| `secret-scan` | Gitleaks ile gizli anahtar taraması |
| `web-build` | ESLint + `npm run build` |
| `mobile-lint` | ESLint (React Native) |

```yaml
# Yerel CI simülasyonu:
docker build -t smart-attendance-backend:ci backend/
docker run --rm -e ENV=test -e TESTING=true \
  -e DATABASE_URL=sqlite:///./test.db \
  -e SECRET_KEY=test-key \
  smart-attendance-backend:ci python -m pytest -v
```

> **Önemli:** CI sırlarını (`SECRET_KEY`, `DATABASE_URL` vb.) GitHub repo'ya düz metin olarak ekleme. GitHub → Settings → Secrets and Variables → Actions bölümünden ekle.

---

## Yapılan Optimizasyon ve Düzeltmeler

Bu bölüm, sisteme yapılan performans, güvenlik ve UI/UX iyileştirmelerini belgeler.

---

### Backend — Performans & Güvenlik İyileştirmeleri

#### N+1 Sorgu Düzeltmeleri

| Dosya | Sorun | Düzeltme |
|---|---|---|
| `app/repositories/course_repo.py` | Öğrencinin katılabileceği dersler her oturum için ayrı sorguyla kontrol ediliyordu | `EnrollmentRepository.get_attendable_course_ids()` metodu eklendi; parallel dersler dahil tüm ders ID'leri 2–3 sorguda batch olarak çekiliyor |
| `app/repositories/session_repo.py` | Öğrenci aktif oturumları loop içinde filtreleniyordu | `SessionRepository.get_active_for_student(course_ids)` metodu eklendi; `WHERE course_id IN (...)` ile tek sorguda filtreleme |
| `app/api/sessions.py` | `get_sessions` ve `get_active_sessions` endpoint'leri her oturum için ayrı enrollment sorgusu yapıyordu | Yeni batch metodlara yönlendirildi; bildirim loop'larında `get_by_ids()` ile toplu kullanıcı çekimi |
| `app/repositories/user_repo.py` | Bildirim döngülerinde her kullanıcı için `get_by_id()` çağrısı yapılıyordu | `get_by_ids(user_ids: list)` metodu eklendi; tek `IN` sorgusuyla toplu kullanıcı yükleme |
| `app/api/dashboard.py` | `course_performance` endpoint'i her ders için ayrı `.count()` sorguları yapıyordu | `GROUP BY` ile aggregate sorgulara dönüştürüldü; enrollment, session ve yoklama sayıları 3 sorguda tüm dersler için çekiliyor |

#### Önbellek (Cache) İyileştirmeleri

| Dosya | İyileştirme |
|---|---|
| `app/api/admin_settings.py` | Thread-safe TTL önbellek eklendi (`_settings_cache`, 60 sn); sık erişilen ayarlar DB'ye gitmeden bellekten okunuyor; `update_setting` çağrısında cache otomatik temizleniyor |

#### Yüz Tanıma Performansı

| Dosya | İyileştirme |
|---|---|
| `app/integrations/face_engine.py` | `det_size` `(640,640)` → `(320,320)` küçültüldü; `check_liveness()` artık `emb1` gömme vektörünü geri döndürüyor; `ThreadPoolExecutor` (`_FACE_EXECUTOR`) ve asenkron `extract_embedding_async()` eklendi |
| `app/services/face_service.py` | `verify()` metodunda canlılık kontrolünden gelen embedding yeniden kullanılıyor; aynı görüntü için çift embedding hesaplama ortadan kalktı |

#### Güvenlik & Kararlılık

| Dosya | Düzeltme |
|---|---|
| `app/security/jwt.py` | JWT kara listesi Redis destekli hale getirildi; `REDIS_URL` tanımlıysa `_RedisBlacklist`, yoksa `_InMemoryBlacklist` kullanılıyor; çok worker'lı ortamda token iptali artık tutarlı |
| `main.py` | `/health/ready` endpoint'inde `db` değişkeni `None` ile önceden başlatıldı; `SessionLocal()` başarısız olursa `finally` bloğunda `UnboundLocalError` oluşmuyordu — düzeltildi |
| `app/middleware/sanitization.py` | Base64 görsel içeren path'ler (`/face/`, `/attendance/verify-face`, `/attendance/web-attend`) için şüpheli pattern taraması atlanıyor; büyük payload'larda gereksiz CPU/bellek tüketimi önlendi |
| `app/security/rate_limit.py` | Expired entry temizliği her istekte değil 500 istekte bir yapılıyor; amortize O(1) maliyete düşürüldü |

#### Diğer Backend İyileştirmeleri

| Dosya | İyileştirme |
|---|---|
| `entrypoint.sh` | Gunicorn worker sayısı `2` → `4` artırıldı |
| `backend/.env` / `backend/app/config/settings.py` | `FACE_SIMILARITY_THRESHOLD` `0.55` → `0.5` olarak güncellendi |
| `backend/.env.example` | Eksik `.env.example` şablon dosyası oluşturuldu |

---

### Mobil Uygulama — UI/UX Düzeltmeleri

#### Kritik Hatalar

| Dosya | Sorun | Düzeltme |
|---|---|---|
| `app/(tabs)/profile.js` | `admin` rolü öğrenci profilini görüyordu ("Öğrenci · {no}" yazıyordu) | `admin` rolü de `InstructorProfile` ekranına yönlendiriliyor; `InstructorProfile.js`'de unvan "Yönetici" olarak gösteriliyor |
| `app/register-face.js` | Öğretmen/admin yüz kaydı sonrası `/(tabs)/home`'a (öğrenci sayfasına) yönlendiriliyordu | Rol kontrolü eklendi; `instructor`/`admin` → `/(tabs)/dashboard`, `student` → `/(tabs)/home`. "Sonra Yap" butonu da aynı şekilde güncellendi |
| `app/(tabs)/home.js` | `recentActivity` state hiç doldurulmuyordu; `RecentActivity` bileşeni render edilmiyordu | `fetchData()` içine `dashboard.recentActivity()` çağrısı eklendi |
| `app/(tabs)/dashboard.js` | `DAY_FULL[getDay() + daysAhead % 7]` operatör önceliği hatası — endeks `[0..13]` aralığına çıkabiliyordu | `DAY_FULL[(getDay() + daysAhead) % 7]` olarak düzeltildi |
| `app/gps-verify.js` | `useEffect(() => { startVerification(); }, [])` boş bağımlılık — `session_id` param değişirse yeniden tetiklenmiyordu | `[startVerification]` bağımlılığına güncellendi |

#### Önemli Hatalar

| Dosya | Sorun | Düzeltme |
|---|---|---|
| `app/course-detail.js` | "Genel Devam" sekmesi placeholder mesajı gösteriyordu, gerçek devam oranı hesaplanmıyordu | `attendanceApi.getRecords({ course_id })` ile tüm kurs kayıtları çekiliyor; öğrenci bazında `%xx (x/x)` ve `⚠ Düşük` uyarısı gösteriliyor |
| `app/class-details.js` | `params.sessionId` okunmuyordu; belirli bir oturum bağlamında açılınca kayıtlar yüklenmiyordu | `sessionId` param okunup `loadStudents(courseId, sessionId)` olarak iletiliyor |
| `app/(tabs)/history.js` | `Alert.prompt` iOS-only; Android'de hiç çalışmıyordu | Cross-platform `Modal + TextInput + KeyboardAvoidingView` tabanlı itiraz modalı ile değiştirildi |
| `app/settings.js` + `src/services/notificationService.js` | Bildirim toggle'ları yalnızca `AsyncStorage`'a yazıyordu; ön plan bildirim filtrelemesini etkilemiyordu | `updateNotificationPreferences()` ile `Notifications.setNotificationHandler` anlık güncelleniyor; `loadNotificationPreferences()` uygulama başlangıcında yükleniyor |
| `app/components/ExcuseModal.js` | Hiçbir yerde import edilmeyen dead code (11 KB) | Silindi |
| `app/components/home/FaceWarning.js` | Hiçbir yerde kullanılmayan dead code (1.5 KB) | Silindi |
| `app/components/home/LiveClassCard.js` | `Animated.loop` için cleanup (`loop.stop()`) yoktu; unmount sonrası memory leak | `return () => loop.stop()` cleanup eklendi; `pulse` bağımlılığa alındı |

---

### Web Panel — UI/UX Düzeltmeleri

#### Kritik Hatalar

| Dosya | Sorun | Düzeltme |
|---|---|---|
| `features/attendance/pages/AttendancePage/AttendancePage.jsx` | Flagged kayıtlardaki "Detail" butonu `ExcuseDetailsModal`'ı yanlış shape ile açıyordu (excuse objesi bekliyor, flagged record alıyordu) | Ayrı `handleViewRecord` + satır içi `AttendanceRecordModal` eklendi; artık doğru alanlar gösteriliyor |
| `features/dashboard/pages/AdminDashboardPage.jsx` | Oda oluşturma/düzenleme formunda `type` varsayılanı `'Fakulte Binasi'` (türkçe string); `<select>` value `'faculty'` (İngilizce) ile eşleşmiyordu | Default değer `'faculty'` olarak düzeltildi |

#### Önemli Hatalar

| Dosya | Sorun | Düzeltme |
|---|---|---|
| `shared/components/NotificationBell/NotificationBell.jsx` | `class_cancelled` bildirimi var olmayan `/?tab=sessions` URL'sine yönlendiriyordu | `/?tab=classroom` olarak düzeltildi |
| `features/dashboard/pages/InstructorDashboardPage.jsx` | `?tab=xxx` URL parametresi okunmuyordu; bildirim deep-link'leri çalışmıyordu | `readTabFromUrl()` yardımcı fonksiyonu eklendi; sayfa açılışında `activeTab` URL'den belirleniyor |
| `features/dashboard/pages/StudentDashboardPage.jsx` | Haftalık program yalnızca `schedule.days[]` formatını destekliyordu; `schedule.slots[]` formatı işlenmiyordu | Her iki format da normalize ediliyor; `_slotTime` alanı ile saat bilgisi doğru gösteriliyor |
| `pages/LoginPage.jsx` | Sol panel içeriği hardcode İngilizce (`"Smart Attendance System"`, `"Welcome back..."`) | `t('auth.loginPanel.appName')` ve `t('auth.loginPanel.tagline')` i18n anahtarlarına alındı; EN/TR JSON'lara eklendi |
| `features/auth/components/LoginForm/LoginForm.jsx` + `context/AuthContext.jsx` | "Beni Hatırla" checkbox'ı görsel-only; `onLogin`'a iletilmiyor, backend'e yansımıyordu | `rememberMe` parametresi tüm zincirden geçirildi; `true` → `localStorage`, `false` → `sessionStorage` |
| `features/dashboard/components/DashboardView.js` | "End Session" hatası yalnızca `console.error` ile sessizce yutuluyordu | Kırmızı hata banner'ı + buton `disabled` + loading göstergesi eklendi |

#### Normal (i18n / Tutarlılık)

| Dosya | Sorun | Düzeltme |
|---|---|---|
| `features/attendance/components/FlaggedAttendanceList/FlaggedAttendanceList.jsx` | `t('flaggedList.student')` gibi kısa anahtarlar kullanılıyordu; JSON'da `flaggedList.columns.student` olarak vardı | Tüm kolon/durum anahtarları doğru nested path'e güncellendi |
| `i18n/locales/en/common.json` + `tr/common.json` | `common.noData` her iki dil dosyasında da iki kez tanımlanmıştı (duplicate key — ikinci değer birincinin üzerine yazıyordu) | İlk tanım birleştirilerek tekrarlayan satır silindi |
| `i18n/locales/*/common.json` | `common.undo`, `common.retry`, `students.subtitle`, `students.deleteConfirm`, `students.active`, `students.inactive`, `students.fullName` gibi bileşenlerde kullanılan anahtarlar JSON'da yoktu | Eksik tüm anahtarlar EN ve TR JSON dosyalarına eklendi |
| `pages/LoginPage.jsx` | Sol panel metinleri çevrilmemişti | `auth.loginPanel.appName` ve `auth.loginPanel.tagline` anahtarları eklendi |

---

### Kaldırılan Dosyalar

| Dosya | Sebep |
|---|---|
| `mobile-app/app/components/ExcuseModal.js` | Hiçbir yerde import edilmeyen dead code |
| `mobile-app/app/components/home/FaceWarning.js` | Hiçbir yerde kullanılmayan dead component |
| `mobile-app/src/api/apiClient.js` | Kırık import path içeren dead code; `apiAdapter.js` kullanılmalı |

---

### Güvenlik Denetimi — Kapsamlı Düzeltmeler (v4.2)

Bu bölüm, derin güvenlik ve kalite denetimi sonucu tespit edilen ve giderilen tüm kritik, önemli ve normal kategorideki sorunları belgeler.

---

#### 🔴 KRİTİK — Backend Yetkilendirme (IDOR / Privilege Escalation)

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| B1 | `services/session_service.py` | Herhangi bir instructor başka öğretmenin dersinde oturum açabiliyordu | `start_session` içine `is_instructor_of_course` ownership kontrolü eklendi |
| B2 | `services/session_service.py` | `end_session` ve `get_qr_image` caller doğrulaması yoktu | Her iki metoda da instructor ownership kontrolü eklendi |
| B3 | `api/sessions.py` | `cancel_class` çağıranın o dersi öğretip öğretmediğini kontrol etmiyordu | Instructor scope kontrolü eklendi |
| B4 | `api/courses.py` | `unenroll_student` ve `get_course_students` herhangi instructor için çalışıyordu | Kurs ownership doğrulaması eklendi |
| B5 | `api/courses.py` | Instructor farklı `instructor_id` geçerek başkası adına ders oluşturabiliyordu | `create_course`'da instructor kendi ID'sine kilitlendi; admin tüm ID'leri atayabilir |
| B6 | `api/excuses.py` | `review_excuse` kurs scope kontrolü yoktu (IDOR) | Instructor yalnızca kendi derslerinin mazeretlerini inceleyebilir |
| B7 | `api/excuses.py` | `get_excuse`, `get_excuse_document`, `get_excuse_signed_url` IDOR açığı | Her endpoint'e instructor kurs ownership kontrolü eklendi |
| B8 | `api/face.py` | `enroll_student` hedef öğrencinin instructor'ın dersine kayıtlı olup olmadığını kontrol etmiyordu | Enrollment kesişim kontrolü eklendi |
| B9 | `api/sessions.py` | Öğrenciye tüm derslerin iptalleri, instructor için tüm oturumlar dönüyordu | Rol bazlı filtreleme: öğrenci yalnızca kayıtlı derslerini, instructor yalnızca kendi derslerini görür |
| B10 | `api/disputes.py` | `submit_dispute` enrollment ve `session.course_id` eşleşme kontrolü yoktu | Enrollment doğrulaması ve `course_id == session.course_id` kontrolü eklendi |

#### 🔴 KRİTİK — Backend Runtime Hataları

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| B11 | `services/notification_service.py` | `notify_absent_students` finally bloğunda `db` tanımsızsa `NameError` | `db = None` ile önceden başlatıldı |
| B12 | `security/dependencies.py` | Hatalı JWT `sub`'ında `int(user_id)` 500 fırlatıyordu | `try/except (TypeError, ValueError)` ile 401 döndürüldü |
| B13 | `requirements.txt` | `redis` paketi eksikti; Redis blacklist kodu hiç çalışmıyordu | `redis>=4.6.0` eklendi |

#### 🔴 KRİTİK — Web Panel Auth Tutarsızlıkları

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| W1 | `services/authService.js` | `loginUser` her zaman `localStorage.setItem` yapıyordu | `localStorage` yazımı kaldırıldı; depolama `AuthContext.login`'de `rememberMe`'ye göre yönetiliyor |
| W2 | `context/AuthContext.jsx` | `getMe()` başarısında her zaman `localStorage` yazıyordu | Hangi storage kullanıldığına bakılarak doğru storage'a yazıldı |
| W3 | `pages/SettingsPage.jsx` | Profil yalnızca `localStorage`'dan okunuyordu | `localStorage \|\| sessionStorage` ile her iki storage desteklendi |
| W4 | `authService.js` + `apiClient.js` | Logout ve 401 handler yalnızca `localStorage` temizliyordu | Her ikisi de `sessionStorage.removeItem('user')` çağrıları eklendi |

#### 🔴 KRİTİK — Web Panel Runtime Crash & Kırık Özellikler

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| W5 | `shared/components/layout/Sidebar.jsx` | `user.name.split(' ')` — name null ise uygulama çöküyordu | Null check + `user.email?.[0]` fallback eklendi |
| W6 | `pages/StudentDashboardPage.jsx` | Disputes sekmesi boş course `<select>` ile açılıyordu | `Promise.allSettled` ile disputes ve courses paralel yükleniyor |
| W7 | `pages/RecordsPage.jsx` | Export URL hardcoded `/api/v1/...` idi | `getApiBaseUrl()` ile dinamik URL kullanıldı |

#### 🔴 KRİTİK — Mobil Kritik Fonksiyon Hataları

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| M1 | `app/(tabs)/home.js` | `recentActivity` state'e dizi atanıyordu; bileşen tek obje bekliyordu | İlk aktivite objesi `STATUS_TR` map ile dönüştürülüp atandı |
| M2 | `app/(tabs)/history.js` | Admin rolü öğrenci UI'ına düşüyordu | `instructor \|\| admin` kontrolüne güncellendi |
| M3 | `app/_layout.js` | Stack ekranları guest'lere deep-link ile erişilebilirdi | `AuthGuard`'a kimlik doğrulanmamış kullanıcı yönlendirmesi eklendi |
| M4 | `app/gps-verify.js` | Başarı sonrası her zaman öğrenci sayfasına yönlendiriyordu | Rol bazlı navigasyon: instructor/admin → dashboard, öğrenci → home |
| M5 | `src/services/studentService.js` | Var olmayan endpoint'ler çağrılıyordu (`/api/students`, `/api/register`) | Doğru `/api/v1/users` path'lerine güncellendi |

---

#### 🟠 ÖNEMLİ — Backend Güvenlik

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| B14 | `api/auth.py` | Logout yalnızca access token'ı iptal ediyordu | Refresh token da JWT decode edilerek iptal edildi |
| B15 | `api/auth.py` | Password reset token hata durumunda plain-text log'a yazılıyordu | `DEBUG` modda debug level, production'da token içermeyen warning log |
| B16 | `security/rate_limit.py` | `X-Forwarded-For` koşulsuz güveniliyordu (IP spoofing riski) | `TRUST_PROXY_HEADERS=true` env değişkeni olmadan direkt client IP kullanılıyor |
| B17 | `security/crypto.py` | Kısa `ENCRYPTION_KEY` `b"0"` ile pad ediliyordu (düşük entropi) | Minimum 32 byte kontrolü eklendi; padding kaldırıldı |
| B18 | Tüm API'ler | Şifre politikası yoktu | `_validate_password_strength` validator'ı `UserCreate`, `ChangePasswordRequest`, `ResetPasswordRequest`'e eklendi (min 8 karakter, 1 rakam, 1 büyük harf) |

#### 🟠 ÖNEMLİ — Backend Eksik Davranışlar

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| B19 | `services/attendance_service.py` | `web_attend` yalnızca `DEFAULT_GEOFENCE_RADIUS_M` kullanıyordu | `session.geofence_radius` öncelikli, yoksa settings default'una fallback |
| B20 | `api/auth.py` | Login rate limit hardcoded `"10/minute"` | `settings.LOGIN_RATE_LIMIT` kullanılıyor |
| B21 | `services/notification_service.py` | Ders hatırlatıcıları `strftime("%A")` → İngilizce gün adıyla eşleşmiyordu | Hem İngilizce hem Türkçe gün adı kontrolü eklendi |
| B22 | `core/startup.py` | `create_all_tables()` production'da Alembic ile çakışıyordu | SQLite dev modunda çalışır; PostgreSQL'de Alembic'e bırakılır |

#### 🟠 ÖNEMLİ — DB & Altyapı

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| D1 | Tüm modeller | FK'larda `ondelete` direktifi yoktu | Tüm FK'lara uygun `CASCADE`, `RESTRICT` veya `SET NULL` direktifleri eklendi |
| D2 | `models/room.py` | `created_at` timezone-naive'di | `DateTime(timezone=True)` ile UTC-aware yapıldı |
| D3 | `alembic/env.py` | `course_instructor` modülü import edilmemişti | Import eklendi; `alembic --autogenerate` artık bu tabloyu görüyor |
| D4 | `docker-compose.yml` | PostgreSQL servisi, volume ve healthcheck yoktu | `postgres:16-alpine` servisi, kalıcı volume ve `pg_isready` healthcheck eklendi |
| D5 | `models/user.py` | `student_number` unique constraint yoktu | `unique=True, index=True` eklendi |

#### 🟠 ÖNEMLİ — Web Panel i18n Hataları

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| W8 | `hooks/useAttendance.js` | Yanlış i18n key: `attendance.flaggedLoadError` | `studentDashboard.attendance.flaggedLoadError` olarak düzeltildi |
| W9 | `pages/ExcusesPage.jsx` | `excuses.bulkApproved/bulkRejected` JSON'da yoktu | `excuses.bulkApproveMsg/bulkRejectMsg` olarak düzeltildi |
| W10 | `pages/ExcusesPage.jsx` | `excuses.statusPending` / `excuses.status${X}` yoktu | `excuses.statuses.*` nested path'e güncellendi |
| W11 | `components/ExcuseDetailsModal.jsx` | `common.processing` JSON'da tanımlı değildi | Her iki dil dosyasına `"processing"` key'i eklendi |
| W12 | `pages/AttendancePage.jsx` | `attendancePage.recordDetail.*` key'leri JSON'da hiç yoktu | `title`, `student`, `course`, `date`, `status`, `flagReason`, `method`, `location` key'leri eklendi |
| W13 | `components/LoginForm.jsx` | Şifremi Unuttum/Sıfırla akışı tamamı hardcoded Türkçe'ydi | Tüm metinler `t()` çağrılarına alındı; EN/TR JSON'larına eklendi |

#### 🟠 ÖNEMLİ — Mobil Sorunlar

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| M6 | `src/services/notificationService.js` | `savePushToken` response shape kontrolü yanlıştı | Mevcut kontrol `response?.success` doğruydu; kod incelendi, ek düzeltme gerekmedi |
| M7 | `src/services/notificationService.js` | `loadNotificationPreferences()` uygulama başlangıcında çağrılmıyordu | `_layout.js`'de `NotificationManager` içine login sırasında çağrı eklendi |
| M8 | `app/qr-scan.js` + `app/login-face-verify.js` | Navigasyon `setTimeout`'ları unmount cleanup'sız memory leak yapıyordu | `navTimerRef` ile `useEffect` cleanup eklendi |
| M9 | `app/face-scan.js`, `gps-verify.js`, `excuse-submit.js` | `useLocalSearchParams()` dizi döndürebilir; `parseInt(array)` → NaN | `Array.isArray` kontrolü ile ilk eleman alındı |
| M10 | `src/screens/InstructorHome.js` | `sessions.start(course.id)` `room_id` olmadan çağrılıyordu | `course.room_id` varsa options'a ekleniyor; yoksa kullanıcı uyarılıyor |

---

#### 🟡 NORMAL — Kalite & Tutarlılık

##### Backend

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| B23 | `api/excuses.py` | `bulk_review` loop içinde per-satır commit yapıyordu | Döngüde yalnızca attribute set; tek `db.commit()` ile atomik transaction |
| B24 | `database/connection.py` | SSL mode `require` hardcoded | `DB_SSL_MODE` env değişkeninden okunuyor; Docker Compose'a `DB_SSL_MODE=disable` eklendi |
| B25 | `api/dashboard.py` | Duplicate `/audit-logs` endpoint farklı filtreleme ile çakışıyordu | Dashboard'daki duplicate kaldırıldı; yalnızca `/api/v1/audit-logs/` kullanılıyor |
| B26 | `services/scheduler.py` | `_open_scheduled_sessions` race condition için `IntegrityError` yakalanmıyordu | `try/except IntegrityError` ile tekrarlayan oturum oluşturma sessizce atlanıyor |

##### Web Panel

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| W14 | `features/dashboard/components/DashboardView.js` | `err?.response?.data?.detail` fetch API'sinde dead code | `err?.message` kullanımına güncellendi |
| W15 | `pages/RecordsPage.jsx` | Aynı axios-shaped hata pattern | `err?.message` kullanımına güncellendi |
| W16 | `DashboardView.js` | Başlık hardcoded "Dashboard"; tarih `tr-TR` locale zorlaması | `t('dashboard.title')` ve `undefined` locale (tarayıcı tercihine bırakıldı) |
| W17 | `pages/AttendancePage.jsx` | `useAttendance` error state hiç gösterilmiyordu | `attendanceError` kırmızı banner olarak render ediliyor |
| W18 | `pages/AdminDashboardPage.jsx` | `Promise.allSettled` hataları sessizce yutuluyordu | `fetchError` state'i eklendi; her rejected promise kullanıcıya gösteriliyor |
| W19 | `shared/components/ui/Table/Table.jsx` + `Badge/Badge.jsx` | Accessibility: `scope`, `role`, `aria-label` eksikti | `scope="col"`, `role="row/cell/status"`, `aria-label`, klavye navigasyonu eklendi |
| W20 | `features/auth/services/authService.js` | `refreshToken` kullanılmıyordu; `apiClient.js`'de paralel implementasyon vardı | Fonksiyon backward-compat için korundu, açıklama eklendi |

##### Mobil

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| M11 | `app/(tabs)/home.js` | Fetch hataları `console.error`'da kalıyordu; ekranda gösterilmiyordu | `loadError` state + kırmızı banner bileşeni eklendi |
| M12 | `app/(tabs)/home.js` | `hasNotification` prop `Header`'a geçilmiyordu | `/notifications/count` API çağrısı eklendi; okunmamış bildirim varsa ikon aktif |
| M13 | `app/settings.js` | Reset butonu `updateNotificationPreferences()` çağırmıyordu | Reset onPress'e `updateNotificationPreferences(DEFAULT_SETTINGS)` eklendi |
| M14 | `app/(tabs)/more.js` | "Yüz Kaydı" menüsü tüm roller için gösteriliyordu | `adminOnly: true` flag'i eklendi; yalnızca admin görüyor |
| M15 | `app/course-detail.js` | `StyleSheet`'te `sumRow` duplicate key — ilk tanım siliniyordu | İkinci tanım `stuSumRow` olarak yeniden adlandırıldı |
| M16 | `mobile-app/.env` | Supabase anahtarı — `.gitignore` kontrolü | `.gitignore`'da zaten vardı; `git ls-files` ile doğrulandı (tracked değil) |
| M17 | `app/course-detail.js` | `page_size=1000` → 422; genel yoklama özeti sonsuz istek döngüsü | 200'lük sayfalama + `summaryStatus` guard |
| M18 | `app/(tabs)/history.js` | `t` değişkeni i18n `t()` ile gölgeleme → `TypeError` | `courseTime` olarak yeniden adlandırıldı |
| M19 | `app/(tabs)/attendance.js` | `flag_reason` çevrilmeden gösteriliyordu | `useFlagReasonLabel` + TR/EN `attendance.flagReasons` |
| M20 | `dashboard.js`, `InstructorHome.js` | Bildirim rozeti eksik/yanlış kaynak | `useNotificationBadge` hook |
| M21 | `app/_layout.js` | Expo Go'da push yokken şüpheli kayıt listesi güncellenmiyordu | `REFRESH_FLAGGED` event + poll yedeklemesi |

#### v4.2.1 — Web Panel (Öğrenci Filtresi)

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| W21 | `useStudents.js`, `StudentsPage.jsx` | Öğretmen tüm öğrencileri görüyordu; derse göre filtre yoktu | Ders dropdown + `GET /courses/{id}/students` |

##### DB / Test / CI

| # | Dosya | Sorun | Düzeltme |
|---|---|---|---|
| D6 | `backend/tests/` | Rooms, disputes, notifications, admin settings test dosyaları yoktu | `test_rooms.py`, `test_disputes.py`, `test_notifications.py`, `test_admin_settings.py` oluşturuldu |
| D7 | `tests/conftest.py` | `CourseInstructor`, `Notification`, `SystemSetting` import edilmiyordu | Üç model import'u eklendi; tablo oluşturma order-safe |
| D8 | `.github/workflows/ci.yml` | Mobil lint, Alembic check, SAST, secret scan, coverage threshold yoktu | 5 job'a genişletildi: `backend-test` (coverage ≥%60 + alembic check), `backend-sast` (Bandit), `secret-scan` (Gitleaks), `web-build` (ESLint), `mobile-lint` |
| D9 | `README.md` | "docker-compose tüm servisleri kaldırır" yazıyordu, sadece API vardı | "API + PostgreSQL servislerini ayağa kaldırır" olarak düzeltildi |
| D10 | `README.md` | `course_instructor.py` ve `test_new_features.py` listelerde eksikti | Her iki dosya ilgili bölümlere eklendi |

---
