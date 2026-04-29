import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  Check,
  ImageIcon,
  Layers,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export type PrintZoneId =
  | "front-heart"
  | "front-center"
  | "back"
  | "sleeve-left"
  | "sleeve-right";

export type Technique = "screen" | "dtf" | "embroidery" | "flex" | "transfer";

export interface ReferenceColor {
  id: string;
  label: string;
  hex: string;
  /** Quantité totale tous tailles confondues. */
  qty: number;
}

export interface ReferenceData {
  id: string;
  /** "T-shirt Bio Premium 180g" */
  productName: string;
  /** "B&C E190 / Réf. PRT3001" */
  productReference: string;
  /** Image miniature du vêtement (URL absolue ou data URL). */
  thumbnailUrl?: string;
  /** Quantité totale toutes couleurs/tailles confondues. */
  totalQty: number;
  colors: ReferenceColor[];
}

export interface PlacementState {
  zone: PrintZoneId;
  technique: Technique | null;
}

/** Fichier visuel uploadé pour une couleur. */
export interface BatFile {
  /** Identité stable (uuid client). */
  id: string;
  name: string;
  size: number;
  /** ObjectURL ou data URL utilisable comme `<img src>`. */
  previewUrl: string;
}

export interface ReferenceCustomization {
  placements: PlacementState[];
  /** Si vrai → `sharedFile` est appliqué à toutes les couleurs ; sinon
   *  `filesByColor` est utilisé. */
  sharedMode: boolean;
  sharedFile: BatFile | null;
  filesByColor: Record<string, BatFile | null>;
}

