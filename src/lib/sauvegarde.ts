import db, { type AlimentEnCache, type Entree, type Pesee, type Profil } from '../db'

/** Version du format d'export, pour pouvoir migrer un jour sans casser l'ancien. */
export const FORMAT = 1

export interface Sauvegarde {
  format: number
  application: 'kcalapp'
  exporteLe: string
  profil: Profil | null
  entrees: Entree[]
  aliments: AlimentEnCache[]
  pesees: Pesee[]
}

export interface Resume {
  entrees: number
  aliments: number
  pesees: number
  profil: boolean
  exporteLe?: string
}

export async function construireSauvegarde(): Promise<Sauvegarde> {
  const [profil, entrees, aliments, pesees] = await Promise.all([
    db.profil.get('moi'),
    db.entrees.toArray(),
    db.aliments.toArray(),
    db.pesees.toArray(),
  ])

  return {
    format: FORMAT,
    application: 'kcalapp',
    exporteLe: new Date().toISOString(),
    profil: profil ?? null,
    entrees,
    aliments,
    pesees,
  }
}

export const resumer = (s: Sauvegarde): Resume => ({
  entrees: s.entrees.length,
  aliments: s.aliments.length,
  pesees: s.pesees.length,
  profil: s.profil !== null,
  exporteLe: s.exporteLe,
})

export function nomFichier(date = new Date()): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `kcalapp-${date.getFullYear()}-${mois}-${jour}.json`
}

export class SauvegardeInvalide extends Error {}

/** Contrôle la forme du fichier avant d'accepter d'écraser quoi que ce soit. */
export function analyser(texte: string): Sauvegarde {
  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    throw new SauvegardeInvalide('Ce fichier n’est pas du JSON.')
  }

  const s = brut as Partial<Sauvegarde>
  if (s?.application !== 'kcalapp') {
    throw new SauvegardeInvalide('Ce fichier ne vient pas de KcalApp.')
  }
  if (typeof s.format !== 'number' || s.format > FORMAT) {
    throw new SauvegardeInvalide(
      'Sauvegarde créée par une version plus récente de l’app. Mets l’app à jour avant de la restaurer.',
    )
  }
  for (const cle of ['entrees', 'aliments', 'pesees'] as const) {
    if (!Array.isArray(s[cle])) {
      throw new SauvegardeInvalide(`Sauvegarde incomplète : « ${cle} » manque.`)
    }
  }

  return s as Sauvegarde
}

/**
 * Remplace le contenu de l'appareil par celui de la sauvegarde.
 *
 * Le remplacement est total et se fait dans une seule transaction : une
 * restauration interrompue à mi-chemin laisserait un journal incohérent,
 * moitié ancien moitié nouveau.
 */
export async function restaurer(s: Sauvegarde): Promise<void> {
  await db.transaction('rw', db.profil, db.entrees, db.aliments, db.pesees, async () => {
    await Promise.all([
      db.profil.clear(),
      db.entrees.clear(),
      db.aliments.clear(),
      db.pesees.clear(),
    ])
    if (s.profil) await db.profil.put({ ...s.profil, id: 'moi' })
    await db.entrees.bulkPut(s.entrees)
    await db.aliments.bulkPut(s.aliments)
    await db.pesees.bulkPut(s.pesees)
  })
}

/**
 * Remet le fichier à l'utilisateur.
 *
 * Sur iPhone, le partage natif est préférable au téléchargement : il ouvre la
 * feuille de partage, d'où le fichier part vers Fichiers, iCloud Drive ou un
 * message. Le lien de téléchargement sert de repli ailleurs.
 */
export async function livrer(sauvegarde: Sauvegarde): Promise<'partage' | 'telechargement'> {
  const contenu = JSON.stringify(sauvegarde, null, 2)
  const nom = nomFichier()
  const fichier = new File([contenu], nom, { type: 'application/json' })

  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: 'Sauvegarde KcalApp' })
      return 'partage'
    } catch (erreur) {
      // Un partage annulé n'est pas une panne : on retombe sur le téléchargement.
      if (erreur instanceof DOMException && erreur.name === 'AbortError') return 'partage'
    }
  }

  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
  return 'telechargement'
}
