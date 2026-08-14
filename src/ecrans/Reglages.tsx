import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { lireProfil, enregistrerProfil, PROFIL_DEFAUT } from '../db'

const CHAMPS = [
  { cle: 'objectifKcal', nom: 'Calories', unite: 'kcal' },
  { cle: 'objectifProt', nom: 'Protéines', unite: 'g' },
  { cle: 'objectifLip', nom: 'Lipides', unite: 'g' },
  { cle: 'objectifGluc', nom: 'Glucides', unite: 'g' },
] as const

export default function Reglages() {
  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)

  const [persistant, setPersistant] = useState<boolean | null>(null)
  const [place, setPlace] = useState<string | null>(null)
  const [enLigne, setEnLigne] = useState(navigator.onLine)

  useEffect(() => {
    const majReseau = () => setEnLigne(navigator.onLine)
    addEventListener('online', majReseau)
    addEventListener('offline', majReseau)
    return () => {
      removeEventListener('online', majReseau)
      removeEventListener('offline', majReseau)
    }
  }, [])

  useEffect(() => {
    if (!navigator.storage?.estimate) return
    navigator.storage.persisted?.().then(setPersistant)
    navigator.storage.estimate().then(({ usage }) => {
      if (usage != null) setPlace(`${(usage / 1024).toFixed(0)} Ko`)
    })
  }, [])

  async function demanderPersistance() {
    setPersistant((await navigator.storage?.persist?.()) ?? false)
  }

  /**
   * Le champ est piloté par un brouillon local, pas directement par la base :
   * sinon effacer la valeur pour la retaper la ramène aussitôt à 0.
   * L'enregistrement se fait à la sortie du champ.
   */
  const [brouillon, setBrouillon] = useState<Record<string, string>>({})

  function valider(cle: (typeof CHAMPS)[number]['cle']) {
    const saisi = brouillon[cle]
    setBrouillon(({ [cle]: _, ...reste }) => reste)
    if (saisi === undefined) return

    const valeur = Number(saisi)
    if (saisi.trim() === '' || !Number.isFinite(valeur) || valeur < 0) return

    const { id: _id, majLe: _majLe, ...objectifs } = profil
    enregistrerProfil({ ...objectifs, [cle]: Math.round(valeur) })
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <span className="vue-date">Réglages</span>
        <h1 className="vue-titre">Objectifs</h1>
      </header>

      <section className="carte">
        <h2 className="carte-titre">Objectifs quotidiens</h2>
        {CHAMPS.map(({ cle, nom, unite }) => (
          <label className="champ" key={cle}>
            <span className="champ-nom">
              {nom}
              <small>{unite} par jour</small>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={brouillon[cle] ?? String(profil[cle])}
              onChange={(e) =>
                setBrouillon((b) => ({ ...b, [cle]: e.target.value }))
              }
              onBlur={() => valider(cle)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          </label>
        ))}
        <p className="note">
          Valeurs saisies à la main pour l’instant. Le calcul automatique à
          partir de ta taille, ton poids et ton activité arrivera avec l’écran
          de suivi du poids.
        </p>
      </section>

      <section className="carte">
        <h2 className="carte-titre">Données locales</h2>
        <dl>
          <div className="etat">
            <dt>Espace utilisé</dt>
            <dd>{place ?? '—'}</dd>
          </div>
          <div className="etat">
            <dt>Stockage persistant</dt>
            <dd>{persistant === null ? '—' : persistant ? 'oui' : 'non'}</dd>
          </div>
          <div className="etat">
            <dt>Réseau</dt>
            <dd>{enLigne ? 'en ligne' : 'hors ligne'}</dd>
          </div>
        </dl>
        {persistant === false && (
          <button className="bouton discret" onClick={demanderPersistance}>
            Demander le stockage persistant
          </button>
        )}
        <p className="note">
          Tout reste sur ce téléphone : aucun compte, aucun serveur.{' '}
          <b>
            Rien n’est sauvegardé ailleurs — l’export des données arrivera, et
            c’est lui qui protégera ton historique.
          </b>
        </p>
      </section>

      <p className="note">
        Aliments : table CIQUAL 2020 de l’ANSES (Licence Ouverte) et
        OpenFoodFacts (ODbL).
      </p>
    </div>
  )
}
