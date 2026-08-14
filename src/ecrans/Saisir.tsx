import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { creerAlimentManuel } from '../db'

const NUTRIMENTS = [
  { cle: 'kcal', nom: 'Calories', unite: 'kcal', requis: true },
  { cle: 'prot', nom: 'Protéines', unite: 'g', requis: false },
  { cle: 'lip', nom: 'Lipides', unite: 'g', requis: false },
  { cle: 'gluc', nom: 'Glucides', unite: 'g', requis: false },
] as const

type CleNutriment = (typeof NUTRIMENTS)[number]['cle']

/** Énergie théorique des macros déclarées, facteurs Atwater. */
function energieDesMacros(prot: number, lip: number, gluc: number): number {
  return prot * 4 + lip * 9 + gluc * 4
}

/**
 * Saisie d'un aliment absent de CIQUAL et sans code-barres exploitable :
 * plat de traiteur, produit non référencé, recette maison.
 */
export default function Saisir() {
  const { repas } = useParams()
  const navigate = useNavigate()

  const [nom, setNom] = useState('')
  const [valeurs, setValeurs] = useState<Record<CleNutriment, string>>({
    kcal: '',
    prot: '',
    lip: '',
    gluc: '',
  })

  const nombre = (cle: CleNutriment) => {
    const brut = valeurs[cle].trim().replace(',', '.')
    if (brut === '') return 0
    const valeur = Number(brut)
    return Number.isFinite(valeur) && valeur >= 0 ? valeur : NaN
  }

  const chiffres = {
    kcal: nombre('kcal'),
    prot: nombre('prot'),
    lip: nombre('lip'),
    gluc: nombre('gluc'),
  }

  const toutesValides = Object.values(chiffres).every((v) => !Number.isNaN(v))
  const valide =
    nom.trim() !== '' && toutesValides && valeurs.kcal.trim() !== '' && chiffres.kcal > 0

  // Garde-fou contre l'erreur la plus courante : recopier la colonne « par
  // portion » de l'étiquette au lieu de la colonne « pour 100 g ». Les deux
  // colonnes ne sont pas cohérentes entre elles, l'écart le trahit.
  const theorique = toutesValides
    ? energieDesMacros(chiffres.prot, chiffres.lip, chiffres.gluc)
    : 0
  const macrosRenseignees =
    toutesValides && chiffres.prot + chiffres.lip + chiffres.gluc > 0
  const ecart = Math.abs(theorique - chiffres.kcal)
  const incoherent =
    valide && macrosRenseignees && ecart > 50 && ecart > chiffres.kcal * 0.25

  const [enregistrement, setEnregistrement] = useState(false)

  async function continuer() {
    // L'écriture en base précède la navigation : sans ce verrou, un second
    // appui pendant ce laps de temps crée un doublon de l'aliment.
    if (!valide || enregistrement) return
    setEnregistrement(true)
    try {
      const code = await creerAlimentManuel({ nom: nom.trim(), ...chiffres })
      navigate(`/ajouter/${repas}/${code}`)
    } catch {
      setEnregistrement(false)
    }
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={`/ajouter/${repas}`} className="retour">
          ← Recherche
        </Link>
        <h1 className="vue-titre">Nouvel aliment</h1>
      </header>

      <section className="carte">
        <label className="champ champ-large">
          <span className="champ-nom">Nom</span>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Lasagnes du traiteur"
            autoComplete="off"
          />
        </label>
      </section>

      <section className="carte">
        <h2 className="carte-titre">Valeurs pour 100 g</h2>
        {NUTRIMENTS.map(({ cle, nom: libelle, unite, requis }) => (
          <label className="champ" key={cle}>
            <span className="champ-nom">
              {libelle}
              <small>{requis ? `${unite} — obligatoire` : unite}</small>
            </span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="0"
              value={valeurs[cle]}
              onChange={(e) =>
                setValeurs((v) => ({ ...v, [cle]: e.target.value }))
              }
            />
          </label>
        ))}
        <p className="note">
          Recopie la colonne <b>« pour 100 g »</b> de l’étiquette, pas la colonne
          par portion. La quantité réelle se saisit à l’écran suivant.
        </p>
      </section>

      {incoherent && (
        <p className="avertissement">
          Les macros déclarées correspondent à environ {Math.round(theorique)}{' '}
          kcal, loin des {Math.round(chiffres.kcal)} kcal saisies. Vérifie que
          toutes les valeurs viennent bien de la colonne « pour 100 g ». Tu peux
          continuer malgré tout.
        </p>
      )}

      <div className="actions">
        <button
          className="bouton"
          disabled={!valide || enregistrement}
          onClick={continuer}
        >
          {enregistrement ? 'Enregistrement…' : 'Continuer'}
        </button>
      </div>

      <p className="note">
        Cet aliment sera mémorisé sur ce téléphone et reproposé lors de tes
        prochaines recherches.
      </p>
    </div>
  )
}
