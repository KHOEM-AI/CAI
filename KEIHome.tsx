import { useState } from "react";
// @ts-ignore — plain ES module, no type declarations
import { KEI_UI, PROJECTS } from "./kei_registry.mjs";

type Action = { id: string; label: string; sub: string };

const GREEN = "#22e07a";
const BG = "#050a08";
const PANEL = "#0d1512";

const btn: React.CSSProperties = {
  background: PANEL,
  border: "1px solid #1c2a24",
  borderRadius: 16,
  color: "#fff",
  padding: "14px 16px",
  textAlign: "left",
  cursor: "pointer",
};

export default function KEIHome({ onAction }: { onAction?: (id: string) => void }) {
  const [tab, setTab] = useState<string>(KEI_UI.tabs[0]);
  const [nav, setNav] = useState<string>("Home");
  const fire = (id: string) => onAction?.(id);
  const [primary, ...secondary]: Action[] = KEI_UI.actions;

  return (
    <div style={{ background: BG, color: "#fff", minHeight: "100vh", maxWidth: 480, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>
          KHOEM<span style={{ color: GREEN }}>-AI</span>
        </div>
        <div style={{ color: "#8a9a92", fontSize: 14 }}>{KEI_UI.tagline}</div>
      </header>

      <div role="tablist" style={{ display: "flex", background: PANEL, borderRadius: 16, padding: 4, marginBottom: 14 }}>
        {KEI_UI.tabs.map((t: string) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            style={{ flex: 1, padding: 12, borderRadius: 12, border: 0, cursor: "pointer",
              background: tab === t ? "#12392a" : "transparent", color: tab === t ? GREEN : "#b8c4be", fontWeight: 600 }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {KEI_UI.features.map((f: string) => (
          <span key={f} style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid #1c2a24", fontSize: 13, color: "#cfe" }}>{f}</span>
        ))}
      </div>

      <button onClick={() => fire(primary.id)}
        style={{ ...btn, width: "100%", background: "linear-gradient(135deg,#0f7a45,#22e07a)", color: "#04120a", fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
        {primary.label}
        <div style={{ fontSize: 13, fontWeight: 500, opacity: 0.8 }}>{primary.sub}</div>
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        {secondary.map((a) => (
          <button key={a.id} onClick={() => fire(a.id)} style={btn}>
            <strong>{a.label}</strong>
            <div style={{ fontSize: 12, color: "#8a9a92" }}>{a.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {KEI_UI.cards.map((c: Action) => (
          <button key={c.id} onClick={() => fire(c.id)} style={btn}>
            <strong>{c.label}</strong>
            <div style={{ fontSize: 12, color: "#8a9a92" }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <details style={{ marginBottom: 80, color: "#8a9a92", fontSize: 13 }}>
        <summary>Projects</summary>
        <ul>
          {PROJECTS.map((p: { id: string; role: string }) => (
            <li key={p.id}><b style={{ color: "#fff" }}>{p.id}</b> — {p.role}</li>
          ))}
        </ul>
      </details>

      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, maxWidth: 480, margin: "0 auto", display: "flex", background: PANEL, borderTop: "1px solid #1c2a24" }}>
        {KEI_UI.nav.map((n: string) => (
          <button key={n} onClick={() => setNav(n)}
            style={{ flex: 1, padding: "14px 0", background: "transparent", border: 0, color: nav === n ? GREEN : "#8a9a92", cursor: "pointer" }}>
            {n}
          </button>
        ))}
      </nav>
    </div>
  );
}
