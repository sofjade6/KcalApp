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

## Recherche d'aliments

La table CIQUAL emploie un vocabulaire administratif éloigné du langage courant.
La recherche compense sur trois plans, sans dictionnaire de synonymes :

- **accents et ligatures** — `oeuf` trouve `Œuf, cru`, `pates` trouve `Pâtes` ;
- **flexions** — jusqu'à deux caractères rognés en fin de terme, donc
  `pâtes complètes` trouve `Pâtes sèches, au blé complet` ;
- **repli** — si aucun aliment ne contient tous les termes, les plus proches
  sont affichés plutôt qu'une page vide, avec une mention explicite. C'est le
  cas de `crème fraîche`, absente de la table, qui s'y nomme
  `Crème de lait, 30% MG, épaisse`.

## Portions usuelles

La quantité se saisit en grammes ou en unités courantes — « 2 œufs » plutôt
que « 100 g ». Les portions sont rattachées aux aliments par mot-clé sur leur
libellé, dans `src/lib/portions.ts` ; pour un produit scanné, la portion
inscrite sur l'emballage (OpenFoodFacts) prime sur la moyenne générique.

Ce sont des moyennes indicatives : un œuf calibre L et un calibre S ne pèsent
pas la même chose. Les grammes restent disponibles à tout moment, et
l'entrée conserve l'unité choisie pour réafficher « 2 œufs » dans le journal.

L'appariement par mot-clé se trompe facilement, d'où un garde-fou : un libellé
contenant un mot de préparation (`compote`, `tarte`, `sauce`, `soupe`…) ne
reçoit pas la portion de l'ingrédient qu'il cite. Sans lui, « compote de
pomme » proposait « 1 pomme, 150 g ». Toute nouvelle règle doit être vérifiée
contre les libellés CIQUAL réels, pas seulement contre l'exemple qui l'a
motivée.

## Sauvegarde

Les données ne vivent que sur l'appareil : perdre le téléphone, c'est perdre
l'historique. L'export produit un fichier JSON unique contenant profil,
journal, aliments mémorisés et pesées.

Sur iPhone, l'export passe par le partage natif plutôt que par un
téléchargement : la feuille de partage permet de ranger le fichier dans
Fichiers ou iCloud Drive. Le téléchargement sert de repli ailleurs.

La restauration **remplace** tout le contenu de l'appareil, dans une seule
transaction — une restauration interrompue à mi-chemin laisserait un journal
moitié ancien moitié nouveau. Le fichier est validé avant d'écraser quoi que ce
soit, et l'écran affiche ce qu'il contient pour confirmation.

Réglages rappelle la date de la dernière sauvegarde et relance au-delà de
trente jours.

## Profil, IMC et objectifs

L'onglet Profil réunit les pesées, la courbe d'évolution, l'IMC et les données
corporelles. Les objectifs caloriques en découlent (Mifflin-St Jeor × facteur
d'activité, ajusté selon le but) et alimentent l'écran du jour.

Deux garde-fous :

- **L'apport visé n'est jamais placé sous le métabolisme de base.** En dessous,
  le corps ne couvre plus ses fonctions vitales au repos et puise autant dans
  le muscle que dans la graisse. L'écran le signale quand la borne s'applique.
- **Un poids visé correspondant à un IMC inférieur à 18,5** est suivi malgré
  tout, mais signalé.

Modifier un objectif à la main dans Réglages coupe le calcul automatique, pour
que le profil ne vienne pas écraser une valeur choisie. Un bouton permet d'y
revenir.

Les messages d'encouragement décrivent la tendance sans la juger : sur sept
jours, l'eau, le sel, le sommeil et le transit pèsent facilement un kilo, et
une variation quotidienne ne doit pas se lire comme un échec. Sans objectif
déclaré, aucune direction n'est présentée comme « la bonne ».

## Scan de codes-barres

Les produits de marque ne sont pas dans CIQUAL : ils passent par le scan.
`BarcodeDetector` n'étant pas supporté par Safari, le décodage se fait avec
ZXing en WebAssembly, restreint aux formats alimentaires (EAN-13, EAN-8,
UPC-A, UPC-E) pour gagner en vitesse et en fiabilité.

Le module du scanner est chargé à la demande : ZXing pèse près de 500 Ko, que
l'écran du jour n'a pas à supporter. Le service worker le précache malgré tout,
pour que le scan d'un produit déjà connu fonctionne hors ligne.

Après lecture du code, la résolution suit cet ordre :

1. **cache local** — un produit déjà scanné est resservi immédiatement, sans
   réseau ;
2. **OpenFoodFacts** — le produit est enregistré sur l'appareil au passage ;
3. **saisie manuelle**, avec le code-barres en paramètre : le produit est alors
   mémorisé sous son vrai code et reconnu à tous les scans suivants.

Le troisième cas couvre aussi bien un code absent d'OpenFoodFacts qu'une fiche
existante mais dépourvue de valeurs nutritionnelles.

Pour tout ce qu'aucune base ne connaît — plat de traiteur, recette maison — un
aliment se saisit à la main : nom et valeurs pour 100 g. Il est mémorisé sur l'appareil, reproposé en
tête des recherches suivantes, et listé d'emblée quand la recherche est vide.

La saisie contrôle la cohérence entre les macros et les calories déclarées
(facteurs Atwater). Un écart important signale l'erreur la plus fréquente :
avoir recopié la colonne « par portion » de l'étiquette au lieu de la colonne
« pour 100 g ». L'avertissement ne bloque pas l'enregistrement.

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

## Déploiement

L'app est hébergée sur Cloudflare Pages, connecté à ce dépôt : **tout push sur
`main` déclenche une mise en ligne**. Réglages du projet Pages :

| Réglage | Valeur |
| --- | --- |
| Commande de build | `npm run build` |
| Dossier de sortie | `dist` |
| Version de Node | lue dans `.node-version` |

Le serveur ne sert que des fichiers statiques : il ne voit jamais les données,
qui restent dans l'IndexedDB du téléphone.

Deux fichiers de configuration accompagnent le build :

- `wrangler.jsonc` déclare `not_found_handling: "single-page-application"`,
  qui sert `index.html` pour toute adresse non trouvée. Sans lui, ouvrir
  `/reglages` directement donne un 404 — c'est le routeur côté client qui
  résout ces adresses, pas le serveur. **Ne pas remplacer par une règle
  `/* /index.html 200` dans un `_redirects`** : les assets statiques Workers
  la rejettent, leur gestion automatique des URL retirant déjà `/index` et
  `.html`, ce qui ferait boucler la règle sur elle-même.
- `public/_headers` empêche la mise en cache du service worker et de la page
  d'entrée. Sans ça, une mise à jour peut mettre des jours à atteindre un
  téléphone qui a gardé l'ancien service worker.

La config se valide sans rien déployer :

```bash
npm run build && npx wrangler deploy --dry-run
```

## Captures automatiques (optionnel)

Playwright est installé mais son Chromium ne démarre pas encore : il manque des
bibliothèques système. Une fois cette commande passée, les captures d'écran de
contrôle deviennent possibles depuis le terminal :

```bash
sudo npx playwright install-deps chromium
```
