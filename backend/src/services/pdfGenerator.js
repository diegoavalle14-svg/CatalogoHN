const PDFDocument = require('pdfkit');

function formatMoneyHNL(value) {
  const num = Number(value || 0);
  return `L. ${num.toLocaleString('es-HN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(value) {
  return String(value || '');
}

function generateOrderPDF(order, items) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header Banner (dark background similar to email header / app topbar)
      doc.rect(40, 40, 515, 60).fill('#111111');
      
      // Banner text
      doc.fillColor('#ffffff')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('DETALLE DE PEDIDO', 55, 52);
      
      doc.fillColor('#cccccc')
         .fontSize(11)
         .font('Helvetica')
         .text(order.numero || 'Pedido', 55, 74);
         
      // Logo text right-aligned in header
      doc.fillColor('#F5C200') // Yellow color
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('CatalogoHN', 400, 60, { width: 140, align: 'right' });

      doc.moveDown(3.5);

      // Metadata / Summary section
      const summaryY = doc.y;
      
      // Light background card for client info
      doc.rect(40, summaryY, 515, 65).fill('#f8f8f8');
      
      // Text over the summary box
      doc.fillColor('#111111')
         .fontSize(9)
         .font('Helvetica')
         .text('INFORMACIÓN GENERAL', 50, summaryY + 8);
         
      doc.fillColor('#333333')
         .fontSize(10)
         .font('Helvetica')
         .text(`Cliente:`, 50, summaryY + 23)
         .font('Helvetica-Bold')
         .text(order.cliente_nombre || '', 100, summaryY + 23);
         
      doc.font('Helvetica')
         .text(`Fecha:`, 50, summaryY + 37)
         .font('Helvetica-Bold')
         .text(new Date(order.fecha).toLocaleString('es-HN'), 100, summaryY + 37);

      doc.font('Helvetica')
         .text(`Total:`, 50, summaryY + 50)
         .font('Helvetica-Bold')
         .text(formatMoneyHNL(order.total), 100, summaryY + 50);

      doc.y = summaryY + 80;

      // Table section
      const startX = 40;
      const startY = doc.y;
      
      const cols = {
        sku: { x: 40, width: 90, label: 'CÓDIGO', align: 'left' },
        desc: { x: 130, width: 220, label: 'DESCRIPCIÓN', align: 'left' },
        suc: { x: 350, width: 70, label: 'SUCURSAL', align: 'center' },
        qty: { x: 420, width: 60, label: 'CANTIDAD', align: 'center' },
        price: { x: 480, width: 75, label: 'PRECIO', align: 'right' }
      };

      // Draw table headers
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#666666');
      for (const key in cols) {
        const col = cols[key];
        doc.text(col.label, col.x, startY, { width: col.width, align: col.align });
      }

      // Border bottom for headers
      doc.moveTo(40, startY + 14)
         .lineTo(555, startY + 14)
         .strokeColor('#cccccc')
         .lineWidth(1.5)
         .stroke();

      let currentY = startY + 22;

      // Draw table rows
      doc.fontSize(9).fillColor('#111111');
      for (const item of items) {
        // Page breaking logic: A4 page height is 842. Margin bottom is 40. Keep Y below 780.
        if (currentY > 760) {
          doc.addPage();
          currentY = 50;
        }

        // Draw item data
        doc.font('Helvetica-Bold')
           .text(item.sku || '', cols.sku.x, currentY, { width: cols.sku.width, align: cols.sku.align });
        
        doc.font('Helvetica')
           .text(item.descripcion || '', cols.desc.x, currentY, { width: cols.desc.width, align: cols.desc.align });
        
        doc.text(item.sucursal || '', cols.suc.x, currentY, { width: cols.suc.width, align: cols.suc.align });
        
        doc.font('Helvetica-Bold')
           .text(String(item.cantidad || 0), cols.qty.x, currentY, { width: cols.qty.width, align: cols.qty.align });
        
        const priceStr = formatMoneyHNL(item.precio_unitario);
        doc.font('Helvetica')
           .text(priceStr, cols.price.x, currentY, { width: cols.price.width, align: cols.price.align });

        // Border bottom for rows
        doc.moveTo(40, currentY + 14)
           .lineTo(555, currentY + 14)
           .strokeColor('#eeeeee')
           .lineWidth(0.5)
           .stroke();

        currentY += 22;
      }

      // Finish document
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateOrderPDF
};
