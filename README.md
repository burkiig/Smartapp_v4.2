# Smart Attendance System

Yüz tanıma, QR kod ve GPS doğrulama kullanan üç aşamalı akıllı yoklama sistemi.

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
SmartApp/
├── backend/                    # FastAPI backend
│   ├── main.py                 # Uygulama giriş noktası
│   ├── requirements.txt        # Python bağımlılıkları
│   ├── .env                    # Ortam değişkenleri (git'e ekleme)
│   ├── .env.example            # Örnek .env şablonu
│   └── app/
│       ├── api/                # HTTP route'ları (9 modül)
│       │   ├── auth.py
│       │   ├── users.py
│       │   ├── courses.py
│       │   ├── rooms.py
│       │   ├── sessions.py
│       │   ├── attendance.py
│       │   ├── face.py
│       │   ├── excuses.py
│       │   └── dashboard.py
│       ├── config/
│       │   └── settings.py     # Merkezi konfigürasyon
│       ├── core/
│       │   └── startup.py      # DB başlatma, admin seed
│       ├── database/
│       │   └── connection.py   # SQLAlchemy engine, session, Base
│       ├── integrations/
│       │   └── face_engine.py  # InsightFace yüz tanıma motoru
│       ├── models/             # SQLAlchemy ORM modelleri
│       │   ├── user.py
│       │   ├── course.py
│       │   ├── room.py
│       │   ├── session.py
│       │   ├── attendance.py
│       │   ├── face_reference.py
│       │   └── excuse.py
│       ├── repositories/       # Veritabanı CRUD katmanı
│       │   ├── user_repo.py
│       │   ├── course_repo.py
│       │   ├── room_repo.py
│       │   ├── session_repo.py
│       │   ├── attendance_repo.py
│       │   ├── face_repo.py
│       │   └── excuse_repo.py
│       ├── schemas/            # Pydantic doğrulama şemaları
│       │   ├── user.py
│       │   ├── course.py
│       │   ├── room.py
│       │   ├── session.py
│       │   ├── attendance.py
│       │   └── excuse.py
│       ├── security/
│       │   ├── jwt.py          # Token oluşturma (access + refresh)
│       │   ├── password.py     # bcrypt hash/verify
│       │   └── dependencies.py # FastAPI bağımlılıkları (get_current_user vb.)
│       ├── services/           # İş mantığı katmanı
│       │   ├── auth_service.py
│       │   ├── session_service.py
│       │   ├── attendance_service.py  # 3 aşamalı yoklama pipeline
│       │   ├── face_service.py
│       │   └── scheduler.py    # APScheduler: otomatik oturum kapatma
│       └── utils/
│           ├── qr.py           # QR token üretme ve base64 görsel
│           ├── location.py     # Haversine mesafe, geofence doğrulama
│           └── push.py         # Expo push notification gönderimi
│
├── web-panel/                  # React admin/öğretmen paneli
│   ├── package.json
│   ├── public/
│   │   ├── index.html
│   │   ├── manifest.json
│   │   └── robots.txt
│   └── src/
│       ├── setupProxy.js       # CRA proxy: /api → localhost:8000
│       ├── App.js
│       ├── features/
│       │   ├── auth/           # Giriş, JWT context
│       │   ├── attendance/     # Yoklama kayıtları, mazeretler
│       │   ├── dashboard/      # Admin/öğretmen/öğrenci dashboard
│       │   ├── schedule/       # Haftalık ders programı
│       │   ├── settings/       # Ayarlar sayfası
│       │   └── students/       # Öğrenci kayıt formu
│       ├── pages/              # LoginPage
│       └── shared/
│           ├── services/
│           │   └── apiClient.js  # Axios, JWT refresh interceptor
│           ├── config/env.js
│           ├── hooks/useCamera.js
│           ├── styles/tokens.js
│           └── components/     # Layout, UI bileşenleri
│
└── mobile-app/                 # React Native Expo mobil uygulama
    ├── package.json
    ├── app.config.js
    ├── babel.config.js
    ├── tailwind.config.js
    └── app/
        ├── _layout.js          # Expo Router kök layout
        ├── index.js            # Giriş / yönlendirme
        ├── qr-scan.js          # ADIM 1: QR tarama
        ├── face-scan.js        # ADIM 2: Yüz doğrulama
        ├── gps-verify.js       # ADIM 3: Konum doğrulama
        ├── register-face.js    # İlk yüz kaydı
        ├── (tabs)/             # Ana sekme navigasyonu
        │   ├── home.js         # Ana ekran
        │   ├── attendance.js
        │   ├── history.js
        │   ├── schedule.js
        │   ├── profile.js
        │   └── ...
        ├── screens/            # Öğretmen ekranları
        │   ├── InstructorHome.js
        │   ├── InstructorHistory.js
        │   └── InstructorProfile.js
        └── shared/
            ├── services/
            │   ├── api.js           # Tüm API endpoint çağrıları
            │   ├── authService.js   # Giriş, token saklama
            │   ├── attendanceService.js
            │   └── ...
            ├── utils/apiAdapter.js  # SecureStore token yönetimi
            └── config/env.js
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
      ├─ Security: JWT decode → get_current_user
      ├─ Router → Service → Repository
      ├─ SQLAlchemy ORM
      ▼
