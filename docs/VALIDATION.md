# Doğrulama durumu

Paket: **0.4.0** · Kontrol tarihi: **20 Ekim 2026**

- Manifest, dosya referansları, dar kapsamlı site izinleri, ikon boyutları ve mağaza görsellerinin biçimleri kontrol edildi.
- Mevcut arka plan kontrolleri: **32 başarılı / 0 başarısız**. Ortam: gerçek tarayıcı IndexedDB/WebCrypto; taklit Chrome API’leri.
- Arayüz kontrolleri: onaydan önce içerik toplamama, vazgeçme, hizmet başına ayrı onay, sonraki kullanımda tek tık ve onay sıfırlama.
- 0.3.0’dan aktarılan ChatGPT/Claude yükleme dosyalarının değişmediği doğrulandı. Önceki sürümün canlı aktarım sonucu, 0.4.0’ın tamamı için yeni bir canlı test olarak sayılmadı.
- **0.4.0’ın yüklenmiş Chrome uzantısıyla son canlı uçtan uca testi bekliyor.**
- **Chrome Web Store’a gönderilmedi; mağaza onayı alınmış değildir.**
- Depodaki ürün ekran görüntüleri örnek verilerle hazırlanmıştır.

İndirilebilir paketin SHA-256 özeti:

```text
9fd4038d4b3e3e9c5cd54aa3d46803ec0c466b0ee634e87ee854cd395973008a
```

Kaynak ve paket bütünlük kontrolünü yeniden çalıştırmak için depo kökünde `node scripts/check.mjs` komutunu kullan. Arka plan testlerinin kaynağı `tests/background/` dizinindedir.
