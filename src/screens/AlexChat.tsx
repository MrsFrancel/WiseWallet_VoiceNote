import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { DT } from "../types";
import { AITypingIndicator } from "../components/AITypingIndicator";
import { getStep, getStartId, initCtx } from "../constants/alexFlows";
import type { AlexCtx, ValidationCard } from "../constants/alexFlows";
import type { AlexMode } from "../types";

type TextMsg = { id: string; role: "ai" | "user"; kind: "text"; text: string };
type CardMsg = { id: string; role: "ai"; kind: "card"; card: ValidationCard };
type ChatMsg = TextMsg | CardMsg;

type Props = {
  onBack: () => void;
  flow: AlexMode;
};

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function AlexChat({ onBack, flow }: Props) {
  const [messages,   setMessages]   = useState<ChatMsg[]>([]);
  const [buttons,    setButtons]    = useState<string[]>([]);
  const [multiOpts,  setMultiOpts]  = useState<string[]>([]);
  const [multiSel,   setMultiSel]   = useState<string[]>([]);
  const [inputText,  setInputText]  = useState("");
  const [typing,     setTyping]     = useState(false);
  const [ended,      setEnded]      = useState(false);
  const [activeCard, setActiveCard] = useState<ValidationCard | null>(null);

  const ctxRef    = useRef<AlexCtx>(initCtx(flow));
  const stepRef   = useRef<string>(getStartId(flow));
  const mounted   = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, buttons, multiOpts]);

  const showMessages = useCallback(async (texts: string[]) => {
    for (let i = 0; i < texts.length; i++) {
      if (!mounted.current) return;
      if (i > 0) {
        setTyping(true);
        await pause(750);
        if (!mounted.current) return;
        setTyping(false);
      }
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}-${i}`, role: "ai", kind: "text", text: texts[i] },
      ]);
    }
  }, []);

  const presentStep = useCallback(async (id: string, ctx: AlexCtx) => {
    if (!mounted.current) return;
    if (id === "end") { setEnded(true); return; }

    const step = getStep(id);
    if (!step) { setEnded(true); return; }

    const msgs = step.messages(ctx);
    if (msgs.length > 0) {
      setTyping(true);
      await pause(800);
      if (!mounted.current) return;
      setTyping(false);
      await showMessages(msgs);
    }

    if (!mounted.current) return;

    // Résoudre autoAdvance (boolean ou function)
    const shouldAutoAdvance = typeof step.autoAdvance === "function"
      ? step.autoAdvance(ctx)
      : !!step.autoAdvance;

    if (shouldAutoAdvance) {
      await pause(600);
      if (!mounted.current) return;
      const { nextId, ctx: newCtx, card } = step.onInput("", ctx);
      ctxRef.current  = newCtx;
      stepRef.current = nextId;
      if (card) {
        setTyping(true);
        await pause(700);
        if (!mounted.current) return;
        setTyping(false);
        setMessages((prev) => [
          ...prev,
          { id: `card-${Date.now()}`, role: "ai", kind: "card", card },
        ]);
        setActiveCard(card);
        return;
      }
      await presentStep(nextId, newCtx);
      return;
    }

    if (step.multiSelect) {
      const opts = step.buttons ? step.buttons(ctx) : [];
      setMultiOpts(opts);
      setMultiSel([]);
      setButtons([]);
    } else if (step.buttons) {
      setButtons(step.buttons(ctx));
      setMultiOpts([]);
    } else {
      setButtons([]);
      setMultiOpts([]);
    }
  }, [showMessages]);

  useEffect(() => {
    presentStep(getStartId(flow), ctxRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInput = useCallback(async (input: string) => {
    if (!mounted.current || ended) return;
    const step = getStep(stepRef.current);
    if (!step) return;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", kind: "text", text: input },
    ]);
    setButtons([]);
    setMultiOpts([]);
    setInputText("");

    const { nextId, ctx, card } = step.onInput(input, ctxRef.current);
    ctxRef.current  = ctx;
    stepRef.current = nextId;

    if (card) {
      setTyping(true);
      await pause(800);
      if (!mounted.current) return;
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: `card-${Date.now()}`, role: "ai", kind: "card", card },
      ]);
      setActiveCard(card);
      return;
    }

    await presentStep(nextId, ctx);
  }, [ended, presentStep]);

  const handleCardAction = useCallback(async (card: ValidationCard, action: "validate" | "edit") => {
    setActiveCard(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-card-${Date.now()}`,
        role: "user",
        kind: "text",
        text: action === "validate" ? card.buttons[0] : card.buttons[1],
      },
    ]);

    if (action === "edit") {
      stepRef.current = card.onEdit;
      await presentStep(card.onEdit, ctxRef.current);
    } else {
      stepRef.current = card.onValidate;
      await presentStep(card.onValidate, ctxRef.current);
    }
  }, [presentStep]);

  const toggleMulti = (opt: string) => {
    setMultiSel((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]);
  };

  const confirmMulti = () => {
    if (multiSel.length === 0) return;
    setMultiOpts([]);
    handleInput(JSON.stringify(multiSel));
  };

  const step = getStep(stepRef.current);
  const isTextInput = !ended && !activeCard && buttons.length === 0 && multiOpts.length === 0 && step?.buttons === null;

  // Label du flow pour l'en-tête
  const flowLabel = flow === "cluster3_actif" ? "Richard — Voyage" : flow === "cluster3_passif" ? "Richard — Générique" : "Client Non-identifié";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: DT.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: DT.surface, boxShadow: "0 1px 0 " + DT.border, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: DT.text, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #6C63FF, #897FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: DT.text }}>Alex</div>
          <div style={{ fontSize: 11, color: DT.success, fontWeight: 500 }}>● Conseiller WiseWallet</div>
        </div>
        <div style={{ fontSize: 10, color: DT.text2, background: DT.border, borderRadius: 6, padding: "3px 7px" }}>{flowLabel}</div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px" }}>
        {messages.map((msg) =>
          msg.kind === "card" ? (
            <CardBubble key={msg.id} card={msg.card} isActive={activeCard === msg.card} onAction={handleCardAction} />
          ) : msg.role === "ai" ? (
            <AIBubble key={msg.id} text={msg.text} />
          ) : (
            <UserBubble key={msg.id} text={msg.text} />
          )
        )}
        {typing && <AITypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Zone de réponse */}
      <div style={{ background: DT.surface, boxShadow: "0 -1px 0 " + DT.border, flexShrink: 0 }}>
        {ended ? (
          <div style={{ padding: "12px 16px" }}>
            <button onClick={onBack} style={{ width: "100%", padding: "15px 0", borderRadius: DT.r.button, background: "#6C63FF", color: "#fff", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer" }}>
              Retour à l'accueil
            </button>
          </div>
        ) : multiOpts.length > 0 ? (
          <div style={{ padding: "10px 12px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {multiOpts.map((opt) => {
                const sel = multiSel.includes(opt);
                return (
                  <button key={opt} onClick={() => toggleMulti(opt)}
                    style={{ padding: "10px 16px", borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: "pointer", border: `1.5px solid ${sel ? "#6C63FF" : DT.border}`, background: sel ? "#6C63FF" : DT.bg, color: sel ? "#fff" : DT.text, transition: "all 0.15s" }}>
                    {opt}
                  </button>
                );
              })}
            </div>
            {multiSel.length > 0 && (
              <button onClick={confirmMulti} style={{ width: "100%", padding: "12px 0", borderRadius: DT.r.button, background: "#6C63FF", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>
                Valider ({multiSel.length} projet{multiSel.length > 1 ? "s" : ""}) →
              </button>
            )}
          </div>
        ) : buttons.length > 0 && !typing ? (
          <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {buttons.map((b) => (
              <button key={b} onClick={() => handleInput(b)}
                style={{ padding: "10px 16px", borderRadius: 100, background: DT.primaryLight, color: DT.primary, fontSize: 14, fontWeight: 600, border: `1.5px solid ${DT.primary}`, cursor: "pointer" }}>
                {b}
              </button>
            ))}
          </div>
        ) : isTextInput && !typing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
            <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter" && inputText.trim()) handleInput(inputText.trim()); }}
              placeholder="Écris ta réponse…"
              style={{ flex: 1, padding: "12px 16px", borderRadius: 100, border: `1.5px solid ${DT.border}`, fontSize: 14, color: DT.text, background: DT.bg, outline: "none" }} />
            <button onClick={() => { if (inputText.trim()) handleInput(inputText.trim()); }}
              style={{ width: 44, height: 44, borderRadius: "50%", background: inputText.trim() ? "#6C63FF" : DT.border, border: "none", cursor: inputText.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "background 0.2s" }}>
              ➤
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Composants ─────────────────────────────────────────────────────────────

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function AIBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "4px 16px", marginBottom: 4 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6C63FF, #897FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>💼</div>
      <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: "18px 18px 18px 4px", background: DT.surface, boxShadow: DT.cardShadow, fontSize: 14, color: DT.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        <RichText text={text} />
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 16px", marginBottom: 4 }}>
      <div style={{ maxWidth: "65%", padding: "10px 14px", borderRadius: "18px 18px 4px 18px", background: DT.primary, color: "#fff", fontSize: 14, fontWeight: 500, lineHeight: 1.55 }}>
        {text}
      </div>
    </div>
  );
}

function CardBubble({ card, isActive, onAction }: {
  card: ValidationCard;
  isActive: boolean;
  onAction: (card: ValidationCard, action: "validate" | "edit") => void;
}) {
  return (
    <div style={{ padding: "4px 16px", marginBottom: 8 }}>
      <div style={{ background: DT.surface, borderRadius: 18, boxShadow: DT.cardShadow, border: "1.5px solid #6C63FF22", overflow: "hidden" }}>
        <div style={{ background: "linear-gradient(135deg, #6C63FF, #897FFF)", padding: "12px 16px" }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{card.title}</div>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <pre style={{ fontSize: 13, color: DT.text, lineHeight: 1.8, margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>
            {card.body}
          </pre>
        </div>
        {isActive && (
          <>
            <div style={{ padding: "0 16px 10px", fontSize: 14, color: DT.text, fontWeight: 600 }}>
              {card.confirmQuestion}
            </div>
            <div style={{ padding: "0 12px 12px", display: "flex", gap: 8 }}>
              {card.buttons.map((label, i) => (
                <button key={label} onClick={() => onAction(card, i === 0 ? "validate" : "edit")}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 100, background: i === 0 ? "#6C63FF" : DT.primaryLight, color: i === 0 ? "#fff" : DT.primary, fontSize: 14, fontWeight: i === 0 ? 700 : 600, border: `1.5px solid #6C63FF`, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
