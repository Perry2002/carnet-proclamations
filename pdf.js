import PDFDocument from 'pdfkit';

const INK = '#1B2A4A';
const INK_SOFT = '#51617E';
const LINE = '#E3DCC7';
const MARGIN = 50;
const RIGHT_EDGE = 545;

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function ensureSpace(doc, needed = 20) {
  if (doc.y > 780 - needed) {
    doc.addPage();
  }
}

function drawSeparator(doc, color = LINE, width = 1) {
  doc.moveTo(MARGIN, doc.y).lineTo(RIGHT_EDGE, doc.y).strokeColor(color).lineWidth(width).stroke();
}

function drawHeader(doc, subtitle) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20)
    .text('Carnet des proclamations', { align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(INK_SOFT).font('Helvetica').fontSize(13)
    .text(subtitle, { align: 'center' });
  doc.moveDown(1.2);
}

function drawFooter(doc) {
  doc.moveDown(2);
  ensureSpace(doc, 20);
  doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT);
  doc.text(
    `Document généré le ${formatDate(new Date())} — Carnet des proclamations`,
    { align: 'center' }
  );
}

function drawEntryTable(doc, entries) {
  const colName = MARGIN;
  const colCount = 400;

  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK);
  doc.text('Nom', colName, doc.y, { continued: false });
  doc.text('Proclamations', colCount, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);
  drawSeparator(doc, LINE, 0.75);
  doc.moveDown(0.4);

  doc.font('Helvetica').fontSize(10.5);
  if (entries.length === 0) {
    doc.fillColor(INK_SOFT).text('Aucune entrée enregistrée.');
    return;
  }
  entries.forEach((entry) => {
    ensureSpace(doc);
    const rowY = doc.y;
    doc.fillColor('#1F2421').text(entry.name, colName, rowY, { width: 330 });
    doc.text(String(entry.count), colCount, rowY);
    doc.moveDown(0.5);
  });
}

/**
 * Compte rendu PDF d'un seul événement (un culte, ou un jour de croisade pris isolément).
 */
export function streamSessionReport(res, { session, entries, total }) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="compte-rendu-${session.slug}.pdf"`);
  doc.pipe(res);

  drawHeader(doc, session.title);

  doc.fillColor(INK).font('Helvetica').fontSize(10.5);
  doc.text(`Type : ${session.type === 'croisade' ? 'Jour de croisade' : 'Culte'}`);
  doc.text(`Statut : ${session.status === 'closed' ? 'Clôturé' : 'Ouvert'}`);
  doc.text(`Créé le : ${formatDate(session.createdAt)}`);
  if (session.closedAt) doc.text(`Clôturé le : ${formatDate(session.closedAt)}`);
  doc.moveDown(1);
  drawSeparator(doc);
  doc.moveDown(0.8);

  drawEntryTable(doc, entries);
  doc.moveDown(0.6);
  drawSeparator(doc, INK, 1.25);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK);
  doc.text(`Total : ${total}`, MARGIN, doc.y);

  drawFooter(doc);
  doc.end();
}

/**
 * Compte rendu PDF agrégé d'une semaine de croisade entière :
 * totaux par jour + total de la semaine + détail nom par nom sous chaque jour.
 * `days` : [{ day, title, entries, total }, ...] triés par jour croissant.
 */
export function streamCroisadeReport(res, { croisade, days, grandTotal }) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="compte-rendu-croisade-${croisade._id}.pdf"`
  );
  doc.pipe(res);

  drawHeader(doc, croisade.title);

  doc.fillColor(INK).font('Helvetica').fontSize(10.5);
  doc.text(`Type : Semaine de croisade (${croisade.dayCount} jours)`);
  doc.text(`Créée le : ${formatDate(croisade.createdAt)}`);
  doc.moveDown(1);
  drawSeparator(doc);
  doc.moveDown(0.8);

  // Totaux par jour
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Totaux par jour');
  doc.moveDown(0.5);

  const colDay = MARGIN;
  const colTotal = 400;
  doc.font('Helvetica-Bold').fontSize(10.5);
  doc.text('Jour', colDay, doc.y, { continued: false });
  doc.text('Proclamations', colTotal, doc.y - doc.currentLineHeight());
  doc.moveDown(0.3);
  drawSeparator(doc, LINE, 0.75);
  doc.moveDown(0.4);

  doc.font('Helvetica').fontSize(10.5);
  days.forEach((d) => {
    ensureSpace(doc);
    const rowY = doc.y;
    doc.fillColor('#1F2421').text(`Jour ${d.day}`, colDay, rowY);
    doc.text(String(d.total), colTotal, rowY);
    doc.moveDown(0.5);
  });

  doc.moveDown(0.4);
  drawSeparator(doc, INK, 1.25);
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK);
  doc.text(`Total de la semaine : ${grandTotal}`, MARGIN, doc.y);
  doc.moveDown(1.4);

  // Détail par jour
  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('Détail par jour');
  doc.moveDown(0.6);

  days.forEach((d) => {
    ensureSpace(doc, 60);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(INK)
      .text(`Jour ${d.day} — ${d.total} proclamation${d.total > 1 ? 's' : ''}`);
    doc.moveDown(0.3);
    drawEntryTable(doc, d.entries);
    doc.moveDown(0.8);
  });

  drawFooter(doc);
  doc.end();
}
