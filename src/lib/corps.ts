import type { But, NiveauActivite, Profil, Sexe } from '../db'

export const ACTIVITES: { cle: NiveauActivite; nom: string; detail: string; facteur: number }[] = [
  { cle: 'sedentaire', nom: 'Sédentaire', detail: 'travail assis, peu de marche', facteur: 1.2 },
  { cle: 'leger', nom: 'Légère', detail: 'sport 1 à 3 fois par semaine', facteur: 1.375 },
  { cle: 'modere', nom: 'Modérée', detail: 'sport 3 à 5 fois par semaine', facteur: 1.55 },
  { cle: 'intense', nom: 'Intense', detail: 'sport 6 à 7 fois par semaine', facteur: 1.725 },
  { cle: 'tres-intense', nom: 'Très intense', detail: 'métier physique ou double séance', facteur: 1.9 },
]

export const BUTS: { cle: But; nom: string; sens: number }[] = [
  { cle: 'perte', nom: 'Perdre du poids', sens: -1 },
  { cle: 'maintien', nom: 'Maintenir', sens: 0 },
  { cle: 'prise', nom: 'Prendre du poids', sens: 1 },
]

/**
 * Énergie contenue dans un kilo de masse corporelle, valeur usuelle.
 *
 * C'est elle qui convertit un rythme en kilos par semaine en écart calorique
 * quotidien, et elle sert aussi au contrôle de cohérence du bilan : les deux
 * doivent partager la même constante, sinon l'app se contredirait elle-même.
 */
export const KCAL_PAR_KG = 7700

/** Rythme par défaut, généralement retenu comme tenable. */
export const RYTHME_DEFAUT = 0.5

export const RYTHMES = [0.25, 0.5, 0.75, 1]

/** Écart calorique quotidien correspondant à un rythme hebdomadaire. */
export const ecartQuotidien = (rythme: number, sens: number) =>
  Math.round((sens * rythme * KCAL_PAR_KG) / 7)

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
  /** Vrai si l'objectif tombe sous le métabolisme de base. Informatif. */
  sousLeBase: boolean
}

/**
 * Objectifs quotidiens déduits du profil.
 *
 * L'apport visé n'est plus relevé jusqu'au métabolisme de base : le déficit
 * demandé est appliqué tel quel. Descendre sous le métabolisme de base reste
 * signalé à l'écran, mais c'est une information, pas une borne.
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
  /** Rythme en kg par semaine ; le but en donne le sens. */
  rythme = RYTHME_DEFAUT,
): Besoins {
  const base = metabolismeBase(kg, tailleCm, ans, sexe)
  const facteur = ACTIVITES.find((a) => a.cle === activite)!.facteur
  const depense = base * facteur
  const ecart = ecartQuotidien(rythme, BUTS.find((b) => b.cle === but)!.sens)

  const vise = depense + ecart
  const kcal = Math.round(vise / 10) * 10
  const sousLeBase = kcal < base

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

  return { base: Math.round(base), depense: Math.round(depense), kcal, prot, lip, gluc, sousLeBase }
}

/** Profil suffisamment renseigné pour que le calcul ait un sens. */
export function profilComplet(
  profil: Profil,
): profil is Profil & Required<Pick<Profil, 'sexe' | 'naissance' | 'tailleCm' | 'activite' | 'but'>> {
  return !!(profil.sexe && profil.naissance && profil.tailleCm && profil.activite && profil.but)
}
