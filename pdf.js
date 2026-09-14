import PDFDocument from 'pdfkit';

const INK = '#1B2A4A';
const INK_SOFT = '#51617E';
const LINE = '#E3DCC7';
const GOLD = '#B8863E';
const CARD_BG = '#FBF9F3';
const ROW_ALT = '#F2EDDF';
const TRACK = '#ECE5D2';
const MARGIN = 50;
const RIGHT_EDGE = 545;
const CONTENT_WIDTH = RIGHT_EDGE - MARGIN;
const PAGE_BOTTOM = 780;

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
  if (doc.y + needed > PAGE_BOTTOM) {
    doc.addPage();
  }
}

function drawSeparator(doc, color = LINE, width = 1) {
  doc.moveTo(MARGIN, doc.y).lineTo(RIGHT_EDGE, doc.y).strokeColor(color).lineWidth(width).stroke();
}

function drawHeader(doc, subtitle) {
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(20)
    .text('Carnet des proclamations', MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
  doc.moveDown(0.2);
  doc.fillColor(INK_SOFT).font('Helvetica').fontSize(13)
    .text(subtitle, MARGIN, doc.y, { width: CONTENT_WIDTH, align: 'center' });
  doc.moveDown(0.3);
  const midX = (MARGIN + RIGHT_EDGE) / 2;
  doc.moveTo(midX - 22, doc.y).lineTo(midX + 22, doc.y).strokeColor(GOLD).lineWidth(1.5).stroke();
  doc.moveDown(1);
}

function drawFooter(doc) {
  doc.moveDown(1.5);
  ensureSpace(doc, 20);
  doc.font('Helvetica').fontSize(8.5).fillColor(INK_SOFT);
  doc.text(`Document généré le ${formatDate(new Date())} — Carnet des proclamations`, MARGIN, doc.y, {
    width: CONTENT_WIDTH,
    align: 'center',
  });
}

/** Bloc statistique sombre pour mettre un total en valeur. */
function drawStatBlock(doc, label, value) {
  ensureSpace(doc, 60);
  const y = doc.y;
  const h = 50;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, h, 8).fill(INK);
  doc.fillColor('#C9D3E4').font('Helvetica').fontSize(10).text(label, MARGIN + 18, y + 11);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(21).text(String(value), MARGIN + 18, y + 23);
  doc.y = y + h;
  doc.moveDown(1);
}

/**
 * Table nom / proclamations avec un léger bandage des lignes, positionnée
 * dans une boîte de largeur donnée (utilisée seule ou dans une carte "jour").
 */
function drawEntryTable(doc, entries, boxX, boxWidth) {
  const colName = boxX + 12;
  const colCountWidth = 90;
  const colCount = boxX + boxWidth - colCountWidth - 12;
  const rowH = 21;

  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_SOFT);
  doc.text('Nom', colName, doc.y);
  doc.text('Proclamations', colCount, doc.y - doc.currentLineHeight(), { width: colCountWidth, align: 'right' });
  doc.moveDown(0.45);
  doc.moveTo(boxX + 10, doc.y).lineTo(boxX + boxWidth - 10, doc.y).strokeColor(LINE).lineWidth(0.75).stroke();
  doc.moveDown(0.3);

  if (entries.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(INK_SOFT).text('Aucune entrée enregistrée.', colName, doc.y);
    doc.moveDown(0.5);
    return;
  }

  let rowY = doc.y;
  entries.forEach((entry, i) => {
    if (rowY + rowH > PAGE_BOTTOM) {
      doc.addPage();
      rowY = MARGIN;
    }
    if (i % 2 === 1) {
      doc.rect(boxX + 6, rowY - 2, boxWidth - 12, rowH).fill(ROW_ALT);
    }
    doc.font('Helvetica').fontSize(10).fillColor('#1F2421');
    doc.text(entry.name, colName, rowY + 3, { width: boxWidth - colCountWidth - 30 });
    doc.text(String(entry.count), colCount, rowY + 3, { width: colCountWidth, align: 'right' });
    rowY += rowH;
  });
  doc.y = rowY + 6;
}

function measureDayCardHeight(entries) {
  const headerH = 40;
  const tableHeaderH = 26;
  const rows = Math.max(entries.length, 1);
  return headerH + tableHeaderH + rows * 21 + 14;
}

