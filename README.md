# Smart Attendance System

Yüz tanıma, QR kod ve GPS doğrulama kullanan üç aşamalı akıllı yoklama sistemi.

**API Sürümü:** v3.1.0 &nbsp;|&nbsp; **Backend:** FastAPI &nbsp;|&nbsp; **DB:** SQLite (dev) / PostgreSQL (prod) &nbsp;|&nbsp; **Storage:** Supabase (opsiyonel)

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

## Proje Yapısı

```
Smart_Attendance_System/
├── docker-compose.yml              # Tüm servisleri ayağa kaldırır
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
│   │       ├── b373651be828_initial_schema.py
│   │       ├── a1b2c3d4e5f6_new_features.py    # Bildirim, dispute, sistem ayarları
│   │       ├── d9e8f7a6b5c4_postgres_hardening.py
│   │       ├── f1e2d3c4b5a6_notifications_table.py
│   │       ├── c1d2e3f4a5b6_add_performance_indexes.py   # YENİ: sorgu indeksleri
│   │       └── d4e5f6a7b8c9_dispute_attendance_record_fk.py  # YENİ: dispute FK
│   │
│   ├── scripts/
│   │   └── encrypt_existing_embeddings.py      # Eski embedding'leri şifreler
│   │
│   ├── tests/                      # Pytest test suite
│   │   ├── conftest.py             # Fixture'lar, test DB kurulumu
│   │   ├── test_auth.py
│   │   ├── test_attendance.py
│   │   ├── test_courses.py
│   │   ├── test_dashboard.py
│   │   ├── test_face.py
│   │   ├── test_health.py
│   │   ├── test_rbac.py
│   │   ├── test_sessions.py
│   │   └── test_users.py
│   │
│   └── app/
│       ├── adapters/               # Storage soyutlama katmanı
│       │   ├── storage_adapter.py  # Abstract StorageAdapter arayüzü
│       │   └── supabase_storage.py # Supabase Storage implementasyonu
│       │
│       ├── api/                    # HTTP route'ları (13 modül)
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── courses.py
│       │   ├── rooms.py
│       │   ├── sessions.py
│       │   ├── attendance.py
│       │   ├── face.py
│       │   ├── excuses.py
│       │   ├── dashboard.py
│       │   ├── notifications.py    # YENİ: bildirim sistemi
│       │   ├── audit_logs.py       # YENİ: denetim kaydı (admin)
│       │   ├── disputes.py         # YENİ: yoklama itiraz sistemi
│       │   └── admin_settings.py   # YENİ: dinamik sistem ayarları
│       │
│       ├── config/
│       │   └── settings.py         # Pydantic Settings (tüm env değişkenleri)
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
│       │   ├── dependencies.py     # FastAPI bağımlılıkları (get_current_user vb.)
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
│       │   ├── audit_service.py        # YENİ: denetim kaydı loglama
│       │   └── scheduler.py            # APScheduler: otomatik oturum kapatma
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
│       ├── setupProxy.js           # CRA proxy: /api → localhost:8000
│       ├── features/
│       │   ├── auth/               # Giriş, JWT context
│       │   ├── attendance/         # Yoklama kayıtları, mazeretler
│       │   │   ├── components/
│       │   │   │   └── ExcuseDetailsModal/  # YENİ: mazeret detay modalı
│       │   │   └── services/
│       │   │       └── excuseService.js     # YENİ: mazeret API servisi
│       │   ├── dashboard/          # Admin/öğretmen/öğrenci dashboard
│       │   ├── schedule/           # Haftalık ders programı
│       │   ├── settings/           # Ayarlar sayfası
│       │   └── students/           # Öğrenci kayıt formu
│       ├── pages/
│       └── shared/
│           ├── services/
│           │   └── apiClient.js    # Axios, JWT refresh interceptor
│           └── components/
│               └── NotificationBell/   # YENİ: bildirim zili bileşeni
│
└── mobile-app/                     # React Native Expo mobil uygulama
    ├── package.json
    ├── app.config.js
    ├── babel.config.js
    ├── tailwind.config.js
    └── app/
        ├── _layout.js              # Expo Router kök layout
        ├── index.js                # Giriş / yönlendirme
        ├── qr-scan.js              # ADIM 1: QR tarama
        ├── face-scan.js            # ADIM 2: Yüz doğrulama
        ├── gps-verify.js           # ADIM 3: Konum doğrulama
        ├── register-face.js        # İlk yüz kaydı
        ├── cancel-class.js         # YENİ: ders iptali
        ├── excuse-submit.js        # YENİ: mazeret gönderme ekranı
        ├── class-details.js        # YENİ: ders detayları
        ├── settings.js             # YENİ: uygulama ayarları
        ├── (tabs)/                 # Ana sekme navigasyonu
        │   ├── home.js
        │   ├── attendance.js
        │   ├── history.js
        │   ├── schedule.js
        │   ├── profile.js
        │   ├── dashboard.js        # YENİ
        │   ├── reports.js          # YENİ
        │   └── more.js             # YENİ
        ├── components/
        │   └── ExcuseModal.js      # YENİ: mazeret modal bileşeni
        ├── _screens/               # Öğretmen ekranları
        │   ├── InstructorHome.js
        │   ├── InstructorHistory.js
        │   └── InstructorProfile.js
        └── shared/
            ├── services/
            │   ├── api.js
            │   ├── authService.js
            │   ├── attendanceService.js
            │   └── notificationService.js  # YENİ: bildirim servisi
            └── utils/apiAdapter.js         # SecureStore token yönetimi
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
Mobile / Web Panel
      │
      │  HTTP + Bearer Token (JWT)
      ▼
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

# Başlat
python -m uvicorn main:app --reload
```

