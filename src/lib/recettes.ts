import db, { type AlimentEnCache, type Nutriments } from '../db'
import { resumerGluten, statutGluten, type Gluten } from './gluten'

export interface Ingredient extends Nutriments {
  nom: string
  grammes: number
  /** Code de l'aliment d'origine, quand il en avait un. */
  code?: string
  gluten?: Gluten
  liquide?: boolean
}

export type Recette = AlimentEnCache & {
  ingredients: Ingredient[]
  poidsTotal: number
}

export const estRecette = (a: AlimentEnCache): a is Recette => a.source === 'recette'

/** Poids par défaut d'une préparation : la somme de ses ingrédients. */
export const poidsDesIngredients = (ingredients: Ingredient[]) =>
  ingredients.reduce((total, i) => total + i.grammes, 0)

/**
 * Valeurs de la préparation ramenées à 100 g.
 *
 * Un nutriment secondaire n'est calculé que si au moins un ingrédient le
 * renseigne : additionner des absences donnerait un zéro trompeur.
 */
export function pour100(ingredients: Ingredient[], poidsTotal: number): Nutriments {
  const cumul = (cle: keyof Nutriments): number | undefined => {
    let total = 0
    let renseigne = false
    for (const i of ingredients) {
      const valeur = i[cle]
      if (valeur === undefined) continue
      renseigne = true
      total += (valeur * i.grammes) / 100
    }
    if (!renseigne) return undefined
    return Math.round((total / poidsTotal) * 100 * 100) / 100
  }

  return {
    kcal: cumul('kcal') ?? 0,
    prot: cumul('prot') ?? 0,
    lip: cumul('lip') ?? 0,
    gluc: cumul('gluc') ?? 0,
    fib: cumul('fib'),
    sel: cumul('sel'),
    suc: cumul('suc'),
    ags: cumul('ags'),
  }
}

export async function creerRecette(nom: string, ingredients: Ingredient[] = []): Promise<string> {
  const code = `recette-${crypto.randomUUID()}`
  const poidsTotal = poidsDesIngredients(ingredients) || 100
  await db.aliments.put({
    code,
    nom,
    source: 'recette',
    ingredients,
    poidsTotal,
    ...pour100(ingredients, poidsTotal),
    // Une préparation hérite du statut le plus préoccupant de ses ingrédients.
    gluten: resumerGluten(ingredients.map(statutGluten)),
    vuLe: Date.now(),
  })
  return code
}

/**
 * Modifie une recette et recalcule ses valeurs.
 *
 * La transaction est nécessaire : ajouter deux ingrédients coup sur coup sans
 * elle ferait repartir la seconde écriture d'une recette lue avant la
 * première, et perdrait un ingrédient.
 */
export async function majRecette(
  code: string,
  changement: (recette: Recette) => Partial<Pick<Recette, 'nom' | 'ingredients' | 'poidsTotal'>>,
): Promise<void> {
  await db.transaction('rw', db.aliments, async () => {
    const actuelle = await db.aliments.get(code)
    if (!actuelle || !estRecette(actuelle)) return

    const modifs = changement(actuelle)
    const ingredients = modifs.ingredients ?? actuelle.ingredients
    const poidsTotal =
      modifs.poidsTotal ?? (modifs.ingredients ? poidsDesIngredients(ingredients) : actuelle.poidsTotal)
    const poidsUtile = poidsTotal > 0 ? poidsTotal : 1

    await db.aliments.put({
      ...actuelle,
      nom: modifs.nom ?? actuelle.nom,
      ingredients,
      poidsTotal,
      ...pour100(ingredients, poidsUtile),
      gluten: resumerGluten(ingredients.map(statutGluten)),
      vuLe: Date.now(),
    })
  })
}

export const ajouterIngredient = (code: string, ingredient: Ingredient) =>
  majRecette(code, (r) => ({ ingredients: [...r.ingredients, ingredient] }))

export const retirerIngredient = (code: string, rang: number) =>
  majRecette(code, (r) => ({ ingredients: r.ingredients.filter((_, i) => i !== rang) }))

/** Calories apportées par un ingrédient, arrondies une seule fois. */
export const kcalIngredient = (i: Ingredient) => Math.round((i.kcal * i.grammes) / 100)