SQLite (dev) / PostgreSQL (prod)
```

---

## Kurulum

### 1. Backend

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
API dokümantasyonu: `http://localhost:8000/docs`

### 2. Web Panel

```bash
cd web-panel
npm install
npm start
```

Panel `http://localhost:3000` adresinde açılır.

### 3. Mobile App

```bash
cd mobile-app
npm install --legacy-peer-deps
npx expo start
```

Expo Go uygulaması veya emülatör ile `http://localhost:8081` üzerinden bağlan.

---

## Ortam Değişkenleri (`backend/.env`)

| Değişken | Varsayılan | Açıklama |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./smart_attendance.db` | SQLite veya PostgreSQL bağlantı URL'i |
| `SECRET_KEY` | `change-this-...` | JWT imzalama anahtarı — **production'da değiştir!** |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Access token geçerlilik süresi |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Refresh token geçerlilik süresi |
| `CORS_ORIGINS` | `localhost:3000,5173,8081` | İzin verilen frontend origin'leri |
| `ADMIN_EMAIL` | `admin@attendance.com` | İlk admin e-postası |
| `ADMIN_USERNAME` | `admin` | İlk admin kullanıcı adı |
| `ADMIN_PASSWORD` | `admin123` | İlk admin şifresi — **değiştir!** |
| `FACE_SIMILARITY_THRESHOLD` | `0.4` | Yüz eşleşme eşiği (0–1, düşük = daha katı) |
| `DEFAULT_GEOFENCE_RADIUS_M` | `50` | Sınıf yarıçapı (metre) |
| `HOST` | `0.0.0.0` | Sunucu host adresi |
| `PORT` | `8000` | Sunucu portu |

---

## API Endpoint'leri

Tüm endpoint'ler `/api/v1` prefix'i ile başlar.

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
| POST | `/scan-qr` | **ADIM 1** QR tara | Öğrenci |
| POST | `/verify-face` | **ADIM 2** Yüz doğrula | Öğrenci |
| POST | `/verify-location` | **ADIM 3** Konum doğrula | Öğrenci |
| GET | `/my-history` | Öğrencinin kendi geçmişi | Öğrenci |
| GET | `/records` | Tüm kayıtlar | Öğretmen/Admin |
| GET | `/session/{id}` | Oturum yoklama listesi | Öğretmen/Admin |
| GET | `/flagged` | İşaretli kayıtlar | Öğretmen/Admin |
| POST | `/manual` | Manuel yoklama | Öğretmen/Admin |

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

### Dashboard (`/api/v1/dashboard`)

| Method | Path | Açıklama | Yetki |
|---|---|---|---|
| GET | `/stats` | Genel istatistikler | Admin |
| GET | `/instructor` | Öğretmen dashboard verisi | Öğretmen |
| GET | `/student` | Öğrenci dashboard verisi | Öğrenci |

---

## Roller ve Yetkiler

| Rol | Türkçe | Yapabilecekleri |
|---|---|---|
| `admin` | Yönetici | Tüm işlemler: kullanıcı yönetimi, ders yönetimi, tüm raporlar |
| `instructor` | Öğretmen | Oturum başlat/bitir, QR üret, yoklama gör, mazeret incele |
| `student` | Öğrenci | Yoklamaya katıl (3 adım), kendi geçmişini gör, mazeret gönder |

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
face_references                 → Yüz embedding vektörleri (base64)
excuses                         → Mazeretler
```

