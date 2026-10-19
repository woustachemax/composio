export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function slugFromInput(input: string): string {
  const trimmed = input.trim();
  const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(trimmed);
  if (looksLikeUrl) {
    try {
      const host = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`).hostname.replace(/^www\./, "");
      const parts = host.split(".");
      const label = parts.length > 2 && ["app", "api", "developer", "developers", "docs"].includes(parts[0]) ? parts[1] : parts[0];
      return slugify(label);
    } catch {
      return slugify(trimmed);
    }
  }
  return slugify(trimmed);
}
