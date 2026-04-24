import { useState, useMemo, useEffect, useRef, useCallback } from "react";
// ── Debug layout (dev only) ────────────────────────────────────────────────
import { DebugLayout } from "../layouts/DebugLayout";
import type { DebugState, DebugActions } from "../layouts/DebugLayout";
// ── V3 screens & components ───────────────────────────────────────────────
import { AIGoalSuggestionModal } from "../screens/AIGoalSuggestionModal";
import { AlexChat } from "../screens/AlexChat";
import { AIGoalEnrichment } from "../screens/AIGoalEnrichment";
import { AddMoreProjects } from "../screens/AddMoreProjects";
import { ReactivationEmail } from "../screens/ReactivationEmail";
import { ReactivationQuiz, type QuizResult } from "../screens/ReactivationQuiz";
import { AllocationPlan } from "../screens/AllocationPlan";
import { V3GoalDetail } from "../screens/V3GoalDetail";
import { GoalCardV3 } from "../components/GoalCardV3";
import { ProgressNotificationBanner } from "../components/ProgressNotificationBanner";
import type { SavingsGoal, UserState, IncomeBracket, Cluster, AlexMode } from "../types";
import { buildPrefillGoal, matchTemplate, GOAL_TILES } from "../constants/goalTemplates";
import { allocateBudget, fmtAmount as fmtAmt, pct as calcPct } from "../utils/goalCalculations";
import confetti from "canvas-confetti";
import {
  ArrowLeft, Bell, ArrowUpRight, ArrowDownLeft, Target, MoreHorizontal,
  Home, Receipt, BarChart3, User, ChevronRight, ChevronDown, Plus,
  Eye, EyeOff, Pencil, Delete, LogOut, PieChart, Check, Sparkles, Bot,
  ShoppingCart, Film, Banknote, Car, Pill, ShoppingBag,
  Plane, Building, Zap, GraduationCap, Star, Trophy, Archive,
} from "lucide-react";

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

type Screen =
  | "welcome" | "signup" | "home" | "transactions" | "txDetail"
  | "goals" | "goalStep1" | "goalStep2" | "goalStep3" | "goalCreated"
  | "goalDetail" | "analysis" | "notifications" | "profile"
  // V3 screens
  | "aiGoalSuggestion" | "aiGoalEnrichment" | "addMoreProjects"
  | "reactivationEmail" | "reactivationQuiz" | "allocationPlan"
  // Alex real agent
  | "alexChat";

const C = {
  bg:           "#F5F5F5",
  surface:      "#FFFFFF",
  card:         "#FFFFFF",
  primary:      "#C9FF27",
  primarySoft:  "#F0FFAA",
  primaryDark:  "#C9FF27",
  onPrimary:    "#040707",
  link:         "#0404E2",
  linkSoft:     "#CECEFF",
  secondary:    "#0404E2",
  text:         "#040707",
  text2:        "#7A7A7A",
  danger:       "#EF4444",
  dangerSoft:   "#FFF5F5",
  success:      "#00B14F",
  successSoft:  "#E6F7EE",
  border:       "#E8E8E8",
  borderStrong: "#BEBEBE",
  dark:         "#040707",
};

const SHADOW = "inset 0 0 0 1px #E8E8E8";
const SHADOW_LG = "0 8px 32px rgba(0,0,0,0.08)";

// ── V2 design tokens (cluster_2 / Épargnants Passifs feature) ──
const V2C = {
  primary:      "#6C63FF",
  primaryLight: "#F0EEFF",
  bg:           "#F8F9FF",
  text:         "#1A1A2E",
  text2:        "#6B6B8A",
  border:       "#E8E8F0",
};

// ── Goal suggestion type ──
type GoalSuggestion = {
  emoji: string;
  name: string;
  amount: number;
  icon: LucideIcon;
};

const GOAL_TEMPLATES: Record<string, GoalSuggestion[]> = {
  "Alimentation": [
    { emoji: "🏖️", name: "Fonds d'urgence alimentaire", amount: 500,   icon: Archive },
    { emoji: "🎉", name: "Budget sorties resto",         amount: 200,   icon: Star },
  ],
  "Transport": [
    { emoji: "🚗", name: "Achat voiture", amount: 5000,  icon: Car },
    { emoji: "✈️", name: "Voyage",        amount: 1500,  icon: Plane },
  ],
  "Loisirs": [
    { emoji: "🎬", name: "Budget loisirs mensuel", amount: 150,  icon: Film },
    { emoji: "🏖️", name: "Voyage",                 amount: 2000, icon: Plane },
  ],
  "Santé": [
    { emoji: "💊", name: "Fonds santé", amount: 1000, icon: Pill },
    { emoji: "🧘", name: "Bien-être",   amount: 500,  icon: Star },
  ],
  "Shopping": [
    { emoji: "👗", name: "Budget shopping", amount: 300, icon: ShoppingBag },
    { emoji: "🏠", name: "Déco maison",     amount: 800, icon: Building },
  ],
  "Logement": [
    { emoji: "🏠", name: "Apport immobilier", amount: 20000, icon: Building },
    { emoji: "🛋️", name: "Travaux",           amount: 5000,  icon: Building },
  ],
};

const DEFAULT_GOALS: GoalSuggestion[] = [
  { emoji: "🎯", name: "Mon objectif", amount: 1000, icon: Target },
  { emoji: "🏖️", name: "Voyage",       amount: 1500, icon: Plane },
];

function getAgeSuggestion(age: number): GoalSuggestion {
  if (age < 25) return { emoji: "🎓", name: "Formation",          amount: 2000,  icon: GraduationCap };
  if (age < 35) return { emoji: "🏠", name: "Apport immobilier",  amount: 20000, icon: Building };
  if (age < 45) return { emoji: "📈", name: "Épargne retraite",   amount: 10000, icon: Trophy };
  return          { emoji: "👨‍👩‍👧", name: "Études enfants",     amount: 15000, icon: GraduationCap };
}

function getSuggestions(category: string, age: number): GoalSuggestion[] {
  const base = GOAL_TEMPLATES[category] ?? DEFAULT_GOALS;
  return [...base, getAgeSuggestion(age)].slice(0, 3);
}

const ICON = 22;
const STROKE = 1.5;

type Goal = {
  id: string;
  name: string;
  icon: LucideIcon;
  category: string;
  amount: number;
  saved: number;
  durationMonths: number;
  targetDate: string;
};

type Tx = {
  id: string; merchant: string; cat: string; icon: LucideIcon; color: string;
  amount: number; date: string; dateLabel: string; location?: string;
};

const TXS: Tx[] = [
  { id: "t1", merchant: "Carrefour City", cat: "Alimentation", icon: ShoppingCart, color: "#FF8A3D", amount: -23.4, date: "Aujourd'hui · 14h32", dateLabel: "Aujourd'hui", location: "Paris, France" },
  { id: "t2", merchant: "Netflix", cat: "Loisirs", icon: Film, color: "#E53E5A", amount: -13.99, date: "Aujourd'hui · 09h12", dateLabel: "Aujourd'hui" },
  { id: "t3", merchant: "Virement reçu", cat: "Virement", icon: Banknote, color: "#00C896", amount: 500, date: "Aujourd'hui · 08h00", dateLabel: "Aujourd'hui" },
  { id: "t4", merchant: "Uber", cat: "Transport", icon: Car, color: "#0404E2", amount: -12.5, date: "Hier · 19h45", dateLabel: "Hier" },
  { id: "t5", merchant: "Pharmacie", cat: "Santé", icon: Pill, color: "#00C896", amount: -8.9, date: "Hier · 11h22", dateLabel: "Hier" },
  { id: "t6", merchant: "Zara", cat: "Shopping", icon: ShoppingBag, color: "#F2C94C", amount: -79.9, date: "18 avril · 16h10", dateLabel: "18 avril" },
  { id: "t7", merchant: "Salaire", cat: "Virement", icon: Banknote, color: "#00C896", amount: 1600, date: "15 avril · 09h00", dateLabel: "15 avril" },
  { id: "t8", merchant: "Spotify", cat: "Loisirs", icon: Film, color: "#E53E5A", amount: -9.99, date: "14 avril · 07h30", dateLabel: "14 avril" },
];

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function useCountUp(target: number, duration = 1200, active = true) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(ease * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration, active]);
  return value;
}

// ── Audio ─────────────────────────────────────────────────────────────────
let _ac: AudioContext | null = null;
function ac(): AudioContext {
  if (!_ac) _ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (_ac.state === "suspended") _ac.resume();
  return _ac;
}

/** Son de clic court et discret (fintech moderne) */
function playClick() {
  try {
    const c = ac();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.connect(g); g.connect(c.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(820, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(460, c.currentTime + 0.07);
    g.gain.setValueAtTime(0.28, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
    osc.start(c.currentTime); osc.stop(c.currentTime + 0.08);
  } catch (_) { /* navigateur sans AudioContext */ }
}

/** Son de pièces : arpège ascendant Do majeur (célébration objectif) */
function playCoins() {
  try {
    const c = ac();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g); g.connect(c.destination);
      osc.type = "triangle";
      const t = c.currentTime + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.start(t); osc.stop(t + 0.65);
    });
  } catch (_) { /* silencieux si non supporté */ }
}

// ── Primitives ────────────────────────────────────────────────────────────
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-6 pt-3 pb-1" style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>
      <span>9:41</span>
      <div className="flex items-center gap-1" style={{ fontSize: 12 }}>
        <span>••••</span><span>•••</span><span>100%</span>
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => { if (!disabled) { playClick(); onClick?.(); } }}
      disabled={disabled}
      className="w-full h-[52px] rounded-full transition-all active:scale-[0.98]"
      style={{
        background: disabled ? "#E8E8E8" : C.primary,
        color: disabled ? C.text2 : C.onPrimary,
        fontWeight: 600,
        fontSize: 15,
      }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={() => { playClick(); onClick?.(); }}
      className="w-full h-[52px] rounded-full transition-all active:scale-[0.98]"
      style={{ background: "transparent", color: C.text, fontWeight: 600, fontSize: 15, border: `2px solid ${C.text}` }}
    >
      {children}
    </button>
  );
}

function IconBtn({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick?: () => void; ariaLabel?: string }) {
  return (
    <button onClick={() => { playClick(); onClick?.(); }} aria-label={ariaLabel} className="w-11 h-11 rounded-full flex items-center justify-center transition active:scale-95" style={{ background: C.surface, boxShadow: SHADOW }}>
      {children}
    </button>
  );
}

function Header({ title, onBack, right, large }: { title: string; onBack?: () => void; right?: React.ReactNode; large?: boolean }) {
  return (
    <div className="flex items-center justify-between px-6 pt-2 pb-4">
      <div className="w-9">
        {onBack && (
          <IconBtn onClick={onBack} ariaLabel="Retour"><ArrowLeft size={ICON} strokeWidth={STROKE} color={C.text} fill="none" /></IconBtn>
        )}
      </div>
      <div style={{ color: C.text, fontWeight: large ? 700 : 600, fontSize: large ? 28 : 22, fontFamily: "Brunson, sans-serif" }} className={large ? "flex-1" : "flex-1 text-center"}>
        {title}
      </div>
      <div className="w-auto min-w-9 flex justify-end">{right}</div>
    </div>
  );
}

const TABS: { key: Screen; label: string; icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }> }[] = [
  { key: "home", label: "Accueil", icon: Home },
  { key: "transactions", label: "Transactions", icon: Receipt },
  { key: "goals", label: "Objectifs", icon: Target },
  { key: "analysis", label: "Analyse", icon: PieChart },
  { key: "profile", label: "Profil", icon: User },
];

