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

function downloadPdfBytes(bytes, filename) {
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
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

/** Map nested/raw keys to short readable labels for exports. */
export function humanizeHeader(key) {
  const map = {
    "users.creators": "Creators",
    "users.brands": "Brands",
    "users.agencies": "Agencies",
    "users.admins": "Admins",
    "users.total": "Total users",
    "campaigns.total": "Campaigns",
    "campaigns.active": "Active campaigns",
    "campaigns.completed": "Completed campaigns",
    "campaigns.draft": "Draft campaigns",
    "financial.revenue": "Revenue",
    "financial.total_payments": "Total payments",
    "financial.escrow_held": "Escrow held",
    "financial.platform_fee": "Platform fee",
    "platform.active_users": "Active users",
    "platform.inactive_users": "Inactive users",
    "reports.open": "Open reports",
    "reports.resolved": "Resolved reports",
    "approvals.pending": "Pending approvals",
    "approvals.approved": "Approved",
    created_at: "Created",
    updated_at: "Updated",
    username: "Username",
    email: "Email",
    name: "Name",
    role: "Role",
    status: "Status",
    company: "Company",
    city: "City",
    state: "State",
    action: "Action",
    details: "Details",
    type: "Type",
  };
  if (map[key]) return map[key];
  return String(key || "")
    .replace(/[._]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/** Helvetica/WinAnsi-safe text (avoids tofu boxes for em-dashes, etc.). */
function pdfSafeText(s) {
  return String(s ?? "")
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function pdfEscape(s) {
  return pdfSafeText(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

/** Normalize export titles into brand + clean headline. */
export function formatPdfTitle(title) {
  let raw = pdfSafeText(title).replace(/\s+/g, " ").trim();
  raw = raw.replace(/^flugr\b[\s\-–—:|]*/i, "").trim();
  raw = raw.replace(/^Admin\b[\s\-–—:|]*/i, "").trim();
  if (!raw) raw = "Platform Report";
  // Avoid "Report Report"
  raw = raw.replace(/\bReport\s+Report\b/gi, "Report");
  if (!/\bReport\b/i.test(raw)) raw = `${raw} Report`;
  // Title case short labels
  const headline = raw
    .split(" ")
    .map((w) => (w.length <= 2 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
  return { brand: "flugr", headline };
}

let _logoCache = null;

async function loadBrandLogoRgb(size = 72) {
  if (_logoCache && _logoCache.size === size) return _logoCache;
  try {
    const candidates = [];
    try {
      const pub = (typeof process !== "undefined" && process.env && process.env.PUBLIC_URL) || "";
      if (pub) candidates.push(`${String(pub).replace(/\/$/, "")}/brand/flugr-avatar.png`);
    } catch { /* ignore */ }
    candidates.push("/brand/flugr-avatar.png", "./brand/flugr-avatar.png");
    if (typeof window !== "undefined") {
      candidates.push(`${window.location.origin}/brand/flugr-avatar.png`);
      const base = String(window.location.pathname || "").replace(/\/[^/]*$/, "");
      if (base && base !== "/") candidates.push(`${window.location.origin}${base}/brand/flugr-avatar.png`);
    }
    let img = null;
    for (const src of candidates) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const probe = new Image();
        probe.crossOrigin = "anonymous";
        probe.src = src;
        // eslint-disable-next-line no-await-in-loop
        await probe.decode();
        img = probe;
        break;
      } catch {
        /* try next */
      }
    }
    if (!img) return null;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const rgb = new Uint8Array(size * size * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      const a = data[i + 3] / 255;
      rgb[j] = Math.round(data[i] * a + 255 * (1 - a));
      rgb[j + 1] = Math.round(data[i + 1] * a + 255 * (1 - a));
      rgb[j + 2] = Math.round(data[i + 2] * a + 255 * (1 - a));
    }
    _logoCache = { width: size, height: size, rgb, size };
    return _logoCache;
  } catch {
    return null;
  }
}

function concatPdfParts(parts) {
  let total = 0;
  const chunks = parts.map((p) => {
    if (typeof p === "string") {
      const enc = new TextEncoder().encode(p);
      total += enc.length;
      return enc;
    }
    total += p.length;
    return p;
  });
  const out = new Uint8Array(total);
  let off = 0;
  chunks.forEach((c) => {
    out.set(c, off);
    off += c.length;
  });
  return out;
}

/**
 * Build a PDF. contentBuilders return content-stream strings.
 * Optional logoRgb embeds the flugr avatar in every page header.
 */
function assemblePdf(pageWidth, pageHeight, contentBuilders, logoRgb = null) {
  const objs = [];
  const pushObj = (body) => {
    objs.push(body); // string | { binary: Uint8Array, dict: string }
    return objs.length;
  };

  const fontId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const boldId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  const italicId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>");

  let logoId = null;
  if (logoRgb?.rgb?.length) {
    const dict = `<< /Type /XObject /Subtype /Image /Width ${logoRgb.width} /Height ${logoRgb.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${logoRgb.rgb.length} >>`;
    logoId = pushObj({ dict, binary: logoRgb.rgb });
  }

  const contentIds = contentBuilders.map((build) => {
    const stream = `${build({ logoId, italicId })}\n`;
    const bytes = new TextEncoder().encode(stream);
    return pushObj({ dict: `<< /Length ${bytes.length} >>`, binary: bytes, isStream: true });
  });

  const fontRes = `/Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R /F3 ${italicId} 0 R >>`;
  const xobjRes = logoId ? ` /XObject << /Im1 ${logoId} 0 R >>` : "";
  const pageIds = contentIds.map((cid) =>
    pushObj(
      `<< /Type /Page /Parent 0 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cid} 0 R /Resources << ${fontRes}${xobjRes} >> >>`
    )
  );
  const pagesId = pushObj(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  pageIds.forEach((pid, i) => {
    objs[pid - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIds[i]} 0 R /Resources << ${fontRes}${xobjRes} >> >>`;
  });
  const catalogId = pushObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  const parts = ["%PDF-1.4\n"];
  const offsets = [0];
  let lengthSoFar = 9; // "%PDF-1.4\n"

  objs.forEach((body, i) => {
    offsets.push(lengthSoFar);
    if (typeof body === "string") {
      const chunk = `${i + 1} 0 obj\n${body}\nendobj\n`;
      parts.push(chunk);
      lengthSoFar += new TextEncoder().encode(chunk).length;
    } else if (body.isStream) {
      const head = `${i + 1} 0 obj\n${body.dict}\nstream\n`;
      const tail = `\nendstream\nendobj\n`;
      parts.push(head, body.binary, tail);
      lengthSoFar += new TextEncoder().encode(head).length + body.binary.length + new TextEncoder().encode(tail).length;
    } else {
      const head = `${i + 1} 0 obj\n${body.dict}\nstream\n`;
      const tail = `\nendstream\nendobj\n`;
      parts.push(head, body.binary, tail);
      lengthSoFar += new TextEncoder().encode(head).length + body.binary.length + new TextEncoder().encode(tail).length;
    }
  });

  const xrefStart = lengthSoFar;
  let xref = `xref\n0 ${objs.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let i = 1; i <= objs.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer<< /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(xref);
  return concatPdfParts(parts);
}

/**
 * Brand header: flugr logo + wordmark + clean report title.
 * Returns the Y coordinate below the header for content start.
 */
function drawBrandHeader(ops, { title, meta, pageWidth, pageHeight, margin, logoId }) {
  const { brand, headline } = formatPdfTitle(title);
  const barH = 70;
  const top = pageHeight - barH;
  const logoSize = 40;
  const textLeft = margin + (logoId ? logoSize + 12 : 0);

  ops.push("q");
  // Brand red bar
  ops.push("1 0.23 0.18 rg");
  ops.push(`0 ${top} ${pageWidth} ${barH} re f`);
  // Subtle bottom edge
  ops.push("0.85 0.15 0.12 rg");
  ops.push(`0 ${top} ${pageWidth} 1.5 re f`);

  if (logoId) {
    const lx = margin;
    const ly = pageHeight - 55;
    // White plate behind logo for contrast
    ops.push("1 1 1 rg");
    ops.push(`${lx - 2} ${ly - 2} ${logoSize + 4} ${logoSize + 4} re f`);
    ops.push("q");
    ops.push(`${logoSize} 0 0 ${logoSize} ${lx} ${ly} cm`);
    ops.push("/Im1 Do");
    ops.push("Q");
  }

  // Wordmark
  ops.push("1 1 1 rg");
  ops.push(`BT /F3 13 Tf ${textLeft} ${pageHeight - 26} Td (${pdfEscape(brand)}) Tj ET`);
  // Report headline
  ops.push(`BT /F2 16 Tf ${textLeft} ${pageHeight - 46} Td (${pdfEscape(headline).slice(0, pageWidth > 700 ? 70 : 42)}) Tj ET`);
  if (meta) {
    ops.push("0.95 0.85 0.82 rg");
    ops.push(`BT /F1 8 Tf ${textLeft} ${pageHeight - 60} Td (${pdfEscape(meta).slice(0, pageWidth > 700 ? 110 : 72)}) Tj ET`);
  }
  ops.push("Q");
  return top - 14;
}

function pickPageSize({ colCount = 0, isSummary = false, metricCount = 0, forceLandscape = false } = {}) {
  // Landscape when tables/metrics are wide enough to benefit from horizontal space
  const landscape =
    forceLandscape ||
    colCount >= 5 ||
    (isSummary && metricCount >= 8) ||
    colCount * 90 > 520;
  if (landscape) {
    return { pageWidth: 792, pageHeight: 612, landscape: true }; // US Letter landscape
  }
  return { pageWidth: 612, pageHeight: 792, landscape: false };
}

function groupMetricPairs(headers, values) {
  const pairs = headers.map((h, i) => ({
    label: humanizeHeader(h),
    value: values[i] == null || values[i] === "" ? "-" : String(values[i]),
  }));
  const groups = {};
  headers.forEach((h, i) => {
    const root = String(h).includes(".") ? String(h).split(".")[0] : "metrics";
    if (!groups[root]) groups[root] = [];
    groups[root].push(pairs[i]);
  });
  return groups;
}

/**
 * Readable multi-page PDF:
 * - wide tables / many metrics -> landscape
 * - 1 wide summary row         -> labeled metric cards
 * - many rows                  -> bordered table (column chunks if needed)
 * - branded header with flugr logo + clean title
 */
export async function exportPdf({ rows, filename, title = "flugr Export", meta = "" }) {
  const { headers: rawHeaders, rows: body } = normalizeRows(rows);
  const headers = rawHeaders.map(humanizeHeader);
  const safeTitle = pdfSafeText(title).replace(/\s+/g, " ").trim() || "flugr Export";
  const safeMeta = pdfSafeText(meta);
  const isSummary = body.length <= 1 && rawHeaders.length > 6;
  const { pageWidth, pageHeight, landscape } = pickPageSize({
    colCount: headers.length,
    isSummary,
    metricCount: rawHeaders.length,
  });
  const margin = landscape ? 32 : 36;
  const contentWidth = pageWidth - margin * 2;
  const orientationNote = landscape ? "Landscape" : "Portrait";
  const logo = await loadBrandLogoRgb(72);
  const logoIdPlaceholder = !!logo;

  const pageOps = [];
  let ops = [];
  let y = pageHeight - 84;

  const paintHeader = (metaLine) => {
    y = drawBrandHeader(ops, {
      title: safeTitle,
      meta: metaLine,
      pageWidth,
      pageHeight,
      margin,
      logoId: logoIdPlaceholder,
    });
  };

  const flushPage = () => {
    pageOps.push(ops.join("\n"));
    ops = [];
    y = pageHeight - 84;
  };

  const ensureSpace = (need) => {
    if (y - need < margin + 24) {
      flushPage();
      paintHeader(`${safeMeta} · ${orientationNote}`);
    }
  };

  paintHeader(`${safeMeta} · ${orientationNote}`);

  if (!body.length) {
    ops.push("0.2 0.2 0.2 rg");
    ops.push(`BT /F1 11 Tf ${margin} ${y} Td (No data available for this export.) Tj ET`);
  } else if (isSummary) {
    const groups = groupMetricPairs(rawHeaders, body[0] || []);
    const cardsPerRow = landscape ? 3 : 2;
    Object.entries(groups).forEach(([group, pairs]) => {
      ensureSpace(40);
      ops.push("0.12 0.12 0.12 rg");
      ops.push(`BT /F2 11 Tf ${margin} ${y} Td (${pdfEscape(humanizeHeader(group))}) Tj ET`);
      y -= 16;
      const gap = 10;
      const colW = (contentWidth - gap * (cardsPerRow - 1)) / cardsPerRow;
      for (let i = 0; i < pairs.length; i += cardsPerRow) {
        ensureSpace(28);
        for (let c = 0; c < cardsPerRow; c++) {
          const pair = pairs[i + c];
          if (!pair) continue;
          const x = margin + c * (colW + gap);
          ops.push("0.95 0.95 0.95 rg");
          ops.push(`${x} ${y - 18} ${colW} 22 re f`);
          ops.push("0.85 0.85 0.85 RG 0.5 w");
          ops.push(`${x} ${y - 18} ${colW} 22 re S`);
          ops.push("0.4 0.4 0.4 rg");
          ops.push(`BT /F1 7 Tf ${x + 6} ${y - 2} Td (${pdfEscape(pair.label).slice(0, Math.floor(colW / 5))}) Tj ET`);
          ops.push("0.1 0.1 0.1 rg");
          ops.push(`BT /F2 10 Tf ${x + 6} ${y - 14} Td (${pdfEscape(pair.value).slice(0, Math.floor(colW / 6))}) Tj ET`);
        }
        y -= 30;
      }
      y -= 8;
    });
  } else {
    const maxCols = landscape ? Math.min(headers.length, 10) : Math.min(headers.length, 5);
    const colChunks = [];
    for (let c = 0; c < headers.length; c += maxCols) {
      colChunks.push({
        headers: headers.slice(c, c + maxCols),
        start: c,
      });
    }

    colChunks.forEach((chunk, chunkIdx) => {
      if (chunkIdx > 0) {
        flushPage();
        paintHeader(`${safeMeta} · cols ${chunk.start + 1}-${chunk.start + chunk.headers.length} · ${orientationNote}`);
      }
      const colCount = chunk.headers.length;
      const colW = contentWidth / colCount;
      const rowH = landscape ? 16 : 18;
      const headerChars = Math.max(6, Math.floor(colW / 4.8));
      const cellChars = Math.max(6, Math.floor(colW / 4.2));

      const drawTableHeader = () => {
        ensureSpace(rowH + 8);
        ops.push("0.12 0.12 0.12 rg");
        ops.push(`${margin} ${y - rowH + 4} ${contentWidth} ${rowH} re f`);
        ops.push("1 1 1 rg");
        chunk.headers.forEach((h, i) => {
          const x = margin + i * colW + 3;
          ops.push(`BT /F2 7 Tf ${x} ${y - 8} Td (${pdfEscape(h).slice(0, headerChars)}) Tj ET`);
        });
        y -= rowH + 2;
      };

      drawTableHeader();
      body.forEach((cols, rowIdx) => {
        ensureSpace(rowH + 4);
        if (y < margin + 70 && rowIdx > 0) {
          flushPage();
          paintHeader(`${safeMeta} · ${orientationNote}`);
          drawTableHeader();
        }
        if (rowIdx % 2 === 0) {
          ops.push("0.97 0.97 0.97 rg");
          ops.push(`${margin} ${y - rowH + 4} ${contentWidth} ${rowH} re f`);
        }
        ops.push("0.82 0.82 0.82 RG 0.4 w");
        ops.push(`${margin} ${y - rowH + 4} ${contentWidth} ${rowH} re S`);
        ops.push("0.12 0.12 0.12 rg");
        chunk.headers.forEach((_, i) => {
          const val = cols[chunk.start + i] ?? "";
          const x = margin + i * colW + 3;
          ops.push(`BT /F1 7 Tf ${x} ${y - 8} Td (${pdfEscape(val).slice(0, cellChars)}) Tj ET`);
        });
        y -= rowH;
      });
      y -= 12;
    });
  }

  ops.push("0.45 0.45 0.45 rg");
  ensureSpace(20);
  ops.push(
    `BT /F1 7 Tf ${margin} ${margin} Td (${pdfEscape(`flugr export · ${body.length} record(s) · ${orientationNote}`)}) Tj ET`
  );
  flushPage();

  const pdfBytes = assemblePdf(
    pageWidth,
    pageHeight,
    pageOps.map((content) => () => content),
    logo
  );
  const name = filename.replace(/\.(csv|xlsx|xls|pdf|doc|docx)$/i, "");
  downloadPdfBytes(pdfBytes, `${name}.pdf`);
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

async function buildPdfFromBlocks(blocks, filename, { landscape = false, title = "flugr Report", meta = "" } = {}) {
  const pageWidth = landscape ? 792 : 612;
  const pageHeight = landscape ? 612 : 792;
  const margin = landscape ? 40 : 48;
  const maxWidthChars = landscape ? 118 : 88;
  const logo = await loadBrandLogoRgb(72);
  const laid = [];

  // Brand header is drawn per page; body blocks follow
  for (const b of blocks) {
    const kind = b.kind || "body";
    if (kind === "spacer") {
      laid.push({ text: " ", size: 10, gap: b.gap || 10 });
      continue;
    }
    // Skip duplicate h1 if we paint brand header from title
    if (kind === "h1") continue;
    const size = kind === "h2" ? 13 : kind === "meta" ? 9 : 10;
    const gap = kind === "h2" ? 6 : kind === "meta" ? 4 : 3;
    const max = kind === "h2" ? (landscape ? 90 : 58) : maxWidthChars;
    for (const line of wrapWords(pdfSafeText(b.text), max)) {
      laid.push({ text: line, size, gap, bold: kind === "h2" });
    }
    if (kind === "h2") laid.push({ text: " ", size: 8, gap: 4 });
  }

  const headerReserve = 84;
  const pages = [];
  let page = [];
  let y = pageHeight - headerReserve;
  for (const item of laid) {
    const need = item.size + item.gap;
    if (y - need < margin) {
      pages.push(page);
      page = [];
      y = pageHeight - headerReserve;
    }
    page.push({ ...item, y });
    y -= need;
  }
  if (page.length) pages.push(page);
  if (!pages.length) pages.push([{ text: " ", size: 10, gap: 4, y: pageHeight - headerReserve }]);

  const safeTitle = pdfSafeText(title);
  const safeMeta = pdfSafeText(meta);

  const pdfBytes = assemblePdf(
    pageWidth,
    pageHeight,
    pages.map((pageItems) => () => {
      const ops = [];
      drawBrandHeader(ops, {
        title: safeTitle,
        meta: safeMeta || (landscape ? "Landscape" : "Portrait"),
        pageWidth,
        pageHeight,
        margin,
        logoId: !!logo,
      });
      pageItems.forEach((item) => {
        const font = item.bold || item.size >= 12 ? "F2" : "F1";
        const safe = pdfEscape(item.text).slice(0, landscape ? 140 : 120);
        ops.push(`BT /${font} ${item.size} Tf ${margin} ${item.y} Td (${safe}) Tj ET`);
      });
      return ops.join("\n");
    }),
    logo
  );

  const name = filename.replace(/\.(csv|xlsx|xls|pdf|doc|docx)$/i, "");
  downloadPdfBytes(pdfBytes, `${name}.pdf`);
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
export async function exportProfileReportPdf({
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

  await buildPdfFromBlocks(blocks, filename || `cr8-profile-${dateLabel}`, {
    title: "flugr Personal Data Report",
    meta: `AI-curated profile summary · Generated ${dateLabel}`,
  });
}

/** Deterministic narrative when LLM is unavailable. */
export function buildLocalExportSummary(rows = [], tab = "overview") {
  const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
  if (!list.length) return "No records were available for this export window.";

  if (list.length === 1 && typeof list[0] === "object") {
    const row = list[0];
    const creators = row["users.creators"] ?? row.creators;
    const brands = row["users.brands"] ?? row.brands;
    const agencies = row["users.agencies"] ?? row.agencies;
    const campaigns = row["campaigns.total"] ?? row.campaigns;
    const revenue = row["financial.revenue"] ?? row.revenue;
    const parts = [
      `Platform snapshot for the ${tab.replace(/_/g, " ")} export.`,
      creators != null || brands != null
        ? `Audience mix: ${creators ?? 0} creators, ${brands ?? 0} brands, ${agencies ?? 0} agencies.`
        : `This file contains ${Object.keys(row).length} metrics.`,
      campaigns != null ? `Campaigns on file: ${campaigns}.` : null,
      revenue != null ? `Tracked revenue figure: ${revenue}.` : null,
      "Figures are taken from live admin stats for the selected timeframe.",
    ];
    return parts.filter(Boolean).join(" ");
  }

  const roles = {};
  list.forEach((r) => {
    const role = r.role || r.type || "record";
    roles[role] = (roles[role] || 0) + 1;
  });
  const roleBits = Object.entries(roles)
    .slice(0, 6)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  return `This export includes ${list.length} ${tab.replace(/_/g, " ")} records (${roleBits || "mixed types"}). Review the data overview and included records below for operational follow-up.`;
}

/** Generates a polished PDF report for a list of items, including an AI executive summary. */
export async function exportAiReportPdf({
  rows,
  filename,
  title = "flugr Data Report",
  meta = "",
  aiSummary = "",
  tab = "overview",
}) {
  const { headers: rawHeaders, rows: body } = normalizeRows(rows);
  const dateLabel = new Date().toISOString().slice(0, 10);
  const summary =
    (aiSummary && String(aiSummary).trim() && !/AI analysis failed/i.test(aiSummary)
      ? String(aiSummary).trim()
      : buildLocalExportSummary(rows, tab));

  const isSummary = body.length <= 1 && rawHeaders.length > 6;
  const { landscape } = pickPageSize({
    colCount: rawHeaders.length,
    isSummary,
    metricCount: rawHeaders.length,
    forceLandscape: body.length > 1 && rawHeaders.length >= 5,
  });

  // Wide tabular exports: landscape table PDF is clearer than a long prose dump
  if (!isSummary && body.length > 0 && rawHeaders.length >= 5) {
    await exportPdf({
      rows,
      filename: filename || `flugr-report-${dateLabel}`,
      title: pdfSafeText(title),
      meta: `${pdfSafeText(meta)} · ${pdfSafeText(summary).slice(0, 120)}`,
    });
    return;
  }

  const blocks = [];
  blocks.push({ kind: "h2", text: "Executive Summary" });
  blocks.push({ kind: "body", text: summary });
  blocks.push({ kind: "spacer", gap: 16 });

  if (isSummary) {
    blocks.push({ kind: "h2", text: "Key Metrics" });
    const groups = groupMetricPairs(rawHeaders, body[0] || []);
    Object.entries(groups).forEach(([group, pairs]) => {
      blocks.push({ kind: "body", text: `${humanizeHeader(group)}:` });
      if (landscape) {
        for (let i = 0; i < pairs.length; i += 2) {
          const a = pairs[i];
          const b = pairs[i + 1];
          blocks.push({
            kind: "body",
            text: b ? `${a.label}: ${a.value}    |    ${b.label}: ${b.value}` : `${a.label}: ${a.value}`,
          });
        }
      } else {
        pairs.forEach((p) => blocks.push({ kind: "body", text: `  ${p.label}: ${p.value}` }));
      }
      blocks.push({ kind: "spacer", gap: 6 });
    });
  } else {
    blocks.push({ kind: "h2", text: "Data Overview" });
    blocks.push({ kind: "body", text: `Total records in this report: ${body.length}` });
    blocks.push({ kind: "spacer", gap: 8 });
    blocks.push({ kind: "h2", text: "Included Records" });
    const names = body.map((cols, idx) => {
      const primary = cols.find((c) => c && String(c).trim() !== "") || `Record ${idx + 1}`;
      return String(primary).slice(0, 48);
    });
    const chunkSize = landscape ? 18 : 12;
    for (let i = 0; i < names.length; i += chunkSize) {
      names.slice(i, i + chunkSize).forEach((n, j) => {
        blocks.push({ kind: "body", text: `${i + j + 1}. ${n}` });
      });
    }
  }

  blocks.push({ kind: "spacer", gap: 15 });
  blocks.push({ kind: "meta", text: `Generated on ${dateLabel}` });

  await buildPdfFromBlocks(blocks, filename || `flugr-report-${dateLabel}`, {
    landscape,
    title: pdfSafeText(title),
    meta: pdfSafeText(meta),
  });
}

function fmtAuditMetric(v, { allowZero = true } = {}) {
  if (v == null || v === "") return "N/A";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (!allowZero && n === 0) return "N/A";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const PLATFORM_LABELS = {
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X",
  youtube: "YouTube",
};

/**
 * Detailed Social Media Audit PDF (profile, platforms, issues, recommendations).
 * Styled like the EdVantage-style audit sample — status, score, per-platform metrics, actions.
 */
export async function exportSocialAuditPdf({ audit = {}, filename, exportedAt = "" } = {}) {
  const when = exportedAt || audit.created_at || new Date().toISOString();
  const dateLabel = String(when).slice(0, 10);
  const timeLabel = String(when).slice(0, 19).replace("T", " ");
  const name = audit.user_name || "Account";
  const role = audit.user_role || "user";
  const ov = audit.overview || {};
  const completeness = audit.profile_completeness || {};
  const freshness = audit.data_freshness || {};
  const platforms = Array.isArray(audit.platforms) ? audit.platforms : [];
  const issues = Array.isArray(audit.issues) ? audit.issues : [];
  const warnings = Array.isArray(audit.warnings) ? audit.warnings : [];
  const recommendations = Array.isArray(audit.recommendations) ? audit.recommendations : [];

  const er =
    ov.engagementRate == null || ov.engagementRate === ""
      ? "N/A"
      : `${Number(ov.engagementRate).toFixed(2)}%`;

  const blocks = [
    { kind: "h2", text: "1. Audit Summary" },
    { kind: "body", text: `Overall status: ${audit.status || "—"}` },
    { kind: "body", text: `Audit score: ${audit.score != null ? `${audit.score} / 100` : "N/A"}` },
    { kind: "body", text: `Profile completeness: ${completeness.score != null ? `${completeness.score}%` : "N/A"}` },
    { kind: "body", text: `Connected platforms: ${completeness.connected_platforms ?? platforms.filter((p) => p.connected).length}` },
    { kind: "body", text: `Scraper / API status: ${audit.scraper_status || "—"}` },
    {
      kind: "body",
      text: `Data freshness: ${
        freshness.hours_since_sync != null
          ? `${freshness.hours_since_sync}h since last sync (threshold ${freshness.stale_threshold_hours ?? 72}h)`
          : "N/A"
      }`,
    },
    { kind: "body", text: `Execution: ${audit.execution_status || "completed"}` },
    { kind: "spacer", gap: 10 },
    { kind: "h2", text: "2. Audience Overview" },
    { kind: "body", text: `Followers: ${fmtAuditMetric(ov.followers)}` },
    { kind: "body", text: `Engagement: ${fmtAuditMetric(ov.engagement)}` },
    { kind: "body", text: `Engagement rate: ${er}${ov.engagementRateBasis ? ` (${ov.engagementRateBasis})` : ""}` },
    { kind: "body", text: `Total views: ${fmtAuditMetric(ov.views, { allowZero: false })}` },
    { kind: "body", text: `Total reach: ${fmtAuditMetric(ov.reach, { allowZero: false })} (actual reach only; N/A when unavailable)` },
    { kind: "body", text: `Content count: ${fmtAuditMetric(ov.contentCount)}` },
    { kind: "spacer", gap: 10 },
    { kind: "h2", text: "3. Connected Platforms" },
  ];

  if (!platforms.length) {
    blocks.push({ kind: "body", text: "No platform rows on this audit." });
  } else {
    platforms.forEach((p) => {
      const label = PLATFORM_LABELS[p.platform] || p.platform || "Platform";
      const erP =
        p.engagementRate == null || p.engagementRate === ""
          ? "N/A"
          : `${Number(p.engagementRate).toFixed(2)}%`;
      blocks.push({
        kind: "body",
        text: `${label}: ${p.connected ? `@${String(p.handle || "").replace(/^@/, "")}` : "Not connected"} · API ${p.api_status || "—"}`,
      });
      if (p.connected) {
        blocks.push({
          kind: "body",
          text: `  Followers ${fmtAuditMetric(p.followers)} · Following ${fmtAuditMetric(p.following)} · ER ${erP} · Views ${fmtAuditMetric(p.views, { allowZero: false })} · Reach ${fmtAuditMetric(p.reach, { allowZero: false })} · Posts ${fmtAuditMetric(p.posts)}`,
        });
        if (p.last_synced) blocks.push({ kind: "body", text: `  Last synced: ${String(p.last_synced).slice(0, 19).replace("T", " ")}` });
      }
    });
  }

  blocks.push({ kind: "spacer", gap: 10 });
  blocks.push({ kind: "h2", text: "4. Detected Issues" });
  if (!issues.length) {
    blocks.push({ kind: "body", text: "No issues detected on this audit." });
  } else {
    issues.forEach((iss, i) => {
      blocks.push({
        kind: "body",
        text: `${i + 1}. [${iss.severity || "Medium"}] ${iss.title || "Issue"} (${PLATFORM_LABELS[iss.platform] || iss.platform || "—"})`,
      });
      blocks.push({ kind: "body", text: `  Account: ${iss.account || "—"} · Status: ${iss.status || "Open"}` });
      if (iss.description) blocks.push({ kind: "body", text: `  ${iss.description}` });
      if (iss.recommended_action) blocks.push({ kind: "body", text: `  Recommended: ${iss.recommended_action}` });
      if (iss.detected_at) blocks.push({ kind: "body", text: `  Detected: ${String(iss.detected_at).slice(0, 19).replace("T", " ")}` });
    });
  }

  blocks.push({ kind: "spacer", gap: 10 });
  blocks.push({ kind: "h2", text: "5. Warnings" });
  if (!warnings.length) {
    blocks.push({ kind: "body", text: "No warnings." });
  } else {
    warnings.forEach((w, i) => blocks.push({ kind: "body", text: `${i + 1}. ${w}` }));
  }

  blocks.push({ kind: "spacer", gap: 10 });
  blocks.push({ kind: "h2", text: "6. Recommendations" });
  if (!recommendations.length) {
    blocks.push({ kind: "body", text: "Keep syncing socials weekly for fresher audits." });
  } else {
    recommendations.forEach((r, i) => blocks.push({ kind: "body", text: `${i + 1}. ${r}` }));
  }

  blocks.push({ kind: "spacer", gap: 12 });
  blocks.push({
    kind: "meta",
    text: "Metrics are taken from connected platforms / Apify sync. Reach is never inferred from views. Credentials and tokens are never included.",
  });
  blocks.push({ kind: "meta", text: "© flugr · Social Media Audit · Confidential" });

  const safeName = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  await buildPdfFromBlocks(blocks, filename || `flugr-social-audit-${safeName || "report"}-${dateLabel}`, {
    title: "Social Media Audit",
    meta: `Account: ${name} · Role: ${role} · Generated ${timeLabel}`,
  });
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
  { id: "pdf_report", label: "PDF (Report)", ext: "pdf" },
  { id: "doc", label: "Word (.doc)", ext: "doc" },
];

export async function runExport(format, opts) {
  if (format === "excel") return exportExcel(opts);
  if (format === "pdf") return exportPdf(opts);
  if (format === "pdf_report") return exportAiReportPdf(opts);
  if (format === "doc") return exportDoc(opts);
  return exportCsv(opts);
}
