import type { Entree, Nutriments } from '../db'

/** Valeurs d'une entrée ramenées à sa quantité réelle. */
export function portion(entree: Entree): Nutriments {
  const facteur = entree.grammes / 100
  return {
    kcal: entree.kcal * facteur,
    prot: entree.prot * facteur,
    lip: entree.lip * facteur,
    gluc: entree.gluc * facteur,
  }
}

/**
 * Cumul d'un ensemble d'entrées.
 *
 * Les nutriments secondaires ne sont additionnés que si au moins une entrée
 * les porte : un total de 0 g de fibres est trompeur quand la vraie réponse
 * est « non renseigné ».
 */
export function cumuler(entrees: Entree[]): Nutriments {
  const total: Nutriments = { kcal: 0, prot: 0, lip: 0, gluc: 0 }

  for (const entree of entrees) {
    const facteur = entree.grammes / 100
    total.kcal += entree.kcal * facteur
    total.prot += entree.prot * facteur
    total.lip += entree.lip * facteur
    total.gluc += entree.gluc * facteur

    for (const cle of ['fib', 'sel', 'suc', 'ags'] as const) {
      const valeur = entree[cle]
      if (valeur !== undefined) total[cle] = (total[cle] ?? 0) + valeur * facteur
    }
  }

  return total
}

/** Part de l'énergie apportée par chaque macronutriment, en pourcentage. */
export function repartition(n: Nutriments): { prot: number; lip: number; gluc: number } | null {
  // Les facteurs Atwater plutôt que les kcal déclarées : la somme des macros
  // doit faire 100 %, ce que l'énergie mesurée ne garantit pas.
  const energie = n.prot * 4 + n.lip * 9 + n.gluc * 4
  if (energie <= 0) return null
  return {
    prot: Math.round((n.prot * 4 * 100) / energie),
    lip: Math.round((n.lip * 9 * 100) / energie),
    gluc: Math.round((n.gluc * 4 * 100) / energie),
  }
}

/**
 * Calories d'une portion, arrondies une seule fois.
 *
 * Les totaux affichés s'appuient tous sur cette valeur plutôt que sur les
 * décimales exactes : sinon les lignes, les repas et le total du jour, chacun
 * arrondi de son côté, ne s'additionnent plus à l'écran — 306 + 594 + 190 = 1090
 * face à un total « exact » de 1089. L'écart réel est inférieur à la kcal ;
 * dans un journal alimentaire, des chiffres qui tombent juste valent mieux
 * qu'une précision que personne ne peut vérifier.
 */
export function kcalPortion(entree: Entree): number {
  return Math.round(portion(entree).kcal)
}

export function totalKcal(entrees: Entree[]): number {
  return entrees.reduce((total, entree) => total + kcalPortion(entree), 0)
}

export const arrondi = (valeur: number) => Math.round(valeur)
