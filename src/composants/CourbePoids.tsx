import { useMemo, useState } from 'react'
import type { Pesee } from '../db'

const L = 340
const H = 170
const MARGE = { haut: 16, bas: 22, gauche: 4, droite: 38 }

const jour = (d: string) => new Date(d + 'T00:00:00').getTime() / 86_400_000
const kg1 = (v: number) => v.toFixed(1).replace('.', ',')

interface Props {
  pesees: Pesee[]
  cible?: number
}

/**
 * Évolution du poids dans le temps.
 *
 * L'abscisse suit les dates réelles et non le rang des pesées : espacer
 * régulièrement des mesures irrégulières donnerait une pente fausse.
 */
export default function CourbePoids({ pesees, cible }: Props) {
  const [choisi, setChoisi] = useState<number | null>(null)

  const vue = useMemo(() => {
    if (pesees.length === 0) return null

    const x0 = jour(pesees[0].date)
    const x1 = jour(pesees[pesees.length - 1].date)
    const etendue = Math.max(x1 - x0, 1)

    const valeurs = pesees.map((p) => p.kg)
    if (cible !== undefined) valeurs.push(cible)
    const bas = Math.min(...valeurs)
    const haut = Math.max(...valeurs)
    // Une marge minimale évite qu'une variation de 200 g remplisse tout le
    // cadre et se lise comme un effondrement.
    const marge = Math.max((haut - bas) * 0.15, 0.5)
    const yBas = bas - marge
    const yHaut = haut + marge

    const traceX = (d: string) =>
      MARGE.gauche + ((jour(d) - x0) / etendue) * (L - MARGE.gauche - MARGE.droite)
    const traceY = (kg: number) =>
      MARGE.haut + ((yHaut - kg) / (yHaut - yBas)) * (H - MARGE.haut - MARGE.bas)

    const points = pesees.map((p) => ({ ...p, x: traceX(p.date), y: traceY(p.kg) }))
    const ligne = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
    const sol = H - MARGE.bas
    const aire = `${ligne} L${points[points.length - 1].x} ${sol} L${points[0].x} ${sol} Z`

    const yCible = cible !== undefined ? traceY(cible) : null

    return {
      points,
      ligne,
      aire,
      sol,
      yCible,
      graduations: [yHaut - marge / 2, (yHaut + yBas) / 2, yBas + marge / 2]
        .map((v) => ({ v, y: traceY(v) }))
        // Une graduation trop proche de la ligne de cible verrait son
        // étiquette chevaucher le mot « cible ».
        .filter(({ y }) => yCible === null || Math.abs(y - yCible) > 11),
    }
  }, [pesees, cible])

  if (!vue) return null

  const dernier = vue.points[vue.points.length - 1]
  const actif = choisi !== null ? vue.points[choisi] : null

  /** Sélectionne la pesée la plus proche de l'abscisse touchée. */
  function viser(cible: SVGSVGElement, clientX: number) {
    const cadre = cible.getBoundingClientRect()
    const x = ((clientX - cadre.left) / cadre.width) * L
    let proche = 0
    for (let i = 1; i < vue!.points.length; i++) {
      if (Math.abs(vue!.points[i].x - x) < Math.abs(vue!.points[proche].x - x)) proche = i
    }
    setChoisi(proche)
  }

  // Les deux familles d'événements sont branchées : selon les navigateurs, un
  // simple appui n'émet pas toujours de `pointerdown`, et la courbe resterait
  // muette au doigt alors que la légende invite à la toucher.
  const surPointeur = (e: React.PointerEvent<SVGSVGElement>) =>
    viser(e.currentTarget, e.clientX)
  const surToucher = (e: React.TouchEvent<SVGSVGElement>) =>
    viser(e.currentTarget, e.touches[0].clientX)

  return (
    <figure className="courbe">
      <svg
        viewBox={`0 0 ${L} ${H}`}
        role="img"
        aria-label={`Évolution du poids, de ${kg1(vue.points[0].kg)} à ${kg1(dernier.kg)} kilogrammes`}
        onPointerDown={surPointeur}
        onPointerMove={(e) => e.buttons > 0 && surPointeur(e)}
        // Au doigt, `pointerleave` survient dès que l'on relâche : effacer
        // ici ferait disparaître la valeur à l'instant même où on la lit.
        // Seule la souris, qui peut vraiment quitter la zone, remet à zéro.
        onPointerLeave={(e) => e.pointerType === 'mouse' && setChoisi(null)}
        onTouchStart={surToucher}
        onTouchMove={surToucher}
      >
        {vue.graduations.map(({ v, y }) => (
          <g key={v}>
            <line className="courbe-grille" x1={MARGE.gauche} x2={L - MARGE.droite} y1={y} y2={y} />
            <text className="courbe-graduation" x={L - MARGE.droite + 5} y={y + 3.5}>
              {kg1(v)}
            </text>
          </g>
        ))}

        {vue.yCible !== null && (
          <>
            <line
              className="courbe-cible"
              x1={MARGE.gauche}
              x2={L - MARGE.droite}
              y1={vue.yCible}
              y2={vue.yCible}
            />
            <text className="courbe-graduation cible" x={L - MARGE.droite + 5} y={vue.yCible + 3.5}>
              cible
            </text>
          </>
        )}

        <path className="courbe-aire" d={vue.aire} />
        <path className="courbe-ligne" d={vue.ligne} />

        {actif && (
          <>
            <line className="courbe-viseur" x1={actif.x} x2={actif.x} y1={MARGE.haut} y2={vue.sol} />
            <circle className="courbe-point" cx={actif.x} cy={actif.y} r={5} />
          </>
        )}

        {/* Seul le dernier point est étiqueté : une valeur sur chaque point
            rendrait la courbe illisible sans rien apprendre de plus. */}
        <circle className="courbe-point courbe-fin" cx={dernier.x} cy={dernier.y} r={4.5} />
      </svg>

      <figcaption className="courbe-legende">
        {actif ? (
          <>
            <b>{kg1(actif.kg)} kg</b>{' '}
            {new Date(actif.date + 'T00:00:00').toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
            })}
          </>
        ) : (
          <>
            {pesees.length} pesée{pesees.length > 1 ? 's' : ''} — touche la courbe pour
            lire une valeur
          </>
        )}
      </figcaption>
    </figure>
  )
}
