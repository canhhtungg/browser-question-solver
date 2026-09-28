import { defaults, getSettings, validLocalUrl } from "../shared/settings";

document.addEventListener("DOMContentLoaded", async () => {
  const apiUrl = document.querySelector<HTMLInputElement>("#apiUrl")!;
  const language = document.querySelector<HTMLSelectElement>("#language")!;
  const message = document.querySelector<HTMLDivElement>("#message")!;
  const saved = await getSettings(); apiUrl.value = saved.apiUrl; language.value = saved.language;
  const report = (text: string, error = false) => { message.textContent = text; message.className = error ? "error" : ""; };
  document.querySelector("form")!.addEventListener("submit", async event => {
    event.preventDefault(); const value = apiUrl.value.replace(/\/+$/, "");
    if (!validLocalUrl(value)) return report("Địa chỉ phải là HTTP localhost hoặc 127.0.0.1.", true);
    await chrome.storage.local.set({ apiUrl: value, language: language.value }); report("Đã lưu cài đặt.");
  });
  document.querySelector<HTMLButtonElement>("#test")!.onclick = async () => {
    const value = apiUrl.value.replace(/\/+$/, ""); if (!validLocalUrl(value)) return report("Địa chỉ localhost không hợp lệ.", true);
    report("Đang kiểm tra…");
    try { const response = await fetch(`${value}/api/health`); if (!response.ok) throw new Error(); report("Kết nối backend thành công."); }
    catch { report("Không thể kết nối backend.", true); }
  };
  if (!apiUrl.value) apiUrl.value = defaults.apiUrl;
});
