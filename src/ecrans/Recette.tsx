import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import db, { creerRecette, type Entree } from '../db'
import { cleDuJour } from '../lib/dates'
import { kcalPortion, totalKcal } from '../lib/nutrition'

/**
 * Transforme des aliments déjà notés en recette réutilisable.
 *
 * Partir du journal plutôt que d'un composeur vierge évite de ressaisir des
 * ingrédients déjà notés. Comme la journée n'est plus découpée en repas, les
 * ingrédients du plat s'y choisissent un par un.
 */
export default function Recette() {
  const navigate = useNavigate()
  const jour = useSearchParams()[0].get('jour') ?? cleDuJour()
  const retour = jour === cleDuJour() ? '/' : `/jour/${jour}`

  const [entrees, setEntrees] = useState<Entree[] | null>(null)
  const [retenus, setRetenus] = useState<Set<number>>(new Set())
  const [nom, setNom] = useState('')
  const [poids, setPoids] = useState('')
  const [occupe, setOccupe] = useState(false)
  // Tant que le poids n'a pas été touché, il suit la sélection.
  const [poidsTouche, setPoidsTouche] = useState(false)

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

  const choisis = entrees?.filter((e) => retenus.has(e.id!)) ?? []

  useEffect(() => {
    if (poidsTouche) return
    setPoids(String(choisis.reduce((t, e) => t + e.grammes, 0)))
    // `choisis` est recalculé à chaque rendu : c'est bien la sélection qu'on suit.
  }, [retenus, entrees, poidsTouche]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!entrees) return <div className="vue" />

  const poidsTotal = Number(poids)
  const valide =
    nom.trim() !== '' && Number.isFinite(poidsTotal) && poidsTotal > 0 && choisis.length > 0
  const kcalTotal = totalKcal(choisis)
  const pour100 = poidsTotal > 0 ? Math.round((kcalTotal / poidsTotal) * 100) : 0

  function basculer(id: number) {
    setRetenus((actuels) => {
      const suivant = new Set(actuels)
      if (suivant.has(id)) suivant.delete(id)
      else suivant.add(id)
      return suivant
    })
  }

  async function enregistrer() {
    if (!valide || occupe) return
    setOccupe(true)
    await creerRecette(nom.trim(), poidsTotal, choisis)
    navigate(retour)
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={retour} className="retour">
          ← Retour
        </Link>
        <h1 className="vue-titre">Enregistrer comme recette</h1>
      </header>

      {entrees.length === 0 ? (
        <p className="repas-vide">
          Rien de noté ce jour-là. Note d’abord les ingrédients, puis reviens ici.
        </p>
      ) : (
        <>
          <section className="carte">
            <h2 className="carte-titre">Ingrédients à retenir</h2>
            <div className="lignes">
              {entrees.map((e) => (
                <button
                  className="ligne ligne-choix"
                  key={e.id}
                  aria-pressed={retenus.has(e.id!)}
                  onClick={() => basculer(e.id!)}
                >
                  <span className="ligne-nom">
                    {e.nom}
                    <span className="ligne-detail">{e.grammes} g</span>
                  </span>
                  <span className="ligne-kcal">{kcalPortion(e)} kcal</span>
                </button>
              ))}
            </div>
          </section>

          <section className="carte">
            <label className="champ champ-large">
              <span className="champ-nom">Nom de la recette</span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Bolognaise maison"
                autoComplete="off"
              />
            </label>

            <label className="champ">
              <span className="champ-nom">
                Poids de la préparation
                <small>en grammes, une fois prête</small>
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={poids}
                onChange={(e) => {
                  setPoidsTouche(true)
                  setPoids(e.target.value)
                }}
              />
            </label>

            <dl>
              <div className="etat">
                <dt>Total retenu</dt>
                <dd>{kcalTotal} kcal</dd>
              </div>
              <div className="etat">
                <dt>Pour 100 g</dt>
                <dd>{pour100} kcal</dd>
              </div>
            </dl>

            <p className="note">
              Par défaut, la somme des ingrédients retenus. Corrige-la si la
              cuisson a fait perdre de l’eau : à poids réduit, les valeurs se
              concentrent.
            </p>
          </section>

          <div className="actions">
            <button className="bouton" disabled={!valide || occupe} onClick={enregistrer}>
              {occupe ? 'Enregistrement…' : 'Créer la recette'}
            </button>
          </div>

          <p className="note">
            La recette rejoindra tes aliments : tu pourras en consommer une part
            en pesant simplement ton assiette.
          </p>
        </>
      )}
    </div>
  )
}
