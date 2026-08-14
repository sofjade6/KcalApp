/**
 * Captures de contrôle en gabarit iPhone, thèmes clair et sombre.
 *
 * Vérifie aussi ce qu'une capture ne montre pas : débordement horizontal et
 * erreurs console. Ne remplace pas un test sur l'appareil — Chromium n'émule
 * ni WebKit ni les env(safe-area-inset-*), qui valent 0 ici alors qu'ils font
 * une soixantaine de points sur un iPhone en mode standalone.
 *
 * Prérequis : sudo apt-get install -y libnss3 libnspr4 libasound2t64
 *
 * Usage :
 *   npm run build && npm run preview -- --port 4173
 *   node scripts/captures.mjs [url] [dossier]
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const SORTIE = process.argv[3] ?? 'captures'

/** Aliments de démonstration, en valeurs CIQUAL pour 100 g. */
const DEMO = [
  ['Pain complet, grillé', 80, 271, 10.4, 3.4, 44.4],
  ['Yaourt nature au lait entier', 125, 71, 3.7, 3.5, 5.1],
  ['Poulet, blanc, rôti', 150, 148, 30.2, 2.8, 0],
  ['Pâtes sèches, au blé complet, cuites', 220, 128, 4.55, 0.9, 23.4],
  ['Amandes, grillées', 30, 634, 22.5, 55.2, 5.2],
]

const ECRANS = [
  { nom: 'aujourdhui', chemin: '/', attendre: '.jauge-remplissage' },
  { nom: 'profil', chemin: '/profil', attendre: '.pesee input' },
  { nom: 'recherche', chemin: '/ajouter', attendre: '.recherche input' },
  { nom: 'saisir', chemin: '/saisir', attendre: '.champ-large input' },
  { nom: 'reglages', chemin: '/reglages', attendre: '.champ input' },
]

async function semer(page) {
  await page.evaluate(async (aliments) => {
    const d = new Date()
    const jour = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('kcalapp')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const tx = db.transaction('entrees', 'readwrite')
    for (const [nom, grammes, kcal, prot, lip, gluc] of aliments) {
      tx.objectStore('entrees').add({
        date: jour, nom, grammes, kcal, prot, lip, gluc,
        source: 'ciqual', creeLe: Date.now(),
      })
    }
    await new Promise((res) => (tx.oncomplete = res))
  }, DEMO)
}

await mkdir(SORTIE, { recursive: true })
let souci = 0

for (const theme of ['light', 'dark']) {
  const navigateur = await chromium.launch()
  const contexte = await navigateur.newContext({
    viewport: { width: 393, height: 852 }, // iPhone 15 Pro, en points CSS
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: theme,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
  })
  const page = await contexte.newPage()
  const erreurs = []
  page.on('pageerror', (e) => erreurs.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && erreurs.push(m.text()))

  await page.goto(BASE, { waitUntil: 'networkidle' })
  await semer(page)

  for (const { nom, chemin, attendre } of ECRANS) {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle' })
    await page.waitForSelector(attendre)
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SORTIE}/${nom}-${theme}.png` })

    const debord = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    if (debord > 0) {
      console.log(`  ✗ ${nom}-${theme} : débordement horizontal de ${debord}px`)
      souci++
    }
  }

  if (erreurs.length) {
    console.log(`  ✗ ${theme} : ${erreurs.join(' | ')}`)
    souci++
  }
  await navigateur.close()
}

console.log(
  souci === 0
    ? `✓ ${ECRANS.length * 2} captures dans ${SORTIE}/, aucun débordement ni erreur console`
    : `${souci} problème(s) — voir ci-dessus`,
)
process.exit(souci === 0 ? 0 : 1)
