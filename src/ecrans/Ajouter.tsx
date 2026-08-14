import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { chargerCiqual, type AlimentIndexe } from '../lib/ciqual'
import { chercher, normaliser, LIMITE_RESULTATS } from '../lib/recherche'
import { alimentsRecents, ajouterAuJournal, type AlimentRecent } from '../lib/journal'
import { cleDuJour, libelleJour } from '../lib/dates'
import { libellePortion } from '../lib/portions'

export default function Ajouter() {
  const navigate = useNavigate()
  const jour = useSearchParams()[0].get('jour') ?? cleDuJour()
  const retour = jour === cleDuJour() ? '/' : `/jour/${jour}`

  const [ciqual, setCiqual] = useState<AlimentIndexe[] | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [requete, setRequete] = useState('')
  const [recents, setRecents] = useState<AlimentRecent[]>([])
  const [occupe, setOccupe] = useState(false)

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
    alimentsRecents().then((r) => vivant && setRecents(r))
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
        groupe: a.marque ?? (a.source === 'recette' ? 'Recette' : 'Mes aliments'),
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

  /** Un récent se réajoute d'un seul geste, avec la quantité de la dernière fois. */
  async function reprendre(aliment: AlimentRecent) {
    if (occupe) return
    setOccupe(true)
    const { fois: _fois, dernierJour: _dernierJour, ...modele } = aliment
    await ajouterAuJournal(modele, jour)
    navigate(retour)
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={retour} className="retour">
          ← Retour
        </Link>
        <h1 className="vue-titre">Ajouter un aliment</h1>
        {jour !== cleDuJour() && (
          <span className="vue-date">{libelleJour(jour)}</span>
        )}
      </header>

      <Link to={`/scanner?jour=${jour}`} className="bouton scanner-entree">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 8V5.5A1.5 1.5 0 0 1 4.5 4H7M17 4h2.5A1.5 1.5 0 0 1 21 5.5V8M21 16v2.5a1.5 1.5 0 0 1-1.5 1.5H17M7 20H4.5A1.5 1.5 0 0 1 3 18.5V16" />
          <path d="M7 8.5v7M10.5 8.5v7M14 8.5v7M17 8.5v7" />
        </svg>
        Scanner un code-barres
      </Link>

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

      {vide && recents.length > 0 && (
        <section className="repas">
          <div className="repas-tete">
            <h2 className="repas-nom">Récents</h2>
            <span className="repas-kcal">un geste pour reprendre</span>
          </div>
          <div className="resultats">
            {recents.map((aliment) => (
              <button
                key={`${aliment.code ?? aliment.nom}`}
                className="resultat"
                disabled={occupe}
                onClick={() => reprendre(aliment)}
              >
                <span className="resultat-nom">
                  {aliment.nom}
                  <span className="resultat-groupe">
                    {aliment.portion
                      ? libellePortion(aliment.portion, aliment.portion.nombre)
                      : `${aliment.grammes} g`}{' '}
                    · {aliment.fois} fois
                  </span>
                </span>
                <span className="resultat-kcal">
                  {Math.round((aliment.kcal * aliment.grammes) / 100)}
                  <small> kcal</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!erreur && ciqual === null && <p className="note">Chargement de la base…</p>}

      {vide && perso.length > 0 && (
        <section className="repas">
          <div className="repas-tete">
            <h2 className="repas-nom">Mes aliments</h2>
          </div>
          <div className="resultats">
            {perso.slice(0, LIMITE_RESULTATS).map((aliment) => (
              <button
                key={aliment.c}
                className="resultat"
                onClick={() => navigate(`/ajouter/${aliment.c}?jour=${jour}`)}
              >
                <span className="resultat-nom">
                  {aliment.n}
                  <span className="resultat-groupe">{aliment.groupe}</span>
                </span>
                <span className="resultat-kcal">
                  {Math.round(aliment.kcal)}
                  <small> kcal/100 g</small>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {ciqual !== null && vide && perso.length === 0 && recents.length === 0 && (
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

      {!vide && resultats.length > 0 && (
        <div className="resultats">
          {resultats.map((aliment) => (
            <button
              key={aliment.c}
              className="resultat"
              onClick={() => navigate(`/ajouter/${aliment.c}?jour=${jour}`)}
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

      <Link to={`/saisir?jour=${jour}`} className="bouton discret saisie-manuelle">
        Saisir un aliment absent de la table
      </Link>
    </div>
  )
}
