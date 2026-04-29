import { computeTotals, formatEUR } from "./pricing";
import { getTextileModel } from "./runtimeCatalog";
import {
  isClassicLine,
  isTextileLine,
  type OrderHeader,
  type OrderLineRecord,
} from "./types";

const PLACEMENT_LABELS: Record<string, string> = {
  front: "Avant",
  back: "Arrière",
  "sleeve-left": "Manche G",
  "sleeve-right": "Manche D",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLineHtml(record: OrderLineRecord, index: number): {
  html: string;
  subtotal: number;
} {
  const totals = computeTotals(record.line);
  const indexBadge = `#${index + 1}`;

  if (isTextileLine(record.line)) {
    const line = record.line;
    const model = getTextileModel(line.modelId);
    const refTitle = model
      ? `${escapeHtml(model.reference)} — ${escapeHtml(model.name)} ${escapeHtml(model.target)}`
      : `Référence ${escapeHtml(line.modelId)}`;

    const placements = [
      ...(line.bodyPlacements ?? []),
      ...(line.sleeveLogoPlacements ?? []),
    ]
      .map((p) => PLACEMENT_LABELS[p] ?? p)
      .join(", ");

    // Aggregate qty per color
    const byColor = new Map<string, number>();
    for (const it of Object.values(line.items)) {
      if (it.isPlaceholder || !it.qty) continue;
      byColor.set(it.color, (byColor.get(it.color) ?? 0) + it.qty);
    }
    const colorRows = [...byColor.entries()]
      .map(([colorId, qty]) => {
        const color = model?.colors.find((c) => c.id === colorId);
        const label = color?.label ?? colorId;
        const subtotal = qty * totals.unitPrice;
        return `
          <tr>
            <td>
              <span class="swatch" style="background:${escapeHtml(color?.hex ?? "#cccccc")}"></span>
              ${escapeHtml(label)}
            </td>
            <td class="num">${qty}</td>
            <td class="num">${formatEUR(totals.unitPrice)}</td>
            <td class="num">${formatEUR(subtotal)}</td>
          </tr>`;
      })
      .join("");

    return {
      subtotal: totals.subtotal,
      html: `
        <section class="ref">
          <header class="ref-head">
            <span class="badge">${indexBadge}</span>
            <h3>${refTitle}</h3>
          </header>
          ${
            placements
              ? `<p class="placements"><strong>Emplacements :</strong> ${escapeHtml(placements)}</p>`
              : `<p class="placements muted">Aucun emplacement sélectionné (t-shirt vierge)</p>`
          }
          <table class="recap">
            <thead>
              <tr>
                <th>Couleur</th>
                <th class="num">Qté</th>
                <th class="num">PU HT</th>
                <th class="num">Sous-total</th>
              </tr>
            </thead>
            <tbody>${colorRows || `<tr><td colspan="4" class="muted">Aucune quantité saisie</td></tr>`}</tbody>
            <tfoot>
              <tr>
                <td colspan="3"><strong>Total référence</strong></td>
                <td class="num"><strong>${formatEUR(totals.subtotal)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </section>`,
    };
  }

  if (isClassicLine(record.line)) {
    const line = record.line;
    const productLabel = line.customProduit || line.produit || "(Produit non précisé)";
    return {
      subtotal: totals.subtotal,
      html: `
        <section class="ref">
          <header class="ref-head">
            <span class="badge">${indexBadge}</span>
            <h3>${escapeHtml(line.secteur)} — ${escapeHtml(productLabel)}</h3>
          </header>
          <table class="recap">
            <thead>
              <tr>
                <th>Désignation</th>
                <th class="num">Qté</th>
                <th class="num">PU HT</th>
                <th class="num">Sous-total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${escapeHtml(productLabel)}</td>
                <td class="num">${line.quantity}</td>
                <td class="num">${formatEUR(line.prixUnitaire)}</td>
                <td class="num">${formatEUR(totals.subtotal)}</td>
              </tr>
            </tbody>
          </table>
        </section>`,
    };
  }

  return { subtotal: 0, html: "" };
}

/**
 * Génère le devis rapide à partir des références et de l'en-tête courants,
 * ouvre un onglet dédié et déclenche l'impression. Le contenu reflète l'état
 * exact à l'instant T : références, emplacements, couleurs, quantités, prix
 * unitaires et total.
 */
export function printQuote(
  lines: OrderLineRecord[],
  header: OrderHeader,
): void {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let total = 0;
  const sections = lines
    .map((r, idx) => {
      const built = buildLineHtml(r, idx);
      total += built.subtotal;
      return built.html;
    })
    .join("\n");

  const clientLine = header.clientNom
    ? `<p><strong>Client :</strong> ${escapeHtml(header.clientNom)}${header.personneContact ? ` — ${escapeHtml(header.personneContact)}` : ""}</p>`
    : `<p class="muted">Client non renseigné</p>`;

  const html = `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <title>Devis rapide — ${today}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
          sans-serif;
        color: #0f172a;
        margin: 0;
        padding: 32px 40px;
        background: #fff;
      }
      header.doc {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        border-bottom: 2px solid #0f172a;
        padding-bottom: 12px;
        margin-bottom: 18px;
      }
      header.doc h1 {
        margin: 0;
        font-size: 22px;
        letter-spacing: -0.01em;
      }
      header.doc .meta {
        font-size: 12px;
        color: #475569;
        text-align: right;
      }
      .client {
        margin: 0 0 18px;
        font-size: 13px;
      }
      .ref { margin: 0 0 22px; }
      .ref-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0 0 6px;
      }
      .ref-head h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        background: #0f172a;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
      }
      .placements {
        margin: 4px 0 8px;
        font-size: 12.5px;
        color: #334155;
      }
      .placements.muted { color: #94a3b8; font-style: italic; }
      table.recap {
        width: 100%;
        border-collapse: collapse;
        font-size: 12.5px;
      }
      table.recap th, table.recap td {
        padding: 6px 8px;
        border-bottom: 1px solid #e2e8f0;
        text-align: left;
      }
      table.recap th {
        background: #f1f5f9;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 10.5px;
        letter-spacing: 0.04em;
        color: #475569;
      }
      table.recap td.num, table.recap th.num { text-align: right; }
      table.recap tfoot td { border-top: 2px solid #0f172a; border-bottom: 0; }
      .swatch {
        display: inline-block;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        margin-right: 6px;
        vertical-align: middle;
        border: 1px solid #cbd5e1;
      }
      .total {
        margin-top: 24px;
        padding-top: 12px;
        border-top: 3px double #0f172a;
        display: flex;
        justify-content: flex-end;
        align-items: baseline;
        gap: 16px;
      }
      .total .label {
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .total .amount { font-size: 22px; font-weight: 800; }
      .footer {
        margin-top: 28px;
        font-size: 10.5px;
        color: #94a3b8;
        text-align: center;
      }
      .muted { color: #94a3b8; }
      @media print {
        body { padding: 16mm; }
        .ref { page-break-inside: avoid; }
      }
    </style>
  </head>
  <body>
    <header class="doc">
      <h1>Devis rapide</h1>
      <div class="meta">
        <div>${escapeHtml(today)}</div>
      </div>
    </header>
    <div class="client">${clientLine}</div>
    ${sections || `<p class="muted">Aucune référence dans la demande.</p>`}
    <div class="total">
      <span class="label">Total HT</span>
      <span class="amount">${formatEUR(total)}</span>
    </div>
    <p class="footer">Devis non contractuel — tarifs provisoires en attente de calibrage final.</p>
    <script>
      window.addEventListener('load', function () {
        setTimeout(function () { window.print(); }, 100);
      });
    </script>
  </body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) {
    alert(
      "Impossible d'ouvrir la fenêtre d'impression. Autorisez les pop-ups pour ce site.",
    );
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
