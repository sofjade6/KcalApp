import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { REPAS, lireProfil, PROFIL_DEFAUT, type Entree } from '../db'
import { cleDuJour, dateLongue } from '../lib/dates'
import { cumuler, kcalPortion, totalKcal } from '../lib/nutrition'
import { libellePortion } from '../lib/portions'
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
              <Link to={`/ajouter/${cle}`} className="repas-vide">
                Rien de noté — ajouter un aliment
              </Link>
            ) : (
              <div className="lignes">
                {duRepas.map((entree) => (
                  <Link
                    className="ligne"
                    key={entree.id}
                    to={`/entree/${entree.id}`}
                  >
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

            {duRepas.length > 0 && (
              <Link to={`/ajouter/${cle}`} className="ajout-repas">
                + Ajouter
              </Link>
            )}
          </section>
        )
      })}

      <p className="note">
        Aliments issus de la table CIQUAL de l’ANSES. Le scan de codes-barres,
        pour les produits de marque, arrive à l’étape suivante.
      </p>
    </div>
  )
}
