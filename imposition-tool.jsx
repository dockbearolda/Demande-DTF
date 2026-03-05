import { useState, useRef, useCallback, useEffect } from "react";

const SHEET_WIDTH_MM = 600;
const SHEET_HEIGHT_MM = 300;
const MAGNET_DIAMETER_MM = 49;
const MAGNET_RADIUS_MM = MAGNET_DIAMETER_MM / 2;
const BLEED_MM = 3;
const COLS = 10;
const ROWS = 5;
const H_GAP = (SHEET_WIDTH_MM - COLS * MAGNET_DIAMETER_MM) / (COLS + 1);
const V_GAP = (SHEET_HEIGHT_MM - ROWS * MAGNET_DIAMETER_MM) / (ROWS + 1);
const SCALE_INIT = 1.3;
const BACKEND_URL = "";

const generateSlots = () => {
  const slots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = H_GAP + c * (MAGNET_DIAMETER_MM + H_GAP) + MAGNET_RADIUS_MM;
      const cy = V_GAP + r * (MAGNET_DIAMETER_MM + V_GAP) + MAGNET_RADIUS_MM;
      slots.push({ id: `${r}-${c}`, cx, cy, logo: null });
    }
  }
  return slots;
};

export default function ImpositionTool() {
  const [slots, setSlots] = useState(generateSlots());
  const [logos, setLogos] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [scale, setScale] = useState(SCALE_INIT);
  const fileInputRef = useRef();
  const canvasRef = useRef();

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const compute = () => {
      const pad = 48;
      const scaleX = (el.clientWidth - pad) / SHEET_WIDTH_MM;
      const scaleY = (el.clientHeight - pad) / SHEET_HEIGHT_MM;
      setScale(Math.min(scaleX, scaleY));
    };
    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sheetW = SHEET_WIDTH_MM * scale;
  const sheetH = SHEET_HEIGHT_MM * scale;

  const handleFiles = useCallback((files) => {
    Array.from(files).forEach((file) => {
      if (!file.type.includes("pdf") && !file.type.includes("svg") && !file.type.includes("image")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const id = `logo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setLogos((prev) => [...prev, { id, name: file.name.replace(/\.[^.]+$/, ""), dataUrl: e.target.result, type: file.type, usageCount: 0 }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleSlotDrop = useCallback((slotId) => {
    if (!dragging) return;
    setSlots((prev) => prev.map((s) => {
      if (s.id === slotId) return { ...s, logo: dragging.logoId };
      if (dragging.source === "slot" && s.id === dragging.slotId) return { ...s, logo: null };
      return s;
    }));
    setLogos((prev) => prev.map((l) => {
      if (l.id === dragging.logoId) {
        const wasInSlot = dragging.source === "slot";
        return { ...l, usageCount: wasInSlot ? l.usageCount : l.usageCount + 1 };
      }
      return l;
    }));
    setDragging(null);
    setHoveredSlot(null);
  }, [dragging]);

  const clearSlot = (slotId) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot?.logo) return;
    setLogos((prev) => prev.map((l) => l.id === slot.logo ? { ...l, usageCount: Math.max(0, l.usageCount - 1) } : l));
    setSlots((prev) => prev.map((s) => s.id === slotId ? { ...s, logo: null } : s));
  };

  const fillAll = (logoId) => {
    const emptyCount = slots.filter((s) => !s.logo).length;
    setSlots((prev) => prev.map((s) => s.logo ? s : { ...s, logo: logoId }));
    setLogos((prev) => prev.map((l) => l.id === logoId ? { ...l, usageCount: l.usageCount + emptyCount } : l));
  };

  const clearAll = () => {
    setSlots(generateSlots());
    setLogos((prev) => prev.map((l) => ({ ...l, usageCount: 0 })));
    setSelectedSlot(null);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const payload = {
        logos: slots.map((slot) => {
          const logo = slot.logo ? logos.find((l) => l.id === slot.logo) : null;
          return {
            slot_id: slot.id,
            cx_mm: slot.cx,
            cy_mm: slot.cy,
            logo_data: logo ? logo.dataUrl : null,
            logo_type: logo ? logo.type : null,
            logo_name: logo ? logo.name : null,
          };
        }),
      };

      const response = await fetch(`${BACKEND_URL}/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Erreur serveur");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `OLDA_Imposition_${slots.filter(s => s.logo).length}_logos.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(`Erreur : ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const logoMap = Object.fromEntries(logos.map((l) => [l.id, l]));
  const filledCount = slots.filter((s) => s.logo).length;
  const activeSlot = selectedSlot ? slots.find(s => s.id === selectedSlot) : null;
  const activeLogo = activeSlot?.logo ? logoMap[activeSlot.logo] : null;
  const [activeRow, activeCol] = selectedSlot ? selectedSlot.split("-").map(Number) : [null, null];

  return (
    <div style={s.root}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* HEADER */}
      <header style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.brand}>◆ OLDA</span>
          <span style={s.headerSub}>Imposition</span>
        </div>
        <div style={s.headerRight}>
          <span style={s.counter}>{filledCount} / {slots.length} magnets</span>
          <button style={{ ...s.btn, ...s.btnGhost }} onClick={clearAll}>Tout effacer</button>
          <button
            style={{ ...s.btn, ...s.btnPrimary, opacity: filledCount === 0 ? 0.4 : 1 }}
            disabled={filledCount === 0 || generating}
            onClick={handleGenerate}
          >
            {generating ? <span style={s.spin} /> : "Générer PDF →"}
          </button>
        </div>
      </header>

      <div style={s.workspace}>

        {/* LEFT PANEL */}
        <aside style={s.leftPanel}>
          <div style={s.sectionLabel}>Logos clients</div>
          <div style={s.dropZone} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}>
            <input ref={fileInputRef} type="file" multiple accept=".pdf,.svg,.ai,.png,.jpg" style={{ display: "none" }} onChange={(e) => handleFiles(e.target.files)} />
            <div style={s.dropIcon}>⊕</div>
            <div style={s.dropText}>PDF · SVG · PNG</div>
            <div style={s.dropSub}>Glisser ou cliquer</div>
          </div>

          <div style={s.logoList}>
            {logos.length === 0 && <div style={s.emptyMsg}>Aucun logo importé</div>}
            {logos.map((logo) => (
              <div
                key={logo.id}
                draggable
                onDragStart={() => { setDragging({ logoId: logo.id, source: "panel" }); setSelectedLogo(logo.id); }}
                onDragEnd={() => setDragging(null)}
                onClick={() => setSelectedLogo(logo.id === selectedLogo ? null : logo.id)}
                style={{ ...s.logoCard, outline: selectedLogo === logo.id ? "1.5px solid #0071e3" : "1.5px solid transparent" }}
              >
                <div style={s.logoThumb}>
                  {logo.type.includes("pdf") ? <span style={s.pdfBadge}>PDF</span> : <img src={logo.dataUrl} alt={logo.name} style={s.logoImg} />}
                </div>
                <div style={s.logoMeta}>
                  <div style={s.logoName}>{logo.name}</div>
                  <div style={s.logoCount}>{logo.usageCount}×</div>
                </div>
                <button style={s.fillBtn} title="Remplir tous les vides" onClick={(e) => { e.stopPropagation(); fillAll(logo.id); }}>⊞</button>
              </div>
            ))}
          </div>

          <div style={s.legend}>
            <div style={s.sectionLabel}>Couches PDF</div>
            {[
              { color: "#FFD700", label: "CutContour", desc: "+3mm" },
              { color: "#ffffff", label: "RDG_WHITE",  desc: "Blanc" },
              { color: "#cccccc", label: "RDG_GLOSS",  desc: "Vernis" },
            ].map(item => (
              <div key={item.label} style={s.legendRow}>
                <span style={{ ...s.legendDot, background: item.color, border: item.color === "#ffffff" ? "1px solid #444" : "none" }} />
                <span style={s.legendLabel}>{item.label}</span>
                <span style={s.legendDesc}>{item.desc}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* SHEET CANVAS */}
        <main ref={canvasRef} style={s.canvas}>
          <div style={s.sheetLabel}>Planche Roland — {SHEET_WIDTH_MM} × {SHEET_HEIGHT_MM} mm</div>
          <div style={{ ...s.sheet, width: sheetW, height: sheetH }} onDragOver={(e) => e.preventDefault()}>
            <svg style={s.svg} width={sheetW} height={sheetH} viewBox={`0 0 ${SHEET_WIDTH_MM} ${SHEET_HEIGHT_MM}`}>
              <rect x={0} y={0} width={SHEET_WIDTH_MM} height={SHEET_HEIGHT_MM} fill="none" stroke="#ddd" strokeWidth="0.3" />
              <defs>
                {slots.map((slot) => {
                  const logo = slot.logo ? logoMap[slot.logo] : null;
                  if (!logo || logo.type.includes("pdf")) return null;
                  return (
                    <clipPath key={`clip-${slot.id}`} id={`clip-${slot.id}`}>
                      <circle cx={slot.cx} cy={slot.cy} r={MAGNET_RADIUS_MM} />
                    </clipPath>
                  );
                })}
              </defs>
              {slots.map((slot) => {
                const logo = slot.logo ? logoMap[slot.logo] : null;
                const isHovered = hoveredSlot === slot.id;
                const isSelected = selectedSlot === slot.id;
                return (
                  <g key={slot.id}>
                    <circle cx={slot.cx} cy={slot.cy} r={MAGNET_RADIUS_MM + BLEED_MM}
                      fill="none"
                      stroke={isSelected ? "#0071e3" : isHovered ? "#4da3ff" : "#FFD700"}
                      strokeWidth={isSelected ? 1.2 : 0.8}
                      strokeDasharray="2 1"
                      opacity={isSelected ? 1 : 0.9}
                    />
                    <circle cx={slot.cx} cy={slot.cy} r={MAGNET_RADIUS_MM}
                      fill={isHovered && !logo ? "rgba(0,113,227,0.12)" : "rgba(255,255,255,0.04)"}
                      stroke={isSelected ? "#0071e3" : isHovered ? "#4da3ff" : "#888"}
                      strokeWidth={isSelected ? 1 : 0.6}
                    />
                    {logo && !logo.type.includes("pdf") && (
                      <image
                        href={logo.dataUrl}
                        x={slot.cx - MAGNET_RADIUS_MM}
                        y={slot.cy - MAGNET_RADIUS_MM}
                        width={MAGNET_DIAMETER_MM}
                        height={MAGNET_DIAMETER_MM}
                        clipPath={`url(#clip-${slot.id})`}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    )}
                    {logo && logo.type.includes("pdf") && (
                      <text x={slot.cx} y={slot.cy + 1} textAnchor="middle" dominantBaseline="middle" fontSize="4" fill="#888">PDF</text>
                    )}
                    {!logo && (
                      <circle cx={slot.cx} cy={slot.cy} r={1.2} fill={isHovered ? "#0071e3" : "#888"} />
                    )}
                    {/* Hit zone */}
                    <circle cx={slot.cx} cy={slot.cy} r={MAGNET_RADIUS_MM + BLEED_MM}
                      fill="transparent" style={{ cursor: "pointer" }}
                      onDragOver={(e) => { e.preventDefault(); setHoveredSlot(slot.id); }}
                      onDragLeave={() => setHoveredSlot(null)}
                      onDrop={(e) => { e.preventDefault(); handleSlotDrop(slot.id); }}
                      onDoubleClick={() => clearSlot(slot.id)}
                      onClick={() => { setSelectedSlot(slot.id); setPreviewOpen(true); }}
                      draggable={!!logo}
                      onDragStart={logo ? () => setDragging({ logoId: logo.id, source: "slot", slotId: slot.id }) : undefined}
                    />
                  </g>
                );
              })}
            </svg>
          </div>
          <div style={s.hint}>Clic — inspecter · Double-clic — effacer · Drag — placer</div>
        </main>

        {/* RIGHT FLOATING WINDOW */}
        {previewOpen && (
          <div style={s.floatWindow}>
            <div style={s.winBar}>
              <div style={s.winDots}>
                <span style={{ ...s.dot, background: "#ff5f57" }} onClick={() => setPreviewOpen(false)} />
                <span style={{ ...s.dot, background: "#febc2e" }} />
                <span style={{ ...s.dot, background: "#28c840" }} />
              </div>
              <span style={s.winTitle}>{activeSlot ? `L${activeRow + 1} · C${activeCol + 1}` : "Aperçu"}</span>
              <span style={{ width: 44 }} />
            </div>

            <div style={s.winBody}>
              {!activeSlot ? (
                <div style={s.previewEmpty}>
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#222" strokeWidth="1.5" strokeDasharray="4 3" />
                    <circle cx="36" cy="36" r="22" fill="none" stroke="#1a1a1a" strokeWidth="1" />
                    <circle cx="36" cy="36" r="2.5" fill="#252525" />
                  </svg>
                  <div style={s.previewEmptyText}>Cliquez sur un cercle<br />pour l'inspecter</div>
                </div>
              ) : (
                <>
                  <div style={s.previewCircleArea}>
                    <div style={s.previewOuter}>
                      <div style={s.previewInner}>
                        {activeLogo && !activeLogo.type.includes("pdf") ? (
                          <img src={activeLogo.dataUrl} style={s.previewImg} alt="logo" />
                        ) : activeLogo ? (
                          <span style={s.previewPdf}>PDF</span>
                        ) : (
                          <span style={s.previewVide}>vide</span>
                        )}
                      </div>
                    </div>
                    <div style={s.previewCutLabel}>⬡ CutContour +{BLEED_MM}mm</div>
                  </div>

                  <div style={s.infoBlock}>
                    {[
                      ["Position", `L${activeRow + 1}, Col ${activeCol + 1}`],
                      ["Centre X", `${activeSlot.cx.toFixed(1)} mm`],
                      ["Centre Y", `${activeSlot.cy.toFixed(1)} mm`],
                      ["Diamètre", `${MAGNET_DIAMETER_MM} mm`],
                      ["Découpe Ø", `${MAGNET_DIAMETER_MM + BLEED_MM * 2} mm`],
                    ].map(([k, v]) => (
                      <div key={k} style={s.infoRow}>
                        <span style={s.infoKey}>{k}</span>
                        <span style={s.infoVal}>{v}</span>
                      </div>
                    ))}
                    <div style={s.infoRow}>
                      <span style={s.infoKey}>Logo</span>
                      <span style={{ ...s.infoVal, color: activeLogo ? "#30d158" : "#3a3a3a" }}>
                        {activeLogo ? activeLogo.name : "— vide —"}
                      </span>
                    </div>
                    {activeLogo && (
                      <div style={s.infoRow}>
                        <span style={s.infoKey}>Utilisations</span>
                        <span style={s.infoVal}>{activeLogo.usageCount}×</span>
                      </div>
                    )}
                  </div>

                  <div style={s.winActions}>
                    <button
                      style={{ ...s.winBtn, background: "#1e0a0a", color: activeLogo ? "#ff453a" : "#2a2a2a", cursor: activeLogo ? "pointer" : "default" }}
                      onClick={() => activeLogo && clearSlot(activeSlot.id)}
                    >
                      Effacer
                    </button>
                    {activeLogo && (
                      <button style={{ ...s.winBtn, background: "#00122a", color: "#0071e3" }} onClick={() => fillAll(activeLogo.id)}>
                        Remplir tout
                      </button>
                    )}
                  </div>

                  <div style={s.layerBlock}>
                    <div style={s.sectionLabel}>Couches générées</div>
                    {[
                      { dot: "#0071e3", label: "CMJN", active: !!activeLogo },
                      { dot: "#ffffff", label: "RDG_WHITE", active: !!activeLogo },
                      { dot: "#cccccc", label: "RDG_GLOSS", active: !!activeLogo },
                      { dot: "#FFD700", label: "CutContour", active: true },
                    ].map(item => (
                      <div key={item.label} style={s.layerRow}>
                        <span style={{ ...s.layerDot, background: item.dot, border: item.dot === "#ffffff" ? "1px solid #444" : "none" }} />
                        <span style={{ ...s.layerLabel, color: item.active ? "#888" : "#2a2a2a" }}>{item.label}</span>
                        <span style={{ fontSize: 10, color: item.active ? "#30d158" : "#2a2a2a" }}>{item.active ? "✓" : "—"}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {!previewOpen && (
          <button style={s.reopenBtn} onClick={() => setPreviewOpen(true)}>›</button>
        )}
      </div>
    </div>
  );
}

const s = {
  root: { minHeight: "100vh", background: "#111", color: "#e8e8e8", fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", height: 52, borderBottom: "1px solid #1a1a1a", background: "#111", position: "sticky", top: 0, zIndex: 100, flexShrink: 0 },
  headerLeft: { display: "flex", alignItems: "center", gap: 14 },
  brand: { fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: "#fff" },
  headerSub: { fontSize: 11, color: "#3a3a3a", letterSpacing: "0.1em", textTransform: "uppercase" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  counter: { fontSize: 12, color: "#555", marginRight: 4 },
  btn: { border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", fontWeight: 500 },
  btnGhost: { background: "#1a1a1a", color: "#777" },
  btnPrimary: { background: "#0071e3", color: "#fff", display: "flex", alignItems: "center", gap: 5 },
  spin: { display: "inline-block", width: 11, height: 11, border: "2px solid rgba(255,255,255,0.2)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  workspace: { display: "flex", flex: 1, overflow: "hidden" },
  leftPanel: { width: 210, borderRight: "1px solid #1a1a1a", padding: "16px 13px", display: "flex", flexDirection: "column", gap: 13, overflowY: "auto", background: "#111", flexShrink: 0 },
  sectionLabel: { fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#3a3a3a", marginBottom: 4 },
  dropZone: { border: "1.5px dashed #222", borderRadius: 9, padding: "16px 10px", textAlign: "center", cursor: "pointer" },
  dropIcon: { fontSize: 20, color: "#2a2a2a", marginBottom: 5 },
  dropText: { fontSize: 11, color: "#555", marginBottom: 3 },
  dropSub: { fontSize: 10, color: "#333" },
  logoList: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  emptyMsg: { fontSize: 11, color: "#2a2a2a", textAlign: "center", padding: "8px 0" },
  logoCard: { display: "flex", alignItems: "center", gap: 8, background: "#151515", borderRadius: 7, padding: "6px 8px", cursor: "grab" },
  logoThumb: { width: 32, height: 32, borderRadius: 5, background: "#1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  pdfBadge: { fontSize: 8, color: "#666", fontWeight: 700 },
  logoImg: { width: "100%", height: "100%", objectFit: "contain" },
  logoMeta: { flex: 1, minWidth: 0 },
  logoName: { fontSize: 11, fontWeight: 500, color: "#bbb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  logoCount: { fontSize: 10, color: "#3a3a3a", marginTop: 1 },
  fillBtn: { background: "none", border: "none", color: "#2a2a2a", fontSize: 14, cursor: "pointer", padding: 0, flexShrink: 0 },
  legend: { borderTop: "1px solid #1a1a1a", paddingTop: 12 },
  legendRow: { display: "flex", alignItems: "center", gap: 7, marginBottom: 6 },
  legendDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  legendLabel: { fontSize: 10, color: "#555", width: 70 },
  legendDesc: { fontSize: 10, color: "#2a2a2a" },
  canvas: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", overflowY: "auto", overflowX: "auto", background: "#0c0c0c" },
  sheetLabel: { fontSize: 10, color: "#2a2a2a", marginBottom: 10, letterSpacing: "0.1em", textTransform: "uppercase" },
  sheet: { background: "#fff", boxShadow: "0 0 0 1px #1a1a1a, 0 20px 80px rgba(0,0,0,0.9)", borderRadius: 2, position: "relative", flexShrink: 0 },
  svg: { position: "absolute", top: 0, left: 0 },
  hint: { marginTop: 12, fontSize: 10, color: "#252525", letterSpacing: "0.04em" },
  floatWindow: { width: 230, flexShrink: 0, borderLeft: "1px solid #1a1a1a", background: "#131313", display: "flex", flexDirection: "column", overflow: "hidden" },
  winBar: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: "1px solid #1a1a1a", background: "#0f0f0f", flexShrink: 0 },
  winDots: { display: "flex", gap: 6, alignItems: "center" },
  dot: { width: 11, height: 11, borderRadius: "50%", cursor: "pointer", display: "block" },
  winTitle: { fontSize: 11, color: "#444", letterSpacing: "0.05em", fontWeight: 500 },
  winBody: { flex: 1, overflowY: "auto", padding: "14px 13px", display: "flex", flexDirection: "column", gap: 14 },
  previewEmpty: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "40px 0" },
  previewEmptyText: { fontSize: 11, color: "#2a2a2a", textAlign: "center", lineHeight: 1.8 },
  previewCircleArea: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 },
  previewOuter: { width: 104, height: 104, borderRadius: "50%", border: "1.5px dashed #FFD700", display: "flex", alignItems: "center", justifyContent: "center" },
  previewInner: { width: 84, height: 84, borderRadius: "50%", border: "1px solid #222", background: "#181818", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  previewImg: { width: "100%", height: "100%", objectFit: "contain" },
  previewPdf: { fontSize: 10, color: "#555", fontWeight: 700 },
  previewVide: { fontSize: 10, color: "#222" },
  previewCutLabel: { fontSize: 9, color: "#856800", letterSpacing: "0.05em" },
  infoBlock: { display: "flex", flexDirection: "column" },
  infoRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #1a1a1a" },
  infoKey: { fontSize: 9, color: "#3a3a3a", letterSpacing: "0.08em", textTransform: "uppercase" },
  infoVal: { fontSize: 11, color: "#bbb", fontVariantNumeric: "tabular-nums" },
  winActions: { display: "flex", gap: 7 },
  winBtn: { flex: 1, border: "none", borderRadius: 7, padding: "7px 0", fontSize: 11, cursor: "pointer", fontWeight: 500 },
  layerBlock: { display: "flex", flexDirection: "column", gap: 8 },
  layerRow: { display: "flex", alignItems: "center", gap: 8 },
  layerDot: { width: 7, height: 7, borderRadius: "50%", flexShrink: 0 },
  layerLabel: { fontSize: 10, flex: 1 },
  reopenBtn: { position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "#1a1a1a", border: "1px solid #222", color: "#555", borderRadius: "8px 0 0 8px", padding: "12px 7px", fontSize: 14, cursor: "pointer" },
};
