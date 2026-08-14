import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { REPAS, type Repas } from '../db'
import { chargerCiqual, type AlimentIndexe } from '../lib/ciqual'
import { chercher, LIMITE_RESULTATS } from '../lib/recherche'

export default function Ajouter() {
  const { repas } = useParams<{ repas: Repas }>()
  const navigate = useNavigate()
  const nomRepas = REPAS.find((r) => r.cle === repas)?.nom ?? 'Repas'

  const [aliments, setAliments] = useState<AlimentIndexe[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [requete, setRequete] = useState('')

  useEffect(() => {
    let vivant = true
    chargerCiqual()
      .then((base) => vivant && setAliments(base.aliments))
      .catch((e) => vivant && setErreur(String(e.message ?? e)))
    return () => {
      vivant = false
    }
  }, [])

  const { aliments: resultats, approximatif } = useMemo(
    () =>
      aliments
        ? chercher(aliments, requete)
        : { aliments: [], approximatif: false },
    [aliments, requete],
  )

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

      {!erreur && aliments === null && <p className="note">Chargement de la base…</p>}

      {aliments !== null && requete.trim() === '' && (
        <p className="note">
          {aliments.length} aliments de la table CIQUAL. Tape les premières
          lettres — les accents n’ont pas d’importance.
        </p>
      )}

      {aliments !== null && requete.trim() !== '' && resultats.length === 0 && (
        <p className="repas-vide">
          Aucun aliment ne correspond. Les produits de marque arriveront avec le
          scan de codes-barres.
        </p>
      )}

      {approximatif && resultats.length > 0 && (
        <p className="note">
          Aucun aliment ne porte exactement ces mots. Voici les plus proches —
          la table CIQUAL emploie souvent un vocabulaire différent du langage
          courant.
        </p>
      )}

      {resultats.length > 0 && (
        <div className="resultats">
          {resultats.map((aliment) => (
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
          {resultats.length === LIMITE_RESULTATS && (
            <p className="note">
              Seuls les {LIMITE_RESULTATS} meilleurs résultats sont affichés.
              Précise ta recherche pour affiner.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
