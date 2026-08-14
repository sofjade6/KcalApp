import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { lireProfil, PROFIL_DEFAUT, type Activite, type Entree, type Pesee } from '../db'
import { decalerJour, cleDuJour, versDate } from '../lib/dates'
import { analyserSemaine, coherence, projeter } from '../lib/bilan'

const kg1 = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1).replace('.', ',')}`
const JOURS_COURTS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']

export default function Bilan() {
  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  const entrees = useLiveQuery(() => db.entrees.toArray(), [], [] as Entree[])
  const activites = useLiveQuery(() => db.activites.toArray(), [], [] as Activite[])
  const pesees = useLiveQuery(() => db.pesees.orderBy('date').toArray(), [], [] as Pesee[])

  const semaine = analyserSemaine(entrees, activites, profil.objectifKcal)
  const precedente = analyserSemaine(
    entrees,
    activites,
    profil.objectifKcal,
    decalerJour(cleDuJour(), -7),
  )

  const projection = projeter(pesees, profil.poidsCible)
  const verite =
    pesees.length > 0
      ? coherence(profil, pesees[pesees.length - 1].kg, semaine.moyenne, pesees)
      : null

  const plafond = Math.max(...semaine.jours.map((j) => Math.max(j.kcal, j.budget)), 1)

  return (
    <div className="vue">
      <header className="vue-entete">
        <span className="vue-date">Sept derniers jours</span>
        <h1 className="vue-titre">Bilan</h1>
      </header>

      {semaine.notes === 0 ? (
        <p className="repas-vide">
          Rien de noté cette semaine. Le bilan a besoin de quelques journées
          renseignées pour dire quoi que ce soit.
        </p>
      ) : (
        <>
          <section className="carte">
            <h2 className="carte-titre">Moyenne quotidienne</h2>
            <div className="vedette-ligne">
              <span className="vedette-valeur">{semaine.moyenne}</span>
              <span className="vedette-unite">kcal sur {profil.objectifKcal}</span>
            </div>
            <p className="vedette-appui">
              {semaine.ecartMoyen === 0 ? (
                <>Pile sur l’objectif.</>
              ) : semaine.ecartMoyen > 0 ? (
                <>
                  <b>{semaine.ecartMoyen} kcal</b> au-dessus par jour en moyenne
                </>
              ) : (
                <>
                  <b>{-semaine.ecartMoyen} kcal</b> sous l’objectif par jour en moyenne
                </>
              )}
              {precedente.notes > 0 && (
                <span className="vedette-bonus">
                  {' '}
                  — semaine précédente : {precedente.moyenne} kcal
                </span>
              )}
            </p>

            {/* Une barre par jour, la ligne pointillée marquant le budget.
                Les jours non renseignés restent vides plutôt que remplis à zéro. */}
            <div className="barres">
              {semaine.jours.map((j) => {
                const hauteur = (j.kcal / plafond) * 100
                const seuil = (j.budget / plafond) * 100
                return (
                  <div className="barre" key={j.date}>
                    <div className="barre-piste">
                      <div
                        className={`barre-valeur${j.ecart > 0 ? ' depasse' : ''}`}
                        style={{ height: `${hauteur}%` }}
                      />
                      <div className="barre-seuil" style={{ bottom: `${seuil}%` }} />
                    </div>
                    <span className="barre-jour">
                      {JOURS_COURTS[versDate(j.date).getDay()]}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="note">
              {semaine.notes} jour{semaine.notes > 1 ? 's' : ''} renseigné
              {semaine.notes > 1 ? 's' : ''} sur 7. Les jours vides sont exclus de
              la moyenne : les compter à zéro la ferait plonger sans raison.
            </p>
          </section>

          {semaine.depassements.length > 0 && (
            <section className="carte">
              <h2 className="carte-titre">Jours au-dessus de l’objectif</h2>
              <div className="lignes">
                {semaine.depassements.map((j) => (
                  <div className="ligne" key={j.date}>
                    <Link className="ligne-nom" to={`/jour/${j.date}`}>
                      {versDate(j.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                      })}
                      <span className="ligne-detail">{j.kcal} kcal notées</span>
                    </Link>
                    <span className="ligne-kcal">+{j.ecart}</span>
                  </div>
                ))}
              </div>
              <p className="note">
                Un écart isolé ne pèse presque rien sur la semaine. C’est leur
                répétition qui compte, et c’est là qu’il est utile de regarder ce
                qui revient.
              </p>
            </section>
          )}

          {projection && (
            <section className="carte">
              <h2 className="carte-titre">À ce rythme</h2>
              {/* Un mois n'est pas un chiffre : le corps du hero le ferait
                  passer à la ligne sans rien gagner en lisibilité. */}
              <p className="vedette-texte">
                {projection.date.toLocaleDateString('fr-FR', {
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <p className="vedette-appui">
                Cible de {profil.poidsCible} kg atteinte dans{' '}
                <b>{Math.round(projection.semaines)} semaines</b>, au rythme
                observé de {kg1(projection.pente)} kg par semaine.
              </p>
              <p className="note">
                Extrapolation d’une tendance sur quatre semaines. Elle suppose que
                rien ne change — ce qui n’arrive jamais tout à fait, et le rythme
                ralentit d’ordinaire à mesure que le poids baisse.
              </p>
            </section>
          )}

          {verite && (
            <section className="carte">
              <h2 className="carte-titre">Ton objectif tient-il la route ?</h2>
              <dl>
                <div className="etat">
                  <dt>Attendu d’après tes saisies</dt>
                  <dd>{kg1(verite.attendue)} kg/sem.</dd>
                </div>
                <div className="etat">
                  <dt>Observé sur la balance</dt>
                  <dd>{kg1(verite.observee)} kg/sem.</dd>
                </div>
              </dl>
              <p className="note">
                {Math.abs(verite.ecart) < 0.15 ? (
                  <>
                    Les deux concordent : la dépense estimée pour toi est juste, et
                    ton objectif calorique est bien calibré.
                  </>
                ) : (
                  <>
                    L’écart suggère une dépense réelle plus proche de{' '}
                    <b>{verite.depenseReelle} kcal par jour</b> que de celle
                    calculée. Les équations donnent une moyenne de population ;
                    l’écart individuel atteint couramment 200 à 300 kcal. Si
                    l’écart persiste sur un mois, ajuste ton objectif dans
                    Réglages.
                  </>
                )}
              </p>
            </section>
          )}
        </>
      )}

      <div className="actions">
        <Link className="bouton discret" to="/profil">
          Voir la courbe de poids
        </Link>
      </div>
    </div>
  )
}
