import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import db, { REPAS, marquerUtilise, type Entree, type Repas } from '../db'
import { chargerCiqual } from '../lib/ciqual'
import { cleDuJour } from '../lib/dates'
import { libellePortion, portionsPour, type PortionUsuelle } from '../lib/portions'

interface Brouillon {
  nom: string
  kcal: number
  prot: number
  lip: number
  gluc: number
  code?: string
  source: Entree['source']
  portionG?: number
  portionNom?: string
}

/**
 * Saisie de la quantité, pour un ajout comme pour une correction.
 * Les deux cas partagent le même écran : c'est le même geste.
 */
export default function Portion() {
  const { repas: repasUrl, code, id } = useParams()
  const navigate = useNavigate()
  const modeEdition = id !== undefined

  const [aliment, setAliment] = useState<Brouillon | null>(null)
  const [erreur, setErreur] = useState<string | null>(null)
  const [grammes, setGrammes] = useState('100')
  // Unité choisie parmi les portions usuelles, et son multiple. Nul tant que
  // la quantité est donnée en grammes.
  const [unite, setUnite] = useState<PortionUsuelle | null>(null)
  const [nombre, setNombre] = useState(1)
  const [occupe, setOccupe] = useState(false)
  const [repas, setRepas] = useState<Repas>((repasUrl as Repas) ?? 'dejeuner')

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
          code: entree.code,
          source: entree.source,
        })
        setGrammes(String(entree.grammes))
        setRepas(entree.repas)
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
              code: local.code,
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
            code: trouve.c,
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
          <Link to="/" className="retour">
            ← Aujourd’hui
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
    { nom: 'Calories', valeur: aliment.kcal * facteur, unite: 'kcal' },
    { nom: 'Protéines', valeur: aliment.prot * facteur, unite: 'g' },
    { nom: 'Lipides', valeur: aliment.lip * facteur, unite: 'g' },
    { nom: 'Glucides', valeur: aliment.gluc * facteur, unite: 'g' },
  ]

  async function enregistrer() {
    // Même verrou que la saisie manuelle : l'écriture précède la navigation,
    // et un double appui ajouterait deux fois la portion.
    if (!valide || !aliment || occupe) return
    setOccupe(true)

    const portionRetenue = unite
      ? { nom: unite.nom, grammes: unite.grammes, nombre }
      : undefined

    if (modeEdition) {
      await db.entrees.update(Number(id), {
        grammes: quantite,
        repas,
        portion: portionRetenue,
      })
    } else {
      await db.entrees.add({
        date: cleDuJour(),
        repas,
        nom: aliment.nom,
        grammes: quantite,
        portion: portionRetenue,
        kcal: aliment.kcal,
        prot: aliment.prot,
        lip: aliment.lip,
        gluc: aliment.gluc,
        code: aliment.code,
        source: aliment.source,
        creeLe: Date.now(),
      })
      // Remonte l'aliment dans « Mes aliments ». Sans effet sur un code CIQUAL,
      // qui n'a pas d'entrée dans la table locale.
      if (aliment.code) await marquerUtilise(aliment.code)
    }
    navigate('/')
  }

  async function supprimer() {
    if (occupe) return
    setOccupe(true)
    await db.entrees.delete(Number(id))
    navigate('/')
  }

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={modeEdition ? '/' : `/ajouter/${repasUrl}`} className="retour">
          ← {modeEdition ? 'Aujourd’hui' : 'Recherche'}
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
                  <small>{portion.grammes} g</small>
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
              <small>{quantite} g</small>
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
              <small>en grammes</small>
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

        <div className="segments" role="group" aria-label="Repas">
          {REPAS.map(({ cle, nom }) => (
            <button
              key={cle}
              className="segment"
              aria-pressed={repas === cle}
              onClick={() => setRepas(cle)}
            >
              {nom}
            </button>
          ))}
        </div>
      </section>

      <section className="carte">
        <h2 className="carte-titre">Pour {valide ? quantite : '—'} g</h2>
        <dl>
          {apercu.map(({ nom, valeur, unite }) => (
            <div className="etat" key={nom}>
              <dt>{nom}</dt>
              <dd>
                {valide ? Math.round(valeur) : '—'} {unite}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="actions">
        <button
          className="bouton"
          disabled={!valide || occupe}
          onClick={enregistrer}
        >
          {modeEdition ? 'Enregistrer' : 'Ajouter'}
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
