/**
 * Clé de jour au format AAAA-MM-JJ, en heure locale.
 *
 * `toISOString()` est volontairement évité : il convertit en UTC, ce qui
 * bascule le repas du soir sur le lendemain dès que le fuseau est en avance
 * sur UTC — le cas de la France une bonne partie de l'année.
 */
export function cleDuJour(date = new Date()): string {
  const mois = String(date.getMonth() + 1).padStart(2, '0')
  const jour = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mois}-${jour}`
}

export function dateLongue(date = new Date()): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/** Objet Date à midi : à minuit, un décalage d'heure d'été change de jour. */
export function versDate(cle: string): Date {
  return new Date(`${cle}T12:00:00`)
}

export function decalerJour(cle: string, jours: number): string {
  const d = versDate(cle)
  d.setDate(d.getDate() + jours)
  return cleDuJour(d)
}

export function estAujourdhui(cle: string): boolean {
  return cle === cleDuJour()
}

/** Libellé du jour : « aujourd'hui », « hier », sinon la date. */
export function libelleJour(cle: string): string {
  if (estAujourdhui(cle)) return 'Aujourd’hui'
  if (cle === decalerJour(cleDuJour(), -1)) return 'Hier'
  if (cle === decalerJour(cleDuJour(), 1)) return 'Demain'
  return dateLongue(versDate(cle))
}

/** Les `n` clés de jour se terminant aujourd'hui, de la plus ancienne à la plus récente. */
export function derniersJours(n: number, fin = cleDuJour()): string[] {
  return Array.from({ length: n }, (_, i) => decalerJour(fin, i - n + 1))
}
