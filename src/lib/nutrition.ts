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

export function cumuler(entrees: Entree[]): Nutriments {
  return entrees.reduce<Nutriments>(
    (total, entree) => {
      const p = portion(entree)
      return {
        kcal: total.kcal + p.kcal,
        prot: total.prot + p.prot,
        lip: total.lip + p.lip,
        gluc: total.gluc + p.gluc,
      }
    },
    { kcal: 0, prot: 0, lip: 0, gluc: 0 },
  )
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
