import db, { type Entree, type Repas } from '../db'
import { cleDuJour } from './dates'

/** Champs d'une entrée indépendants du jour et du repas où elle est posée. */
type Modele = Omit<Entree, 'id' | 'date' | 'repas' | 'creeLe'>

const modele = (e: Entree): Modele => {
  const { id: _id, date: _date, repas: _repas, creeLe: _creeLe, ...reste } = e
  return reste
}

export interface AlimentRecent extends Modele {
  /** Nombre de fois consommé sur la période observée. */
  fois: number
  dernierJour: string
}

/**
 * Aliments récemment consommés, du plus utile au moins utile.
 *
 * Le classement mêle fréquence et fraîcheur : ce qui revient souvent remonte,
 * mais un aliment abandonné depuis des semaines finit par redescendre. Sans
 * cette décroissance, la liste se figerait sur les habitudes du premier mois.
 */
export async function alimentsRecents(limite = 12): Promise<AlimentRecent[]> {
  const depuis = new Date()
  depuis.setDate(depuis.getDate() - 60)
  const cleDepuis = cleDuJour(depuis)

  const entrees = await db.entrees.where('date').aboveOrEqual(cleDepuis).toArray()

  const parNom = new Map<string, { modele: Modele; fois: number; dernierJour: string }>()
  for (const entree of entrees) {
    const cle = entree.code ?? entree.nom
    const vu = parNom.get(cle)
    if (vu) {
      vu.fois++
      if (entree.date > vu.dernierJour) {
        vu.dernierJour = entree.date
        // La dernière quantité utilisée est la plus probable la fois suivante.
        vu.modele = modele(entree)
      }
    } else {
      parNom.set(cle, { modele: modele(entree), fois: 1, dernierJour: entree.date })
    }
  }

  const aujourdhui = new Date(cleDuJour()).getTime()
  const score = (fois: number, dernierJour: string) => {
    const jours = Math.max(0, (aujourdhui - new Date(dernierJour).getTime()) / 86_400_000)
    return fois * Math.pow(0.97, jours)
  }

  return [...parNom.values()]
    .sort((a, b) => score(b.fois, b.dernierJour) - score(a.fois, a.dernierJour))
    .slice(0, limite)
    .map(({ modele: m, fois, dernierJour }) => ({ ...m, fois, dernierJour }))
}

export async function ajouterAuJournal(
  aliment: Modele,
  date: string,
  repas: Repas,
): Promise<void> {
  await db.entrees.add({ ...aliment, date, repas, creeLe: Date.now() })
}

/** Recopie un repas d'un jour vers un autre. */
export async function copierRepas(
  source: string,
  repasSource: Repas,
  cible: string,
  repasCible: Repas,
): Promise<number> {
  const entrees = await db.entrees.where({ date: source, repas: repasSource }).toArray()
  if (entrees.length === 0) return 0

  await db.entrees.bulkAdd(
    entrees.map((e) => ({ ...modele(e), date: cible, repas: repasCible, creeLe: Date.now() })),
  )
  return entrees.length
}

/** Recopie une journée entière, tous repas confondus. */
export async function dupliquerJour(source: string, cible: string): Promise<number> {
  const entrees = await db.entrees.where('date').equals(source).toArray()
  if (entrees.length === 0) return 0

  await db.entrees.bulkAdd(
    entrees.map((e) => ({ ...modele(e), date: cible, repas: e.repas, creeLe: Date.now() })),
  )
  return entrees.length
}

/** Jours antérieurs contenant au moins une entrée, du plus récent au plus ancien. */
export async function joursRenseignes(avant: string, limite = 14): Promise<string[]> {
  const entrees = await db.entrees.where('date').below(avant).toArray()
  return [...new Set(entrees.map((e) => e.date))].sort().reverse().slice(0, limite)
}
