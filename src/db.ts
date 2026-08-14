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

export type Sexe = 'femme' | 'homme'
export type But = 'perte' | 'maintien' | 'prise'
export type NiveauActivite =
  | 'sedentaire'
  | 'leger'
  | 'modere'
  | 'intense'
  | 'tres-intense'

export interface Profil {
  id: 'moi'

  /** Données corporelles, absentes tant que l'utilisateur ne les a pas saisies. */
  sexe?: Sexe
  /** Date de naissance AAAA-MM-JJ — l'âge en découle et reste juste avec le temps. */
  naissance?: string
  tailleCm?: number
  activite?: NiveauActivite
  but?: But
  poidsCible?: number

  objectifKcal: number
  objectifProt: number
  objectifLip: number
  objectifGluc: number
  /** Faux dès que les objectifs ont été forcés à la main : le calcul ne les écrase plus. */
  objectifsAuto: boolean

  /** Dernier export réussi, pour savoir quand relancer l'utilisateur. */
  derniereSauvegarde?: number

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
  objectifsAuto: true,
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
  /** Code-barres, quand la saisie fait suite à un scan resté sans réponse. */
  codeBarres?: string,
): Promise<string> {
  const code = codeBarres ?? `manuel-${crypto.randomUUID()}`
  // `put` et non `add` : ressaisir un produit déjà scanné doit le corriger,
  // pas échouer sur une clé en double.
  await db.aliments.put({ ...saisie, code, source: 'manuel', vuLe: Date.now() })
  return code
}

/** Remonte un aliment dans la liste des derniers utilisés. */
export async function marquerUtilise(code: string) {
  await db.aliments.update(code, { vuLe: Date.now() })
}

/**
 * Les champs corporels sont arrivés après la première version : un profil
 * enregistré avant ne les porte pas. La fusion avec les valeurs par défaut
 * évite de migrer le schéma pour des champs qui ne sont pas indexés.
 */
export async function lireProfil(): Promise<Profil> {
  const stocke = await db.profil.get('moi')
  return stocke ? { ...PROFIL_DEFAUT, ...stocke } : PROFIL_DEFAUT
}

/**
 * Modifie une partie du profil.
 *
 * La transaction est indispensable : lire puis écrire sans elle laisse deux
 * modifications rapprochées se marcher dessus — la seconde repart d'un profil
 * lu avant que la première ne soit enregistrée, et l'efface. Renseigner
 * plusieurs champs à la suite suffit à déclencher le cas.
 */
export async function majProfil(champs: Partial<Omit<Profil, 'id'>>) {
  await db.transaction('rw', db.profil, async () => {
    const actuel = (await db.profil.get('moi')) ?? PROFIL_DEFAUT
    await db.profil.put({
      ...PROFIL_DEFAUT,
      ...actuel,
      ...champs,
      id: 'moi',
      majLe: Date.now(),
    })
  })
}

/** Une seule pesée par jour : se repeser le même jour corrige la valeur. */
export async function enregistrerPesee(date: string, kg: number) {
  await db.pesees.put({ date, kg })
}

export async function supprimerPesee(date: string) {
  await db.pesees.delete(date)
}

export default db
