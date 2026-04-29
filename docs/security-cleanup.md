# Security Cleanup Runbook (.env History Purge)

Bu rehber, yanlislikla commit edilmis `.env` dosyalarini Git gecmisinden guvenli sekilde temizlemek icindir.

## 0) Baslamadan Once (Zorunlu)

1. **Merge freeze** uygulayin (cleanup tamamlanana kadar hedef branch'e merge yapmayin).
2. **Secret rotation** islemini cleanup beklemeden baslatin.
3. Lokal degisiklikleri yedekleyin:

```bash
git status
git stash push -u -m "pre-security-cleanup-backup"
```

> Not: History rewrite sonrasi `reset --hard` kullanmaniz gerekebilir. Stash almadan devam etmeyin.

## 1) Araç Kurulumu Kontrolu (`git-filter-repo`)

`git filter-repo` sisteminizde kurulu olmali:

```bash
git filter-repo --version
```

Komut bulunamazsa:

```bash
pip install git-filter-repo
```

Tekrar dogrulayin:

```bash
git filter-repo --version
```

## 2) Emniyet Yedegi Alin

Repo mirror yedegi alin:

```bash
git clone --mirror <repo-url> repo-backup.git
```

## 3) History Rewrite (Temiz Clone Uzerinde)

Temiz bir local clone uzerinde calisin:

```bash
git checkout main
git pull --ff-only
git filter-repo --path .env --path backend/.env --path mobile-app/.env --invert-paths
```

## 4) Temizligi Dogrulayin

`.env` commit gecmisinde artik gorunmemeli:

```bash
git log --all -- .env
git log --all -- backend/.env
git log --all -- mobile-app/.env
```

Bu komutlar bos donuyorsa temizlik basarili.

## 5) Remote Konfigurasyonu Kontrolu

History rewrite sonrasi remote ayari bozulmus olabilir:

```bash
git remote -v
```

`origin` eksikse geri ekleyin:

```bash
git remote add origin <repo-url>
git remote -v
```

## 6) Rewritten History Push (Koordine Pencere)

Lease-korumali force push kullanin:

```bash
git push origin --force-with-lease --all
git push origin --force-with-lease --tags
```

`--force-with-lease`, beklenmeyen remote degisiklikleri ezmeyi engeller.

## 7) Ekip Senkronu

### Secenek A (Onerilen): Temiz Clone

```bash
cd ..
mv Smart_Attendance_System Smart_Attendance_System_old
git clone <repo-url> Smart_Attendance_System
```

### Secenek B: Mevcut Clone'u Yeniden Hizala

```bash
git fetch --all --prune
git checkout main
git reset --hard origin/main
git clean -fd
```

Ek branch'ler icin:

```bash
git checkout <branch>
git reset --hard origin/<branch>
```

## 8) Sonraki Sertlestirme Adimlari

1. `.env` ve turevlerini `.gitignore` icine ekleyin.
2. CI'ya secret scanning (gitleaks/trufflehog) ekleyin.
3. Pre-commit hook ile `.env` benzeri dosyalari bloklayin.
4. Rotate edilen tum credential'larin aktif oldugunu dogrulayin.
