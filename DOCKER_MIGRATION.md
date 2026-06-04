# Docker + Kendi Sunucuya Geçiş Rehberi

Supabase bağımlılığını tamamen kaldırıp her şeyi kendi Linux makinenizde çalıştırmak için adım adım kılavuz.

---

## Genel Mimari (Sonunda Ne Olacak)

```
Linux Sunucu (Ubuntu)
├── Docker Container: PostgreSQL  ← Veritabanı (Supabase yerine)
├── Docker Container: FastAPI API ← Backend
└── Docker Container: Web Panel  ← React (Nginx ile)

Tailscale VPN
├── Linux Sunucu  → 100.64.x.x (sabit IP)
├── Telefonlar    → Tailscale uygulaması ile bağlanır
└── Bilgisayarlar → Tailscale uygulaması ile bağlanır
```

---

## BÖLÜM 1 — Linux Sunucu Hazırlığı

### 1.1 Ubuntu'yu Güncelle

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Docker Kur

```bash
# Docker Engine
curl -fsSL https://get.docker.com | sh

# Mevcut kullanıcıyı docker grubuna ekle (sudo olmadan kullanmak için)
sudo usermod -aG docker $USER

# Oturumu yenile
newgrp docker

# Kontrol
docker --version
docker compose version
```

### 1.3 Git Kur (opsiyonel ama önerilir)

```bash
sudo apt install -y git
```

---

## BÖLÜM 2 — Tailscale Kurulumu (Dışarıdan Erişim)

### 2.1 Linux Sunucuya Tailscale Kur

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Terminalde bir link çıkacak → tarayıcıda açın → Google/GitHub hesabınızla giriş yapın.

### 2.2 Sunucunuzun Tailscale IP'sini Öğrenin

```bash
tailscale ip -4
```

Çıktı örneği: `100.64.12.34` — bu IP'yi bir yere not edin, her yerde kullanacaksınız.

### 2.3 Sunucuyu Kalıcı Açık Tut

```bash
# Sunucu yeniden başlayınca Tailscale otomatik başlasın
sudo systemctl enable tailscaled
```

### 2.4 Diğer Cihazlara Tailscale Kur

- **Android/iOS:** App Store / Play Store → "Tailscale" → aynı hesapla giriş
- **Windows:** https://tailscale.com/download → exe indir → kur → giriş yap

> Aynı Tailscale hesabına bağlı her cihaz sunucuya `100.64.12.34:8000` ile ulaşabilir.

---

## BÖLÜM 3 — Proje Dosyalarını Sunucuya Al

### Seçenek A — USB ile kopyala

```bash
# USB takılı varsayarsak /media/usb yolunda
cp -r /media/usb/Smartapp_v4.2 ~/Smartapp_v4.2
```

### Seçenek B — Windows'tan SCP ile gönder (PowerShell'den)

```powershell
scp -r "C:\Users\deste\Desktop\Smartapp_v4.2" kullanici@LINUX_IP:~/
```

### Seçenek C — Git reposu varsa

```bash
git clone https://github.com/KULLANICI/Smartapp_v4.2.git ~/Smartapp_v4.2
```

---

## BÖLÜM 4 — Konfigürasyon Dosyalarını Güncelle

### 4.1 Backend `.env` — Supabase'i Tamamen Kaldır

`~/Smartapp_v4.2/backend/.env` dosyasını aşağıdaki içerikle **tamamen değiştirin**:

```env
HOST=0.0.0.0
PORT=8000
DEBUG=false
ENV=production
TESTING=false

# Yerel PostgreSQL — Supabase YOK
DATABASE_URL=postgresql://postgres:postgres@db:5432/smart_attendance

# Güvenlik — değiştirin!
SECRET_KEY=BURAYA_EN_AZ_64_KARAKTER_RASTGELE_YAZI_YAZIN
ENCRYPTION_KEY=BURAYA_64_HEX_KARAKTER_YAZIN
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30

# CORS — Tailscale IP'nizi yazın (100.64.x.x)
CORS_ORIGINS=http://localhost:3000,http://100.64.12.34:3000,http://100.64.12.34:80

# Admin hesabı
ADMIN_EMAIL=admin@smartattendance.local
ADMIN_USERNAME=admin
ADMIN_PASSWORD=GucluBirSifre2026!
ADMIN_NAME=System Administrator

# Yüz tanıma kalibrasyonu
FACE_SIMILARITY_THRESHOLD=0.42
FACE_LIVENESS_THRESHOLD=0.15

# GPS kalibrasyonu
DEFAULT_GEOFENCE_RADIUS_M=100
MAX_GPS_ACCURACY_M=40.0
GPS_ACCURACY_THRESHOLD=40.0

# QR
QR_TOKEN_TTL_SECONDS=90
LOGIN_RATE_LIMIT=10/minute

# Cookie
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=
```

> **SECRET_KEY üretmek için:**
> ```bash
> python3 -c "import secrets; print(secrets.token_hex(64))"
> ```
>
> **ENCRYPTION_KEY üretmek için:**
> ```bash
> python3 -c "import secrets; print(secrets.token_hex(32))"
> ```

### 4.2 `docker-compose.yml` — Web Panel'i de Ekle

