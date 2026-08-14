import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import db from '../db'
import { cleDuJour, libelleJour, versDate } from '../lib/dates'
import { dupliquerJour, joursRenseignes } from '../lib/journal'
import { totalKcal } from '../lib/nutrition'

interface JourSource {
  date: string
  kcal: number
  nombre: number
  apercu: string
}

/** Reprend une journée déjà saisie. */
export default function Copier() {
  const navigate = useNavigate()
  const cible = useSearchParams()[0].get('jour') ?? cleDuJour()

  const [sources, setSources] = useState<JourSource[] | null>(null)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    ;(async () => {
      const jours = await joursRenseignes(cible)
      const resume: JourSource[] = []

      for (const date of jours) {
        const entrees = await db.entrees.where('date').equals(date).toArray()
        if (entrees.length === 0) continue
        resume.push({
          date,
          kcal: totalKcal(entrees),
          nombre: entrees.length,
          apercu: entrees.map((e) => e.nom.split(',')[0]).slice(0, 3).join(', '),
        })
      }
      if (vivant) setSources(resume)
    })()
    return () => {
      vivant = false
    }
  }, [cible])

  async function copier(source: string) {
    if (occupe) return
    setOccupe(true)
    await dupliquerJour(source, cible)
    navigate(cible === cleDuJour() ? '/' : `/jour/${cible}`)
  }

  const retour = cible === cleDuJour() ? '/' : `/jour/${cible}`

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={retour} className="retour">
          ← Retour
        </Link>
        <h1 className="vue-titre">Copier une journée</h1>
      </header>

      <p className="note">
        Le contenu choisi sera <b>ajouté</b> au {libelleJour(cible).toLowerCase()},
        sans remplacer ce qui s’y trouve déjà.
      </p>

      {sources === null && <p className="note">Lecture de l’historique…</p>}

      {sources?.length === 0 && (
        <p className="repas-vide">
          Rien à reprendre pour l’instant : aucun jour antérieur ne contient
          d’aliment.
        </p>
      )}

      {sources && sources.length > 0 && (
        <div className="resultats">
          {sources.map((source) => (
            <button
              key={source.date}
              className="resultat"
              disabled={occupe}
              onClick={() => copier(source.date)}
            >
              <span className="resultat-nom">
                {libelleJour(source.date)}
                <span className="resultat-groupe">
                  {versDate(source.date).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                  })}{' '}
                  — {source.apercu}
                  {source.nombre > 3 ? '…' : ''}
                </span>
              </span>
              <span className="resultat-kcal">
                {source.kcal}
                <small> kcal</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