/** Carte visuelle pour un jour : liseré doré, titre + total en pastille, table des noms. */
function drawDayCard(doc, { day, total, entries }) {
  const cardHeight = measureDayCardHeight(entries);
  ensureSpace(doc, cardHeight + 16);

  const boxX = MARGIN;
  const boxWidth = CONTENT_WIDTH;
  const boxY = doc.y;

  doc.roundedRect(boxX, boxY, boxWidth, cardHeight, 8).fillAndStroke(CARD_BG, LINE);
  doc.roundedRect(boxX, boxY, 5, cardHeight, 2.5).fill(GOLD);

  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(INK).text(`Jour ${day}`, boxX + 20, boxY + 13);

  const badgeText = `${total} proclamation${total > 1 ? 's' : ''}`;
  doc.font('Helvetica-Bold').fontSize(9);
  const badgeTextWidth = doc.widthOfString(badgeText);
  const badgeW = badgeTextWidth + 22;
  const badgeH = 19;
  const badgeX = boxX + boxWidth - badgeW - 16;
  const badgeY = boxY + 11;
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 9.5).fill(GOLD);
  doc.fillColor('#FFFFFF').text(badgeText, badgeX, badgeY + 5.5, { width: badgeW, align: 'center' });

  doc.y = boxY + 38;
  drawEntryTable(doc, entries, boxX + 8, boxWidth - 16);

  doc.y = boxY + cardHeight + 16;
}

/** Table des totaux par jour avec une mini barre proportionnelle pour repérer les écarts d'un coup d'œil. */
function drawDailyTotalsChart(doc, dailyTotals) {
  const boxX = MARGIN;
  const boxWidth = CONTENT_WIDTH;
  const barX = boxX + 70;
  const barMaxWidth = 300;
  const rowH = 25;
  const maxTotal = Math.max(1, ...dailyTotals.map((d) => d.total));

  doc.font('Helvetica-Bold').fontSize(9).fillColor(INK_SOFT);
  doc.text('Jour', boxX, doc.y);
  doc.text('Proclamations', boxX + boxWidth - 90, doc.y - doc.currentLineHeight(), { width: 90, align: 'right' });
  doc.moveDown(0.5);
  drawSeparator(doc, LINE, 0.75);
  doc.moveDown(0.3);

  let rowY = doc.y;
  dailyTotals.forEach((d, i) => {
    if (rowY + rowH > PAGE_BOTTOM) {
      doc.addPage();
      rowY = MARGIN;
    }
    if (i % 2 === 1) {
      doc.rect(boxX, rowY - 2, boxWidth, rowH).fill(ROW_ALT);
    }
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`Jour ${d.day}`, boxX + 4, rowY + 5, { width: 56 });

    const barW = (d.total / maxTotal) * barMaxWidth;
    doc.roundedRect(barX, rowY + 8, barMaxWidth, 7, 3.5).fill(TRACK);
    if (barW > 0) doc.roundedRect(barX, rowY + 8, Math.max(barW, 7), 7, 3.5).fill(GOLD);

    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(String(d.total), boxX + boxWidth - 90, rowY + 5, {
      width: 90,
      align: 'right',
    });
    rowY += rowH;
  });
  doc.y = rowY + 10;
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

  const boxY = doc.y;
  const rows = Math.max(entries.length, 1);
  const boxHeight = 34 + rows * 21 + 10;
  doc.roundedRect(MARGIN, boxY, CONTENT_WIDTH, boxHeight, 8).fillAndStroke('#FFFFFF', LINE);
  doc.y = boxY + 14;
  drawEntryTable(doc, entries, MARGIN + 8, CONTENT_WIDTH - 16);
  doc.y = boxY + boxHeight + 16;

  drawStatBlock(doc, 'Total', total);
  drawFooter(doc);
  doc.end();
}

/**
 * Compte rendu PDF agrégé d'une semaine de croisade entière :
 * totaux par jour (avec repère visuel) + total de la semaine + détail par jour en cartes.
 * `days` : [{ day, title, entries, total }, ...] triés par jour croissant.
 */
export function streamCroisadeReport(res, { croisade, days, grandTotal }) {
  const doc = new PDFDocument({ margin: MARGIN, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="compte-rendu-croisade-${croisade._id}.pdf"`);
  doc.pipe(res);

  drawHeader(doc, croisade.title);

  doc.fillColor(INK).font('Helvetica').fontSize(10.5);
  doc.text(`Type : Semaine de croisade (${croisade.dayCount} jours)`);
  doc.text(`Créée le : ${formatDate(croisade.createdAt)}`);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(INK).text('Totaux par jour');
  doc.moveDown(0.5);
  drawDailyTotalsChart(doc, days.map((d) => ({ day: d.day, total: d.total })));

  drawStatBlock(doc, 'Total de la semaine', grandTotal);

  ensureSpace(doc, 40);
  doc.font('Helvetica-Bold').fontSize(12.5).fillColor(INK).text('Détail par jour');
  doc.moveDown(0.6);

  days.forEach((d) => {
    drawDayCard(doc, { day: d.day, total: d.total, entries: d.entries });
  });

  drawFooter(doc);
  doc.end();
}