`~/Smartapp_v4.2/docker-compose.yml` dosyasını aşağıdaki içerikle **tamamen değiştirin**
(TAILSCALE_IP kısmını kendi IP'nizle değiştirin):

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: smart_attendance
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    env_file:
      - ./backend/.env
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/smart_attendance
      - DB_SSL_MODE=disable
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: ./web-panel
      dockerfile: Dockerfile
      args:
        - REACT_APP_API_URL=http://100.64.12.34:8000   # ← Tailscale IP
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped

volumes:
  postgres_data:
```

### 4.3 Mobil Uygulama `.env`

`Smartapp_v4.2/mobile-app/.env` dosyasını güncelleyin:

```env
EXPO_PUBLIC_API_URL=http://100.64.12.34:8000
```

> Mobil uygulama her build'de yeniden derlenmelidir — aşağıda açıklandı.

---

## BÖLÜM 5 — Sunucuyu Başlat

```bash
cd ~/Smartapp_v4.2

# İlk kez build et ve başlat
docker compose up -d --build
```

İlk build **10-20 dakika** sürebilir (insightface, onnxruntime büyük paketler).

### Kontrol

```bash
# Tüm container'lar çalışıyor mu?
docker compose ps

# Beklenen çıktı:
# NAME    STATUS
# db      running (healthy)
# api     running
# web     running

# API loglarını izle
docker compose logs -f api

# Logda şunu görmelisiniz:
# [entrypoint] Running Alembic migrations...
# [entrypoint] Starting Gunicorn...
# Default admin created: admin
```

### Test

```bash
# API sağlık kontrolü
curl http://localhost:8000/health

# Web panel
# Tarayıcıda: http://100.64.12.34:80
```

---

## BÖLÜM 6 — Mobil Uygulamayı Güncelle ve Derle

Mobil uygulama `.env` değiştiğinde **yeniden build** gerekir.

### Windows'ta (geliştirme bilgisayarı):

```powershell
cd C:\Users\deste\Desktop\Smartapp_v4.2\mobile-app

# .env güncellendiğinden emin olun
# EXPO_PUBLIC_API_URL=http://100.64.12.34:8000

npm install
npx expo start --clear
```

Telefondan Expo Go ile QR okutun — sunucuya bağlanır.

### APK derlemek istiyorsanız (EAS Build):

```powershell
npm install -g eas-cli
eas build --platform android --profile preview
```

---

## BÖLÜM 7 — Günlük Kullanım

### Sunucuyu Başlat/Durdur

```bash
# Başlat
docker compose up -d

# Durdur
docker compose down

# Yeniden başlat
docker compose restart api
```

### Logları İzle

```bash
# Tüm servisler
docker compose logs -f

# Sadece API
docker compose logs -f api

# Son 100 satır
docker compose logs --tail=100 api
```

### Kod Güncellemesi Sonrası

```bash
cd ~/Smartapp_v4.2
git pull  # veya dosyaları kopyalayın

# Rebuild
docker compose up -d --build api
```

---

## BÖLÜM 8 — Veritabanı Yönetimi

### Yedeği Al

```bash
docker compose exec db pg_dump -U postgres smart_attendance > yedek_$(date +%Y%m%d).sql
```

### Yedeği Geri Yükle

```bash
docker compose exec -T db psql -U postgres smart_attendance < yedek_20260603.sql
```

### Veritabanına Bağlan (psql)

```bash
docker compose exec db psql -U postgres smart_attendance
```

### Migration Çalıştır (güncelleme sonrası)

```bash
docker compose exec api alembic upgrade head
```

---

## BÖLÜM 9 — Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| `docker compose up` → "port 8000 already in use" | `sudo lsof -i :8000` → `sudo kill -9 PID` |
| API container başlamıyor | `docker compose logs api` ile hatayı görün |
| Tailscale IP'ye erişilemiyor | `tailscale status` → bağlı cihazları kontrol edin |
| Alembic migration hatası | `docker compose exec api alembic upgrade head` |
| Yüz tanıma çalışmıyor | `docker compose logs api | grep -i face` |

---

## BÖLÜM 10 — Güvenlik Notları

1. **Şifreleri değiştirin** — `.env`'deki `SECRET_KEY`, `ENCRYPTION_KEY`, `ADMIN_PASSWORD`
2. **DB şifresini değiştirin** — `docker-compose.yml`'de `POSTGRES_PASSWORD` ve `DATABASE_URL`'de eşleştirin
3. **Tailscale ücretsiz plan** — 100 cihaza kadar ücretsiz, trafik şifreli
4. **Yedek alın** — haftada bir `pg_dump` çalıştırın

---

## Özet Kontrol Listesi

- [ ] Ubuntu güncellendi
- [ ] Docker ve Docker Compose kuruldu
- [ ] Tailscale kuruldu, IP alındı (`tailscale ip -4`)
- [ ] Diğer cihazlara Tailscale kuruldu
- [ ] `backend/.env` güncellendi (Supabase kaldırıldı)
- [ ] `docker-compose.yml` güncellendi (Tailscale IP eklendi)
- [ ] `mobile-app/.env` güncellendi
- [ ] `docker compose up -d --build` çalıştırıldı
- [ ] `docker compose ps` → tüm servisler "running"
- [ ] `http://100.64.12.34:80` → web panel açılıyor
- [ ] Admin girişi çalışıyor
