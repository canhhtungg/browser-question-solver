type Message = { type: string; image?: string; apiUrl?: string; language?: string };

chrome.commands.onCommand.addListener((command) => {
  if (command === "start-selection") void startSelection();
});

chrome.runtime.onMessage.addListener((message: Message, sender, respond) => {
  if (message.type === "START_SELECTION") {
    startSelection().then(() => respond({ ok: true }), error => respond({ ok: false, error: readable(error) }));
    return true;
  }
  if (message.type === "CAPTURE") {
    const windowId = sender.tab?.windowId;
    const callback = (dataUrl?: string) => {
      const error = chrome.runtime.lastError?.message;
      respond(error || !dataUrl ? { ok: false, error: error || "Không chụp được màn hình." } : { ok: true, dataUrl });
    };
    if (typeof windowId === "number") chrome.tabs.captureVisibleTab(windowId, { format: "png" }, callback);
    else chrome.tabs.captureVisibleTab({ format: "png" }, callback);
    return true;
  }
  if (message.type === "SOLVE") {
    solve(message).then(data => respond({ ok: true, data }), error => respond({ ok: false, error: readable(error) }));
    return true;
  }
});

async function startSelection(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || /^(chrome|edge|about):/.test(tab.url)) throw new Error("Trang này không cho phép tiện ích chạy.");
  try { await chrome.tabs.sendMessage(tab.id, { type: "PING" }); }
  catch { await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] }); }
  await chrome.tabs.sendMessage(tab.id, { type: "SELECT" });
}

async function solve(message: Message): Promise<unknown> {
  if (!message.image || !message.apiUrl) throw new Error("Thiếu ảnh hoặc địa chỉ backend.");
  const url = new URL(message.apiUrl);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Backend phải chạy trên localhost.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await fetch(`${message.apiUrl.replace(/\/+$/, "")}/api/solve`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: message.image, language: message.language || "vi" }), signal: controller.signal
    });
    const body = await response.json().catch(() => ({})) as { detail?: string };
    if (!response.ok) throw new Error(body.detail || `Backend trả về lỗi ${response.status}.`);
    return body;
  } finally { clearTimeout(timer); }
}

function readable(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") return "Yêu cầu quá thời gian. Hãy thử lại.";
  return error instanceof Error ? error.message : "Đã xảy ra lỗi không xác định.";
}
