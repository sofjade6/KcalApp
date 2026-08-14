import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import db, { REPAS, creerRecette, type Entree, type Repas } from '../db'
import { cleDuJour } from '../lib/dates'
import { totalKcal } from '../lib/nutrition'

/**
 * Transforme un repas déjà saisi en recette réutilisable.
 *
 * Partir d'un repas plutôt que d'un composeur vierge évite de ressaisir des
 * ingrédients déjà notés : le plat existe, il suffit de le nommer.
 */
export default function Recette() {
  const { repas } = useParams<{ repas: Repas }>()
  const navigate = useNavigate()
  const jour = useSearchParams()[0].get('jour') ?? cleDuJour()
  const retour = jour === cleDuJour() ? '/' : `/jour/${jour}`

  const [entrees, setEntrees] = useState<Entree[] | null>(null)
  const [nom, setNom] = useState('')
  const [poids, setPoids] = useState('')
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    db.entrees.where({ date: jour, repas: repas! }).toArray().then((liste) => {
      if (!vivant) return
      setEntrees(liste)
      // Poids cru par défaut : la somme des ingrédients. À corriger si la
      // cuisson a fait perdre de l'eau, ce qui concentre les valeurs.
      setPoids(String(liste.reduce((t, e) => t + e.grammes, 0)))
    })
    return () => {
      vivant = false
    }
  }, [jour, repas])

  if (!entrees) return <div className="vue" />

  const poidsTotal = Number(poids)
  const valide = nom.trim() !== '' && Number.isFinite(poidsTotal) && poidsTotal > 0
  const kcalTotal = totalKcal(entrees)
  const pour100 = poidsTotal > 0 ? Math.round((kcalTotal / poidsTotal) * 100) : 0

  async function enregistrer() {
    if (!valide || occupe || !entrees) return
    setOccupe(true)
    await creerRecette(nom.trim(), poidsTotal, entrees)
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
          Ce repas est vide. Note d’abord ses ingrédients, puis reviens ici.
        </p>
      ) : (
        <>
          <section className="carte">
            <label className="champ champ-large">
              <span className="champ-nom">Nom de la recette</span>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder={`${REPAS.find((r) => r.cle === repas)?.nom} maison`}
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
                onChange={(e) => setPoids(e.target.value)}
              />
            </label>

            <p className="note">
              Par défaut, la somme des ingrédients. Corrige-la si la cuisson a
              fait perdre de l’eau : à poids réduit, les valeurs se concentrent.
            </p>
          </section>

          <section className="carte">
            <h2 className="carte-titre">Composition</h2>
            <div className="lignes">
              {entrees.map((e) => (
                <div className="ligne" key={e.id}>
                  <span className="ligne-nom">{e.nom}</span>
                  <span className="ligne-kcal">{e.grammes} g</span>
                </div>
              ))}
            </div>
            <dl>
              <div className="etat">
                <dt>Total du plat</dt>
                <dd>{kcalTotal} kcal</dd>
              </div>
              <div className="etat">
                <dt>Pour 100 g</dt>
                <dd>{pour100} kcal</dd>
              </div>
            </dl>
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
