import { useState, useEffect, useRef, useCallback, type KeyboardEvent } from "react";
import { DT } from "../types";
import { AITypingIndicator } from "../components/AITypingIndicator";
import { alexLaunch, alexSend } from "../utils/alexApi";
import type { VFButton, VFCard, VFApiResponse } from "../utils/alexApi";
import type { UserState } from "../types";

type TextMessage = { id: string; role: "ai" | "user"; kind: "text"; text: string };
type CardMessage = { id: string; role: "ai"; kind: "card"; card: VFCard };
type ChatMessage = TextMessage | CardMessage;

type Props = {
  onBack: () => void;
  userState?: UserState;
};

const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function makeSessionID() {
  return `alex_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function AlexChat({ onBack, userState }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [buttons, setButtons] = useState<VFButton[]>([]);
  const [inputText, setInputText] = useState("");
  const [typing, setTyping] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionID = useRef(makeSessionID());
  const mounted = useRef(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => { mounted.current = false; };
  }, []);

  // Scroll automatique
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing, buttons]);

  // Affichage séquentiel : un message à la fois avec indicateur entre chaque
  const applyResponse = useCallback(async (res: VFApiResponse) => {
    if (!mounted.current) return;
    setTyping(false);

    const items: ChatMessage[] = [
      ...res.messages.map((m, i) => ({
        id: `ai-${Date.now()}-${i}`,
        role: "ai" as const,
        kind: "text" as const,
        text: m.text,
      })),
      ...res.cards.map((card, i) => ({
        id: `card-${Date.now()}-${i}`,
        role: "ai" as const,
        kind: "card" as const,
        card,
      })),
    ];

    for (let i = 0; i < items.length; i++) {
      if (!mounted.current) return;
      setMessages((prev) => [...prev, items[i]]);
      if (i < items.length - 1) {
        setTyping(true);
        await pause(750);
        if (!mounted.current) return;
        setTyping(false);
      }
    }

    // Les boutons de la carte (si présente) ont priorité sur les boutons globaux
    const cardButtons = res.cards.flatMap((c) => c.buttons);
    setButtons(cardButtons.length > 0 ? cardButtons : res.buttons);
    if (res.ended) setEnded(true);
  }, []);

  // Lancement avec variables contextuelles selon le cluster
  useEffect(() => {
    let variables: Record<string, unknown> = {};

    if (userState?.cluster === "cluster_3") {
      // Client identifié → Playbook "Suggestion initiale personnalisée (Richard)"
      variables = {
        days_since_signup: 8,
        savings_goal_created_j7: false,
      };
    } else {
      // Client non-identifié → phrase d'accroche + Playbook "Âge"
      variables = {
        days_since_signup: 2,
        savings_goal_created_j7: false,
      };
    }

    setTyping(true);
    alexLaunch(sessionID.current, variables)
      .then(applyResponse)
      .catch(() => {
        if (!mounted.current) return;
        setTyping(false);
        setError("Alex n'est pas disponible pour l'instant. Vérifie ta connexion.");
      });
  }, [applyResponse]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (text: string) => {
      setButtons([]);
      setMessages((prev) => [
        ...prev,
        { id: `user-${Date.now()}`, role: "user", kind: "text", text },
      ]);
      setTyping(true);
      try {
        const res = await alexSend(sessionID.current, text);
        applyResponse(res);
      } catch {
        if (!mounted.current) return;
        setTyping(false);
        setError("Erreur de connexion avec Alex.");
      }
    },
    [applyResponse]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: DT.bg }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "16px 20px",
          background: DT.surface,
          boxShadow: "0 1px 0 " + DT.border,
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: DT.text, padding: 0, lineHeight: 1 }}
        >
          ←
        </button>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #6C63FF, #897FFF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          💼
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DT.text }}>Alex</div>
          <div style={{ fontSize: 11, color: DT.success, fontWeight: 500 }}>● Conseiller WiseWallet</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 0 8px" }}>
        {error ? (
          <div style={{ margin: "24px 16px", padding: 16, background: DT.dangerLight, borderRadius: 14, color: DT.danger, fontSize: 14, textAlign: "center" }}>
            {error}
          </div>
        ) : (
          <>
            {messages.map((msg) =>
              msg.kind === "card" ? (
                <ValidationCard key={msg.id} card={msg.card} onSelect={sendMessage} />
              ) : msg.role === "ai" ? (
                <AIBubble key={msg.id} text={msg.text} />
              ) : (
                <UserBubble key={msg.id} text={msg.text} />
              )
            )}
            {typing && <AITypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Zone de réponse */}
      <div style={{ background: DT.surface, boxShadow: "0 -1px 0 " + DT.border, flexShrink: 0 }}>
        {ended ? (
          <div style={{ padding: "12px 16px" }}>
            <button
              onClick={onBack}
              style={{ width: "100%", padding: "15px 0", borderRadius: DT.r.button, background: "#6C63FF", color: "#fff", fontSize: 16, fontWeight: 700, border: "none", cursor: "pointer" }}
            >
              Retour à l'accueil
            </button>
          </div>
        ) : buttons.length > 0 && !typing ? (
          <div style={{ padding: "10px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {buttons.map((b) => (
              <button
                key={b.label}
                onClick={() => sendMessage(b.label)}
                style={{ padding: "10px 16px", borderRadius: 100, background: DT.primaryLight, color: DT.primary, fontSize: 14, fontWeight: 600, border: `1.5px solid ${DT.primary}`, cursor: "pointer" }}
              >
                {b.label}
              </button>
            ))}
          </div>
        ) : !typing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Enter" && inputText.trim()) {
                  sendMessage(inputText.trim());
                  setInputText("");
                }
              }}
              placeholder="Écris ta réponse…"
              style={{ flex: 1, padding: "12px 16px", borderRadius: 100, border: `1.5px solid ${DT.border}`, fontSize: 14, color: DT.text, background: DT.bg, outline: "none" }}
            />
            <button
              onClick={() => { if (inputText.trim()) { sendMessage(inputText.trim()); setInputText(""); } }}
              style={{ width: 44, height: 44, borderRadius: "50%", background: inputText.trim() ? "#6C63FF" : DT.border, border: "none", cursor: inputText.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0, transition: "background 0.2s" }}
            >
              ➤
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── Composants de rendu ───────────────────────────────────────────────────

function RichText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function AIBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: "4px 16px", marginBottom: 4 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #6C63FF, #897FFF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
        💼
      </div>
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

function ValidationCard({ card, onSelect }: { card: VFCard; onSelect: (label: string) => void }) {
  return (
    <div style={{ padding: "4px 16px", marginBottom: 8 }}>
      <div
        style={{
          background: DT.surface,
          borderRadius: 18,
          boxShadow: DT.cardShadow,
          border: `1.5px solid #6C63FF22`,
          overflow: "hidden",
        }}
      >
        {/* Titre de la carte */}
        <div
          style={{
            background: "linear-gradient(135deg, #6C63FF, #897FFF)",
            padding: "12px 16px",
          }}
        >
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700 }}>{card.title}</div>
        </div>

        {/* Contenu */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: 13, color: DT.text, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            <RichText text={card.description} />
          </div>
        </div>

        {/* Boutons de la carte */}
        {card.buttons.length > 0 && (
          <div style={{ padding: "0 12px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            {card.buttons.map((b) => (
              <button
                key={b.label}
                onClick={() => onSelect(b.label)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 100,
                  background: b.label.startsWith("✓") ? "#6C63FF" : DT.primaryLight,
                  color: b.label.startsWith("✓") ? "#fff" : DT.primary,
                  fontSize: 14,
                  fontWeight: 600,
                  border: `1.5px solid #6C63FF`,
                  cursor: "pointer",
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
