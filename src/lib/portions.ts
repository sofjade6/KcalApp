import { normaliser } from './recherche'

export interface PortionUsuelle {
  nom: string
  grammes: number
}

/**
 * Mots trahissant une préparation plutôt que l'aliment brut.
 *
 * Sans ce garde-fou, « compote de pomme » hérite de la portion « 1 pomme,
 * 150 g », et « tarte aux pommes » aussi : l'unité d'un ingrédient n'a aucun
 * sens pour le plat qui le contient. Il ne s'applique qu'aux règles portant
 * sur un ingrédient — « verre de lait » ou « tranche de pain » restent
 * valables dans une préparation.
 */
const PREPARATION =
  /tarte|gateau|biscuit|sorbet|glace|confiture|compote|coulis|\bjus\b|sirop|nectar|sauce|mousse|smoothie|beignet|chausson|clafoutis|crumble|salade de fruit|boisson|puree|conserve|confit|chips|farine|poudre|\bsoupe\b|potage|veloute|gratin|lasagne|ravioli|quiche|tourte/

interface Regle {
  motif: RegExp
  /** Écarte la règle quand le libellé décrit une préparation. */
  exclure?: RegExp
  portions: PortionUsuelle[]
}

/**
 * Portions courantes, rattachées aux aliments par leur libellé.
 *
 * Ce sont des moyennes indicatives : un œuf calibre L et un calibre S ne
 * pèsent pas la même chose. La saisie en grammes reste toujours disponible
 * pour qui veut être exact.
 *
 * L'ordre compte, la première règle qui correspond l'emporte — « pomme de
 * terre » doit donc passer avant « pomme ».
 */
