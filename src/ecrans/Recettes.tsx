import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db from '../db'
import { creerRecette, estRecette } from '../lib/recettes'

export default function Recettes() {
  const navigate = useNavigate()
  const [occupe, setOccupe] = useState(false)

  const recettes = useLiveQuery(
    () => db.aliments.filter(estRecette).toArray(),
    [],
    [],
  )

  async function nouvelle() {
    if (occupe) return
    setOccupe(true)
    const code = await creerRecette('Nouvelle recette')
    navigate(`/recettes/${code}`)
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <span className="vue-date">Mes préparations</span>
        <h1 className="vue-titre">Recettes</h1>
      </header>

      <p className="note">
        Une recette est un groupe d’aliments réuni sous un nom. Une fois créée,
        elle s’ajoute à ta journée comme n’importe quel aliment : tu pèses ta
        part, l’app calcule le reste.
      </p>

      <div className="actions">
        <button className="bouton" disabled={occupe} onClick={nouvelle}>
          Nouvelle recette
        </button>
      </div>

      {recettes.length === 0 ? (
        <p className="repas-vide">
          Aucune recette pour l’instant.
        </p>
      ) : (
        <div className="resultats">
          {recettes.map((recette) => (
            <button
              key={recette.code}
              className="resultat"
              onClick={() => navigate(`/recettes/${recette.code}`)}
            >
              <span className="resultat-nom">
                {recette.nom}
                <span className="resultat-groupe">
                  {recette.ingredients?.length ?? 0} ingrédient
                  {(recette.ingredients?.length ?? 0) > 1 ? 's' : ''} ·{' '}
                  {recette.poidsTotal} g
                </span>
              </span>
              <span className="resultat-kcal">
                {Math.round(recette.kcal)}
                <small> kcal/100 g</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