function BottomNav({ active, go }: { active: Screen; go: (s: Screen) => void }) {
  return (
    <nav
      aria-label="Navigation principale"
      className="absolute bottom-0 left-0 right-0"
      style={{ height: 80 + 34, background: C.surface, borderTop: `1px solid ${C.border}`, paddingBottom: 34 }}
    >
      <div className="flex items-center justify-around h-[80px] px-2">
        {TABS.map((t) => {
          const isActive =
            active === t.key ||
            (t.key === "goals" && (active === "goalDetail" || active === "goalStep1" || active === "goalStep2" || active === "goalStep3" || active === "goalCreated"));
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => { playClick(); go(t.key); }} aria-label={t.label} aria-current={isActive ? "page" : undefined} className="flex flex-col items-center gap-1 flex-1 transition active:scale-95">
              <div style={{ width: 48, height: 30, borderRadius: 15, background: isActive ? C.primary : "transparent", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }}>
                <Icon size={20} color={isActive ? C.onPrimary : C.text2} strokeWidth={isActive ? 2 : STROKE} fill="none" />
              </div>
              <span aria-hidden="true" style={{ color: isActive ? C.dark : C.text2, fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function ScreenBody({ children, pad = true }: { children: React.ReactNode; pad?: boolean }) {
  return <div className={`flex-1 overflow-y-auto ${pad ? "pb-[140px]" : ""}`}>{children}</div>;
}

function TxRow({ t, onClick }: { t: Tx; onClick?: () => void }) {
  const positive = t.amount > 0;
  const TxIcon = t.icon;
  const amountLabel = `${positive ? "Crédit" : "Débit"} : ${Math.abs(t.amount).toFixed(2).replace(".", ",")}€`;
  return (
    <button onClick={() => { playClick(); onClick?.(); }} aria-label={`${t.merchant}, ${t.cat}, ${amountLabel}`} className="w-full flex items-center gap-3 py-3 transition active:scale-[0.99]">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" aria-hidden="true" style={{ background: t.color }}>
        <TxIcon size={18} color="#fff" strokeWidth={STROKE} fill="none" />
      </div>
      <div className="flex-1 text-left">
        <div style={{ color: C.text, fontSize: 15, fontWeight: 500 }}>{t.merchant}</div>
        <div style={{ color: C.text2, fontSize: 12 }}>{t.cat}</div>
      </div>
      <div aria-hidden="true" style={{ color: positive ? C.success : C.danger, fontSize: 15, fontWeight: 600 }}>
        {positive ? "+" : ""}{t.amount.toFixed(2).replace(".", ",")}€
      </div>
    </button>
  );
}

// Brand icons for social login
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Google">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function AppleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#040707" role="img" aria-label="Apple">
      <path d="M17.05 12.536c-.03-2.94 2.4-4.348 2.51-4.418-1.36-1.99-3.48-2.26-4.24-2.29-1.8-.18-3.52 1.06-4.44 1.06-.92 0-2.34-1.03-3.84-1-1.98.03-3.8 1.15-4.82 2.92-2.05 3.56-.52 8.82 1.48 11.71.98 1.41 2.14 3 3.66 2.94 1.47-.06 2.03-.95 3.81-.95 1.78 0 2.28.95 3.84.92 1.58-.03 2.59-1.44 3.56-2.86 1.12-1.64 1.58-3.23 1.61-3.31-.04-.02-3.09-1.18-3.13-4.72zM14.5 4.09c.81-.98 1.36-2.34 1.21-3.69-1.17.05-2.59.78-3.43 1.75-.75.86-1.41 2.24-1.24 3.56 1.31.1 2.64-.65 3.46-1.62z"/>
    </svg>
  );
}

// Category map
const CATEGORIES: { icon: LucideIcon; l: string }[] = [
  { icon: Plane, l: "Voyage" }, { icon: Car, l: "Voiture" }, { icon: Building, l: "Immobilier" },
  { icon: Zap, l: "Urgence" }, { icon: GraduationCap, l: "Formation" }, { icon: Star, l: "Autre" },
];

// ── WiseLogo SVG ──────────────────────────────────────────────────────────
function WiseLogo({ size = 64 }: { size?: number }) {
  const h = Math.round(size * 68.5 / 92.43);
  return (
    <svg width={size} height={h} viewBox="0 0 92.43 68.5" xmlns="http://www.w3.org/2000/svg">
      <path fill="#040707" d="M16.7,58.85C10.56,48.05,5.73,37.8.87,26.93c-3.21-7.18,2.98-14.66,9.51-16.26,7.48-1.83,14.38,2.24,16.75,10.83l8.02-15.87C38.16-.31,46.21-1.25,51.68,1.41c5.12,2.48,9.77,9.2,6.85,15.72-6.31,14.11-12.53,27.53-19.75,41.42-3.84,7.39-17.74,7.93-22.08.3Z"/>
      <path fill="#C9FF27" d="M91.53,21.3c-4.34,9.71-8.63,19.08-13.24,28.5l-.09.18c-2.07,4.22-4.2,8.46-6.42,12.74-.02.04-.04.08-.07.12l-.03.06c-.14.25-.29.49-.45.73-2.15,3.14-6.26,4.81-10.42,4.87-1.98-.08-3.95-.56-5.66-1.39-5.11-2.48-9.76-9.2-6.85-15.71,4.34-9.7,8.63-19.08,13.24-28.5h.01s6.58-13.04,6.58-13.04c.01-.02.02-.04.03-.06.15-.27.31-.54.49-.79,2.21-3.49,6.32-5,10.38-4.81,1.98.08,3.94.56,5.65,1.39,5.11,2.48,9.77,9.2,6.85,15.71Z"/>
    </svg>
  );
}

// ---------- screens ----------
// ── Coin SVG (design system : lime #C9FF27 / dark #040707) ──
function CoinSVG({ size = 64, dark = false }: { size?: number; dark?: boolean }) {
  const bg = dark ? C.dark    : C.primary;
  const fg = dark ? C.primary : C.dark;
  // Logo centré dans la pièce (92.43×68.5 → ~40×30px dans un cercle de 64)
  const scale = 0.43;
  const lw = 92.43 * scale, lh = 68.5 * scale;
  const tx = (64 - lw) / 2, ty = (64 - lh) / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <circle cx="32" cy="32" r="30" fill={bg} />
      <circle cx="32" cy="32" r="30" stroke={fg} strokeWidth="2.5" fill="none" />
      <g transform={`translate(${tx.toFixed(1)},${ty.toFixed(1)}) scale(${scale})`}>
        <path fill={fg} d="M16.7,58.85C10.56,48.05,5.73,37.8.87,26.93c-3.21-7.18,2.98-14.66,9.51-16.26,7.48-1.83,14.38,2.24,16.75,10.83l8.02-15.87C38.16-.31,46.21-1.25,51.68,1.41c5.12,2.48,9.77,9.2,6.85,15.72-6.31,14.11-12.53,27.53-19.75,41.42-3.84,7.39-17.74,7.93-22.08.3Z"/>
        <path fill={fg} d="M91.53,21.3c-4.34,9.71-8.63,19.08-13.24,28.5l-.09.18c-2.07,4.22-4.2,8.46-6.42,12.74-.02.04-.04.08-.07.12l-.03.06c-.14.25-.29.49-.45.73-2.15,3.14-6.26,4.81-10.42,4.87-1.98-.08-3.95-.56-5.66-1.39-5.11-2.48-9.76-9.2-6.85-15.71,4.34-9.7,8.63-19.08,13.24-28.5h.01s6.58-13.04,6.58-13.04c.01-.02.02-.04.03-.06.15-.27.31-.54.49-.79,2.21-3.49,6.32-5,10.38-4.81,1.98.08,3.94.56,5.65,1.39,5.11,2.48,9.77,9.2,6.85,15.71Z"/>
      </g>
      <ellipse cx="22" cy="20" rx="9" ry="4.5" fill="white" opacity="0.2" transform="rotate(-35 22 20)" />
    </svg>
  );
}

// ── Pièces flottantes ──────────────────────────────────────────────────────
// Phase "entering" : les pièces partent de leur position off-screen et
//   glissent vers leur position normale (animation inverse à l'entrée).
// Phase "idle"     : flottement + rotation libre.
// Phase "exiting"  : glissent lentement vers l'extérieur de l'écran.
// ──────────────────────────────────────────────────────────────────────────
type CoinPhase = "entering" | "idle" | "exiting";

type CoinConfig = {
  style: React.CSSProperties;
  size: number;
  dark: boolean;
  spin: number;
  float: number;
  delay: number;
  opacity: number;
  reverse: boolean;
  exitX: number;  // px vers l'extérieur
  exitY: number;
};

const COIN_CONFIGS: CoinConfig[] = [
  { style: { top: -40,    left: -40   }, size: 160, dark: false, spin: 18, float: 5.0, delay: 0.0, opacity: 0.22, reverse: false, exitX: -300, exitY: -300 },
  { style: { top:  40,    right: -40  }, size: 115, dark: true,  spin: 12, float: 4.2, delay: 1.5, opacity: 0.18, reverse: true,  exitX:  300, exitY: -220 },
  { style: { top: 200,    left:   8   }, size:  88, dark: false, spin: 24, float: 6.0, delay: 0.8, opacity: 0.15, reverse: false, exitX: -300, exitY:   30 },
  { style: { top: 360,    right:   0  }, size: 100, dark: true,  spin: 16, float: 4.8, delay: 2.2, opacity: 0.17, reverse: false, exitX:  300, exitY:   90 },
  { style: { bottom:  90, left:  -35  }, size: 145, dark: true,  spin: 20, float: 5.5, delay: 0.4, opacity: 0.18, reverse: true,  exitX: -300, exitY:  260 },
  { style: { bottom:  30, right: -25  }, size: 108, dark: false, spin: 14, float: 3.8, delay: 1.0, opacity: 0.20, reverse: false, exitX:  300, exitY:  280 },
];

function FloatingCoins({ phase }: { phase: CoinPhase }) {
  const isIdle    = phase === "idle";
  const isOff     = phase !== "idle"; // entering ou exiting : hors position normale

  return (
    <>
      {COIN_CONFIGS.map((c, i) => {
        // Délai de stagger selon la phase
        const stagger = isOff
          ? `${i * 45}ms`   // exit : premier part le premier
          : `${i * 55}ms`;  // enter : chaque pièce arrive légèrement après

        // Easing selon la phase
        const easing = phase === "exiting"
          ? `transform 0.75s ease-in ${stagger}`          // accélère vers l'extérieur
          : `transform 1.0s cubic-bezier(0.16,1,0.3,1) ${stagger}`; // glisse depuis l'extérieur

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              ...c.style,
              opacity: c.opacity,
              pointerEvents: "none",
              // Off-screen quand entering ou exiting, en place quand idle
              transform: isIdle
                ? "translate(0px, 0px)"
                : `translate(${c.exitX}px, ${c.exitY}px)`,
              // Pas de transition pendant le rendu initial (entering) :
              // la pièce apparaît directement hors écran sans animation parasite.
              // La transition se déclenche au passage idle ↔ exiting.
              transition: phase === "entering" ? "none" : easing,
              // Float uniquement en idle (sinon conflit avec le translate)
              animation: isIdle
                ? `coinFloat ${c.float}s ease-in-out ${c.delay}s infinite`
                : "none",
            }}
          >
            <div style={{
              animation: isIdle
                ? `coinSpin ${c.spin}s linear ${c.delay}s infinite${c.reverse ? " reverse" : ""}`
                : "none",
            }}>
              <CoinSVG size={c.size} dark={c.dark} />
            </div>
          </div>
        );
      })}
    </>
  );
}

