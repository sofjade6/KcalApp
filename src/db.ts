import Dexie, { type EntityTable } from 'dexie'

export type Repas = 'petit-dejeuner' | 'dejeuner' | 'diner' | 'collation'

export const REPAS: { cle: Repas; nom: string }[] = [
  { cle: 'petit-dejeuner', nom: 'Petit-déjeuner' },
  { cle: 'dejeuner', nom: 'Déjeuner' },
  { cle: 'diner', nom: 'Dîner' },
  { cle: 'collation', nom: 'Collation' },
]

/** Valeurs nutritionnelles, toujours ramenées à 100 g. */
export interface Nutriments {
  kcal: number
  prot: number
  lip: number
  gluc: number
}

/**
 * Une portion consommée. On stocke les valeurs pour 100 g plus la quantité
 * plutôt que le total déjà calculé : corriger un poids mal saisi ne doit pas
 * demander de ressaisir l'aliment.
 */
export interface Entree extends Nutriments {
  id?: number
  /** Jour local au format AAAA-MM-JJ. */
  date: string
  repas: Repas
  nom: string
  grammes: number
  /** Code-barres, quand l'entrée vient d'un scan. */
  code?: string
  source: 'ciqual' | 'openfoodfacts' | 'manuel'
  creeLe: number
}

/** Aliment mémorisé localement : produit scanné ou favori. */
export interface AlimentEnCache extends Nutriments {
  code: string
  nom: string
  marque?: string
  source: 'ciqual' | 'openfoodfacts' | 'manuel'
  vuLe: number
}

export interface Pesee {
  date: string
  kg: number
}

export interface Profil {
  id: 'moi'
  objectifKcal: number
  objectifProt: number
  objectifLip: number
  objectifGluc: number
  majLe: number
}

const db = new Dexie('kcalapp') as Dexie & {
  profil: EntityTable<Profil, 'id'>
  entrees: EntityTable<Entree, 'id'>
  aliments: EntityTable<AlimentEnCache, 'code'>
  pesees: EntityTable<Pesee, 'date'>
}

db.version(1).stores({
  profil: 'id',
  // [date+repas] sert le regroupement par repas de l'écran du jour.
  entrees: '++id, date, [date+repas]',
  aliments: 'code, nom, vuLe',
  pesees: 'date',
})

/**
 * Objectifs par défaut, volontairement génériques : le calcul personnalisé
 * (Mifflin-St Jeor) arrive avec l'écran Poids & objectifs.
 */
export const PROFIL_DEFAUT: Profil = {
  id: 'moi',
  objectifKcal: 2000,
  objectifProt: 130,
  objectifLip: 65,
  objectifGluc: 220,
  majLe: 0,
}

/**
 * Mémorise un aliment saisi à la main pour qu'il soit reproposé ensuite.
 *
 * Ces aliments n'ont pas de code-barres : on leur en fabrique un, préfixé,
 * pour qu'ils cohabitent sans risque avec les codes EAN d'OpenFoodFacts.
 */
export async function creerAlimentManuel(
  saisie: Nutriments & { nom: string; marque?: string },
): Promise<string> {
  const code = `manuel-${crypto.randomUUID()}`
  await db.aliments.add({ ...saisie, code, source: 'manuel', vuLe: Date.now() })
  return code
}

/** Remonte un aliment dans la liste des derniers utilisés. */
export async function marquerUtilise(code: string) {
  await db.aliments.update(code, { vuLe: Date.now() })
}

export async function lireProfil(): Promise<Profil> {
  return (await db.profil.get('moi')) ?? PROFIL_DEFAUT
}

export async function enregistrerProfil(profil: Omit<Profil, 'id' | 'majLe'>) {
  await db.profil.put({ ...profil, id: 'moi', majLe: Date.now() })
}

export default db
