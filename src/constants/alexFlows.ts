// Simulation fidèle du Voiceflow Alex — textes et boutons issus des playbooks VF

export type Profile = "unknown" | "junior" | "cible" | "secondaire" | "senior";

export type AlexCtx = {
  mode: "cluster2" | "cluster3";
  profile: Profile;
  prenom: string;
  revenus: string;
  projets: string[];           // sélectionnés + ordonnés par priorité
  currentProjIdx: number;      // index du projet en cours de configuration
  budgets: Record<string, number>;
  horizons: Record<string, number>; // en mois
  epargne: number;
  notifActive: boolean;
  notifJour: string;
  repartitionMode: string;
  awaitingFreeText: string;    // indique quel champ on attend en texte libre
};

export type ValidationCard = {
  title: string;
  body: string;
  confirmQuestion: string; // question profile-based après la carte
  buttons: string[];
  onValidate: string; // stepId si ✓
  onEdit: string;     // stepId si ✏️
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
  autoAdvance?: true; // avance automatiquement sans input utilisateur
  onInput: (input: string, ctx: AlexCtx) => StepOutput;
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function initCtx(mode: "cluster2" | "cluster3"): AlexCtx {
  return {
    mode, profile: "unknown", prenom: "",
    revenus: "", projets: [], currentProjIdx: 0,
    budgets: {}, horizons: {}, epargne: 0,
    notifActive: false, notifJour: "", repartitionMode: "",
    awaitingFreeText: "",
  };
}

function p(ctx: AlexCtx, opts: { junior: string; cible: string; secondaire: string; senior: string }): string {
  if (ctx.profile === "junior") return opts.junior;
  if (ctx.profile === "secondaire") return opts.secondaire;
  if (ctx.profile === "senior") return opts.senior;
  return opts.cible;
}

function parseAmount(str: string): number | null {
  const digits = str.replace(/\s/g, "").replace("€", "").replace(/ /g, "").replace(",", ".");
  const m = digits.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function parseHorizon(str: string): number | null {
  if (/6\s*mois/i.test(str)) return 6;
  if (/1\s*an/i.test(str)) return 12;
  if (/2\s*ans/i.test(str)) return 24;
  if (/3\s*ans/i.test(str)) return 36;
  const mois = str.match(/(\d+)\s*mois/i);
  if (mois) return parseInt(mois[1]);
  const ans = str.match(/(\d+)\s*an/i);
  if (ans) return parseInt(ans[1]) * 12;
  return null;
}

const BUDGET_BUTTONS: Record<string, string[]> = {
  "✈️ Voyage":               ["500 €", "1 000 €", "1 500 €", "2 000 €", "✏️ Autre montant"],
  "🚗 Voiture":              ["3 000 €", "5 000 €", "8 000 €", "12 000 €", "✏️ Autre montant"],
  "🏠 Immobilier":           ["10 000 €", "15 000 €", "20 000 €", "30 000 €", "✏️ Autre montant"],
  "🛡️ Épargne de précaution": ["1 500 €", "3 000 €", "5 000 €", "✏️ Autre montant"],
  "👴 Retraite":             ["10 000 €", "20 000 €", "50 000 €", "✏️ Autre montant"],
  "💳 Remboursement crédit": ["1 000 €", "3 000 €", "5 000 €", "10 000 €", "✏️ Autre montant"],
  "✏️ Autre":                ["500 €", "1 000 €", "2 000 €", "5 000 €", "✏️ Autre montant"],
};

const EPARGNE_BUTTONS: Record<Profile, string[]> = {
  unknown:     ["200 €", "300 €", "500 €", "700 €", "✏️ Autre montant"],
  junior:      ["50 €", "100 €", "150 €", "200 €", "✏️ Autre montant"],
  cible:       ["200 €", "300 €", "500 €", "700 €", "✏️ Autre montant"],
  secondaire:  ["300 €", "500 €", "800 €", "1 000 €", "✏️ Autre montant"],
  senior:      ["500 €", "800 €", "1 000 €", "1 500 €", "✏️ Autre montant"],
};

const HORIZON_BUTTONS = ["6 mois", "1 an", "2 ans", "3 ans", "✏️ Autre durée"];

function currentProjet(ctx: AlexCtx): string {
  return ctx.projets[ctx.currentProjIdx] ?? "";
}

function fmtMois(n: number): string {
  if (n <= 0) return "atteint";
  if (n < 12) return `${n} mois`;
  const y = Math.floor(n / 12), m = n % 12;
  return m > 0 ? `${y} an${y > 1 ? "s" : ""} ${m} mois` : `${y} an${y > 1 ? "s" : ""}`;
}

// ── STEPS ─────────────────────────────────────────────────────────────────

const steps: AlexStep[] = [

  // ── CLUSTER 2 : Client non-identifié ────────────────────────────────────

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
        junior:     `Super ${ctx.prenom} ! 🙌 T'inquiète, même avec un petit budget on peut construire quelque chose de bien. Quel est ton salaire annuel environ ?`,
        cible:      `Nickel ${ctx.prenom} ! 👌 C'est le bon moment pour se lancer. Quel est ton salaire annuel environ ?`,
        secondaire: `Parfait ${ctx.prenom} 👍 On va construire un plan solide adapté à tes objectifs. Quel est ton salaire annuel environ ?`,
        senior:     `Enchanté(e) ${ctx.prenom} 😊 On va construire quelque chose de rassurant et bien structuré ensemble. Quel est votre salaire / retraite annuel environ ?`,
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
        junior:     `Très bien, 😊\nMême avec un petit budget on peut faire des trucs cool, tu aurais une idée de ton salaire annuel ?`,
        cible:      `Très bien, 🙌\nPour te faire des suggestions qui collent vraiment à ta vie, t'aurais une idée de ton salaire annuel ?`,
        secondaire: `Très bien, 👋\nPour construire un plan vraiment adapté à ta situation, j'aurais besoin de connaître tes revenus annuels.`,
        senior:     `Très bien, 😊\nPour vous proposer des recommandations adaptées à votre situation, pourriez-vous m'indiquer votre salaire / retraite annuel ?`,
      }),
    ],
    buttons: () => ["< 25 000 €", "25 000 – 40 000 €", "40 000 – 60 000 €", "60 000 – 80 000 €", "> 80 000 €"],
    onInput: (input, ctx) => {
      // Affiner le profil selon les revenus si besoin
      let profile = ctx.profile;
      if (input === "< 25 000 €" && profile === "unknown") profile = "junior";
      return { nextId: "projets", ctx: { ...ctx, revenus: input, profile } };
    },
  },

  {
    id: "projets",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Merci ${ctx.prenom} 😊\nTu as des projets en tête ? Un voyage, une voiture, une épargne de secours ?\nChoisis tout ce qui t'intéresse !`,
        cible:      `Top, merci ${ctx.prenom} 👌\nTu as déjà des projets en tête pour lesquels tu voudrais épargner ?\nSélectionne tout ce qui te parle !`,
        secondaire: `Merci ${ctx.prenom} 👍\nQuels sont les objectifs pour lesquels tu souhaiterais épargner ?\nTu peux en sélectionner plusieurs.`,
        senior:     `Merci ${ctx.prenom} 😊\nPour quels projets souhaiteriez-vous épargner ?\nVous pouvez en sélectionner plusieurs.`,
      }),
    ],
    buttons: () => ["✈️ Voyage", "🚗 Voiture", "🏠 Immobilier", "🛡️ Épargne de précaution", "👴 Retraite", "💳 Remboursement crédit", "✏️ Autre"],
    multiSelect: true,
    onInput: (input, ctx) => {
      // input = JSON.stringify(selectedItems[]) passé par AlexChat
      let projets: string[] = [];
      try { projets = JSON.parse(input); } catch { projets = [input]; }
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
      // Si projet unique → réassurance puis budget
      if (ctx.projets.length <= 1) return { nextId: "single_reassurance", ctx: { ...ctx, currentProjIdx: 0 } };
      return { nextId: "priorites", ctx };
    },
  },

  {
    id: "single_reassurance",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Super choix ! 🎉 Commencer par un seul objectif c'est exactement la bonne approche. On y va !`,
        cible:      `Nickel, un projet bien ciblé c'est souvent plus efficace qu'une liste trop longue 💪 On va se concentrer là-dessus et le réussir !`,
        secondaire: `Très bien. Se concentrer sur un objectif précis, c'est souvent la clé pour y arriver plus vite 👌`,
        senior:     `Excellent. Un objectif clair et bien défini, c'est la meilleure façon de le réaliser 😊`,
      }),
    ],
    buttons: null,
    autoAdvance: true,
    onInput: (_input, ctx) => ({ nextId: "budget_projet", ctx }),
  },

  {
    id: "priorites",
    messages: (ctx) => {
      const restants = ctx.projets.filter((p) => !ctx.projets.slice(0, ctx.currentProjIdx).includes(p));
      if (ctx.currentProjIdx === 0) {
        return [
          p(ctx, {
            junior:     `Et lequel est le plus important pour toi là maintenant ? 🎯`,
            cible:      `Super 🎯 Maintenant, lequel est le plus urgent pour toi ?`,
            secondaire: `Quel est ton objectif le plus prioritaire en ce moment ?`,
            senior:     `Quel est le projet le plus prioritaire pour vous ?`,
          }),
        ];
      }
      if (restants.length === 1) {
        // Dernier projet → positionné automatiquement
        return [];
      }
      return [
        p(ctx, {
          junior: `Et ensuite ? 😊`, cible: `Et ensuite ? 👌`,
          secondaire: `Et le suivant ?`, senior: `Et en second ?`,
        }),
      ];
    },
    buttons: (ctx) => {
      const deja = ctx.projets.slice(0, ctx.currentProjIdx);
      const restants = ctx.projets.filter((p) => !deja.includes(p));
      if (restants.length <= 1) return null; // géré en auto
      return restants;
    },
    onInput: (input, ctx) => {
      const deja = ctx.projets.slice(0, ctx.currentProjIdx);
      const priorites = [...deja, input];
      const restants = ctx.projets.filter((p) => !priorites.includes(p));
      if (restants.length === 1) {
        // Dernier projet positionné automatiquement
        const final = [...priorites, restants[0]];
        return { nextId: "confirm_priorites", ctx: { ...ctx, projets: final, currentProjIdx: 0 } as AlexCtx };
      }
      return { nextId: "priorites", ctx: { ...ctx, projets: [...priorites, ...restants], currentProjIdx: priorites.length } as AlexCtx };
    },
  },

  {
    id: "confirm_priorites",
    messages: (ctx) => {
      const ordre = ctx.projets.map((p, i) => `${i + 1}. ${p}`).join(", ");
      return [
        p(ctx, {
          junior:     `Top !\nTes priorités : ${ordre}.\nÇa te va ? 😊`,
          cible:      `Nickel 🙌\nTes priorités : ${ordre}.\nC'est bon ?`,
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
    buttons: (ctx) => BUDGET_BUTTONS[currentProjet(ctx)] ?? BUDGET_BUTTONS["✏️ Autre"],
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
      const proj = currentProjet(ctx);
      return { nextId: "horizon_projet", ctx: { ...ctx, budgets: { ...ctx.budgets, [proj]: amount } } };
    },
  },

  {
    id: "horizon_projet",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Tu veux y arriver en combien de temps ? ⏳`,
        cible:      `Et tu vises ça dans combien de temps ? ⏳`,
        secondaire: `Sur quel horizon travailles-tu pour ce projet ?`,
        senior:     `Sur quel horizon envisagez-vous ce projet ?`,
      }),
    ],
    buttons: () => HORIZON_BUTTONS,
    onInput: (input, ctx) => {
      if (input === "✏️ Autre durée") return { nextId: "horizon_libre", ctx };
      const mois = parseHorizon(input) ?? 12;
      const proj = currentProjet(ctx);
      return { nextId: ctx.epargne > 0 ? "calcul" : "epargne", ctx: { ...ctx, horizons: { ...ctx.horizons, [proj]: mois } } };
    },
  },

  {
    id: "horizon_libre",
    messages: () => [`Dans combien de temps veux-tu atteindre cet objectif ? (ex: 18 mois, 2 ans)`],
    buttons: null,
    onInput: (input, ctx) => {
      const mois = parseHorizon(input) ?? 12;
      const proj = currentProjet(ctx);
      return { nextId: ctx.epargne > 0 ? "calcul" : "epargne", ctx: { ...ctx, horizons: { ...ctx.horizons, [proj]: mois } } };
    },
  },

  {
    id: "epargne",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Chaque mois, tu penses pouvoir mettre combien de côté ? 😊`,
        cible:      `Et chaque mois, une fois tes dépenses réglées, tu peux mettre combien de côté ? 💳`,
        secondaire: `Chaque mois, quelle somme pouvez-vous consacrer à l'épargne ?`,
        senior:     `Chaque mois, quelle somme êtes-vous en mesure d'épargner ?`,
      }),
    ],
    buttons: (ctx) => EPARGNE_BUTTONS[ctx.profile],
    onInput: (input, ctx) => {
      if (input === "✏️ Autre montant") return { nextId: "epargne_libre", ctx };
      const montant = parseAmount(input) ?? 200;
      return { nextId: "calcul", ctx: { ...ctx, epargne: montant } };
    },
  },

  {
    id: "epargne_libre",
    messages: () => [`Quel montant mensuel peux-tu mettre de côté ? (en €)`],
    buttons: null,
    onInput: (input, ctx) => {
      const montant = parseAmount(input) ?? 200;
      return { nextId: "calcul", ctx: { ...ctx, epargne: montant } };
    },
  },

  {
    id: "calcul",
    messages: (ctx) => {
      const proj = currentProjet(ctx);
      const budget = ctx.budgets[proj] ?? 0;
      const horizon = ctx.horizons[proj] ?? 12;
      const mensualite = Math.ceil(budget / horizon);
      if (mensualite <= ctx.epargne) return []; // → card directement
      return [
        p(ctx, {
          junior:     `Petit check 🧮 Pour ${proj} à ${budget} € en ${fmtMois(horizon)},\nil te faudrait ${mensualite} €/mois.\nT'as ${ctx.epargne} €/mois, pas de panique, on a des solutions :`,
          cible:      `Petit calcul rapide 🧮 Pour ${proj} à ${budget} € en ${fmtMois(horizon)},\nil te faudrait ${mensualite} €/mois.\nMais t'as ${ctx.epargne} €/mois de dispo.\nDeux options :`,
          secondaire: `En faisant le calcul 🧮 : ${proj} à ${budget} € sur ${fmtMois(horizon)}\nreprésente ${mensualite} €/mois.\nAvec ${ctx.epargne} €/mois disponibles, deux ajustements possibles :`,
          senior:     `Le calcul indique 🧮 que ${proj} à ${budget} € sur ${fmtMois(horizon)}\nnécessite ${mensualite} €/mois.\nVotre capacité étant de ${ctx.epargne} €/mois,\nvoici deux options :`,
        }),
      ];
    },
    buttons: (ctx) => {
      const proj = currentProjet(ctx);
      const budget = ctx.budgets[proj] ?? 0;
      const horizon = ctx.horizons[proj] ?? 12;
      const mensualite = Math.ceil(budget / horizon);
      if (mensualite <= ctx.epargne) return null; // pas de buttons → card
      return ["📅 Allonger la durée", "💰 Revoir le budget"];
    },
    onInput: (input, ctx) => {
      const proj = currentProjet(ctx);
      const budget = ctx.budgets[proj] ?? 0;
      const horizon = ctx.horizons[proj] ?? 12;
      const mensualite = Math.ceil(budget / horizon);

      if (mensualite <= ctx.epargne || input === "") {
        // Réalisable → carte de validation
        return buildValidationCard(ctx);
      }
      if (input === "📅 Allonger la durée") {
        const nouvelHorizon = Math.ceil(budget / ctx.epargne);
        return {
          nextId: "allonger_confirm",
          ctx: { ...ctx, horizons: { ...ctx.horizons, [proj]: nouvelHorizon } },
        };
      }
      // 💰 Revoir le budget
      const budgetMax = ctx.epargne * horizon;
      return {
        nextId: "budget_max_confirm",
        ctx: { ...ctx, budgets: { ...ctx.budgets, [proj]: budgetMax } },
      };
    },
  },

  {
    id: "allonger_confirm",
    messages: (ctx) => {
      const proj = currentProjet(ctx);
      const horizon = ctx.horizons[proj] ?? 12;
      return [
        p(ctx, {
          junior:     `Avec ${ctx.epargne} €/mois, tu y arrives en ${fmtMois(horizon)} mois.\nC'est jouable ! 😊`,
          cible:      `Avec ${ctx.epargne} €/mois, t'atteindrais ${proj} en ${fmtMois(horizon)}. Ça te va ? 👌`,
          secondaire: `Avec ${ctx.epargne} €/mois, l'objectif serait atteint en ${fmtMois(horizon)}. C'est acceptable pour toi ?`,
          senior:     `Avec ${ctx.epargne} €/mois, vous atteignez cet objectif en ${fmtMois(horizon)}. Cela vous convient-il ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui, on garde ça", "✏️ Je préfère ajuster le budget"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je préfère ajuster le budget") return { nextId: "budget_projet", ctx };
      return buildValidationCard(ctx);
    },
  },

  {
    id: "budget_max_confirm",
    messages: (ctx) => {
      const proj = currentProjet(ctx);
      const budget = ctx.budgets[proj] ?? 0;
      const horizon = ctx.horizons[proj] ?? 12;
      return [
        p(ctx, {
          junior:     `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)}, tu peux atteindre ${budget} €. C'est déjà bien ! 🙌`,
          cible:      `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)}, tu peux viser jusqu'à ${budget} €. On part sur ça ? 💪`,
          secondaire: `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)}, un budget de ${budget} € est atteignable. Ça te convient ?`,
          senior:     `Avec ${ctx.epargne} €/mois sur ${fmtMois(horizon)}, un budget de ${budget} € est réalisable. Cela vous convient-il ?`,
        }),
      ];
    },
    buttons: () => ["✓ Oui, on part sur ça", "✏️ Je préfère allonger la durée"],
    onInput: (input, ctx) => {
      if (input === "✏️ Je préfère allonger la durée") {
        const proj = currentProjet(ctx);
        const budget = ctx.budgets[proj] ?? 0;
        const nouvelHorizon = Math.ceil(budget / ctx.epargne);
        return { nextId: "allonger_confirm", ctx: { ...ctx, horizons: { ...ctx.horizons, [proj]: nouvelHorizon } } };
      }
      return buildValidationCard(ctx);
    },
  },

  {
    id: "next_project",
    messages: (ctx) => {
      const next = ctx.projets[ctx.currentProjIdx];
      if (!next) return [];
      return [
        p(ctx, {
          junior: `Super ! 🙌 Passons au projet suivant : ${next}.`,
          cible: `Nickel 🎉 Maintenant parlons de ${next}.`,
          secondaire: `Parfait 👍 Passons à ${next}.`,
          senior: `Très bien 😊 Passons maintenant à ${next}.`,
        }),
      ];
    },
    buttons: null,
    onInput: (_input, ctx) => ({ nextId: "budget_projet", ctx }),
  },

  // ── Notifications ────────────────────────────────────────────────────────

  {
    id: "notif_question",
    messages: (ctx) => [
      p(ctx, {
        junior:     `Tes projets sont lancés 🙌\nJe peux t'envoyer chaque mois un point sur ta progression.\nÇa te dit ?`,
        cible:      `Tes projets sont créés 🎉\nJe peux t'envoyer un récap mensuel sur ta progression.\nTu veux activer ça ?`,
        secondaire: `Tes projets sont bien enregistrés 👍\nJe peux t'envoyer un récapitulatif mensuel de ta progression.\nTu souhaites activer ce suivi ?`,
        senior:     `Vos projets sont bien enregistrés 😊\nJe peux vous envoyer un récapitulatif mensuel de votre progression.\nSouhaitez-vous activer ce suivi ?`,
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
        junior: `Trop bien ! 😊 C'est quel jour du mois pour toi ?`,
        cible: `Super 👌 C'est quel jour du mois qui t'arrange ?`,
        secondaire: `Quel jour du mois te conviendrait le mieux ?`,
        senior: `Quel jour du mois vous conviendrait le mieux ?`,
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
        junior:     `Et pour ton épargne chaque mois ? 💳\nJe peux prélever automatiquement la somme sur ton salaire et la répartir sur tes projets selon tes priorités.\nOu tu préfères gérer ça toi-même ?`,
        cible:      `Maintenant, comment tu veux gérer ton épargne chaque mois ? 💳\nJe peux prélever automatiquement la somme sur ton salaire et la répartir sur chaque projet selon tes priorités.\nOu tu préfères le faire toi-même ?`,
        secondaire: `Comment souhaites-tu gérer ton épargne mensuelle ? 💳\nJe peux effectuer automatiquement les prélèvements dès réception de ton salaire et les répartir entre tes projets selon leur priorité.\nOu tu préfères garder la main ?`,
        senior:     `Comment souhaitez-vous gérer votre épargne mensuelle ? 💳\nJe peux effectuer automatiquement les prélèvements dès réception de votre salaire et les répartir entre vos projets selon leur priorité.\nOu préférez-vous gérer cela vous-même ?`,
      }),
    ],
    buttons: () => ["🤖 Mode automatique", "✋ Mode manuel"],
    onInput: (input, ctx) => {
      if (input === "✋ Mode manuel") {
        return {
          nextId: "mode_manuel_confirm",
          ctx: { ...ctx, repartitionMode: "manuel" },
        };
      }
      return { nextId: "mode_auto_recap", ctx: { ...ctx, repartitionMode: "automatique" } };
    },
  },

  {
    id: "mode_auto_recap",
    messages: (ctx) => {
      const lines = ctx.projets.map((proj, i) => {
        const b = ctx.budgets[proj] ?? 0;
        const h = ctx.horizons[proj] ?? 12;
        const m = Math.ceil(b / h);
        return `${i + 1}. ${proj} — ${m} €/mois`;
      });
      return [
        `Voici comment je répartirai ton épargne chaque mois :\n${lines.join("\n")}`,
        p(ctx, {
          junior:     `Je peux lancer les prélèvements automatiques chaque mois ? 🔐`,
          cible:      `Tu confirmes que je peux effectuer ces prélèvements automatiquement chaque mois ? 🔐`,
          secondaire: `Tu confirmes m'autoriser à effectuer ces prélèvements automatiquement chaque mois ?`,
          senior:     `Vous confirmez m'autoriser à effectuer ces prélèvements automatiquement chaque mois ?`,
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
        junior:     `OK, tu gères toi-même 👌 Tout est dans ton tableau de bord !`,
        cible:      `Pas de souci, tu gardes le contrôle 👌 Tu retrouves la répartition recommandée directement dans ton tableau de bord.`,
        secondaire: `Très bien, tu conserves la main sur tes virements 👌 Tout est disponible dans ton tableau de bord.`,
        senior:     `Très bien, vous conservez la main sur vos virements 😊 Tout est disponible dans votre tableau de bord.`,
      }),
    ],
    buttons: null,
    onInput: (_input, ctx) => ({ nextId: "cloture_aide", ctx }),
  },

  {
    id: "cloture_aide",
    messages: (ctx) => [
      p(ctx, {
        junior:     `C'est tout bon, ton plan est lancé 🙌 Je peux t'aider pour autre chose ?`,
        cible:      `Voilà, ton plan est prêt 🎉 Est-ce que je peux t'aider pour autre chose ?`,
        secondaire: `Ton plan est bien configuré 👍 Y a-t-il autre chose pour laquelle je peux t'aider ?`,
        senior:     `Votre plan est bien configuré 😊 Y a-t-il autre chose pour laquelle je peux vous aider ?`,
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
    messages: () => ["Dis-moi, je t'écoute 😊"],
    buttons: null,
    onInput: (_input, ctx) => ({
      nextId: "cloture_aide",
      ctx,
    }),
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
    onInput: (_i, ctx) => ({ nextId: "end", ctx }),
  },

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

  { id: "end", messages: () => [], buttons: null, onInput: (_i, ctx) => ({ nextId: "end", ctx }) },

  // ── CLUSTER 3 : Client identifié (Richard) ───────────────────────────────

  {
    id: "richard",
    messages: () => [
      "Salut ! Moi, c'est Alex, ton conseiller épargne chez WiseWallet 💼💡\nTu m'avais parlé d'un projet de voyage ✈️🌍\nJe te propose : 2 500 € sur 9 mois, avec des mensualités d'environ 278 € 💸",
    ],
    buttons: () => ["✓ Ce plan me convient", "✏️ Je préfère personnaliser"],
    onInput: (input, ctx) => {
      if (input === "✓ Ce plan me convient") {
        const newCtx: AlexCtx = {
          ...ctx,
          profile: "secondaire",
          prenom: "Richard",
          projets: ["✈️ Voyage"],
          currentProjIdx: 0,
          budgets: { "✈️ Voyage": 2500 },
          horizons: { "✈️ Voyage": 9 },
          epargne: 278,
        };
        return {
          nextId: "richard_validation",
          ctx: newCtx,
          card: {
            title: "✈️ Voyage",
            body: "Objectif   : 2 500 €\nDurée      : 9 mois\nMensualité : 278 €/mois",
            confirmQuestion: "Ce plan te convient ? 👌",
            buttons: ["✓ Ce plan me convient", "✏️ Je préfère personnaliser"],
            onValidate: "richard_confirme",
            onEdit: "richard_budget",
          },
        };
      }
      // Personnaliser → reprendre à partir du budget
      return {
        nextId: "richard_budget",
        ctx: {
          ...ctx,
          profile: "secondaire",
          prenom: "Richard",
          projets: ["✈️ Voyage"],
          currentProjIdx: 0,
          epargne: 278,
        },
      };
    },
  },

  {
    id: "richard_validation",
    messages: () => [],
    buttons: null,
    onInput: (_i, ctx) => ({ nextId: "notif_question", ctx }),
  },

  {
    id: "richard_confirme",
    messages: () => ["Nickel Richard 👌 Ton projet voyage est créé et ajouté à ton tableau de bord !"],
    buttons: null,
    autoAdvance: true,
    onInput: (_i, ctx) => ({ nextId: "notif_question", ctx }),
  },

  {
    id: "richard_budget",
    messages: () => ["Pas de souci Richard 👍 On va affiner tout ça ensemble.\nDis-moi, t'as un budget précis en tête pour ce voyage ?"],
    buttons: () => BUDGET_BUTTONS["✈️ Voyage"],
    onInput: (input, ctx) => {
      if (input === "✏️ Autre montant") return { nextId: "budget_libre", ctx };
      const amount = parseAmount(input) ?? 2500;
      return { nextId: "horizon_projet", ctx: { ...ctx, budgets: { "✈️ Voyage": amount } } };
    },
  },
];

// ── Engine ────────────────────────────────────────────────────────────────

function buildValidationCard(ctx: AlexCtx): StepOutput {
  const proj = currentProjet(ctx);
  const budget = ctx.budgets[proj] ?? 0;
  const horizon = ctx.horizons[proj] ?? 12;
  const mensualite = Math.ceil(budget / horizon);

  const card: ValidationCard = {
    title: proj,
    body: `Objectif   : ${budget.toLocaleString("fr-FR")} €\nDurée      : ${fmtMois(horizon)}\nMensualité : ${mensualite} €/mois`,
    confirmQuestion: p(ctx, {
      junior:     "Ça te convient ? 😊",
      cible:      "C'est good pour toi ? 👌",
      secondaire: "C'est correct pour toi ?",
      senior:     "C'est bien cela ?",
    }),
    buttons: ["✓ C'est bon", "✏️ Je veux modifier"],
    onValidate: "projet_ajoute",
    onEdit: "budget_projet",
  };

  return { nextId: "show_card", ctx, card };
}

const stepsMap = new Map(steps.map((s) => [s.id, s]));

export function getStep(id: string): AlexStep | undefined {
  return stepsMap.get(id);
}

// Appelé quand l'utilisateur valide une carte (✓ C'est bon → projet suivant ou notif)
export function afterValidation(ctx: AlexCtx): StepOutput {
  const nextIdx = ctx.currentProjIdx + 1;
  if (nextIdx < ctx.projets.length) {
    return {
      nextId: "next_project",
      ctx: { ...ctx, currentProjIdx: nextIdx },
    };
  }
  return { nextId: "notif_question", ctx };
}
