import { useState } from "react";
import { Settings, ListChecks, Wrench, RotateCcw, Zap, Bell, X, Trash2 } from "lucide-react";
import { DebugToggle } from "./DebugToggle";
import { DebugToast } from "./DebugToast";
import { ValidationPanel } from "./ValidationPanel";
import type { DebugState, DebugActions } from "../layouts/DebugLayout";

// ── App design tokens (mirrors App.tsx C object) ──────────────────────────
const BLU   = "#0404E2";   // secondary / link
const LIME  = "#C9FF27";   // primary
const DARK  = "#040707";
const TEXT2 = "#7A7A7A";
const BDR   = "#E8E8E8";
const SURF  = "#FFFFFF";
const SUCC  = "#00B14F";
const DNGR  = "#EF4444";

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  borderRadius: 9,
  border: `1px solid ${BDR}`,
  padding: "0 10px",
  fontSize: 12,
  color: DARK,
  background: SURF,
  outline: "none",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%237A7A7A'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 26,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 9,
      fontWeight: 800,
      color: BLU,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: BDR, margin: "14px 0" }} />;
}

function ActionBtn({
  label, icon: Icon, color = BLU, outline = false, onClick,
}: {
  label: string;
  icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color?: string;
  outline?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        height: 36,
        borderRadius: 8,
        border: outline ? `1.5px solid ${color}` : "none",
        background: outline ? "transparent" : color,
        color: outline ? color : (color === LIME ? DARK : "#FFFFFF"),
        fontSize: 11,
        fontWeight: 600,
        cursor: "pointer",
        marginBottom: 6,
        display: "flex",
        alignItems: "center",
        gap: 7,
        paddingLeft: 12,
      }}
    >
      {Icon && <Icon size={13} strokeWidth={2} color={outline ? color : (color === LIME ? DARK : "#FFFFFF")} />}
      {label}
    </button>
  );
}

type Tab = "config" | "criteria";

type Props = {
  state: DebugState;
  actions: DebugActions;
  onClose?: () => void;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
};