export interface CustomizationStepV2Props {
  references: ReferenceData[];
  /** État courant indexé par référence — undefined = état initial vide. */
  state: Record<string, ReferenceCustomization>;
  onChange: (referenceId: string, next: ReferenceCustomization) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRINT_ZONES: ReadonlyArray<{
  id: PrintZoneId;
  label: string;
  hint: string;
  surcharge: number;
}> = [
  { id: "front-heart", label: "Cœur", hint: "Logo poitrine gauche", surcharge: 0 },
  { id: "front-center", label: "Poitrine", hint: "Visuel face avant centré", surcharge: 1.5 },
  { id: "back", label: "Dos", hint: "Grand format dos", surcharge: 2.5 },
  { id: "sleeve-left", label: "Manche G.", hint: "Manche gauche", surcharge: 1.5 },
  { id: "sleeve-right", label: "Manche D.", hint: "Manche droite", surcharge: 1.5 },
];

const TECHNIQUES: ReadonlyArray<{ id: Technique; label: string; description: string }> = [
  { id: "screen", label: "Sérigraphie", description: "Aplats opaques · grandes séries" },
  { id: "dtf", label: "DTF", description: "Multicolore · petites séries" },
  { id: "embroidery", label: "Broderie", description: "Premium · finition fil" },
  { id: "flex", label: "Flex", description: "Flocage vinyle découpé" },
  { id: "transfer", label: "Transfert", description: "Photo-réalisme" },
];

export const EMPTY_CUSTOMIZATION: ReferenceCustomization = {
  placements: [],
  sharedMode: false,
  sharedFile: null,
  filesByColor: {},
};

// ─────────────────────────────────────────────────────────────────────────────
// CustomizationStepV2 — top-level
// ─────────────────────────────────────────────────────────────────────────────

export function CustomizationStepV2({
  references,
  state,
  onChange,
}: CustomizationStepV2Props) {
  if (references.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-5">
        {references.map((ref) => (
          <ReferenceCard
            key={ref.id}
            reference={ref}
            value={state[ref.id] ?? EMPTY_CUSTOMIZATION}
            onChange={(next) => onChange(ref.id, next)}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReferenceCard
// ─────────────────────────────────────────────────────────────────────────────

interface ReferenceCardProps {
  reference: ReferenceData;
  value: ReferenceCustomization;
  onChange: (next: ReferenceCustomization) => void;
}

function ReferenceCard({ reference, value, onChange }: ReferenceCardProps) {
  const togglePlacement = useCallback(
    (zone: PrintZoneId) => {
      const exists = value.placements.some((p) => p.zone === zone);
      const placements = exists
        ? value.placements.filter((p) => p.zone !== zone)
        : [...value.placements, { zone, technique: null }];
      onChange({ ...value, placements });
    },
    [value, onChange],
  );

  const setTechnique = useCallback(
    (zone: PrintZoneId, technique: Technique) => {
      const placements = value.placements.map((p) =>
        p.zone === zone ? { ...p, technique } : p,
      );
      onChange({ ...value, placements });
    },
    [value, onChange],
  );

  const setSharedMode = useCallback(
    (sharedMode: boolean) => onChange({ ...value, sharedMode }),
    [value, onChange],
  );

  const setSharedFile = useCallback(
    (sharedFile: BatFile | null) => onChange({ ...value, sharedFile }),
    [value, onChange],
  );

  const setFileForColor = useCallback(
    (colorId: string, file: BatFile | null) =>
      onChange({
        ...value,
        filesByColor: { ...value.filesByColor, [colorId]: file },
      }),
    [value, onChange],
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <ReferenceHeader reference={reference} placements={value.placements} />

      <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-7">
        {/* ── Zone 1 — Emplacements ───────────────────────────────────── */}
        <section>
          <SectionTitle
            step="1"
            title="Emplacements d'impression"
            subtitle="Sélectionne une ou plusieurs zones — le supplément se cumule."
          />

          <div className="mt-4">
            <PrintZonePicker
              selected={value.placements}
              onToggle={togglePlacement}
              onTechnique={setTechnique}
            />
          </div>
        </section>

        <Divider />

        {/* ── Zone 2 — BAT par couleur ────────────────────────────────── */}
        <section>
          <SectionTitle
            step="2"
            title="Bons à tirer (BAT)"
            subtitle="Glisse-dépose le visuel pour chaque couleur."
            right={
              <SharedToggle
                checked={value.sharedMode}
                onChange={setSharedMode}
              />
            }
          />

          <div className="mt-4">
            <BatDropzoneGrid
              colors={reference.colors}
              sharedMode={value.sharedMode}
              sharedFile={value.sharedFile}
              filesByColor={value.filesByColor}
              onSharedFile={setSharedFile}
              onColorFile={setFileForColor}
            />
          </div>
        </section>
      </div>
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReferenceHeader
// ─────────────────────────────────────────────────────────────────────────────

function ReferenceHeader({
  reference,
  placements,
}: {
  reference: ReferenceData;
  placements: PlacementState[];
}) {
  const placementSummary = useMemo(() => {
    if (placements.length === 0) return null;
    return placements
      .map((p) => PRINT_ZONES.find((z) => z.id === p.zone)?.label)
      .filter(Boolean)
      .join(" · ");
  }, [placements]);

  return (
    <header className="flex items-center gap-4 border-b border-gray-100 bg-gray-50/60 px-6 py-4 sm:px-8">
      <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
        {reference.thumbnailUrl ? (
          <img
            src={reference.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-gray-300" strokeWidth={1.6} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold tracking-tight text-gray-900">
            {reference.productName}
          </h3>
          <span className="rounded-md bg-white px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-gray-500 ring-1 ring-inset ring-gray-200">
            {reference.productReference}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-gray-500">
          <span>
            <strong className="font-semibold tabular-nums text-gray-700">
              {reference.totalQty}
            </strong>{" "}
            pièces
          </span>
          <span aria-hidden className="text-gray-300">
            ·
          </span>
          <ColorChips colors={reference.colors} />
        </div>
      </div>

      {placementSummary && (
        <div className="hidden flex-none items-center gap-1.5 rounded-lg border border-[#4A6274]/20 bg-[#4A6274]/8 px-2.5 py-1 text-[11px] font-medium text-[#4A6274] sm:inline-flex">
          <Sparkles className="h-3 w-3" strokeWidth={2.2} />
          {placementSummary}
        </div>
      )}
    </header>
  );
}

function ColorChips({ colors }: { colors: ReferenceColor[] }) {
  const visible = colors.slice(0, 6);
  const remaining = colors.length - visible.length;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="flex -space-x-1">
        {visible.map((c) => (
          <span
            key={c.id}
            title={`${c.label} · ${c.qty}`}
            className="h-3.5 w-3.5 rounded-full ring-2 ring-gray-50"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </span>
      <span>
        {colors.length} couleur{colors.length > 1 ? "s" : ""}
        {remaining > 0 && <> (+{remaining})</>}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PrintZonePicker — visual cards
// ─────────────────────────────────────────────────────────────────────────────

interface PrintZonePickerProps {
  selected: PlacementState[];
  onToggle: (zone: PrintZoneId) => void;
  onTechnique: (zone: PrintZoneId, technique: Technique) => void;
}

function PrintZonePicker({ selected, onToggle, onTechnique }: PrintZonePickerProps) {
  const isSelected = (zoneId: PrintZoneId) =>
    selected.some((p) => p.zone === zoneId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PRINT_ZONES.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            active={isSelected(zone.id)}
            onClick={() => onToggle(zone.id)}
          />
        ))}
      </div>

      {/* Techniques — apparaît seulement quand au moins une zone est cochée. */}
      {selected.length > 0 && (
        <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/70 p-3 sm:p-4">
          {selected.map((placement) => (
            <TechniqueRow
              key={placement.zone}
              zone={placement.zone}
              technique={placement.technique}
              onPick={(tech) => onTechnique(placement.zone, tech)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ZoneCard({
  zone,
  active,
  onClick,
}: {
  zone: (typeof PRINT_ZONES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onClick}
      className={[
        "group relative flex flex-col items-center gap-2 rounded-xl border bg-white p-3 text-left transition-all duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        active
          ? "border-gray-900 shadow-[0_0_0_1px_rgba(17,24,39,1)] ring-2 ring-gray-900/5"
          : "border-gray-200 hover:border-gray-300 hover:shadow-sm",
      ].join(" ")}
    >
      {/* Check pill — top right when active */}
      {active && (
        <span className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-white">
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      )}

      <div
        className={[
          "flex h-20 w-full items-center justify-center rounded-lg transition-colors",
          active ? "bg-blue-50" : "bg-gray-50 group-hover:bg-gray-100/80",
        ].join(" ")}
      >
        <ShirtZoneSVG zone={zone.id} active={active} />
      </div>

      <div className="flex w-full items-center justify-between gap-1">
        <span
          className={[
            "text-[12.5px] font-semibold tracking-tight",
            active ? "text-gray-900" : "text-gray-700",
          ].join(" ")}
        >
          {zone.label}
        </span>
        <span
          className={[
            "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
            active
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-500",
          ].join(" ")}
        >
          {zone.surcharge === 0
            ? "inclus"
            : `+${zone.surcharge.toFixed(2).replace(".", ",")}€`}
        </span>
      </div>
    </button>
  );
}

function TechniqueRow({
  zone,
  technique,
  onPick,
}: {
  zone: PrintZoneId;
  technique: Technique | null;
  onPick: (t: Technique) => void;
}) {
  const label = PRINT_ZONES.find((z) => z.id === zone)?.label ?? zone;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2.5 ring-1 ring-inset ring-gray-200 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex flex-none items-center gap-2 sm:w-32">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gray-900 text-[10px] font-bold text-white">
          <ShirtZoneSVG zone={zone} active size={14} />
        </span>
        <span className="text-[12.5px] font-semibold text-gray-900">
          {label}
        </span>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {TECHNIQUES.map((t) => {
          const on = technique === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t.id)}
              title={t.description}
              className={[
                "inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-[11.5px] font-semibold transition",
                on
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BatDropzoneGrid
// ─────────────────────────────────────────────────────────────────────────────

interface BatDropzoneGridProps {
  colors: ReferenceColor[];
  sharedMode: boolean;
  sharedFile: BatFile | null;
  filesByColor: Record<string, BatFile | null>;
  onSharedFile: (file: BatFile | null) => void;
  onColorFile: (colorId: string, file: BatFile | null) => void;
}

function BatDropzoneGrid({
  colors,
  sharedMode,
  sharedFile,
  filesByColor,
  onSharedFile,
  onColorFile,
}: BatDropzoneGridProps) {
  if (sharedMode) {
    return (
      <div className="space-y-3">
        <ColorDropzone
          mode="shared"
          colors={colors}
          file={sharedFile}
          onFile={onSharedFile}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {colors.map((color) => (
        <ColorDropzone
          key={color.id}
          mode="single"
          color={color}
          file={filesByColor[color.id] ?? null}
          onFile={(f) => onColorFile(color.id, f)}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ColorDropzone — premium drag & drop
// ─────────────────────────────────────────────────────────────────────────────

type ColorDropzoneProps =
  | {
      mode: "single";
      color: ReferenceColor;
      file: BatFile | null;
      onFile: (f: BatFile | null) => void;
    }
  | {
      mode: "shared";
      colors: ReferenceColor[];
      file: BatFile | null;
      onFile: (f: BatFile | null) => void;
    };

function ColorDropzone(props: ColorDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  // Pour libérer les ObjectURL créés.
  useEffect(() => {
    return () => {
      if (props.file?.previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(props.file.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.file?.id]);

  const handleFiles = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const f = list[0];
      const bat: BatFile = {
        id: crypto.randomUUID(),
        name: f.name,
        size: f.size,
        previewUrl: URL.createObjectURL(f),
      };
      props.onFile(bat);
    },
    [props],
  );

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const isShared = props.mode === "shared";
  const colorBadge = !isShared ? (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-full ring-1 ring-inset ring-gray-300"
        style={{ backgroundColor: props.color.hex }}
      />
      <span className="text-[11.5px] font-semibold text-gray-700">
        {props.color.label}
      </span>
      <span className="text-[10.5px] tabular-nums text-gray-400">
        · {props.color.qty} pcs
      </span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-2">
      <span className="flex -space-x-1">
        {props.colors.slice(0, 5).map((c) => (
          <span
            key={c.id}
            className="h-3 w-3 rounded-full ring-2 ring-white"
            style={{ backgroundColor: c.hex }}
          />
        ))}
      </span>
      <span className="text-[11.5px] font-semibold text-gray-700">
        Visuel partagé · {props.colors.length} couleurs
      </span>
    </span>
  );

  const filledLabel = isShared
    ? `Appliqué à ${props.colors.length} couleur${props.colors.length > 1 ? "s" : ""}`
    : `Pour ${props.color.label}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between px-0.5">
        {colorBadge}
        {props.file && (
          <button
            type="button"
            onClick={() => props.onFile(null)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Retirer le fichier"
            title="Retirer le fichier"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={[
          "group relative flex cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed bg-gray-50 transition-all duration-150",
          props.file ? "h-36 border-emerald-300 bg-white" : "h-36",
          dragging
            ? "border-blue-500 bg-blue-50/60 ring-4 ring-blue-100"
            : props.file
              ? ""
              : "border-gray-300 hover:border-gray-400 hover:bg-white",
          isShared ? "h-44" : "",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf,.ai,.svg"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {props.file ? (
          <FilledPreview file={props.file} caption={filledLabel} />
        ) : (
          <EmptyPrompt
            label={
              isShared
                ? "Glisser le visuel commun ici"
                : `Glisser le visuel pour ${props.color.label}`
            }
            dragging={dragging}
          />
        )}
      </div>
    </div>
  );
}

function EmptyPrompt({ label, dragging }: { label: string; dragging: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 text-center">
      <span
        className={[
          "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
          dragging
            ? "bg-[#4A6274] text-white"
            : "bg-white text-gray-500 ring-1 ring-inset ring-gray-200 group-hover:text-gray-700",
        ].join(" ")}
      >
        <UploadCloud className="h-4 w-4" strokeWidth={1.8} />
      </span>
      <p className="text-[12.5px] font-medium leading-snug text-gray-700">
        {label}
      </p>
      <p className="text-[10.5px] text-gray-400">
        ou <span className="font-semibold text-gray-600">parcourir</span> ·
        PNG, PDF, AI, SVG
      </p>
    </div>
  );
}

function FilledPreview({ file, caption }: { file: BatFile; caption: string }) {
  return (
    <div className="flex h-full w-full items-center gap-3 p-3">
      <div className="flex h-full w-24 flex-none items-center justify-center overflow-hidden rounded-lg bg-gray-100 ring-1 ring-inset ring-gray-200">
        {/* Si le fichier est une image, on affiche le preview ; sinon icône. */}
        {/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name) ? (
          <img
            src={file.previewUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <ImageIcon className="h-6 w-6 text-gray-400" strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
          </span>
          <span className="truncate text-[12px] font-semibold text-gray-900">
            {file.name}
          </span>
        </div>
        <p className="mt-0.5 text-[10.5px] text-gray-500">
          {formatBytes(file.size)} · {caption}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SharedToggle — "Appliquer le même visuel à toutes les couleurs"
// ─────────────────────────────────────────────────────────────────────────────

function SharedToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 select-none">
      <span className="text-[11.5px] font-medium text-gray-600">
        Même visuel pour toutes les couleurs
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          checked ? "bg-gray-900" : "bg-gray-200",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </label>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subatomic UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionTitle({
  step,
  title,
  subtitle,
  right,
}: {
  step: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-6 w-6 flex-none items-center justify-center rounded-md border border-gray-200 bg-white text-[11px] font-bold text-gray-500">
          {step}
        </span>
        <div>
          <h4 className="text-[13px] font-semibold tracking-tight text-gray-900">
            {title}
          </h4>
          {subtitle && (
            <p className="mt-0.5 text-[11.5px] text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex-none">{right}</div>}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-dashed border-gray-200" />;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        <Layers className="h-5 w-5" strokeWidth={1.6} />
      </div>
      <p className="text-[13px] font-semibold text-gray-700">
        Aucune référence à personnaliser
      </p>
      <p className="mt-1 text-[12px] text-gray-500">
        Reviens à l'étape 1 pour ajouter au moins un produit textile.
      </p>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG — t-shirt with highlighted zone
// ─────────────────────────────────────────────────────────────────────────────

function ShirtZoneSVG({
  zone,
  active,
  size = 44,
}: {
  zone: PrintZoneId;
  active: boolean;
  size?: number;
}) {
  const shirtFill = active ? "#ffffff" : "#ffffff";
  const shirtStroke = active ? "#111827" : "#cbd5e1";
  const accent = active ? "#2563eb" : "#94a3b8";
  const accentSoft = active ? "rgba(37,99,235,0.18)" : "rgba(148,163,184,0.18)";

  return (
    <svg
      viewBox="0 0 80 88"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M26,9 Q40,1 54,9 L63,2 L79,17 L72,23 L64,24 L64,82 L16,82 L16,24 L8,23 L1,17 L17,2 Z"
        fill={shirtFill}
        stroke={shirtStroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Collar accent */}
      <path
        d="M26,9 Q40,1 54,9"
        stroke={shirtStroke}
        strokeWidth="2"
        fill="none"
      />

      {zone === "front-heart" && (
        <>
          <circle cx="29" cy="27" r="7" fill={accentSoft} />
          <circle cx="29" cy="27" r="4.5" fill={accent} />
        </>
      )}
      {zone === "front-center" && (
        <rect x="22" y="33" width="36" height="22" rx="3" fill={accentSoft} stroke={accent} strokeWidth={active ? 2 : 1.4} />
      )}
      {zone === "back" && (
        <>
          <rect x="18" y="26" width="44" height="52" rx="3" fill={accentSoft} stroke={accent} strokeWidth={active ? 2 : 1.4} strokeDasharray="3 3" />
          <text x="40" y="56" textAnchor="middle" fill={accent} fontSize="10" fontWeight="700">DOS</text>
        </>
      )}
      {zone === "sleeve-left" && (
        <path d="M26,9 L17,2 L1,17 L8,23 L16,24 Z" fill={accentSoft} stroke={accent} strokeWidth={active ? 2 : 1.4} />
      )}
      {zone === "sleeve-right" && (
        <path d="M54,9 L63,2 L79,17 L72,23 L64,24 Z" fill={accentSoft} stroke={accent} strokeWidth={active ? 2 : 1.4} />
      )}
    </svg>
  );
}

// Re-export for convenience
export default CustomizationStepV2;
