import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db, {
  REPAS,
  SECONDAIRES,
  lireProfil,
  PROFIL_DEFAUT,
  type Activite,
  type Entree,
} from '../db'
import { cleDuJour, decalerJour, estAujourdhui, libelleJour, versDate } from '../lib/dates'
import { cumuler, kcalPortion, repartition, totalKcal } from '../lib/nutrition'
import { libellePortion } from '../lib/portions'
import Jauge from '../composants/Jauge'
import Eau from '../composants/Eau'
import Activites from '../composants/Activites'
import Rappels from '../composants/Rappels'

export default function Jour() {
  const { date } = useParams()
  const jour = date ?? cleDuJour()
  const aujourdhui = estAujourdhui(jour)

  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  const entrees = useLiveQuery(
    () => db.entrees.where('date').equals(jour).toArray(),
    [jour],
    [] as Entree[],
  )
  const activites = useLiveQuery(
    () => db.activites.where('date').equals(jour).toArray(),
    [jour],
    [] as Activite[],
  )

  const macros = cumuler(entrees)
  const kcalJour = totalKcal(entrees)
  const parts = repartition(macros)

  // L'activité physique agrandit le budget du jour plutôt que de retrancher
  // des calories consommées : ce qui a été mangé reste ce qui a été mangé.
  const brulees = activites.reduce((t, a) => t + a.kcal, 0)
  const budget = profil.objectifKcal + brulees
  const reste = budget - kcalJour
  const depasse = reste < 0

  const secondaires = SECONDAIRES.filter(({ cle }) => macros[cle] !== undefined)

  return (
    <div className="vue">
      <header className="vue-entete">
        <nav className="jour-nav" aria-label="Changer de jour">
          <Link
            className="jour-fleche"
            to={`/jour/${decalerJour(jour, -1)}`}
            aria-label="Jour précédent"
          >
            ‹
          </Link>
          <span className="vue-date">
            {libelleJour(jour)}
            {!aujourdhui && (
              <small>
                {versDate(jour).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'short',
                })}
              </small>
            )}
          </span>
          <Link
            className="jour-fleche"
            to={`/jour/${decalerJour(jour, 1)}`}
            aria-label="Jour suivant"
            // Rien à noter dans le futur : la flèche s'arrête à aujourd'hui.
            aria-disabled={aujourdhui}
            onClick={(e) => aujourdhui && e.preventDefault()}
          >
            ›
          </Link>
        </nav>
        <h1 className="vue-titre">
          {aujourdhui ? 'Aujourd’hui' : libelleJour(jour)}
          {!aujourdhui && (
            <Link className="jour-retour" to="/">
              revenir à aujourd’hui
            </Link>
          )}
        </h1>
      </header>

      <Rappels jour={jour} />

      <section className="carte">
        <div className="vedette">
          <div className="vedette-ligne">
            <span className="vedette-valeur">{kcalJour}</span>
            <span className="vedette-unite">kcal sur {budget}</span>
          </div>
          <p className={`vedette-appui${depasse ? ' depasse' : ''}`}>
            {depasse ? (
              <>
                <b>{-reste} kcal</b> au-dessus de l’objectif
              </>
            ) : (
              <>
                Il reste <b>{reste} kcal</b>
              </>
            )}
            {brulees > 0 && (
              <span className="vedette-bonus">
                {' '}
                dont {brulees} kcal gagnées par l’activité
              </span>
            )}
          </p>
        </div>

        <div className="jauges">
          <Jauge
            nom="Calories"
            valeur={kcalJour}
            objectif={budget}
            unite="kcal"
            teinte="var(--jauge-total)"
          />
          <Jauge
            nom="Protéines"
            valeur={macros.prot}
            objectif={profil.objectifProt}
            unite="g"
            teinte="var(--prot)"
            pourcentage={parts?.prot}
          />
          <Jauge
            nom="Lipides"
            valeur={macros.lip}
            objectif={profil.objectifLip}
            unite="g"
            teinte="var(--lip)"
            pourcentage={parts?.lip}
          />
          <Jauge
            nom="Glucides"
            valeur={macros.gluc}
            objectif={profil.objectifGluc}
            unite="g"
            teinte="var(--gluc)"
            pourcentage={parts?.gluc}
          />
        </div>
      </section>

      {secondaires.length > 0 && (
        <section className="carte">
          <h2 className="carte-titre">Aussi dans la journée</h2>
          <dl>
            {secondaires.map(({ cle, nom, unite }) => (
              <div className="etat" key={cle}>
                <dt>{nom}</dt>
                <dd>
                  {macros[cle]!.toFixed(cle === 'sel' ? 2 : 1).replace('.', ',')} {unite}
                </dd>
              </div>
            ))}
          </dl>
          <p className="note">
            Calculé sur les aliments qui renseignent ces valeurs — un plat saisi
            à la main n’y contribue pas.
          </p>
        </section>
      )}

      {REPAS.map(({ cle, nom }) => {
        const duRepas = entrees.filter((e) => e.repas === cle)
        const kcalRepas = totalKcal(duRepas)

        return (
          <section className="repas" key={cle}>
            <div className="repas-tete">
              <h2 className="repas-nom">{nom}</h2>
              <span className="repas-kcal">{kcalRepas} kcal</span>
            </div>

            {duRepas.length === 0 ? (
              <Link to={`/ajouter/${cle}?jour=${jour}`} className="repas-vide">
                Rien de noté — ajouter un aliment
              </Link>
            ) : (
              <div className="lignes">
                {duRepas.map((entree) => (
                  <Link className="ligne" key={entree.id} to={`/entree/${entree.id}?jour=${jour}`}>
                    <span className="ligne-nom">
                      {entree.nom}
                      <span className="ligne-detail">
                        {entree.portion
                          ? `${libellePortion(entree.portion, entree.portion.nombre)} · ${entree.grammes} g`
                          : `${entree.grammes} g`}
                      </span>
                    </span>
                    <span className="ligne-kcal">{kcalPortion(entree)} kcal</span>
                  </Link>
                ))}
              </div>
            )}

            <div className="repas-actions">
              {duRepas.length > 0 && (
                <Link to={`/ajouter/${cle}?jour=${jour}`}>+ Ajouter</Link>
              )}
              <Link to={`/copier/${cle}?jour=${jour}`}>Copier depuis un autre jour</Link>
              {duRepas.length >= 2 && (
                <Link to={`/recette/${cle}?jour=${jour}`}>Enregistrer comme recette</Link>
              )}
            </div>
          </section>
        )
      })}

      <Eau jour={jour} />
      <Activites jour={jour} activites={activites} />

      <div className="actions">
        <Link className="bouton discret" to={`/copier?jour=${jour}`}>
          Copier une journée entière
        </Link>
      </div>
    </div>
  )
}
