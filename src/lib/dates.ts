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
