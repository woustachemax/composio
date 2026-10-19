import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Probe } from "./guide-schema";

export const COMPOSIO_CALLBACK = "https://backend.composio.dev/api/v3/toolkits/auth/callback";
const TIMEOUT_MS = 8000;
const MAX_BODY = 64 * 1024;
const USER_AGENT = "oauth-setup-guides-probe/1.0 (read-only; unauthenticated)";

export class UnsafeUrlError extends Error {}

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateV6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::" || v === "::1") return true;
  if (v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") || v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb")) return true;
  if (v.startsWith("ff")) return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateV4(mapped[1]) : false;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("Only http and https URLs can be probed");
  if (url.username || url.password) throw new UnsafeUrlError("URLs with credentials are not allowed");
  if (url.port && url.port !== "443" && url.port !== "80") throw new UnsafeUrlError("Only default ports can be probed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost")
    throw new UnsafeUrlError("Only public hostnames can be probed");
  const addresses = await lookup(host, { all: true }).catch(() => {
    throw new UnsafeUrlError(`Could not resolve ${host}`);
  });
  for (const { address, family } of addresses) {
    if (family === 4 ? isPrivateV4(address) : isPrivateV6(address))
      throw new UnsafeUrlError(`${host} resolves to a non-public address`);
  }
  return url;
}

type FetchResult = {
  status: number;
  location: string | null;
  contentType: string | null;
  body: string;
};

