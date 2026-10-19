"use client";

import { useState } from "react";

type Mode = "managed" | "byo";

const WHITE = "#ffffff";
const DIM = "rgba(255,255,255,0.45)";
const LINE = "#2c2c2c";
const RAISED = "#1e1e1e";
const BLUE = "#51a2ff";
const BRAND = "#0007cd";
const LIME = "#d4ff4a";

type Msg = { from: number; to: number; label: string; short: string; oauth?: boolean };

function messages(mode: Mode): Msg[] {
  const who = mode === "managed" ? "Composio" : "Your app";
  return [
    { from: 0, to: 1, label: "Clicks “Connect Gmail”", short: "Clicks Connect" },
    { from: 1, to: 2, label: "Requests a Connect Link for that user", short: "Gets a link" },
    { from: 0, to: 2, label: "Opens the Composio-hosted link", short: "Opens link" },
    { from: 0, to: 3, label: `Approves the consent screen: “${who} wants access”`, short: `“${who} wants access”`, oauth: true },
    { from: 3, to: 2, label: "Redirects with an auth code to the callback URL", short: "Code to callback" },
    { from: 2, to: 3, label: "Swaps the code for tokens with client ID + secret", short: "Gets tokens", oauth: true },
    { from: 2, to: 1, label: "Stores the tokens, returns the user to your app", short: "Back to your app" },
    { from: 1, to: 2, label: "Agent calls a tool for that user", short: "Calls a tool" },
    { from: 2, to: 3, label: "Runs the call with the stored token", short: "Uses the token" },
  ];
}

const actors = [
  { name: "End user", sub: "Your customer" },
  { name: "Your agent app", sub: "Built on Composio" },
  { name: "Composio", sub: "" },
  { name: "Provider", sub: "Gmail, Slack, GitHub…" },
];

function Sequence({ mode, compact }: { mode: Mode; compact: boolean }) {
  const W = compact ? 360 : 1000;
  const colW = W / 4;
  const cx = (i: number) => colW * i + colW / 2;
  const boxW = compact ? colW - 8 : 190;
  const headH = compact ? 44 : 56;
  const linkY = headH + 26;
  const appTop = compact ? headH + 12 : headH + 46;
  const appH = compact ? 50 : 54;
  const firstRow = appTop + appH + (compact ? 34 : 40);
  const rowH = compact ? 40 : 44;
  const msgs = messages(mode);
  const H = firstRow + rowH * (msgs.length - 1) + 30;
  const fs = compact ? 9.5 : 12;
  const mono = "var(--font-mono)";
  const appX = compact ? cx(3) - boxW / 2 : cx(3) - 105;
  const appW = compact ? boxW : 210;

  const motion = msgs
    .map((m, i) => {
      const y = firstRow + i * rowH;
      return `M ${cx(m.from)} ${y} L ${cx(m.to)} ${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="How an OAuth connection flows through Composio">
      <defs>
        <marker id={`arrow-${compact ? "c" : "w"}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill={WHITE} />
        </marker>
        <marker id={`arrow-o-${compact ? "c" : "w"}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L8 4 L0 8 Z" fill={BLUE} />
        </marker>
      </defs>

      {actors.map((a, i) => (
        <g key={a.name}>
          <line x1={cx(i)} x2={cx(i)} y1={headH} y2={H - 8} stroke={LINE} strokeDasharray="3 4" />
          <rect x={cx(i) - boxW / 2} y={0.5} width={boxW} height={headH} fill={i === 2 ? BRAND : RAISED} stroke={i === 2 ? BRAND : LINE} />
          <text x={cx(i)} y={compact ? 19 : 24} textAnchor="middle" fill={WHITE} fontSize={compact ? 10.5 : 15}>
            {compact ? a.name.replace("Your agent app", "Your app") : a.name}
          </text>
          <text x={cx(i)} y={compact ? 33 : 43} textAnchor="middle" fill={i === 2 ? "rgba(255,255,255,0.7)" : DIM} fontSize={compact ? 8 : 11} fontFamily={mono}>
            {i === 2 ? (mode === "managed" ? (compact ? "Its app" : "Uses its own app") : compact ? "Your keys" : "Holds your ID and secret") : compact ? a.sub.split(" ")[0] : a.sub}
          </text>
        </g>
      ))}

      <g>
        <rect x={appX} y={appTop} width={appW} height={appH} fill="#0f0f0f" stroke={BLUE} />
        <text x={appX + 10} y={appTop + (compact ? 16 : 19)} fill={BLUE} fontSize={compact ? 8.5 : 11} fontFamily={mono}>
          OAUTH APP
        </text>
        <text x={appX + 10} y={appTop + (compact ? 30 : 35)} fill={WHITE} fontSize={compact ? 9 : 12} fontFamily={mono}>
          {compact ? "id + secret" : "client_id · client_secret"}
        </text>
        <text x={appX + 10} y={appTop + (compact ? 43 : 48)} fill={mode === "managed" ? LIME : WHITE} fontSize={compact ? 8 : 10.5} fontFamily={mono}>
          {mode === "managed" ? (compact ? "COMPOSIO'S" : "OWNED BY COMPOSIO") : compact ? "YOURS" : "OWNED BY YOU"}
        </text>
      </g>

      {mode === "byo" && !compact && (
        <g>
          <path d={`M ${cx(1) + 60} ${headH} L ${cx(1) + 60} ${linkY} L ${appX + appW / 2} ${linkY} L ${appX + appW / 2} ${appTop - 2}`} fill="none" stroke={LIME} strokeDasharray="4 4" className="anim-dash" markerEnd="url(#arrow-o-w)" />
          <rect x={cx(1) + 72} y={linkY - 20} width={232} height={16} fill="#0f0f0f" />
          <text x={cx(1) + 76} y={linkY - 8} fill={LIME} fontSize={11} fontFamily={mono}>
            YOU REGISTER IT WITH THE PROVIDER
          </text>
        </g>
      )}
      {mode === "managed" && !compact && (
        <g>
          <path d={`M ${cx(2)} ${headH} L ${cx(2)} ${linkY} L ${appX + appW / 2} ${linkY} L ${appX + appW / 2} ${appTop - 2}`} fill="none" stroke={LIME} strokeDasharray="4 4" className="anim-dash" />
          <rect x={cx(2) + 10} y={linkY - 20} width={196} height={16} fill="#0f0f0f" />
          <text x={cx(2) + 14} y={linkY - 8} fill={LIME} fontSize={11} fontFamily={mono}>
            COMPOSIO ALREADY HAS ONE
          </text>
        </g>
      )}

      {msgs.map((m, i) => {
        const y = firstRow + i * rowH;
        const x1 = cx(m.from);
        const x2 = cx(m.to);
        const dir = x2 > x1 ? 1 : -1;
        const color = m.oauth ? BLUE : WHITE;
        const labelX = Math.min(x1, x2) + 8;
        return (
          <g key={i}>
            <line
              x1={x1 + dir * 4}
              x2={x2 - dir * 6}
              y1={y}
              y2={y}
              stroke={color}
              strokeWidth={m.oauth ? 1.5 : 1}
              markerEnd={`url(#${m.oauth ? "arrow-o" : "arrow"}-${compact ? "c" : "w"})`}
            />
            <circle cx={x1} cy={y} r={2.5} fill={color} />
            <text x={labelX} y={y - 7} fill={m.oauth ? BLUE : "rgba(255,255,255,0.85)"} fontSize={fs}>
              <tspan fontFamily={mono} fill={DIM}>{`0${i + 1} `}</tspan>
              {compact ? m.short : m.label}
            </text>
          </g>
        );
      })}

      <circle r={compact ? 3.5 : 4.5} fill={LIME} className="motion-dot">
        <animateMotion dur={`${msgs.length * 1.4}s`} repeatCount="indefinite" path={motion} />
      </circle>
    </svg>
  );
}

