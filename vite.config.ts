import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Horodatage de la build, affiché dans Réglages : sans lui, impossible de
// savoir si l'app installée tourne encore sur une version précédente.
const BUILD = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // La base CIQUAL doit etre disponible hors ligne des la premiere ouverture.
      includeAssets: ['data/ciqual.json'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
      manifest: {
        name: 'KcalApp',
        short_name: 'KcalApp',
        description: 'Suivi calorique et macros, 100 % local',
        lang: 'fr',
        start_url: '/',
        // 'standalone' est ce qui retire la barre Safari une fois l'app
        // ajoutee a l'ecran d'accueil de l'iPhone.
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0d1013',
        theme_color: '#0d1013',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // Sous WSL2, Vite doit ecouter sur toutes les interfaces, et accepter le
  // domaine du tunnel HTTPS : sans `allowedHosts`, il repond « Blocked request »
  // a toute requete venant de trycloudflare.com.
  server: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
  preview: {
    host: true,
    allowedHosts: ['.trycloudflare.com'],
  },
})
