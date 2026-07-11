function formatMoneyHNL(value) {
  const num = Number(value || 0);
  return `L. ${num.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function baseEmail({ title, subtitle, contentHtml }) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f6f7fb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;">
    <div style="max-width:720px;margin:0 auto;padding:22px 16px;">
      <div style="background:#111;border-radius:10px;padding:18px 16px;color:#fff;">
        <div style="font-weight:800;font-size:16px;letter-spacing:.3px;">CatalogoHN</div>
        <div style="opacity:.92;margin-top:6px;font-size:14px;">${escapeHtml(subtitle || '')}</div>
      </div>

      <div style="background:#fff;border-radius:10px;margin-top:14px;padding:16px;border:1px solid #ececf3;">
        ${contentHtml}
      </div>

      <div style="opacity:.7;font-size:12px;margin-top:12px;text-align:center;">
        Este correo fue generado automaticamente.
      </div>
    </div>
  </body>
</html>`;
}

function itemsTable(items = []) {
  const rows = items
    .map((item) => {
      const sku = escapeHtml(item.sku || '');
      const desc = escapeHtml(item.descripcion || '');
      const suc = escapeHtml(item.sucursal || '');
      const qty = Number(item.cantidad || 0);
      const unit = formatMoneyHNL(item.precio_unitario);
      const line = formatMoneyHNL(Number(item.precio_unitario || 0) * qty);
      return `<tr>
  <td style="padding:10px 8px;border-bottom:1px solid #eee;font-weight:700;">${sku}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #eee;">${desc}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #eee;">${suc}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;">${qty}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;">${unit}</td>
  <td style="padding:10px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap;font-weight:800;">${line}</td>
</tr>`;
    })
    .join('');

  return `<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <thead>
    <tr style="background:#fafafa;">
      <th align="left" style="padding:10px 8px;border-bottom:1px solid #eee;">SKU</th>
      <th align="left" style="padding:10px 8px;border-bottom:1px solid #eee;">Producto</th>
      <th align="left" style="padding:10px 8px;border-bottom:1px solid #eee;">Sucursal</th>
      <th align="right" style="padding:10px 8px;border-bottom:1px solid #eee;">Cant.</th>
      <th align="right" style="padding:10px 8px;border-bottom:1px solid #eee;">P. Unit.</th>
      <th align="right" style="padding:10px 8px;border-bottom:1px solid #eee;">Total</th>
    </tr>
  </thead>
  <tbody>${rows || ''}</tbody>
</table>`;
}

function buildAdminNewOrderEmail({ tenantName, order, clientName, items }) {
  const title = `Nuevo pedido ${order.numero || ''}`.trim();
  const subtitle = tenantName ? `Nuevo pedido en ${tenantName}` : 'Nuevo pedido recibido';

  const contentHtml = `
    <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;">
      <div>
        <div style="font-weight:900;font-size:18px;">${escapeHtml(order.numero || 'Pedido')}</div>
        <div style="opacity:.85;margin-top:2px;">Cliente: <b>${escapeHtml(clientName || '')}</b></div>
        <div style="opacity:.85;margin-top:2px;">Estado: <b>${escapeHtml(order.estado || 'pendiente')}</b></div>
      </div>
      <div style="text-align:right;">
        <div style="opacity:.8;font-size:12px;">Total</div>
        <div style="font-weight:900;font-size:18px;">${formatMoneyHNL(order.total)}</div>
      </div>
    </div>
    <div style="margin-top:14px;">${itemsTable(items)}</div>
  `;

  return { subject: title, html: baseEmail({ title, subtitle, contentHtml }) };
}

function buildClientStatusEmail({ tenantName, order, clientName, items }) {
  const pretty = ({ pendiente: 'Pendiente', preparando: 'Preparando', enviado: 'Enviado' })[order.estado] || order.estado;
  const title = `Tu pedido ${order.numero || ''} esta ${pretty}`.trim();
  const subtitle = tenantName ? tenantName : 'Actualizacion de pedido';

  const contentHtml = `
    <div style="font-weight:900;font-size:18px;">${escapeHtml(clientName || 'Cliente')}</div>
    <div style="margin-top:6px;opacity:.9;">El estado de tu pedido <b>${escapeHtml(order.numero || '')}</b> cambio a <b>${escapeHtml(pretty || '')}</b>.</div>
    <div style="margin-top:14px;opacity:.8;font-size:12px;">Resumen</div>
    <div style="margin-top:8px;">${itemsTable(items)}</div>
    <div style="margin-top:12px;text-align:right;">
      <div style="opacity:.8;font-size:12px;">Total</div>
      <div style="font-weight:900;font-size:18px;">${formatMoneyHNL(order.total)}</div>
    </div>
  `;

  return { subject: title, html: baseEmail({ title, subtitle, contentHtml }) };
}

function buildAdminEditedOrderEmail({ tenantName, order, clientName, items }) {
  const title = `Pedido editado ${order.numero || ''}`.trim();
  const subtitle = tenantName ? `Pedido editado en ${tenantName}` : 'Pedido editado';

  const contentHtml = `
    <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;">
      <div>
        <div style="font-weight:900;font-size:18px;">${escapeHtml(order.numero || 'Pedido')} (Editado)</div>
        <div style="opacity:.85;margin-top:2px;">Cliente: <b>${escapeHtml(clientName || '')}</b></div>
        <div style="opacity:.85;margin-top:2px;">Estado: <b>${escapeHtml(order.estado || 'pendiente')}</b></div>
      </div>
      <div style="text-align:right;">
        <div style="opacity:.8;font-size:12px;">Nuevo Total</div>
        <div style="font-weight:900;font-size:18px;">${formatMoneyHNL(order.total)}</div>
      </div>
    </div>
    <div style="margin-top:14px;">${itemsTable(items)}</div>
  `;

  return { subject: title, html: baseEmail({ title, subtitle, contentHtml }) };
}

function buildAdminDeletedOrderEmail({ tenantName, order, clientName, items }) {
  const title = `Pedido eliminado ${order.numero || ''}`.trim();
  const subtitle = tenantName ? `Pedido eliminado en ${tenantName}` : 'Pedido eliminado';

  const contentHtml = `
    <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap;">
      <div>
        <div style="font-weight:900;font-size:18px;color:#ef3d47;">${escapeHtml(order.numero || 'Pedido')} (Eliminado)</div>
        <div style="opacity:.85;margin-top:2px;">Cliente: <b>${escapeHtml(clientName || '')}</b></div>
        <div style="opacity:.85;margin-top:2px;">Estado que tenía: <b>${escapeHtml(order.estado || 'pendiente')}</b></div>
      </div>
      <div style="text-align:right;">
        <div style="opacity:.8;font-size:12px;">Total que tenía</div>
        <div style="font-weight:900;font-size:18px;">${formatMoneyHNL(order.total)}</div>
      </div>
    </div>
    <div style="margin-top:14px;">${itemsTable(items)}</div>
  `;

  return { subject: title, html: baseEmail({ title, subtitle, contentHtml }) };
}

module.exports = {
  buildAdminNewOrderEmail,
  buildClientStatusEmail,
  buildAdminEditedOrderEmail,
  buildAdminDeletedOrderEmail
};

