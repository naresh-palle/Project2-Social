const TEMPLATES = {
  professional: { bar: "bg-[#FF3B30]", panel: "bg-white text-[#111]", muted: "text-black/45" },
  modern: { bar: "bg-[#FF3B30]", panel: "bg-[#FAFAF8] text-[#0B0B0E]", muted: "text-black/40" },
  minimal: { bar: "bg-black", panel: "bg-white text-black", muted: "text-black/40" },
};

export function inr(n) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "₹—";
  return v.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function InvoicePreview({ invoice, demo = false }) {
  if (!invoice) {
    return <div className="p-8 text-center font-mono text-[10px] uppercase tracking-widest text-black/40">No preview yet</div>;
  }
  const theme = TEMPLATES[invoice.template] || TEMPLATES.professional;
  const supplier = invoice.supplier || {};
  const recipient = invoice.recipient || {};
  const pos = invoice.place_of_supply || {};
  const camp = invoice.campaign || {};
  const bank = invoice.bank || {};
  const items = invoice.line_items || [];
  const kind = invoice.invoice_kind === "non_gst" ? "INVOICE (NON-GST)" : "TAX INVOICE";

  return (
    <article className={`${theme.panel} shadow-2xl min-h-[640px] p-6 md:p-8 font-sans text-[11px] leading-snug`} data-testid="invoice-preview">
      <div className={`${theme.bar} h-1.5 -mt-6 md:-mt-8 -mx-6 md:-mx-8 mb-5`} />
      {demo || invoice.demo ? (
        <p className="font-mono text-[9px] uppercase tracking-widest text-[#FF3B30] font-bold mb-2">DEMO DATA — example identifiers only</p>
      ) : null}
      <div className="flex justify-between gap-4 items-start">
        <div>
          {supplier.logo_url ? (
            <img src={supplier.logo_url} alt="" className="h-10 w-auto object-contain mb-2" />
          ) : (
            <p className="font-editorial text-2xl text-[#FF3B30] italic">CR8</p>
          )}
          <p className="font-semibold text-sm">{supplier.trade_name || supplier.legal_name || "Supplier"}</p>
          <p className={theme.muted}>{supplier.address}</p>
          <p className={theme.muted}>{[supplier.city, supplier.state, supplier.pincode].filter(Boolean).join(", ")}</p>
          <p>GSTIN {supplier.gstin || "—"} · PAN {supplier.pan || "—"}</p>
        </div>
        <div className="text-right">
          <h2 className="font-sans text-lg font-bold tracking-tight">{kind}</h2>
          <p className="font-mono text-[10px] uppercase tracking-widest mt-1">{invoice.invoice_number || invoice.draft_number || "DRAFT"}</p>
          <p>Date {String(invoice.invoice_date || "").slice(0, 10) || "—"}</p>
          <p>Due {String(invoice.due_date || "—").slice(0, 10)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5 border-t border-black/10 pt-4">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-widest text-black/40">Bill to</p>
          <p className="font-semibold">{recipient.legal_name || recipient.trade_name || "Recipient"}</p>
          <p className={theme.muted}>{recipient.address}</p>
          <p>GSTIN {recipient.gstin || "—"}</p>
          <p>State {recipient.state || "—"} ({recipient.state_code || "—"})</p>
        </div>
        <div>
          <p className="font-mono text-[8px] uppercase tracking-widest text-black/40">Place of supply</p>
          <p>{pos.state_name || "—"} ({pos.state_code || "—"})</p>
          {camp.name || camp.title ? (
            <>
              <p className="font-mono text-[8px] uppercase tracking-widest text-black/40 mt-3">Campaign</p>
              <p>{camp.name || camp.title}</p>
              <p className={theme.muted}>{camp.campaign_id || camp.id}</p>
            </>
          ) : null}
        </div>
      </div>

      <table className="w-full mt-5 text-left">
        <thead>
          <tr className="bg-black text-white font-mono text-[8px] uppercase tracking-widest">
            <th className="p-1.5 font-medium">Description</th>
            <th className="p-1.5 font-medium">SAC/HSN</th>
            <th className="p-1.5 font-medium text-right">Qty</th>
            <th className="p-1.5 font-medium text-right">Rate</th>
            <th className="p-1.5 font-medium text-right">Taxable</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-black/10">
              <td className="p-1.5">{it.description}</td>
              <td className="p-1.5">{it.sac_hsn || "—"}</td>
              <td className="p-1.5 text-right">{it.qty}</td>
              <td className="p-1.5 text-right">{inr(it.rate)}</td>
              <td className="p-1.5 text-right">{inr(it.taxable_amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mt-4">
        <dl className="w-56 space-y-1">
          {[
            ["Subtotal", invoice.subtotal],
            ["Discount", invoice.discount_total],
            ["Taxable", invoice.taxable_value],
            ["CGST", invoice.cgst],
            ["SGST", invoice.sgst],
            ["UTGST", invoice.utgst],
            ["IGST", invoice.igst],
            ["Round off", invoice.round_off],
            ["Grand total", invoice.grand_total],
            invoice.tds_applicable ? ["TDS", invoice.tds_amount] : null,
            invoice.tds_applicable ? ["Net payable", invoice.net_payable] : null,
          ].filter(Boolean).filter(([, v], idx, arr) => {
            const label = arr[idx][0];
            if (["CGST", "SGST", "UTGST", "IGST"].includes(label) && !Number(v)) return false;
            return true;
          }).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className={k.includes("Grand") || k.includes("Net") ? "font-bold" : theme.muted}>{k}</dt>
              <dd className="tabular-nums font-medium">{inr(v)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <p className="mt-4 italic text-[10px]">{invoice.amount_in_words}</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-widest text-black/40">Payment</p>
          <p>{bank.bank_name} {bank.account_holder}</p>
          <p>A/c {bank.account_number || "—"} · IFSC {bank.ifsc || "—"}</p>
          {bank.upi_id ? <p>UPI {bank.upi_id}</p> : null}
          <p>Terms: {invoice.payment_terms || "—"}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[8px] uppercase tracking-widest text-black/40">Authorized signatory</p>
          {invoice.signature_url ? <img src={invoice.signature_url} alt="" className="h-10 ml-auto object-contain" /> : <div className="h-10" />}
          <p>{invoice.signatory_name}</p>
          <p className={theme.muted}>{invoice.signatory_designation}</p>
          <p className={`${theme.muted} text-[8px]`}>Uploaded image is not a legally verified digital signature.</p>
        </div>
      </div>
      <p className="mt-6 text-[8px] text-black/40 leading-relaxed">{invoice.disclaimer}</p>
    </article>
  );
}
