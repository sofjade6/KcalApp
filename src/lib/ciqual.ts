import { normaliser } from './recherche'

export interface AlimentCiqual {
  /** Code CIQUAL. */
  c: string
  /** Libellé officiel. */
  n: string
  /** Code du groupe d'aliments. */
  g: string
  kcal: number
  prot?: number
  lip?: number
  gluc?: number
  fib?: number
  sel?: number
  suc?: number
  ags?: number
}

export interface AlimentIndexe extends AlimentCiqual {
  /** Libellé sans accents ni majuscules, calculé une fois au chargement. */
  cherchable: string
  groupe: string
  /** Aliment saisi par l'utilisateur, à privilégier dans le classement. */
  perso?: boolean
}

export interface BaseCiqual {
  version: string
  aliments: AlimentIndexe[]
}

let cache: BaseCiqual | null = null
let enCours: Promise<BaseCiqual> | null = null

/**
 * Charge la table CIQUAL. Le fichier est précaché par le service worker :
 * après la première ouverture, ceci fonctionne hors ligne.
 *
 * Le chargement est différé jusqu'au premier besoin réel — l'écran du jour
 * n'a pas à attendre 350 Ko pour s'afficher.
 */
export function chargerCiqual(): Promise<BaseCiqual> {
  if (cache) return Promise.resolve(cache)

  enCours ??= fetch('/data/ciqual.json')
    .then((reponse) => {
      if (!reponse.ok) throw new Error(`base indisponible (${reponse.status})`)
      return reponse.json()
    })
    .then((brut) => {
      const groupes: Record<string, string> = brut.groupes ?? {}
      cache = {
        version: brut.version,
        aliments: (brut.aliments as AlimentCiqual[]).map((a) => ({
          ...a,
          cherchable: normaliser(a.n),
          groupe: groupes[a.g] ?? '',
        })),
      }
      return cache
    })
    .catch((erreur) => {
      // Sans cette remise à zéro, un échec réseau condamnerait la recherche
      // pour toute la durée de la session.
      enCours = null
      throw erreur
    })

  return enCours
}
