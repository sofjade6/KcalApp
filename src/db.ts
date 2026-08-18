import Dexie, { type EntityTable } from 'dexie'
import type { Gluten } from './lib/gluten'

/** Valeurs nutritionnelles, toujours ramenées à 100 g. */
export interface Nutriments {
  kcal: number
  prot: number
  lip: number
  gluc: number
  /**
   * Nutriments secondaires. Facultatifs : les entrées enregistrées avant leur
   * arrivée n'en portent pas, et toutes les sources ne les fournissent pas.
   */
  fib?: number
  sel?: number
  suc?: number
  ags?: number
}

/** Nutriments secondaires, avec leur libellé et leur unité d'affichage. */
export const SECONDAIRES = [
  { cle: 'fib', nom: 'Fibres', unite: 'g' },
  { cle: 'suc', nom: 'Sucres', unite: 'g' },
  { cle: 'ags', nom: 'Acides gras saturés', unite: 'g' },
  { cle: 'sel', nom: 'Sel', unite: 'g' },
] as const

/**
 * Une portion consommée. On stocke les valeurs pour 100 g plus la quantité
 * plutôt que le total déjà calculé : corriger un poids mal saisi ne doit pas
 * demander de ressaisir l'aliment.
 */
export interface Entree extends Nutriments {
  id?: number
  /** Jour local au format AAAA-MM-JJ. */
  date: string
  nom: string
  grammes: number
  /**
   * Portion usuelle utilisée à la saisie, quand la quantité n'a pas été
   * donnée en grammes. Conservée pour réafficher « 2 œufs » plutôt que
   * « 100 g », et retrouver le même réglage à la correction.
   */
  portion?: { nom: string; grammes: number; nombre: number }
  /** Code-barres, quand l'entrée vient d'un scan. */
  code?: string
  /**
   * Statut gluten déclaré par l'étiquette, quand il est connu. Absent pour un
   * aliment CIQUAL, dont le statut se déduit du libellé à l'affichage — ainsi
   * une amélioration des règles profite aux entrées déjà enregistrées.
   */
  gluten?: Gluten
  /** Compté en millilitres plutôt qu'en grammes. */
  liquide?: boolean
  /**
   * Volume saisi, quand la quantité a été donnée en millilitres. `grammes`
   * reste la masse réelle, seule base du calcul : pour une huile, 10 ml ne
   * pèsent que 9,2 g.
   */
  ml?: number
  source: 'ciqual' | 'openfoodfacts' | 'manuel' | 'recette'
  creeLe: number
}

/** Aliment mémorisé localement : produit scanné, saisi à la main, ou recette. */
export interface AlimentEnCache extends Nutriments {
  code: string
  nom: string
  marque?: string
  /**
   * Composition, pour une recette. Chaque ingrédient porte ses propres
   * valeurs pour 100 g : c'est ce qui permet de recalculer la préparation
   * quand on ajoute ou retire quelque chose.
   */
  ingredients?: (Nutriments & {
    nom: string
    grammes: number
    code?: string
    gluten?: Gluten
    liquide?: boolean
  })[]
  poidsTotal?: number
  gluten?: Gluten
  liquide?: boolean
  /** Portion indiquée sur l'emballage, telle que rapportée par OpenFoodFacts. */
  portionG?: number
  portionNom?: string
  source: 'ciqual' | 'openfoodfacts' | 'manuel' | 'recette'
  vuLe: number
}

export interface Pesee {
  date: string
  kg: number
}

/** Verres d'eau bus dans la journée. */
export interface Hydratation {
  date: string
  verres: number
}

/** Dépense ajoutée au budget du jour. */
export interface Activite {
  id?: number
  date: string
  nom: string
  kcal: number
  creeLe: number
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
  /** Rythme visé en kg par semaine, en valeur absolue. Le but donne le sens. */
  rythme?: number
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
  hydratation: EntityTable<Hydratation, 'date'>
  activites: EntityTable<Activite, 'id'>
}

db.version(1).stores({
  profil: 'id',
  entrees: '++id, date, [date+repas]',
  aliments: 'code, nom, vuLe',
  pesees: 'date',
})

// Les tables ajoutées sont vides au départ : aucune reprise de données à
// prévoir, seuls les index changent.
db.version(2).stores({
  recettes: '++id, nom, majLe',
  hydratation: 'date',
  activites: '++id, date',
})

// Une recette est finalement un aliment mémorisé comme un autre : elle hérite
// ainsi de la recherche, de la résolution et des portions, sans seconde voie
// à maintenir. La table dédiée est retirée.
db.version(3).stores({ recettes: null })

// Le découpage en repas est abandonné au profit d'une liste unique par jour :
// l'index composé n'a plus d'objet. Les entrées existantes conservent leur
// ancien champ `repas`, sans effet — rien ne le lit plus.
db.version(4).stores({ entrees: '++id, date' })

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

export async function majHydratation(date: string, verres: number) {
  if (verres <= 0) await db.hydratation.delete(date)
  else await db.hydratation.put({ date, verres })
}

export async function ajouterActivite(date: string, nom: string, kcal: number) {
  await db.activites.add({ date, nom, kcal, creeLe: Date.now() })
}

export default db
