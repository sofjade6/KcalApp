import { Suspense, lazy } from 'react'
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Jour from './ecrans/Jour'
import Copier from './ecrans/Copier'
import Recette from './ecrans/Recette'
import Recettes from './ecrans/Recettes'
import RecetteDepuisJour from './ecrans/RecetteDepuisJour'
import Bilan from './ecrans/Bilan'
import Aliment from './ecrans/Aliment'
import Ajouter from './ecrans/Ajouter'
import Portion from './ecrans/Portion'
import Profil from './ecrans/Profil'
import Saisir from './ecrans/Saisir'

// ZXing pèse près de 500 Ko à lui seul. Le charger à la demande évite de
// l'imposer à l'écran du jour, qui est ouvert bien plus souvent que le scan.
// Le service worker le précache quand même : le scan d'un produit déjà connu
// doit fonctionner hors ligne.
const Scanner = lazy(() => import('./ecrans/Scanner'))
import Reglages from './ecrans/Reglages'

const ONGLETS = [
  {
    chemin: '/',
    nom: 'Journal',
    icone: (
      <>
        <path d="M4 6.5h16" />
        <path d="M4 12h16" />
        <path d="M4 17.5h10" />
      </>
    ),
  },
  {
    chemin: '/recettes',
    nom: 'Recettes',
    icone: (
      <>
        <path d="M4 7h16M4 12h16M4 17h10" />
        <circle cx="17.5" cy="17" r="2.5" />
      </>
    ),
  },
  {
    chemin: '/bilan',
    nom: 'Bilan',
    icone: (
      <>
        <path d="M4 20V13M9.3 20V8M14.7 20v-5M20 20V5" />
      </>
    ),
  },
  {
    chemin: '/profil',
    nom: 'Profil',
    icone: (
      <>
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
      </>
    ),
  },
  {
    chemin: '/reglages',
    nom: 'Réglages',
    icone: (
      // Curseurs de réglage : l'engrenage dessiné en trait fin se lisait
      // comme un soleil à la taille de la barre d'onglets.
      <>
        <path d="M4 8.5h8M17 8.5h3M4 15.5h3M12 15.5h8" />
        <circle cx="14.5" cy="8.5" r="2.2" />
        <circle cx="9.5" cy="15.5" r="2.2" />
      </>
    ),
  },
]

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Jour />} />
          <Route path="/jour/:date" element={<Jour />} />
          <Route path="/copier" element={<Copier />} />
          <Route path="/recettes" element={<Recettes />} />
          {/* Le segment fixe passe avant le paramètre : sans cet ordre,
              « depuis-jour » serait pris pour un code de recette. */}
          <Route path="/recettes/depuis-jour" element={<RecetteDepuisJour />} />
          <Route path="/recettes/:code" element={<Recette />} />
          <Route path="/aliment/:code" element={<Aliment />} />
          <Route path="/ajouter" element={<Ajouter />} />
          <Route path="/saisir" element={<Saisir />} />
          <Route
            path="/scanner"
            element={
              <Suspense fallback={<p className="vue note">Chargement du scanner…</p>}>
                <Scanner />
              </Suspense>
            }
          />
          <Route path="/ajouter/:code" element={<Portion />} />
          <Route path="/entree/:id" element={<Portion />} />
          <Route path="/bilan" element={<Bilan />} />
          <Route path="/profil" element={<Profil />} />
          <Route path="/reglages" element={<Reglages />} />
          {/* Une URL inconnue ramène à l'accueil plutôt qu'à un écran blanc. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <nav className="onglets" aria-label="Navigation principale">
          {ONGLETS.map(({ chemin, nom, icone }) => (
            <NavLink key={chemin} to={chemin} end className="onglet">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {icone}
              </svg>
              {nom}
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  )
}
