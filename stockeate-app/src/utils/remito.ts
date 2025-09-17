import { BatchItem } from '../stores/batch';

export function tmpNumber() {
  // algo único y legible: AAA-XXXXX
  const part = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `TMP-${part}`;
}

export function remitoHtml(opts: {
  remitoId: string;
  tmp: string;
  branchName?: string;
  customer?: string | null;
  notes?: string | null;
  items: BatchItem[];
}) {
  const rows = opts.items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${it.code}</td>
      <td>${escapeHtml(it.name)}</td>
      <td style="text-align:right">${it.qty}</td>
      <td style="text-align:right">${it.unit_price?.toFixed?.(2) ?? '0.00'}</td>
    </tr>
  `).join('');

  return `
  <html>
    <head>
      <meta charset="utf-8"/>
      <style>
        body { font-family: Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; margin: 0 0 4px 0; }
        h2 { font-size: 14px; margin: 0 0 12px 0; color:#666; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        th { background: #f4f4f4; }
        .meta { margin-top: 8px; font-size: 12px; }
      </style>
    </head>
    <body>
      <h1>Remito ${opts.tmp}</h1>
      <h2>Sucursal: ${escapeHtml(opts.branchName ?? '')}</h2>
      <div class="meta">
        <div><b>Cliente:</b> ${escapeHtml(opts.customer ?? '-')}</div>
        <div><b>Notas:</b> ${escapeHtml(opts.notes ?? '-')}</div>
        <div><b>ID:</b> ${opts.remitoId}</div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Código</th><th>Producto</th><th>Cant.</th><th>P.Unit</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
  </html>
  `;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'} as any)[m]
  );
}
