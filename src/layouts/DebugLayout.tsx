import { useState, useEffect } from "react";
import { DebugPanel } from "../components/DebugPanel";
import type { SavingsGoal, Cluster, IncomeBracket, AlexMode } from "../types";

// ── Exported types — imported by App.tsx and DebugPanel.tsx ───────────────

export type DebugState = {
  cluster: Cluster;
  declaredGoal: string;
  incomeBracket: IncomeBracket;
  userAge: number;
  savingsGoalCreated: boolean;
  firstTransactionCategorized: boolean;
  dismissedSuggestionCount: number;
  firstTransactionDate: string | null;
  lastActiveDate: string | null;
  savingsGoals: SavingsGoal[];
  totalMonthlyBudget: number;
  alexFlow: AlexMode;
};

export type DebugActions = {
  setCluster: (c: Cluster) => void;
  setDeclaredGoal: (g: string) => void;
  setIncomeBracket: (b: IncomeBracket) => void;
  setUserAge: (a: number) => void;
  setSavingsGoalCreated: (v: boolean) => void;
  setFirstTransactionCategorized: (v: boolean) => void;
  setDismissedCount: (n: number) => void;
  setFirstTransactionDate: (d: string | null) => void;
  setLastActiveDate: (d: string | null) => void;
  setSavingsGoals: (goals: SavingsGoal[]) => void;
  /** Trigger the progress notification banner with a given goal */
  triggerProgressNotif: (type: "A" | "B" | "C") => void;
  /** Set goals[0].currentAmount to percent% of target and show notif */
  setGoalProgress: (percent: number) => void;
  /** Simulation shortcuts */
  simulateCluster2J2: () => void;
  simulateCluster3J14: () => void;
  resetFeature: () => void;
  resetAll: () => void;
  setAlexFlow: (f: AlexMode) => void;
};

type Props = {
  children: React.ReactNode;
  debugState: DebugState;
  debugActions: DebugActions;
};

const PANEL_WIDTH = 300;
const BREAKPOINT = 768;

/**
 * Responsive debug wrapper.
 *
 * Desktop (≥768px) — two-column:
 *   [debug panel 300px | right col with iPhone frame]
 *
 * Mobile (<768px) — passthrough:
 *   existing app layout + floating 🛠 bubble + slide-up drawer
 *
 * Excluded from production automatically via import.meta.env.DEV check.
 */
export function DebugLayout({ children, debugState, debugActions }: Props) {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= BREAKPOINT);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"config" | "criteria">("config");

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= BREAKPOINT);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ── DESKTOP layout ────────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div
        style={{
          display: "flex",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* Left — debug panel */}
        <div
          style={{
            width: PANEL_WIDTH,
            minWidth: 280,
            flexShrink: 0,
            background: "#F5F5F5",
            borderRight: "1px solid #E8E8E8",
            overflowY: "auto",
            padding: "0 16px",
          }}
        >
          <DebugPanel
            state={debugState}
            actions={debugActions}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>

        {/* Right — iPhone frame */}
        <div
          className="debug-layout-right"
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#E8E8E8",
            padding: 40,
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // ── MOBILE layout — passthrough + floating bubble + drawer ────────────────
  return (
    <>
      {/* App renders full-screen, unchanged */}
      {children}

      {/* Floating bubble */}
      <button
        onClick={() => setDrawerOpen(true)}
        aria-label="Ouvrir le debug panel"
        style={{
          position: "fixed",
          top: "50%",
          transform: "translateY(-50%)",
          left: 16,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "#040707",
          border: "none",
          boxShadow: "0 4px 16px rgba(4,4,7,0.35)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          animation: "debugPulse 2s ease-in-out infinite",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9FF27" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </button>

      {/* Backdrop */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1001,
          }}
        />
      )}

      {/* Slide-up drawer */}
      {drawerOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#F5F5F5",
            borderRadius: "20px 20px 0 0",
            border: "1px solid #E8E8E8",
            borderBottom: "none",
            padding: "0 16px 40px",
            maxHeight: "80vh",
            overflowY: "auto",
            zIndex: 1002,
            animation: "debugSlideUp 300ms ease-out",
          }}
        >
          {/* Drag handle (outside sticky context, always at top) */}
          <div style={{ width: 36, height: 4, background: "#FFE8EC", borderRadius: 2, margin: "12px auto 4px" }} />
          <DebugPanel
            state={debugState}
            actions={debugActions}
            onClose={() => setDrawerOpen(false)}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
      )}
    </>
  );
}
