import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { lireProfil, PROFIL_DEFAUT, type Pesee } from '../db'
import { cleDuJour } from '../lib/dates'

const JOUR = 86_400_000

/**
 * Rappels affichés à l'ouverture de l'app.
 *
 * Ce ne sont pas des notifications : une PWA ne peut pas se réveiller seule
 * pour en émettre, cela demanderait un serveur d'envoi — donc un backend, un
 * compte, et la fin de la promesse « tout reste sur le téléphone ». Le rappel
 * se fait donc au moment où l'app est ouverte, ce qui reste le moment où l'on
 * peut agir.
 */
export default function Rappels({ jour }: { jour: string }) {
  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  // Sans valeur par défaut, le résultat est `undefined` tant que la requête
  // n'a pas répondu — indistinguable ici d'une absence de pesée, ce qui
  // convient : on n'affiche rien dans les deux cas.
  const derniere: Pesee | undefined = useLiveQuery(
    () => db.pesees.orderBy('date').last(),
    [],
  )

  // Ne rien réclamer sur une journée passée : on y vient pour corriger.
  if (jour !== cleDuJour()) return null

  const messages: { texte: React.ReactNode; vers: string }[] = []

  if (derniere) {
    const jours = Math.floor(
      (Date.now() - new Date(`${derniere.date}T12:00:00`).getTime()) / JOUR,
    )
    if (jours >= 7) {
      messages.push({
        texte: (
          <>
            Dernière pesée il y a <b>{jours} jours</b>. La courbe perd en
            lisibilité au-delà d’une semaine sans point.
          </>
        ),
        vers: '/profil',
      })
    }
  }

  const sauvegarde = profil.derniereSauvegarde
  const joursSauvegarde = sauvegarde
    ? Math.floor((Date.now() - sauvegarde) / JOUR)
    : null
  if (joursSauvegarde !== null && joursSauvegarde >= 45) {
    messages.push({
      texte: (
        <>
          Aucune sauvegarde depuis <b>{joursSauvegarde} jours</b>. Perdre le
          téléphone, c’est perdre tout l’historique.
        </>
      ),
      vers: '/reglages',
    })
  }

  if (messages.length === 0) return null

  return (
    <div className="rappels">
      {messages.map(({ texte, vers }, rang) => (
        <Link className="rappel" key={rang} to={vers}>
          {texte}
        </Link>
      ))}
    </div>
  )
}