---

## Yüz Tanıma

Sistem **InsightFace `buffalo_l`** modelini kullanır.

- **Embedding çıkarma:** Her yüz için 512 boyutlu vektör üretilir
- **Benzerlik:** Cosine similarity ile karşılaştırma yapılır
- **Eşik:** `FACE_SIMILARITY_THRESHOLD = 0.4` (varsayılan)
- **Canlılık:** Pasif — iki ayrı kare arasındaki embedding farkına bakılır
- **Fallback:** insightface kurulu değilse sistem çalışmaya devam eder, yüz adımı otomatik geçer

```bash
# Yüz tanıma için ek kurulum
pip install insightface onnxruntime opencv-python numpy
```

---

## Scheduler (Otomatik Oturum Kapatma)

APScheduler ile her 5 dakikada bir aktif oturumlar kontrol edilir. Bitiş saati geçmiş oturumlar otomatik olarak `completed` durumuna alınır.

---

## Push Bildirimleri

Expo Push API kullanılır. Öğretmen ders iptal ettiğinde, derse kayıtlı öğrencilere otomatik bildirim gönderilir. Öğrencilerin push token'larını kaydetmesi için mobil uygulamadan `/api/v1/auth/push-token` endpoint'i çağrılmalıdır.

---

## Production'a Geçiş

1. `SECRET_KEY` değerini uzun ve rastgele bir string ile değiştir
2. `DATABASE_URL` değerini PostgreSQL bağlantı dizisiyle güncelle
3. `ADMIN_PASSWORD` değerini güçlü bir şifreyle değiştir
4. `DEBUG=false` yap
5. Web panel için `npm run build` ile production build al
6. Backend'i `gunicorn` ile başlat:

```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## Geliştirme Notları

### Önemli Değişiklikler (Entegrasyon)

Bu proje, eski Flask tabanlı monolitik `app.py` sisteminin yerine geçen tam yeniden yazımdır.

| Eski Sistem | Yeni Sistem |
|---|---|
| Flask (monolitik `app.py`, 73KB) | FastAPI (modüler yapı, router/service/repo katmanları) |
| JSON dosya tabanlı veri saklama | SQLAlchemy ORM (SQLite/PostgreSQL) |
| Mock/sahte data | Gerçek veritabanı kayıtları |
| username bazlı JWT | E-posta veya kullanıcı adı ile JWT |
| passlib (uyumsuz) | Doğrudan bcrypt kullanımı |
| Tek aşamalı yoklama | 3 aşamalı pipeline (QR + Yüz + GPS) |
| Push bildirim yok | Expo Push API entegrasyonu |
| Scheduler yok | APScheduler (otomatik oturum kapatma) |

### Web Panel Proxy Yapılandırması

`web-panel/src/setupProxy.js` dosyası, CRA dev sunucusunun yalnızca `/api` ile başlayan istekleri `http://localhost:8000`'e yönlendirmesini sağlar. Statik dosyalar, `/@vite`, `/@react-refresh` gibi CRA iç istekleri proxy'den geçmez.

### Mobile Uygulama Token Yönetimi

`expo-secure-store` kullanılarak access token ve refresh token güvenli şekilde cihazda saklanır. Token süresi dolduğunda `apiAdapter.js` içindeki interceptor otomatik olarak `/api/v1/auth/refresh` çağırır.