const REGLES: Regle[] = [
  // Œufs : les parties séparées avant l'œuf entier.
  { motif: /\bjaune\b.*\boeuf|\boeuf\b.*\bjaune\b/, portions: [{ nom: 'jaune', grammes: 17 }] },
  { motif: /\bblanc\b.*\boeuf|\boeuf\b.*\bblanc\b/, portions: [{ nom: 'blanc', grammes: 33 }] },
  { motif: /oeuf de caille/, portions: [{ nom: 'œuf de caille', grammes: 9 }] },
  { motif: /\boeufs?\b/, exclure: PREPARATION, portions: [{ nom: 'œuf', grammes: 50 }] },

  { motif: /\bfrites?\b/, portions: [{ nom: 'portion', grammes: 150 }] },
  // Les deux tournures existent dans CIQUAL : « purée de pomme de terre » et
  // « pomme de terre, purée à base de flocons ».
  {
    motif: /puree de pomme de terre|pomme de terre.*puree/,
    portions: [{ nom: 'portion', grammes: 200 }],
  },
  {
    motif: /pomme de terre/,
    exclure: PREPARATION,
    portions: [{ nom: 'pomme de terre', grammes: 120 }],
  },

  { motif: /biscotte/, portions: [{ nom: 'biscotte', grammes: 10 }] },
  {
    motif: /\bpains?\b|baguette/,
    portions: [
      { nom: 'tranche', grammes: 30 },
      { nom: 'quart de baguette', grammes: 62 },
    ],
  },

  {
    motif: /\bhuiles?\b/,
    portions: [
      { nom: 'cuillère à soupe', grammes: 10 },
      { nom: 'cuillère à café', grammes: 5 },
    ],
  },
  {
    motif: /\bbeurre\b/,
    portions: [
      { nom: 'noisette', grammes: 10 },
      { nom: 'cuillère à café', grammes: 5 },
    ],
  },
  {
    motif: /\bcremes? fraiche|creme de lait|creme epaisse|creme legere/,
    portions: [{ nom: 'cuillère à soupe', grammes: 15 }],
  },
  {
    // Ancré en début de libellé : « beignet à la confiture » est une
    // pâtisserie, pas de la confiture qu'on dose à la cuillère.
    motif: /^(miel|confiture|pate a tartiner)\b/,
    portions: [
      { nom: 'cuillère à café', grammes: 8 },
      { nom: 'cuillère à soupe', grammes: 20 },
    ],
  },
  {
    motif: /\bsucre\b/,
    portions: [
      { nom: 'morceau', grammes: 5 },
      { nom: 'cuillère à café', grammes: 5 },
    ],
  },

  { motif: /petit-suisse/, portions: [{ nom: 'petit-suisse', grammes: 60 }] },
  { motif: /yaourt|fromage blanc/, portions: [{ nom: 'pot', grammes: 125 }] },
  { motif: /\bfromages?\b/, exclure: PREPARATION, portions: [{ nom: 'portion', grammes: 30 }] },

  {
    motif: /\blaits?\b/,
    // « chocolat au lait » et « lait de coco » ne se boivent pas au verre :
    // le premier est une tablette, le second un ingrédient de cuisine.
    exclure: /\bpoudre\b|chocolat|\bcoco\b|concentre/,
    portions: [
      { nom: 'verre', grammes: 200 },
      { nom: 'bol', grammes: 250 },
    ],
  },
  {
    motif: /\bjus\b|\bsoda\b|\bcola\b|limonade/,
    portions: [
      { nom: 'verre', grammes: 200 },
      { nom: 'canette', grammes: 330 },
    ],
  },
  { motif: /\bcafes?\b|\bthes?\b|infusion/, portions: [{ nom: 'tasse', grammes: 125 }] },
  { motif: /\bsoupe\b|potage|veloute/, portions: [{ nom: 'bol', grammes: 250 }] },

  // Féculents : la portion crue et la portion cuite n'ont rien à voir.
  {
    motif: /(riz|pates|semoule|quinoa|boulgour|lentille|haricot).*(cuit|cuite)/,
    portions: [{ nom: 'portion cuite', grammes: 200 }],
  },
  {
    motif: /(riz|pates|semoule|quinoa|boulgour|lentille|haricot).*(cru|crue|seche)/,
    portions: [{ nom: 'portion crue', grammes: 70 }],
  },

  { motif: /compote|coulis de fruit/, portions: [{ nom: 'pot', grammes: 100 }] },

  { motif: /\bbananes?\b/, exclure: PREPARATION, portions: [{ nom: 'banane', grammes: 110 }] },
  { motif: /\bpommes?\b/, exclure: PREPARATION, portions: [{ nom: 'pomme', grammes: 150 }] },
  { motif: /\bpoires?\b/, exclure: PREPARATION, portions: [{ nom: 'poire', grammes: 150 }] },
  { motif: /\boranges?\b/, exclure: PREPARATION, portions: [{ nom: 'orange', grammes: 180 }] },
  {
    motif: /clementine|mandarine/,
    exclure: PREPARATION,
    portions: [{ nom: 'clémentine', grammes: 70 }],
  },
  { motif: /\bkiwis?\b/, exclure: PREPARATION, portions: [{ nom: 'kiwi', grammes: 75 }] },
  { motif: /\bfraises?\b/, exclure: PREPARATION, portions: [{ nom: 'fraise', grammes: 12 }] },
  { motif: /\btomates?\b/, exclure: PREPARATION, portions: [{ nom: 'tomate', grammes: 120 }] },
  { motif: /\bcarottes?\b/, exclure: PREPARATION, portions: [{ nom: 'carotte', grammes: 100 }] },
  { motif: /\bavocats?\b/, exclure: PREPARATION, portions: [{ nom: 'avocat', grammes: 150 }] },

  {
    motif: /\bamandes?\b|\bnoix\b|\bnoisettes?\b|cajou|pistache|cacahuete/,
    exclure: PREPARATION,
    portions: [{ nom: 'poignée', grammes: 30 }],
  },
  { motif: /chocolat/, exclure: PREPARATION, portions: [{ nom: 'carré', grammes: 6 }] },
  { motif: /biscuit|gateau sec|madeleine/, portions: [{ nom: 'biscuit', grammes: 10 }] },
  { motif: /\bpizza\b/, portions: [{ nom: 'part', grammes: 130 }] },

  { motif: /\bjambon\b/, portions: [{ nom: 'tranche', grammes: 40 }] },
  {
    motif: /\bsteak\b|entrecote|\bcote de\b|escalope/,
    exclure: PREPARATION,
    portions: [{ nom: 'pièce', grammes: 120 }],
  },
  {
    motif: /saumon|cabillaud|\bcolin\b|truite|\bthon\b|filet de poisson/,
    exclure: PREPARATION,
    portions: [{ nom: 'filet', grammes: 130 }],
  },
]

/**
 * Portions proposées pour un aliment.
 *
 * `portionProduit` vient d'OpenFoodFacts et prime : une portion inscrite sur
 * l'emballage vaut mieux qu'une moyenne rattachée par mot-clé.
 */
export function portionsPour(
  nom: string,
  portionProduit?: { nom: string; grammes: number },
): PortionUsuelle[] {
  const trouvees: PortionUsuelle[] = []
  if (portionProduit) trouvees.push(portionProduit)

  const cherchable = normaliser(nom)
  const regle = REGLES.find(
    (r) => r.motif.test(cherchable) && !r.exclure?.test(cherchable),
  )
  if (regle) trouvees.push(...regle.portions)

  // Deux portions de même poids feraient doublon à l'écran.
  return trouvees.filter(
    (p, i) => trouvees.findIndex((autre) => autre.grammes === p.grammes) === i,
  )
}

/** « 2 œufs », « 1 cuillère à soupe » — accord au pluriel compris. */
export function libellePortion(portion: PortionUsuelle, nombre: number): string {
  const compte = Number.isInteger(nombre)
    ? String(nombre)
    : nombre.toString().replace('.', ',')
  // En français, le pluriel commence à deux : « 1,5 œuf » reste au singulier.
  if (nombre < 2) return `${compte} ${portion.nom}`

  // Les noms composés ne prennent la marque du pluriel que sur le premier mot.
  const [tete, ...reste] = portion.nom.split(' ')
  const pluriel = /[sx]$/.test(tete) ? tete : `${tete}s`
  return `${compte} ${[pluriel, ...reste].join(' ')}`
}
