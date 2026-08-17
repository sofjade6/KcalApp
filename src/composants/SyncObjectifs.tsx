import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { lireProfil, majProfil, PROFIL_DEFAUT, type Pesee } from '../db'
import { age, besoins, profilComplet } from '../lib/corps'

/**
 * Maintient les objectifs alignés sur le profil, partout dans l'app.
 *
 * Ce recalcul vivait dans l'écran Profil : une correction de la formule ne
 * prenait effet qu'en visitant cet écran, et l'écran du jour continuait
 * d'afficher les anciennes valeurs entre-temps. Composant sans rendu, monté
 * une fois pour toutes.
 */
export default function SyncObjectifs() {
  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  const derniere: Pesee | undefined = useLiveQuery(
    () => db.pesees.orderBy('date').last(),
    [],
  )

  useEffect(() => {
    if (!profil.objectifsAuto || !derniere || !profilComplet(profil)) return

    const calcul = besoins(
      derniere.kg,
      profil.tailleCm!,
      age(profil.naissance!),
      profil.sexe!,
      profil.activite!,
      profil.but!,
      profil.poidsCible,
      profil.rythme,
    )

    if (
      profil.objectifKcal === calcul.kcal &&
      profil.objectifProt === calcul.prot &&
      profil.objectifLip === calcul.lip &&
      profil.objectifGluc === calcul.gluc
    ) {
      return
    }

    majProfil({
      objectifKcal: calcul.kcal,
      objectifProt: calcul.prot,
      objectifLip: calcul.lip,
      objectifGluc: calcul.gluc,
    })
  }, [profil, derniere])

  return null
}
