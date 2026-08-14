import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import db, { SECONDAIRES, type AlimentEnCache } from '../db'

const CHAMPS = [
  { cle: 'kcal', nom: 'Calories', unite: 'kcal' },
  { cle: 'prot', nom: 'Protéines', unite: 'g' },
  { cle: 'lip', nom: 'Lipides', unite: 'g' },
  { cle: 'gluc', nom: 'Glucides', unite: 'g' },
] as const

const ORIGINE: Record<AlimentEnCache['source'], string> = {
  manuel: 'Saisi à la main',
  openfoodfacts: 'Scanné, valeurs OpenFoodFacts',
  recette: 'Recette',
  ciqual: 'Table CIQUAL',
}

/** Correction d'un aliment mémorisé : nom, valeurs, suppression. */
export default function Aliment() {
  const { code } = useParams()
  const navigate = useNavigate()

  const [aliment, setAliment] = useState<AlimentEnCache | null>(null)
  const [absent, setAbsent] = useState(false)
  const [nom, setNom] = useState('')
  const [valeurs, setValeurs] = useState<Record<string, string>>({})
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true
    db.aliments.get(code!).then((trouve) => {
      if (!vivant) return
      if (!trouve) return setAbsent(true)
      setAliment(trouve)
      setNom(trouve.nom)
      setValeurs(
        Object.fromEntries(
          [...CHAMPS, ...SECONDAIRES].map(({ cle }) => [
            cle,
            trouve[cle] !== undefined ? String(trouve[cle]) : '',
          ]),
        ),
      )
    })
    return () => {
      vivant = false
    }
  }, [code])

  if (absent) {
    return (
      <div className="vue">
        <header className="vue-entete">
          <Link to="/" className="retour">
            ← Retour
          </Link>
        </header>
        <p className="repas-vide">Cet aliment n’est plus mémorisé.</p>
      </div>
    )
  }
  if (!aliment) return <div className="vue" />

  const nombre = (cle: string) => {
    const brut = (valeurs[cle] ?? '').trim().replace(',', '.')
    if (brut === '') return undefined
    const v = Number(brut)
    return Number.isFinite(v) && v >= 0 ? v : NaN
  }
  const chiffres = Object.fromEntries(
    [...CHAMPS, ...SECONDAIRES].map(({ cle }) => [cle, nombre(cle)]),
  )
  const valide =
    nom.trim() !== '' &&
    !Object.values(chiffres).some((v) => Number.isNaN(v)) &&
    typeof chiffres.kcal === 'number' &&
    chiffres.kcal > 0

  async function enregistrer() {
    if (!valide || occupe || !aliment) return
    setOccupe(true)
    await db.aliments.put({
      ...aliment,
      nom: nom.trim(),
      kcal: chiffres.kcal as number,
      prot: (chiffres.prot as number) ?? 0,
      lip: (chiffres.lip as number) ?? 0,
      gluc: (chiffres.gluc as number) ?? 0,
      fib: chiffres.fib,
      sel: chiffres.sel,
      suc: chiffres.suc,
      ags: chiffres.ags,
    })
    navigate(-1)
  }

  async function supprimer() {
    if (occupe) return
    setOccupe(true)
    await db.aliments.delete(code!)
    navigate('/')
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <button className="retour" onClick={() => navigate(-1)}>
          ← Retour
        </button>
        <h1 className="vue-titre">Modifier l’aliment</h1>
        <span className="vue-date">{ORIGINE[aliment.source]}</span>
      </header>

      <section className="carte">
        <label className="champ champ-large">
          <span className="champ-nom">Nom</span>
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
      </section>

      <section className="carte">
        <h2 className="carte-titre">Valeurs pour 100 g</h2>
        {[...CHAMPS, ...SECONDAIRES].map(({ cle, nom: libelle, unite }) => (
          <label className="champ" key={cle}>
            <span className="champ-nom">
              {libelle}
              <small>{unite}</small>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="—"
              value={valeurs[cle] ?? ''}
              onChange={(e) => setValeurs((v) => ({ ...v, [cle]: e.target.value }))}
            />
          </label>
        ))}
      </section>

      {aliment.ingredients && (
        <section className="carte">
          <h2 className="carte-titre">Composition d’origine</h2>
          <div className="lignes">
            {aliment.ingredients.map((i, rang) => (
              <div className="ligne" key={`${i.nom}-${rang}`}>
                <span className="ligne-nom">{i.nom}</span>
                <span className="ligne-kcal">{i.grammes} g</span>
              </div>
            ))}
          </div>
          <p className="note">
            Pour {aliment.poidsTotal} g de préparation. Cette liste est
            conservée à titre de mémoire : modifier les valeurs ci-dessus ne la
            recalcule pas.
          </p>
        </section>
      )}

      <div className="actions">
        <button className="bouton" disabled={!valide || occupe} onClick={enregistrer}>
          Enregistrer
        </button>
        <button className="bouton danger" disabled={occupe} onClick={supprimer}>
          Retirer de mes aliments
        </button>
      </div>

      <p className="note">
        Les repas déjà notés gardent les valeurs qu’ils avaient au moment de la
        saisie : cette correction ne vaut que pour les prochains.
      </p>
    </div>
  )
}
