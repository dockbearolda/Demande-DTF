-- CreateTable
CREATE TABLE "Famille" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "strapline" TEXT NOT NULL DEFAULT '',
    "resume" TEXT NOT NULL DEFAULT '',
    "accent" TEXT NOT NULL DEFAULT '#dbe7ff',
    "surface" TEXT NOT NULL DEFAULT 'rgba(219, 231, 255, 0.68)',
    "signauxBusiness" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Famille_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "familleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categorie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "note1" TEXT,
    "note2" TEXT,
    "moq" INTEGER,
    "stock" INTEGER,
    "prixPublic" DOUBLE PRECISION,
    "prixRevendeur" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "enLigne" BOOLEAN NOT NULL DEFAULT true,
    "categorieId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Famille_slug_key" ON "Famille"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Produit_reference_key" ON "Produit"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Categorie_slug_familleId_key" ON "Categorie"("slug", "familleId");

-- AddForeignKey
ALTER TABLE "Categorie" ADD CONSTRAINT "Categorie_familleId_fkey" FOREIGN KEY ("familleId") REFERENCES "Famille"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produit" ADD CONSTRAINT "Produit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
