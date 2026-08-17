import { normaliser } from './recherche'

/**
 * Niveaux de certitude, du plus sûr au plus flou.
 *
 * `contient`, `traces` et `sans` viennent d'une déclaration d'étiquette,
 * relayée par OpenFoodFacts. `probable` est une déduction faite sur le libellé
 * d'un aliment CIQUAL, qui ne porte aucune donnée d'allergène : le gluten
 * n'est quantifié dans aucune base, et la réglementation impose de le
 * déclarer, pas de le doser.
 */
export type Gluten = 'contient' | 'traces' | 'sans' | 'probable' | 'inconnu'

export const LIBELLES: Record<Gluten, string> = {
  contient: 'Contient du gluten',
  traces: 'Traces possibles de gluten',
  sans: 'Sans gluten',
  probable: 'Peut contenir du gluten',
  inconnu: 'Non renseigné',
}

/** Du plus préoccupant au moins : sert à résumer un ensemble d'aliments. */
const RANG: Record<Gluten, number> = {
  contient: 4,
  probable: 3,
  traces: 2,
  inconnu: 1,
  sans: 0,
}

/**
 * Céréales à gluten et préparations qui en dérivent.
 *
 * L'avoine y figure : naturellement sans gluten, elle est en pratique
 * contaminée par les filières blé, et la réglementation européenne la range
 * parmi les céréales à déclarer.
 */
const INDICES =
  /\bble\b|\bbles\b|froment|\borge\b|\bseigle\b|epeautre|kamut|triticale|\bavoine\b|\bmalt\b|\bbiere\b|seitan|\bpain\b|baguette|brioche|viennoiserie|croissant|biscotte|chapelure|\bpates\b|pate a (pizza|tarte|crepe|choux|pain)|pate (brisee|feuilletee|sablee|sucree|a pain)|nouille|vermicelle|macaroni|spaghetti|ravioli|lasagne|cannelloni|gnocchi|semoule|couscous|boulgour|\bbulgur\b|\bbiscuit|gateau|madeleine|gaufre|crepe|\bpizza\b|\btarte\b|tourte|quiche|beignet|\bcake\b|muffin|cookie|barre cerealiere|cereales? pour petit dejeuner|muesli|\bsone? de ble\b/

/**
 * Le singulier « pâte » est volontairement absent des indices : privé de ses
 * accents, « pâté » devient « pate » et signalait toute terrine comme
 * contenant du gluten. Seuls le pluriel et les pâtes à préparer sont retenus.
 *
 * Libellés qui contiennent un mot de la liste sans porter de gluten.
 *
 * Les pâtes et farines existent en versions sans céréale à gluten, et « pâte
 * de fruits » n'a rien d'une pâte alimentaire. Sans ces exclusions, la
 * déduction se trompait sur des aliments courants.
 */
const EXCEPTIONS =
  /\b(riz|mais|sarrasin|chataigne|pois chiche|lentille|soja|quinoa|millet|sorgho|manioc|coco|amande|noisette)\b.*\b(pates?|farine|nouille|vermicelle|semoule|pain|galette)\b|\b(pates?|farine|nouille|vermicelle|semoule|pain|galette)\b.*\b(de |au |aux )(riz|mais|sarrasin|chataigne|pois chiche|lentille|soja|quinoa|millet|sorgho|manioc)\b|pate de fruit|pates? de fruits|pate a tartiner|pate d'amande|sans gluten/

/** Déduit le statut du libellé d'un aliment, faute de donnée d'allergène. */
export function glutenProbable(nom: string): Gluten {
  const cherchable = normaliser(nom)
  if (EXCEPTIONS.test(cherchable)) return 'inconnu'
  return INDICES.test(cherchable) ? 'probable' : 'inconnu'
}

/** Traduit les étiquettes d'allergènes d'OpenFoodFacts. */
export function glutenDeclare(
  allergenes: string[] = [],
  traces: string[] = [],
  labels: string[] = [],
): Gluten {
  const contient = (liste: string[]) => liste.some((t) => t.endsWith(':gluten'))
  if (contient(allergenes)) return 'contient'
  if (labels.some((l) => l.endsWith(':no-gluten') || l.endsWith(':gluten-free'))) return 'sans'
  if (contient(traces)) return 'traces'
  return 'inconnu'
}

/**
 * Statut d'un aliment consommé.
 *
 * Une déclaration d'étiquette prime toujours sur la déduction : ce n'est pas
 * la même qualité d'information.
 */
export function statutGluten(aliment: { nom: string; gluten?: Gluten }): Gluten {
  if (aliment.gluten && aliment.gluten !== 'inconnu') return aliment.gluten
  return glutenProbable(aliment.nom)
}

/** Statut résumé d'un ensemble : le plus préoccupant l'emporte. */
export function resumerGluten(statuts: Gluten[]): Gluten {
  return statuts.reduce<Gluten>(
    (pire, s) => (RANG[s] > RANG[pire] ? s : pire),
    'inconnu',
  )
}
