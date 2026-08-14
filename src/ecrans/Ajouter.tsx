import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { REPAS, type Repas } from '../db'
import { chargerCiqual, type AlimentIndexe } from '../lib/ciqual'
import { chercher, normaliser, LIMITE_RESULTATS } from '../lib/recherche'

export default function Ajouter() {
  const { repas } = useParams<{ repas: Repas }>()
  const navigate = useNavigate()
  const nomRepas = REPAS.find((r) => r.cle === repas)?.nom ?? 'Repas'

  const [ciqual, setCiqual] = useState<AlimentIndexe[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [requete, setRequete] = useState('')

  // Aliments saisis à la main, du plus récemment utilisé au plus ancien.
  const mesAliments = useLiveQuery(
    () => db.aliments.orderBy('vuLe').reverse().toArray(),
    [],
    [],
  )

  useEffect(() => {
    let vivant = true
    chargerCiqual()
      .then((base) => vivant && setCiqual(base.aliments))
      .catch((e) => vivant && setErreur(String(e.message ?? e)))
    return () => {
      vivant = false
    }
  }, [])

  const perso = useMemo<AlimentIndexe[]>(
    () =>
      mesAliments.map((a) => ({
        c: a.code,
        n: a.nom,
        g: '',
        kcal: a.kcal,
        prot: a.prot,
        lip: a.lip,
        gluc: a.gluc,
        cherchable: normaliser(a.nom),
        groupe: 'Mes aliments',
        perso: true,
      })),
    [mesAliments],
  )

  const { aliments: resultats, approximatif } = useMemo(
    () =>
      ciqual
        ? chercher([...perso, ...ciqual], requete)
        : { aliments: [], approximatif: false },
    [ciqual, perso, requete],
  )

  const vide = requete.trim() === ''
  // Écran d'accueil de la recherche : les aliments perso, immédiatement.
  const affiches = vide ? perso.slice(0, LIMITE_RESULTATS) : resultats

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to="/" className="retour">
          ← Aujourd’hui
        </Link>
        <h1 className="vue-titre">Ajouter à {nomRepas.toLowerCase()}</h1>
      </header>

      <label className="recherche">
        <span className="sr-only">Rechercher un aliment</span>
        <input
          type="search"
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="Rechercher un aliment…"
          value={requete}
          onChange={(e) => setRequete(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          enterKeyHint="search"
        />
      </label>

      {erreur && (
        <p className="repas-vide">
          Base d’aliments indisponible : {erreur}. Elle est normalement mise en
          cache pour l’usage hors ligne — réessaie une fois connecté.
        </p>
      )}

      {!erreur && ciqual === null && <p className="note">Chargement de la base…</p>}

      {vide && perso.length > 0 && <h2 className="carte-titre">Mes aliments</h2>}

      {ciqual !== null && vide && perso.length === 0 && (
        <p className="note">
          {ciqual.length} aliments de la table CIQUAL. Tape les premières lettres
          — les accents n’ont pas d’importance.
        </p>
      )}

      {ciqual !== null && !vide && resultats.length === 0 && (
        <p className="repas-vide">
          Aucun aliment ne correspond. Tu peux le saisir toi-même.
        </p>
      )}

      {approximatif && resultats.length > 0 && (
        <p className="note">
          Aucun aliment ne porte exactement ces mots. Voici les plus proches — la
          table CIQUAL emploie souvent un vocabulaire différent du langage
          courant.
        </p>
      )}

      {affiches.length > 0 && (
        <div className="resultats">
          {affiches.map((aliment) => (
            <button
              key={aliment.c}
              className="resultat"
              onClick={() => navigate(`/ajouter/${repas}/${aliment.c}`)}
            >
              <span className="resultat-nom">
                {aliment.n}
                {aliment.groupe && (
                  <span className="resultat-groupe">{aliment.groupe}</span>
                )}
              </span>
              <span className="resultat-kcal">
                {Math.round(aliment.kcal)}
                <small> kcal/100 g</small>
              </span>
            </button>
          ))}
          {!vide && resultats.length === LIMITE_RESULTATS && (
            <p className="note">
              Seuls les {LIMITE_RESULTATS} meilleurs résultats sont affichés.
              Précise ta recherche pour affiner.
            </p>
          )}
        </div>
      )}

      <Link to={`/saisir/${repas}`} className="bouton discret saisie-manuelle">
        Saisir un aliment absent de la table
      </Link>
    </div>
  )
}
