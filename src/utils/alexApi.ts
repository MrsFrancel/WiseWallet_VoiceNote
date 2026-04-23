const API_KEY = "VF.DM.69e9cd55ff54563e95cea270.FIykvB5kbHcVLnyj";
const BASE_URL = "https://general-runtime.voiceflow.com";
const VERSION_ID = "development";

export type VFButton = { label: string };
export type VFMessage = { text: string };
export type VFCard = {
  title: string;
  description: string;
  buttons: VFButton[];
};
export type VFApiResponse = {
  messages: VFMessage[];
  buttons: VFButton[];
  cards: VFCard[];
  ended: boolean;
};

type RawTrace = {
  type: string;
  payload?: Record<string, unknown>;
};

function parseTraces(traces: RawTrace[]): VFApiResponse {
  const messages: VFMessage[] = [];
  const buttons: VFButton[] = [];
  const cards: VFCard[] = [];
  let ended = false;

  for (const trace of traces) {
    const p = trace.payload ?? {};

    if (trace.type === "text" && typeof p.message === "string") {
      messages.push({ text: p.message });

    } else if (trace.type === "choice" && Array.isArray(p.buttons)) {
      (p.buttons as Array<{ name: string }>).forEach((b) =>
        buttons.push({ label: b.name })
      );

    } else if (trace.type === "cardV2") {
      const desc = p.description as { text?: string } | string | undefined;
      cards.push({
        title: typeof p.title === "string" ? p.title : "",
        description: typeof desc === "object" && desc !== null
          ? (desc.text ?? "")
          : typeof desc === "string" ? desc : "",
        buttons: Array.isArray(p.buttons)
          ? (p.buttons as Array<{ name: string }>).map((b) => ({ label: b.name }))
          : [],
      });

    } else if (trace.type === "end") {
      ended = true;
    }
  }

  return { messages, buttons, cards, ended };
}

async function interact(userID: string, action: unknown): Promise<VFApiResponse> {
  const res = await fetch(
    `${BASE_URL}/state/user/${encodeURIComponent(userID)}/interact`,
    {
      method: "POST",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
        versionID: VERSION_ID,
      },
      body: JSON.stringify({ action }),
    }
  );
  if (!res.ok) throw new Error(`Alex API ${res.status}`);
  const traces: RawTrace[] = await res.json();
  return parseTraces(traces);
}

async function setVariables(userID: string, variables: Record<string, unknown>): Promise<void> {
  await fetch(
    `${BASE_URL}/state/user/${encodeURIComponent(userID)}/variables`,
    {
      method: "PATCH",
      headers: {
        Authorization: API_KEY,
        "Content-Type": "application/json",
        versionID: VERSION_ID,
      },
      body: JSON.stringify(variables),
    }
  );
}

export async function alexLaunch(
  userID: string,
  variables?: Record<string, unknown>
): Promise<VFApiResponse> {
  if (variables && Object.keys(variables).length > 0) {
    await setVariables(userID, variables);
  }
  return interact(userID, { type: "launch" });
}

export const alexSend = (userID: string, text: string) =>
  interact(userID, { type: "text", payload: text });
