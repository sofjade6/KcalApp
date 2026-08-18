import { normaliser } from './recherche'

/**
 * Groupe CIQUAL « eaux et autres boissons ». Il ne suffit pas à lui seul : on
 * y trouve du café soluble, du thé en feuilles et des sirops à diluer, qui se
 * pèsent en grammes.
 */
const GROUPE_BOISSONS = '06'
const GROUPE_LAITIERS = '05'
const GROUPE_PLATS = '01'
const GROUPE_GRASSES = '09'

/** Présentations solides ou à reconstituer, malgré leur classement en boisson. */
const PAS_LIQUIDE = /poudre|soluble|lyophilis|\bfeuilles?\b|\bgrains?\b|a diluer|\bsachet\b|\bextrait\b/

/** Produits laitiers qui se boivent, le reste du groupe se mangeant. */
const LAITIER_BUVABLE = /^lait\b|^boisson lactee|yaourt a boire|lait fermente|^lait ribot/

/** Préparations liquides servies en volume. */
const PLAT_LIQUIDE = /\bsoupe\b|potage|veloute|bouillon|consomme/

/**
 * Huiles alimentaires, liquides à température ambiante.
 *
 * Le groupe des matières grasses contient aussi des corps solides — beurres,
 * margarines, saindoux — et des « huiles » qui n'en sont pas : l'huile de coco
 * et le beurre de cacao sont solides et se pèsent.
 */
const HUILE_LIQUIDE = /^huile\b/
const GRASSE_SOLIDE = /beurre|graisse|solide|\bcoco\b|karite|palme/

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
  if (groupe === GROUPE_GRASSES) {
    return HUILE_LIQUIDE.test(cherchable) && !GRASSE_SOLIDE.test(cherchable)
  }

  // Sans groupe connu — entrée ancienne, saisie manuelle — le libellé décide.
  if (groupe === undefined) {
    return (
      LAITIER_BUVABLE.test(cherchable) ||
      PLAT_LIQUIDE.test(cherchable) ||
      (HUILE_LIQUIDE.test(cherchable) && !GRASSE_SOLIDE.test(cherchable)) ||
      /^(eau|the|cafe|jus|boisson|biere|vin|cidre|soda|limonade|sirop|smoothie|nectar|infusion|tisane|vinaigre)\b/.test(
        cherchable,
      )
    )
  }
  return false
}

/**
 * Masse d'un millilitre, en grammes.
 *
 * Les valeurs nutritionnelles sont rapportées à 100 g : convertir le volume
 * saisi en masse est ce qui garde le calcul juste. Pour les boissons aqueuses,
 * 1 ml pèse assez exactement 1 g pour qu'un facteur soit inutile. Pour une
 * huile, en revanche, l'écart atteint 8 % — sur un aliment à 900 kcal, le
 * négliger fausserait le compte de façon systématique.
 */
export function densite(nom: string): number {
  const cherchable = normaliser(nom)
  if (HUILE_LIQUIDE.test(cherchable)) return 0.92
  return 1
}

export const unite = (liquide: boolean) => (liquide ? 'ml' : 'g')
