# KcalApp

Suivi calorique et macros, sous forme de **PWA installable sur iPhone**. Toutes les
données restent sur le téléphone (IndexedDB) : aucun compte, aucun serveur, aucun
envoi de données personnelles.

## Pourquoi une PWA et pas une app native

Le développement se fait sous WSL2/Linux, sans Mac ni compte Apple Developer.
Une app native iOS imposerait les deux. Une PWA ajoutée à l'écran d'accueil
s'installe sans App Store, fonctionne hors ligne, et accède à la caméra pour le
scan de codes-barres. Voir l'analyse complète pour les limites acceptées.

## Prérequis

Node est installé via nvm (non disponible dans le PATH par défaut sous WSL) :

```bash
source ~/.nvm/nvm.sh   # à faire dans chaque nouveau shell
node --version         # v24.19.0
```

## Démarrage

```bash
npm install
python3 scripts/build_ciqual.py   # génère public/data/ciqual.json (~350 Ko)
python3 scripts/build_icons.py    # génère les icônes PWA + apple-touch-icon
npm run dev
```

Les deux scripts Python n'ont aucune dépendance et sont idempotents : leurs
sorties (`public/data`, `public/icons`) sont régénérables et n'ont pas à être
modifiées à la main.

## Structure

```
scripts/          génération des données et des icônes (Python, sans dépendance)
src/db.ts         schéma Dexie : profil, entrées, aliments, pesées
src/lib/          dates (clé de jour locale) et calculs nutritionnels
src/composants/   briques d'interface réutilisables
src/ecrans/       un fichier par onglet
```

La couleur est réservée aux données : les trois macros portent les seules
teintes de l'app, le reste du chrome est en encre neutre. Les jauges gardent
toujours leur étiquette chiffrée visible — c'est elle qui porte l'information
quand la teinte ne suffit pas (daltonisme, faible contraste, impression).

## Données nutritionnelles

| Source | Usage | Licence |
| --- | --- | --- |
| [CIQUAL 2020](https://ciqual.anses.fr) (ANSES) | Recherche texte d'aliments bruts et cuisinés — 2 298 aliments embarqués | Licence Ouverte (Etalab) |
| [OpenFoodFacts](https://world.openfoodfacts.org) | Recherche par code-barres des produits industriels | ODbL |

`scripts/build_ciqual.py` télécharge l'archive XML officielle et n'en garde que
les 8 nutriments utiles. Le XML publié par l'ANSES n'est pas bien formé
(caractères `<` et `&` non échappés dans les libellés) : le script le nettoie
avant parsing.

## Tester sur l'iPhone

L'accès caméra exige un contexte sécurisé : `http://<ip-locale>:5173` **ne
donnera pas accès à la caméra**, seul HTTPS (ou `localhost`) le permet. Sous
WSL2 s'ajoute le NAT, qui rend le serveur invisible depuis le réseau local.

La voie la plus courte est un tunnel HTTPS, qui règle les deux problèmes d'un
coup :

```bash
npm run dev                              # écoute sur 0.0.0.0 (server.host)
cloudflared tunnel --url http://localhost:5173
```

Ouvrir l'URL `https://…trycloudflare.com` sur l'iPhone, puis **Partager →
Sur l'écran d'accueil** pour l'installer en mode standalone.

## Captures automatiques (optionnel)

Playwright est installé mais son Chromium ne démarre pas encore : il manque des
bibliothèques système. Une fois cette commande passée, les captures d'écran de
contrôle deviennent possibles depuis le terminal :

```bash
sudo npx playwright install-deps chromium
```
