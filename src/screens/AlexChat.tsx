import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { DT } from "../types";
import { AITypingIndicator } from "../components/AITypingIndicator";
import { getStep, initCtx, afterValidation } from "../constants/alexFlows";
import type { AlexCtx, ValidationCard } from "../constants/alexFlows";
import type { UserState } from "../types";

type TextMsg  = { id: string; role: "ai" | "user"; kind: "text"; text: string };
type CardMsg  = { id: string; role: "ai"; kind: "card"; card: ValidationCard };
type ChatMsg  = TextMsg | CardMsg;

type Props = {
  onBack: () => void;
  userState?: UserState;
};

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function AlexChat({ onBack, userState }: Props) {
  const mode = userState?.cluster === "cluster_3" ? "cluster3" : "cluster2";
  const startId = mode === "cluster3" ? "richard" : "welcome";

  const [messages,      setMessages]      = useState<ChatMsg[]>([]);
  const [buttons,       setButtons]       = useState<string[]>([]);
  const [multiOpts,     setMultiOpts]     = useState<string[]>([]);
  const [multiSel,      setMultiSel]      = useState<string[]>([]);
  const [inputText,     setInputText]     = useState("");
  const [typing,        setTyping]        = useState(false);
  const [ended,         setEnded]         = useState(false);
  const [activeCard,    setActiveCard]    = useState<ValidationCard | null>(null);
  const [pendingCard,   setPendingCard]   = useState<ValidationCard | null>(null);

  const ctxRef    = useRef<AlexCtx>(initCtx(mode));
  const stepRef   = useRef<string>(startId);
  const mounted   = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, buttons, multiOpts]);

  // Affiche une séquence de messages l'un après l'autre
  const showMessages = useCallback(async (texts: string[]) => {
    for (let i = 0; i < texts.length; i++) {
      if (!mounted.current) return;
      if (i > 0) { setTyping(true); await pause(750); if (!mounted.current) return; setTyping(false); }
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}-${i}`, role: "ai", kind: "text", text: texts[i] }]);
    }
  }, []);

  // Présente l'étape courante (messages + boutons/input)
  const presentStep = useCallback(async (id: string, ctx: AlexCtx) => {
    if (!mounted.current) return;
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

    // Step autoAvance : pas d'input utilisateur, on enchaîne directement
    if (step.autoAdvance) {
      await pause(600);
      if (!mounted.current) return;
      const { nextId, ctx: newCtx } = step.onInput("", ctx);
      ctxRef.current = newCtx;
      stepRef.current = nextId;
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

  // Lancement au montage
  useEffect(() => {
    presentStep(startId, ctxRef.current);
  }, [presentStep, startId]);

  // Traitement d'une réponse utilisateur (texte ou bouton)
  const handleInput = useCallback(async (input: string) => {
    if (!mounted.current) return;
    const step = getStep(stepRef.current);
    if (!step || ended) return;

    // Affiche la bulle utilisateur
    setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", kind: "text", text: input }]);
    setButtons([]);
    setMultiOpts([]);
    setInputText("");

    const { nextId, ctx, card } = step.onInput(input, ctxRef.current);
    ctxRef.current = ctx;

    if (card) {
      // Affichage de la carte de validation
      setTyping(true);
      await pause(800);
      if (!mounted.current) return;
      setTyping(false);
      setMessages((prev) => [...prev, { id: `card-${Date.now()}`, role: "ai", kind: "card", card }]);
      setActiveCard(card);
      stepRef.current = nextId; // on garde nextId pour savoir où reprendre si ✏️
      return;
    }

    stepRef.current = nextId;

    if (nextId === "end") { setEnded(true); return; }
    if (nextId === "show_card") {
      // buildValidationCard a produit un card mais sans le retourner via card prop — ne devrait pas arriver
      return;
    }

    await presentStep(nextId, ctx);
  }, [ended, presentStep]);

  // Validation ou modification d'une carte
  const handleCardAction = useCallback(async (card: ValidationCard, action: "validate" | "edit") => {
    setActiveCard(null);
    setMessages((prev) => [...prev, {
      id: `user-card-${Date.now()}`, role: "user", kind: "text",
      text: action === "validate" ? "✓ C'est bon" : "✏️ Je veux modifier",
    }]);

    if (action === "edit") {
      // Retour à l'étape budget du projet courant
      stepRef.current = card.onEdit;
      await presentStep(card.onEdit, ctxRef.current);
    } else {
      // Projet validé → suivant ou notifications
      const { nextId, ctx } = afterValidation(ctxRef.current);
      ctxRef.current = ctx;
      stepRef.current = nextId;
      await presentStep(nextId, ctx);
    }
  }, [presentStep]);

  // Multi-select : toggle
  const toggleMulti = (opt: string) => {
    setMultiSel((prev) => prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]);
  };

  const confirmMulti = () => {
    if (multiSel.length === 0) return;
    const input = JSON.stringify(multiSel);
    setMultiOpts([]);
    handleInput(input);
  };

  const step = getStep(stepRef.current);
  const isTextInput = !ended && !activeCard && buttons.length === 0 && multiOpts.length === 0 && step?.buttons === null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: DT.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", background: DT.surface, boxShadow: "0 1px 0 " + DT.border, flexShrink: 0 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: DT.text, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #6C63FF, #897FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>💼</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DT.text }}>Alex</div>
          <div style={{ fontSize: 11, color: DT.success, fontWeight: 500 }}>● Conseiller WiseWallet</div>
        </div>
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
          /* Multi-select projets */
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
              <button onClick={confirmMulti}
                style={{ width: "100%", padding: "12px 0", borderRadius: DT.r.button, background: "#6C63FF", color: "#fff", fontSize: 15, fontWeight: 700, border: "none", cursor: "pointer" }}>
                Valider ({multiSel.length} projet{multiSel.length > 1 ? "s" : ""}) →
              </button>
            )}
          </div>
        ) : buttons.length > 0 && !typing ? (
          /* Boutons simples */
          <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {buttons.map((b) => (
              <button key={b} onClick={() => handleInput(b)}
                style={{ padding: "10px 16px", borderRadius: 100, background: DT.primaryLight, color: DT.primary, fontSize: 14, fontWeight: 600, border: `1.5px solid ${DT.primary}`, cursor: "pointer" }}>
                {b}
              </button>
            ))}
          </div>
        ) : isTextInput && !typing ? (
          /* Champ texte libre */
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

// ── Composants ────────────────────────────────────────────────────────────

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
          <div style={{ fontSize: 13, color: DT.text, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
            {card.body}
          </div>
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
