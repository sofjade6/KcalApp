import type { Activite, Entree, Pesee, Profil } from '../db'
import { derniersJours } from './dates'
import { totalKcal } from './nutrition'
import { age, besoins, profilComplet, KCAL_PAR_KG } from './corps'

export interface JourBilan {
  date: string
  kcal: number
  budget: number
  /** Écart au budget : positif au-dessus. */
  ecart: number
}

export interface Semaine {
  jours: JourBilan[]
  /** Jours effectivement notés — les autres ne sont pas des jours à zéro. */
  notes: number
  moyenne: number
  ecartMoyen: number
  depassements: JourBilan[]
}

export function analyserSemaine(
  entrees: Entree[],
  activites: Activite[],
  objectifKcal: number,
  fin?: string,
  longueur = 7,
): Semaine {
  const jours = derniersJours(longueur, fin).map<JourBilan>((date) => {
    const duJour = entrees.filter((e) => e.date === date)
    const brulees = activites.filter((a) => a.date === date).reduce((t, a) => t + a.kcal, 0)
    const budget = objectifKcal + brulees
    const kcal = totalKcal(duJour)
    return { date, kcal, budget, ecart: kcal - budget }
  })

  // Un jour sans aucune saisie n'est pas un jour à zéro calorie : l'inclure
  // dans la moyenne la ferait plonger et rendrait le bilan mensonger.
  const notes = jours.filter((j) => j.kcal > 0)
  const moyenne = notes.length ? Math.round(notes.reduce((t, j) => t + j.kcal, 0) / notes.length) : 0
  const ecartMoyen = notes.length
    ? Math.round(notes.reduce((t, j) => t + j.ecart, 0) / notes.length)
    : 0

  return {
    jours,
    notes: notes.length,
    moyenne,
    ecartMoyen,
    depassements: notes.filter((j) => j.ecart > 0).sort((a, b) => b.ecart - a.ecart),
  }
}

/** Pente du poids en kg par semaine, par moindres carrés sur la période. */
export function penteHebdo(pesees: Pesee[], jours = 28): number | null {
  if (pesees.length < 2) return null
  const limite = new Date()
  limite.setDate(limite.getDate() - jours)

  const points = pesees
    .filter((p) => new Date(p.date) >= limite)
    .map((p) => ({ x: new Date(p.date).getTime() / 86_400_000, y: p.kg }))
  if (points.length < 2) return null

  const n = points.length
  const moyX = points.reduce((t, p) => t + p.x, 0) / n
  const moyY = points.reduce((t, p) => t + p.y, 0) / n
  const covariance = points.reduce((t, p) => t + (p.x - moyX) * (p.y - moyY), 0)
  const variance = points.reduce((t, p) => t + (p.x - moyX) ** 2, 0)
  if (variance === 0) return null

  return (covariance / variance) * 7
}

export interface Projection {
  /** Kilos par semaine, négatif à la baisse. */
  pente: number
  semaines: number
  date: Date
}

export function projeter(pesees: Pesee[], cible: number | undefined): Projection | null {
  const pente = penteHebdo(pesees)
  if (pente === null || cible === undefined || pesees.length === 0) return null

  const restant = cible - pesees[pesees.length - 1].kg
  // Une pente qui s'éloigne de la cible, ou trop faible pour être distinguée
  // du bruit, ne permet aucune projection honnête.
  if (Math.abs(pente) < 0.05 || Math.sign(restant) !== Math.sign(pente)) return null

  const semaines = restant / pente
  if (semaines <= 0 || semaines > 260) return null

  const date = new Date()
  date.setDate(date.getDate() + Math.round(semaines * 7))
  return { pente, semaines, date }
}

export interface Coherence {
  /** Perte hebdomadaire attendue d'après les calories notées. */
  attendue: number
  /** Perte hebdomadaire réellement observée. */
  observee: number
  ecart: number
  /** Dépense quotidienne que la réalité suggère. */
  depenseReelle: number
}

/**
 * Confronte les calories notées à l'évolution réelle du poids.
 *
 * C'est le seul contrôle qui dise si la dépense estimée par l'équation
 * correspond à ce corps-là : les formules donnent une moyenne de population,
 * l'écart individuel atteint couramment 200 à 300 kcal par jour.
 */
export function coherence(
  profil: Profil,
  poidsActuel: number,
  moyenneKcal: number,
  pesees: Pesee[],
): Coherence | null {
  if (!profilComplet(profil) || moyenneKcal <= 0) return null
  const pente = penteHebdo(pesees)
  if (pente === null) return null

  const { depense } = besoins(
    poidsActuel,
    profil.tailleCm!,
    age(profil.naissance!),
    profil.sexe!,
    profil.activite!,
    profil.but!,
    profil.poidsCible,
    profil.rythme,
  )

  const attendue = ((moyenneKcal - depense) * 7) / KCAL_PAR_KG
  const depenseReelle = Math.round(moyenneKcal - (pente * KCAL_PAR_KG) / 7)

  return {
    attendue: Math.round(attendue * 100) / 100,
    observee: Math.round(pente * 100) / 100,
    ecart: Math.round((pente - attendue) * 100) / 100,
    depenseReelle,
  }
}
