import { useLiveQuery } from 'dexie-react-hooks'
import db, { majHydratation } from '../db'

/** Repère courant, à titre indicatif : huit verres d'environ 25 cl. */
const REPERE = 8
const CONTENANCE_CL = 25

export default function Eau({ jour }: { jour: string }) {
  const verres = useLiveQuery(
    () => db.hydratation.get(jour).then((h) => h?.verres ?? 0),
    [jour],
    0,
  )

  return (
    <section className="carte">
      <h2 className="carte-titre">Eau</h2>

      <div className="verres">
        {Array.from({ length: Math.max(REPERE, verres) }, (_, i) => (
          <button
            key={i}
            className="verre"
            aria-pressed={i < verres}
            aria-label={`${i + 1} verre${i > 0 ? 's' : ''}`}
            // Retoucher le dernier verre rempli le vide : c'est le geste
            // attendu pour corriger un appui de trop.
            onClick={() => majHydratation(jour, i + 1 === verres ? i : i + 1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 4h12l-1.4 15.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8Z" />
            </svg>
          </button>
        ))}
      </div>

      <p className="note">
        {verres === 0
          ? 'Rien de noté.'
          : `${verres} verre${verres > 1 ? 's' : ''}, soit environ ${((verres * CONTENANCE_CL) / 100).toFixed(2).replace('.', ',')} L.`}{' '}
        Le repère de huit verres est indicatif : les besoins varient avec la
        chaleur, l’activité et ce que contiennent déjà les repas.
      </p>
    </section>
  )
}
