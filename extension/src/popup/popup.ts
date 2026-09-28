import { getSettings } from "../shared/settings";

document.addEventListener("DOMContentLoaded", async () => {
  const status = document.querySelector<HTMLDivElement>("#status")!;
  try {
    const { apiUrl } = await getSettings();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(`${apiUrl}/api/health`, { signal: controller.signal }); clearTimeout(timer);
    if (!response.ok) throw new Error(); status.className = "status ok"; status.querySelector("span")!.textContent = "Backend sẵn sàng";
  } catch { status.className = "status bad"; status.querySelector("span")!.textContent = "Backend chưa kết nối"; }
  document.querySelector<HTMLButtonElement>("#select")!.onclick = () => chrome.runtime.sendMessage({ type: "START_SELECTION" }, () => window.close());
  document.querySelector<HTMLButtonElement>("#options")!.onclick = () => chrome.runtime.openOptionsPage();
});
