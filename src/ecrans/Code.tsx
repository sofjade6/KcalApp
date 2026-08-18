import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { codeValide, resoudreProduit } from '../lib/produit'
import { cleDuJour } from '../lib/dates'

/**
 * Saisie du code-barres au clavier.
 *
 * Le scan échoue sur un emballage froissé, brillant ou mal éclairé, et la
 * caméra n'est pas toujours disponible. Les chiffres sont imprimés sous le
 * code : les recopier reste le recours le plus sûr.
 */
export default function Code() {
  const navigate = useNavigate()
  const parametres = useSearchParams()[0]
  const recette = parametres.get('recette')
  const jour = parametres.get('jour') ?? cleDuJour()
  const suffixe = recette ? `?recette=${recette}` : `?jour=${jour}`

  const [code, setCode] = useState('')
  const [etat, setEtat] = useState<{ titre: string; detail: string } | null>(null)
  const [occupe, setOccupe] = useState(false)

  const propre = code.replace(/\D/g, '')
  const valide = codeValide(propre)

  async function chercher() {
    if (!valide || occupe) return
    setOccupe(true)
    setEtat(null)

    const resolution = await resoudreProduit(propre)
    if (resolution.etat === 'connu' || resolution.etat === 'trouve') {
      return navigate(`/ajouter/${propre}${suffixe}`)
    }

    setOccupe(false)
    if (resolution.etat === 'inconnu') {
      setEtat({
        titre: 'Produit inconnu',
        detail: `Le code ${propre} n’est pas dans OpenFoodFacts. Tu peux saisir ses valeurs toi-même : il sera reconnu ensuite.`,
      })
    } else if (resolution.etat === 'incomplet') {
      setEtat({
        titre: 'Fiche incomplète',
        detail: `« ${resolution.nom} » est référencé, mais sans valeurs nutritionnelles utilisables. Saisis-les depuis l’emballage.`,
      })
    } else {
      setEtat({
        titre: 'Recherche impossible',
        detail: `${resolution.message}. Un produit jamais rencontré demande le réseau.`,
      })
    }
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={`/ajouter${suffixe}`} className="retour">
          ← Recherche
        </Link>
        <h1 className="vue-titre">Saisir un code-barres</h1>
      </header>

      <section className="carte">
        <label className="champ champ-large">
          <span className="champ-nom">
            Les chiffres imprimés sous le code
            <small>8 ou 13 chiffres</small>
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder="3229820129488"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && chercher()}
          />
        </label>

        {propre.length >= 8 && !valide && (
          <p className="avertissement">
            Ce code n’est pas valide : son dernier chiffre est une clé de
            contrôle, et elle ne correspond pas. Vérifie les chiffres — c’est
            presque toujours une coquille.
          </p>
        )}
      </section>

      <div className="actions">
        <button className="bouton" disabled={!valide || occupe} onClick={chercher}>
          {occupe ? 'Recherche…' : 'Chercher ce produit'}
        </button>
      </div>

      {etat && (
        <>
          <section className="carte">
            <h2 className="carte-titre">{etat.titre}</h2>
            <p className="note">{etat.detail}</p>
          </section>
          <div className="actions">
            <Link
              className="bouton"
              to={`/saisir?code=${encodeURIComponent(propre)}${suffixe.replace('?', '&')}`}
            >
              Saisir ce produit
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