export function DebugPanel({ state, actions, onClose, activeTab, onTabChange }: Props) {
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(null);
    requestAnimationFrame(() => setToast(msg));
  };

  // ── Simulation helpers ───────────────────────────────────────────────────
  const simCluster2  = () => { actions.simulateCluster2J2();     showToast("cluster_2 J+2 simulé"); };
  const simCluster3  = () => { actions.simulateCluster3J14();    showToast("cluster_3 J+14 simulé"); };
  const simNotif     = () => { actions.triggerProgressNotif("A"); showToast("Notification déclenchée"); };
  const sim90        = () => { actions.setGoalProgress(90);      showToast("Objectif à 90% simulé"); };
  const sim100       = () => { actions.setGoalProgress(100);     showToast("Objectif atteint simulé"); };
  const resetFeature = () => { actions.resetFeature();           showToast("Feature réinitialisée"); };
  const resetAll     = () => { actions.resetAll();               showToast("État complet réinitialisé"); };

  // ── State preview ────────────────────────────────────────────────────────
  const stateRows: [string, unknown][] = [
    ["cluster",                   state.cluster],
    ["declaredGoal",              state.declaredGoal],
    ["incomeBracket",             state.incomeBracket],
    ["userAge",                   state.userAge],
    ["savingsGoalCreated",        state.savingsGoalCreated],
    ["firstTxCategorized",        state.firstTransactionCategorized],
    ["dismissedCount",            state.dismissedSuggestionCount],
    ["firstTransactionDate",      state.firstTransactionDate ?? "null"],
    ["lastActiveDate",            state.lastActiveDate ?? "null"],
    ["savingsGoals.length",       state.savingsGoals.length],
    ["totalMonthlyBudget",        state.totalMonthlyBudget],
  ];

  const valueColor = (v: unknown) => {
    if (v === true)  return SUCC;
    if (v === false) return DNGR;
    return "#C9FF27";
  };

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* ── Sticky header + tab bar ── */}
      <div style={{
        position: "sticky",
        top: 0,
        background: "#F5F5F5",
        zIndex: 20,
        paddingTop: 16,
      }}>
        {/* Title row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          paddingBottom: 12,
          borderBottom: `1px solid ${BDR}`,
        }}>
          <Wrench size={15} color={DARK} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 700, color: DARK, flex: 1 }}>Debug Panel</span>
          <span style={{
            fontSize: 9, fontWeight: 800, color: DARK,
            background: LIME, padding: "2px 7px", borderRadius: 100,
            letterSpacing: "0.04em",
          }}>
            DEV ONLY
          </span>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT2, padding: "0 0 0 4px", display: "flex", alignItems: "center" }}
              aria-label="Fermer"
            >
              <X size={16} color={TEXT2} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, padding: "10px 0 0", marginBottom: 14 }}>
          {(["config", "criteria"] as Tab[]).map((tab) => {
            const isActive = activeTab === tab;
            const Icon = tab === "config" ? Settings : ListChecks;
            const label = tab === "config" ? "Config" : "Critères";
            return (
              <button
                key={tab}
                onClick={() => onTabChange(tab)}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 8,
                  border: isActive ? "none" : `1px solid ${BDR}`,
                  background: isActive ? DARK : SURF,
                  color: isActive ? LIME : TEXT2,
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <Icon size={12} strokeWidth={isActive ? 2.5 : 1.8} color={isActive ? LIME : TEXT2} />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      {activeTab === "criteria" ? (
        <ValidationPanel />
      ) : (
        <>
          {/* ── Section 0 : Flow Alex ── */}
          <SectionTitle>🤖 Flow Alex à tester</SectionTitle>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
            {([
              { flow: "cluster2",         label: "Client non-identifié",          sub: "cluster_2 · profil complet (prénom → âge → revenus → projets…)" },
              { flow: "cluster3_actif",   label: "Client identifié",              sub: "cluster_3 · suggestion pré-remplie 9 mois / 278 €/mois" },
              { flow: "cluster3_passif",  label: "Client identifié passif",       sub: "cluster_3 passif · projection 150 €/mois → 1 800 € en 12 mois" },
            ] as const).map(({ flow, label, sub }) => {
              const isActive = state.alexFlow === flow;
              return (
                <button
                  key={flow}
                  onClick={() => actions.setAlexFlow(flow)}
                  style={{
                    textAlign: "left",
                    padding: "9px 11px",
                    borderRadius: 10,
                    border: `2px solid ${isActive ? BLU : BDR}`,
                    background: isActive ? "#CECEFF" : SURF,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? BLU : DARK }}>{label}</div>
                  <div style={{ fontSize: 10, color: TEXT2, marginTop: 2 }}>{sub}</div>
                </button>
              );
            })}
          </div>

          <Divider />

          {/* ── Section 1 : Profil utilisateur ── */}
          <SectionTitle>① Profil utilisateur</SectionTitle>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: TEXT2, display: "block", marginBottom: 4 }}>Cluster actif</label>
            <select
              value={state.cluster}
              onChange={(e) => actions.setCluster(e.target.value as "cluster_2" | "cluster_3")}
              style={selectStyle}
            >
              <option value="cluster_2">cluster_2 — Épargnants Passifs</option>
              <option value="cluster_3">cluster_3 — Inactifs</option>
            </select>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: TEXT2, display: "block", marginBottom: 4 }}>Declared Goal</label>
            <select
              value={state.declaredGoal}
              onChange={(e) => actions.setDeclaredGoal(e.target.value)}
              style={selectStyle}
            >
              {["voyage", "voiture", "immobilier", "urgence", "formation"].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 4 }}>
            <div>
              <label style={{ fontSize: 11, color: TEXT2, display: "block", marginBottom: 4 }}>Income Bracket</label>
              <select
                value={state.incomeBracket}
                onChange={(e) => actions.setIncomeBracket(e.target.value as "low" | "medium" | "high")}
                style={selectStyle}
              >
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: TEXT2, display: "block", marginBottom: 4 }}>Âge</label>
              <input
                type="number"
                min={18}
                max={99}
                value={state.userAge}
                onChange={(e) => actions.setUserAge(Number(e.target.value))}
                style={inputStyle}
              />
            </div>
          </div>

          <Divider />

          {/* ── Section 2 : État de la feature ── */}
          <SectionTitle>② État de la feature</SectionTitle>

          <DebugToggle
            label="savingsGoalCreated"
            checked={state.savingsGoalCreated}
            onChange={actions.setSavingsGoalCreated}
          />
          <DebugToggle
            label="firstTransactionCategorized"
            checked={state.firstTransactionCategorized}
            onChange={actions.setFirstTransactionCategorized}
          />

          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 11, color: TEXT2, display: "block", marginBottom: 4 }}>dismissedSuggestionCount</label>
            <input
              type="number"
              min={0}
              max={10}
              value={state.dismissedSuggestionCount}
              onChange={(e) => actions.setDismissedCount(Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          <Divider />

          {/* ── Section 3 : Simulation temporelle ── */}
          <SectionTitle>③ Simulation temporelle</SectionTitle>

          <ActionBtn label="Simuler cluster_2 J+2"   icon={Zap}  color={BLU}  onClick={simCluster2} />
          <ActionBtn label="Simuler cluster_3 J+14"  icon={Zap}  color={BLU}  onClick={simCluster3} />
          <ActionBtn label="Notif progression"        icon={Bell} color={BLU}  onClick={simNotif} />
          <ActionBtn label="Objectif à 90%"           icon={Zap}  color={SUCC} onClick={sim90} />
          <ActionBtn label="Objectif atteint"         icon={Zap}  color={SUCC} onClick={sim100} />

          <Divider />

          {/* ── Section 4 : Reset ── */}
          <SectionTitle>④ Reset</SectionTitle>

          <ActionBtn label="Reset feature"   icon={RotateCcw} color={DNGR} outline onClick={resetFeature} />
          <ActionBtn label="Reset complet"   icon={Trash2}    color={DNGR}         onClick={resetAll} />

          <Divider />

          {/* ── State preview ── */}
          <div style={{ background: DARK, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 9, fontWeight: 800, color: LIME, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
              État actuel
            </div>
            {stateRows.map(([key, val]) => (
              <div key={key} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#888" }}>{key}</span>
                <span style={{ fontSize: 10, color: valueColor(val), fontWeight: 600, fontFamily: "monospace" }}>
                  {String(val)}
                </span>
              </div>
            ))}
          </div>

          <div style={{ height: 20 }} />
        </>
      )}

      {/* Toast */}
      <DebugToast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
