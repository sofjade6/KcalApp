import db from '../db'
import { chercherProduit } from './openfoodfacts'

export type Resolution =
  | { etat: 'connu' }
  | { etat: 'trouve'; nom: string }
  | { etat: 'inconnu' }
  | { etat: 'incomplet'; nom: string }
  | { etat: 'erreur'; message: string }

/**
 * Un code-barres alimentaire compte 8 ou 13 chiffres, le dernier étant une clé
 * de contrôle. La vérifier signale une faute de frappe tout de suite, au lieu
 * de laisser partir une requête vouée à ne rien trouver.
 */
export function codeValide(code: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(code)) return false

  const chiffres = [...code].map(Number)
  const cle = chiffres.pop()!
  // Les poids 1 et 3 alternent en partant de la droite, dans les deux formats.
  const somme = chiffres
    .reverse()
    .reduce((total, chiffre, rang) => total + chiffre * (rang % 2 === 0 ? 3 : 1), 0)
  return (10 - (somme % 10)) % 10 === cle
}

/**
 * Résout un code-barres et mémorise le produit trouvé.
 *
 * Partagée par le scan et la saisie manuelle du code : les deux suivent le
 * même ordre — cache local d'abord, ce qui rend un produit déjà rencontré
 * instantané et disponible hors ligne, puis OpenFoodFacts.
 */
export async function resoudreProduit(code: string): Promise<Resolution> {
  if (await db.aliments.get(code)) return { etat: 'connu' }

  const resultat = await chercherProduit(code)
  if (resultat.etat === 'trouve') {
    await db.aliments.put({ ...resultat.produit, source: 'openfoodfacts', vuLe: Date.now() })
    return { etat: 'trouve', nom: resultat.produit.nom }
  }
  return resultat
}
