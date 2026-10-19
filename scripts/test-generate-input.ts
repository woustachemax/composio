import assert from "node:assert/strict";
import { validateAppInput } from "../src/lib/app-input";
import { RUNS_PER_HOUR, takeRun } from "../src/lib/rate-limit";

assert.deepEqual(validateAppInput("  Notion  "), { ok: true, value: "Notion" });
assert.deepEqual(validateAppInput("Google   Calendar"), { ok: true, value: "Google Calendar" });
assert.equal(validateAppInput("").ok, false);
assert.equal(validateAppInput("   ").ok, false);
assert.equal(validateAppInput(42).ok, false);
assert.equal(validateAppInput("<script>alert(1)</script>").ok, false);
assert.equal(validateAppInput("a > b").ok, false);
assert.equal(validateAppInput("x".repeat(80)).ok, true);
assert.equal(validateAppInput("x".repeat(81)).ok, false);

const t0 = 1_000_000;
for (let i = 0; i < RUNS_PER_HOUR; i++) assert.equal(takeRun("1.2.3.4", t0 + i).ok, true);
const blocked = takeRun("1.2.3.4", t0 + 10);
assert.equal(blocked.ok, false);
if (!blocked.ok) assert.ok(blocked.retryAfter > 3500 && blocked.retryAfter <= 3600);
assert.equal(takeRun("5.6.7.8", t0 + 10).ok, true);
assert.equal(takeRun("1.2.3.4", t0 + 60 * 60 * 1000 + 1).ok, true);

console.log("input and rate limit tests passed");
