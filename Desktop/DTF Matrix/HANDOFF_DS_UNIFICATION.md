# HANDOFF — Unification Design System & UX OMS DTF Matrix

Refonte en 6 critiques. Exécution **step-by-step**, 1 PR par critique, 1 commit par
écran/module migré. Ce document est la référence unique — il sera coché au fur et à
mesure.

## Stack cible (rappel)

- React 18 + TypeScript + Vite
- Tailwind CSS avec tokens OLDA déjà mappés dans `tailwind.config.js`
  (duck-blue, sage, paper, urgent, danger, fg-1..4)
- Design tokens CSS dans `src/index.css` (`--brand-duck-*`, `--fg-*`, `--status-*`)
- React Router v6, TanStack Query, @dnd-kit

## Audit initial (état à la date du handoff)

### Écrans déjà propres (zéro couleur legacy)
- `src/components/Layout.tsx`
- `src/components/OrderTable.tsx`
- `src/components/StatusBadge.tsx`
- `src/pages/HybridOrder.tsx`
- `src/pages/NewOrder.tsx`
- `src/pages/OrderProof.tsx`
- `src/pages/StudioBatEditor.tsx`
- Tout `src/features/quick-quote/**`

### Écrans avec couleurs legacy à migrer (trié par charge)

| Fichier | Occurrences legacy |
|---|---|
| `src/pages/Clients.tsx` | 164 |
| `src/pages/Bat.tsx` | 124 |
| `src/components/NewOrderForm.tsx` | 94 *(sera supprimé cf. critique #2)* |
| `src/pages/Orders.tsx` | 88 |
| `src/pages/StudioBat.tsx` | 64 |
| `src/components/MockupComposer.tsx` | 62 |
| `src/components/KpiCard.tsx` | 26 |
| `src/components/KanbanCard.tsx` | 26 |
| `src/components/OrderLineForm.tsx` | 26 |
| `src/components/ProductChips.tsx` | 26 |
| `src/components/QuantityChips.tsx` | 26 |
| `src/components/KanbanColumn.tsx` | 19 |
| `src/pages/Kanban.tsx` | 14 |
| `src/components/SecteurChips.tsx` | 9 |
| `src/components/Toast.tsx` | 4 |
| `src/components/AssignedToRadio.tsx` | 3 |
| `src/components/NewOrderModal.tsx` | 1 |
| `src/features/hybrid-order/**` | ~105 au total *(à évaluer selon usage)* |
| `src/lib/types.ts` | `STATUS_COLORS` utilise `slate-*`, `blue-*`, `amber-*`... (lignes 45–83) |

### `window.confirm()` à remplacer
- `src/pages/Clients.tsx:73` — delete client
- `src/features/quick-quote/OrderWizard.tsx:21` — abandon (sera supprimé avec le wizard)

### Primitives manquantes
`src/components/ui/` n'existe pas encore. À créer.

### Quick-quote (cible suppression critique #2)
Seul `src/router.tsx` importe `OrderWizardPage`. **Aucun** hook/util de
`features/quick-quote/` n'est importé hors du dossier, **sauf `pricing.ts`**
qui doit être déplacé en `src/lib/pricing.ts`.

### Types métier
`Order` : `id, client_id, reference, statut, montant_total, date_commande,
date_livraison_prevue, notes, created_at, updated_at, client?`.
`OrderStatus` : 9 états (DRAFT, CONFIRMED, IN_PRODUCTION, BAT_SENT, BAT_APPROVED,
SHIPPED, DELIVERED, CANCELLED, +1).
**Pas de type `Product`** dans `types.ts` — il faudra l'ajouter (cf. critique #4).

---

## Règles d'or pendant la migration

1. **Zéro** `slate-*`, `gray-*`, `zinc-*`, `neutral-*` dans le JSX.
2. **Zéro** `bg-brand-600`, `brand-700` direct — utiliser `var(--brand-duck-500)` /
   `--brand-duck-400` en style inline OU la classe utilitaire si déjà mappée.
3. **Zéro** `dark:` pour l'instant — le DS est light-only.
4. **Zéro** `rose-*`, `red-*` — `var(--color-danger)` + `var(--color-urgent-*)`.
5. Préférer `var(--*)` via `style={{}}` pour les couleurs non déjà mappées plutôt
   que de créer des classes Tailwind ad hoc.
6. Radius : `var(--r-1)`..`var(--r-4)` ou `rounded-[Xpx]` pour valeurs libres.
7. Focus : laisser CSS global (`:focus-visible` → `var(--focus-ring)`) — ne pas
   override via `focus:ring-*` en Tailwind.
8. **1 commit par écran migré**, message : `refactor(ds): migrate <file> to OLDA tokens`.

---

## CRITIQUE #1 — Unifier le Design System

### Objectif
Tous les écrans sur le DS OLDA, sans `slate-*`/`red-*`/`dark:`, via des
primitives réutilisables dans `src/components/ui/`.

### Sous-étapes

#### 1.A — Créer les primitives `src/components/ui/`
- [ ] `Button.tsx` — `variant: "primary"|"secondary"|"ghost"|"danger"`,
      `size: "sm"|"md"|"lg"`, `loading?`, `leftIcon?`/`rightIcon?`.
      Pattern : `data-variant` + styles tokens, pas de Tailwind color direct.
- [ ] `Input.tsx` — input text avec label optionnel, error state rouge
      `var(--color-danger)`, focus-ring hérité du CSS global.
- [ ] `Select.tsx` — `<select>` natif stylé OLDA (pas de combobox custom pour
      l'instant, KISS).
- [ ] `Textarea.tsx` — idem Input.
- [ ] `Card.tsx` — surface paper-hi + border sage-100 + `var(--shadow-1)`,
      slots `header`/`body`/`footer`.
- [ ] `Badge.tsx` — neutre/info/warn/success/danger, tokens `--status-*`.
- [ ] `Avatar.tsx` — `user: "L"|"C"|"M"` (ou plus tard : initiales libres),
      variants `size: "xs"|"sm"|"md"`. **Remplace** `AssigneePips`, `OperatorPicker`,
      et l'avatar inline de `ProfileMenu` (Layout.tsx ligne 195–211).
- [ ] `AlertDialog.tsx` — scrim OLDA + panel OLDA (réutiliser `.olda-scrim` /
      `.olda-panel` déjà dans index.css). API :
      `{open, onOpenChange, title, description, confirmLabel, confirmTone,
        onConfirm, typeToConfirm?}`.
- [ ] `index.ts` — barrel export.

#### 1.B — Corriger `src/lib/types.ts`
- [ ] Remplacer `STATUS_COLORS` (Tailwind classes legacy) par un map vers
      tokens `var(--status-*)` utilisés dans `StatusBadge`. Vérifier que les
      consommateurs actuels n'utilisent pas directement les classes.

#### 1.C — Migrer les écrans (ordre, 1 commit chacun)
1. [ ] `src/components/Toast.tsx` (4) — warm-up
2. [ ] `src/components/AssignedToRadio.tsx` (3) → remplacer par `<Avatar>`
3. [ ] `src/components/SecteurChips.tsx` (9)
4. [ ] `src/pages/Kanban.tsx` (14)
5. [ ] `src/components/KanbanColumn.tsx` (19)
6. [ ] `src/components/KanbanCard.tsx` (26)
7. [ ] `src/components/KpiCard.tsx` (26)
8. [ ] `src/components/ProductChips.tsx` (26) *(supprimé si absorbé par modal critique #2)*
9. [ ] `src/components/QuantityChips.tsx` (26) *(idem)*
10. [ ] `src/components/OrderLineForm.tsx` (26) *(idem)*
11. [ ] `src/components/MockupComposer.tsx` (62)
12. [ ] `src/pages/StudioBat.tsx` (64)
13. [ ] `src/pages/Orders.tsx` (88)
14. [ ] `src/pages/Bat.tsx` (124)
15. [ ] `src/pages/Clients.tsx` (164) — gros morceau, à faire avec critique #3
16. [ ] `src/components/NewOrderModal.tsx` (1) — nettoyage final

### Livrable
PR `refactor(ds): unify design system` contenant les commits ci-dessus.
`grep -rE "(slate|gray|zinc|neutral|rose|red)-[0-9]|dark:" src/` doit
retourner **zéro match** côté écrans encore vivants.

---

## CRITIQUE #2 — Unifier la création de commande

### État
3 parcours divergent :
- `src/features/quick-quote/OrderWizard.tsx` (6 étapes)
- `src/pages/NewOrder.tsx` + `src/components/NewOrderForm.tsx`
- `src/components/NewOrderModal.tsx` (ouvert ⌘N)

### Plan
- [ ] Déplacer `src/features/quick-quote/pricing.ts` → `src/lib/pricing.ts`.
- [ ] Porter dans `NewOrderModal` :
  - Raccourcis date `+3j / +5j / +7j / Urgent` (source : `NewOrderForm` DateField)
  - Grille presets qty `5/10/20/50/100/200/500`
  - Total estimé live via `lib/pricing.ts`
- [ ] Ajouter ventilation tailles si `secteur ∈ {DTF, Pressage}` (cf. critique #5).
- [ ] Router : `/orders/new` redirige vers `/orders?new=1`. Dans `Orders.tsx`,
      ouvrir le modal si `searchParams.get('new') === '1'`.
- [ ] Supprimer :
  - `src/pages/NewOrder.tsx`
  - `src/components/NewOrderForm.tsx`
  - `src/features/quick-quote/**` (tout le dossier)
  - Route `/quick-quote` dans `src/router.tsx`
  - Entrée `"Devis rapide"` dans `Layout.tsx` (`SALES` array, ligne 29)
- [ ] Vérifier qu'aucun import orphelin ne reste (`tsc --noEmit`).

### Livrable
Un seul parcours, accessible via ⌘N ou bouton "Nouvelle commande".

---

## CRITIQUE #3 — Poka-yoke sur suppressions

### Plan
- [ ] `ui/AlertDialog.tsx` créé en 1.A.
- [ ] **Client delete** (`pages/Clients.tsx:73`) :
  - Remplacer `window.confirm`.
  - Fetch count commandes via endpoint dédié **ou** filtrage côté client sur
    `useOrders({ client_id })`.
  - UI : `"Supprimer ${client.nom} ? Ce client a N commandes (M en cours).
    Elles seront conservées (soft-delete)."`
  - Input `"Tape ${client.nom.toUpperCase()} pour confirmer"` (case-insensitive,
    trim). Bouton [Supprimer] disabled tant qu'il ne match pas.
- [ ] **Bulk delete** (`OrderTable.BulkActionBar`) :
  - Si `selected.length > 5` → type-to-confirm (`"SUPPRIMER"`).
  - Sinon → AlertDialog simple `"Supprimer N commandes ?"`.
- [ ] Vérifier API soft-delete côté `oms-api/app/routes/orders.py` et
      `clients.py`. Si absent → noter en **TODO backend** dans la PR
      (ne pas bloquer le merge front).

### Livrable
`AlertDialog` réutilisable + 2 intégrations opérationnelles.

---

## CRITIQUE #4 — Supprimer l'étape "Pour qui ?"

### État
Absorbée par critique #2 (suppression du wizard).

### Plan
- [ ] Ajouter `Product` dans `src/lib/types.ts` :
  ```ts
  export type ProductVariant = {
    cut: 'Homme' | 'Femme' | 'Enfant' | 'Unisexe';
    ref: string;
  };
  export type Product = {
    id: string;
    name: string;
    secteur: Secteur;
    basePrice: number;
    variants?: ProductVariant[];
  };
  ```
- [ ] Déplacer `features/quick-quote/catalog.mock.ts` → `src/lib/catalog.ts`
      (avant suppression du dossier).
- [ ] Dans `NewOrderModal` : si `product.variants?.length > 1`, afficher
      segmented control (tokens OLDA) pour choisir la coupe.

### Livrable
Plus aucune étape "cible/genre" dans le parcours.

---

## CRITIQUE #5 — Ventilation tailles réaliste

### Plan
- [ ] `src/components/SizeMatrixInput.tsx` :
  - Props : `{ value: Record<Size, number>; onChange(v); showTotal?: boolean }`
  - Sizes : `XS / S / M / L / XL / XXL / 3XL`
  - Tab/Enter → cellule suivante. Inputs numériques purs, pas de stepper.
  - Ligne "Total" bas, `tabular-nums`, bold.
- [ ] `src/lib/sizeDistributions.ts` — `DISTRIBUTION_PRESETS` :
  ```ts
  export const DISTRIBUTION_PRESETS = [
    { label: "Équipe 10 pers.",    sizes: { S:2, M:4,  L:3,  XL:1 } },
    { label: "Événement 50 pers.", sizes: { S:5, M:15, L:20, XL:8, XXL:2 } },
    { label: "Uniforme 100 pers.", sizes: { S:10, M:25, L:35, XL:20, XXL:8, '3XL':2 } },
    // TODO : confirmer 4e preset avec user (message original coupé)
  ];
  ```
- [ ] Intégrer dans `NewOrderModal` uniquement si `secteur ∈ {DTF, Pressage}`.
- [ ] Boutons preset : clic → `onChange(preset.sizes)` + toast "Distribution
      appliquée (N articles)".

### Livrable
Matrice + 3–4 presets fonctionnels dans le modal.

---

## CRITIQUE #6 — Preview avant envoi BAT

### État
`src/pages/Bat.tsx` envoie directement le PDF/image au client via `/bat/upload`,
sans preview. Un fichier corrompu ou erroné part sans filet.

### Plan
- [ ] `src/components/ui/FileDropzone.tsx` — réutilisable :
  - Props : `{ accept: string; maxSizeMB?: number; onFile(file: File | null); file?: File | null }`
  - Drag-and-drop + click-to-browse (input file caché)
  - Affiche zone dashed OLDA (`var(--brand-duck-300)`) au rest, border pleine +
    background `var(--brand-sage-50)` en dragover
  - Feedback erreur taille/MIME inline
- [ ] Refondre `src/pages/Bat.tsx` en flux 2 étapes :
  - **Étape 1 — Sélection** : `<FileDropzone>` uniquement (pas d'appel API)
  - **Étape 2 — Preview** (après sélection) :
    - Metadonnées : nom fichier, poids (Ko/Mo), MIME, nb pages (si PDF)
    - PDF → `pdfjs-dist` (déjà potentiellement dans le bundle via `react-pdf` ?
      vérifier `package.json`, sinon ajouter `pdfjs-dist` — plus léger que
      `react-pdf`). Render uniquement la **1ère page** dans un `<canvas>`.
    - Image → `<img src={URL.createObjectURL(file)} />` + `revokeObjectURL`
      au cleanup
  - Boutons :
    - Primary `"Envoyer au client"` (déclenche l'upload actuel)
    - Secondary `"Remplacer le fichier"` (revient à l'étape 1)
- [ ] MIME accept : `application/pdf, image/png, image/jpeg, image/svg+xml`.
      Taille max : 20 Mo (cohérent avec backend, cf. `storage_service.py`).
- [ ] Tokens OLDA partout — cet écran a 124 occurrences legacy, migration en
      même temps (commit unique `feat(bat): preview before send + OLDA migration`).

### Dépendance technique
- Vérifier `oms-frontend/package.json` pour `pdfjs-dist` ou `react-pdf`.
  Si absent : ajouter `pdfjs-dist` (~500 ko gzipped, worker lazy-loaded).

### Livrable
Flux BAT avec preview obligatoire, dropzone moderne, zéro legacy Tailwind sur
`Bat.tsx`.

---

## Style & conventions

- **Français** dans UI + commits
- Commits : `refactor(ds): ...`, `feat(modal): ...`, `chore(ui): ...`
- Une PR par critique, pas de mélange
- `tsc --noEmit` + `npm run build` OK avant chaque PR
- Screenshots avant/après dans la description PR pour les critiques UI

## Comment tester après chaque critique

1. `cd oms-frontend && npm run dev` (port Vite par défaut)
2. `cd oms-api && uvicorn app.main:app --reload`
3. Vérifier visuellement les écrans touchés en light.
4. `grep -rE "(slate|gray|zinc|neutral|rose|red)-[0-9]|dark:" src/` → 0 match
   sur les écrans déjà migrés.

## Statut

- [x] Audit + HANDOFF_DS_UNIFICATION.md
- [ ] Critique #1 — DS unification
- [ ] Critique #2 — Order creation unification
- [ ] Critique #3 — AlertDialog poka-yoke
- [ ] Critique #4 — Product variants (absorbée par #2)
- [ ] Critique #5 — SizeMatrixInput
- [ ] Critique #6 — Preview avant envoi BAT + FileDropzone
