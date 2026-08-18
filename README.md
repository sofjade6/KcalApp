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

## Journal et historique

L'écran du jour est navigable : une journée passée se complète et se corrige
comme celle du jour. Le jour visé circule par l'URL (`?jour=`) à travers la
recherche, le scan, la saisie et l'écran de quantité.

La journée est **une seule liste d'aliments**, sans découpage en repas.

Deux raccourcis réduisent la saisie quotidienne : les **aliments récents**,
reproposés en tête de recherche et réajoutables d'un geste avec la quantité de
la dernière fois, et la **copie d'une journée** précédente.

## Recettes

Une recette est un groupe d'aliments réuni sous un nom — des lasagnes faites de
pâtes, tomates, bœuf et fromage, chacun avec son grammage. L'onglet Recettes
les compose ; le choix des ingrédients repasse par la recherche et l'écran de
quantité, qui savent déjà interroger CIQUAL, scanner un code-barres et proposer
des portions usuelles.

Le **poids final** est distinct de la somme des ingrédients : la cuisson fait
perdre de l'eau, et c'est lui qui sert de base au calcul pour 100 g. Ajouter ou
retirer un ingrédient recalcule l'ensemble, ce qui suppose que chaque
ingrédient porte ses propres valeurs — d'où leur stockage complet et non
réduit au couple nom/grammage.

Une recette est enregistrée comme un aliment mémorisé ordinaire : elle hérite
ainsi de la recherche, de la résolution et des portions, sans seconde voie à
maintenir. Elle s'ajoute donc à la journée comme n'importe quel aliment, en
pesant sa part.

Un raccourci existe depuis le journal, pour transformer des aliments déjà notés
en recette sans les ressaisir.

## Bilan

L'onglet Bilan compare la semaine à l'objectif, liste les jours de dépassement
et projette la date d'atteinte de la cible à partir de la pente réelle du poids
(moindres carrés sur quatre semaines).

Sa carte la plus utile confronte les calories notées à l'évolution réelle du
poids : c'est le seul contrôle qui dise si la dépense estimée par l'équation
correspond à ce corps-là. Les formules donnent une moyenne de population et
l'écart individuel atteint couramment 200 à 300 kcal par jour.

Deux précautions de calcul : un jour sans aucune saisie est exclu de la moyenne
plutôt que compté à zéro, et aucune projection n'est affichée si la pente est
trop faible pour se distinguer du bruit ou s'éloigne de la cible.

## Rappels

L'app **n'envoie pas de notifications**. Une PWA ne peut pas se réveiller seule
pour en émettre : il faudrait un serveur d'envoi, donc un backend, un compte, et
la fin de la promesse « tout reste sur le téléphone ». Les rappels s'affichent
à l'ouverture, sur l'écran du jour — pesée trop ancienne, sauvegarde trop
ancienne.

## Gluten

Le gluten **n'est quantifié par aucune base**. La table CIQUAL compte 67
constituants, aucun ne le concerne, et la réglementation européenne impose de
déclarer l'allergène, pas de le doser — le seul seuil chiffré est celui du label
« sans gluten », 20 mg/kg. L'app n'affiche donc jamais de grammage : elle liste
les aliments concernés, avec le niveau de certitude de chacun.

| Niveau | Source |
| --- | --- |
| Contient du gluten | `allergens_tags` d'OpenFoodFacts, donc l'étiquette |
| Sans gluten | label déclaré sur l'emballage |
| Traces possibles | `traces_tags`, déclaration distincte |
| Peut contenir du gluten | **déduction** du libellé CIQUAL |

Une déclaration d'étiquette prime toujours sur la déduction. Celle-ci repose sur
des mots-clés dans `src/lib/gluten.ts`, avec les mêmes précautions que les
portions usuelles : « farine de riz » et « pâtes de lentilles » sont exclues, et
le singulier « pâte » est absent des indices — privé de ses accents, « pâté »
devient « pate » et signalait toute terrine.

