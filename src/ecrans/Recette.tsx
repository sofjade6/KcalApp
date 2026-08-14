import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { SECONDAIRES } from '../db'
import {
  estRecette,
  kcalIngredient,
  majRecette,
  poidsDesIngredients,
  retirerIngredient,
  type Recette as Preparation,
} from '../lib/recettes'

const arrondi = (v: number, decimales = 1) => v.toFixed(decimales).replace('.', ',')

/**
 * Composition d'une recette : un nom, des ingrédients pesés, un poids final.
 *
 * Le choix des ingrédients repasse par la recherche et l'écran de quantité,
 * qui savent déjà interroger CIQUAL, scanner un code-barres et proposer des
 * portions usuelles — les refaire ici n'apporterait rien.
 */
export default function Recette() {
  const { code } = useParams()
  const navigate = useNavigate()

  const recette = useLiveQuery(
    () => db.aliments.get(code!).then((a) => (a && estRecette(a) ? (a as Preparation) : null)),
    [code],
  )

  const [nom, setNom] = useState('')
  const [poids, setPoids] = useState('')

  useEffect(() => {
    if (!recette) return
    setNom(recette.nom)
    setPoids(String(recette.poidsTotal))
  }, [recette?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  if (recette === undefined) return <div className="vue" />
  if (recette === null) {
    return (
      <div className="vue">
        <header className="vue-entete">
          <Link to="/recettes" className="retour">
            ← Recettes
          </Link>
        </header>
        <p className="repas-vide">Cette recette n’existe plus.</p>
      </div>
    )
  }

  const ingredients = recette.ingredients
  const somme = poidsDesIngredients(ingredients)
  const poidsSaisi = Number(poids)
  const poidsValide = Number.isFinite(poidsSaisi) && poidsSaisi > 0
  const kcalTotal = ingredients.reduce((t, i) => t + kcalIngredient(i), 0)

  const secondaires = SECONDAIRES.filter(({ cle }) => recette[cle] !== undefined)

  async function supprimer() {
    await db.aliments.delete(code!)
    navigate('/recettes')
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to="/recettes" className="retour">
          ← Recettes
        </Link>
        <h1 className="vue-titre">{recette.nom}</h1>
      </header>

      <section className="carte">
        <label className="champ champ-large">
          <span className="champ-nom">Nom</span>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            onBlur={() => nom.trim() && majRecette(code!, () => ({ nom: nom.trim() }))}
            placeholder="Lasagnes au bœuf"
            autoComplete="off"
          />
        </label>
      </section>

      <section className="repas">
        <div className="repas-tete">
          <h2 className="repas-nom">Ingrédients</h2>
          <span className="repas-kcal">{kcalTotal} kcal</span>
        </div>

        {ingredients.length === 0 ? (
          <Link to={`/ajouter?recette=${code}`} className="repas-vide">
            Aucun ingrédient — en ajouter un
          </Link>
        ) : (
          <div className="lignes">
            {ingredients.map((i, rang) => (
              <div className="ligne" key={`${i.nom}-${rang}`}>
                <span className="ligne-nom">
                  {i.nom}
                  <span className="ligne-detail">{i.grammes} g</span>
                </span>
                <span className="ligne-kcal">
                  {kcalIngredient(i)} kcal
                  <button
                    className="ligne-retirer"
                    aria-label={`Retirer ${i.nom}`}
                    onClick={() => retirerIngredient(code!, rang)}
                  >
                    ×
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="repas-actions">
          {ingredients.length > 0 && (
            <Link to={`/ajouter?recette=${code}`}>+ Ajouter un ingrédient</Link>
          )}
        </div>
      </section>

      {ingredients.length > 0 && (
        <section className="carte">
          <h2 className="carte-titre">Poids de la préparation</h2>
          <label className="champ">
            <span className="champ-nom">
              Une fois prête
              <small>somme des ingrédients : {somme} g</small>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={poids}
              onChange={(e) => setPoids(e.target.value)}
              onBlur={() =>
                poidsValide && majRecette(code!, () => ({ poidsTotal: Math.round(poidsSaisi) }))
              }
            />
          </label>
          <p className="note">
            À corriger si la cuisson a fait perdre de l’eau : à poids réduit,
            les valeurs se concentrent. C’est ce poids qui sert de base au
            calcul pour 100 g.
          </p>
        </section>
      )}

      {ingredients.length > 0 && (
        <section className="carte">
          <h2 className="carte-titre">Pour 100 g de préparation</h2>
          <dl>
            <div className="etat">
              <dt>Calories</dt>
              <dd>{Math.round(recette.kcal)} kcal</dd>
            </div>
            <div className="etat">
              <dt>Protéines</dt>
              <dd>{arrondi(recette.prot)} g</dd>
            </div>
            <div className="etat">
              <dt>Lipides</dt>
              <dd>{arrondi(recette.lip)} g</dd>
            </div>
            <div className="etat">
              <dt>Glucides</dt>
              <dd>{arrondi(recette.gluc)} g</dd>
            </div>
            {secondaires.map(({ cle, nom: libelle, unite }) => (
              <div className="etat" key={cle}>
                <dt>{libelle}</dt>
                <dd>
                  {arrondi(recette[cle]!, cle === 'sel' ? 2 : 1)} {unite}
                </dd>
              </div>
            ))}
          </dl>
          <p className="note">
            La recette est déjà disponible dans la recherche : ajoute-la à ta
            journée et pèse simplement ta part.
          </p>
        </section>
      )}

      <div className="actions">
        <button className="bouton danger" onClick={supprimer}>
          Supprimer la recette
        </button>
      </div>
    </div>
  )
}