function WelcomeScreen({ go }: { go: (s: Screen) => void }) {
  // Démarre en "entering" : les pièces sont hors écran.
  // Après 40 ms (un frame de peinture), on passe en "idle" → elles glissent vers l'intérieur.
  const [phase, setPhase] = useState<CoinPhase>("entering");

  useEffect(() => {
    const t = setTimeout(() => setPhase("idle"), 40);
    return () => clearTimeout(t);
  }, []);

  const handleNav = (target: Screen) => {
    setPhase("exiting");
    // Délai = durée transition (750 ms) + stagger max (5 pièces × 45 ms = 225 ms) + marge
    setTimeout(() => go(target), 1000);
  };

  return (
    <div className="flex flex-col h-full relative screen-enter" style={{ background: C.bg, color: C.text }}>
      {/* Arrière-plan : pièces animées */}
      <div className="absolute inset-0 overflow-hidden" style={{ pointerEvents: "none", zIndex: 0 }}>
        <FloatingCoins phase={phase} />
      </div>
      {/* Contenu au-dessus des pièces */}
      <div className="relative flex flex-col h-full" style={{ zIndex: 1 }}>
        <StatusBar />
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <WiseLogo size={110} />
          <div style={{ color: C.text, fontSize: 32, fontWeight: 800, letterSpacing: -0.5, fontFamily: "Brunson, sans-serif", marginTop: 20 }}>WiseWallet</div>
          <div className="mt-12 text-center" style={{ color: C.text, fontSize: 36, fontWeight: 800, fontFamily: "Brunson, sans-serif", lineHeight: 1.1 }}>
            Gérez. Épargnez. <span style={{ color: C.secondary }}>Atteignez.</span>
          </div>
          <div className="mt-4 text-center" style={{ color: C.text2, fontSize: 15 }}>
            Votre argent, enfin organisé.
          </div>
        </div>
        <div className="px-6 pb-12 space-y-3">
          <PrimaryButton onClick={() => handleNav("signup")}>Commencer</PrimaryButton>
          <GhostButton onClick={() => handleNav("home")}>J'ai déjà un compte</GhostButton>
        </div>
      </div>
    </div>
  );
}

function SignupScreen({ go, setFirstName, firstName }: { go: (s: Screen) => void; firstName: string; setFirstName: (n: string) => void }) {
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const inputStyle = { background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 15 };
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar />
      <Header title="Créer un compte" onBack={() => go("welcome")} />
      <ScreenBody pad={false}>
        <div className="px-6">
          <div className="mb-4">
            <label htmlFor="signup-prenom" style={{ color: C.text2, fontSize: 13, fontWeight: 500 }} className="mb-2 block">Prénom</label>
            <input id="signup-prenom" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Richard"
              className="w-full h-12 rounded-[12px] px-4 outline-none" style={inputStyle} />
          </div>
          <div className="mb-4">
            <label htmlFor="signup-email" style={{ color: C.text2, fontSize: 13, fontWeight: 500 }} className="mb-2 block">Email</label>
            <input id="signup-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="alex@email.com"
              className="w-full h-12 rounded-[12px] px-4 outline-none" style={inputStyle} />
          </div>
          <div className="mb-4">
            <label htmlFor="signup-pwd" style={{ color: C.text2, fontSize: 13, fontWeight: 500 }} className="mb-2 block">Mot de passe</label>
            <div className="relative">
              <input id="signup-pwd" value={pwd} onChange={(e) => setPwd(e.target.value)} type={show ? "text" : "password"} placeholder="••••••••"
                className="w-full h-12 rounded-[12px] pl-4 pr-12 outline-none" style={inputStyle} />
              <button onClick={() => setShow((s) => !s)} aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"} className="absolute right-3 top-1/2 -translate-y-1/2">
                {show ? <EyeOff size={18} strokeWidth={STROKE} color={C.text2} /> : <Eye size={18} strokeWidth={STROKE} color={C.text2} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: C.border }} />
            <span style={{ color: C.text2, fontSize: 12 }}>ou continuer avec</span>
            <div className="flex-1 h-px" style={{ background: C.border }} />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button className="h-12 rounded-[12px] flex items-center justify-center gap-2 transition active:scale-[0.98]"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontWeight: 500 }}>
              <GoogleIcon />Google
            </button>
            <button className="h-12 rounded-[12px] flex items-center justify-center gap-2 transition active:scale-[0.98]"
              style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: 14, fontWeight: 500 }}>
              <AppleIcon />Apple
            </button>
          </div>
        </div>
      </ScreenBody>
      <div className="px-6 pb-6 space-y-3">
        <PrimaryButton onClick={() => go("home")}>Créer mon compte</PrimaryButton>
        <div className="text-center" style={{ color: C.text2, fontSize: 12 }}>
          En continuant, vous acceptez nos CGU
        </div>
      </div>
    </div>
  );
}

