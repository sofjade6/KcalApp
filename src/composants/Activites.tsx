import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { ajouterActivite, lireProfil, PROFIL_DEFAUT, type Activite } from '../db'
import {
  COURANTES,
  POIDS_REFERENCE,
  TAILLE_DEFAUT,
  distanceKm,
  formaterKm,
  formaterPas,
  kcalDesMinutes,
  kcalDesPas,
  type TypeActivite,
} from '../lib/activite'

/** Paliers proposés en un geste : une sortie, une demi-journée, un objectif. */
const PALIERS = [2000, 5000, 8000, 10000]

export default function Activites({
  jour,
  activites,
}: {
  jour: string
  activites: Activite[]
}) {
  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  // La dernière pesée plutôt qu'un poids figé dans le profil : une dépense
  // suit le poids du moment.
  const pesee = useLiveQuery(() => db.pesees.orderBy('date').last(), [])
  const poids = pesee?.kg ?? POIDS_REFERENCE
  const taille = profil.tailleCm ?? TAILLE_DEFAUT

  const [choix, setChoix] = useState<TypeActivite | null>(null)
  const [minutes, setMinutes] = useState(30)
  const [pasSaisis, setPasSaisis] = useState('')
  // Marche et course s'ouvrent sur les pas ; la durée reste accessible, un
  // tapis de course ou une balade sans téléphone ne donnent pas de pas.
  const [enPas, setEnPas] = useState(true)

  const pas = Math.max(0, Math.round(Number(pasSaisis.replace(/[^\d]/g, '')) || 0))
  const parPas = !!choix?.allure && enPas

  const kcal = !choix
    ? 0
    : parPas
      ? kcalDesPas(pas, taille, poids, choix)
      : kcalDesMinutes(minutes, poids, choix)

  const km = parPas && choix?.allure ? distanceKm(pas, taille, choix.allure) : 0
  const valide = !!choix && (parPas ? pas > 0 : minutes > 0)

  function selectionner(activite: TypeActivite) {
    const memeChoix = choix?.nom === activite.nom
    setChoix(memeChoix ? null : activite)
    setEnPas(!!activite.allure)
    setPasSaisis('')
    setMinutes(30)
  }

  async function valider() {
    if (!choix || !valide) return
    const libelle = parPas
      ? `${choix.nom} ${formaterPas(pas)} pas`
      : `${choix.nom} ${minutes} min`
    await ajouterActivite(jour, libelle, kcal, parPas ? pas : undefined)
    setChoix(null)
    setPasSaisis('')
    setMinutes(30)
  }

  const pasDuJour = activites.reduce((total, a) => total + (a.pas ?? 0), 0)

  return (
    <section className="carte">
      <h2 className="carte-titre">Activité physique</h2>

      {activites.length > 0 && (
        <div className="lignes">
          {activites.map((a) => (
            <div className="ligne" key={a.id}>
              <span className="ligne-nom">{a.nom}</span>
              <span className="ligne-kcal">
                +{a.kcal} kcal
                <button
                  className="ligne-retirer"
                  aria-label={`Retirer ${a.nom}`}
                  onClick={() => db.activites.delete(a.id!)}
                >
                  ×
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {pasDuJour > 0 && (
        <dl>
          <div className="etat">
            <dt>Pas dans la journée</dt>
            <dd>{formaterPas(pasDuJour)}</dd>
          </div>
        </dl>
      )}

      <div className="portions-choix">
        {COURANTES.map((activite) => (
          <button
            key={activite.nom}
            className="puce"
            aria-pressed={choix?.nom === activite.nom}
            onClick={() => selectionner(activite)}
          >
            {activite.nom}
          </button>
        ))}
      </div>

      {choix && (
        <>
          {choix.allure && (
            <div className="segments" role="group" aria-label="Façon de compter">
              {[true, false].map((mode) => (
                <button
                  key={String(mode)}
                  className="segment"
                  aria-pressed={enPas === mode}
                  onClick={() => setEnPas(mode)}
                >
                  {mode ? 'en pas' : 'en minutes'}
                </button>
              ))}
            </div>
          )}

          {parPas ? (
            <>
              <label className="champ champ-large">
                <span className="champ-nom">
                  Nombre de pas
                  <small>relevé sur ton téléphone</small>
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={100}
                  placeholder="8000"
                  value={pasSaisis}
                  onChange={(e) => setPasSaisis(e.target.value)}
                />
              </label>
              <div className="portions-choix">
                {PALIERS.map((palier) => (
                  <button
                    key={palier}
                    className="puce"
                    aria-pressed={pas === palier}
                    onClick={() => setPasSaisis(String(palier))}
                  >
                    {formaterPas(palier)}
                  </button>
                ))}
              </div>
              {pas > 0 && (
                <p className="note">
                  Environ <b>{formaterKm(km)} km</b> pour {formaterPas(pas)} pas,
                  soit <b>+{kcal} kcal</b>.
                </p>
              )}
            </>
          ) : (
            <div className="compteur">
              <button
                className="compteur-bouton"
                aria-label="Moins de minutes"
                disabled={minutes <= 5}
                onClick={() => setMinutes(Math.max(5, minutes - (minutes <= 30 ? 5 : 15)))}
              >
                −
              </button>
              <span className="compteur-valeur">
                {minutes} min
                <small>+{kcal} kcal</small>
              </span>
              <button
                className="compteur-bouton"
                aria-label="Plus de minutes"
                onClick={() => setMinutes(minutes + (minutes < 30 ? 5 : 15))}
              >
                +
              </button>
            </div>
          )}

          <button className="bouton" disabled={!valide} onClick={valider}>
            Ajouter au budget du jour
          </button>
        </>
      )}

      <p className="note">
        {pesee
          ? `Estimations pour ${String(poids).replace('.', ',')} kg`
          : 'Estimations pour une personne d’environ 70 kg — note une pesée pour les ajuster'}
        {profil.tailleCm
          ? `, foulée déduite de ta taille (${profil.tailleCm} cm).`
          : ', foulée déduite d’une taille de 170 cm par défaut.'}{' '}
        Elles agrandissent le budget calorique du jour ; à prendre comme un
        ordre de grandeur, une dépense réelle dépend du rythme autant que de la
        distance.
      </p>
    </section>
  )
}
