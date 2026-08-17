import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { lireProfil, majProfil, PROFIL_DEFAUT } from '../db'
import SauvegardeCarte from '../composants/Sauvegarde'

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

    // Retaper la même valeur ne doit pas couper le calcul automatique : sans
    // cette comparaison, un simple passage dans le champ figeait les objectifs
    // pour de bon, et le profil semblait ensuite n'avoir plus aucun effet.
    const arrondie = Math.round(valeur)
    if (arrondie === profil[cle]) return

    majProfil({ [cle]: arrondie, objectifsAuto: false })
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
        {profil.objectifsAuto ? (
          <p className="note">
            Ces valeurs sont calculées depuis ton profil et suivent ton poids.
            Les modifier ici passe en saisie manuelle.
          </p>
        ) : (
          <p className="avertissement">
            <b>Objectifs saisis à la main.</b> Le calcul issu de ton profil ne
            les met plus à jour : changer ton poids, ton activité ou ton
            objectif n’aura aucun effet ici tant que tu ne reviens pas au calcul
            automatique.
          </p>
        )}
      </section>

      {!profil.objectifsAuto && (
        <div className="actions">
          <button
            className="bouton"
            onClick={() => majProfil({ objectifsAuto: true })}
          >
            Revenir au calcul automatique
          </button>
        </div>
      )}

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
          Tout reste sur ce téléphone : aucun compte, aucun serveur. C’est aussi
          pourquoi l’app <b>n’envoie pas de notifications</b> : une page web ne
          peut pas se réveiller seule pour en émettre, il faudrait un serveur
          d’envoi. Les rappels s’affichent donc à l’ouverture, sur l’écran du
          jour.
        </p>
      </section>

      <SauvegardeCarte profil={profil} />

      <p className="note">
        Aliments : table CIQUAL 2020 de l’ANSES (Licence Ouverte) et
        OpenFoodFacts (ODbL).
      </p>
    </div>
  )
}
