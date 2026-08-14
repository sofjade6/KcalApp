import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { BarcodeFormat, DecodeHintType } from '@zxing/library'
import db from '../db'
import { chercherProduit } from '../lib/openfoodfacts'

/** Codes-barres alimentaires uniquement : restreindre accélère et fiabilise. */
const FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
]

type Etat =
  | { phase: 'demarrage' }
  | { phase: 'scan' }
  | { phase: 'recherche'; code: string }
  | { phase: 'echec'; titre: string; detail: string; code?: string }

export default function Scanner() {
  const navigate = useNavigate()
  const parametres = useSearchParams()[0]
  const recette = parametres.get('recette')
  const jour = parametres.get('jour')
  const suffixe = recette ? `?recette=${recette}` : jour ? `?jour=${jour}` : ''
  const video = useRef<HTMLVideoElement>(null)
  const [etat, setEtat] = useState<Etat>({ phase: 'demarrage' })

  useEffect(() => {
    let vivant = true
    let arreter: (() => void) | undefined
    // Une lecture réussie doit figer le scan : sans ce verrou, ZXing continue
    // d'émettre et déclenche plusieurs recherches pour le même produit.
    let verrouille = false

    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS)
    const lecteur = new BrowserMultiFormatReader(hints)

    async function traiter(code: string) {
      if (verrouille) return
      verrouille = true
      arreter?.()
      setEtat({ phase: 'recherche', code })

      // Un produit déjà scanné est resservi depuis l'appareil : instantané,
      // et disponible hors ligne.
      const connu = await db.aliments.get(code)
      if (connu) return navigate(`/ajouter/${code}${suffixe}`)

      const resultat = await chercherProduit(code)
      if (!vivant) return

      if (resultat.etat === 'trouve') {
        await db.aliments.put({ ...resultat.produit, source: 'openfoodfacts', vuLe: Date.now() })
        return navigate(`/ajouter/${code}${suffixe}`)
      }
      if (resultat.etat === 'inconnu') {
        return setEtat({
          phase: 'echec',
          titre: 'Produit inconnu',
          detail: `Le code ${code} n’est pas dans OpenFoodFacts. Tu peux saisir ses valeurs toi-même : il sera reconnu à tous tes prochains scans.`,
          code,
        })
      }
      if (resultat.etat === 'incomplet') {
        return setEtat({
          phase: 'echec',
          titre: 'Fiche incomplète',
          detail: `« ${resultat.nom} » est référencé, mais sans valeurs nutritionnelles utilisables. Saisis-les depuis l’emballage.`,
          code,
        })
      }
      setEtat({
        phase: 'echec',
        titre: 'Recherche impossible',
        detail: `${resultat.message}. Le scan a besoin du réseau pour un produit jamais scanné.`,
        code,
      })
    }

    lecteur
      .decodeFromConstraints(
        // `environment` demande la caméra arrière ; `ideal` évite l'échec sur
        // un appareil qui n'en a pas.
        { video: { facingMode: { ideal: 'environment' } } },
        video.current!,
        (resultat) => resultat && traiter(resultat.getText()),
      )
      .then((controles) => {
        arreter = () => controles.stop()
        if (!vivant) return arreter()
        setEtat((e) => (e.phase === 'demarrage' ? { phase: 'scan' } : e))
      })
      .catch((erreur: unknown) => {
        if (!vivant) return
        const nom = erreur instanceof Error ? erreur.name : ''
        setEtat({
          phase: 'echec',
          titre:
            nom === 'NotAllowedError' ? 'Accès caméra refusé' : 'Caméra indisponible',
          detail:
            nom === 'NotAllowedError'
              ? 'Autorise la caméra pour ce site dans Réglages → Safari, puis relance le scan.'
              : 'Aucune caméra utilisable sur cet appareil. La recherche par nom reste disponible.',
        })
      })

    return () => {
      vivant = false
      arreter?.()
    }
  }, [navigate, suffixe])

  return (
    <div className="vue">
      <header className="vue-entete">
        <Link to={`/ajouter${suffixe}`} className="retour">
          ← Recherche
        </Link>
        <h1 className="vue-titre">Scanner un produit</h1>
      </header>

      {etat.phase !== 'echec' && (
        <>
          <div className="viseur">
            {/* playsInline est indispensable : sans lui, iOS bascule la vidéo
                en plein écran et sort de l'app. */}
            <video ref={video} playsInline muted autoPlay />
            <div className="viseur-cadre" aria-hidden="true" />
          </div>
          <p className="note">
            {etat.phase === 'demarrage' && 'Activation de la caméra…'}
            {etat.phase === 'scan' &&
              'Cadre le code-barres. La lecture se fait toute seule.'}
            {etat.phase === 'recherche' && `Code ${etat.code} — recherche du produit…`}
          </p>
        </>
      )}

      {etat.phase === 'echec' && (
        <>
          <section className="carte">
            <h2 className="carte-titre">{etat.titre}</h2>
            <p className="note">{etat.detail}</p>
          </section>
          <div className="actions">
            {etat.code && (
              <Link
                className="bouton"
                to={`/saisir?code=${encodeURIComponent(etat.code)}${suffixe.replace('?', '&')}`}
              >
                Saisir ce produit
              </Link>
            )}
            <Link className="bouton discret" to={`/ajouter${suffixe}`}>
              Chercher par nom
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
