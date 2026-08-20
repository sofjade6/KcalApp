/**
 * Activités physiques et conversion en calories.
 *
 * Deux façons de déclarer un effort : la durée, ou le nombre de pas pour ce
 * qui se marche et se court — c'est la seule des deux qu'un téléphone sait
 * compter tout seul, et donc la seule qu'on n'a pas à estimer de mémoire.
 */

/** Poids de référence des dépenses horaires ci-dessous. */
export const POIDS_REFERENCE = 70

/** Taille retenue tant que le profil ne la renseigne pas. */
export const TAILLE_DEFAUT = 170

export interface Allure {
  /**
   * Longueur d'un pas, en fraction de la taille. Il s'agit bien d'un pas et
   * non d'une enjambée, qui en vaut deux : c'est le pas que comptent les
   * podomètres.
   */
  ratioPas: number
  /**
   * Vitesse retenue, en km/h. Elle ne sert pas à mesurer une durée, mais à
   * relier la dépense horaire au kilomètre parcouru.
   */
  kmHeure: number
}

export interface TypeActivite {
  nom: string
  /** Dépense indicative pour une heure, au poids de référence. */
  kcalHeure: number
  /** Renseigné pour les activités qui se comptent aussi en pas. */
  allure?: Allure
}

export const COURANTES: TypeActivite[] = [
  // Marche : 0,415 × taille donne environ 117 pas par minute à 5 km/h, le
  // rythme d'un pas soutenu. En course la foulée s'allonge sans que la
  // cadence change beaucoup, d'où le rapport nettement plus grand.
  { nom: 'Marche', kcalHeure: 240, allure: { ratioPas: 0.415, kmHeure: 5 } },
  { nom: 'Course', kcalHeure: 600, allure: { ratioPas: 0.6, kmHeure: 10 } },
  { nom: 'Vélo', kcalHeure: 450 },
  { nom: 'Natation', kcalHeure: 500 },
  { nom: 'Musculation', kcalHeure: 330 },
]

/** Longueur d'un pas, en mètres. */
export function longueurPas(tailleCm: number, allure: Allure): number {
  return (tailleCm * allure.ratioPas) / 100
}

export function distanceKm(pas: number, tailleCm: number, allure: Allure): number {
  return (pas * longueurPas(tailleCm, allure)) / 1000
}

/**
 * Dépense d'un nombre de pas.
 *
 * Le coût du kilomètre n'est pas une constante posée à part : il se déduit de
 * la dépense horaire et de la vitesse retenue. Les deux modes de saisie
 * donnent ainsi le même résultat pour le même parcours, là où deux jeux de
 * chiffres indépendants finiraient par se contredire.
 */
export function kcalDesPas(
  pas: number,
  tailleCm: number,
  poidsKg: number,
  activite: TypeActivite,
): number {
  if (!activite.allure) return 0
  const coutKm = activite.kcalHeure / activite.allure.kmHeure / POIDS_REFERENCE
  return Math.round(distanceKm(pas, tailleCm, activite.allure) * poidsKg * coutKm)
}

/** Dépense d'une durée, mise à l'échelle du poids réel. */
export function kcalDesMinutes(
  minutes: number,
  poidsKg: number,
  activite: TypeActivite,
): number {
  return Math.round((activite.kcalHeure * (poidsKg / POIDS_REFERENCE) * minutes) / 60)
}

/** Milliers séparés : un nombre de pas se lit à quatre ou cinq chiffres. */
export const formaterPas = (pas: number) => pas.toLocaleString('fr-FR')

export const formaterKm = (km: number) =>
  km.toFixed(km < 10 ? 1 : 0).replace('.', ',')