Backend `http://localhost:8000` adresinde çalışır.
API dokümantasyonu: `http://localhost:8000/docs` *(yalnızca DEBUG=true)*

#### 2. Web Panel

```bash
cd web-panel
npm install
npm start
```

Panel `http://localhost:3000` adresinde açılır.

#### 3. Mobile App

```bash
cd mobile-app
npm install --legacy-peer-deps
npx expo start
```

Expo Go uygulaması veya emülatör ile bağlan.

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
| `ADMIN_EMAIL` | `admin@smartapp.local` | İlk admin e-postası |
| `ADMIN_USERNAME` | `admin` | İlk admin kullanıcı adı |
| `ADMIN_PASSWORD` | — | İlk admin şifresi — **güçlü bir şifre kullan!** |
| `SUPABASE_URL` | — | Supabase proje URL'i (opsiyonel) |
| `SUPABASE_ANON_KEY` | — | Supabase anon public key (opsiyonel) |
| `SUPABASE_SERVICE_KEY` | — | Supabase service role key (opsiyonel, backend only) |
| `FACE_SIMILARITY_THRESHOLD` | `0.4` | Yüz eşleşme eşiği (0–1, düşük = daha katı) |
| `FACE_LIVENESS_THRESHOLD` | `0.5` | Canlılık kontrolü eşiği |
| `DEFAULT_GEOFENCE_RADIUS_M` | `50` | Sınıf yarıçapı (metre) |
| `MAX_GPS_ACCURACY_M` | `30.0` | Maksimum GPS hata toleransı (metre) |
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
| POST | `/login` | E-posta veya kullanıcı adı ile giriş | Herkese açık |
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
| GET | `/stats` | Genel istatistikler | Admin |
| GET | `/instructor` | Öğretmen dashboard verisi | Öğretmen |
| GET | `/student` | Öğrenci dashboard verisi | Öğrenci |

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
| `admin` | Yönetici | Tüm işlemler, kullanıcı yönetimi, sistem ayarları, denetim kayıtları |
| `instructor` | Öğretmen | Oturum başlat/bitir, QR üret, yoklama gör, mazeret/itiraz incele |
| `student` | Öğrenci | Yoklamaya katıl (3 adım), kendi geçmişini gör, mazeret/itiraz gönder |

---

## Veritabanı Modeli

```
users                           → Tüm kullanıcılar (rol bazlı)
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
- **Eşik:** `FACE_SIMILARITY_THRESHOLD = 0.4` (varsayılan)
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

| Eski Sistem | Yeni Sistem (v3.1.0) |
|---|---|
| Flask (monolitik `app.py`, 73KB) | FastAPI (modüler router/service/repo katmanları) |
| JSON dosya tabanlı veri saklama | SQLAlchemy ORM (SQLite/PostgreSQL) + Alembic migration |
| Mock/sahte data | Gerçek veritabanı kayıtları |
| username bazlı JWT | E-posta veya kullanıcı adı ile JWT + Lazy TTL blacklist |
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

### Web Panel Proxy Yapılandırması

`web-panel/src/setupProxy.js` dosyası, yalnızca `/api` ile başlayan istekleri `http://localhost:8000`'e yönlendirir. Statik dosyalar proxy'den geçmez.

### Mobile Uygulama Token Yönetimi

`expo-secure-store` kullanılarak access token ve refresh token güvenli şekilde cihazda saklanır. Token süresi dolduğunda `apiAdapter.js` içindeki interceptor otomatik olarak `/api/v1/auth/refresh` çağırır.

### Supabase Entegrasyonu

Supabase tamamen opsiyoneldir. `SUPABASE_URL` ve `SUPABASE_ANON_KEY` tanımlı değilse sistem yerel modda çalışır ve storage kontrolleri atlanır. Tanımlıysa `/health/ready` endpoint'i Supabase storage erişilebilirliğini de kontrol eder.

---

## CI/CD (GitHub Actions)

Her `push` ve `pull_request`'te `.github/workflows/ci.yml` çalışır:

1. **Build** — Backend Docker image'ı GitHub Actions layer cache ile build edilir (`type=gha`). `requirements.txt` değişmediği sürece ağır ML paketleri (insightface, onnxruntime) yeniden indirilmez.
2. **Test** — Pre-built image üzerinde `docker run` ile pytest çalıştırılır. SQLite kullanılır, ayrı bir database servisi gerekmez.

```yaml
# Yerel CI simülasyonu:
docker build -t smart-attendance-backend:ci backend/
docker run --rm -e ENV=test -e TESTING=true \
  -e DATABASE_URL=sqlite:///./test.db \
  -e SECRET_KEY=test-key \
  smart-attendance-backend:ci python -m pytest -v
```

> **Önemli:** CI sırlarını (`SECRET_KEY`, `DATABASE_URL` vb.) GitHub repo'ya düz metin olarak ekleme. GitHub → Settings → Secrets and Variables → Actions bölümünden ekle.
