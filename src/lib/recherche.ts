import type { AlimentIndexe } from './ciqual'

/**
 * Forme comparable d'un libellé : sans accents, sans majuscules.
 * Indispensable ici — chercher « pates » doit trouver « Pâtes sèches ».
 */
export function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    // NFD ne d\u00e9compose pas les ligatures : sans ceci, chercher \u00ab oeuf \u00bb
    // ne trouve jamais \u00ab \u0152uf, cru \u00bb.
    .replace(/\u0153/g, 'oe')
    .replace(/\u00e6/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Longueur en de\u00e7\u00e0 de laquelle on ne rogne plus un terme. */
const PLANCHER_TRONCATURE = 4
/** Nombre maximal de caract\u00e8res rogn\u00e9s en fin de terme. */
const TRONCATURE_MAX = 2

/**
 * Position d'un terme, en tol\u00e9rant les variations de fin de mot.
 *
 * Le fran\u00e7ais fl\u00e9chit beaucoup : \u00ab p\u00e2tes compl\u00e8tes \u00bb doit trouver
 * \u00ab P\u00e2tes s\u00e8ches, au bl\u00e9 complet \u00bb. On rogne donc progressivement la fin du
 * terme \u2014 jamais plus de deux caract\u00e8res, et jamais sous quatre lettres,
 * pour ne pas transformer la recherche en passoire.
 */
function localiser(cherchable: string, terme: string): { position: number; rogne: number } | null {
  for (let rogne = 0; rogne <= TRONCATURE_MAX; rogne++) {
    const essai = terme.slice(0, terme.length - rogne)
    if (essai.length < PLANCHER_TRONCATURE && rogne > 0) break

    const position = cherchable.indexOf(essai)
    if (position >= 0) return { position, rogne }
  }
  return null
}

/**
 * Pénalité d'un aliment pour une requête : plus c'est bas, mieux c'est.
 * `null` si un des termes est absent — tous doivent être présents.
 */
function penalite(
  cherchable: string,
  termes: string[],
  toleranceManquants = 0,
): number | null {
  let total = 0
  let manquants = 0

  for (const terme of termes) {
    const trouve = localiser(cherchable, terme)
    if (!trouve) {
      if (++manquants > toleranceManquants) return null
      // Un terme absent coûte cher, mais n'élimine plus.
      total += 200
      continue
    }

    const { position, rogne } = trouve
    const debutDeMot = position === 0 || !/[a-z0-9]/.test(cherchable[position - 1])
    // Un libellé qui commence par le terme prime sur un début de mot,
    // lui-même préférable à une occurrence au milieu d'un mot.
    total += position === 0 ? 0 : debutDeMot ? 10 : 40
    total += position * 0.05
    // Une correspondance exacte passe devant une correspondance obtenue
    // en rognant la fin du terme.
    total += rogne * 15
  }

  // À pertinence égale, le libellé le plus court est le plus générique
  // — « Pomme, crue » avant « Pomme, crue, pelée, cuite au four ».
  return total + cherchable.length * 0.02
}

export const LIMITE_RESULTATS = 40

export interface Resultats {
  aliments: AlimentIndexe[]
  /** Vrai quand aucun aliment ne contenait tous les termes cherchés. */
  approximatif: boolean
}

export function chercher(aliments: AlimentIndexe[], requete: string): Resultats {
  const termes = normaliser(requete).split(/\s+/).filter(Boolean)
  if (termes.length === 0) return { aliments: [], approximatif: false }

  const passe = (tolerance: number) => {
    const trouves: { aliment: AlimentIndexe; score: number }[] = []
    for (const aliment of aliments) {
      const score = penalite(aliment.cherchable, termes, tolerance)
      // Un aliment que l'utilisateur a saisi lui-même passe devant la table
      // officielle : s'il a pris la peine de le créer, c'est qu'il le mange.
      if (score !== null) trouves.push({ aliment, score: score - (aliment.perso ? 5 : 0) })
    }
    return trouves
      .sort((a, b) => a.score - b.score)
      .slice(0, LIMITE_RESULTATS)
      .map(({ aliment }) => aliment)
  }

  const exacts = passe(0)
  if (exacts.length > 0 || termes.length < 2) {
    return { aliments: exacts, approximatif: false }
  }

  // Rien ne contient tous les termes. Plutôt que d'afficher une page vide,
  // on retombe sur les aliments qui en contiennent le plus : CIQUAL emploie
  // un vocabulaire administratif — « crème fraîche » n'y figure pas, mais
  // « Crème de lait, 30% MG, épaisse » est bien ce que l'on cherche.
  return { aliments: passe(termes.length - 1), approximatif: true }
}
