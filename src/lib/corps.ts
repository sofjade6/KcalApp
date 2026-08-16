import type { But, NiveauActivite, Profil, Sexe } from '../db'

export const ACTIVITES: { cle: NiveauActivite; nom: string; detail: string; facteur: number }[] = [
  { cle: 'sedentaire', nom: 'Sédentaire', detail: 'travail assis, peu de marche', facteur: 1.2 },
  { cle: 'leger', nom: 'Légère', detail: 'sport 1 à 3 fois par semaine', facteur: 1.375 },
  { cle: 'modere', nom: 'Modérée', detail: 'sport 3 à 5 fois par semaine', facteur: 1.55 },
  { cle: 'intense', nom: 'Intense', detail: 'sport 6 à 7 fois par semaine', facteur: 1.725 },
  { cle: 'tres-intense', nom: 'Très intense', detail: 'métier physique ou double séance', facteur: 1.9 },
]

export const BUTS: { cle: But; nom: string; ecart: number }[] = [
  // −500 kcal/jour correspond à environ 0,5 kg par semaine, le rythme
  // habituellement retenu comme tenable.
  { cle: 'perte', nom: 'Perdre du poids', ecart: -500 },
  { cle: 'maintien', nom: 'Maintenir', ecart: 0 },
  { cle: 'prise', nom: 'Prendre du poids', ecart: 300 },
]

export function age(naissance: string, aujourdhui = new Date()): number {
  const n = new Date(naissance)
  let ans = aujourdhui.getFullYear() - n.getFullYear()
  const mois = aujourdhui.getMonth() - n.getMonth()
  if (mois < 0 || (mois === 0 && aujourdhui.getDate() < n.getDate())) ans--
  return ans
}

export function imc(kg: number, tailleCm: number): number {
  const m = tailleCm / 100
  return kg / (m * m)
}

export interface CategorieImc {
  nom: string
  /** Repère de position dans l'échelle, pour la barre de situation. */
  min: number
  max: number
}

const CATEGORIES: CategorieImc[] = [
  { nom: 'Insuffisance pondérale', min: 0, max: 18.5 },
  { nom: 'Corpulence normale', min: 18.5, max: 25 },
  { nom: 'Surpoids', min: 25, max: 30 },
  { nom: 'Obésité modérée', min: 30, max: 35 },
  { nom: 'Obésité sévère', min: 35, max: 40 },
  { nom: 'Obésité morbide', min: 40, max: Infinity },
]

export function categorieImc(valeur: number): CategorieImc {
  return CATEGORIES.find((c) => valeur < c.max) ?? CATEGORIES[CATEGORIES.length - 1]
}

/** Fourchette de poids correspondant à un IMC de 18,5 à 25. */
export function poidsNormal(tailleCm: number): [number, number] {
  const m = tailleCm / 100
  return [18.5 * m * m, 25 * m * m]
}

/** Métabolisme de base, équation de Mifflin-St Jeor. */
export function metabolismeBase(
  kg: number,
  tailleCm: number,
  ans: number,
  sexe: Sexe,
): number {
  const base = 10 * kg + 6.25 * tailleCm - 5 * ans
  return sexe === 'homme' ? base + 5 : base - 161
}

export interface Besoins {
  base: number
  /** Dépense totale, métabolisme de base multiplié par le niveau d'activité. */
  depense: number
  kcal: number
  prot: number
  lip: number
  gluc: number
  /** Vrai si l'objectif a dû être relevé jusqu'au métabolisme de base. */
  planche: boolean
}

/**
 * Objectifs quotidiens déduits du profil.
 *
 * L'apport n'est jamais placé sous le métabolisme de base : en dessous, le
 * corps ne couvre plus ses fonctions vitales au repos, et le déficit se paie
 * en masse musculaire autant qu'en masse grasse.
 */
export function besoins(
  kg: number,
  tailleCm: number,
  ans: number,
  sexe: Sexe,
  activite: NiveauActivite,
  but: But,
  /** Poids visé : sert de base aux protéines quand il est renseigné. */
  poidsCible?: number,
): Besoins {
  const base = metabolismeBase(kg, tailleCm, ans, sexe)
  const facteur = ACTIVITES.find((a) => a.cle === activite)!.facteur
  const depense = base * facteur
  const ecart = BUTS.find((b) => b.cle === but)!.ecart

  const vise = depense + ecart
  const planche = vise < base
  const kcal = Math.round(Math.max(vise, base) / 10) * 10

  // Protéines et lipides sont bornés en part d'énergie, pas seulement en
  // grammes par kilo. Les fixer au seul poids corporel écrasait les glucides
  // dès que l'apport était réduit : un profil lourd en déficit se retrouvait
  // avec 30 g de glucides par jour, soit une répartition cétogène que
  // personne n'a demandée.
  const reference = poidsCible ?? kg
  const prot = Math.round(
    Math.min(
      Math.max((0.25 * kcal) / 4, 1.6 * reference),
      Math.min(2.2 * reference, (0.3 * kcal) / 4),
    ),
  )
  const lip = Math.round(
    Math.min(Math.max((0.3 * kcal) / 9, 0.6 * kg), (0.35 * kcal) / 9),
  )
  const gluc = Math.max(0, Math.round((kcal - prot * 4 - lip * 9) / 4))

  return { base: Math.round(base), depense: Math.round(depense), kcal, prot, lip, gluc, planche }
}

/** Profil suffisamment renseigné pour que le calcul ait un sens. */
export function profilComplet(
  profil: Profil,
): profil is Profil & Required<Pick<Profil, 'sexe' | 'naissance' | 'tailleCm' | 'activite' | 'but'>> {
  return !!(profil.sexe && profil.naissance && profil.tailleCm && profil.activite && profil.but)
}
