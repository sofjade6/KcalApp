import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import db, { lireProfil, majProfil, enregistrerPesee, PROFIL_DEFAUT, type Pesee, type Sexe, type But, type NiveauActivite } from '../db'
import { cleDuJour } from '../lib/dates'
import {
  ACTIVITES,
  BUTS,
  RYTHMES,
  RYTHME_DEFAUT,
  age,
  besoins,
  categorieImc,
  ecartQuotidien,
  imc,
  poidsNormal,
  profilComplet,
} from '../lib/corps'
import { encouragement } from '../lib/encouragement'
import CourbePoids from '../composants/CourbePoids'

const kg1 = (v: number) => v.toFixed(1).replace('.', ',')

export default function Profil() {
  const profil = useLiveQuery(lireProfil, [], PROFIL_DEFAUT)
  const pesees = useLiveQuery(
    () => db.pesees.orderBy('date').toArray(),
    [],
    [] as Pesee[],
  )

  const jour = cleDuJour()
  const peseeDuJour = pesees.find((p) => p.date === jour)
  const dernier = pesees[pesees.length - 1]

  const [saisie, setSaisie] = useState('')
  useEffect(() => {
    setSaisie(peseeDuJour ? String(peseeDuJour.kg) : '')
  }, [peseeDuJour])

  const poids = Number(saisie.replace(',', '.'))
  const poidsValide = Number.isFinite(poids) && poids > 20 && poids < 400

  const complet = profilComplet(profil)
  const calcul =
    complet && dernier
      ? besoins(
          dernier.kg,
          profil.tailleCm!,
          age(profil.naissance!),
          profil.sexe!,
          profil.activite!,
          profil.but!,
          profil.poidsCible,
          profil.rythme,
        )
      : null

  // Le recalcul des objectifs est monté au niveau de l'app : voir SyncObjectifs.

  const valeurImc = dernier && profil.tailleCm ? imc(dernier.kg, profil.tailleCm) : null
  const message = encouragement(pesees, profil.but, profil.poidsCible)

  const cibleSousLeNormal =
    profil.poidsCible !== undefined &&
    profil.tailleCm !== undefined &&
    imc(profil.poidsCible, profil.tailleCm) < 18.5

  return (
    <div className="vue">
      <header className="vue-entete">
        <span className="vue-date">Profil</span>
        <h1 className="vue-titre">Poids &amp; objectifs</h1>
      </header>

      <section className="carte">
        <h2 className="carte-titre">Pesée du jour</h2>
        <div className="pesee">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={20}
            max={400}
            placeholder={dernier ? kg1(dernier.kg) : '70,0'}
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
          />
          <span className="pesee-unite">kg</span>
          <button
            className="bouton"
            disabled={!poidsValide || poids === peseeDuJour?.kg}
            onClick={() => enregistrerPesee(jour, Math.round(poids * 10) / 10)}
          >
            {peseeDuJour ? 'Corriger' : 'Enregistrer'}
          </button>
        </div>
        {!dernier && (
          <p className="note">
            Pèse-toi de préférence le matin à jeun : c’est le moment le plus
            comparable d’une fois sur l’autre.
          </p>
        )}
      </section>

      {message && (
        <section className="carte encouragement">
          <h2 className="carte-titre">{message.titre}</h2>
          <p className="note">{message.texte}</p>
        </section>
      )}

      {pesees.length > 0 && (
        <section className="carte">
          <h2 className="carte-titre">Évolution</h2>
          <CourbePoids pesees={pesees} cible={profil.poidsCible} />
        </section>
      )}

      {valeurImc !== null && (
        <section className="carte">
          <h2 className="carte-titre">Indice de masse corporelle</h2>
          <div className="vedette-ligne">
            <span className="vedette-valeur">{valeurImc.toFixed(1).replace('.', ',')}</span>
            <span className="vedette-unite">{categorieImc(valeurImc).nom.toLowerCase()}</span>
          </div>
          <p className="note">
            Fourchette correspondant à une corpulence normale pour{' '}
            {profil.tailleCm} cm : de{' '}
            <b>{kg1(poidsNormal(profil.tailleCm!)[0])} à {kg1(poidsNormal(profil.tailleCm!)[1])} kg</b>.
            L’IMC ne distingue pas muscle et masse grasse : c’est un repère de
            population, pas un diagnostic.
          </p>
        </section>
      )}

      <section className="carte">
        <h2 className="carte-titre">Mes données</h2>

        <div className="champ">
          <span className="champ-nom">Sexe</span>
          <div className="segments deux">
            {(['femme', 'homme'] as Sexe[]).map((s) => (
              <button
                key={s}
                className="segment"
                aria-pressed={profil.sexe === s}
                onClick={() => majProfil({ sexe: s })}
              >
                {s === 'femme' ? 'Femme' : 'Homme'}
              </button>
            ))}
          </div>
        </div>

        <label className="champ">
          <span className="champ-nom">
            Date de naissance
            {profil.naissance && <small>{age(profil.naissance)} ans</small>}
          </span>
          <input
            type="date"
            value={profil.naissance ?? ''}
            onChange={(e) => majProfil({ naissance: e.target.value || undefined })}
          />
        </label>

        <label className="champ">
          <span className="champ-nom">
            Taille
            <small>en centimètres</small>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            value={profil.tailleCm ?? ''}
            onChange={(e) =>
              majProfil({ tailleCm: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </label>

        <label className="champ">
          <span className="champ-nom">
            Poids visé
            <small>en kilogrammes</small>
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.5"
            value={profil.poidsCible ?? ''}
            onChange={(e) =>
              majProfil({ poidsCible: e.target.value ? Number(e.target.value) : undefined })
            }
          />
        </label>

        {cibleSousLeNormal && (
          <p className="avertissement">
            Ce poids visé correspond à un IMC inférieur à 18,5, sous la
            fourchette de corpulence normale pour ta taille. L’app le suivra
            quand même, mais ça vaut une discussion avec un médecin.
          </p>
        )}
      </section>

      <section className="carte">
        <h2 className="carte-titre">Activité physique</h2>
        <div className="choix">
          {ACTIVITES.map(({ cle, nom, detail }) => (
            <button
              key={cle}
              className="choix-ligne"
              aria-pressed={profil.activite === cle}
              onClick={() => majProfil({ activite: cle as NiveauActivite })}
            >
              <span className="choix-nom">
                {nom}
                <small>{detail}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="carte">
        <h2 className="carte-titre">Objectif</h2>
        <div className="choix">
          {BUTS.map(({ cle, nom }) => (
            <button
              key={cle}
              className="choix-ligne"
              aria-pressed={profil.but === cle}
              onClick={() => majProfil({ but: cle as But })}
            >
              <span className="choix-nom">{nom}</span>
            </button>
          ))}
        </div>

      </section>

      {profil.but && profil.but !== 'maintien' && (
        <section className="carte">
          <h2 className="carte-titre">Rythme visé</h2>
          <div className="choix">
            {RYTHMES.map((valeur) => {
              const sens = BUTS.find((b) => b.cle === profil.but)!.sens
              const ecart = ecartQuotidien(valeur, sens)
              return (
                <button
                  key={valeur}
                  className="choix-ligne"
                  aria-pressed={(profil.rythme ?? RYTHME_DEFAUT) === valeur}
                  onClick={() => majProfil({ rythme: valeur })}
                >
                  <span className="choix-nom">
                    {valeur.toString().replace('.', ',')} kg par semaine
                    <small>
                      {/* Vrai signe moins plutôt qu'un trait d'union. */}
                      {ecart > 0 ? '+' : '−'}
                      {Math.abs(ecart)} kcal par jour
                      {calcul && ` — objectif ${Math.round((calcul.depense + ecart) / 10) * 10} kcal`}
                    </small>
                  </span>
                </button>
              )
            })}
          </div>
          <p className="note">
            Un kilo de masse corporelle vaut environ 7 700 kcal : c’est ce
            rapport qui convertit le rythme en écart quotidien. Au-delà de
            0,5 kg par semaine, le déficit devient difficile à tenir et coûte
            davantage de muscle.
          </p>
        </section>
      )}

      {calcul ? (
        <section className="carte">
          <h2 className="carte-titre">Besoins calculés</h2>

          {/* Les entrées du calcul, en clair : c'est le seul moyen de voir
              d'un coup d'œil qu'une valeur n'est pas celle qu'on croit —
              une pesée ancienne, un sexe non enregistré, un rythme oublié. */}
          <p className="note">
            Calculé pour <b>{profil.sexe === 'femme' ? 'une femme' : 'un homme'}</b>{' '}
            de <b>{age(profil.naissance!)} ans</b>, <b>{profil.tailleCm} cm</b>,{' '}
            <b>{kg1(dernier.kg)} kg</b> (pesée du{' '}
            {new Date(dernier.date + 'T12:00:00').toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
            })}
            ), activité{' '}
            <b>{ACTIVITES.find((a) => a.cle === profil.activite)?.nom.toLowerCase()}</b>,{' '}
            <b>
              {BUTS.find((b) => b.cle === profil.but)?.nom.toLowerCase()}
              {profil.but !== 'maintien' &&
                ` de ${(profil.rythme ?? RYTHME_DEFAUT).toString().replace('.', ',')} kg par semaine`}
            </b>
            .
          </p>

          <dl>
            <div className="etat">
              <dt>Métabolisme de base</dt>
              <dd>{calcul.base} kcal</dd>
            </div>
            <div className="etat">
              <dt>Dépense quotidienne</dt>
              <dd>{calcul.depense} kcal</dd>
            </div>
            <div className="etat">
              <dt>Objectif</dt>
              <dd>{calcul.kcal} kcal</dd>
            </div>
          </dl>
          {calcul.sousLeBase && (
            <p className="avertissement">
              Cet objectif est <b>sous ton métabolisme de base</b> ({calcul.base}{' '}
              kcal), ce que ton corps consomme au repos sans rien faire. À ce
              niveau, le déficit puise autant dans le muscle que dans la
              graisse. L’app applique quand même ce que tu as demandé.
            </p>
          )}
          {profil.objectifsAuto ? (
            <p className="note">
              Équation de Mifflin-St Jeor. Ces valeurs alimentent
              automatiquement l’écran du jour et se recalculent à chaque
              changement de profil.
            </p>
          ) : (
            <>
              {/* L'utilisateur change son profil ici : c'est donc ici qu'il faut
                  dire pourquoi rien ne bouge, et non dans un autre écran. */}
              <p className="avertissement">
                <b>Ce calcul n’est pas appliqué.</b> Tes objectifs sont en
                saisie manuelle : l’écran du jour utilise{' '}
                {profil.objectifKcal} kcal et ne suivra ni ton sexe, ni ton
                poids, ni ton activité tant que tu n’auras pas rétabli le calcul.
              </p>
              <button
                className="bouton"
                onClick={() => majProfil({ objectifsAuto: true })}
              >
                Appliquer ces valeurs
              </button>
            </>
          )}
        </section>
      ) : (
        <p className="note">
          Renseigne sexe, date de naissance, taille, activité, objectif et une
          première pesée pour que l’app calcule tes besoins caloriques.
        </p>
      )}
    </div>
  )
}
