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

      doc.y = summaryY + 85;

      // Table section
      const startX = 40;
      const startY = doc.y;
      
      const cols = {
        sku: { x: 40, width: 90, label: 'CÓDIGO', align: 'left' },
        desc: { x: 130, width: 230, label: 'DESCRIPCIÓN', align: 'left' },
        suc: { x: 360, width: 40, label: 'SUC.', align: 'center' },
        qty: { x: 400, width: 60, label: 'CANT.', align: 'center' },
        price: { x: 460, width: 95, label: 'PRECIO', align: 'right' }
      };

      // Draw table headers text
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#666666');
      for (const key in cols) {
        const col = cols[key];
        // Vertical offset for header label
        doc.text(col.label, col.x, startY + 6, { width: col.width, align: col.align });
      }

      let currentY = startY + 20;

      // Draw table rows text
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Page breaking logic: A4 page height is 842. Margin bottom is 40. Keep Y below 740.
        if (currentY > 740) {
          doc.addPage();
          currentY = 50;
        }

        // Draw SKU
        doc.font('Helvetica-Bold')
           .fontSize(9)
           .fillColor('#111111')
           .text(item.sku || '', cols.sku.x + 6, currentY + 9, { width: cols.sku.width - 12, align: cols.sku.align });
        
        // Draw Description
        doc.font('Helvetica')
           .fontSize(8.5)
           .fillColor('#333333')
           .text(item.descripcion || '', cols.desc.x + 6, currentY + 9, { width: cols.desc.width - 12, align: cols.desc.align });
        
        // Draw Sucursal
        doc.fillColor('#111111')
           .text(item.sucursal || '', cols.suc.x, currentY + 9, { width: cols.suc.width, align: cols.suc.align });
        
        // Draw Quantity Box
        const boxWidth = 28;
        const boxHeight = 18;
        const boxX = cols.qty.x + (cols.qty.width - boxWidth) / 2;
        const boxY = currentY + (28 - boxHeight) / 2;
        
        // Save state, draw yellow border rect, restore state
        doc.save()
           .strokeColor('#F5C200')
           .lineWidth(1.2)
           .roundedRect(boxX, boxY, boxWidth, boxHeight, 3)
           .stroke()
           .restore();
           
        doc.font('Helvetica-Bold')
           .fontSize(9)
           .text(String(item.cantidad || 0), boxX, boxY + 4, { width: boxWidth, align: 'center' });
        
        // Draw Price
        const priceStr = formatMoneyHNL(item.precio_unitario);
        doc.font('Helvetica')
           .text(priceStr, cols.price.x, currentY + 9, { width: cols.price.width - 6, align: cols.price.align });

        currentY += 28;
      }

      // Calculations for footer
      const total = Number(order.total || 0);
      const subtotal = total / 1.15;
      const isv = total - subtotal;
      const totalQty = items.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);

      // Subtotal Row
      doc.font('Helvetica-Bold')
         .fontSize(9)
         .fillColor('#333333')
         .text('Subtotal:', 40, currentY + 6, { width: 410, align: 'right' });
      doc.font('Helvetica')
         .text(formatMoneyHNL(subtotal), cols.price.x, currentY + 6, { width: cols.price.width - 6, align: 'right' });
      
      currentY += 22;

      // ISV Row
      doc.font('Helvetica-Bold')
         .text('ISV (15%):', 40, currentY + 6, { width: 410, align: 'right' });
      doc.font('Helvetica')
         .text(formatMoneyHNL(isv), cols.price.x, currentY + 6, { width: cols.price.width - 6, align: 'right' });
      
      currentY += 22;

      // Total Row
      doc.font('Helvetica-Bold')
         .fillColor('#111111')
         .text('Total:', 40, currentY + 6, { width: 350, align: 'right' });
      doc.text(`${totalQty} uds.`, cols.qty.x, currentY + 6, { width: cols.qty.width, align: 'center' });
      doc.text(formatMoneyHNL(total), cols.price.x, currentY + 6, { width: cols.price.width - 6, align: 'right' });

      const tableBottomY = startY + 20 + items.length * 28;
      const footerBottomY = tableBottomY + 66;

      // Draw Grid Lines (borders and dividers)
      doc.save()
         .strokeColor('#cccccc')
         .lineWidth(0.8);

      // Horizontal grid lines
      doc.moveTo(40, startY).lineTo(555, startY).stroke();
      doc.moveTo(40, startY + 20).lineTo(555, startY + 20).stroke();
      for (let i = 0; i < items.length; i++) {
        const rowBottomY = startY + 20 + (i + 1) * 28;
        doc.moveTo(40, rowBottomY).lineTo(555, rowBottomY).stroke();
      }
      doc.moveTo(40, tableBottomY + 22).lineTo(555, tableBottomY + 22).stroke();
      doc.moveTo(40, tableBottomY + 44).lineTo(555, tableBottomY + 44).stroke();
      doc.moveTo(40, footerBottomY).lineTo(555, footerBottomY).stroke();

      // Vertical grid lines
      // Outer borders
      doc.moveTo(40, startY).lineTo(40, footerBottomY).stroke();
      doc.moveTo(555, startY).lineTo(555, footerBottomY).stroke();
      
      // Internal dividers
      doc.moveTo(130, startY).lineTo(130, tableBottomY).stroke();
      doc.moveTo(360, startY).lineTo(360, tableBottomY + 44).stroke();
      doc.moveTo(400, startY).lineTo(400, footerBottomY).stroke();
      doc.moveTo(460, startY).lineTo(460, footerBottomY).stroke();

      doc.restore();

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
