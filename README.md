# OLDA Imposition Tool

Outil d'imposition pour Roland VersaWorks — magnets 49mm.

## Architecture

```
Frontend (React)          Backend (Python/FastAPI)
imposition-tool.jsx  →→→  main.py (Railway)
                          ↓
                     PDF VersaWorks
                     (Spot Colors)
```

## Déploiement Backend sur Railway

1. Crée un nouveau service Railway (Python)
2. Upload le dossier `imposition-backend/`
3. Railway détecte automatiquement le `Procfile`
4. Variables d'environnement : aucune requise

## Branchement Frontend → Backend

Dans `imposition-tool.jsx`, remplace la fonction `handleGenerate` :

```js
const handleGenerate = async () => {
  setGenerating(true);
  
  const payload = {
    logos: slots
      .filter(s => s.logo)
      .map(s => {
        const logo = logoMap[s.logo];
        return {
          slot_id: s.id,
          cx_mm: s.cx,
          cy_mm: s.cy,
          logo_data: logo.dataUrl,
          logo_type: logo.type,
          logo_name: logo.name,
        };
      })
  };

  const res = await fetch("https://TON-SERVICE.railway.app/generate-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "OLDA_Imposition.pdf";
  a.click();
  
  setGenerating(false);
};
```

## Couches PDF générées

| Couche | Spot Color | Rôle VersaWorks |
|--------|-----------|-----------------|
| 1 | CMJN | Logos couleur |
| 2 | RDG_WHITE | Blanc d'impression sous logos |
| 3 | RDG_GLOSS | Vernis sélectif |
| 4 | CutContour | Ligne de découpe (±3mm offset) |

## Format gabarit

- Planche : 600 × 300 mm
- Magnets : Ø 49 mm
- Grille : 11 × 5 = 55 positions
- Contour découpe : +3mm offset + 3mm bordure