Les 29 cas de contrôle passent sur les libellés CIQUAL réels ; 357 aliments sur
2 298 sont signalés. Le statut d'une entrée CIQUAL est déduit **à l'affichage**
et non stocké : améliorer les règles profite ainsi aux journées déjà notées.

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

## Boissons comptées en millilitres

Une boisson se saisit en ml, un solide en grammes. La détection ne repose pas
sur des mots-clés mais sur des signaux autoritatifs :

- **produits scannés** : `product_quantity_unit` d'OpenFoodFacts. Les catégories
  y sont inutilisables — un muesli s'y trouve rangé parmi les boissons.
- **table CIQUAL** : le groupe `06`, « eaux et autres boissons ». Il ne suffit
  pas seul, on y trouve du café soluble, du thé en feuilles et des sirops à
  diluer : les présentations en poudre ou à reconstituer sont écartées. Les
  laits buvables du groupe `05` et les soupes du groupe `01` sont ajoutés.

Les **huiles** du groupe `09` s'y ajoutent, hors corps solides — beurre de
cacao, graisse de coco et karité portent « huile » dans leur libellé sans être
liquides.

Les valeurs nutritionnelles étant rapportées à 100 g, le volume saisi est
**converti en masse** : `Entree.grammes` garde la masse réelle, `Entree.ml` le
volume tapé. Pour une boisson aqueuse le facteur vaut 1 et les deux coïncident ;
pour une huile il vaut 0,92, et 15 ml pèsent 14 g — négliger l'écart
surestimerait de 8 % un aliment à 900 kcal. L'écran de quantité affiche la
conversion quand elle a lieu.

Les portions usuelles étant définies en masse, leur équivalent en volume est
calculé à l'affichage : une cuillère à soupe d'huile vaut 10 g, soit 11 ml.

## Recherche par code-barres saisi

Le scan échoue sur un emballage froissé, brillant ou mal éclairé. Les chiffres
imprimés sous le code se saisissent alors au clavier, depuis la recherche ou
depuis l'écran de scan.

La **clé de contrôle** est vérifiée avant toute requête : le dernier chiffre
d'un EAN-8 ou EAN-13 se recalcule depuis les précédents, ce qui signale une
coquille immédiatement plutôt que de rapporter un « produit inconnu » trompeur.

Le scan et la saisie partagent la même résolution (`src/lib/produit.ts`) : cache
local d'abord, puis OpenFoodFacts, puis saisie manuelle avec le code en
paramètre.

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

Le **rythme visé** se choisit entre 0,25 et 1 kg par semaine. L'écart calorique
quotidien en découle par la constante de 7 700 kcal par kilo de masse
corporelle — la même que celle du contrôle de cohérence du bilan, sans quoi
l'app se contredirait. L'écran affiche l'objectif résultant en face de chaque
rythme.

Les protéines et lipides sont bornés en **part d'énergie** autant qu'en grammes
par kilo — protéines entre 25 et 30 %, lipides autour de 30 %. Les fixer au seul
poids corporel écrasait les glucides dès que l'apport était réduit : un profil
lourd en déficit se retrouvait à 30 g de glucides par jour, soit une répartition
cétogène involontaire.

Deux situations sont **signalées sans être bloquées** : un objectif sous le
métabolisme de base, et un poids visé correspondant à un IMC inférieur à 18,5.
L'app applique ce qui est demandé et affiche l'information ; aucun plafonnement
n'est appliqué.

Modifier un objectif à la main dans Réglages coupe le calcul automatique — mais
seulement si la valeur **change réellement** : retaper la même figeait
auparavant les objectifs pour de bon, et le profil semblait ensuite sans effet.
Le passage en manuel est signalé et un bouton rétablit le calcul.

Le recalcul est monté au niveau de l'application et non de l'écran Profil : une
correction de la formule doit prendre effet sans avoir à visiter cet écran.

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
