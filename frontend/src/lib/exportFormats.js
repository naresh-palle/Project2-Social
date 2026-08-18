/** Client-side export helpers — CSV / Excel / PDF / Word Doc (no extra deps). */

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeRows(rows) {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return { headers: [], rows: [] };
  const headers = Object.keys(list[0] || {});
  const normalized = list.map((row) =>
    headers.map((h) => {
      const v = row?.[h];
      if (v == null) return "";
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    })
  );
  return { headers, rows: normalized };
}

export function exportCsv({ rows, filename, meta = "" }) {
  const { headers, rows: body } = normalizeRows(rows);
  const lines = [];
  if (meta) lines.push(`# ${meta}`);
  lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));
  body.forEach((cols) => {
    lines.push(cols.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","));
  });
  downloadBlob(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }), filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

/** Excel-compatible SpreadsheetML (.xls) — opens in Excel / Sheets / LibreOffice. */
export function exportExcel({ rows, filename, sheetName = "flugr Export", meta = "" }) {
  const { headers, rows: body } = normalizeRows(rows);
  const headerCells = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
  const bodyRows = body
    .map(
      (cols) =>
        `<Row>${cols
          .map((c) => {
            const n = Number(c);
            const isNum = c !== "" && Number.isFinite(n) && String(c).trim() === String(n);
            return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(c)}</Data></Cell>`;
          })
          .join("")}</Row>`
    )
    .join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName)}">
  <Table>
   ${meta ? `<Row><Cell ss:MergeAcross="${Math.max(headers.length - 1, 0)}"><Data ss:Type="String">${escapeXml(meta)}</Data></Cell></Row>` : ""}
   <Row>${headerCells}</Row>
   ${bodyRows}
  </Table>
 </Worksheet>
</Workbook>`;
  const name = filename.replace(/\.(csv|xlsx|xls|pdf|doc|docx)$/i, "");
  downloadBlob(
    new Blob([xml], { type: "application/vnd.ms-excel" }),
    `${name}.xls`
  );
}

/** Minimal multi-page text PDF (Helvetica). */
export function exportPdf({ rows, filename, title = "flugr Export", meta = "" }) {
  const { headers, rows: body } = normalizeRows(rows);
  const linesArr = [
    meta,
    "",
    headers.join(" | "),
    "-".repeat(Math.min(90, Math.max(20, headers.join(" | ").length))),
    ...body.map((cols) => cols.join(" | ")),
  ].filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const lineHeight = 12;
  const maxLines = Math.floor((pageHeight - margin * 2 - 80) / lineHeight);
  const pages = [];
  for (let i = 0; i < Math.max(linesArr.length, 1); i += maxLines) {
    pages.push(linesArr.slice(i, i + maxLines));
  }
  if (!pages.length) pages.push(["No data"]);

  const objs = [];
  const pushObj = (bodyStr) => {
    objs.push(bodyStr);
    return objs.length;
  };
  const fontId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pdfEscape = (str) =>
    String(str)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/[\r\n]+/g, " ");

  const contentIds = pages.map((pageItems) => {
    let ops = "q\n";
    ops += "1 0.23 0.18 rg\n"; // #FF3B30 Header Background
    ops += "0 710 612 82 re f\n";
    ops += "1 1 1 rg\n"; // White Text
    ops += `BT /F2 16 Tf ${margin} 750 Td (${pdfEscape(title)}) Tj ET\n`;
    ops += "Q\n";
    
    ops += "q 0.15 0.15 0.15 rg\n"; // Dark Gray Text
    ops += pageItems
      .map((text, i) => {
        const font = i === 0 ? "F2" : "F1";
        const y = 680 - i * lineHeight;
        const safe = pdfEscape(text).slice(0, 110);
        return `BT /${font} 9 Tf ${margin} ${y} Td (${safe}) Tj ET`;
      })
      .join("\n");
    ops += "\nQ";
    
    const stream = `${ops}\n`;
    return pushObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  const pageIds = contentIds.map((cid) =>
    pushObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cid} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`
    )
  );
  const pagesId = pushObj(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  pageIds.forEach((pid, i) => {
    objs[pid - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`;
  });
  const catalogId = pushObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((bodyStr, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${bodyStr}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const name = filename.replace(/\.(csv|xlsx|xls|pdf|doc|docx)$/i, "");
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `${name}.pdf`);
}

