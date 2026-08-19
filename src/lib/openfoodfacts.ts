import type { Nutriments } from '../db'
import { glutenDeclare, type Gluten } from './gluten'

export interface ProduitTrouve extends Nutriments {
  code: string
  nom: string
  marque?: string
  /** Portion de l'emballage, quand elle est exploitable. */
  portionG?: number
  portionNom?: string
  gluten?: Gluten
  liquide?: boolean
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
  'product_name,product_name_fr,product_name_en,generic_name,generic_name_fr,brands,' +
  'nutriments,serving_quantity,serving_quantity_unit,product_quantity_unit,' +
  'nutrition_data_per,allergens_tags,traces_tags,labels_tags'

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
    // Beaucoup de fiches ne remplissent le nom que dans une langue, parfois
    // aucune : une eau de coco vietnamienne n'était nommée qu'en anglais, et
    // l'app la déclarait inexploitable alors que toutes ses valeurs y étaient.
    // La marque sert de dernier recours plutôt que de rejeter le produit.
    const nom: string =
      [
        produit.product_name_fr,
        produit.product_name,
        produit.product_name_en,
        produit.generic_name_fr,
        produit.generic_name,
        produit.brands?.split(',')[0],
      ]
        .map((valeur?: string) => valeur?.trim())
        .find((valeur?: string) => !!valeur) ?? ''
    const n = produit.nutriments ?? {}

    // Certaines fiches ne portent que l'énergie en kilojoules.
    const kj = nombre(n['energy-kj_100g'])
    const kcal = nombre(n['energy-kcal_100g']) ?? (kj !== undefined ? kj / 4.184 : undefined)

    if (!nom) return { etat: 'incomplet', nom: code }
    if (kcal === undefined) return { etat: 'incomplet', nom }

    // L'unité de l'emballage tranche, quand elle est renseignée : les
    // catégories d'OpenFoodFacts ne sont pas fiables pour ça — un muesli et un
    // beurre de cacahuète s'y trouvent rangés parmi les boissons.
    //
    // Trois états et non deux : une fiche muette sur l'unité laisse la
    // question ouverte, pour que la déduction sur le nom prenne le relais.
    // Renvoyer `false` faisait passer une boisson mal renseignée en grammes.
    // `nutrition_data_per` est le signal le plus explicite : il dit sur quelle
    // base l'étiquette a été relevée.
    const unites = [
      produit.product_quantity_unit,
      produit.serving_quantity_unit,
      produit.nutrition_data_per === '100ml' ? 'ml' : undefined,
    ]
    const liquide = unites.includes('ml')
      ? true
      : unites.includes('g')
        ? false
        : undefined

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
        liquide,
        gluten: glutenDeclare(
          produit.allergens_tags,
          produit.traces_tags,
          produit.labels_tags,
        ),
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