const compare: { label: string; managed: string; byo: string }[] = [
  { label: "Consent screen shows", managed: "Composio", byo: "Your app's name and logo" },
  { label: "Setup", managed: "None", byo: "Register the app, add the callback URL, paste the ID and secret" },
  { label: "Provider review", managed: "Already handled by Composio", byo: "Sometimes. These guides show how long it takes" },
  { label: "Quota", managed: "Shared", byo: "Yours" },
  { label: "Available for", managed: "Some toolkits", byo: "Any provider with OAuth" },
];

export function OAuthDiagram() {
  const [mode, setMode] = useState<Mode>("byo");
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Who owns the OAuth app" className="inline-flex border border-line-dark">
          {(
            [
              ["managed", "Composio managed auth"],
              ["byo", "Your own OAuth app"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={mode === k}
              type="button"
              onClick={() => setMode(k)}
              className={`px-3 py-2 font-mono text-[12px] uppercase transition sm:px-4 ${mode === k ? "bg-white text-ink" : "text-white/60 hover:text-white"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="font-mono text-[12px] text-white/40 uppercase">
          <span className="text-brand-light">Blue</span> steps use the OAuth app
        </p>
      </div>

      <div className="mt-6 hidden md:block">
        <Sequence mode={mode} compact={false} />
      </div>
      <div className="mt-5 md:hidden">
        <Sequence mode={mode} compact />
      </div>

      <dl className="mt-8 grid border-t border-line-dark text-[14px] sm:border-t-0">
        <div className="hidden grid-cols-[200px_1fr_1fr] gap-3 border-b border-line-dark pb-2 font-mono text-[11px] text-white/30 uppercase sm:grid">
          <span />
          <span className={mode === "managed" ? "text-lime" : ""}>Composio managed</span>
          <span className={mode === "byo" ? "text-lime" : ""}>Your own app</span>
        </div>
        {compare.map((r) => (
          <div key={r.label} className="grid grid-cols-[110px_1fr] gap-3 border-b border-line-dark py-2.5 sm:grid-cols-[200px_1fr_1fr]">
            <dt className="font-mono text-[12px] text-white/40 uppercase">{r.label}</dt>
            <dd className={`hidden sm:block ${mode === "managed" ? "text-white" : "text-white/35"}`}>{r.managed}</dd>
            <dd className={`hidden sm:block ${mode === "byo" ? "text-white" : "text-white/35"}`}>{r.byo}</dd>
            <dd className="text-white sm:hidden">{mode === "managed" ? r.managed : r.byo}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
