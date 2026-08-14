import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Aujourdhui from './ecrans/Aujourdhui'
import Reglages from './ecrans/Reglages'

const ONGLETS = [
  {
    chemin: '/',
    nom: 'Aujourd’hui',
    icone: (
      <>
        <path d="M4 6.5h16" />
        <path d="M4 12h16" />
        <path d="M4 17.5h10" />
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
          <Route path="/" element={<Aujourdhui />} />
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
