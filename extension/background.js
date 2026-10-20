"use strict";
const MAIL_ORIGINS = new Set(["https://outlook.cloud.microsoft", "https://outlook.office.com", "https://outlook.office365.com"]);
const PROVIDERS = Object.freeze({
  chatgpt: {name: "ChatGPT", origin: "https://chatgpt.com", start: "https://chatgpt.com/"},
  claude: {name: "Claude", origin: "https://claude.ai", start: "https://claude.ai/new"}
});
const providerFor = key => Object.hasOwn(PROVIDERS, key) ? PROVIDERS[key] : null;
const TTL = 15 * 60 * 1000;
const DB_NAME = "outlook-chatgpt-transfer-v1";
const KEY_NAME = "mail-review-session-key-v1";
const CONSENT_VERSION = 1;
let dbPromise;
let sessionKeyPromise;

async function sessionKey(create = false) {
  if (!sessionKeyPromise) sessionKeyPromise = (async () => {
    let value = (await chrome.storage.session.get(KEY_NAME))[KEY_NAME];
    if (!value && create) {
      value = Array.from(crypto.getRandomValues(new Uint8Array(32)));
      await chrome.storage.session.set({[KEY_NAME]: value});
    }
    if (!Array.isArray(value) || value.length !== 32) throw new Error("Geçici şifreleme oturumu kapandı. Outlook’tan yeni aktarım başlatın.");
    return crypto.subtle.importKey("raw", new Uint8Array(value), "AES-GCM", false, ["encrypt", "decrypt"]);
  })();
  try { return await sessionKeyPromise; }
  catch (error) { sessionKeyPromise = undefined; throw error; }
}

function associatedData(record) {
  return new TextEncoder().encode(`${record.id}|${record.provider}|${record.expiresAt}`);
}

async function encryptPayload(payload, record) {
  const key = await sessionKey(true);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt({name: "AES-GCM", iv, additionalData: associatedData(record)}, key, new TextEncoder().encode(JSON.stringify(payload)));
  return {iv: Array.from(iv), bytes};
}

async function decryptPayload(record) {
  if (!record.encryptedPayload || record.payload) throw new Error("Eski aktarım paketi kullanılamaz. Outlook’tan yeni aktarım başlatın.");
  try {
    const key = await sessionKey();
    const {iv, bytes} = record.encryptedPayload;
    const data = await crypto.subtle.decrypt({name: "AES-GCM", iv: new Uint8Array(iv), additionalData: associatedData(record)}, key, bytes);
    return JSON.parse(new TextDecoder().decode(data));
  } catch {
    throw new Error("Geçici paket açılamadı. Outlook’tan yeni aktarım başlatın.");
  }
}

function database() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains("packages")) request.result.createObjectStore("packages", {keyPath: "id"});
      if (!request.result.objectStoreNames.contains("settings")) request.result.createObjectStore("settings", {keyPath: "id"});
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function store(mode, operation, name = "packages") {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(name, mode);
    const result = operation(transaction.objectStore(name));
    transaction.oncomplete = () => resolve(result?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error || new Error("Yerel kayıt tamamlanamadı."));
  });
}

async function purge() {
  const hasKey = Boolean((await chrome.storage.session.get(KEY_NAME))[KEY_NAME]);
  await store("readwrite", s => {
    const request = s.openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (cursor.value.expiresAt < Date.now() || !cursor.value.encryptedPayload || cursor.value.payload || !hasKey) cursor.delete();
      cursor.continue();
    };
  });
}

function senderOrigin(sender) {
  try { return new URL(sender.url).origin; } catch { return ""; }
}

async function validatePayload(payload) {
  if (!payload || typeof payload.text !== "string" || !payload.text.trim() || payload.text.length > 1500000 || typeof payload.prompt !== "string" || payload.prompt.length > 4000 || typeof payload.subject !== "string" || payload.subject.length > 300) throw new Error("Geçersiz mail paketi.");
  if (!Array.isArray(payload.files) || payload.files.length > 19) throw new Error("Görsel dosyası sınırı aşıldı.");
  if (JSON.stringify(payload).length > 28 * 1024 * 1024) throw new Error("Paket 28 MB sınırını aşıyor.");
  const formats = {"image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp"};
  const names = new Set();
  for (const file of payload.files) {
    const extension = formats[file.type];
    if (!extension || !new RegExp(`^G\\d{2}-original\\.${extension}$`).test(file.name) || names.has(file.name) || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.base64 || "") || file.base64.length % 4 || !/^[a-f0-9]{64}$/.test(file.sha256 || "") || !Number.isInteger(file.size) || file.size < 1 || file.size > 20 * 1024 * 1024) throw new Error("Geçersiz özgün görsel dosyası.");
    names.add(file.name);
    const bytes = Uint8Array.from(atob(file.base64), character => character.charCodeAt(0));
    if (bytes.byteLength !== file.size) throw new Error("Özgün görsel dosyasının boyutu değişmiş.");
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join("");
    if (hash !== file.sha256) throw new Error("Özgün görsel dosyasının içeriği değişmiş.");
  }
}