function pdfEscape(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapWords(text, maxChars) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

function buildPdfFromBlocks(blocks, filename) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const maxWidthChars = 88;
  const laid = [];

  for (const b of blocks) {
    const kind = b.kind || "body";
    if (kind === "spacer") {
      laid.push({ text: " ", size: 10, gap: b.gap || 10 });
      continue;
    }
    const size = kind === "h1" ? 18 : kind === "h2" ? 13 : kind === "meta" ? 9 : 10;
    const gap = kind === "h1" ? 8 : kind === "h2" ? 6 : kind === "meta" ? 4 : 3;
    const max = kind === "h1" ? 42 : kind === "h2" ? 58 : maxWidthChars;
    for (const line of wrapWords(b.text, max)) {
      laid.push({ text: line, size, gap });
    }
    if (kind === "h1" || kind === "h2") laid.push({ text: " ", size: 8, gap: 4 });
  }

  const pages = [];
  let page = [];
  let y = pageHeight - margin;
  for (const item of laid) {
    const need = item.size + item.gap;
    if (y - need < margin) {
      pages.push(page);
      page = [];
      y = pageHeight - margin;
    }
    page.push({ ...item, y });
    y -= need;
  }
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([{ text: "flugr Report", size: 14, gap: 8, y: pageHeight - margin }]);

  const objs = [];
  const pushObj = (bodyStr) => {
    objs.push(bodyStr);
    return objs.length;
  };
  const fontId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const contentIds = pages.map((pageItems) => {
    const ops = pageItems
      .map((item) => {
        const font = item.size >= 12 ? "F2" : "F1";
        const safe = pdfEscape(item.text).slice(0, 120);
        return `BT /${font} ${item.size} Tf ${margin} ${item.y} Td (${safe}) Tj ET`;
      })
      .join("\n");
    const stream = `${ops}\n`;
    return pushObj(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  const pageIds = contentIds.map((cid) =>
    pushObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cid} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`
    )
  );
  const pagesId = pushObj(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  pageIds.forEach((pid, i) => {
    objs[pid - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >> >> >>`;
  });
  const catalogId = pushObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objs.forEach((bodyStr, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${bodyStr}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objs.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;

  const name = filename.replace(/\.(csv|xlsx|xls|pdf|doc|docx)$/i, "");
  downloadBlob(new Blob([pdf], { type: "application/pdf" }), `${name}.pdf`);
}

function listText(v) {
  if (Array.isArray(v)) return v.filter(Boolean).join(", ");
  if (v == null) return "";
  return String(v);
}

/**
 * Polished multi-section profile PDF (narrative report — not JSON / pipe tables).
 * Pass optional `aiSummary` from an LLM endpoint for an AI-written executive summary.
 */
export function exportProfileReportPdf({
  filename,
  user = {},
  posts = [],
  follows = [],
  messages = [],
  exportedAt = "",
  aiSummary = "",
}) {
  const role = user.role || "member";
  const isBrand = role === "owner" || role === "agent";
  const primary = isBrand
    ? String(user.company || user.name || "Brand").trim()
    : String(user.username || user.handle || user.name || "Influencer").replace(/^@/, "").trim();
  const niches = listText(user.niches || user.category) || "General";
  const city = [user.city, user.state].filter(Boolean).join(", ") || user.location || "Not specified";
  const when = exportedAt || new Date().toISOString();
  const dateLabel = when.slice(0, 10);

  const summary =
    (aiSummary && String(aiSummary).trim()) ||
    (isBrand
      ? `${primary} is a brand account on flugr operating in ${user.industry || niches}. Based in ${city}, this profile manages campaign briefs, creator outreach, and escrow-backed collaborations. This report summarises the account’s stored profile and recent activity snapshot.`
      : `${primary} is an influencer on flugr focused on ${niches}. Located in ${city}, this profile is positioned for brand collaborations with escrow protection. This AI-curated report presents a readable overview of the account — not a raw data dump.`);

  const profileLines = [
    ["Display name", primary],
    ["Role", role],
    isBrand ? ["Company / Brand", user.company || primary] : ["Username", user.username || user.handle || "—"],
    ["Contact name", user.name || "—"],
    ["Email", user.email || "—"],
    ["Location", city],
    ["Niches / Category", niches],
    ["Industry", user.industry || "—"],
    ["Languages", listText(user.languages) || "—"],
    ["Website", user.website || "—"],
    ["Gender", user.gender || "—"],
    ["Date of birth", user.date_of_birth || "—"],
    ["Bio", user.bio || "—"],
  ];

  const blocks = [
    { kind: "h1", text: "flugr · Personal Data Report" },
    { kind: "meta", text: `AI-curated profile summary · Generated ${dateLabel}` },
    { kind: "meta", text: `Account: ${primary} · Role: ${role}` },
    { kind: "spacer", gap: 12 },
    { kind: "h2", text: "1. Executive Summary" },
    { kind: "body", text: summary },
    { kind: "spacer", gap: 10 },
    { kind: "h2", text: "2. Profile Overview" },
    ...profileLines.flatMap(([k, v]) => [{ kind: "body", text: `${k}: ${v}` }]),
    { kind: "spacer", gap: 10 },
    { kind: "h2", text: "3. Activity Snapshot" },
    {
      kind: "body",
      text: `Posts on file: ${posts.length}. Follow relationships: ${follows.length}. Recent messages sampled: ${messages.length}.`,
    },
    { kind: "spacer", gap: 8 },
    { kind: "h2", text: "4. Recent Posts" },
  ];

  if (!posts.length) {
    blocks.push({ kind: "body", text: "No posts recorded for this account." });
  } else {
    posts.slice(0, 12).forEach((p, i) => {
      const title = (p.title || p.text || "Untitled post").toString().replace(/\s+/g, " ").slice(0, 160);
      blocks.push({ kind: "body", text: `${i + 1}. ${title}` });
    });
  }

  blocks.push({ kind: "spacer", gap: 8 });
  blocks.push({ kind: "h2", text: "5. Collaboration Notes" });
  blocks.push({
    kind: "body",
    text: isBrand
      ? "Use this report when briefing agencies or internal stakeholders. Sensitive credentials (passwords, 2FA secrets) are never included."
      : "Share this report with brand partners as a polished portfolio snapshot. Raw JSON exports are intentionally omitted for readability.",
  });
  blocks.push({ kind: "spacer", gap: 10 });
  blocks.push({ kind: "meta", text: "© flugr · Confidential account export · Not a legal identity document" });

  buildPdfFromBlocks(blocks, filename || `cr8-profile-${dateLabel}`);
}

/** Generates a polished PDF report for a list of items, including an AI executive summary. */
export function exportAiReportPdf({
  rows,
  filename,
  title = "flugr Data Report",
  aiSummary = "Data snapshot summary.",
}) {
  const { headers, rows: body } = normalizeRows(rows);
  const dateLabel = new Date().toISOString().slice(0, 10);
  
  const blocks = [];
  blocks.push({ kind: "h1", text: title });
  blocks.push({ kind: "spacer", gap: 10 });
  
  // AI Summary section
  blocks.push({ kind: "h2", text: "Executive Summary" });
  blocks.push({ kind: "body", text: String(aiSummary) });
  blocks.push({ kind: "spacer", gap: 20 });
  
  // Data Overview
  blocks.push({ kind: "h2", text: "Data Overview" });
  blocks.push({ kind: "body", text: `Total records in this report: ${body.length}` });
  blocks.push({ kind: "spacer", gap: 10 });
  
  // Group rows for easier reading
  blocks.push({ kind: "h2", text: "Included Records" });
  const names = body.map((cols, idx) => {
    // Just grab the first non-empty column (usually username or email)
    const primary = cols.find(c => c && String(c).trim() !== "") || `Record ${idx + 1}`;
    return primary;
  });
  
  // Chunk names to avoid huge paragraphs
  const chunkSize = 20;
  for (let i = 0; i < names.length; i += chunkSize) {
    blocks.push({ kind: "body", text: names.slice(i, i + chunkSize).join(" • ") });
  }

  blocks.push({ kind: "spacer", gap: 15 });
  blocks.push({ kind: "meta", text: `© flugr · Generated on ${dateLabel}` });

  buildPdfFromBlocks(blocks, filename || `cr8-report-${dateLabel}`);
}

/** Word-compatible HTML document (.doc). */
export function exportDoc({ rows, filename, title = "flugr Export", meta = "" }) {
  const { headers, rows: body } = normalizeRows(rows);
  const thead = headers.map((h) => `<th style="border:1px solid #ccc;padding:6px;text-align:left;background:#f4f4f0">${escapeHtml(h)}</th>`).join("");
  const tbody = body
    .map(
      (cols) =>
        `<tr>${cols
          .map((c) => `<td style="border:1px solid #ccc;padding:6px">${escapeHtml(c)}</td>`)
          .join("")}</tr>`
    )
    .join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:Calibri,Arial,sans-serif;color:#111">
  <h1>${escapeHtml(title)}</h1>
  ${meta ? `<p><em>${escapeHtml(meta)}</em></p>` : ""}
  <table style="border-collapse:collapse;width:100%"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>
</body></html>`;
  const name = filename.replace(/\.(csv|xlsx|xls|pdf|doc|docx)$/i, "");
  downloadBlob(new Blob(["\ufeff", html], { type: "application/msword" }), `${name}.doc`);
}

export const EXPORT_FORMATS = [
  { id: "csv", label: "CSV", ext: "csv" },
  { id: "excel", label: "Excel (.xls)", ext: "xls" },
  { id: "pdf", label: "PDF (Table)", ext: "pdf" },
  { id: "pdf_report", label: "PDF (AI Report)", ext: "pdf" },
  { id: "doc", label: "Word (.doc)", ext: "doc" },
];

export function runExport(format, opts) {
  if (format === "excel") return exportExcel(opts);
  if (format === "pdf") return exportPdf(opts);
  if (format === "pdf_report") return exportAiReportPdf(opts);
  if (format === "doc") return exportDoc(opts);
  return exportCsv(opts);
}
