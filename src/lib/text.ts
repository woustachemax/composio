const ARROWS = /\s*(?:\u2192|\u2190|\u27f6|\u27f5|\u21d2|\u203a|\u00bb|->|=>)\s*/g;
const RANGE = /(\d+(?:\.\d+)?)\s*[\u2013\u2014]\s*(\d+(?:\.\d+)?)/g;

export function cleanText(text: string, joiner = ", "): string {
  return text
    .replace(RANGE, "$1 to $2")
    .replace(/\s*\u2014\s*/g, joiner)
    .replace(/\s+(?:\u2013|--)\s+/g, joiner)
    .replace(/\u2013/g, "-")
    .replace(ARROWS, (m) => (/^\s/.test(m) || /\s$/.test(m) ? ", then " : " "));
}

export function cleanQuote(text: string): string {
  return text.replace(/[\u2013\u2014]/g, "-").replace(ARROWS, " > ");
}

export function cleanTextDeep<T>(value: T, key?: string): T {
  if (typeof value === "string") return (key === "quote" ? cleanQuote(value) : cleanText(value)) as T;
  if (Array.isArray(value)) return value.map((v) => cleanTextDeep(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = cleanTextDeep(v, k);
    return out as T;
  }
  return value;
}

export const FORBIDDEN_PUNCTUATION = /[\u2014\u2013\u2192\u2190\u27f6\u27f5\u21d2\u203a\u00bb]|->|=>|(?<![-\w])--(?![-\w])/;
