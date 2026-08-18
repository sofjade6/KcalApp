import { normaliser } from './recherche'

/**
 * Groupe CIQUAL « eaux et autres boissons ». Il ne suffit pas à lui seul : on
 * y trouve du café soluble, du thé en feuilles et des sirops à diluer, qui se
 * pèsent en grammes.
 */
const GROUPE_BOISSONS = '06'
const GROUPE_LAITIERS = '05'
const GROUPE_PLATS = '01'

/** Présentations solides ou à reconstituer, malgré leur classement en boisson. */
const PAS_LIQUIDE = /poudre|soluble|lyophilis|\bfeuilles?\b|\bgrains?\b|a diluer|\bsachet\b|\bextrait\b/

/** Produits laitiers qui se boivent, le reste du groupe se mangeant. */
const LAITIER_BUVABLE = /^lait\b|^boisson lactee|yaourt a boire|lait fermente|^lait ribot/

/** Préparations liquides servies en volume. */
const PLAT_LIQUIDE = /\bsoupe\b|potage|veloute|bouillon|consomme/

/**
 * Un aliment se compte-t-il en millilitres ?
 *
 * `declare` vient de l'emballage, relayé par OpenFoodFacts : il fait foi. À
 * défaut, le groupe CIQUAL tranche, et le libellé sert d'ultime recours pour
 * les entrées enregistrées avant que l'information ne soit conservée.
 */
export function estLiquide(
  nom: string,
  groupe?: string,
  declare?: boolean,
): boolean {
  if (declare !== undefined) return declare

  const cherchable = normaliser(nom)
  if (PAS_LIQUIDE.test(cherchable)) return false

  if (groupe === GROUPE_BOISSONS) return true
  if (groupe === GROUPE_LAITIERS) return LAITIER_BUVABLE.test(cherchable)
  if (groupe === GROUPE_PLATS) return PLAT_LIQUIDE.test(cherchable)

  // Sans groupe connu — entrée ancienne, saisie manuelle — le libellé décide.
  if (groupe === undefined) {
    return (
      LAITIER_BUVABLE.test(cherchable) ||
      PLAT_LIQUIDE.test(cherchable) ||
      /^(eau|the|cafe|jus|boisson|biere|vin|cidre|soda|limonade|sirop|smoothie|nectar|infusion|tisane)\b/.test(
        cherchable,
      )
    )
  }
  return false
}

/**
 * Unité d'affichage.
 *
 * Les valeurs nutritionnelles restent rapportées à 100 g : un millilitre est
 * compté pour un gramme. Exact pour une boisson scannée, dont l'étiquette
 * déclare déjà par 100 ml ; approché à quelques pourcents près pour la table
 * CIQUAL, où la densité d'un soda ou d'un lait dépasse légèrement 1.
 */
export const unite = (liquide: boolean) => (liquide ? 'ml' : 'g')
