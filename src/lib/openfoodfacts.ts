import type { Nutriments } from '../db'

export interface ProduitTrouve extends Nutriments {
  code: string
  nom: string
  marque?: string
  /** Portion de l'emballage, quand elle est exploitable. */
  portionG?: number
  portionNom?: string
}

export type Resultat =
  | { etat: 'trouve'; produit: ProduitTrouve }
  /** Code-barres absent de la base. */
  | { etat: 'inconnu' }
  /** Produit connu, mais sans valeurs nutritionnelles exploitables. */
  | { etat: 'incomplet'; nom: string }
  | { etat: 'erreur'; message: string }

const DELAI_MAX = 8000

/** Seuls ces champs sont demandés : la fiche complète pèse plusieurs centaines de Ko. */
const CHAMPS =
  'product_name,product_name_fr,brands,nutriments,serving_quantity,serving_quantity_unit'

const nombre = (valeur: unknown): number | undefined =>
  typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : undefined

/**
 * Recherche un produit par son code-barres.
 *
 * Seul l'accès direct par code est utilisé : l'API de recherche texte
 * d'OpenFoodFacts s'est révélée instable, la recherche par nom passe donc
 * par la table CIQUAL embarquée.
 */
export async function chercherProduit(code: string): Promise<Resultat> {
  const abandon = new AbortController()
  const minuteur = setTimeout(() => abandon.abort(), DELAI_MAX)

  try {
    const reponse = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${CHAMPS}`,
      { signal: abandon.signal },
    )

    // L'API répond 404 sur un code inconnu, et non un corps vide.
    if (reponse.status === 404) return { etat: 'inconnu' }
    if (!reponse.ok) return { etat: 'erreur', message: `réponse ${reponse.status}` }

    const donnees = await reponse.json()
    if (donnees.status !== 1 || !donnees.product) return { etat: 'inconnu' }

    const produit = donnees.product
    const nom: string =
      produit.product_name_fr?.trim() || produit.product_name?.trim() || ''
    const n = produit.nutriments ?? {}

    // Certaines fiches ne portent que l'énergie en kilojoules.
    const kj = nombre(n['energy-kj_100g'])
    const kcal = nombre(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined)

    if (!nom) return { etat: 'incomplet', nom: code }
    if (kcal === undefined) return { etat: 'incomplet', nom }

    // Les valeurs nutritionnelles étant ramenées à 100 g, une portion en
    // millilitres n'est exploitable qu'en l'assimilant à des grammes — vrai
    // pour les boissons, dont la densité est proche de 1.
    const uniteServing = produit.serving_quantity_unit
    const servingG =
      uniteServing === 'g' || uniteServing === 'ml'
        ? nombre(Number(produit.serving_quantity))
        : undefined

    return {
      etat: 'trouve',
      produit: {
        code,
        nom,
        marque: produit.brands?.split(',')[0]?.trim() || undefined,
        portionG: servingG,
        portionNom: servingG !== undefined ? 'portion' : undefined,
        kcal: Math.round(kcal * 10) / 10,
        prot: nombre(n.proteins_100g) ?? 0,
        lip: nombre(n.fat_100g) ?? 0,
        gluc: nombre(n.carbohydrates_100g) ?? 0,
      },
    }
  } catch (erreur) {
    if (erreur instanceof DOMException && erreur.name === 'AbortError') {
      return { etat: 'erreur', message: 'délai dépassé' }
    }
    return { etat: 'erreur', message: 'réseau indisponible' }
  } finally {
    clearTimeout(minuteur)
  }
}
