/**
 * Seed initial — peuple la base avec le catalogue statique.
 * Exécuter : npx prisma db seed
 * (ou automatiquement lors de la première migration sur Railway)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parsePrice(price?: string): number | undefined {
  if (!price) return undefined;
  const n = parseFloat(price.replace(",", ".").replace(/[^0-9.]/g, ""));
  return isNaN(n) ? undefined : n;
}

const catalogData = [
  {
    slug: "tasses",
    nom: "Tasses",
    strapline: "La famille la plus profonde du catalogue",
    resume: "Déclinaisons céramique, métal et bois avec une grande variété de coloris et un standard 350 ml bien identifié.",
    accent: "#dfead7",
    surface: "rgba(223, 234, 215, 0.72)",
    signauxBusiness: [
      "Plusieurs références indiquent des designs disponibles selon le stock.",
      "Une largeur d'offre utile pour cadeaux clients, vente additionnelle et séries récurrentes.",
    ],
    ordre: 0,
    categories: [
      {
        nom: "Tasse Céramique FUCK",
        slug: "tasse-ceramique-fuck",
        ordre: 0,
        produits: [
          ["TCF 01","Tasse Rouge - Blanc"],["TCF 02","Tasse Orange - Blanc"],["TCF 03","Tasse Rose - Blanc"],
          ["TCF 04","Tasse Bleu - Blanc"],["TCF 05","Tasse Vert - Blanc"],["TCF 06","Tasse Noir - Blanc"],
          ["TCF 07","Tasse Blanc - Bleu"],["TCF 08","Tasse Blanc - Jaune"],["TCF 09","Tasse Blanc - Orange"],
          ["TCF 10","Tasse Blanc - Rouge"],["TCF 11","Tasse Blanc - Vert"],["TCF 12","Tasse Blanc - Noir"],
          ["TCF 13","Tasse Noir - Rose"],["TCF 14","Tasse Noir - Jaune"],["TCF 15","Tasse Noir - Rouge"],
          ["TCF 16","Tasse Noir - Vert"],["TCF 17","Tasse Noir - Orange"],
        ].map(([ref, label]) => ({ ref, label, note2: "350 ml", moq: 3, prixRevendeur: 8, prixPublic: 16 })),
      },
      {
        nom: "Tasse Céramique",
        slug: "tasse-ceramique",
        ordre: 1,
        produits: [
          ["TC 01","Tasse Rouge - Blanc"],["TC 02","Tasse Orange - Blanc"],["TC 03","Tasse Rose - Blanc"],
          ["TC 04","Tasse Bleu - Blanc"],["TC 05","Tasse Vert - Blanc"],["TC 06","Tasse Noir - Blanc"],
          ["TC 07","Tasse Blanc - Bleu"],["TC 08","Tasse Blanc - Jaune"],["TC 09","Tasse Blanc - Orange"],
          ["TC 10","Tasse Blanc - Rouge"],["TC 11","Tasse Blanc - Vert"],["TC 12","Tasse Blanc - Noir"],
          ["TC 13","Tasse Noir - Rose"],["TC 14","Tasse Noir - Jaune"],["TC 15","Tasse Noir - Rouge"],
          ["TC 16","Tasse Noir - Vert"],["TC 17","Tasse Noir - Orange"],
        ].map(([ref, label]) => ({ ref, label, note1: "Choix de designs en fonction du stock", note2: "350 ml", moq: 3, prixRevendeur: 8, prixPublic: 16 })),
      },
      {
        nom: "Tasse Métal",
        slug: "tasse-metal",
        ordre: 2,
        produits: [
          { ref: "TM 01", label: "Tasse Métal Rouge", prixRevendeur: 8, prixPublic: 16 },
          { ref: "TM 02", label: "Tasse Métal Blanc", prixRevendeur: 8, prixPublic: 16 },
          { ref: "TM 03", label: "Tasse Métal Jaune", prixRevendeur: 8, prixPublic: 16 },
          { ref: "TM 04", label: "Tasse Métal Bleu", prixRevendeur: 8, prixPublic: 16 },
        ],
      },
      {
        nom: "Autres Tasses",
        slug: "autres-tasses",
        ordre: 3,
        produits: [{ ref: "TB-01", label: "Tasse Bois", prixRevendeur: 8, prixPublic: 16 }],
      },
    ],
  },
  {
    slug: "goodies",
    nom: "Goodies",
    strapline: "Formats rapides à activer",
    resume: "Porte-clés, magnets et stickers pour opérations terrain, coffrets clients et revente boutique.",
    accent: "#dbe7ff",
    surface: "rgba(219, 231, 255, 0.68)",
    signauxBusiness: [
      "Des formats compacts faciles à diffuser en salon, boutique ou gifting.",
      "Des formats compacts prêts à intégrer dans une offre B2B.",
    ],
    ordre: 1,
    categories: [
      {
        nom: "Porte-Clés",
        slug: "porte-cles",
        ordre: 0,
        produits: [
          { ref: "PCP 01", label: "Porte-Clés Plexiglass", moq: 10 },
          { ref: "PCB 01", label: "Porte-Clés Bois", moq: 10 },
          { ref: "PCA 01", label: "Porte-Clés Acrylique", moq: 10 },
          { ref: "PCFL 01", label: "Porte-Clés Flotteur Liège", moq: 10 },
        ],
      },
      {
        nom: "Magnets",
        slug: "magnets",
        ordre: 1,
        produits: [
          { ref: "MP 01", label: "Magnet Plexiglass", moq: 10 },
          { ref: "MB 01", label: "Magnet Bois", moq: 10 },
          { ref: "MA 01", label: "Magnet Acrylique", moq: 10 },
        ],
      },
      {
        nom: "Sticker",
        slug: "sticker",
        ordre: 2,
        produits: [{ ref: "STI 01", label: "Sticker", note2: "75 x 75", moq: 10 }],
      },
    ],
  },
  {
    slug: "textiles",
    nom: "Textiles",
    strapline: "Entrée propre dans le soft goods",
    resume: "Pochettes et sacs pour compléter l'offre d'objets avec une base textile simple, lisible et facilement scénarisable.",
    accent: "#efc58d",
    surface: "rgba(239, 197, 141, 0.7)",
    signauxBusiness: [
      "Des produits faciles à décliner en page famille, usage ou matériau.",
      "Le tote bag bio, les pochettes EarthAware et les sacs plage donnent déjà une ligne claire.",
    ],
    ordre: 2,
    categories: [
      {
        nom: "Pochettes",
        slug: "pochettes",
        ordre: 0,
        produits: [
          { ref: "P-001", label: "Trousse de toilette" },
          { ref: "P-002", label: "Pochette EarthAware Bio S" },
          { ref: "P-003", label: "Pochette EarthAware Bio L" },
          { ref: "P-004", label: "Pochette Zippée S" },
          { ref: "P-005", label: "Pochette Zippée M" },
          { ref: "P-006", label: "Pochette Vintage" },
          { ref: "P-007", label: "Pochette Coton S" },
          { ref: "P-008", label: "Pochette Coton M" },
        ],
      },
      {
        nom: "Sacs",
        slug: "sacs",
        ordre: 1,
        produits: [
          { ref: "S-001", label: "Sac de plage Naturel" },
          { ref: "S-002", label: "Sac de plage XL" },
          { ref: "S-003", label: "Sac Polochon en Molleton" },
          { ref: "S-004", label: "Tote Bag en Coton BIO" },
        ],
      },
    ],
  },
  {
    slug: "accessoires",
    nom: "Accessoires",
    strapline: "Le catalogue de complément qui crédibilise l'offre",
    resume: "Accessoires du quotidien, art de la table, papeterie et jeux pour enrichir une offre B2B sans brouiller la lecture.",
    accent: "#f4dc95",
    surface: "rgba(244, 220, 149, 0.72)",
    signauxBusiness: [
      "Quelques références affichent déjà un minimum de commande, parfois dès 3 unités.",
      "La ligne papeterie montre un bon potentiel pour du corporate branding et des packs événementiels.",
    ],
    ordre: 3,
    categories: [
      {
        nom: "Du quotidien",
        slug: "du-quotidien",
        ordre: 0,
        produits: [
          { ref: "SMA 01", label: "Support Mobile Acrylique" },
          { ref: "SMB 01", label: "Support Mobile Bois" },
          { ref: "PS 01", label: "Porte Sac", moq: 3 },
          { ref: "FBC 01", label: "Flasque Bois Clair" },
          { ref: "FCF 01", label: "Flasque Bois Foncé" },
          { ref: "LBF 01", label: "Limonadier Bois Foncé" },
          { ref: "LBC 01", label: "Limonadier Bois Clair" },
          { ref: "IVL 01", label: "Identificateur Valise Liège" },
          { ref: "IVS 01", label: "Identificateur Valise Similicuir" },
          { ref: "PML 01", label: "Petit Miroir Liège" },
          { ref: "CMB 01", label: "Couteau Multi Bois" },
          { ref: "CML 01", label: "Couteau Multi Liège" },
          { ref: "PBA 01", label: "Pince à billet Argent" },
        ],
      },
      {
        nom: "Art de la table",
        slug: "art-de-la-table",
        ordre: 1,
        produits: [
          { ref: "BB 01", label: "Bouchon Bois" },
          { ref: "DPL 01", label: "Dessous de plat Liège" },
          { ref: "DVL 01", label: "Dessous de Verre Liège (par 1)" },
          { ref: "PL 01", label: "Plateau en Liège" },
        ],
      },
      {
        nom: "Papeterie",
        slug: "papeterie",
        ordre: 2,
        produits: [
          { ref: "CPB 01", label: "Crayon papier bois", moq: 10 },
          { ref: "SBB 01", label: "Stylo à bille en bois" },
          { ref: "BNLP", label: "Bloc Note Liège A6 Petit", note1: "Choix de designs en fonction du stock" },
          { ref: "BNSP", label: "Bloc Note Similicuir A6 Petit", note1: "Choix de designs en fonction du stock" },
          { ref: "BNLG", label: "Bloc Note Liège A5 Grand", note1: "Choix de designs en fonction du stock" },
          { ref: "BNSG", label: "Bloc Note Similicuir A5 Grand", note1: "Choix de designs en fonction du stock" },
          { ref: "CP 01", label: "Carte Postale A6 (105 x 148)" },
          { ref: "AT 01", label: "Affiche A3 + Tube (297 x 420)" },
        ],
      },
      {
        nom: "Jeux",
        slug: "jeux",
        ordre: 3,
        produits: [
          { ref: "MOR 01", label: "Morpion" },
          { ref: "DOM 01", label: "Dominos" },
          { ref: "MIK 01", label: "Mikado" },
          { ref: "YO 01", label: "Yoyo" },
          { ref: "JDC 01", label: "Jeux de Cartes" },
          { ref: "RB 01", label: "Raquette Bois" },
        ],
      },
    ],
  },
  {
    slug: "offres-speciales",
    nom: "Offres spéciales",
    strapline: "Une capsule à mettre en avant avec parcimonie",
    resume: "Une sélection plus resserrée pour créer un sentiment d'exclusivité, de série courte ou de proposition événementielle.",
    accent: "#dcffca",
    surface: "rgba(220, 255, 202, 0.72)",
    signauxBusiness: [
      "Très bon terrain pour une mise en scène premium et des lancements saisonniers.",
      "Peut devenir une rubrique éditoriale à part entière sans alourdir la navigation principale.",
    ],
    ordre: 4,
    categories: [
      {
        nom: "Sélection spéciale",
        slug: "selection-speciale",
        ordre: 0,
        produits: [
          { ref: "PCL 01", label: "Porte Carte Liège" },
          { ref: "PMO 01", label: "Porte Monnaie Liège" },
          { ref: "BBB 01", label: "Boîte à bijoux en bois" },
          { ref: "DB 01", label: "Décapsuleur Bois" },
          { ref: "BCC 01", label: "Boîte à clic-clac" },
          { ref: "CL 01", label: "Cendrier Liège" },
        ],
      },
    ],
  },
] as const;

async function main() {
  console.log("🌱 Début du seed…");

  for (const famille of catalogData) {
    const createdFamille = await prisma.famille.upsert({
      where: { slug: famille.slug },
      update: {
        nom: famille.nom,
        strapline: famille.strapline,
        resume: famille.resume,
        accent: famille.accent,
        surface: famille.surface,
        signauxBusiness: [...famille.signauxBusiness],
        ordre: famille.ordre,
      },
      create: {
        slug: famille.slug,
        nom: famille.nom,
        strapline: famille.strapline,
        resume: famille.resume,
        accent: famille.accent,
        surface: famille.surface,
        signauxBusiness: [...famille.signauxBusiness],
        ordre: famille.ordre,
      },
    });

    for (const categorie of famille.categories) {
      const createdCategorie = await prisma.categorie.upsert({
        where: { slug_familleId: { slug: categorie.slug, familleId: createdFamille.id } },
        update: { nom: categorie.nom, ordre: categorie.ordre },
        create: {
          slug: categorie.slug,
          nom: categorie.nom,
          ordre: categorie.ordre,
          familleId: createdFamille.id,
        },
      });

      for (const produit of categorie.produits) {
        const p = produit as {
          ref: string; label: string;
          note1?: string; note2?: string;
          moq?: number; prixRevendeur?: number; prixPublic?: number;
        };
        await prisma.produit.upsert({
          where: { reference: p.ref },
          update: {
            designation: p.label,
            note1: p.note1 ?? null,
            note2: p.note2 ?? null,
            moq: p.moq ?? null,
            prixRevendeur: p.prixRevendeur ?? null,
            prixPublic: p.prixPublic ?? null,
            categorieId: createdCategorie.id,
          },
          create: {
            reference: p.ref,
            designation: p.label,
            note1: p.note1 ?? null,
            note2: p.note2 ?? null,
            moq: p.moq ?? null,
            prixRevendeur: p.prixRevendeur ?? null,
            prixPublic: p.prixPublic ?? null,
            enLigne: true,
            categorieId: createdCategorie.id,
          },
        });
      }
      console.log(`  ✓ ${famille.nom} → ${categorie.nom} (${categorie.produits.length} produits)`);
    }
  }

  console.log("✅ Seed terminé !");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
