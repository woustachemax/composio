import type { GenerationEvent } from "@/lib/generate/events";

export type Status = "idle" | "running" | "done" | "unsupported" | "error";

export type Snapshot = {
  status: Status;
  events: GenerationEvent[];
  final: GenerationEvent | null;
  startedAt: number | null;
  endedAt: number | null;
};

const idle: Snapshot = { status: "idle", events: [], final: null, startedAt: null, endedAt: null };

export function createGenerationStore(onDone: (slug: string) => void) {
  let snapshot = idle;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();

  const set = (next: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...next };
    for (const l of listeners) l();
  };

  const end = (status: Status, final: GenerationEvent) => set({ status, final, endedAt: Date.now() });

  async function start(target: string, force = false) {
    controller?.abort();
    const current = new AbortController();
    controller = current;
    set({ status: "running", events: [], final: null, startedAt: Date.now(), endedAt: null });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ app: target, force }),
        signal: current.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        return end("error", {
          type: "error",
          message: data.error ?? `Request failed (${res.status})`,
          code: data.code === "rate_limited" || data.code === "invalid_input" ? data.code : undefined,
          retryAfter: typeof data.retryAfter === "number" ? data.retryAfter : undefined,
        });
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (controller !== current) return;
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as GenerationEvent;
          if (event.type === "done") {
            end("done", event);
            onDone(event.slug);
            return;
          }
          if (event.type === "unsupported") return end("unsupported", event);
          if (event.type === "error") return end("error", event);
          set({ events: [...snapshot.events, event] });
        }
      }
      end("error", { type: "error", message: "The connection closed before the guide was finished. Try again." });
    } catch (err) {
      if (current.signal.aborted) return;
      end("error", { type: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  return {
    start,
    abort: () => controller?.abort(),
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => idle,
  };
}
