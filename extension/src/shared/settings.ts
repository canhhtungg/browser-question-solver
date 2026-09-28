export interface Settings { apiUrl: string; language: string }
export const defaults: Settings = { apiUrl: "http://127.0.0.1:8000", language: "vi" };

export async function getSettings(): Promise<Settings> {
  const saved = await chrome.storage.local.get({ ...defaults });
  return {
    apiUrl: typeof saved.apiUrl === "string" ? saved.apiUrl.replace(/\/+$/, "") : defaults.apiUrl,
    language: typeof saved.language === "string" ? saved.language : defaults.language
  };
}

export function validLocalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  } catch { return false; }
}
