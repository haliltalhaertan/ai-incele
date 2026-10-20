# Veri akışı ve gizlilik

Tam gizlilik politikası: https://haliltalhaertan.github.io/ai-incele/privacy.html

1. Uzantı Outlook Web’de aktarım düğmesini gösterir. Mail toplama, kullanıcının başlattığı aktarım ve ilgili hizmetin paylaşım onayı sonrasında yapılır.
2. Açık mail metni, yüklenmiş alıntı geçmişi ve içerik görselleri aktarım paketine alınır. Bunlar mailde yer alan kişisel bilgileri içerebilir.
3. Bekleyen paket uzantıya ait IndexedDB’de AES-256-GCM ile şifreli saklanır. Şifreleme anahtarı yalnızca chrome.storage.session belleğindedir; local/sync depolarına veya IndexedDB’ye yazılmaz.
4. Paket yalnızca aktarım için açılan belirli ChatGPT veya Claude sekmesi tarafından alınabilir. İki hizmete aynı anda gönderilmez.
5. Paket hedefe yüklenip gönderilmeye hazır olduğunda yerel kopyası silinir. Kullanılmayan paket 15 dakika sonra okunamaz. Chrome ve uzantı çalışırken temizlik zamanlayıcısı süresi geçen kayıtları kaldırır. Yeniden başlatma sonrasında oturum anahtarı kaybolur; eski paketler açılamaz ve sonraki temizlikte kaldırılır.
6. Son hizmet seçimi ve hizmet başına onay sürümü/zamanı yerel ayarlarda saklanır. Menüden onaylar sıfırlanabilir; bu işlem bekleyen paketleri de temizler.

Yayıncıya mail içeriği aktarılmaz. Yayıncının içerik sunucusu, reklam veya analitik hizmeti yoktur. Kullanıcı kendi ChatGPT/Claude hesabının koşullarına tabidir. Daha önce gönderilmiş sohbetler ilgili AI hizmetinin araçlarıyla silinir.

Ayrı dosya ekleri, kapalı diğer iletiler, parolalar, oturum çerezleri ve genel tarayıcı geçmişi uzantı tarafından toplanmaz. Mailin kendi içinde bulunan bilgiler aktarım içeriğine dahil olabilir.

İletişim: haliltalhaertan@gmail.com
