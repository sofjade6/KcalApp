interface Props {
  nom: string
  valeur: number
  objectif: number
  unite: string
  /** Variable CSS portant la teinte, ex. `var(--prot)`. */
  teinte: string
  /** Part de l'énergie du jour apportée par ce macronutriment, en pourcentage. */
  pourcentage?: number
}

/**
 * Un ratio face à une limite. L'étiquette chiffrée reste toujours affichée :
 * elle porte l'identité de la mesure quand la teinte seule ne suffit pas
 * (contraste faible, daltonisme, impression).
 */
export default function Jauge({ nom, valeur, objectif, unite, teinte, pourcentage }: Props) {
  const remplissage = objectif > 0 ? valeur / objectif : 0
  const arrondie = Math.round(valeur)

  return (
    <div className="jauge" style={{ ['--teinte' as string]: teinte }}>
      <div className="jauge-tete">
        <span className="jauge-nom">
          <span className="jauge-pastille" aria-hidden="true" />
          {nom}
          {/* La part d'énergie se place du côté du nom, pas de la valeur :
              accolée aux grammes, elle se lisait comme eux — « 6 % 4 / 65 g »
              donne deux nombres dans la même police, à un espace d'écart. */}
          {pourcentage !== undefined && (
            <span className="jauge-part">{pourcentage} % de l’énergie</span>
          )}
        </span>
        <span className="jauge-valeur">
          <b>{arrondie}</b> / {objectif} {unite}
        </span>
      </div>
      <div
        className="jauge-piste"
        role="meter"
        aria-label={nom}
        aria-valuenow={arrondie}
        aria-valuemin={0}
        aria-valuemax={objectif}
        aria-valuetext={`${arrondie} ${unite} sur ${objectif}`}
      >
        {/* La barre est bornée à 100 % ; le dépassement reste lisible
            dans l'étiquette, qui affiche la valeur réelle. */}
        <div
          className="jauge-remplissage"
          style={{ width: `${Math.min(remplissage, 1) * 100}%` }}
        />
      </div>
    </div>
  )
}
