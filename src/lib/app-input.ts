export const APP_INPUT_MAX = 80;

export type AppInputResult = { ok: true; value: string } | { ok: false; error: string };

export function validateAppInput(raw: unknown): AppInputResult {
  if (typeof raw !== "string") return { ok: false, error: "Enter an app name or website." };
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: false, error: "Enter an app name or website." };
  if (/[<>]/.test(value)) return { ok: false, error: "App names can't contain < or >." };
  if (/[\u0000-\u001f\u007f]/.test(value)) return { ok: false, error: "That doesn't look like an app name." };
  if (value.length > APP_INPUT_MAX) return { ok: false, error: `Keep it to ${APP_INPUT_MAX} characters or fewer.` };
  return { ok: true, value };
}
