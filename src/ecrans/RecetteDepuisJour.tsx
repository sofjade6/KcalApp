import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import db, { type Entree } from '../db'
import { cleDuJour, libelleJour } from '../lib/dates'
import { kcalPortion } from '../lib/nutrition'
import { estLiquide, unite as uniteQuantite } from '../lib/liquides'
import { creerRecette } from '../lib/recettes'

/**
 * Crée une recette à partir d'aliments déjà notés dans la journée.
 *
 * Raccourci du composeur : ce qui a été mangé est souvent déjà saisi, et le
 * ressaisir ingrédient par ingrédient n'apporterait rien.
 */
export default function RecetteDepuisJour() {
  const navigate = useNavigate()
  const jour = useSearchParams()[0].get('jour') ?? cleDuJour()
  const retour = jour === cleDuJour() ? '/' : `/jour/${jour}`

  const [entrees, setEntrees] = useState<Entree[] | null>(null)
  const [retenus, setRetenus] = useState<Set<number>>(new Set())
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    db.entrees.where('date').equals(jour).toArray().then((liste) => {
      if (!vivant) return
      setEntrees(liste)
      setRetenus(new Set(liste.map((e) => e.id!)))
    })
    return () => {
      vivant = false
    }
  }, [jour])

  if (!entrees) return <div className="vue" />

  const choisis = entrees.filter((e) => retenus.has(e.id!))

  async function creer() {
    if (occupe || choisis.length === 0) return
    setOccupe(true)
    const code = await creerRecette(
      'Nouvelle recette',
      choisis.map((e) => ({
        nom: e.nom,
        grammes: e.grammes,
        code: e.code,
        kcal: e.kcal,
        prot: e.prot,
        lip: e.lip,
        gluc: e.gluc,
        fib: e.fib,
        sel: e.sel,
        suc: e.suc,
        ags: e.ags,
      })),
    )
    // Le nom et le poids final se règlent dans le composeur, qui sait déjà le faire.
    navigate(`/recettes/${code}`)
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={retour} className="retour">
          ← Retour
        </Link>
        <h1 className="vue-titre">Créer une recette</h1>
        <span className="vue-date">D’après {libelleJour(jour).toLowerCase()}</span>
      </header>

      {entrees.length === 0 ? (
        <p className="repas-vide">
          Rien de noté ce jour-là. Note d’abord les ingrédients, puis reviens ici.
        </p>
      ) : (
        <>
          <p className="note">
            Choisis les aliments qui composent le plat. Tu pourras le nommer et
            corriger son poids juste après.
          </p>

          <section className="carte">
            <div className="lignes">
              {entrees.map((e) => (
                <button
                  className="ligne ligne-choix"
                  key={e.id}
                  aria-pressed={retenus.has(e.id!)}
                  onClick={() =>
                    setRetenus((actuels) => {
                      const suivant = new Set(actuels)
                      if (suivant.has(e.id!)) suivant.delete(e.id!)
                      else suivant.add(e.id!)
                      return suivant
                    })
                  }
                >
                  <span className="ligne-nom">
                    {e.nom}
                    <span className="ligne-detail">
                      {estLiquide(e.nom, undefined, e.liquide) ? (e.ml ?? e.grammes) : e.grammes}{' '}
                      {uniteQuantite(estLiquide(e.nom, undefined, e.liquide))}
                    </span>
                  </span>
                  <span className="ligne-kcal">{kcalPortion(e)} kcal</span>
                </button>
              ))}
            </div>
          </section>

          <div className="actions">
            <button
              className="bouton"
              disabled={occupe || choisis.length === 0}
              onClick={creer}
            >
              Créer avec {choisis.length} ingrédient{choisis.length > 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
