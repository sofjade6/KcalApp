import { useRef, useState } from 'react'
import { majProfil, type Profil } from '../db'
import {
  analyser,
  construireSauvegarde,
  livrer,
  restaurer,
  resumer,
  SauvegardeInvalide,
  type Resume,
  type Sauvegarde as Fichier,
} from '../lib/sauvegarde'

const JOUR = 86_400_000
/** Au-delà, l'app rappelle qu'une sauvegarde a vieilli. */
const PEREMPTION = 30

type Etat =
  | { phase: 'repos' }
  | { phase: 'export' }
  | { phase: 'confirmation'; fichier: Fichier; resume: Resume }
  | { phase: 'restauration' }
  | { phase: 'fait'; texte: string }
  | { phase: 'erreur'; texte: string }

const dateLisible = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'date inconnue'

export default function Sauvegarde({ profil }: { profil: Profil }) {
  const [etat, setEtat] = useState<Etat>({ phase: 'repos' })
  const champFichier = useRef<HTMLInputElement>(null)

  const depuis = profil.derniereSauvegarde
    ? Math.floor((Date.now() - profil.derniereSauvegarde) / JOUR)
    : null
  const aVieilli = depuis === null || depuis >= PEREMPTION

  async function exporter() {
    setEtat({ phase: 'export' })
    try {
      const sauvegarde = await construireSauvegarde()
      const voie = await livrer(sauvegarde)
      await majProfil({ derniereSauvegarde: Date.now() })
      setEtat({
        phase: 'fait',
        texte:
          voie === 'partage'
            ? 'Sauvegarde créée. Range-la dans Fichiers ou iCloud Drive, pas seulement sur ce téléphone.'
            : 'Fichier téléchargé. Range-le ailleurs que sur cet appareil.',
      })
    } catch {
      setEtat({ phase: 'erreur', texte: 'L’export a échoué. Réessaie.' })
    }
  }

  async function choisirFichier(fichier: File) {
    try {
      const analyse = analyser(await fichier.text())
      setEtat({ phase: 'confirmation', fichier: analyse, resume: resumer(analyse) })
    } catch (erreur) {
      setEtat({
        phase: 'erreur',
        texte:
          erreur instanceof SauvegardeInvalide
            ? erreur.message
            : 'Fichier illisible.',
      })
    }
  }

  async function confirmer(fichier: Fichier) {
    setEtat({ phase: 'restauration' })
    try {
      await restaurer(fichier)
      setEtat({ phase: 'fait', texte: 'Données restaurées.' })
    } catch {
      setEtat({ phase: 'erreur', texte: 'La restauration a échoué. Rien n’a été modifié.' })
    }
  }

  if (etat.phase === 'confirmation') {
    const { resume, fichier } = etat
    return (
      <section className="carte">
        <h2 className="carte-titre">Restaurer cette sauvegarde ?</h2>
        <dl>
          <div className="etat">
            <dt>Créée le</dt>
            <dd>{dateLisible(resume.exporteLe)}</dd>
          </div>
          <div className="etat">
            <dt>Aliments consommés</dt>
            <dd>{resume.entrees}</dd>
          </div>
          <div className="etat">
            <dt>Pesées</dt>
            <dd>{resume.pesees}</dd>
          </div>
          <div className="etat">
            <dt>Aliments mémorisés</dt>
            <dd>{resume.aliments}</dd>
          </div>
        </dl>
        <p className="avertissement">
          Tout ce que contient cet appareil sera <b>remplacé</b> par le contenu de
          ce fichier. Ce qui a été enregistré depuis cette sauvegarde sera perdu.
        </p>
        <div className="actions">
          <button className="bouton danger" onClick={() => confirmer(fichier)}>
            Remplacer mes données
          </button>
          <button className="bouton discret" onClick={() => setEtat({ phase: 'repos' })}>
            Annuler
          </button>
        </div>
      </section>
    )
  }

  const occupe = etat.phase === 'export' || etat.phase === 'restauration'

  return (
    <section className="carte">
      <h2 className="carte-titre">Sauvegarde</h2>

      <p className="note">
        Tes données ne vivent que sur ce téléphone. Elles ne sont copiées ni dans
        iCloud ni ailleurs : <b>perdre l’appareil, c’est perdre l’historique</b>.
        L’export produit un fichier unique à ranger où tu veux.
      </p>

      <dl>
        <div className="etat">
          <dt>Dernière sauvegarde</dt>
          <dd>
            {depuis === null
              ? 'jamais'
              : depuis === 0
                ? 'aujourd’hui'
                : `il y a ${depuis} j`}
          </dd>
        </div>
      </dl>

      {aVieilli && (
        <p className="avertissement">
          {depuis === null
            ? 'Aucune sauvegarde pour l’instant. C’est le bon moment.'
            : `La dernière remonte à ${depuis} jours.`}
        </p>
      )}

      <div className="actions">
        <button className="bouton" disabled={occupe} onClick={exporter}>
          {etat.phase === 'export' ? 'Préparation…' : 'Exporter mes données'}
        </button>
        <button
          className="bouton discret"
          disabled={occupe}
          onClick={() => champFichier.current?.click()}
        >
          {etat.phase === 'restauration' ? 'Restauration…' : 'Restaurer une sauvegarde'}
        </button>
        <input
          ref={champFichier}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const fichier = e.target.files?.[0]
            // Remise à zéro : sans elle, rechoisir le même fichier n'émet
            // aucun événement et le bouton paraît mort.
            e.target.value = ''
            if (fichier) choisirFichier(fichier)
          }}
        />
      </div>

      {etat.phase === 'fait' && <p className="note">{etat.texte}</p>}
      {etat.phase === 'erreur' && <p className="avertissement">{etat.texte}</p>}
    </section>
  )
}
