globalThis.MailReviewTransfer = Object.freeze({start(config) {
  "use strict";
  const match = location.hash.match(/^#mail-review=([a-f0-9-]{36})$/);
  if (!match || document.getElementById("mail-review-chat-status")) return;
  const id = match[1];
  const panel = document.createElement("div");
  panel.id = "mail-review-chat-status";
  panel.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483646;max-width:min(620px,85vw);padding:14px 20px;border:1px solid #a8c9c3;border-radius:14px;background:#eef8f5;color:#143c35;box-shadow:0 8px 28px #0002;font:14px/1.5 system-ui;white-space:pre-line";
  panel.setAttribute("role", "status");
  panel.textContent = "Outlook maili alınıyor…";
  (document.body || document.documentElement).append(panel);
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

  async function waitFor(find, seconds = 60) {
    const end = Date.now() + seconds * 1000;
    while (Date.now() < end) {
      const value = find();
      if (value) return value;
      await pause(400);
    }
    throw new Error(`${config.name} mesaj alanı hazırlanamadı. Oturumunuzu açın ve Outlook’tan yeniden aktarın.`);
  }

  function editor() {
    return [...document.querySelectorAll(config.editorSelector)].find(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !el.disabled;
    });
  }

  function editorText(element) {
    return element ? (element instanceof HTMLTextAreaElement ? element.value : element.innerText ?? element.textContent ?? "") : "";
  }

  function fileInput() {
    return [...document.querySelectorAll('input[type="file"]')].filter(x => x.multiple && !x.disabled).sort((a, b) => Number(Boolean(a.accept)) - Number(Boolean(b.accept)))[0];
  }

  async function asFile(file) {
    const bytes = Uint8Array.from(atob(file.base64), character => character.charCodeAt(0));
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
    if (bytes.byteLength !== file.size || hash !== file.sha256) throw new Error(`${file.name} dosyası özgün kaynakla aynı değil. Aktarım durdu.`);
    return new File([bytes], file.name, {type: file.type});
  }

  function labelHasFileName(value, name) {
    const dot = name.lastIndexOf('.');
    const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = dot > 0 ? `${escape(name.slice(0, dot))}(?:\\s*\\(\\d+\\))?${escape(name.slice(dot))}` : escape(name);
    return new RegExp(pattern, 'i').test(value || "");
  }

  function attachmentVisible(name) {
    const excluded = '[contenteditable="true"], textarea, #mail-review-chat-status';
    const elements = [...document.querySelectorAll('[title], [aria-label], img[alt]')];
    if (elements.some(el => !el.closest(excluded) && el.getBoundingClientRect().width && [el.getAttribute("title"), el.getAttribute("aria-label"), el.getAttribute("alt")].some(value => labelHasFileName(value, name)))) return true;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (labelHasFileName(node.nodeValue, name) && !node.parentElement?.closest(excluded) && node.parentElement?.getBoundingClientRect().width) return true;
    }
    return false;
  }

  function sendButton() {
    if (config.sendSelector) {
      const button = document.querySelector(config.sendSelector);
      if (button && button.getBoundingClientRect().width > 0) return button;
    }
    return [...document.querySelectorAll("button")].find(button => {
      const name = (button.getAttribute("aria-label") || button.textContent).trim();
      return /^(Gönder|İletiyi gönder|Mesaj gönder|Send|Send prompt|Send message)$/i.test(name) && button.getBoundingClientRect().width > 0;
    });
  }

  function uploading() {
    return [...document.querySelectorAll('[role="progressbar"], [aria-busy="true"]')].some(el => el.getBoundingClientRect().width > 0);
  }

  function uploadError() {
    return [...document.querySelectorAll('[role="alert"]')].find(el => {
      const text = el.textContent || "";
      return el.getBoundingClientRect().width > 0 && /upload|hochlad|file|datei|image|bild|dosya|görsel|yükle/i.test(text) && /error|failed|unsupported|limit|too (large|many)|fehler|fehlgeschlagen|nicht unterstützt|zu (groß|viele)|hata|başarısız|desteklenm|sınır/i.test(text);
    })?.textContent?.trim();
  }

  function newPage() { return config.newPaths.includes(location.pathname); }

  async function run() {
    if (!newPage()) throw new Error("Aktarım yalnızca yeni sohbet sayfasında yapılır. Outlook’tan yeniden başlatın.");
    let response;
    for (let attempt = 0; attempt < 8; attempt++) {
      response = await chrome.runtime.sendMessage({type: "MAIL_CLAIM", id});
      if (!response?.retry) break;
      await pause(300);
    }
    if (!response?.ok) throw new Error(response?.error || "Mail paketi alınamadı.");
    const payload = response.payload;
    if (config.maxImageDimension && payload.files.some(file => file.width > config.maxImageDimension || file.height > config.maxImageDimension)) throw new Error(`${config.name} için görsel boyutu sınırı ${config.maxImageDimension} piksel. Özgün görseli küçültmeden aktarım durduruldu.`);
    panel.textContent = `Yeni sohbet hazırlanıyor. ${config.name} oturumunuz kapalıysa giriş yapın…`;
    const inputEditor = await waitFor(editor);
    if (editorText(inputEditor).trim()) throw new Error("Mesaj alanında başka içerik var. Mevcut taslağı değiştirmemek için aktarım durdu; Outlook’tan yeniden deneyin.");
    const input = await waitFor(fileInput);
    if (input.files?.length || attachmentVisible("mail-icerigi.txt") || payload.files.some(file => attachmentVisible(file.name))) throw new Error("Bu sohbette zaten aktarım dosyası seçili. Çift yüklememek için Outlook’tan yeni aktarım başlatın.");
    const files = [new File([payload.text], "mail-icerigi.txt", {type: "text/plain;charset=utf-8"}), ...(await Promise.all(payload.files.map(asFile)))];
    panel.textContent = `Mail metni ve ${payload.files.length} ayrı özgün görsel dosyası yükleniyor…`;
    const transfer = new DataTransfer();
    files.forEach(file => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", {bubbles: true}));
    await pause(1200);
    const currentEditor = await waitFor(editor);
    if (!newPage() || editorText(currentEditor).trim()) throw new Error("Sohbet veya mesaj taslağı değişti. Mevcut içeriği korumak için aktarım durdu.");
    const prompt = `Konu: ${payload.subject}\n\n${payload.prompt}`;
    currentEditor.focus();
    if (currentEditor instanceof HTMLTextAreaElement) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(currentEditor, prompt);
      currentEditor.dispatchEvent(new Event("input", {bubbles: true}));
    } else {
      if (!document.execCommand("insertText", false, prompt)) throw new Error("İnceleme isteği mesaj alanına yerleştirilemedi. Dosyaları kontrol edin; tekrar aktarmadan önce bu taslağı kapatın.");
    }
    const expectedText = prompt.replace(/\s+/g, " ").trim();
    if (editorText(currentEditor).replace(/\s+/g, " ").trim() !== expectedText) throw new Error("İnceleme isteğinin tamamı mesaj alanına yerleştirilemedi. Otomatik gönderim yapılmadı.");
    await pause(1200);
    let allPresent = false;
    let readySince = 0;
    let button;
    for (let attempt = 0; attempt < 240; attempt++) {
      const error = uploadError();
      if (error) throw new Error(`${config.name} yükleme uyarısı: ${error}\nOtomatik gönderim yapılmadı.`);
      allPresent = files.every(file => attachmentVisible(file.name));
      button = sendButton();
      const ready = allPresent && button && !button.disabled && button.getAttribute("aria-disabled") !== "true" && !uploading();
      if (ready) {
        if (!readySince) readySince = Date.now();
        if (Date.now() - readySince > 1500) break;
      } else readySince = 0;
      await pause(500);
    }
    if (!allPresent || !readySince || Date.now() - readySince <= 1500 || !button?.isConnected || button.disabled) {
      panel.textContent = `Dosya yüklemelerinin tamamı veya Gönder düğmesinin hazır olduğu doğrulanamadı. Otomatik gönderim yapılmadı. ${config.name} yükleme uyarısını kontrol edin. Çift yüklememek için bu sayfayı yenilemeyin.`;
      panel.style.background = "#fff4dd";
      panel.style.borderColor = "#d2a456";
      return;
    }
    const finalEditor = editor();
    if (!newPage() || !finalEditor || editorText(finalEditor).replace(/\s+/g, " ").trim() !== expectedText) throw new Error("Sohbet veya mesaj taslağı değişti. Otomatik gönderim yapılmadı; yeni sohbeti kontrol edin.");
    // Remove the one-time handoff before sending, so refreshing cannot send twice.
    const done = await chrome.runtime.sendMessage({type: "MAIL_DONE", id});
    if (!done?.ok) throw new Error("Tek seferlik aktarım tamamlanamadı. Otomatik gönderim yapılmadı.");
    history.replaceState(history.state, "", location.pathname + location.search);
    panel.textContent = "Tüm dosyalar hazır. İnceleme isteği gönderiliyor…";
    button.click();
    let submitted = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (location.pathname.startsWith(config.submittedPrefix) && !editorText(editor()).includes(payload.prompt)) { submitted = true; break; }
      await pause(500);
    }
    panel.textContent = submitted
      ? `${payload.summary.uniqueImages} ayrı özgün içerik görseli aktarıldı. ${payload.summary.skippedBranding || 0} logo/imza/QR görseli çıkarıldı.\nMail metni ve görsel dosyalarıyla inceleme isteği gönderildi.`
      : "Dosyalar eklendi ve Gönder düğmesine basıldı; gönderimin tamamlandığı doğrulanamadı. Yeni sohbeti kontrol edin. İkinci kez otomatik gönderim yapılmayacak.";
    const close = document.createElement("button");
    close.textContent = "Kapat";
    close.style.cssText = "display:block;margin-top:8px;border:0;background:none;color:inherit;text-decoration:underline;cursor:pointer";
    close.onclick = () => panel.remove();
    panel.append(close);
  }

  run().catch(error => {
    panel.textContent = error.message || "Aktarım tamamlanamadı.";
    panel.style.background = "#fff0ec";
    panel.style.borderColor = "#cb8b78";
  });
}});
