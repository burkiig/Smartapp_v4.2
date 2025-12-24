# 🎨 Logo Güncelleme Rehberi

## ✨ Eklenen Animasyonlar

### Mobil Uygulama (React Native)
- ✅ **Fade-in**: Logo yumuşak bir şekilde belirir (1.2 saniye)
- ✅ **Scale Animation**: Logo hafifçe büyüyerek açılır
- ✅ **Shimmer Effect**: Logo üzerinde parlama efekti (2.5 saniye döngü)
- ✅ **Spring Animation**: Elastik açılış efekti

### Web Panel (React)
- ✅ **Fade-in + Slide Up**: Logo aşağıdan yukarı kayarak belirir
- ✅ **Shimmer Effect**: Parlama efekti (3 saniye döngü)
- ✅ **Pulse Animation**: Hafif büyüme-küçülme efekti
- ✅ **Hover Effect**: Mouse üzerine gelince büyüme ve hafif dönme
- ✅ **Gradient Text**: Logo yazısında gradient renk

## 📁 Logo Dosyası Konumları

### Mobil Uygulama
**Dosya Yolu:** `mobile-app/assets/logo.png`

**Önerilen Boyut:** 512x512 px (PNG, şeffaf arka plan)

### Web Panel
**Dosya Yolu:** `web-panel/public/logo.png`

**Önerilen Boyut:** 512x512 px (PNG veya SVG)

## 🔄 Logo Nasıl Güncellenir?

### Adım 1: Logo Dosyasını Hazırlayın
- Format: PNG (şeffaf arka plan önerilir)
- Boyut: 512x512 piksel
- Dosya adı: `logo.png`

### Adım 2: Mobil App için
```bash
# Logo dosyanızı şuraya kopyalayın:
mobile-app/assets/logo.png
```

### Adım 3: Web Panel için
```bash
# Logo dosyanızı şuraya kopyalayın:
web-panel/public/logo.png
```

### Adım 4: Test Edin
```bash
# Mobil app
cd mobile-app
npx expo start

# Web panel
cd web-panel
npm start
```

## 🎯 Şu Anki Durum

Şu anda placeholder olarak **okul ikonu (🎓)** kullanılıyor. 

Gerçek logonuzu eklemek için:
1. Logo dosyanızı yukarıdaki konumlara kaydedin
2. Uygulama otomatik olarak yeni logoyu gösterecek
3. Animasyonlar otomatik çalışacak

## 💡 İpuçları

### Logo Boyutunu Değiştirmek İsterseniz:

**Mobil App (index.js):**
```javascript
logoWrapper: {
  width: 120,  // ← Bu değeri değiştirin
  height: 120, // ← Bu değeri değiştirin
  // ...
}
```

**Web Panel (Login.css):**
```css
.logo-shimmer-wrapper {
  width: 140px;  /* ← Bu değeri değiştirin */
  height: 140px; /* ← Bu değeri değiştirin */
  /* ... */
}
```

### Animasyon Hızını Değiştirmek İsterseniz:

**Mobil App:**
```javascript
Animated.timing(fadeAnim, {
  toValue: 1,
  duration: 1200, // ← Milisaniye cinsinden (1200 = 1.2 saniye)
  useNativeDriver: true,
})
```

**Web Panel:**
```css
.login-logo {
  transition: all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  /* ↑ 1.2s değerini değiştirin */
}
```

## 🚀 Sonuç

Artık logonuz:
- ✨ Premium animasyonlarla açılıyor
- 💫 Shimmer efekti ile parlıyor
- 🎯 Profesyonel görünüyor
- 📱 Hem mobil hem web'de çalışıyor

**Kolay güncellenebilir!** Sadece logo dosyasını değiştirin, kod otomatik çalışır! 🎉

