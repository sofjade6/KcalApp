import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import db, {
  SECONDAIRES,
  marquerUtilise,
  type Entree,
  type Nutriments,
} from '../db'
import { chargerCiqual } from '../lib/ciqual'
import { cleDuJour, libelleJour } from '../lib/dates'
import { libellePortion, portionsPour, type PortionUsuelle } from '../lib/portions'
import { LIBELLES, statutGluten, type Gluten } from '../lib/gluten'
import { estLiquide, unite as uniteQuantite } from '../lib/liquides'
import { ajouterIngredient } from '../lib/recettes'

interface Brouillon extends Nutriments {
  nom: string
  code?: string
  gluten?: Gluten
  liquide: boolean
  source: Entree['source']
  portionG?: number
  portionNom?: string
}

/**
 * Saisie de la quantité, pour un ajout comme pour une correction.
 * Les deux cas partagent le même écran : c'est le même geste.
 */
export default function Portion() {
  const { code, id } = useParams()
  const navigate = useNavigate()
  // Jour visé, transmis par l'écran appelant : on peut compléter une journée
  // passée aussi bien que celle du jour.
  const parametres = useSearchParams()[0]
  const jour = parametres.get('jour') ?? cleDuJour()
  // Quand ce paramètre est présent, la quantité alimente une recette en cours
  // de composition plutôt que le journal du jour.
  const recette = parametres.get('recette')
  const retour = recette
    ? `/recettes/${recette}`
    : jour === cleDuJour()
      ? '/'
      : `/jour/${jour}`
  const suffixe = recette ? `?recette=${recette}` : `?jour=${jour}`
  const modeEdition = id !== undefined

  const [aliment, setAliment] = useState<Brouillon | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [grammes, setGrammes] = useState('100')
  // Unité choisie parmi les portions usuelles, et son multiple. Nul tant que
  // la quantité est donnée en grammes.
  const [unite, setUnite] = useState<PortionUsuelle | null>(null)
  const [nombre, setNombre] = useState(1)
  const [occupe, setOccupe] = useState(false)

  useEffect(() => {
    let vivant = true

    if (modeEdition) {
      db.entrees.get(Number(id)).then((entree) => {
        if (!vivant) return
        if (!entree) return setErreur('Cette entrée n’existe plus.')
        setAliment({
          nom: entree.nom,
          kcal: entree.kcal,
          prot: entree.prot,
          lip: entree.lip,
          gluc: entree.gluc,
          fib: entree.fib,
          sel: entree.sel,
          suc: entree.suc,
          ags: entree.ags,
          code: entree.code,
          gluten: entree.gluten,
          liquide: estLiquide(entree.nom, undefined, entree.liquide),
          source: entree.source,
        })
        setGrammes(String(entree.grammes))
        if (entree.portion) {
          setUnite({ nom: entree.portion.nom, grammes: entree.portion.grammes })
          setNombre(entree.portion.nombre)
        }
      })
    } else {
      // Un aliment mémorisé localement (saisi à la main, plus tard scanné)
      // prime : il n'a pas de contrepartie dans la table officielle.
      db.aliments
        .get(code!)
        .then(async (local) => {
          if (!vivant) return
          if (local) {
            return setAliment({
              portionG: local.portionG,
              portionNom: local.portionNom,
              nom: local.nom,
              kcal: local.kcal,
              prot: local.prot,
              lip: local.lip,
              gluc: local.gluc,
              fib: local.fib,
              sel: local.sel,
              suc: local.suc,
              ags: local.ags,
              code: local.code,
              gluten: local.gluten,
              liquide: estLiquide(local.nom, undefined, local.liquide),
              source: local.source,
            })
          }

          const base = await chargerCiqual()
          if (!vivant) return
          const trouve = base.aliments.find((a) => a.c === code)
          if (!trouve) return setErreur('Aliment introuvable dans la table.')
          setAliment({
            nom: trouve.n,
            kcal: trouve.kcal,
            prot: trouve.prot ?? 0,
            lip: trouve.lip ?? 0,
            gluc: trouve.gluc ?? 0,
            fib: trouve.fib,
            sel: trouve.sel,
            suc: trouve.suc,
            ags: trouve.ags,
            code: trouve.c,
            liquide: estLiquide(trouve.n, trouve.g),
            source: 'ciqual',
          })
        })
        .catch((e) => vivant && setErreur(String(e.message ?? e)))
    }

    return () => {
      vivant = false
    }
  }, [modeEdition, id, code])

  if (erreur) {
    return (
      <div className="vue">
        <header className="vue-entete">
          <Link to={retour} className="retour">
            ← Retour
          </Link>
        </header>
        <p className="repas-vide">{erreur}</p>
      </div>
    )
  }

  if (!aliment) return <div className="vue" />

  const portions = portionsPour(
    aliment.nom,
    aliment.portionG !== undefined
      ? { nom: aliment.portionNom ?? 'portion', grammes: aliment.portionG }
      : undefined,
  )

  // La quantité en grammes reste la valeur de référence ; une unité choisie
  // ne fait que la calculer.
  const quantite = unite ? Math.round(unite.grammes * nombre) : Number(grammes)
  const valide = Number.isFinite(quantite) && quantite > 0
  const facteur = valide ? quantite / 100 : 0

  function choisirUnite(portion: PortionUsuelle) {
    const memeUnite = unite?.nom === portion.nom
    setUnite(memeUnite ? null : portion)
    if (!memeUnite) setNombre(1)
    else setGrammes(String(quantite))
  }

  function ajuster(delta: number) {
    // Demi-portions en dessous de deux : une demi-tranche est courante,
    // sept portions et demie ne le sont pas.
    const pas = nombre + delta < 2 ? 0.5 : 1
    setNombre(Math.max(0.5, Math.round((nombre + delta * pas) * 2) / 2))
  }

  const apercu = [
    { nom: 'Calories', valeur: aliment.kcal * facteur, unite: 'kcal', decimales: 0 },
    { nom: 'Protéines', valeur: aliment.prot * facteur, unite: 'g', decimales: 0 },
    { nom: 'Lipides', valeur: aliment.lip * facteur, unite: 'g', decimales: 0 },
    { nom: 'Glucides', valeur: aliment.gluc * facteur, unite: 'g', decimales: 0 },
    // Le sel se compte en dixièmes de gramme : l'arrondi à l'unité
    // afficherait 0 g pour la quasi-totalité des aliments.
    ...SECONDAIRES.filter(({ cle }) => aliment[cle] !== undefined).map(({ cle, nom, unite }) => ({
      nom,
      valeur: aliment[cle]! * facteur,
      unite,
      decimales: cle === 'sel' ? 2 : 1,
    })),
  ]

  async function enregistrer() {
    // Même verrou que la saisie manuelle : l'écriture précède la navigation,
    // et un double appui ajouterait deux fois la portion.
    if (!valide || !aliment || occupe) return
    setOccupe(true)

    if (recette) {
      await ajouterIngredient(recette, {
        nom: aliment.nom,
        grammes: quantite,
        code: aliment.code,
        gluten: aliment.gluten,
        liquide: aliment.liquide,
        kcal: aliment.kcal,
        prot: aliment.prot,
        lip: aliment.lip,
        gluc: aliment.gluc,
        fib: aliment.fib,
        sel: aliment.sel,
        suc: aliment.suc,
        ags: aliment.ags,
      })
      return navigate(retour)
    }

    const portionRetenue = unite
      ? { nom: unite.nom, grammes: unite.grammes, nombre }
      : undefined

    if (modeEdition) {
      await db.entrees.update(Number(id), {
        grammes: quantite,
        portion: portionRetenue,
      })
    } else {
      await db.entrees.add({
        date: jour,
        nom: aliment.nom,
        grammes: quantite,
        portion: portionRetenue,
        kcal: aliment.kcal,
        prot: aliment.prot,
        lip: aliment.lip,
        gluc: aliment.gluc,
        fib: aliment.fib,
        sel: aliment.sel,
        suc: aliment.suc,
        ags: aliment.ags,
        code: aliment.code,
        gluten: aliment.gluten,
        liquide: aliment.liquide,
        source: aliment.source,
        creeLe: Date.now(),
      })
      // Remonte l'aliment dans « Mes aliments ». Sans effet sur un code CIQUAL,
      // qui n'a pas d'entrée dans la table locale.
      if (aliment.code) await marquerUtilise(aliment.code)
    }
    navigate(retour)
  }

  async function supprimer() {
    if (occupe) return
    setOccupe(true)
    await db.entrees.delete(Number(id))
    navigate(retour)
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link
          to={modeEdition ? retour : `/ajouter${suffixe}`}
          className="retour"
        >
          ← {modeEdition ? 'Retour' : 'Recherche'}
        </Link>
        <h1 className="vue-titre">{aliment.nom}</h1>
      </header>

      <section className="carte">
        {portions.length > 0 && (
          <div className="portions">
            <span className="carte-titre">Portion usuelle</span>
            <div className="portions-choix">
              {portions.map((portion) => (
                <button
                  key={portion.nom}
                  className="puce"
                  aria-pressed={unite?.nom === portion.nom}
                  onClick={() => choisirUnite(portion)}
                >
                  1 {portion.nom}
                  <small>
                    {portion.grammes} {uniteQuantite(aliment.liquide)}
                  </small>
                </button>
              ))}
            </div>
          </div>
        )}

        {unite ? (
          <div className="compteur">
            <button
              className="compteur-bouton"
              aria-label="Diminuer"
              disabled={nombre <= 0.5}
              onClick={() => ajuster(-1)}
            >
              −
            </button>
            <span className="compteur-valeur">
              {libellePortion(unite, nombre)}
              <small>
                {quantite} {uniteQuantite(aliment.liquide)}
              </small>
            </span>
            <button
              className="compteur-bouton"
              aria-label="Augmenter"
              onClick={() => ajuster(1)}
            >
              +
            </button>
          </div>
        ) : (
          <label className="champ">
            <span className="champ-nom">
              Quantité
              <small>
                en {aliment.liquide ? 'millilitres' : 'grammes'}
              </small>
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              value={grammes}
              onChange={(e) => setGrammes(e.target.value)}
            />
          </label>
        )}

        {aliment.liquide && (
          <p className="note">
            Compté en millilitres. Les valeurs sont rapportées à 100{' '}
            {aliment.source === 'openfoodfacts' ? 'ml, comme sur l’étiquette' : 'g, un millilitre étant compté pour un gramme'}
            .
          </p>
        )}

        {recette ? (
          <p className="note">Ajout à la recette en cours de composition.</p>
        ) : (
          jour !== cleDuJour() && (
            <p className="note">
              Ajout au <b>{libelleJour(jour).toLowerCase()}</b>.
            </p>
          )
        )}

      </section>

      {statutGluten(aliment) !== 'inconnu' && (
        <p className={`gluten gluten-${statutGluten(aliment)}`}>
          {LIBELLES[statutGluten(aliment)]}
          {aliment.gluten && aliment.gluten !== 'inconnu'
            ? ' — d’après l’étiquette du produit'
            : ' — déduit du libellé, à vérifier'}
        </p>
      )}

      <section className="carte">
        <h2 className="carte-titre">
          Pour {valide ? quantite : '—'} {uniteQuantite(aliment.liquide)}
        </h2>
        <dl>
          {apercu.map(({ nom, valeur, unite, decimales }) => (
            <div className="etat" key={nom}>
              <dt>{nom}</dt>
              <dd>
                {valide ? valeur.toFixed(decimales).replace('.', ',') : '—'} {unite}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {!modeEdition && aliment.source !== 'ciqual' && aliment.code && (
        <Link className="modifier-aliment" to={`/aliment/${aliment.code}`}>
          Corriger les valeurs de cet aliment
        </Link>
      )}

      <div className="actions">
        <button
          className="bouton"
          disabled={!valide || occupe}
          onClick={enregistrer}
        >
          {modeEdition ? 'Enregistrer' : recette ? 'Ajouter à la recette' : 'Ajouter'}
        </button>
        {modeEdition && (
          <button className="bouton danger" disabled={occupe} onClick={supprimer}>
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}