async function safeGet(raw: string, accept = "text/html,application/json"): Promise<FetchResult> {
  const url = await assertPublicUrl(raw);
  const res = await fetch(url, {
    method: "GET",
    redirect: "manual",
    headers: { "user-agent": USER_AGENT, accept },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body = "";
  if (res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (body.length < MAX_BODY) {
      const { done, value } = await reader.read();
      if (done) break;
      body += decoder.decode(value, { stream: true });
    }
    await reader.cancel().catch(() => {});
  }
  return { status: res.status, location: res.headers.get("location"), contentType: res.headers.get("content-type"), body };
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function describeLocation(location: string | null, base: string) {
  if (!location) return "";
  try {
    const u = new URL(location, base);
    return ` redirect to ${u.origin}${u.pathname}`;
  } catch {
    return " redirect with an unreadable Location header";
  }
}

function snippet(body: string) {
  const text = body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/[\u2190-\u21ff\u27f5-\u27ff\u2014\u2013\u203a\u00bb]/g, " ").replace(/\s+/g, " ").trim();
  return text.slice(0, 160);
}

function errorMessage(err: unknown) {
  if (err instanceof UnsafeUrlError) return `Not probed: ${err.message}`;
  if (err instanceof Error && err.name === "TimeoutError") return `No response within ${TIMEOUT_MS / 1000}s`;
  return `Request failed: ${err instanceof Error ? err.message : String(err)}`;
}

export type ProbeOutput = { probe: Probe; data: Record<string, unknown> };

export async function probeDiscovery(id: string, issuerOrUrl: string): Promise<ProbeOutput> {
  let origin: string;
  try {
    origin = new URL(issuerOrUrl).origin;
  } catch {
    origin = issuerOrUrl;
  }
  const base = issuerOrUrl.replace(/\/$/, "");
  const candidates = Array.from(
    new Set([
      `${base}/.well-known/openid-configuration`,
      `${origin}/.well-known/openid-configuration`,
      `${origin}/.well-known/oauth-authorization-server`,
    ]),
  );
  const observations: string[] = [];
  for (const url of candidates) {
    try {
      const r = await safeGet(url, "application/json");
      if (r.status === 200) {
        try {
          const doc = JSON.parse(r.body) as Record<string, unknown>;
          if (typeof doc.authorization_endpoint === "string") {
            const data = {
              url,
              issuer: doc.issuer,
              authorization_endpoint: doc.authorization_endpoint,
              token_endpoint: doc.token_endpoint,
              code_challenge_methods_supported: doc.code_challenge_methods_supported,
              scopes_supported: Array.isArray(doc.scopes_supported) ? doc.scopes_supported.slice(0, 40) : undefined,
              grant_types_supported: doc.grant_types_supported,
            };
            return {
              data,
              probe: {
                id,
                kind: "oidc-discovery",
                description: `Whether ${origin} publishes OAuth/OIDC metadata`,
                request: `GET ${url}`,
                observed: `HTTP 200 JSON. authorization_endpoint=${doc.authorization_endpoint}; token_endpoint=${doc.token_endpoint ?? "none"}; PKCE methods=${JSON.stringify(doc.code_challenge_methods_supported ?? "not listed")}.`,
                outcome: "confirmed",
                ranAt: today(),
              },
            };
          }
          observations.push(`${url}: HTTP 200 but no authorization_endpoint`);
        } catch {
          observations.push(`${url}: HTTP 200 but not JSON`);
        }
      } else {
        observations.push(`${url}: HTTP ${r.status}`);
      }
    } catch (err) {
      observations.push(`${url}: ${errorMessage(err)}`);
    }
  }
  return {
    data: { found: false, observations },
    probe: {
      id,
      kind: "oidc-discovery",
      description: `Whether ${origin} publishes OAuth/OIDC metadata`,
      request: candidates.map((c) => `GET ${c}`).join(" and "),
      observed: `${observations.join("; ")}. No discovery document found.`,
      outcome: "refuted",
      ranAt: today(),
    },
  };
}

export async function probeAuthorize(id: string, authorizeUrl: string, extraParams: Record<string, string> = {}): Promise<ProbeOutput> {
  let url: URL;
  try {
    url = new URL(authorizeUrl);
  } catch {
    return {
      data: { error: "invalid url" },
      probe: { id, kind: "authorize-endpoint", description: "Authorize endpoint reachability", request: authorizeUrl, observed: "Not a valid URL.", outcome: "inconclusive", ranAt: today() },
    };
  }
  const params: Record<string, string> = {
    response_type: "code",
    client_id: "oauth-guide-probe-placeholder",
    redirect_uri: COMPOSIO_CALLBACK,
    state: "probe",
    ...extraParams,
  };
  for (const [k, v] of Object.entries(params)) if (!url.searchParams.has(k)) url.searchParams.set(k, v);
  const request = `GET ${url.origin}${url.pathname}?${Array.from(url.searchParams.keys()).map((k) => `${k}=…`).join("&")} (placeholder client_id), compared with a made-up sibling path`;
  try {
    const parent = url.pathname.replace(/\/[^/]*\/?$/, "");
    const control = `${url.origin}${parent}/oauth-guide-probe-nonexistent-7f3a`;
    const [r, c] = await Promise.all([safeGet(url.toString()), safeGet(control).catch(() => null)]);
    const text = snippet(r.body);
    const sameAsControl =
      c !== null && c.status === r.status && describeLocation(c.location, control) === describeLocation(r.location, url.toString());
    let outcome: Probe["outcome"];
    let meaning: string;
    if (sameAsControl) {
      outcome = "inconclusive";
      meaning = `A made-up sibling path also returns HTTP ${c.status}${describeLocation(c.location, control)}, so this response does not show an OAuth endpoint.`;
    } else if (r.status >= 300 && r.status < 400) {
      outcome = "confirmed";
      meaning = "The endpoint is live and redirects (usually to sign-in or an error page).";
    } else if (r.status === 200 || r.status === 400 || r.status === 401 || r.status === 403) {
      outcome = "confirmed";
      meaning = "The endpoint is live and answers OAuth requests.";
    } else if (r.status === 404) {
      outcome = "inconclusive";
      meaning = "404 can mean a wrong URL or a rejected client_id; it does not confirm the endpoint.";
    } else {
      outcome = "inconclusive";
      meaning = "Unexpected status.";
    }
    return {
      data: { status: r.status, redirectsTo: r.location ? describeLocation(r.location, url.toString()).slice(3) : null, bodySnippet: text, meaning },
      probe: {
        id,
        kind: "authorize-endpoint",
        description: `Whether ${url.origin}${url.pathname} is a live authorize endpoint`,
        request,
        observed: `HTTP ${r.status}${describeLocation(r.location, url.toString())}${text ? `. Page text: “${text.slice(0, 120)}”` : ""}. ${meaning} A placeholder client_id cannot prove your own app will work.`,
        outcome,
        ranAt: today(),
      },
    };
  } catch (err) {
    const msg = errorMessage(err);
    return {
      data: { error: msg },
      probe: {
        id,
        kind: "authorize-endpoint",
        description: `Whether ${url.origin}${url.pathname} is a live authorize endpoint`,
        request,
        observed: msg,
        outcome: msg.startsWith("Not probed: Could not resolve") ? "refuted" : "inconclusive",
        ranAt: today(),
      },
    };
  }
}

export async function probeConsole(id: string, consoleUrl: string): Promise<ProbeOutput> {
  let origin = consoleUrl;
  try {
    origin = new URL(consoleUrl).origin;
  } catch {}
  let control = `${origin}/oauth-guide-probe-nonexistent-path-7f3a`;
  try {
    const u = new URL(consoleUrl);
    const parent = u.pathname.replace(/\/[^/]*\/?$/, "");
    control = `${u.origin}${parent}/oauth-guide-probe-nonexistent-7f3a`;
  } catch {}
  try {
    const [real, fake] = await Promise.all([safeGet(consoleUrl), safeGet(control)]);
    const realSig = `${real.status}${describeLocation(real.location, consoleUrl)}`;
    const fakeSig = `${fake.status}${describeLocation(fake.location, control)}`;
    const differs = real.status !== fake.status || describeLocation(real.location, consoleUrl) !== describeLocation(fake.location, control);
    const realOk = real.status < 400;
    const outcome: Probe["outcome"] = differs && realOk ? "confirmed" : real.status === 404 && fake.status !== 404 ? "refuted" : "inconclusive";
    const meaning =
      outcome === "confirmed"
        ? "The console URL behaves differently from a made-up path, so the route exists."
        : outcome === "refuted"
          ? "The console URL returns 404 while other paths do not."
          : "A made-up path on the same host behaves the same way, so this does not prove the route exists.";
    return {
      data: { consoleStatus: realSig, controlStatus: fakeSig, meaning },
      probe: {
        id,
        kind: "dev-console-url",
        description: `Whether the developer console link ${consoleUrl} is real`,
        request: `GET ${consoleUrl}, compared with GET ${control}`,
        observed: `Console URL: HTTP ${realSig}. Control path: HTTP ${fakeSig}. ${meaning}`,
        outcome,
        ranAt: today(),
      },
    };
  } catch (err) {
    const msg = errorMessage(err);
    return {
      data: { error: msg },
      probe: {
        id,
        kind: "dev-console-url",
        description: `Whether the developer console link ${consoleUrl} is real`,
        request: `GET ${consoleUrl}`,
        observed: msg,
        outcome: msg.startsWith("Not probed: Could not resolve") ? "refuted" : "inconclusive",
        ranAt: today(),
      },
    };
  }
}
