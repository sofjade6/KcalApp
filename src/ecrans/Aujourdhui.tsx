import { useLiveQuery } from 'dexie-react-hooks'
import db, { REPAS, lireProfil, PROFIL_DEFAUT, type Entree } from '../db'
import { cleDuJour, dateLongue } from '../lib/dates'
import { cumuler, kcalPortion, totalKcal } from '../lib/nutrition'
import Jauge from '../composants/Jauge'

export default function Aujourdhui() {
  const jour = cleDuJour()

  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  const entrees = useLiveQuery(
    () => db.entrees.where('date').equals(jour).toArray(),
    [jour],
    [] as Entree[],
  )

  const macros = cumuler(entrees)
  const kcalJour = totalKcal(entrees)
  const reste = profil.objectifKcal - kcalJour
  const depasse = reste < 0

  return (
    <div className="vue">
      <header className="vue-entete">
        <span className="vue-date">{dateLongue()}</span>
        <h1 className="vue-titre">Aujourd’hui</h1>
      </header>

      <section className="carte">
        <div className="vedette">
          <div className="vedette-ligne">
            <span className="vedette-valeur">{kcalJour}</span>
            <span className="vedette-unite">kcal sur {profil.objectifKcal}</span>
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
          </p>
        </div>

        <div className="jauges">
          <Jauge
            nom="Calories"
            valeur={kcalJour}
            objectif={profil.objectifKcal}
            unite="kcal"
            teinte="var(--jauge-total)"
          />
          <Jauge
            nom="Protéines"
            valeur={macros.prot}
            objectif={profil.objectifProt}
            unite="g"
            teinte="var(--prot)"
          />
          <Jauge
            nom="Lipides"
            valeur={macros.lip}
            objectif={profil.objectifLip}
            unite="g"
            teinte="var(--lip)"
          />
          <Jauge
            nom="Glucides"
            valeur={macros.gluc}
            objectif={profil.objectifGluc}
            unite="g"
            teinte="var(--gluc)"
          />
        </div>
      </section>

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
              <p className="repas-vide">Rien de noté</p>
            ) : (
              <div className="lignes">
                {duRepas.map((entree) => (
                  <div className="ligne" key={entree.id}>
                    <span className="ligne-nom">
                      {entree.nom}
                      <span className="ligne-detail">{entree.grammes} g</span>
                    </span>
                    <span className="ligne-kcal">{kcalPortion(entree)} kcal</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )
      })}

      <p className="note">
        La recherche d’aliments et le scan de codes-barres arrivent à l’étape
        suivante. En attendant, l’app s’installe déjà sur l’écran d’accueil et
        fonctionne hors ligne.
      </p>
    </div>
  )
}