function HomeScreen({ go, firstName, goals, onOpenAlex }: { go: (s: Screen) => void; firstName: string; goals: Goal[]; onOpenAlex?: () => void }) {
  const initial = (firstName || "A")[0].toUpperCase();
  const balance = useCountUp(284700, 1400);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: C.bg, overflow: "hidden" }}>
      <StatusBar />

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 24px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.primary, color: C.onPrimary, fontWeight: 700, fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <div style={{ color: C.text2, fontSize: 12, lineHeight: 1.2 }}>Bonjour,</div>
            <div style={{ color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "Brunson, sans-serif", lineHeight: 1.2 }}>{firstName || "Richard"} 👋</div>
          </div>
        </div>
        <button onClick={() => { playClick(); go("notifications"); }} aria-label="Notifications" style={{ width: 44, height: 44, borderRadius: "50%", background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", flexShrink: 0 }}>
          <Bell size={20} strokeWidth={STROKE} color={C.text2} fill="none" />
          <div aria-hidden="true" style={{ position: "absolute", top: 11, right: 11, width: 7, height: 7, borderRadius: "50%", background: C.primary, border: `2px solid ${C.bg}` }} />
        </button>
      </div>

      {/* ── BALANCE ── */}
      <div style={{ padding: "0 24px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: C.text2, fontSize: 13 }}>Mon Solde</span>
          <button onClick={() => { playClick(); go("analysis"); }} style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "5px 12px", cursor: "pointer" }}>
            <BarChart3 size={13} color={C.text2} strokeWidth={STROKE} />
            <span style={{ color: C.text2, fontSize: 12, fontWeight: 500 }}>Statistiques</span>
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ color: C.primaryDark, fontSize: 22, fontWeight: 800 }}>€</span>
          <span aria-live="polite" aria-atomic="true" style={{ color: C.text, fontSize: 40, fontWeight: 800, letterSpacing: -1.5, fontFamily: "Brunson, sans-serif", lineHeight: 1 }}>
            {(balance / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <div style={{ background: C.successSoft, borderRadius: 100, padding: "3px 10px" }}>
            <span style={{ color: C.success, fontSize: 12, fontWeight: 600 }}>+3,2% ce mois</span>
          </div>
          <span style={{ color: C.text2, fontSize: 12 }}>· -342 € dépensés</span>
        </div>
      </div>

      {/* ── ACTIONS Virer / Recevoir ── */}
      <div style={{ padding: "0 24px 14px", display: "flex", gap: 12 }}>
        {[
          { icon: ArrowUpRight,  label: "Virer" },
          { icon: ArrowDownLeft, label: "Recevoir" },
        ].map((a) => (
          <button key={a.label} onClick={() => playClick()} style={{ flex: 1, height: 50, borderRadius: 100, background: C.surface, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer" }}>
            <a.icon size={18} strokeWidth={STROKE} color={C.text} fill="none" />
            <span style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>{a.label}</span>
          </button>
        ))}
      </div>

      {/* ── QUICK TILES : Alex + Récentes ── */}
      <div style={{ padding: "0 24px 0", display: "flex", gap: 12 }}>
        {onOpenAlex && (
          <button onClick={() => { playClick(); onOpenAlex(); }} className="alex-shine" style={{ flex: 1, padding: "14px 10px", borderRadius: 20, background: C.surface, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#6C63FF,#897FFF)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={22} color="#fff" strokeWidth={1.8} /></div>
            <span style={{ color: C.text, fontSize: 12, fontWeight: 600 }}>Alex</span>
          </button>
        )}
        <button onClick={() => { playClick(); go("transactions"); }} style={{ flex: 2.2, padding: "14px", borderRadius: 20, background: C.primary, display: "flex", flexDirection: "column", justifyContent: "space-between", cursor: "pointer", minHeight: 88 }}>
          <span style={{ color: C.onPrimary, fontSize: 13, fontWeight: 700 }}>Transactions récentes</span>
          <div style={{ display: "flex", marginTop: 10 }}>
            {TXS.slice(0, 4).map((t, i) => {
              const TIcon = t.icon;
              return (
                <div key={t.id} style={{ width: 30, height: 30, borderRadius: "50%", background: t.color, border: `2px solid ${C.primary}`, marginLeft: i > 0 ? -8 : 0, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <TIcon size={13} color="#fff" strokeWidth={2} fill="none" />
                </div>
              );
            })}
          </div>
        </button>
      </div>

      {/* ── BOTTOM SHEET ── */}
      <div style={{ flex: 1, background: C.surface, borderRadius: "24px 24px 0 0", marginTop: 16, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border, margin: "12px auto 0", flexShrink: 0 }} />
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px 130px" }}>

          {/* Transactions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "Brunson, sans-serif" }}>Transactions</span>
            <button onClick={() => { playClick(); go("transactions"); }} style={{ color: C.link, fontSize: 13, fontWeight: 500, background: "none", border: "none", cursor: "pointer" }}>Voir tout</button>
          </div>
          {TXS.slice(0, 3).map((t, i) => (
            <div key={t.id} style={{ animation: `slideUp 0.35s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms both` }}>
              <TxRow t={t} onClick={() => go("txDetail")} />
            </div>
          ))}

          {/* Objectifs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 22, marginBottom: 10 }}>
            <span style={{ color: C.text, fontSize: 17, fontWeight: 700, fontFamily: "Brunson, sans-serif" }}>Mes objectifs</span>
            <button onClick={() => go("goalStep1")} aria-label="Créer un objectif" style={{ width: 34, height: 34, borderRadius: "50%", background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer" }}>
              <Plus size={15} strokeWidth={STROKE} color={C.onPrimary} />
            </button>
          </div>
          {goals.length === 0 ? (
            <div style={{ borderRadius: 16, padding: "18px 16px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: `1px dashed ${C.border}` }}>
              <Archive size={28} color={C.text2} strokeWidth={STROKE} fill="none" />
              <div style={{ color: C.text2, fontSize: 14, marginTop: 8 }}>Aucun objectif créé</div>
              <button onClick={() => go("goalStep1")} style={{ color: C.link, fontSize: 14, fontWeight: 600, background: "none", border: "none", cursor: "pointer", marginTop: 6 }}>
                Créer mon premier objectif
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {goals.map((g) => <GoalCard key={g.id} g={g} onClick={() => go("goalDetail")} />)}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="home" go={go} />
    </div>
  );
}

function GoalCard({ g, onClick }: { g: Goal; onClick?: () => void }) {
  const pct = Math.min(100, Math.round((g.saved / g.amount) * 100));
  const GIcon = g.icon;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 100);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <button onClick={onClick} className="w-full rounded-[20px] p-4 flex items-center gap-3 text-left transition active:scale-[0.99]" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
      <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.primarySoft }}>
        <GIcon size={24} color={C.primaryDark} strokeWidth={STROKE} fill="none" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div style={{ color: C.text, fontSize: 15, fontWeight: 600 }} className="truncate">{g.name}</div>
          <div style={{ color: C.text2, fontSize: 11 }}>{g.targetDate}</div>
        </div>
        <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${g.name} : ${pct}% atteint`} className="h-1.5 rounded-full mt-2" style={{ background: C.border }}>
          <div className="h-full rounded-full" style={{ width: `${width}%`, background: C.primary, transition: "width 1s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <div style={{ color: C.text2, fontSize: 11 }}>{g.saved.toLocaleString("fr-FR")} € / {g.amount.toLocaleString("fr-FR")} €</div>
          <div style={{ color: C.primaryDark, fontSize: 11, fontWeight: 600 }}>{pct}%</div>
        </div>
      </div>
    </button>
  );
}

function TransactionsScreen({ go }: { go: (s: Screen) => void }) {
  const [month, setMonth] = useState("Avr");
  const [filter, setFilter] = useState("Tout");

  const filtered = useMemo(() => {
    if (filter === "Dépenses") return TXS.filter((t) => t.amount < 0);
    if (filter === "Revenus") return TXS.filter((t) => t.amount > 0);
    return TXS;
  }, [filter]);

  const grouped = useMemo(() => {
    const map: Record<string, Tx[]> = {};
    filtered.forEach((t) => (map[t.dateLabel] ||= []).push(t));
    return map;
  }, [filtered]);

  return (
    <div className="flex flex-col h-full screen-enter" style={{ background: C.bg }}>
      <StatusBar />
      <Header title="Transactions" large />
      <ScreenBody>
        <div className="px-6">
          <div className="flex gap-2 mb-4">
            {["Fév", "Mar", "Avr"].map((m) => (
              <button key={m} onClick={() => setMonth(m)} className="px-4 h-9 rounded-full transition active:scale-95"
                style={{ background: month === m ? C.primary : C.surface, color: month === m ? C.onPrimary : C.text2, fontSize: 13, fontWeight: 500, border: `1px solid ${month === m ? C.primary : C.border}` }}>
                {m}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mb-4 overflow-x-auto">
            {["Tout", "Dépenses", "Revenus"].map((f) => (
              <button key={f} onClick={() => setFilter(f)} className="px-4 h-9 rounded-full whitespace-nowrap transition active:scale-95"
                style={{ background: filter === f ? C.primary : C.surface, color: filter === f ? C.onPrimary : C.text2, border: `1px solid ${filter === f ? C.primary : C.border}`, fontSize: 13, fontWeight: 500 }}>
                {f}
              </button>
            ))}
          </div>
          <div className="rounded-[20px] p-4 flex justify-between mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
            <div>
              <div style={{ color: C.text2, fontSize: 12 }}>Dépenses</div>
              <div style={{ color: C.danger, fontSize: 18, fontWeight: 600, fontFamily: "Brunson, sans-serif" }}>-1 247 €</div>
            </div>
            <div className="text-right">
              <div style={{ color: C.text2, fontSize: 12 }}>Revenus</div>
              <div style={{ color: C.success, fontSize: 18, fontWeight: 600, fontFamily: "Brunson, sans-serif" }}>+2 100 €</div>
            </div>
          </div>
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="mb-2">
              <div style={{ color: C.text2, fontSize: 12 }} className="mb-1 mt-3">{date}</div>
              {items.map((t, i) => (
                <div key={t.id} style={{ animation: `slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${i * 60}ms both` }}>
                  <TxRow t={t} onClick={() => go("txDetail")} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScreenBody>
      <BottomNav active="transactions" go={go} />
    </div>
  );
}

// ── V2 · Bottom sheet suggestion ──────────────────────────────────────────
function SavingsGoalSuggestion({
  category, userAge, onAccept, onDismiss,
}: {
  category: string;
  userAge: number;
  onAccept: (s: GoalSuggestion) => void;
  onDismiss: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const suggestions = getSuggestions(category, userAge);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 30);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => { setEntered(false); setTimeout(onDismiss, 260); };
  const accept  = () => { setEntered(false); setTimeout(() => onAccept(suggestions[selectedIdx]), 260); };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.4)",
          opacity: entered ? 1 : 0,
          transition: "opacity 300ms",
          zIndex: 200,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          background: "#FFFFFF",
          borderRadius: "24px 24px 0 0",
          transform: entered ? "translateY(0)" : "translateY(100%)",
          transition: entered ? "transform 300ms ease-out" : "transform 250ms ease-in",
          zIndex: 201,
          paddingBottom: 34,
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", paddingTop: 12 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: V2C.border }} />
        </div>

        {/* Sparkle */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <Sparkles size={32} color={V2C.primary} strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div style={{ textAlign: "center", color: V2C.text, fontSize: 20, fontWeight: 700, margin: "12px 24px 0", fontFamily: "Brunson, sans-serif" }}>
          Et si vous épargniez pour ça ?
        </div>

        {/* Subtitle */}
        <div style={{ textAlign: "center", color: V2C.text2, fontSize: 13, margin: "8px 24px 20px", lineHeight: 1.5 }}>
          Vous dépensez régulièrement en <span style={{ color: V2C.text, fontWeight: 600 }}>{category}</span>. Les utilisateurs comme vous épargnent souvent pour :
        </div>

        {/* Suggestion cards — horizontal scroll */}
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingLeft: 24, paddingRight: 24, paddingBottom: 6 }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setSelectedIdx(i)}
              className="transition active:scale-[0.97]"
              style={{
                minWidth: 140, flexShrink: 0,
                background: selectedIdx === i ? V2C.primaryLight : "#FFFFFF",
                border: `${selectedIdx === i ? 2 : 1}px solid ${selectedIdx === i ? V2C.primary : V2C.border}`,
                borderRadius: 16,
                padding: "16px 14px",
                textAlign: "left",
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontSize: 28 }}>{s.emoji}</div>
              <div style={{ color: V2C.text, fontSize: 13, fontWeight: 600, marginTop: 8, lineHeight: 1.3 }}>{s.name}</div>
              <div style={{ color: V2C.primary, fontSize: 12, fontWeight: 600, marginTop: 4 }}>
                {s.amount.toLocaleString("fr-FR")} €
              </div>
            </button>
          ))}
        </div>

        {/* CTAs */}
        <div style={{ padding: "20px 24px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={accept}
            className="transition active:scale-[0.98]"
            style={{ width: "100%", height: 52, borderRadius: 14, background: V2C.primary, color: "#FFFFFF", fontSize: 15, fontWeight: 600 }}
          >
            Créer cet objectif
          </button>
          <button
            onClick={dismiss}
            className="transition active:scale-[0.98]"
            style={{ width: "100%", height: 52, borderRadius: 14, background: "transparent", color: V2C.text, fontSize: 15, fontWeight: 600, border: `2px solid ${V2C.border}` }}
          >
            Pas maintenant
          </button>
        </div>
      </div>
    </>
  );
}

// ── Transaction detail ─────────────────────────────────────────────────────
function TxDetailScreen({ go, onConfirm }: { go: (s: Screen) => void; onConfirm: (category: string) => void }) {
  const [selected, setSelected] = useState("Alimentation");
  const alts: { icon: LucideIcon; l: string }[] = [
    { icon: Car, l: "Transport" }, { icon: Film, l: "Loisirs" }, { icon: Pill, l: "Santé" },
    { icon: ShoppingBag, l: "Shopping" }, { icon: Building, l: "Logement" }, { icon: MoreHorizontal, l: "Autre" },
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar />
      <Header title="Transaction" onBack={() => go("home")} right={<button style={{ color: C.text2, fontSize: 12 }}>Ignorer</button>} />
      <ScreenBody pad={false}>
        <div className="px-6 flex flex-col items-center">
          <div aria-hidden="true" className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: "#FF8A3D1A" }}>
            <ShoppingCart size={26} color="#FF8A3D" strokeWidth={STROKE} fill="none" />
          </div>
          <div style={{ color: C.text, fontSize: 28, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }} className="mt-3">Carrefour City</div>
          <div style={{ color: C.danger, fontSize: 32, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }} className="mt-1">-23,40 €</div>
          <div style={{ color: C.text2, fontSize: 12 }} className="mt-1">Aujourd'hui · 14h32</div>
          <div style={{ color: C.text2, fontSize: 12 }}>Paris, France</div>
        </div>
        <div className="px-6 mt-6">
          <div style={{ color: C.text2, fontSize: 11, letterSpacing: 1 }} className="uppercase mb-2">Catégorie détectée</div>
          <div className="w-full h-12 rounded-full flex items-center justify-center gap-2"
            style={{ background: C.primary, color: C.onPrimary, fontSize: 15, fontWeight: 600 }}>
            <ShoppingCart size={18} color={C.onPrimary} strokeWidth={STROKE} fill="none" aria-hidden="true" />
            Alimentation
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {alts.map((a) => {
              const AIcon = a.icon;
              return (
                <button key={a.l} onClick={() => setSelected(a.l)} className="h-12 rounded-full flex items-center justify-center gap-1 transition active:scale-95"
                  style={{
                    background: selected === a.l ? C.primarySoft : C.surface,
                    border: `1px solid ${selected === a.l ? C.primary : C.border}`,
                    color: C.text, fontSize: 13, fontWeight: 500,
                  }}>
                  <AIcon size={16} strokeWidth={STROKE} color={selected === a.l ? C.secondary : C.text2} fill="none" aria-hidden="true" />
                  <span>{a.l}</span>
                </button>
              );
            })}
          </div>
          <input aria-label="Ajouter une note" placeholder="Ajouter une note..." className="w-full h-12 rounded-[12px] px-4 outline-none mt-4"
            style={{ background: C.surface, color: C.text, border: `1px solid ${C.border}`, fontSize: 14 }} />
        </div>
      </ScreenBody>
      <div className="px-6 pb-6">
        <PrimaryButton onClick={() => onConfirm(selected)}>Confirmer</PrimaryButton>
      </div>
    </div>
  );
}

function GoalsScreen({
  go, goals, savingsGoals, onGoalPress, cluster, showNotif, notifGoal, onDismissNotif,
}: {
  go: (s: Screen) => void;
  goals: Goal[];
  savingsGoals: SavingsGoal[];
  onGoalPress: (g: SavingsGoal) => void;
  cluster: Cluster;
  showNotif: boolean;
  notifGoal: SavingsGoal | null;
  onDismissNotif: () => void;
}) {
  const pop = [
    { icon: Plane, t: "Voyage", a: "1 500€" },
    { icon: Car, t: "Voiture", a: "5 000€" },
    { icon: Building, t: "Apport", a: "20 000€" },
  ];

  // V3: cluster_2 sees AI goal creation flow; cluster_3 sees reactivation flow
  const handleCreateGoal = () => {
    if (cluster === "cluster_2") {
      go("aiGoalSuggestion");
    } else {
      go("reactivationEmail");
    }
  };

  return (
    <div className="flex flex-col h-full screen-enter" style={{ background: C.bg, position: "relative" }}>
      {/* Progress notification banner */}
      {showNotif && notifGoal && (
        <ProgressNotificationBanner
          goal={notifGoal}
          monthlySaved={notifGoal.monthlyAmount}
          onDismiss={onDismissNotif}
          onAction={() => { onDismissNotif(); onGoalPress(notifGoal); }}
          onAdjust={() => { onDismissNotif(); onGoalPress(notifGoal); }}
        />
      )}

      <StatusBar />
      <div className="px-6 pt-2 pb-2">
        <div style={{ color: C.text, fontSize: 28, fontWeight: 700, fontFamily: "Brunson, sans-serif" }}>
          {savingsGoals.length > 0 ? "Mes Projets" : "Mes Objectifs"}
        </div>
        <div style={{ color: C.text2, fontSize: 15 }} className="mt-1">
          {savingsGoals.length > 0
            ? `${savingsGoals.length} projet${savingsGoals.length > 1 ? "s" : ""} en cours`
            : "Épargnez avec intention"}
        </div>
      </div>

      <ScreenBody>
        {/* V3 savings goals section */}
        {savingsGoals.length > 0 ? (
          <div className="px-4 space-y-3">
            {savingsGoals.map((sg) => (
              <GoalCardV3
                key={sg.id}
                goal={sg}
                onPress={() => { playClick(); onGoalPress(sg); }}
              />
            ))}

            {/* Add more projects CTA */}
            <button
              onClick={() => { playClick(); go("addMoreProjects"); }}
              style={{
                width: "100%",
                padding: "14px 0",
                borderRadius: 14,
                background: "transparent",
                border: `1.5px dashed ${V2C.primary}`,
                color: V2C.primary,
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
                marginTop: 4,
              }}
            >
              + Ajouter un projet
            </button>

            {/* Classic goals (V1/V2) below, if any */}
            {goals.length > 0 && (
              <div className="mt-4">
                <div style={{ color: C.text2, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>
                  OBJECTIFS CLASSIQUES
                </div>
                {goals.map((g) => <GoalCard key={g.id} g={g} onClick={() => go("goalDetail")} />)}
              </div>
            )}
          </div>
        ) : goals.length === 0 ? (
          <>
            <div className="px-6 mt-8 flex flex-col items-center text-center">
              <Target size={64} color={C.primary} strokeWidth={1} fill="none" />
              <div style={{ color: C.text, fontSize: 22, fontWeight: 600, fontFamily: "Brunson, sans-serif" }} className="mt-4">
                Vous n'avez pas encore d'objectif
              </div>
              <div style={{ color: C.text2, fontSize: 13 }} className="mt-2 max-w-[280px]">
                Les utilisateurs avec un objectif épargnent 3x plus
              </div>
              <div className="w-full mt-6">
                <PrimaryButton onClick={() => { playClick(); handleCreateGoal(); }}>
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                    {cluster === "cluster_2" ? "Créer mon projet" : "Reprendre mes projets"}
                    {cluster === "cluster_2" && <Sparkles size={16} color={C.onPrimary} strokeWidth={2} />}
                  </span>
                </PrimaryButton>
              </div>
            </div>
            <div className="mt-8">
              <div className="px-6" style={{ color: C.text2, fontSize: 11, letterSpacing: 1 }}>OBJECTIFS POPULAIRES</div>
              <div className="flex gap-3 px-6 mt-3 overflow-x-auto pb-2">
                {pop.map((p) => {
                  const PIcon = p.icon;
                  return (
                    <button key={p.t} onClick={() => { playClick(); handleCreateGoal(); }} className="rounded-[20px] p-4 shrink-0 text-left transition active:scale-[0.98]"
                      style={{ background: C.card, width: 160, boxShadow: SHADOW }}>
                      <PIcon size={32} color={C.secondary} strokeWidth={STROKE} fill="none" />
                      <div style={{ color: C.text, fontSize: 18, fontWeight: 600, fontFamily: "Brunson, sans-serif" }} className="mt-3">{p.t}</div>
                      <div style={{ color: C.text2, fontSize: 12 }} className="mt-1">{p.a}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <div className="px-6">
            <div className="mb-4">
              <PrimaryButton onClick={() => { playClick(); go("goalStep1"); }}>Créer un objectif</PrimaryButton>
            </div>
            <div className="space-y-3">
              {goals.map((g) => <GoalCard key={g.id} g={g} onClick={() => go("goalDetail")} />)}
            </div>
          </div>
        )}
      </ScreenBody>
      <BottomNav active="goals" go={go} />
    </div>
  );
}

function ProgressHeader({ onBack, step }: { onBack: () => void; step: 1 | 2 | 3 }) {
  return (
    <>
      <Header title={step === 3 ? "Récapitulatif" : "Nouvel objectif"} onBack={onBack}
        right={<span style={{ color: C.text2, fontSize: 12 }}>{step} / 3</span>} />
      <div className="px-6 mb-4">
        <div role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={3} aria-label={`Étape ${step} sur 3`} className="h-1 rounded-full overflow-hidden" style={{ background: C.border }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${(step / 3) * 100}%`, background: C.primary }} />
        </div>
      </div>
    </>
  );
}

function GoalStep1({ go, draft, setDraft, prefill }: {
  go: (s: Screen) => void;
  draft: Partial<Goal>;
  setDraft: (d: Partial<Goal>) => void;
  prefill: GoalSuggestion | null;
}) {
  const ready = !!draft.name && !!draft.category;
  const isPrefilled = !!prefill && draft.name === prefill.name;
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar />
      <ProgressHeader onBack={() => go("goals")} step={1} />
      <ScreenBody pad={false}>
        <div className="px-6">
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }}>Quel est votre objectif ?</div>
          <label htmlFor="goal-name" style={{ color: C.text2, fontSize: 13, fontWeight: 500 }} className="mt-4 mb-1 block">Nom de l'objectif</label>
          {isPrefilled && (
            <div style={{ color: V2C.primary, fontSize: 11, fontWeight: 600, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
              <Sparkles size={11} color={V2C.primary} strokeWidth={2} />
              Pré-rempli pour vous
            </div>
          )}
          <input id="goal-name" value={draft.name || ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Ex: Voyage au Japon" className="w-full h-12 rounded-[12px] px-4 outline-none"
            style={{
              background: C.surface, color: C.text, fontSize: 15,
              border: `1px solid ${isPrefilled ? V2C.primary : C.border}`,
            }} />
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-6">Choisissez une catégorie</div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {CATEGORIES.map((c) => {
              const sel = draft.category === c.l;
              const CIcon = c.icon;
              return (
                <button key={c.l} onClick={() => setDraft({ ...draft, category: c.l, icon: c.icon })}
                  className="h-24 rounded-[14px] flex flex-col items-center justify-center gap-1 transition active:scale-95"
                  style={{
                    background: sel ? C.primarySoft : C.surface,
                    border: `1px solid ${sel ? C.primary : C.border}`,
                    boxShadow: sel ? "none" : SHADOW,
                  }}>
                  <CIcon size={28} color={C.secondary} strokeWidth={STROKE} fill="none" />
                  <span style={{ color: C.text, fontSize: 12 }}>{c.l}</span>
                </button>
              );
            })}
          </div>
        </div>
      </ScreenBody>
      <div className="px-6 pb-6">
        <PrimaryButton onClick={() => go("goalStep2")} disabled={!ready}>Suivant</PrimaryButton>
      </div>
    </div>
  );
}

function CustomSelect({
  value, onChange, options, ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  options: { value: number; label: string }[];
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";
  return (
    <div className="flex-1">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="w-full h-11 rounded-full px-4 flex items-center justify-between gap-2 transition active:scale-[0.98]"
        style={{
          background: C.surface,
          color: C.text,
          fontSize: 14,
          border: `1px solid ${open ? C.primaryDark : C.border}`,
        }}
      >
        <span style={{ fontWeight: 500 }}>{selectedLabel}</span>
        <ChevronDown
          size={15} strokeWidth={STROKE} color={C.text2} fill="none"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s ease" }}
        />
      </button>
      {open && (
        <div
          className="mt-1 rounded-[16px] overflow-hidden"
          style={{
            maxHeight: 204,
            overflowY: "auto",
            background: C.surface,
            border: `1px solid ${C.border}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.10)",
          }}
        >
          {options.map((o, idx) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className="w-full px-4 py-3 text-left flex items-center justify-between transition active:bg-[#F0FFAA]"
                style={{
                  color: sel ? C.secondary : C.text,
                  fontSize: 14,
                  fontWeight: sel ? 600 : 400,
                  background: sel ? C.primarySoft : "transparent",
                  borderBottom: idx < options.length - 1 ? `1px solid ${C.border}` : "none",
                }}
              >
                <span>{o.label}</span>
                {sel && <Check size={14} color={C.secondary} strokeWidth={2} fill="none" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GoalStep2({ go, draft, setDraft }: { go: (s: Screen) => void; draft: Partial<Goal> & { _amountStr?: string; _month?: number; _year?: number }; setDraft: (d: any) => void }) {
  const now = new Date();
  const amountStr = draft._amountStr ?? "";
  const month = draft._month ?? (now.getMonth() + 12) % 12;
  const year = draft._year ?? now.getFullYear() + 1;
  const amount = Number(amountStr.replace(",", ".")) || 0;

  const targetDate = new Date(year, month, 1);
  const monthsBetween = Math.max(1, (targetDate.getFullYear() - now.getFullYear()) * 12 + (targetDate.getMonth() - now.getMonth()));
  const monthly = amount / monthsBetween;

  const tap = (k: string) => {
    let v = amountStr;
    if (k === "<") v = v.slice(0, -1);
    else if (k === ".") v = v.includes(".") ? v : (v || "0") + ".";
    else v = v + k;
    setDraft({ ...draft, _amountStr: v, amount });
  };
  const keys = ["1","2","3","4","5","6","7","8","9",".","0","<"];
  const hasVal = amountStr.length > 0 && amount > 0;

  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar />
      <ProgressHeader onBack={() => go("goalStep1")} step={2} />
      <ScreenBody pad={false}>
        <div className="px-6">
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }}>Combien souhaitez-vous épargner ?</div>
          <div className="text-center mt-4" style={{
            color: C.text, fontSize: 32, fontWeight: 700,
            opacity: hasVal ? 1 : 0.4,
            fontFamily: "Brunson, sans-serif",
          }}>
            {hasVal ? `${amount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €` : "0 €"}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {keys.map((k) => (
              <button key={k} onClick={() => tap(k)}
                className="h-14 rounded-[14px] flex items-center justify-center transition active:scale-95"
                style={{ background: C.surface, color: C.text, fontSize: 20, fontWeight: 600, boxShadow: SHADOW , fontFamily: "Brunson, sans-serif" }}>
                {k === "<" ? <Delete size={18} strokeWidth={STROKE} color={C.text} /> : k}
              </button>
            ))}
          </div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-5">Pour quand ?</div>
          <div className="flex gap-3 mt-3">
            <CustomSelect
              value={month}
              ariaLabel="Mois cible"
              onChange={(v) => setDraft({ ...draft, _month: v })}
              options={MONTHS_FR.map((m, i) => ({ value: i, label: m }))}
            />
            <CustomSelect
              value={year}
              ariaLabel="Année cible"
              onChange={(v) => setDraft({ ...draft, _year: v })}
              options={[0, 1, 2, 3, 4].map((o) => ({ value: now.getFullYear() + o, label: `${now.getFullYear() + o}` }))}
            />
          </div>
          <div className="rounded-[20px] p-4 mt-4" style={{ background: C.card, boxShadow: SHADOW }}>
            <div style={{ color: C.text2, fontSize: 12 }}>À épargner par mois</div>
            <div style={{ color: C.link, fontSize: 22, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-1">
              {monthly.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })} €
            </div>
            <div style={{ color: C.text2, fontSize: 12 }} className="mt-1">sur {monthsBetween} mois</div>
          </div>
        </div>
      </ScreenBody>
      <div className="px-6 pb-6">
        <PrimaryButton onClick={() => {
          setDraft({ ...draft, amount, durationMonths: monthsBetween, targetDate: `${MONTHS_FR[month].slice(0,3)} ${year}` });
          go("goalStep3");
        }} disabled={!hasVal}>Suivant</PrimaryButton>
      </div>
    </div>
  );
}

function GoalStep3({ go, draft, onCreate }: { go: (s: Screen) => void; draft: Partial<Goal>; onCreate: () => void }) {
  const [remind, setRemind] = useState(true);
  const amount = draft.amount || 0;
  const months = draft.durationMonths || 1;
  const monthly = amount / months;
  const rows: [string, string, boolean?][] = [
    ["Montant cible", `${amount.toLocaleString("fr-FR")} €`],
    ["Durée", `${months} mois`],
    ["Par mois", `${monthly.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €`, true],
    ["Date cible", draft.targetDate || "-"],
  ];
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar />
      <ProgressHeader onBack={() => go("goalStep2")} step={3} />
      <ScreenBody pad={false}>
        <div className="px-6">
          <div className="rounded-[20px] p-5" style={{ background: C.card, boxShadow: SHADOW }}>
            <div className="flex justify-center">
              {draft.icon
                ? <draft.icon size={48} color={C.secondary} strokeWidth={1} fill="none" />
                : <Target size={48} color={C.secondary} strokeWidth={1} fill="none" />}
            </div>
            <div className="text-center mt-2" style={{ color: C.text, fontSize: 28, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }}>{draft.name || "Mon objectif"}</div>
            <div className="h-px my-4" style={{ background: C.border }} />
            {rows.map(([l, v, p]) => (
              <div key={l} className="flex justify-between py-2">
                <div style={{ color: C.text2, fontSize: 14 }}>{l}</div>
                <div style={{ color: p ? C.link : C.text, fontSize: 16, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }}>{v}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-5 p-4 rounded-[14px]" style={{ background: C.surface, boxShadow: SHADOW }}>
            <span style={{ color: C.text, fontSize: 14 }}>Activer les rappels mensuels</span>
            <button onClick={() => setRemind((r) => !r)} role="switch" aria-checked={remind} aria-label="Activer les rappels mensuels" className="w-11 h-6 rounded-full relative transition"
              style={{ background: remind ? C.primary : C.border }}>
              <div className="absolute top-0.5 w-5 h-5 rounded-full transition" style={{ background: "#fff", left: remind ? 22 : 2, boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
            </button>
          </div>
          <div className="text-center mt-3" style={{ color: C.text2, fontSize: 12 }}>
            Vous pourrez modifier cela à tout moment
          </div>
        </div>
      </ScreenBody>
      <div className="px-6 pb-6">
        <PrimaryButton onClick={() => { onCreate(); go("goalCreated"); }}>Créer mon objectif 🎯</PrimaryButton>
      </div>
    </div>
  );
}

function GoalCreatedScreen({ go, goal, isFromSuggestion, onCreated }: {
  go: (s: Screen) => void;
  goal?: Goal;
  isFromSuggestion: boolean;
  onCreated: () => void;
}) {
  const monthly = goal ? goal.amount / goal.durationMonths : 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    onCreated();
    playCoins();

    if (!canvasRef.current) return;
    const fire = confetti.create(canvasRef.current, { resize: true, useWorker: false });

    // 1ère salve : explosion centrale
    fire({
      particleCount: 130,
      spread: 85,
      origin: { x: 0.5, y: 0.38 },
      colors: ["#C9FF27", "#0404E2", "#040707", "#FFFFFF", "#F2C94C"],
      scalar: 1.1,
      gravity: 1.1,
    });

    // 2ème salve : canons latéraux après 220 ms
    setTimeout(() => {
      fire({ particleCount: 70, angle: 55, spread: 65, origin: { x: 0.1, y: 0.5 }, colors: ["#C9FF27", "#FFFFFF", "#0404E2"], scalar: 1.0 });
      fire({ particleCount: 70, angle: 125, spread: 65, origin: { x: 0.9, y: 0.5 }, colors: ["#C9FF27", "#040707", "#F2C94C"], scalar: 1.0 });
    }, 220);
  }, []);

  return (
    <div className="flex flex-col h-full screen-fade relative" style={{ background: C.bg }}>
      {/* Canvas confetti — contenu dans le phone frame */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 10 }}
      />
      <StatusBar />
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="relative w-32 h-32 rounded-full flex items-center justify-center" style={{ background: C.successSoft, boxShadow: `0 0 60px ${C.success}55` }}>
          <Trophy size={48} color={C.success} strokeWidth={1.5} fill="none" />
        </div>
        <div style={{ color: C.text, fontSize: 32, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }} className="mt-6">Objectif créé !</div>
        <div style={{ color: C.text2, fontSize: 15 }} className="mt-3 max-w-[300px]">
          Votre objectif {goal?.name} est lancé. Épargnez {monthly.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€/mois pour y arriver.
        </div>
        {isFromSuggestion && (
          <div className="mt-4 px-4 py-3 rounded-[14px]" style={{ background: V2C.primaryLight }}>
            <div style={{ color: V2C.text, fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>
              🎉 Bravo ! Vous faites partie des utilisateurs qui épargnent 3x plus.
            </div>
          </div>
        )}
        <div className="w-full mt-6">
          <div className="h-2 rounded-full" style={{ background: C.border }}>
            <div className="h-full rounded-full" style={{ width: "0%", background: C.primary }} />
          </div>
          <div style={{ color: C.text2, fontSize: 12 }} className="mt-2">0 € / {goal?.amount?.toLocaleString("fr-FR") ?? "0"} €</div>
        </div>
      </div>
      <div className="px-6 pb-12 space-y-3">
        <PrimaryButton onClick={() => go("goalDetail")}>Voir mon objectif</PrimaryButton>
        <GhostButton onClick={() => go("home")}>Retour à l'accueil</GhostButton>
      </div>
    </div>
  );
}

function GoalDetailScreen({ go, goal }: { go: (s: Screen) => void; goal?: Goal }) {
  if (!goal) return null;
  const pct = Math.round((goal.saved / goal.amount) * 100);
  const monthly = goal.amount / goal.durationMonths;
  const R = 56;
  const circ = 2 * Math.PI * R;
  const [dash, setDash] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDash((pct / 100) * circ), 150);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <div className="flex flex-col h-full" style={{ background: C.bg }}>
      <StatusBar />
      <Header title={goal.name} onBack={() => go("goals")}
        right={<IconBtn ariaLabel="Modifier l'objectif"><Pencil size={16} strokeWidth={STROKE} color={C.text} fill="none" /></IconBtn>} />
      <ScreenBody>
        <div className="px-6">
          <div className="rounded-[20px] p-5" style={{ background: C.card, boxShadow: SHADOW }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <goal.icon size={32} color={C.secondary} strokeWidth={STROKE} fill="none" />
                <span style={{ color: C.text, fontSize: 22, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }}>{goal.category}</span>
              </div>
              <span className="px-3 py-1 rounded-full" style={{ background: C.successSoft, color: C.success, fontSize: 12, fontWeight: 600 }}>En cours</span>
            </div>
            <div className="flex justify-center mt-6">
              <div className="relative w-32 h-32">
                <svg width="128" height="128" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r={R} stroke={C.border} strokeWidth="10" fill="none" />
                  <circle cx="64" cy="64" r={R} stroke={C.primary} strokeWidth="10" fill="none"
                    strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                    transform="rotate(-90 64 64)"
                    style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div style={{ color: C.text, fontSize: 24, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }}>{goal.saved} €</div>
                  <div style={{ color: C.text2, fontSize: 11 }}>sur {goal.amount.toLocaleString("fr-FR")} €</div>
                  <div style={{ color: C.link, fontSize: 11, fontWeight: 600 }}>{pct}%</div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            {[
              ["Par mois", `${monthly.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} €`],
              ["Restant", `${(goal.amount - goal.saved).toLocaleString("fr-FR")} €`],
              ["Date", goal.targetDate],
            ].map(([l, v]) => (
              <div key={l} className="rounded-[14px] p-3 text-center" style={{ background: C.surface, boxShadow: SHADOW }}>
                <div style={{ color: C.text2, fontSize: 11 }}>{l}</div>
                <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }} className="mt-1">{v}</div>
              </div>
            ))}
          </div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-6">Historique des versements</div>
          <div className="text-center py-8" style={{ color: C.text2, fontSize: 13 }}>
            Aucun versement pour l'instant
          </div>
        </div>
      </ScreenBody>
      <div className="absolute left-0 right-0 px-6" style={{ bottom: 80 + 34 + 12 }}>
        <PrimaryButton>Ajouter un versement</PrimaryButton>
      </div>
      <BottomNav active="goals" go={go} />
    </div>
  );
}

function AnalysisScreen({ go }: { go: (s: Screen) => void }) {
  const segs = [
    { l: "Alimentation", v: 35, c: "#FF8A3D", amt: "436 €" },
    { l: "Transport", v: 20, c: "#0404E2", amt: "249 €" },
    { l: "Loisirs", v: 18, c: "#E53E5A", amt: "224 €" },
    { l: "Shopping", v: 15, c: "#F2C94C", amt: "187 €" },
    { l: "Santé", v: 12, c: "#00C896", amt: "151 €" },
  ];
  const evolution = [
    { m: "Jan", r: 2100, d: 980 },
    { m: "Fév", r: 2100, d: 1247 },
    { m: "Mar", r: 2100, d: 1100 },
    { m: "Avr", r: 2100, d: 1247 },
  ];
  const max = Math.max(...evolution.flatMap((e) => [e.r, e.d]));
  const hasData = evolution.some((e) => e.r > 0 || e.d > 0);

  return (
    <div className="flex flex-col h-full screen-enter" style={{ background: C.bg }}>
      <StatusBar />
      <div className="px-6 pt-2 pb-4">
        <div style={{ color: C.text, fontSize: 28, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }}>Analyse</div>
      </div>
      <ScreenBody>
        <div className="px-6">
          <div className="flex justify-center mb-4">
            <div className="px-4 h-9 rounded-full flex items-center gap-3" style={{ background: C.surface, boxShadow: SHADOW }}>
              <span style={{ color: C.text2 }}>‹</span>
              <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>Avril 2026</span>
              <span style={{ color: C.text2 }}>›</span>
            </div>
          </div>
          <div className="rounded-[20px] p-4 flex justify-between" style={{ background: C.card, boxShadow: SHADOW }}>
            <div>
              <div style={{ color: C.text2, fontSize: 12 }}>Revenus</div>
              <div style={{ color: C.success, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }}>+2 100 €</div>
            </div>
            <div className="text-right">
              <div style={{ color: C.text2, fontSize: 12 }}>Dépenses</div>
              <div style={{ color: C.danger, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }}>-1 247 €</div>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {segs.map((s) => (
              <div key={s.l}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.c }} />
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 500 }}>{s.l}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: C.text2, fontSize: 12 }}>{s.v}%</span>
                    <span style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>{s.amt}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${s.v * 2}%`, background: s.c }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-6">Évolution mensuelle</div>
          <div className="rounded-[20px] p-4 mt-3 relative" style={{ background: C.card, boxShadow: SHADOW }}>
            {!hasData && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ color: C.text2, fontSize: 13 }}>
                Pas encore de données
              </div>
            )}
            <div className="relative" style={{ height: 160 }}>
              <svg width="100%" height="140" viewBox="0 0 300 140" preserveAspectRatio="none" role="img" aria-label="Graphique d'évolution mensuelle des revenus et dépenses">
                <defs>
                  <linearGradient id="gradRevenu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.success} stopOpacity="0.25" />
                    <stop offset="100%" stopColor={C.success} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="gradDepense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={C.danger} stopOpacity="0.2" />
                    <stop offset="100%" stopColor={C.danger} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {hasData && (() => {
                  const W = 300, H = 120, pad = 20;
                  const xs = evolution.map((_, i) => pad + (i / (evolution.length - 1)) * (W - pad * 2));
                  const toY = (v: number) => H - pad - ((v / max) * (H - pad * 2));
                  const line = (vals: number[]) =>
                    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xs[i]} ${toY(v)}`).join(" ");
                  const area = (vals: number[]) =>
                    line(vals) + ` L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z`;
                  const revenues = evolution.map(e => e.r);
                  const depenses = evolution.map(e => e.d);
                  return (
                    <>
                      <path d={area(revenues)} fill="url(#gradRevenu)" />
                      <path d={area(depenses)} fill="url(#gradDepense)" />
                      <path d={line(revenues)} fill="none" stroke={C.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="300" strokeDashoffset="300" style={{ animation: "drawLine 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards" }} />
                      <path d={line(depenses)} fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="300" strokeDashoffset="300" style={{ animation: "drawLine 1.2s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards" }} />
                      {revenues.map((v, i) => (
                        <circle key={`r${i}`} cx={xs[i]} cy={toY(v)} r="4" fill={C.success} stroke={C.card} strokeWidth="2" />
                      ))}
                      {depenses.map((v, i) => (
                        <circle key={`d${i}`} cx={xs[i]} cy={toY(v)} r="4" fill={C.danger} stroke={C.card} strokeWidth="2" />
                      ))}
                    </>
                  );
                })()}
              </svg>
              <div className="flex justify-between px-5">
                {evolution.map((e) => (
                  <div key={e.m} style={{ color: C.text2, fontSize: 11 }}>{e.m}</div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full" style={{ background: C.success }} />
                <span style={{ color: C.text2, fontSize: 11 }}>Revenus</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded-full" style={{ background: C.danger }} />
                <span style={{ color: C.text2, fontSize: 11 }}>Dépenses</span>
              </div>
            </div>
          </div>
          <div style={{ color: C.text, fontSize: 18, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-6 mb-2">Top catégories ce mois</div>
          {segs.slice(0, 3).map((s) => (
            <div key={s.l} className="flex items-center gap-3 py-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: `${s.c}1A` }}>
                <div className="w-4 h-4 rounded-full" style={{ background: s.c }} />
              </div>
              <div className="flex-1">
                <div style={{ color: C.text, fontSize: 14 }}>{s.l}</div>
                <div className="h-1.5 rounded-full mt-1" style={{ background: C.border }}>
                  <div className="h-full rounded-full" style={{ width: `${s.v * 2}%`, background: s.c }} />
                </div>
              </div>
              <div style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>{s.amt}</div>
            </div>
          ))}
        </div>
      </ScreenBody>
      <BottomNav active="analysis" go={go} />
    </div>
  );
}

function NotificationsScreen({ go, firstName }: { go: (s: Screen) => void; firstName: string }) {
  void firstName;
  const notifs = [
    { g: "Aujourd'hui", items: [
      { c: C.danger, t: "Dépense importante", d: "Carrefour City · 23,40€", time: "14h32", unread: true },
      { c: C.primary, t: "Rappel d'objectif", d: "N'oubliez pas votre versement", time: "09h00", unread: true },
    ]},
    { g: "Cette semaine", items: [
      { c: C.secondary, t: "Astuce", d: "Économisez 10% ce mois-ci", time: "Hier", unread: false },
      { c: C.danger, t: "Alerte transaction", d: "Netflix · 13,99€", time: "2j", unread: false },
    ]},
  ];
  return (
    <div className="flex flex-col h-full screen-fade" style={{ background: C.bg }}>
      <StatusBar />
      <div className="flex items-center justify-between px-6 pt-2 pb-4">
        <IconBtn onClick={() => go("home")}><ArrowLeft size={ICON} strokeWidth={STROKE} color={C.text} fill="none" /></IconBtn>
        <div style={{ color: C.text, fontSize: 22, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }}>Notifications</div>
        <button style={{ color: C.secondary, fontSize: 12, fontWeight: 500 }}>Tout lu</button>
      </div>
      <ScreenBody pad={false}>
        <div className="px-6">
          {notifs.map((g) => (
            <div key={g.g} className="mb-5">
              <div style={{ color: C.text2, fontSize: 12 }} className="mb-2">{g.g}</div>
              {g.items.map((n, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-[14px] mb-2"
                  style={{ background: n.unread ? C.surface : "transparent", boxShadow: n.unread ? SHADOW : "none" }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: `${n.c}1A` }}>
                    <div className="w-4 h-4 rounded-full" style={{ background: n.c }} />
                  </div>
                  <div className="flex-1">
                    <div style={{ color: C.text, fontSize: 14, fontWeight: 500 }}>{n.t}</div>
                    <div style={{ color: C.text2, fontSize: 12 }}>{n.d}</div>
                  </div>
                  <div style={{ color: C.text2, fontSize: 11 }}>{n.time}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScreenBody>
    </div>
  );
}

function ProfileScreen({ go, firstName }: { go: (s: Screen) => void; firstName: string }) {
  const Item = ({ label }: { label: string }) => (
    <button className="w-full h-14 rounded-[14px] flex items-center px-4 mb-2 transition active:scale-[0.99]"
      style={{ background: C.surface, boxShadow: SHADOW }}>
      <div className="w-8 h-8 rounded-full mr-3" style={{ background: C.primarySoft }} />
      <span className="flex-1 text-left" style={{ color: C.text, fontSize: 15 }}>{label}</span>
      <ChevronRight size={16} strokeWidth={STROKE} color={C.text2} fill="none" />
    </button>
  );
  const initial = (firstName || "A")[0].toUpperCase();
  return (
    <div className="flex flex-col h-full screen-enter" style={{ background: C.bg }}>
      <StatusBar />
      <div className="px-6 pt-2 pb-4">
        <div style={{ color: C.text, fontSize: 28, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }}>Mon Profil</div>
      </div>
      <ScreenBody>
        <div className="px-6">
          <div className="rounded-[20px] p-5 flex flex-col items-center" style={{ background: C.card, boxShadow: SHADOW }}>
            <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
              style={{ background: C.primary, color: C.onPrimary, fontSize: 28, fontWeight: 700 , fontFamily: "Brunson, sans-serif" }}>{initial}</div>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 600 , fontFamily: "Brunson, sans-serif" }} className="mt-3">{firstName || "Richard"} Martin</div>
            <div style={{ color: C.text2, fontSize: 12 }}>{(firstName || "alex").toLowerCase()}@email.com</div>
          </div>
          <div style={{ color: C.text2, fontSize: 11, letterSpacing: 1 }} className="uppercase mt-6 mb-2">Mon compte</div>
          <Item label="Informations personnelles" />
          <Item label="Sécurité" />
          <Item label="Notifications" />
          <Item label="Abonnement" />
          <div style={{ color: C.text2, fontSize: 11, letterSpacing: 1 }} className="uppercase mt-6 mb-2">Application</div>
          <Item label="Aide & Support" />
          <Item label="Conditions d'utilisation" />
          <Item label="Politique de confidentialité" />
          <button onClick={() => go("welcome")} className="w-full h-14 flex items-center justify-center gap-2 mt-4 transition active:scale-95"
            style={{ color: C.danger, fontSize: 15, fontWeight: 600 }}>
            <LogOut size={18} strokeWidth={STROKE} color={C.danger} fill="none" />
            Se déconnecter
          </button>
        </div>
      </ScreenBody>
      <BottomNav active="profile" go={go} />
    </div>
  );
}

// ---------- app ----------
export default function App() {
  const [screen, setScreen] = useState<Screen>("welcome");
  const [firstName, setFirstName] = useState("Richard");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [draft, setDraft] = useState<Partial<Goal> & { _amountStr?: string; _month?: number; _year?: number }>({});
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);

  // ── V2 state ──────────────────────────────────────────────────────────────
  const [userAge, setUserAge] = useState(28);
  const [savingsGoalCreated, setSavingsGoalCreated] = useState(false);
  const [dismissedCount, setDismissedCount] = useState(0);
  const [showSuggestion, setShowSuggestion] = useState(false);
  const [suggestionCategory, setSuggestionCategory] = useState("Alimentation");
  const [prefill, setPrefill] = useState<GoalSuggestion | null>(null);

  // ── V3 state ──────────────────────────────────────────────────────────────
  const [cluster, setCluster] = useState<Cluster>("cluster_2");
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [totalMonthlyBudget, setTotalMonthlyBudget] = useState(500);
  const [declaredGoal, setDeclaredGoal] = useState("voyage");
  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket>("medium");
  const [activeV3GoalId, setActiveV3GoalId] = useState<string | null>(null);
  const [pendingV3Goal, setPendingV3Goal] = useState<SavingsGoal | null>(null);
  const [showNotif, setShowNotif] = useState(false);
  const [notifGoal, setNotifGoal] = useState<SavingsGoal | null>(null);
  // Extra state exposed to debug panel
  const [firstTransactionCategorized, setFirstTransactionCategorized] = useState(false);
  const [firstTransactionDate, setFirstTransactionDate] = useState<string | null>(null);
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(null);
  const [alexFlow, setAlexFlow] = useState<AlexMode>("cluster2");

  // V3 userState object for child components
  const userState: UserState = {
    cluster,
    savingsGoalCreated: savingsGoals.length > 0,
    goalsCount: savingsGoals.length,
    goals: savingsGoals,
    totalMonthlyBudget,
    declaredGoal,
    incomeBracket,
    age: userAge,
    firstTransactionCategorized,
    firstTransactionDate,
    lastActiveDate,
    dismissedSuggestionCount: dismissedCount,
    reactivationEmailSent: false,
  };

  const openAlex = useCallback(() => {
    go("alexChat");
  }, [alexFlow]);

  // Add a V3 savings goal (from enrichment or tile selection)
  const addSavingsGoal = (goal: SavingsGoal) => {
    setSavingsGoals((prev) => {
      const updated = [...prev, { ...goal, priority: prev.length + 1 }];
      return allocateBudget(updated, totalMonthlyBudget);
    });
    setActiveV3GoalId(goal.id);
  };

  // Show notification after goal created
  const triggerNotif = (goal: SavingsGoal) => {
    setNotifGoal(goal);
    setTimeout(() => setShowNotif(true), 500);
    setTimeout(() => setShowNotif(false), 6000);
  };

  // V3 AI flow: user completes enrichment → create goal → show AddMoreProjects
  const handleV3GoalComplete = (goal: SavingsGoal) => {
    addSavingsGoal(goal);
    setPendingV3Goal(goal);
    setSavingsGoalCreated(true);
    playCoins();
    setScreen("addMoreProjects");
  };

  // Reactivation flow: quiz complete → build goals → allocation plan
  const handleQuizComplete = (result: QuizResult) => {
    setTotalMonthlyBudget(result.monthly);
    // Build one SavingsGoal per selected project with the chosen budget
    const newGoals: SavingsGoal[] = result.projects.map((key, i) => {
      const base = buildPrefillGoal(key, incomeBracket, Math.round(result.monthly / result.projects.length));
      const chosenBudget = result.budgets[key] ?? base.targetAmount;
      return { ...base, targetAmount: chosenBudget, priority: i + 1 };
    });
    setSavingsGoals(allocateBudget(newGoals, result.monthly));
    setSavingsGoalCreated(true);
    setScreen("allocationPlan");
  };

  const go = (s: Screen) => {
    if (s === "goalStep1" && !prefill) setDraft({});
    setScreen(s);
  };

  // Triggered when user taps "Confirmer" on TxDetailScreen
  const handleTxConfirm = (category: string) => {
    if (!savingsGoalCreated && dismissedCount < 3) {
      setSuggestionCategory(category);
      setTimeout(() => setShowSuggestion(true), 800);
    } else {
      setScreen("home");
    }
  };

  // User accepts a suggestion → prefill goal creation
  const handleSuggestionAccept = (s: GoalSuggestion) => {
    setShowSuggestion(false);
    setPrefill(s);
    const matchedCat = CATEGORIES.find((c) => c.icon === s.icon);
    setDraft({
      name: s.name,
      amount: s.amount,
      _amountStr: s.amount.toString(),
      icon: s.icon,
      category: matchedCat?.l || "Autre",
    });
    setScreen("goalStep1");
  };

  // User dismisses the suggestion
  const handleSuggestionDismiss = () => {
    setShowSuggestion(false);
    setDismissedCount((n) => n + 1);
    setScreen("home");
  };

  const onCreate = () => {
    const id = `g${Date.now()}`;
    const g: Goal = {
      id,
      name: draft.name || "Mon objectif",
      icon: draft.icon || Target,
      category: draft.category || "Autre",
      amount: draft.amount || 0,
      saved: 0,
      durationMonths: draft.durationMonths || 1,
      targetDate: draft.targetDate || "-",
    };
    setGoals((arr) => [...arr, g]);
    setActiveGoalId(id);
  };

  const activeGoal = goals.find((g) => g.id === activeGoalId) || goals[goals.length - 1];

  const render = () => {
    switch (screen) {
      case "welcome": return <WelcomeScreen go={go} />;
      case "signup": return <SignupScreen go={go} firstName={firstName} setFirstName={setFirstName} />;
      case "home": return <HomeScreen go={go} firstName={firstName} goals={goals} onOpenAlex={openAlex} />;
      case "transactions": return <TransactionsScreen go={go} />;
      case "txDetail": return <TxDetailScreen go={go} onConfirm={handleTxConfirm} />;
      case "goals": return (
        <GoalsScreen
          go={go}
          goals={goals}
          savingsGoals={savingsGoals}
          onGoalPress={(g) => { setActiveV3GoalId(g.id); go("goalDetail"); }}
          cluster={cluster}
          showNotif={showNotif}
          notifGoal={notifGoal}
          onDismissNotif={() => setShowNotif(false)}
        />
      );
      case "goalStep1": return <GoalStep1 go={go} draft={draft} setDraft={setDraft} prefill={prefill} />;
      case "goalStep2": return <GoalStep2 go={go} draft={draft} setDraft={setDraft} />;
      case "goalStep3": return <GoalStep3 go={go} draft={draft} onCreate={onCreate} />;
      case "goalCreated": return (
        <GoalCreatedScreen
          go={go} goal={activeGoal}
          isFromSuggestion={prefill !== null}
          onCreated={() => { setSavingsGoalCreated(true); setPrefill(null); }}
        />
      );
      case "goalDetail": {
        // If a V3 goal is selected, show the V3 detail screen with persistent AI button
        const v3Goal = activeV3GoalId ? savingsGoals.find((g) => g.id === activeV3GoalId) : null;
        if (v3Goal) {
          return (
            <V3GoalDetail
              goal={v3Goal}
              onBack={() => go("goals")}
              onRefineAI={() => {
                setDeclaredGoal(v3Goal.name);
                go("aiGoalEnrichment");
              }}
              onMonthlyChange={(newMonthly) => {
                setSavingsGoals((prev) =>
                  allocateBudget(
                    prev.map((g) => g.id === v3Goal.id ? { ...g, monthlyAmount: newMonthly } : g),
                    totalMonthlyBudget,
                  )
                );
              }}
            />
          );
        }
        return <GoalDetailScreen go={go} goal={activeGoal} />;
      }
      case "analysis": return <AnalysisScreen go={go} />;
      case "notifications": return <NotificationsScreen go={go} firstName={firstName} />;
      case "profile": return <ProfileScreen go={go} firstName={firstName} />;

      // ── V3 screens ─────────────────────────────────────────────────────────
      case "aiGoalSuggestion": {
        const preGoal = buildPrefillGoal(declaredGoal, incomeBracket, totalMonthlyBudget);
        return (
          <div className="flex flex-col h-full" style={{ background: V2C.bg }}>
            <StatusBar />
            <div className="flex items-center gap-3 px-4 pt-2 pb-3">
              <button onClick={() => go("goals")} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: V2C.text }}>←</button>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: V2C.text }}>Nouveau projet ✨</div>
                <div style={{ fontSize: 12, color: V2C.text2 }}>Personnalisé pour vous</div>
              </div>
            </div>

            {/* Goal tile picker */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: V2C.text, marginBottom: 12 }}>
                Quel est votre projet ?
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                {GOAL_TILES.map((tile) => {
                  const isSelected = declaredGoal === tile.key;
                  return (
                    <button
                      key={tile.key}
                      onClick={() => { playClick(); setDeclaredGoal(tile.key); }}
                      style={{
                        padding: "16px 10px",
                        borderRadius: 16,
                        border: `2px solid ${isSelected ? V2C.primary : V2C.border}`,
                        background: isSelected ? V2C.primaryLight : "#fff",
                        textAlign: "center",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: 26, marginBottom: 6 }}>{tile.emoji}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: isSelected ? V2C.primary : V2C.text }}>{tile.label}</div>
                      <div style={{ fontSize: 11, color: V2C.text2 }}>~{fmtAmt(tile.amount)} €</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: "12px 20px 28px", background: "#fff", boxShadow: "0 -1px 0 " + V2C.border }}>
              <button
                onClick={() => { playClick(); go("aiGoalEnrichment"); }}
                style={{
                  width: "100%", padding: "15px 0", borderRadius: 14,
                  background: V2C.primary, color: "#fff", fontSize: 16, fontWeight: 700,
                  border: "none", cursor: "pointer", marginBottom: 10,
                }}
              >
                Affiner avec l'IA ✨
              </button>
              <button
                onClick={() => {
                  playClick();
                  const goal = buildPrefillGoal(declaredGoal, incomeBracket, totalMonthlyBudget);
                  handleV3GoalComplete(goal);
                }}
                style={{
                  width: "100%", padding: "13px 0", borderRadius: 14,
                  background: "transparent", color: V2C.primary, fontSize: 14, fontWeight: 600,
                  border: `1.5px solid ${V2C.primary}`, cursor: "pointer",
                }}
              >
                Accepter la suggestion
              </button>
            </div>
          </div>
        );
      }

      case "aiGoalEnrichment":
        return (
          <AIGoalEnrichment
            userState={{ ...userState, declaredGoal }}
            onComplete={(goal) => { playClick(); handleV3GoalComplete(goal); }}
            onBack={() => go("aiGoalSuggestion")}
          />
        );

      case "addMoreProjects":
        return (
          <AddMoreProjects
            existingGoals={savingsGoals}
            onAddGoal={(key) => {
              const g = buildPrefillGoal(key, incomeBracket, Math.round(totalMonthlyBudget / (savingsGoals.length + 1)));
              addSavingsGoal(g);
            }}
            onFinish={() => {
              if (pendingV3Goal) triggerNotif(pendingV3Goal);
              go("goals");
            }}
          />
        );

      case "reactivationEmail":
        return (
          <ReactivationEmail
            goals={savingsGoals}
            declaredGoal={declaredGoal}
            userName={firstName}
            suggestedMonthly={150}
            onCTA={() => { playClick(); go("reactivationQuiz"); }}
            onDismiss={() => go("home")}
          />
        );

      case "reactivationQuiz":
        return (
          <ReactivationQuiz
            onComplete={(answers) => { playClick(); handleQuizComplete(answers); }}
            onSkip={() => go("allocationPlan")}
          />
        );

      case "allocationPlan":
        return (
          <AllocationPlan
            goals={savingsGoals.length > 0 ? savingsGoals : [buildPrefillGoal(declaredGoal, incomeBracket, 150)]}
            totalMonthly={totalMonthlyBudget}
            onConfirm={(updatedGoals, monthly) => {
              playClick();
              setSavingsGoals(updatedGoals);
              setTotalMonthlyBudget(monthly);
              setSavingsGoalCreated(true);
              go("goals");
            }}
            onBack={() => go("reactivationQuiz")}
          />
        );
      case "alexChat":
        return <AlexChat onBack={() => go("home")} flow={alexFlow} />;
    }
  };

  // ── Debug panel state + actions ─────────────────────────────────────────
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split("T")[0];
  };

  const debugState: DebugState = {
    cluster,
    declaredGoal,
    incomeBracket,
    userAge,
    savingsGoalCreated,
    firstTransactionCategorized,
    dismissedSuggestionCount: dismissedCount,
    firstTransactionDate,
    lastActiveDate,
    savingsGoals,
    totalMonthlyBudget,
    alexFlow,
  };

  const debugActions: DebugActions = {
    setCluster,
    setDeclaredGoal,
    setIncomeBracket,
    setUserAge,
    setSavingsGoalCreated,
    setFirstTransactionCategorized,
    setDismissedCount,
    setFirstTransactionDate,
    setLastActiveDate,
    setSavingsGoals,
    setAlexFlow,

    triggerProgressNotif: (_type) => {
      const goal = savingsGoals[0];
      if (!goal) return;
      triggerNotif(goal);
    },

    setGoalProgress: (percent) => {
      if (savingsGoals.length === 0) return;
      const updated = savingsGoals.map((g, i) =>
        i === 0 ? { ...g, currentAmount: Math.round(g.targetAmount * percent / 100) } : g
      );
      setSavingsGoals(updated);
      triggerNotif(updated[0]);
    },

    simulateCluster2J2: () => {
      setCluster("cluster_2");
      setFirstTransactionCategorized(true);
      setSavingsGoalCreated(false);
      setFirstTransactionDate(daysAgo(2));
      setDismissedCount(0);
    },

    simulateCluster3J14: () => {
      setCluster("cluster_3");
      setSavingsGoalCreated(false);
      setLastActiveDate(daysAgo(14));
    },

    resetFeature: () => {
      setSavingsGoalCreated(false);
      setSavingsGoals([]);
      setDismissedCount(0);
      setFirstTransactionCategorized(false);
      setFirstTransactionDate(null);
      setLastActiveDate(null);
      setShowNotif(false);
      setNotifGoal(null);
    },

    resetAll: () => {
      setScreen("welcome");
      setSavingsGoalCreated(false);
      setSavingsGoals([]);
      setGoals([]);
      setDismissedCount(0);
      setFirstTransactionCategorized(false);
      setFirstTransactionDate(null);
      setLastActiveDate(null);
      setCluster("cluster_2");
      setDeclaredGoal("voyage");
      setIncomeBracket("medium");
      setUserAge(28);
      setTotalMonthlyBudget(500);
      setShowNotif(false);
      setNotifGoal(null);
      setPrefill(null);
      setDraft({});
      setActiveGoalId(null);
      setActiveV3GoalId(null);
    },
  };

  // ── App frame ──────────────────────────────────────────────────────────
  const appFrame = (
    <div
      className="size-full phone-outer"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <div
        className="relative overflow-hidden phone-frame"
        style={{ background: C.bg }}
      >
        <div className="h-full flex flex-col">{render()}</div>

        {/* V2 · Savings goal suggestion overlay */}
        {showSuggestion && (
          <SavingsGoalSuggestion
            category={suggestionCategory}
            userAge={userAge}
            onAccept={handleSuggestionAccept}
            onDismiss={handleSuggestionDismiss}
          />
        )}
      </div>
    </div>
  );

  return (
    <DebugLayout debugState={debugState} debugActions={debugActions}>
      {appFrame}
    </DebugLayout>
  );
}
