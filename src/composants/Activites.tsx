import { useState } from 'react'
import db, { ajouterActivite, type Activite } from '../db'

/** Dépenses indicatives pour une heure, à 70 kg. */
const COURANTES = [
  { nom: 'Marche', kcalHeure: 240 },
  { nom: 'Course', kcalHeure: 600 },
  { nom: 'Vélo', kcalHeure: 450 },
  { nom: 'Natation', kcalHeure: 500 },
  { nom: 'Musculation', kcalHeure: 330 },
]

export default function Activites({
  jour,
  activites,
}: {
  jour: string
  activites: Activite[]
}) {
  const [choix, setChoix] = useState<(typeof COURANTES)[number] | null>(null)
  const [minutes, setMinutes] = useState(30)

  const kcal = choix ? Math.round((choix.kcalHeure * minutes) / 60) : 0

  async function valider() {
    if (!choix) return
    await ajouterActivite(jour, `${choix.nom} ${minutes} min`, kcal)
    setChoix(null)
    setMinutes(30)
  }

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

      <div className="portions-choix">
        {COURANTES.map((activite) => (
          <button
            key={activite.nom}
            className="puce"
            aria-pressed={choix?.nom === activite.nom}
            onClick={() => setChoix(choix?.nom === activite.nom ? null : activite)}
          >
            {activite.nom}
          </button>
        ))}
      </div>

      {choix && (
        <>
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
          <button className="bouton" onClick={valider}>
            Ajouter au budget du jour
          </button>
        </>
      )}

      <p className="note">
        Estimations pour une personne d’environ 70 kg. Elles agrandissent le
        budget calorique du jour ; à prendre comme un ordre de grandeur, une
        dépense réelle dépend du rythme autant que de la durée.
      </p>
    </section>
  )
}
