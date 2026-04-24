/**
 * Reproduction fidèle des flows Voiceflow d'Alex (WiseWallet)
 * Source : My_first_AI_agent-2026-04-23_20-39.vf + alex_knowledge.json
 * 3 flows : cluster2 · cluster3_actif · cluster3_passif
 */

import type { AlexMode } from "../types";

export type Profile = "unknown" | "junior" | "cible" | "secondaire" | "senior";

export type AlexCtx = {
  mode: AlexMode;
  profile: Profile;
  prenom: string;
  revenus: string;
  projets: string[];
  currentProjIdx: number;
  budgets: Record<string, number>;
  horizons: Record<string, number>; // en mois
  epargne: number;
  notifActive: boolean;
  notifJour: string;
  repartitionMode: string;
};

export type ValidationCard = {
  title: string;
  body: string;
  confirmQuestion: string;
  buttons: string[];
  onValidate: string;
  onEdit: string;
};

export type StepOutput = {
  nextId: string;
  ctx: AlexCtx;
  card?: ValidationCard;
};

export type AlexStep = {
  id: string;
  messages: (ctx: AlexCtx) => string[];
  buttons: ((ctx: AlexCtx) => string[]) | null;
  multiSelect?: true;
  autoAdvance?: boolean | ((ctx: AlexCtx) => boolean);
  onInput: (input: string, ctx: AlexCtx) => StepOutput;
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function initCtx(mode: AlexMode): AlexCtx {
  return {
    mode, profile: "unknown", prenom: "",
    revenus: "", projets: [], currentProjIdx: 0,
    budgets: {}, horizons: {}, epargne: 0,
    notifActive: false, notifJour: "", repartitionMode: "",
  };
}

function p(ctx: AlexCtx, opts: { junior: string; cible: string; secondaire: string; senior: string }): string {
  if (ctx.profile === "junior")     return opts.junior;
  if (ctx.profile === "secondaire") return opts.secondaire;
  if (ctx.profile === "senior")     return opts.senior;
  return opts.cible;
}

function parseAmount(str: string): number | null {
  const clean = str.replace(/\s/g, "").replace("€", "").replace(",", ".");
  const m = clean.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function parseHorizon(str: string): number | null {
  if (/6\s*mois/i.test(str))  return 6;
  if (/1\s*an/i.test(str))    return 12;
  if (/2\s*ans/i.test(str))   return 24;
  if (/3\s*ans/i.test(str))   return 36;
  const mois = str.match(/(\d+)\s*mois/i);
  if (mois) return parseInt(mois[1]);
  const ans  = str.match(/(\d+)\s*an/i);
  if (ans)  return parseInt(ans[1]) * 12;
  return null;
}

function currentProjet(ctx: AlexCtx): string {
  return ctx.projets[ctx.currentProjIdx] ?? "";
}

function fmtMois(n: number): string {
  if (n <= 0)  return "atteint";
  if (n < 12)  return `${n} mois`;
  const y = Math.floor(n / 12), m = n % 12;
  return m > 0 ? `${y} an${y > 1 ? "s" : ""} ${m} mois` : `${y} an${y > 1 ? "s" : ""}`;
}

const BUDGET_BUTTONS: Record<string, string[]> = {
  "✈️ Voyage":                ["500 €", "1 000 €", "1 500 €", "2 000 €", "✏️ Autre montant"],
  "🚗 Voiture":               ["3 000 €", "5 000 €", "8 000 €", "12 000 €", "✏️ Autre montant"],
  "🏠 Immobilier":            ["10 000 €", "15 000 €", "20 000 €", "30 000 €", "✏️ Autre montant"],
  "🛡️ Épargne de précaution": ["1 500 €", "3 000 €", "5 000 €", "✏️ Autre montant"],
  "🛟 Épargne de précaution": ["1 500 €", "3 000 €", "5 000 €", "✏️ Autre montant"],
  "👴 Retraite":              ["10 000 €", "20 000 €", "50 000 €", "✏️ Autre montant"],
  "💳 Remboursement crédit":  ["1 000 €", "3 000 €", "5 000 €", "10 000 €", "✏️ Autre montant"],
  "🎯 Autre":                 ["500 €", "1 000 €", "2 000 €", "5 000 €", "✏️ Autre montant"],
  "✏️ Autre":                 ["500 €", "1 000 €", "2 000 €", "5 000 €", "✏️ Autre montant"],
};

const EPARGNE_BUTTONS: Record<Profile, string[]> = {
  unknown:    ["200 €", "300 €", "500 €", "700 €", "✏️ Autre montant"],
  junior:     ["50 €", "100 €", "150 €", "200 €", "✏️ Autre montant"],
  cible:      ["200 €", "300 €", "500 €", "700 €", "✏️ Autre montant"],
  secondaire: ["300 €", "500 €", "800 €", "1 000 €", "✏️ Autre montant"],
  senior:     ["500 €", "800 €", "1 000 €", "1 500 €", "✏️ Autre montant"],
};

function buildValidationCard(
  ctx: AlexCtx,
  onValidate = "projet_ajoute",
  onEdit = "budget_projet",
): StepOutput {
  const proj      = currentProjet(ctx);
  const budget    = ctx.budgets[proj]  ?? 0;
  const horizon   = ctx.horizons[proj] ?? 12;
  const mensualite = Math.ceil(budget / horizon);

  const card: ValidationCard = {
    title: proj || "Projet d'épargne",
    body:  `Objectif   : ${budget.toLocaleString("fr-FR")} €\nDurée      : ${fmtMois(horizon)}\nMensualité : ${mensualite} €/mois`,
    confirmQuestion: p(ctx, {
      junior:     "Ça te convient ? 😊",
      cible:      "C'est good pour toi ? 👌",
      secondaire: "Ce plan te convient ? 👌",
      senior:     "C'est bien cela ?",
    }),
    buttons:    ["✓ C'est bon", "✏️ Je veux modifier"],
    onValidate,
    onEdit,
  };
  return { nextId: "show_card", ctx, card };
}

// ── ÉTAPE CALCUL — logique centralisée ───────────────────────────────────
function routeAfterEpargne(ctx: AlexCtx): StepOutput {
  const proj       = currentProjet(ctx);
  const budget     = ctx.budgets[proj]  ?? 0;
  const horizon    = ctx.horizons[proj] ?? 12;
  const mensualite = Math.ceil(budget / horizon);
  if (mensualite <= ctx.epargne) return buildValidationCard(ctx);
  return { nextId: "calcul_depassement", ctx };
}

// ═══════════════════════════════════════════════════════════════════════════
// STEPS
// ═══════════════════════════════════════════════════════════════════════════

const steps: AlexStep[] = [

  // ── FLOW CLUSTER_2 — Client Non-identifié ─────────────────────────────

  {
    id: "welcome",
    messages: () => [
      "Salut ! Moi, c'est Alex, ton conseiller épargne chez WiseWallet 💼💡\n\nJe peux t'aider à construire un plan d'épargne personnalisé en quelques minutes ⏱️\n\nPour commencer, comment tu t'appelles ?",
    ],
    buttons: null,
    onInput: (input, ctx) => ({
      nextId: "age",
      ctx: { ...ctx, prenom: input.trim() || "toi" },
    }),
  },

  {
    id: "age",
    messages: (ctx) => [
      `Enchanté(e) ${ctx.prenom} 😊 Pour te conseiller au mieux, j'aurais besoin d'en savoir un peu plus sur toi. Quel âge as-tu ?`,
    ],
    buttons: () => ["- de 25 ans", "25 – 34 ans", "35 – 50 ans", "+ de 50 ans"],
    onInput: (input, ctx) => {
      let profile: Profile = "cible";
      if (input === "- de 25 ans")  profile = "junior";
      else if (input === "35 – 50 ans") profile = "secondaire";
      else if (input === "+ de 50 ans") profile = "senior";
      return { nextId: "age_transition", ctx: { ...ctx, profile } };
    },
  },

  {
    id: "age_transition",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Super ${ctx.prenom} ! 🙌 T'inquiète, même avec un petit budget on peut construire quelque chose de bien.`,
        cible:      `Nickel ${ctx.prenom} ! 👌 C'est le bon moment pour se lancer.`,
        secondaire: `Parfait ${ctx.prenom} 👍 On va construire un plan solide adapté à tes objectifs.`,
        senior:     `Enchanté(e) ${ctx.prenom} 😊 On va construire quelque chose de rassurant et bien structuré ensemble.`,
      }),
    ],
    buttons: null,
    autoAdvance: true,
    onInput: (_input, ctx) => ({ nextId: "revenus", ctx }),
  },

  {
    id: "revenus",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Très bien, 😊 \nMême avec un petit budget on peut faire des trucs cool, tu aurais une idée de ton salaire annuel ?",
        cible:      "Très bien, 🙌 \nPour te faire des suggestions qui collent vraiment à ta vie, t'aurais une idée de ton salaire annuel ?",
        secondaire: "Très bien, 👋 \nPour construire un plan vraiment adapté à ta situation, j'aurais besoin de connaître tes revenus annuels.",
        senior:     "Très bien, 😊 \nPour vous proposer des recommandations adaptées à votre situation, pourriez-vous m'indiquer votre salaire / retraite annuel ?",
      }),
    ],
    buttons: () => ["< 25 000 €", "25 000 – 40 000 €", "40 000 – 60 000 €", "60 000 – 80 000 €", "> 80 000 €"],
    onInput: (input, ctx) => {
      let profile = ctx.profile;
      if (profile === "unknown") {
        if (input === "< 25 000 €") profile = "junior";
        else if (input === "> 80 000 €") profile = "senior";
        else profile = "cible";
      }
      return { nextId: "projets", ctx: { ...ctx, revenus: input, profile } };
    },
  },

  {
    id: "projets",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Merci ${ctx.prenom} 😊 \nTu as des projets en tête ? Un voyage, une voiture, une épargne de secours ? \nChoisis tout ce qui t'intéresse !`,
        cible:      `Top, merci ${ctx.prenom} 👌 \nTu as déjà des projets en tête pour lesquels tu voudrais épargner ? \nSélectionne tout ce qui te parle !`,
        secondaire: `Merci ${ctx.prenom} 👍 \nQuels sont les objectifs pour lesquels tu souhaiterais épargner ? \nTu peux en sélectionner plusieurs.`,
        senior:     `Merci ${ctx.prenom} 😊 \nPour quels projets souhaiteriez-vous épargner ? \nVous pouvez en sélectionner plusieurs.`,
      }),
    ],
    buttons: () => ["✈️ Voyage", "🚗 Voiture", "🏠 Immobilier", "🛡️ Épargne de précaution", "👴 Retraite", "💳 Remboursement crédit", "✏️ Autre"],
    multiSelect: true,
    onInput: (input, ctx) => {
      let projets: string[] = [];
      try { projets = JSON.parse(input); } catch { projets = [input]; }
      return { nextId: "projets_autre_check", ctx: { ...ctx, projets } };
    },
  },

  {
    id: "projets_autre_check",
    messages: (ctx) => {
      if (ctx.projets.includes("✏️ Autre")) {
        return [
          p(ctx, {
            junior:     "Dis-moi c'est quoi ! 😊",
            cible:      "C'est quoi ton projet ? Dis-moi en quelques mots 😊",
            secondaire: "Quel est votre projet ? Décrivez-le en quelques mots.",
            senior:     "Quel est votre projet ? Décrivez-le brièvement.",
          }),
        ];
      }
      return [];
    },
    buttons: (ctx) => ctx.projets.includes("✏️ Autre") ? null : null,
    autoAdvance: (ctx) => !ctx.projets.includes("✏️ Autre"),
    onInput: (input, ctx) => {
      let projets = ctx.projets.filter(p => p !== "✏️ Autre");
      if (input && input.trim()) projets = [...projets, input.trim()];
      return { nextId: "confirm_projets", ctx: { ...ctx, projets } };
    },
  },

  {
    id: "confirm_projets",
    messages: (ctx) => {
      const liste = ctx.projets.join(", ");
      return [
        p(ctx, {
          junior:     `Super, voilà ce que t'as choisi 🙌 : ${liste}.\nÇa te va ?`,
          cible:      `OK, j'ai bien noté tes projets 👌 : ${liste}.\nC'est bon ?`,
          secondaire: `Voici les objectifs que tu as sélectionnés 👍 : ${liste}.\nC'est correct ?`,
          senior:     `Voici les projets que vous avez sélectionnés : ${liste}.\nC'est bien cela ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui c'est ça", "✏️ Je veux modifier"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je veux modifier") return { nextId: "projets", ctx: { ...ctx, projets: [] } };
      if (ctx.projets.length === 1) return { nextId: "single_projet_confirm", ctx };
      return { nextId: "priorites", ctx: { ...ctx, currentProjIdx: 0 } };
    },
  },

  {
    id: "single_projet_confirm",
    messages: (ctx) => {
      const proj = ctx.projets[0];
      return [
        p(ctx, {
          junior:     `OK, ${proj} ! 🙌 C'est le seul projet sur lequel tu veux te concentrer ?`,
          cible:      `T'as choisi ${proj} 🎯 C'est bien ton seul projet pour l'instant ?`,
          secondaire: `Tu as sélectionné ${proj} 👍 C'est bien l'unique objectif sur lequel tu souhaites travailler pour le moment ?`,
          senior:     `Vous avez choisi ${proj} 😊 C'est bien le seul projet sur lequel vous souhaitez vous concentrer pour l'instant ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui, un seul projet", "+ Ajouter d'autres projets"],
    onInput: (input, ctx) => {
      if (input === "+ Ajouter d'autres projets") return { nextId: "projets", ctx: { ...ctx, projets: [] } };
      return { nextId: "single_reassurance", ctx: { ...ctx, currentProjIdx: 0 } };
    },
  },

  {
    id: "single_reassurance",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Super choix ! 🎉 Commencer par un seul objectif c'est exactement la bonne approche. On y va !",
        cible:      "Nickel, un projet bien ciblé c'est souvent plus efficace qu'une liste trop longue 💪 On va se concentrer là-dessus et le réussir !",
        secondaire: "Très bien. Se concentrer sur un objectif précis, c'est souvent la clé pour y arriver plus vite 👌",
        senior:     "Excellent. Un objectif clair et bien défini, c'est la meilleure façon de le réaliser 😊",
      }),
    ],
    buttons: null,
    autoAdvance: true,
    onInput: (_input, ctx) => ({ nextId: "budget_projet", ctx }),
  },

  {
    id: "priorites",
    messages: (ctx) => {
      const deja    = ctx.projets.slice(0, ctx.currentProjIdx);
      const restants = ctx.projets.filter(p => !deja.includes(p));
      if (restants.length <= 1) return [];
      if (ctx.currentProjIdx === 0) {
        return [
          p(ctx, {
            junior:     "Et lequel est le plus important pour toi là maintenant ? 🎯",
            cible:      "Super 🎯 Maintenant, lequel est le plus urgent pour toi ?",
            secondaire: "Quel est ton objectif le plus prioritaire en ce moment ?",
            senior:     "Quel est le projet le plus prioritaire pour vous ?",
          }),
        ];
      }
      return [
        p(ctx, { junior: "Et ensuite ? 😊", cible: "Et ensuite ? 👌", secondaire: "Et le suivant ?", senior: "Et en second ?" }),
      ];
    },
    buttons: (ctx) => {
      const deja    = ctx.projets.slice(0, ctx.currentProjIdx);
      const restants = ctx.projets.filter(p => !deja.includes(p));
      if (restants.length <= 1) return null;
      return restants;
    },
    autoAdvance: (ctx) => {
      const deja    = ctx.projets.slice(0, ctx.currentProjIdx);
      const restants = ctx.projets.filter(p => !deja.includes(p));
      return restants.length <= 1;
    },
    onInput: (input, ctx) => {
      const deja    = ctx.projets.slice(0, ctx.currentProjIdx);
      const restants = ctx.projets.filter(p => !deja.includes(p));

      if (restants.length <= 1) {
        // Dernier projet positionné automatiquement
        const final = [...ctx.projets.slice(0, ctx.currentProjIdx), ...restants];
        return { nextId: "confirm_priorites", ctx: { ...ctx, projets: final, currentProjIdx: 0 } };
      }

      const priorites = [...deja, input];
      const suite     = ctx.projets.filter(p => !priorites.includes(p));
      const newProjets = [...priorites, ...suite];
      const newIdx     = priorites.length;

      // Si le suivant est le dernier restant → auto-positionner
      if (suite.length === 1) {
        return {
          nextId: "confirm_priorites",
          ctx: { ...ctx, projets: [...priorites, suite[0]], currentProjIdx: 0 },
        };
      }
      return { nextId: "priorites", ctx: { ...ctx, projets: newProjets, currentProjIdx: newIdx } };
    },
  },

  {
    id: "confirm_priorites",
    messages: (ctx) => {
      const ordre = ctx.projets.map((p, i) => `${i + 1}. ${p}`).join(", ");
      return [
        p(ctx, {
          junior:     `Top !\nTes priorités : ${ordre}.\nÇa te va ? 😊`,
          cible:      `Nickel 🙌 \nTes priorités : ${ordre}.\nC'est bon ?`,
          secondaire: `Tes priorités : ${ordre}.\nC'est correct ?`,
          senior:     `Vos priorités : ${ordre}.\nC'est bien cela ?`,
        }),
      ];
    },
    buttons: () => ["✓ C'est parfait", "✏️ Modifier l'ordre"],
    onInput: (input, ctx) => {
      if (input === "✏️ Modifier l'ordre") return { nextId: "priorites", ctx: { ...ctx, currentProjIdx: 0 } };
      return { nextId: "budget_projet", ctx: { ...ctx, currentProjIdx: 0 } };
    },
  },

  // ── BUDGET / HORIZON / ÉPARGNE / CALCUL (commun aux 3 flows) ──────────

  {
    id: "budget_projet",
    messages: (ctx) => {
      const proj = currentProjet(ctx);
      return [
        p(ctx, {
          junior:     `Pour ${proj}, t'as pensé à un budget ? Même approximatif c'est bien 😊`,
          cible:      `Pour ${proj}, t'as une idée du budget ? 💰`,
          secondaire: `Pour ${proj}, quel budget as-tu en tête ?`,
          senior:     `Pour ${proj}, quel budget envisagez-vous ?`,
        }),
      ];
    },
    buttons: (ctx) => {
      const proj = currentProjet(ctx);
      return BUDGET_BUTTONS[proj] ?? BUDGET_BUTTONS["✏️ Autre"];
    },
    onInput: (input, ctx) => {
      if (input === "✏️ Autre montant") return { nextId: "budget_libre", ctx };
      const amount = parseAmount(input);
      if (!amount) return { nextId: "budget_projet", ctx };
      const proj = currentProjet(ctx);
      return { nextId: "horizon_projet", ctx: { ...ctx, budgets: { ...ctx.budgets, [proj]: amount } } };
    },
  },

  {
    id: "budget_libre",
    messages: (ctx) => [`Quel montant as-tu en tête pour ${currentProjet(ctx)} ? (en €)`],
    buttons: null,
    onInput: (input, ctx) => {
      const amount = parseAmount(input) ?? 1000;
      const proj   = currentProjet(ctx);
      return { nextId: "horizon_projet", ctx: { ...ctx, budgets: { ...ctx.budgets, [proj]: amount } } };
    },
  },

  {
    id: "horizon_projet",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Tu veux y arriver en combien de temps ? ⏳",
        cible:      "Et tu vises ça dans combien de temps ? ⏳",
        secondaire: "Sur quel horizon travailles-tu pour ce projet ?",
        senior:     "Sur quel horizon envisagez-vous ce projet ?",
      }),
    ],
    buttons: () => ["6 mois", "1 an", "2 ans", "3 ans", "✏️ Autre durée"],
    onInput: (input, ctx) => {
      if (input === "✏️ Autre durée") return { nextId: "horizon_libre", ctx };
      const mois = parseHorizon(input) ?? 12;
      const proj = currentProjet(ctx);
      const newCtx = { ...ctx, horizons: { ...ctx.horizons, [proj]: mois } };
      if (newCtx.epargne > 0) return routeAfterEpargne(newCtx);
      return { nextId: "epargne", ctx: newCtx };
    },
  },

  {
    id: "horizon_libre",
    messages: () => ["Dans combien de temps veux-tu atteindre cet objectif ? (ex: 18 mois, 2 ans)"],
    buttons: null,
    onInput: (input, ctx) => {
      const mois = parseHorizon(input) ?? 12;
      const proj = currentProjet(ctx);
      const newCtx = { ...ctx, horizons: { ...ctx.horizons, [proj]: mois } };
      if (newCtx.epargne > 0) return routeAfterEpargne(newCtx);
      return { nextId: "epargne", ctx: newCtx };
    },
  },

  {
    id: "epargne",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Chaque mois, tu penses pouvoir mettre combien de côté ? 😊",
        cible:      "Et chaque mois, une fois tes dépenses réglées, tu peux mettre combien de côté ? 💳",
        secondaire: "Chaque mois, quelle somme pouvez-vous consacrer à l'épargne ?",
        senior:     "Chaque mois, quelle somme êtes-vous en mesure d'épargner ?",
      }),
    ],
    buttons: (ctx) => EPARGNE_BUTTONS[ctx.profile],
    onInput: (input, ctx) => {
      if (input === "✏️ Autre montant") return { nextId: "epargne_libre", ctx };
      const montant = parseAmount(input) ?? 200;
      return routeAfterEpargne({ ...ctx, epargne: montant });
    },
  },

  {
    id: "epargne_libre",
    messages: () => ["Quel montant mensuel peux-tu mettre de côté ? (en €)"],
    buttons: null,
    onInput: (input, ctx) => {
      const montant = parseAmount(input) ?? 200;
      return routeAfterEpargne({ ...ctx, epargne: montant });
    },
  },

  // ── CAS DE DÉPASSEMENT (3 options) ────────────────────────────────────

  {
    id: "calcul_depassement",
    messages: (ctx) => {
      const proj       = currentProjet(ctx);
      const budget     = ctx.budgets[proj]  ?? 0;
      const horizon    = ctx.horizons[proj] ?? 12;
      const mensualite = Math.ceil(budget / horizon);
      return [
        p(ctx, {
          junior:     `Petit check 🧮 Pour ${proj} à ${budget.toLocaleString("fr-FR")} € en ${fmtMois(horizon)},\nil te faudrait ${mensualite} €/mois.\nT'as ${ctx.epargne} €/mois, pas de panique, on a des solutions :`,
          cible:      `Petit calcul rapide 🧮 Pour ${proj} à ${budget.toLocaleString("fr-FR")} € en ${fmtMois(horizon)},\nil te faudrait ${mensualite} €/mois.\nMais t'as ${ctx.epargne} €/mois de dispo.\nDeux options :`,
          secondaire: `En faisant le calcul 🧮 : ${proj} à ${budget.toLocaleString("fr-FR")} € sur ${fmtMois(horizon)}\nreprésente ${mensualite} €/mois.\nAvec ${ctx.epargne} €/mois disponibles, deux ajustements possibles :`,
          senior:     `Le calcul indique 🧮 que ${proj} à ${budget.toLocaleString("fr-FR")} € sur ${fmtMois(horizon)}\nnécessite ${mensualite} €/mois.\nVotre capacité étant de ${ctx.epargne} €/mois,\nvoici deux options :`,
        }),
      ];
    },
    buttons: () => ["📅 Allonger la durée", "💰 Revoir le budget", "⬆️ Augmenter mon épargne"],
    onInput: (input, ctx) => {
      if (input === "📅 Allonger la durée") return { nextId: "allonger_confirm", ctx };
      if (input === "💰 Revoir le budget")  return { nextId: "budget_max_confirm", ctx };
      return { nextId: "augmenter_epargne", ctx };
    },
  },

  {
    id: "allonger_confirm",
    messages: (ctx) => {
      const proj         = currentProjet(ctx);
      const budget       = ctx.budgets[proj]  ?? 0;
      const nouvelHorizon = Math.ceil(budget / ctx.epargne);
      return [
        p(ctx, {
          junior:     `Avec ${ctx.epargne} €/mois, tu y arrives en ${fmtMois(nouvelHorizon)}.\nC'est jouable ! 😊`,
          cible:      `Avec ${ctx.epargne} €/mois, t'atteindrais ${proj}\nen ${fmtMois(nouvelHorizon)}. Ça te va ? 👌`,
          secondaire: `Avec ${ctx.epargne} €/mois, l'objectif serait atteint\nen ${fmtMois(nouvelHorizon)}. C'est acceptable pour toi ?`,
          senior:     `Avec ${ctx.epargne} €/mois, vous atteignez cet objectif\nen ${fmtMois(nouvelHorizon)}. Cela vous convient-il ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui, on garde ça", "✏️ Je préfère ajuster le budget"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je préfère ajuster le budget") return { nextId: "budget_projet", ctx };
      const proj         = currentProjet(ctx);
      const budget       = ctx.budgets[proj] ?? 0;
      const nouvelHorizon = Math.ceil(budget / ctx.epargne);
      return buildValidationCard({ ...ctx, horizons: { ...ctx.horizons, [proj]: nouvelHorizon } });
    },
  },

  {
    id: "budget_max_confirm",
    messages: (ctx) => {
      const proj      = currentProjet(ctx);
      const horizon   = ctx.horizons[proj] ?? 12;
      const budgetMax = ctx.epargne * horizon;
      return [
        p(ctx, {
          junior:     `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)},\ntu peux atteindre ${budgetMax.toLocaleString("fr-FR")} €. C'est déjà bien ! 🙌`,
          cible:      `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)},\ntu peux viser jusqu'à ${budgetMax.toLocaleString("fr-FR")} €. On part sur ça ? 💪`,
          secondaire: `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)},\nun budget de ${budgetMax.toLocaleString("fr-FR")} € est atteignable. Ça te convient ?`,
          senior:     `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)},\nun budget de ${budgetMax.toLocaleString("fr-FR")} € est réalisable. Cela vous convient-il ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui, on part sur ça", "✏️ Je préfère allonger la durée"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je préfère allonger la durée") return { nextId: "allonger_confirm", ctx };
      const proj      = currentProjet(ctx);
      const horizon   = ctx.horizons[proj] ?? 12;
      const budgetMax = ctx.epargne * horizon;
      return buildValidationCard({ ...ctx, budgets: { ...ctx.budgets, [proj]: budgetMax } });
    },
  },

  {
    id: "augmenter_epargne",
    messages: (ctx) => {
      const proj       = currentProjet(ctx);
      const budget     = ctx.budgets[proj]  ?? 0;
      const horizon    = ctx.horizons[proj] ?? 12;
      const mensualite = Math.ceil(budget / horizon);
      return [
        p(ctx, {
          junior:     `Tu peux aussi augmenter un peu ce que tu mets de côté chaque mois 😊\nIl faudrait ${mensualite} €/mois. Tu veux essayer ?`,
          cible:      `Si tu veux garder ton objectif et la durée, tu peux aussi augmenter ton effort mensuel 💪\nIl faudrait passer à ${mensualite} €/mois. Tu veux tester ?`,
          secondaire: `Une autre option consiste à augmenter votre effort d'épargne mensuel.\nIl faudrait ${mensualite} €/mois pour respecter cet objectif. Cela vous convient-il ?`,
          senior:     `Vous pouvez également augmenter votre capacité d'épargne mensuelle.\nUn montant de ${mensualite} €/mois serait nécessaire. Souhaitez-vous partir sur cette base ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui, j'augmente", "✏️ Je préfère ajuster autrement"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je préfère ajuster autrement") return { nextId: "calcul_depassement", ctx };
      const proj       = currentProjet(ctx);
      const budget     = ctx.budgets[proj]  ?? 0;
      const horizon    = ctx.horizons[proj] ?? 12;
      const mensualite = Math.ceil(budget / horizon);
      return buildValidationCard({ ...ctx, epargne: mensualite });
    },
  },

  // ── VALIDATION CARTE & PROJET AJOUTÉ ─────────────────────────────────

  {
    id: "projet_ajoute",
    messages: (ctx) => {
      const proj = ctx.projets[ctx.currentProjIdx] ?? "";
      return [
        p(ctx, {
          junior:     `Super 🙌 ${proj} rejoint ton tableau de bord !`,
          cible:      `Nickel 🎉 ${proj} est ajouté à ton tableau de bord !`,
          secondaire: `Parfait 👍 ${proj} a bien été ajouté à ton tableau de bord.`,
          senior:     `Très bien 😊 ${proj} a été ajouté à votre tableau de bord.`,
        }),
      ];
    },
    buttons: null,
    autoAdvance: true,
    onInput: (_input, ctx) => {
      const nextIdx = ctx.currentProjIdx + 1;
      if (nextIdx < ctx.projets.length) {
        return { nextId: "next_project", ctx: { ...ctx, currentProjIdx: nextIdx } };
      }
      return { nextId: "notif_question", ctx };
    },
  },

  {
    id: "next_project",
    messages: (ctx) => {
      const proj = ctx.projets[ctx.currentProjIdx] ?? "";
      return [
        p(ctx, {
          junior:     `Génial 🙌 On continue avec ton prochain projet : ${proj}`,
          cible:      `Super 🎉 Passons au projet suivant : ${proj}`,
          secondaire: `Parfait 👍 Passons maintenant au projet suivant : ${proj}`,
          senior:     `Très bien 😊 Nous pouvons maintenant passer au projet suivant : ${proj}`,
        }),
      ];
    },
    buttons: null,
    autoAdvance: true,
    onInput: (_input, ctx) => ({ nextId: "budget_projet", ctx }),
  },

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────

  {
    id: "notif_question",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Tes projets sont lancés 🙌 \nJe peux t'envoyer chaque mois un point sur ta progression.\nÇa te dit ?",
        cible:      "Tes projets sont créés 🎉 \nJe peux t'envoyer un récap mensuel sur ta progression. \nTu veux activer ça ?",
        secondaire: "Tes projets sont bien enregistrés 👍 \nJe peux t'envoyer un récapitulatif mensuel de ta progression.\nTu souhaites activer ce suivi ?",
        senior:     "Vos projets sont bien enregistrés 😊 \nJe peux vous envoyer un récapitulatif mensuel de votre progression. \nSouhaitez-vous activer ce suivi ?",
      }),
    ],
    buttons: () => ["🔔 Oui, j'active", "Non merci"],
    onInput: (input, ctx) => {
      if (input === "Non merci") return { nextId: "mode_epargne", ctx: { ...ctx, notifActive: false } };
      return { nextId: "notif_jour", ctx: { ...ctx, notifActive: true } };
    },
  },

  {
    id: "notif_jour",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Trop bien ! 😊 C'est quel jour du mois pour toi ?",
        cible:      "Super 👌 C'est quel jour du mois qui t'arrange ?",
        secondaire: "Quel jour du mois te conviendrait le mieux ?",
        senior:     "Quel jour du mois vous conviendrait le mieux ?",
      }),
    ],
    buttons: () => ["1er", "5", "15", "Dernier jour", "✏️ Autre jour"],
    onInput: (input, ctx) => {
      if (input === "✏️ Autre jour") return { nextId: "notif_jour_libre", ctx };
      return { nextId: "mode_epargne", ctx: { ...ctx, notifJour: input } };
    },
  },

  {
    id: "notif_jour_libre",
    messages: () => ["Quel jour du mois ? (ex: 10, 20…)"],
    buttons: null,
    onInput: (input, ctx) => ({ nextId: "mode_epargne", ctx: { ...ctx, notifJour: input } }),
  },

  {
    id: "mode_epargne",
    messages: (ctx) => [
      p(ctx, {
        junior:     "Et pour ton épargne chaque mois ? 💳\nJe peux prélever automatiquement la somme sur ton salaire\net la répartir sur tes projets selon tes priorités.\nOu tu préfères gérer ça toi-même ?",
        cible:      "Maintenant, comment tu veux gérer ton épargne chaque mois ? 💳\nJe peux prélever automatiquement la somme sur ton salaire\net la répartir sur chaque projet selon tes priorités.\nOu tu préfères le faire toi-même ?",
        secondaire: "Comment souhaites-tu gérer ton épargne mensuelle ? 💳\nJe peux effectuer automatiquement les prélèvements dès réception de ton salaire\net les répartir entre tes projets selon leur priorité.\nOu tu préfères garder la main ?",
        senior:     "Comment souhaitez-vous gérer votre épargne mensuelle ? 💳\nJe peux effectuer automatiquement les prélèvements dès réception de votre salaire\net les répartir entre vos projets selon leur priorité.\nOu préférez-vous gérer cela vous-même ?",
      }),
    ],
    buttons: () => ["🤖 Mode automatique", "✋ Mode manuel"],
    onInput: (input, ctx) => {
      if (input === "✋ Mode manuel") return { nextId: "mode_manuel_confirm", ctx: { ...ctx, repartitionMode: "manuelle" } };
      return { nextId: "mode_auto_recap", ctx: { ...ctx, repartitionMode: "automatique" } };
    },
  },

  {
    id: "mode_auto_recap",
    messages: (ctx) => {
      const lines = ctx.projets.map((proj, i) => {
        const b = ctx.budgets[proj]  ?? 0;
        const h = ctx.horizons[proj] ?? 12;
        return `${i + 1}. ${proj} — ${Math.ceil(b / h)} €/mois`;
      });
      return [
        `Voici comment je répartirai ton épargne chaque mois :\n${lines.join("\n")}`,
        p(ctx, {
          junior:     "Je peux lancer les prélèvements automatiques chaque mois ? 🔐",
          cible:      "Tu confirmes que je peux effectuer ces prélèvements automatiquement chaque mois ? 🔐",
          secondaire: "Tu confirmes m'autoriser à effectuer ces prélèvements automatiquement chaque mois ?",
          senior:     "Vous confirmez m'autoriser à effectuer ces prélèvements automatiquement chaque mois ?",
        }),
      ];
    },
    buttons: () => ["✓ Je confirme", "✏️ Je veux modifier"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je veux modifier") return { nextId: "mode_epargne", ctx };
      return { nextId: "cloture_aide", ctx };
    },
  },

  {
    id: "mode_manuel_confirm",
    messages: (ctx) => [
      p(ctx, {
        junior:     "OK, tu gères toi-même 👌 Tout est dans ton tableau de bord !",
        cible:      "Pas de souci, tu gardes le contrôle 👌 Tu retrouves la répartition recommandée directement dans ton tableau de bord.",
        secondaire: "Très bien, tu conserves la main sur tes virements 👌 Tout est disponible dans ton tableau de bord.",
        senior:     "Très bien, vous conservez la main sur vos virements 😊 Tout est disponible dans votre tableau de bord.",
      }),
    ],
    buttons: null,
    autoAdvance: true,
    onInput: (_input, ctx) => ({ nextId: "cloture_aide", ctx }),
  },

  // ── CLÔTURE ───────────────────────────────────────────────────────────

  {
    id: "cloture_aide",
    messages: (ctx) => [
      p(ctx, {
        junior:     "C'est tout bon, ton plan est lancé 🙌 Je peux t'aider pour autre chose ?",
        cible:      "Voilà, ton plan est prêt 🎉 Est-ce que je peux t'aider pour autre chose ?",
        secondaire: "Ton plan est bien configuré 👍 Y a-t-il autre chose pour laquelle je peux t'aider ?",
        senior:     "Votre plan est bien configuré 😊 Y a-t-il autre chose pour laquelle je peux vous aider ?",
      }),
    ],
    buttons: () => ["💬 Oui, j'ai une question", "✓ Non, c'est parfait"],
    onInput: (input, ctx) => {
      if (input === "💬 Oui, j'ai une question") return { nextId: "question_libre", ctx };
      return { nextId: "cloture", ctx };
    },
  },

  {
    id: "question_libre",
    messages: () => [],
    buttons: null,
    onInput: (_input, ctx) => ({ nextId: "cloture_aide_suite", ctx }),
  },

  {
    id: "cloture_aide_suite",
    messages: () => [
      "Bonne question, mais ça c'est plutôt pour un conseiller WiseWallet — moi je reste focus sur ton plan d'épargne. Autre chose ?",
    ],
    buttons: () => ["💬 Oui, autre chose", "✓ Non, c'est bon"],
    onInput: (input, ctx) => {
      if (input === "💬 Oui, autre chose") return { nextId: "question_libre", ctx };
      return { nextId: "cloture", ctx };
    },
  },

  {
    id: "cloture",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Super 🎉 T'as fait le premier pas, c'est souvent le plus dur ! On est là si t'as besoin. À bientôt ${ctx.prenom} 👋`,
        cible:      `Parfait 🚀 Ton plan est en place, tes objectifs sont clairs. Plus qu'à laisser l'épargne faire son travail ! À bientôt ${ctx.prenom} 👋`,
        secondaire: `Très bien 👍 Ton plan est solide. On se retrouve sur ton tableau de bord pour suivre ta progression. À bientôt ${ctx.prenom} !`,
        senior:     `Parfait 😊 Votre plan est bien en place. Nous restons disponibles si vous avez la moindre question. À bientôt ${ctx.prenom} !`,
      }),
    ],
    buttons: null,
    autoAdvance: true,
    onInput: (_i, ctx) => ({ nextId: "end", ctx }),
  },

  { id: "end", messages: () => [], buttons: null, onInput: (_i, ctx) => ({ nextId: "end", ctx }) },

  // ── FLOW CLUSTER_3 ACTIF — Client identifié (Richard/Voyage) ──────────

  {
    id: "richard",
    messages: () => [
      "Salut ! Moi, c'est Alex, ton conseiller épargne chez WiseWallet 💼💡\nTu m'avais parlé d'un projet de voyage ✈️🌍\nJe te propose: 2 500 € sur 9 mois, avec des mensualités d'environ 278 € 💸",
    ],
    buttons: () => ["✓ Ce plan me convient", "✏️ Je préfère personnaliser"],
    onInput: (input, ctx) => {
      const richardCtx: AlexCtx = {
        ...ctx,
        profile:  "secondaire",
        prenom:   "Richard",
        projets:  ["✈️ Voyage"],
        currentProjIdx: 0,
      };

      if (input === "✓ Ce plan me convient") {
        const confirmedCtx: AlexCtx = {
          ...richardCtx,
          budgets:  { "✈️ Voyage": 2500 },
          horizons: { "✈️ Voyage": 9 },
          epargne:  278,
        };
        return { nextId: "richard_confirme", ctx: confirmedCtx };
      }

      // Personnaliser → budget Voyage puis horizon puis épargne
      return {
        nextId: "richard_budget",
        ctx: { ...richardCtx, epargne: 0 },
      };
    },
  },

  {
    id: "richard_confirme",
    messages: () => ["Nickel Richard 👌 Ton projet voyage est créé et ajouté à ton tableau de bord !"],
    buttons: null,
    autoAdvance: true,
    onInput: (_i, ctx) => buildValidationCard(ctx, "notif_question", "richard_budget"),
  },

  {
    id: "richard_budget",
    messages: () => [
      "Pas de souci Richard 👍 On va affiner tout ça ensemble.\nDis-moi, t'as un budget précis en tête pour ce voyage ?",
    ],
    buttons: () => BUDGET_BUTTONS["✈️ Voyage"],
    onInput: (input, ctx) => {
      if (input === "✏️ Autre montant") return { nextId: "richard_budget_libre", ctx };
      const amount = parseAmount(input) ?? 2500;
      return {
        nextId: "horizon_projet",
        ctx: { ...ctx, budgets: { ...ctx.budgets, "✈️ Voyage": amount } },
      };
    },
  },

  {
    id: "richard_budget_libre",
    messages: () => ["Quel budget as-tu en tête pour ce voyage ? (en €)"],
    buttons: null,
    onInput: (input, ctx) => {
      const amount = parseAmount(input) ?? 2500;
      return {
        nextId: "horizon_projet",
        ctx: { ...ctx, budgets: { ...ctx.budgets, "✈️ Voyage": amount } },
      };
    },
  },

  // ── FLOW CLUSTER_3 PASSIF — Client identifié passif ───────────────────

  {
    id: "richard_passif",
    messages: () => [
      "Salut Richard 👋 Moi, c'est Alex, ton conseiller épargne chez WiseWallet 💼💡\nJ'ai préparé pour toi une projection simple : si tu mets 150 € de côté chaque mois, tu peux atteindre 1 800 € en 12 mois 💸📈\nJe t'ai conçu un plan personnalisé pour t'aider à te lancer facilement. Tu veux voir ? 😉",
    ],
    buttons: () => ["✓ Voir mon plan", "✏️ Personnaliser"],
    onInput: (input, ctx) => {
      const richardPassifCtx: AlexCtx = {
        ...ctx,
        profile:  "secondaire",
        prenom:   "Richard",
        projets:  ["Projet d'épargne"],
        currentProjIdx: 0,
        budgets:  { "Projet d'épargne": 1800 },
        horizons: { "Projet d'épargne": 12 },
        epargne:  150,
      };

      if (input === "✓ Voir mon plan") {
        return { nextId: "richard_passif_confirme", ctx: richardPassifCtx };
      }

      // Personnaliser → sélection du projet puis budget complet
      return {
        nextId: "richard_passif_projets",
        ctx: { ...ctx, profile: "secondaire", prenom: "Richard", projets: [], currentProjIdx: 0, epargne: 0 },
      };
    },
  },

  {
    id: "richard_passif_confirme",
    messages: () => ["Parfait Richard 👍 Ton plan est prêt et ajouté à ton tableau de bord !"],
    buttons: null,
    autoAdvance: true,
    onInput: (_i, ctx) => buildValidationCard(ctx, "notif_question", "richard_passif_projets"),
  },

  {
    id: "richard_passif_projets",
    messages: () => [
      "Très bien 👍 On va construire ça ensemble.\nTu souhaites épargner pour quel type de projet ? 😊",
    ],
    buttons: () => ["✈️ Voyage", "🚗 Voiture", "🏠 Immobilier", "🛟 Épargne de précaution", "🎯 Autre"],
    onInput: (input, ctx) => ({
      nextId: "budget_projet",
      ctx: { ...ctx, projets: [input], currentProjIdx: 0 },
    }),
  },
];

// ── Engine ────────────────────────────────────────────────────────────────

const stepsMap = new Map(steps.map((s) => [s.id, s]));

export function getStep(id: string): AlexStep | undefined {
  return stepsMap.get(id);
}

export function getStartId(mode: AlexMode): string {
  if (mode === "cluster3_actif")  return "richard";
  if (mode === "cluster3_passif") return "richard_passif";
  return "welcome";
}
