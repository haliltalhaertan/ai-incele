(() => {
  "use strict";
  if (document.getElementById("mail-review-host")) return;
  const host = document.createElement("div");
  host.id = "mail-review-host";
  host.style.cssText = "position:fixed;right:26px;bottom:24px;z-index:2147483646";
  const shadow = host.attachShadow({mode: "open"});
  const style = document.createElement("style");
  style.textContent = `
    :host { font:14px system-ui,sans-serif; color:#12323a }
    button { border:0;background:#087e75;color:white;font:600 14px system-ui;cursor:pointer }
    button:hover { background:#05665f } button:disabled { opacity:.7;cursor:wait }
    button:focus-visible { outline:3px solid #91d5ff;outline-offset:3px }
    .actions { display:flex;justify-content:flex-end }
    .main { border-radius:14px 0 0 14px;padding:13px 18px;box-shadow:0 6px 24px #093d3c38;display:flex;align-items:center;gap:11px }
    .provider { font-size:11px;font-weight:500;background:#ffffff24;padding:3px 7px;border-radius:7px }
    .choose { border-radius:0 14px 14px 0;padding:13px 12px;border-left:1px solid #ffffff40 }
    .menu { display:none;background:white;border:1px solid #cbdedb;border-radius:14px;padding:6px;margin:0 0 10px auto;width:220px;box-shadow:0 6px 24px #093d3c25 }
    .menu.show { display:block }
    .menu p { font-size:12px;color:#5a7172;margin:8px 10px }
    .menu button { display:block;width:100%;padding:12px 10px;border-radius:9px;text-align:left;background:white;color:#12323a }
    .menu button:hover { background:#e8f5f1 }
    .menu .secondary { font-size:12px;font-weight:400;color:#52696b;border-top:1px solid #e4eeeb;border-radius:0 }
    .disclosure { display:none;background:white;border:1px solid #a8c9c3;border-radius:14px;padding:18px;margin:0 0 10px auto;width:320px;max-width:calc(100vw - 88px);box-shadow:0 6px 24px #093d3c25;line-height:1.5 }
    .disclosure.show { display:block }
    .disclosure h2 { font-size:16px;margin:0 0 10px }
    .disclosure p { font-size:13px;margin:10px 0 }
    .disclosure label { display:flex;gap:9px;font-size:13px;align-items:flex-start;margin:14px 0 }
    .disclosure input { flex:none;margin:4px 0 0 }
    .disclosure .controls { display:flex;gap:8px;flex-wrap:wrap }
    .disclosure button { padding:10px 12px;border-radius:9px;font-size:13px }
    .disclosure .cancel { background:#eaf1ee;color:#173b3b }
    .message { display:none;max-width:340px;padding:16px 18px;margin-bottom:10px;background:white;border:1px solid #cbdedb;border-radius:14px;line-height:1.55;box-shadow:0 6px 24px #093d3c25;white-space:pre-line }
    .message.show { display:block } .error { border-color:#d28575;color:#843426 }
  `;
  const message = document.createElement("div");
  message.className = "message";
  message.setAttribute("role", "status");
  const button = document.createElement("button");
  button.className = "main";
  const label = document.createElement("span");
  label.textContent = "✦ AI’de incele";
  const badge = document.createElement("span");
  badge.className = "provider";
  button.append(label, badge);
  const choose = document.createElement("button");
  choose.className = "choose";
  choose.textContent = "▾";
  choose.setAttribute("aria-label", "AI hizmetini seç");
  choose.setAttribute("aria-expanded", "false");
  choose.setAttribute("aria-controls", "provider-menu");
  const menu = document.createElement("div");
  menu.id = "provider-menu";
  menu.className = "menu";
  menu.setAttribute("role", "group");
  menu.setAttribute("aria-label", "İnceleme hedefi");
  const hint = document.createElement("p");
  hint.textContent = "Bu maili şurada incele:";
  menu.append(hint);
  const providers = {chatgpt: "ChatGPT", claude: "Claude"};
  const providerButtons = [];
  let selected = "chatgpt";
  function updateProvider(value) {
    if (!Object.hasOwn(providers, value)) return;
    selected = value;
    badge.textContent = providers[selected];
    button.setAttribute("aria-label", `AI’de incele — ${providers[selected]}`);
    button.title = `Açık maili özgün içerik görselleriyle yeni ${providers[selected]} sohbetine aktarır. Son hedef seçiminiz hatırlanır.`;
    providerButtons.forEach(item => { item.button.textContent = `${item.key === selected ? "✓ " : ""}${providers[item.key]} ile incele`; });
  }
  function closeMenu() {
    menu.classList.remove("show");
    choose.setAttribute("aria-expanded", "false");
  }
  for (const key of Object.keys(providers)) {
    const option = document.createElement("button");
    option.addEventListener("click", event => {
      if (!event.isTrusted || busy) return;
      updateProvider(key);
      closeMenu();
      transfer(key);
    });
    providerButtons.push({key, button: option});
    menu.append(option);
  }
  const privacy = document.createElement("button");
  privacy.className = "secondary";
  privacy.textContent = "Gizlilik ve veri kullanımı";
  privacy.addEventListener("click", async event => {
    if (!event.isTrusted || busy) return;
    closeMenu();
    try {
      const response = await chrome.runtime.sendMessage({type: "MAIL_PRIVACY_OPEN"});
      if (!response?.ok) throw new Error(response?.error || "Gizlilik sayfası açılamadı.");
    } catch (error) { status(error.message, true); }
  });
  const reset = document.createElement("button");
  reset.className = "secondary";
  reset.textContent = "Paylaşım onaylarını sıfırla";
  reset.addEventListener("click", async event => {
    if (!event.isTrusted || busy) return;
    setBusy(true);
    closeMenu();
    closeDisclosure();
    try {
      const response = await chrome.runtime.sendMessage({type: "MAIL_CONSENT_RESET"});
      if (!response?.ok) throw new Error(response?.error || "Paylaşım onayları sıfırlanamadı.");
      status("ChatGPT ve Claude paylaşım onayları sıfırlandı. Bekleyen aktarım paketleri temizlendi. Sonraki aktarımda yeniden onay istenecek.");
    } catch (error) { status(error.message, true); }
    finally { setBusy(false); }
  });
  menu.append(privacy, reset);
  const disclosure = document.createElement("section");
  disclosure.className = "disclosure";
  disclosure.setAttribute("role", "region");
  disclosure.setAttribute("aria-label", "Mail paylaşım onayı");
  const disclosureTitle = document.createElement("h2");
  const explanation = document.createElement("p");
  const detail = document.createElement("p");
  detail.textContent = "Yayıncı mail içeriğini almaz. İçerik, seçtiğiniz hizmetin hesabınızda geçerli olan veri işleme koşullarına tabidir.";
  const consentLabel = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const consentText = document.createElement("span");
  consentLabel.append(checkbox, consentText);
  const controls = document.createElement("div");
  controls.className = "controls";
  const confirm = document.createElement("button");
  confirm.textContent = "Onayla ve aktar";
  confirm.disabled = true;
  checkbox.addEventListener("change", () => { confirm.disabled = !checkbox.checked; });
  const cancel = document.createElement("button");
  cancel.className = "cancel";
  cancel.textContent = "Vazgeç";
  cancel.addEventListener("click", event => { if (event.isTrusted && !busy) closeDisclosure(); });
  controls.append(confirm, cancel);
  disclosure.append(disclosureTitle, explanation, detail, consentLabel, controls);
  let pendingProvider = null;
  function closeDisclosure() {
    disclosure.classList.remove("show");
    pendingProvider = null;
    checkbox.checked = false;
    confirm.disabled = true;
  }
  function showDisclosure(provider) {
    closeDisclosure();
    pendingProvider = provider;
    const name = providers[provider];
    disclosureTitle.textContent = `${name} ile mail inceleme`;
    explanation.textContent = `Açık mailin metni, sayfaya yüklenmiş yazışma geçmişi ve içerik görselleri ${name} hesabınızda açılan yeni sohbete yüklenecek. Dosyalar hazır olduğunda inceleme isteği otomatik gönderilecek.`;
    consentText.textContent = `Bu aktarımı ve sonraki tıklamalarımda aynı içerik türlerinin ${name} hizmetine gönderilmesini onaylıyorum. Onayımı menüden sıfırlayabilirim.`;
    disclosure.classList.add("show");
    checkbox.focus();
  }
  confirm.addEventListener("click", async event => {
    if (!event.isTrusted || busy || !checkbox.checked || !pendingProvider) return;
    const provider = pendingProvider;
    setBusy(true);
    confirm.disabled = true;
    try {
      const response = await chrome.runtime.sendMessage({type: "MAIL_CONSENT_GRANT", provider});
      if (!response?.ok) throw new Error(response?.error || "Paylaşım onayı kaydedilemedi.");
      closeDisclosure();
      setBusy(false);
      await transfer(provider);
    } catch (error) { status(error.message, true); }
    finally { setBusy(false); }
  });
  const actions = document.createElement("div");
  actions.className = "actions";
  actions.append(button, choose);
  shadow.append(style, message, disclosure, menu, actions);
  (document.body || document.documentElement).append(host);
  let busy = false;
  function setBusy(value) {
    busy = value;
    button.disabled = value;
    choose.disabled = value;
    providerButtons.forEach(item => { item.button.disabled = value; });
    privacy.disabled = value;
    reset.disabled = value;
    cancel.disabled = value;
  }
  let selectionTouched = false;
  updateProvider(selected);
  chrome.runtime.sendMessage({type: "MAIL_PROVIDER_GET"}).then(response => {
    if (response?.ok && !selectionTouched && !busy) updateProvider(response.provider);
  }).catch(() => {});
  choose.addEventListener("click", event => {
    if (!event.isTrusted || busy) return;
    selectionTouched = true;
    const open = !menu.classList.contains("show");
    menu.classList.toggle("show", open);
    choose.setAttribute("aria-expanded", String(open));
    if (open) providerButtons[0].button.focus();
  });
  document.addEventListener("click", event => { if (!event.composedPath().includes(host)) closeMenu(); });
  shadow.addEventListener("keydown", event => { if (event.key === "Escape") { closeMenu(); choose.focus(); } });
  function status(text, error = false) {
    message.textContent = text;
    message.className = `message show${error ? " error" : ""}`;
  }
  button.addEventListener("click", event => {
    if (!event.isTrusted || busy) return;
    closeMenu();
    transfer(selected);
  });
  async function transfer(provider) {
    if (busy) return;
    selectionTouched = true;
    setBusy(true);
    const name = providers[provider];
    try {
      const preferences = await chrome.runtime.sendMessage({type: "MAIL_PROVIDER_GET"});
      if (!preferences?.ok) throw new Error(preferences?.error || "Paylaşım tercihi okunamadı.");
      if (!preferences.consents?.[provider]) {
        message.classList.remove("show");
        showDisclosure(provider);
        return;
      }
      closeDisclosure();
      status("Mail hazırlanıyor…");
      const payload = await MailReview.collect(status);
      status(`${payload.summary.uniqueImages} ayrı özgün görsel dosyası hazır. ${name} açılıyor…`);
      const response = await chrome.runtime.sendMessage({type: "MAIL_PREPARE", provider, payload});
      if (!response?.ok) throw new Error(response?.error || `${name} sekmesi açılamadı.`);
      status(`${name} açıldı. Dosyalar yüklenip inceleme isteği gönderilecek. Sonraki tek tıkla aktarımda ${name} kullanılacak.`);
    } catch (error) {
      status(error.message || "Aktarım tamamlanamadı.", true);
    } finally {
      setBusy(false);
    }
  }
})();
