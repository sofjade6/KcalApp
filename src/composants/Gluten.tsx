import type { Entree } from '../db'
import { LIBELLES, statutGluten, type Gluten as Statut } from '../lib/gluten'
import { estLiquide, unite as uniteQuantite } from '../lib/liquides'

/** Ordre d'affichage : le plus préoccupant d'abord. */
const GROUPES: Statut[] = ['contient', 'probable', 'traces']

/**
 * Relevé du gluten sur la journée.
 *
 * Volontairement pas un total : le gluten n'est quantifié dans aucune base
 * nutritionnelle, et la réglementation impose de le déclarer, pas de le doser.
 * Afficher « 12 g de gluten » serait un chiffre inventé. On liste donc les
 * aliments concernés, avec le niveau de certitude de chacun.
 */
export default function Gluten({ entrees }: { entrees: Entree[] }) {
  const parStatut = new Map<Statut, Entree[]>()
  for (const entree of entrees) {
    const statut = statutGluten(entree)
    if (statut === 'inconnu' || statut === 'sans') continue
    parStatut.set(statut, [...(parStatut.get(statut) ?? []), entree])
  }

  const groupes = GROUPES.filter((s) => parStatut.has(s))
  const concernes = [...parStatut.values()].flat().length
  const documentes = entrees.filter((e) => e.gluten && e.gluten !== 'inconnu').length

  if (entrees.length === 0) return null

  return (
    <section className="carte">
      <h2 className="carte-titre">Gluten</h2>

      {groupes.length === 0 ? (
        <p className="note">
          Aucun des {entrees.length} aliment{entrees.length > 1 ? 's' : ''} notés
          n’est signalé comme contenant du gluten. Attention : une absence de
          signalement n’est pas une garantie — voir la note ci-dessous.
        </p>
      ) : (
        <>
          <div className="vedette-ligne">
            <span className="vedette-valeur">{concernes}</span>
            <span className="vedette-unite">
              aliment{concernes > 1 ? 's' : ''} sur {entrees.length}
            </span>
          </div>

          {groupes.map((statut) => (
            <div className="gluten-groupe" key={statut}>
              <p className={`gluten gluten-${statut}`}>{LIBELLES[statut]}</p>
              <div className="lignes">
                {parStatut.get(statut)!.map((entree) => (
                  <div className="ligne" key={entree.id}>
                    <span className="ligne-nom">{entree.nom}</span>
                    <span className="ligne-kcal">
                      {entree.grammes}{' '}
                      {uniteQuantite(estLiquide(entree.nom, undefined, entree.liquide))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      <p className="note">
        Le gluten ne se mesure pas en grammes : aucune base ne le quantifie, et
        les étiquettes ne font que le déclarer.{' '}
        {documentes > 0
          ? `${documentes} aliment${documentes > 1 ? 's' : ''} de la journée ${documentes > 1 ? 'reposent' : 'repose'} sur une étiquette ; `
          : ''}
        le reste est <b>déduit du libellé</b> et peut se tromper dans les deux
        sens. En cas d’intolérance sérieuse, cette liste ne remplace pas la
        lecture des emballages.
      </p>
    </section>
  )
}
