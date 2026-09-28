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
*{box-sizing:border-box}.shade{position:fixed;inset:0;background:rgba(2,6,23,.42);cursor:crosshair;z-index:2147483647;font-family:Inter,system-ui}.hint{position:fixed;top:22px;left:50%;transform:translateX(-50%);padding:9px 16px;border-radius:999px;background:#0f172a;color:#fff;font:600 13px system-ui;box-shadow:0 8px 25px #0005}.box{display:none;position:fixed;border:2px solid #818cf8;background:#6366f122;box-shadow:0 0 0 9999px #02061755}.panel{width:388px;max-height:70vh;overflow:auto;background:linear-gradient(145deg,#10182c,#151f38);color:#eaf0ff;border:1px solid #ffffff1f;border-radius:16px;box-shadow:0 20px 60px #02061788;font:14px/1.55 Inter,system-ui;animation:pop .18s ease-out}@keyframes pop{from{opacity:0;transform:translateY(8px) scale(.97)}}header,footer{display:flex;align-items:center;justify-content:space-between;padding:12px 15px}.brand{font-weight:800;color:#a5b4fc}.answer{margin:0 15px 12px;padding:14px;border-radius:12px;background:#6366f11f;border:1px solid #818cf844;font-size:18px;font-weight:750;color:#fff}details{margin:0 15px 13px;border-top:1px solid #ffffff14;padding-top:10px}summary{cursor:pointer;color:#c7d2fe;font-weight:650}.explanation,.message{white-space:pre-wrap;color:#cbd5e1}.message{padding:0 15px 14px}.error{color:#fca5a5;font-weight:750}button{border:0;border-radius:8px;background:#ffffff12;color:#dbeafe;padding:5px 9px;cursor:pointer}footer{border-top:1px solid #ffffff14;color:#8fa0bb;font-size:11px}.loading{padding:18px;display:flex;align-items:center;gap:10px}.loading i{width:15px;height:15px;border:2px solid #818cf855;border-top-color:#818cf8;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`;
