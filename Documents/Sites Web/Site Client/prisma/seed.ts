/**
 * Seed initial — peuple la base avec le catalogue complet fusionné.
 * Exécuter : npx prisma db seed
 * (ou automatiquement lors de la première migration sur Railway)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const catalogData = [
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
          { ref: "PCP 01", label: "Porte-Clés Plexiglass", moq: 10, step: 10, prixRevendeur: 2.5, prixPublic: 5, note1: "Mix logo selon disponibilité" },
          { ref: "PCB 01", label: "Porte-Clés Bois", moq: 10, step: 10, prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "PCA 01", label: "Porte-Clés Acrylique", moq: 10, step: 10, prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "PCFL 01", label: "Porte-Clés Flotteur Liège", moq: 2, step: 4, prixRevendeur: 7, prixPublic: 14 },
        ],
      },
      {
        nom: "Magnets",
        slug: "magnets",
        ordre: 1,
        produits: [
          { ref: "MP 01", label: "Magnet Plexiglass", moq: 10, step: 10, prixRevendeur: 2.5, prixPublic: 5 },
          { ref: "VP 01", label: "Magnet Plexiglass", moq: 10, step: 10, prixRevendeur: 2.5, prixPublic: 5 },
          { ref: "MB 01", label: "Magnet Bois", moq: 10, step: 10, prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "MA 01", label: "Magnet Acrylique", moq: 10, step: 10, prixRevendeur: 4.5, prixPublic: 9 },
        ],
      },
      {
        nom: "Sticker",
        slug: "sticker",
        ordre: 2,
        produits: [{ ref: "STI 01", label: "Sticker", note2: "75 x 75", moq: 10, step: 10, prixRevendeur: 1, prixPublic: 2 }],
      },
    ],
  },
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
        ].map(([ref, label]) => ({ ref, label, note2: "350 ml", moq: 3, step: 3, prixRevendeur: 10.2, prixPublic: 18 })),
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
        ].map(([ref, label]) => ({ ref, label, note1: "Choix de designs en fonction du stock", note2: "350 ml", moq: 3, step: 3, prixRevendeur: 10.2, prixPublic: 18 })),
      },
      {
        nom: "Tasse Métal",
        slug: "tasse-metal",
        ordre: 2,
        produits: [
          { ref: "TM 01", label: "Tasse Métal Rouge", moq: 3, step: 3, prixRevendeur: 9, prixPublic: 15 },
          { ref: "TM 02", label: "Tasse Métal Blanc", moq: 3, step: 3, prixRevendeur: 9, prixPublic: 15 },
          { ref: "TM 03", label: "Tasse Métal Jaune", moq: 3, step: 3, prixRevendeur: 9, prixPublic: 15 },
          { ref: "TM 04", label: "Tasse Métal Bleu", moq: 3, step: 3, prixRevendeur: 9, prixPublic: 15 },
        ],
      },
      {
        nom: "Autres Tasses",
        slug: "autres-tasses",
        ordre: 3,
        produits: [{ ref: "TB-01", label: "Tasse Bois", moq: 1, step: 1, prixRevendeur: 15, prixPublic: 22 }],
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
          { ref: "SMA 01", label: "Support Mobile Acrylique", prixRevendeur: 6, prixPublic: 12 },
          { ref: "SMB 01", label: "Support Mobile Bois", prixRevendeur: 6, prixPublic: 12 },
          { ref: "PS 01", label: "Porte Sac", moq: 3, prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "FBC 01", label: "Flasque Bois Clair", prixRevendeur: 12, prixPublic: 22 },
          { ref: "FCF 01", label: "Flasque Bois Foncé", moq: 2, step: 2, prixRevendeur: 12, prixPublic: 22 },
          { ref: "LBF 01", label: "Limonadier Bois Foncé", moq: 4, step: 4, prixRevendeur: 6, prixPublic: 12 },
          { ref: "LBC 01", label: "Limonadier Bois Clair", prixRevendeur: 6, prixPublic: 12 },
          { ref: "IVL 01", label: "Identificateur Valise Liège", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "IVS 01", label: "Identificateur Valise Similicuir", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "ML 01", label: "Petit Miroir Liège", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "CMB 01", label: "Couteau Multi Bois", prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "CML 01", label: "Couteau Multi Liège", prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "PBA 01", label: "Pince à billet Argent", prixRevendeur: 4.5, prixPublic: 9 },
        ],
      },
      {
        nom: "Art de la table",
        slug: "art-de-la-table",
        ordre: 1,
        produits: [
          { ref: "BB 01", label: "Bouchon Bois", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "DPL 01", label: "Dessous de plat Liège", prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "DVL 01", label: "Dessous de Verre Liège x1", moq: 12, step: 24, prixRevendeur: 3, prixPublic: 6 },
          { ref: "PL 01", label: "Plateau en Liège", prixRevendeur: 12, prixPublic: 24 },
        ],
      },
      {
        nom: "Papeterie",
        slug: "papeterie",
        ordre: 2,
        produits: [
          { ref: "CPB 01", label: "Crayon papier bois", moq: 10, prixRevendeur: 1, prixPublic: 2 },
          { ref: "SBB 01", label: "Stylo à bille en bois", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "BNLP", label: "Bloc Note Liège A6 Petit", note1: "Choix de designs en fonction du stock", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "BNSP", label: "Bloc Note Similicuir A6 Petit", note1: "Choix de designs en fonction du stock", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "BNLG", label: "Bloc Note Liège A5 Grand", note1: "Choix de designs en fonction du stock", prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "BNSG", label: "Bloc Note Similicuir A5 Grand", note1: "Choix de designs en fonction du stock", prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "CP 01", label: "Carte Postale A6 (105 x 148)", prixRevendeur: 1.5, prixPublic: 3 },
          { ref: "AT 01", label: "Affiche A3 + Tube (297 x 420)", prixRevendeur: 12, prixPublic: 24 },
        ],
      },
      {
        nom: "Jeux",
        slug: "jeux",
        ordre: 3,
        produits: [
          { ref: "MOR 01", label: "Morpion", prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "DOM 01", label: "Dominos", moq: 2, step: 4, prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "MIK 01", label: "Mikado", moq: 2, step: 4, prixRevendeur: 7.5, prixPublic: 15 },
          { ref: "YO 01", label: "Yoyo", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "JDC 01", label: "Jeux de Cartes", prixRevendeur: 6, prixPublic: 12 },
          { ref: "RB 01", label: "Raquette Bois", prixRevendeur: 9, prixPublic: 18 },
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
          { ref: "PCL 01", label: "Porte Carte Liège", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "PML 01", label: "Porte Monnaie Liège", moq: 2, step: 2, prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "BBB 01", label: "Boîte à bijoux bois", moq: 2, step: 2, prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "DB 01", label: "Décapsuleur Bois", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "BCC 01", label: "Boîte à clic-clac", prixRevendeur: 3.5, prixPublic: 7 },
          { ref: "CL 01", label: "Cendrier Liège", prixRevendeur: 4.5, prixPublic: 9 },
        ],
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
          { ref: "P-001", label: "Trousse de toilette", prixRevendeur: 9, prixPublic: 18 },
          { ref: "P-002", label: "Pochette EarthAware Bio S", prixRevendeur: 6, prixPublic: 12 },
          { ref: "P-003", label: "Pochette EarthAware Bio L", prixRevendeur: 9, prixPublic: 18 },
          { ref: "P-004", label: "Pochette Zippée S", prixRevendeur: 4.5, prixPublic: 9 },
          { ref: "P-005", label: "Pochette Zippée M", prixRevendeur: 6, prixPublic: 12 },
          { ref: "P-006", label: "Pochette Vintage", prixRevendeur: 9, prixPublic: 18 },
          { ref: "P-007", label: "Pochette Coton S", prixRevendeur: 3.5, prixPublic: 7 },
          { ref: "P-008", label: "Pochette Coton M", prixRevendeur: 4.5, prixPublic: 9 },
        ],
      },
      {
        nom: "Sacs",
        slug: "sacs",
        ordre: 1,
        produits: [
          { ref: "S-001", label: "Sac de plage Naturel", prixRevendeur: 12, prixPublic: 24 },
          { ref: "S-002", label: "Sac de plage XL", prixRevendeur: 15, prixPublic: 30 },
          { ref: "S-003", label: "Sac Polochon en Molleton", prixRevendeur: 18, prixPublic: 36 },
          { ref: "S-004", label: "Tote Bag en Coton BIO", prixRevendeur: 4.5, prixPublic: 9 },
        ],
      },
    ],
  },
] as const;

async function main() {
  console.log("🌱 Début du seed complet…");

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
          moq?: number; step?: number;
          prixRevendeur?: number; prixPublic?: number;
        };
        await prisma.produit.upsert({
          where: { reference: p.ref },
          update: {
            designation: p.label,
            note1: p.note1 ?? null,
            note2: p.note2 ?? null,
            moq: p.moq ?? null,
            step: p.step ?? null,
            prixRevendeur: p.prixRevendeur ?? null,
            prixPublic: p.prixPublic ?? null,
            categorieId: createdCategorie.id,
            enLigne: true,
          },
          create: {
            reference: p.ref,
            designation: p.label,
            note1: p.note1 ?? null,
            note2: p.note2 ?? null,
            moq: p.moq ?? null,
            step: p.step ?? null,
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

  console.log("✅ Seed complet terminé !");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
