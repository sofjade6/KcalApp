import type { But, Pesee } from '../db'

export interface Message {
  titre: string
  texte: string
}

const kg = (v: number) => `${Math.abs(v).toFixed(1).replace('.', ',')} kg`

/** Pesée la plus récente antérieure d'au moins `jours` à la dernière. */
function reference(pesees: Pesee[], jours: number): Pesee | undefined {
  if (pesees.length < 2) return undefined
  const derniere = new Date(pesees[pesees.length - 1].date)
  const limite = new Date(derniere)
  limite.setDate(limite.getDate() - jours)

  const anterieures = pesees.filter((p) => new Date(p.date) <= limite)
  return anterieures[anterieures.length - 1]
}

/** Évolution sur la période, en kg. Négatif = poids en baisse. */
export function tendance(pesees: Pesee[], jours: number): number | undefined {
  const depart = reference(pesees, jours)
  if (!depart) return undefined
  return pesees[pesees.length - 1].kg - depart.kg
}

/** Nombre de pesées sur les `jours` derniers jours. */
function assiduite(pesees: Pesee[], jours = 14): number {
  const limite = new Date()
  limite.setDate(limite.getDate() - jours)
  return pesees.filter((p) => new Date(p.date) >= limite).length
}

/**
 * Un message par état, choisi dans l'ordre. Le ton reste factuel : le poids
 * fluctue pour des raisons qui n'ont rien à voir avec l'alimentation, et un
 * suivi ne doit pas transformer une variation d'un jour en échec.
 */
export function encouragement(
  pesees: Pesee[],
  but: But | undefined,
  cible: number | undefined,
): Message | null {
  if (pesees.length === 0) {
    return {
      titre: 'Pose un premier point',
      texte:
        'Une première pesée suffit à démarrer. C’est la courbe sur plusieurs semaines qui sera parlante, pas le chiffre du jour.',
    }
  }

  const actuel = pesees[pesees.length - 1].kg
  const depart = pesees[0].kg

  // Sans objectif déclaré, aucune direction n'est « la bonne » : on décrit
  // le mouvement au lieu de le juger.
  const sens = but === 'perte' ? -1 : but === 'prise' ? 1 : 0
  const vaDansLeBonSens = (delta: number, seuil = 0) => sens !== 0 && delta * sens > seuil

  if (pesees.length === 1) {
    return {
      titre: 'C’est parti',
      texte:
        'Premier point enregistré. Repèse-toi dans quelques jours, de préférence le matin à jeun : c’est le moment le plus comparable d’une fois sur l’autre.',
    }
  }

  const parcouru = actuel - depart

  if (cible !== undefined) {
    const restant = actuel - cible
    if (Math.abs(restant) <= 0.3) {
      return {
        titre: 'Objectif atteint',
        texte: `Tu es à ${kg(actuel)}, ta cible. Le plus dur commence maintenant : s’y tenir. Continue à te peser, c’est ce qui permet de corriger tôt.`,
      }
    }
    // Sans objectif déclaré, la cible suffit à donner la direction.
    const versLaCible = sens !== 0 ? vaDansLeBonSens(parcouru, 0.2) : Math.abs(restant) < Math.abs(depart - cible)
    if (versLaCible) {
      const total = Math.abs(depart - cible)
      const fait = Math.abs(parcouru)
      const part = total > 0 ? Math.min(100, Math.round((fait / total) * 100)) : 0
      return {
        titre: `${kg(parcouru)} depuis le début`,
        texte: `Soit ${part} % du chemin vers ${kg(cible)}. Il reste ${kg(restant)}. La régularité fait le reste.`,
      }
    }
  }

  const semaine = tendance(pesees, 7)
  if (semaine !== undefined && Math.abs(semaine) >= 0.2) {
    if (sens === 0) {
      return {
        titre: `${kg(semaine)} sur la semaine`,
        texte: `Ton poids est ${semaine < 0 ? 'en baisse' : 'en hausse'}. Renseigne un objectif dans « Mes données » pour que le suivi sache dans quel sens tu vas.`,
      }
    }
    if (vaDansLeBonSens(semaine)) {
      return {
        titre: `${kg(semaine)} sur la semaine`,
        texte: 'La tendance va dans le sens de ton objectif. Rien à changer.',
      }
    }
    return {
      titre: 'Le poids bouge dans l’autre sens',
      texte:
        'Sur sept jours, ça ne veut pas dire grand-chose : eau, sel, sommeil et transit pèsent facilement un kilo. Regarde plutôt la courbe sur un mois.',
    }
  }

  const mois = tendance(pesees, 30)
  if (mois !== undefined && Math.abs(mois) >= 0.5) {
    if (sens === 0) {
      return {
        titre: `${kg(mois)} sur le mois`,
        texte: `Une tendance nette se dessine, ${mois < 0 ? 'à la baisse' : 'à la hausse'}.`,
      }
    }
    return vaDansLeBonSens(mois)
      ? {
          titre: `${kg(mois)} sur le mois`,
          texte: 'C’est une vraie tendance, pas une fluctuation. Tu tiens le bon rythme.',
        }
      : {
          titre: 'La tendance mensuelle s’écarte',
          texte:
            'Le moment de regarder les journées où tu dépasses ton objectif calorique, plutôt que de forcer sur une seule.',
        }
  }

  if (assiduite(pesees) >= 4) {
    return {
      titre: 'Suivi régulier',
      texte: `${assiduite(pesees)} pesées ces deux dernières semaines. C’est cette régularité qui rend la courbe lisible.`,
    }
  }

  return {
    titre: 'Poids stable',
    texte:
      'Pas de mouvement net pour l’instant. Continue à noter : une tendance demande deux à trois semaines pour se dessiner.',
  }
}
