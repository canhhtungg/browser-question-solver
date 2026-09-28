import { getSettings } from "../shared/settings";

interface Rect { x: number; y: number; width: number; height: number }
interface Result { answer: string; explanation: string; confidence: number; model: string }
let host: HTMLDivElement | null = null;

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message.type === "PING") respond({ ok: true });
  if (message.type === "SELECT") { startSelection(); respond({ ok: true }); }
});

function startSelection(): void {
  host?.remove();
  host = document.createElement("div"); host.id = "bqs-host";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${styles}</style><div class="shade"><div class="hint">Kéo để chọn câu hỏi · ESC để hủy</div><div class="box"></div></div>`;
  document.documentElement.append(host);
  const shade = root.querySelector<HTMLDivElement>(".shade")!;
  const box = root.querySelector<HTMLDivElement>(".box")!;
  let start: { x: number; y: number } | null = null;
  const cancel = () => { cleanup(); host?.remove(); host = null; };
  const key = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
  const cleanup = () => { window.removeEventListener("keydown", key, true); };
  window.addEventListener("keydown", key, true);
  shade.onmousedown = event => { start = { x: event.clientX, y: event.clientY }; box.style.display = "block"; };
  shade.onmousemove = event => {
    if (!start) return;
    const rect = toRect(start.x, start.y, event.clientX, event.clientY);
    Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  };
  shade.onmouseup = async event => {
    if (!start) return;
    const rect = toRect(start.x, start.y, event.clientX, event.clientY);
    cleanup(); host?.remove(); host = null;
    if (rect.width < 20 || rect.height < 20) return;
    await process(rect);
  };
}

const toRect = (x1: number, y1: number, x2: number, y2: number): Rect => ({ x: Math.min(x1,x2), y: Math.min(y1,y2), width: Math.abs(x2-x1), height: Math.abs(y2-y1) });

async function process(rect: Rect): Promise<void> {
  showPanel(rect, `<div class="loading"><i></i>Đang phân tích câu hỏi…</div>`);
  try {
    const captured = await send<{ ok: boolean; dataUrl?: string; error?: string }>({ type: "CAPTURE" });
    if (!captured.ok || !captured.dataUrl) throw new Error(captured.error || "Không chụp được màn hình.");
    const image = await crop(captured.dataUrl, rect);
    const settings = await getSettings();
    const solved = await send<{ ok: boolean; data?: Result; error?: string }>({ type: "SOLVE", image, apiUrl: settings.apiUrl, language: settings.language });
    if (!solved.ok || !solved.data) throw new Error(solved.error || "Backend không trả về kết quả.");
    renderResult(rect, solved.data);
  } catch (error) { showError(rect, error instanceof Error ? error.message : "Đã xảy ra lỗi."); }
}

function send<T>(message: unknown): Promise<T> {
  return new Promise(resolve => chrome.runtime.sendMessage(message, response => resolve(response as T)));
}

async function crop(dataUrl: string, rect: Rect): Promise<string> {
  const image = new Image(); image.src = dataUrl; await image.decode();
  const sx = image.naturalWidth / innerWidth, sy = image.naturalHeight / innerHeight;
  const x = Math.max(0, Math.round(rect.x * sx)), y = Math.max(0, Math.round(rect.y * sy));
  const sw = Math.min(image.naturalWidth - x, Math.round(rect.width * sx));
  const sh = Math.min(image.naturalHeight - y, Math.round(rect.height * sy));
  const scale = Math.min(1, 1600 / Math.max(sw, sh));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  canvas.getContext("2d")!.drawImage(image, x, y, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .88);
}

function showPanel(rect: Rect, html: string): ShadowRoot {
  host?.remove(); host = document.createElement("div"); host.id = "bqs-result";
  Object.assign(host.style, { position: "fixed", zIndex: "2147483647", left: `${Math.max(12, Math.min(rect.x, innerWidth - 400))}px`, top: `${Math.min(innerHeight - 110, rect.y + rect.height + 10)}px` });
  const root = host.attachShadow({ mode: "open" }); root.innerHTML = `<style>${styles}</style><section class="panel">${html}</section>`; document.documentElement.append(host); return root;
}

function renderResult(rect: Rect, result: Result): void {
  const confidence = Math.round(result.confidence * 100);
  const root = showPanel(rect, `<header><span class="brand">✦ Lời giải</span><button id="close">×</button></header><div class="answer"></div><details><summary>Giải thích</summary><p class="explanation"></p></details><footer><span>${escape(result.model)}</span><span>Độ tin cậy ${confidence}%</span><button id="copy">Sao chép</button></footer>`);
  root.querySelector(".answer")!.textContent = result.answer;
  root.querySelector(".explanation")!.textContent = result.explanation;
  root.querySelector<HTMLButtonElement>("#close")!.onclick = () => host?.remove();
  root.querySelector<HTMLButtonElement>("#copy")!.onclick = async event => { await navigator.clipboard.writeText(`${result.answer}\n\n${result.explanation}`); (event.currentTarget as HTMLButtonElement).textContent = "Đã chép"; };
}

function showError(rect: Rect, message: string): void {
  const root = showPanel(rect, `<header><span class="error">Không thể giải</span><button id="close">×</button></header><p class="message"></p>`);
  root.querySelector(".message")!.textContent = message;
  root.querySelector<HTMLButtonElement>("#close")!.onclick = () => host?.remove();
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));

const styles = `
*{box-sizing:border-box}.shade{position:fixed;inset:0;background:rgba(15,23,42,.28);cursor:crosshair;z-index:2147483647;font-family:Arial,system-ui,sans-serif}.hint{position:fixed;top:20px;left:50%;transform:translateX(-50%);padding:8px 12px;border-radius:6px;background:#fff;color:#334155;border:1px solid #dbe2ea;font:600 13px Arial,system-ui,sans-serif;box-shadow:0 4px 14px rgba(15,23,42,.14)}.box{display:none;position:fixed;border:2px solid #2563eb;background:rgba(37,99,235,.08);box-shadow:0 0 0 9999px rgba(15,23,42,.24)}.panel{width:380px;max-height:70vh;overflow:auto;background:#fff;color:#1f2937;border:1px solid #d7dde5;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.16);font:14px/1.5 Arial,system-ui,sans-serif;animation:pop .14s ease-out}@keyframes pop{from{opacity:0;transform:translateY(4px)}}header,footer{display:flex;align-items:center;justify-content:space-between;padding:10px 12px}.brand{font-weight:700;color:#334155}.answer{margin:0 12px 10px;padding:12px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;font-size:17px;font-weight:700;color:#111827}details{margin:0 12px 10px;border-top:1px solid #e5e7eb;padding-top:9px}summary{cursor:pointer;color:#475569;font-weight:600}.explanation,.message{white-space:pre-wrap;color:#374151}.message{padding:0 12px 12px}.error{color:#b91c1c;font-weight:700}button{border:1px solid #d7dde5;border-radius:5px;background:#fff;color:#475569;padding:4px 8px;cursor:pointer}button:hover{background:#f8fafc}footer{border-top:1px solid #e5e7eb;color:#64748b;font-size:11px}.loading{padding:16px;display:flex;align-items:center;gap:9px}.loading i{width:14px;height:14px;border:2px solid #cbd5e1;border-top-color:#2563eb;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