async function handle(message, sender) {
  if (!sender.tab?.id || sender.frameId !== 0) throw new Error("Bu işlem üst düzey sekmeden yapılmalı.");
  const origin = senderOrigin(sender);
  if (["MAIL_CONSENT_GRANT", "MAIL_CONSENT_RESET", "MAIL_PRIVACY_OPEN"].includes(message.type)) {
    if (!MAIL_ORIGINS.has(origin)) throw new Error("Mail kaynağı izinli değil.");
    if (message.type === "MAIL_PRIVACY_OPEN") {
      await chrome.tabs.create({url: chrome.runtime.getURL("privacy.html"), active: true});
    } else if (message.type === "MAIL_CONSENT_RESET") {
      await store("readwrite", s => {
        Object.keys(PROVIDERS).forEach(key => s.delete(`consent:${key}`));
      }, "settings");
      // Revoking sharing also removes pending packages.
      await store("readwrite", s => s.clear());
    } else {
      if (!providerFor(message.provider)) throw new Error("İnceleme hedefi izinli değil.");
      await store("readwrite", s => s.put({id: `consent:${message.provider}`, version: CONSENT_VERSION, grantedAt: Date.now()}), "settings");
    }
    return {ok: true};
  }
  if (message.type === "MAIL_PROVIDER_GET") {
    if (!MAIL_ORIGINS.has(origin)) throw new Error("Mail kaynağı izinli değil.");
    const setting = await store("readonly", s => s.get("provider"), "settings");
    const consents = {};
    for (const key of Object.keys(PROVIDERS)) {
      const consent = await store("readonly", s => s.get(`consent:${key}`), "settings");
      consents[key] = consent?.version === CONSENT_VERSION;
    }
    return {ok: true, provider: providerFor(setting?.value) ? setting.value : "chatgpt", consents};
  }
  if (message.type === "MAIL_PREPARE") {
    if (!MAIL_ORIGINS.has(origin)) throw new Error("Mail kaynağı izinli değil.");
    const providerKey = message.provider ?? "chatgpt";
    const provider = providerFor(providerKey);
    if (!provider) throw new Error("İnceleme hedefi izinli değil.");
    const consent = await store("readonly", s => s.get(`consent:${providerKey}`), "settings");
    if (consent?.version !== CONSENT_VERSION) throw new Error(`${provider.name} aktarımı için önce paylaşım açıklamasını onaylayın.`);
    await validatePayload(message.payload);
    await purge();
    const id = crypto.randomUUID();
    const record = {id, provider: providerKey, expiresAt: Date.now() + TTL, sourceTabId: sender.tab.id, targetTabId: null};
    record.encryptedPayload = await encryptPayload(message.payload, record);
    await store("readwrite", s => s.put(record));
    try {
      const tab = await chrome.tabs.create({url: `${provider.start}#mail-review=${id}`, active: true});
      record.targetTabId = tab.id;
      await store("readwrite", s => s.put(record));
      await store("readwrite", s => s.put({id: "provider", value: providerKey}), "settings");
      await chrome.alarms.create("mail-review-purge", {periodInMinutes: 1});
      return {ok: true, id, provider: providerKey};
    } catch (error) {
      await store("readwrite", s => s.delete(id));
      throw error;
    }
  }
  if (!["MAIL_CLAIM", "MAIL_DONE"].includes(message.type) || !Object.values(PROVIDERS).some(provider => provider.origin === origin) || !/^[a-f0-9-]{36}$/.test(message.id || "")) throw new Error("İşlem izinli değil.");
  const record = await store("readonly", s => s.get(message.id));
  if (!record || record.expiresAt < Date.now()) throw new Error("Mail paketinin süresi doldu. Outlook’tan yeniden aktarın.");
  const provider = providerFor(record.provider);
  if (!provider || origin !== provider.origin) throw new Error("Mail paketi başka bir AI hizmeti için hazırlandı.");
  if (!record.targetTabId) return {ok: false, retry: true};
  if (record.targetTabId !== sender.tab.id) throw new Error(`Mail yalnızca kendisi için açılan ${provider.name} sekmesine aktarılabilir.`);
  const consent = await store("readonly", s => s.get(`consent:${record.provider}`), "settings");
  if (consent?.version !== CONSENT_VERSION) throw new Error("Bu hizmetin paylaşım onayı kaldırıldı. Outlook’tan yeni aktarım başlatın.");
  if (message.type === "MAIL_DONE") {
    await store("readwrite", s => s.delete(message.id));
    return {ok: true};
  }
  return {ok: true, payload: await decryptPayload(record)};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message || {}, sender).then(sendResponse).catch(error => sendResponse({ok: false, error: error.message || "Aktarım tamamlanamadı."}));
  return true;
});
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === "mail-review-purge") purge().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => purge().catch(() => {}));
