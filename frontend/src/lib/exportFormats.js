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
export function exportExcel({ rows, filename, sheetName = "CR8 Export", meta = "" }) {
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
export function exportPdf({ rows, filename, title = "CR8 Export", meta = "" }) {
  const { headers, rows: body } = normalizeRows(rows);
  const lines = [
    title,
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
  const maxLines = Math.floor((pageHeight - margin * 2) / lineHeight);
  const pages = [];
  for (let i = 0; i < Math.max(lines.length, 1); i += maxLines) {
    pages.push(lines.slice(i, i + maxLines));
  }
  if (!pages.length) pages.push([title]);

  const objs = [];
  const pushObj = (bodyStr) => {
    objs.push(bodyStr);
    return objs.length;
  };

  const fontId = pushObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const contentIds = pages.map((pageLines) => {
    const textOps = (pageLines.length ? pageLines : [""])
      .map((line, idx) => {
        const safe = String(line)
          .replace(/\\/g, "\\\\")
          .replace(/\(/g, "\\(")
          .replace(/\)/g, "\\)")
          .slice(0, 110);
        const y = pageHeight - margin - idx * lineHeight;
        return `BT /F1 9 Tf ${margin} ${y} Td (${safe}) Tj ET`;
      })
      .join("\n");
    const stream = `${textOps}\n`;
    return pushObj(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  });

  const pagesIdPlaceholder = objs.length + contentIds.length + 1;
  const pageIds = contentIds.map((cid) =>
    pushObj(
      `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cid} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    )
  );
  const pagesId = pushObj(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`
  );
  // Fix parent refs now that pagesId is known
  pageIds.forEach((pid, i) => {
    objs[pid - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentIds[i]} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`;
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

/** Word-compatible HTML document (.doc). */
export function exportDoc({ rows, filename, title = "CR8 Export", meta = "" }) {
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
  { id: "pdf", label: "PDF", ext: "pdf" },
  { id: "doc", label: "Word (.doc)", ext: "doc" },
];

export function runExport(format, opts) {
  if (format === "excel") return exportExcel(opts);
  if (format === "pdf") return exportPdf(opts);
  if (format === "doc") return exportDoc(opts);
  return exportCsv(opts);
}
