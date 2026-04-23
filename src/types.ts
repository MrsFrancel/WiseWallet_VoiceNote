// ── Shared types — WiseWallet V3 ─────────────────────────────────────────

export type Screen =
  | "welcome" | "signup" | "home" | "transactions" | "txDetail"
  | "goals" | "goalStep1" | "goalStep2" | "goalStep3" | "goalCreated"
  | "goalDetail" | "analysis" | "notifications" | "profile"
  // V3 new screens
  | "aiGoalSuggestion" | "aiGoalEnrichment" | "addMoreProjects"
  | "reactivationEmail" | "reactivationQuiz" | "allocationPlan";

export type IncomeBracket = "low" | "medium" | "high";
export type Cluster = "cluster_2" | "cluster_3";

export type SavingsGoal = {
  id: string;
  name: string;
  emoji: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  monthlyAmount: number;
  targetDate: string;
  createdAt: string;
  priority: number;
};

export type UserState = {
  cluster: Cluster;
  savingsGoalCreated: boolean;
  goalsCount: number;
  goals: SavingsGoal[];
  totalMonthlyBudget: number;
  declaredGoal: string;
  incomeBracket: IncomeBracket;
  age: number;
  firstTransactionCategorized: boolean;
  firstTransactionDate: string | null;
  lastActiveDate: string | null;
  dismissedSuggestionCount: number;
  reactivationEmailSent: boolean;
};

declare global {
  interface Window {
    voiceflow?: {
      chat: {
        load: (config: Record<string, unknown>) => void;
        open: () => void;
        close: () => void;
        hide: () => void;
        show: () => void;
        interact: (event: Record<string, unknown>) => void;
      };
    };
  }
}

// Design tokens — V3 (primary palette)
export const DT = {
  primary:      "#6C63FF",
  primaryLight: "#F0EEFF",
  bg:           "#F8F9FF",
  surface:      "#FFFFFF",
  border:       "#E8E8F0",
  text:         "#1A1A2E",
  text2:        "#6B6B8A",
  success:      "#00C896",
  successLight: "#E6FAF5",
  danger:       "#FF4D6D",
  dangerLight:  "#FFF0F3",
  cardShadow:   "0 2px 16px rgba(0,0,0,0.08)",
  r: { card: 20, button: 14, pill: 100 },
} as const;
