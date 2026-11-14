const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');

const PURPLE = rgb(0.34, 0.11, 0.55);
const MUTED = rgb(0.35, 0.38, 0.45);
const BORDER = rgb(0.86, 0.82, 0.93);
const LIGHT_PURPLE = rgb(0.96, 0.94, 0.99);

function text(value, fallback = '-') {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text(value);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila',
  });
}

function formatTime(value) {
  if (!value) return '-';
  const [hour, minute] = String(value).slice(0, 5).split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return text(value);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function wrap(value, maxLength = 82) {
  const words = text(value).split(/\s+/);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : ['-'];
}

function drawWrapped(page, value, x, y, font, size, color, maxLength = 82, lineHeight = 14) {
  wrap(value, maxLength).forEach((line, index) => {
    page.drawText(line, { x, y: y - index * lineHeight, size, font, color });
  });
  return y - wrap(value, maxLength).length * lineHeight;
}

function drawField(page, label, value, x, y, font, bold) {
  page.drawText(`${label}:`, { x, y, size: 10, font: bold, color: PURPLE });
  page.drawText(text(value), { x: x + 112, y, size: 10, font, color: rgb(0.12, 0.13, 0.18) });
  return y - 20;
}

async function renderAssessmentReleaseSlipPdf({ studentName, patientId, request, items = [], requestingUser, isCtc }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  page.drawRectangle({ x: 0, y: height - 116, width, height: 116, color: PURPLE });
  page.drawText('ClearMind Psychological Services', {
    x: 42, y: height - 48, size: 19, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText('Assessment document pick-up slip', {
    x: 42, y: height - 72, size: 11, font, color: rgb(0.91, 0.86, 0.98),
  });
  page.drawText('CMPS', {
    x: width - 92, y: height - 62, size: 18, font: bold, color: rgb(0.85, 0.73, 0.98),
  });

  let y = height - 154;
  page.drawText('Student Information', { x: 42, y, size: 13, font: bold, color: PURPLE });
  y -= 26;
  y = drawField(page, 'Student name', studentName, 42, y, font, bold);
  y = drawField(page, 'Student ID', patientId, 42, y, font, bold);
  y = drawField(page, 'Slip status', request.status === 'released' ? 'Released' : 'Scheduled for pick-up', 42, y, font, bold);

  y -= 10;
  page.drawRectangle({ x: 36, y: y - 150, width: width - 72, height: 150, color: LIGHT_PURPLE, borderColor: BORDER, borderWidth: 1 });
  page.drawText('Clinic Appointment', { x: 50, y: y - 24, size: 13, font: bold, color: PURPLE });
  y -= 50;
  y = drawField(page, 'Scheduled date', formatDate(request.scheduled_date), 50, y, font, bold);
  y = drawField(page, 'Time window', `${formatTime(request.scheduled_start_time)} - ${formatTime(request.scheduled_end_time)}`, 50, y, font, bold);
  y = drawField(page, 'Location', request.location, 50, y, font, bold);
  y -= 8;

  page.drawText('Approved Documents and Fees', { x: 42, y: y - 22, size: 13, font: bold, color: PURPLE });
  y -= 48;
  page.drawLine({ start: { x: 42, y }, end: { x: width - 42, y }, thickness: 1, color: BORDER });
  y -= 19;
  items.forEach((item) => {
    page.drawText(text(item.title, 'Assessment document'), { x: 48, y, size: 10, font, color: rgb(0.12, 0.13, 0.18) });
    page.drawText(`PHP ${Number(item.fee || 0).toFixed(2)}`, { x: width - 135, y, size: 10, font: bold, color: rgb(0.12, 0.13, 0.18) });
    y -= 18;
  });
  page.drawLine({ start: { x: 42, y: y + 5 }, end: { x: width - 42, y: y + 5 }, thickness: 1, color: BORDER });
  page.drawText('Total amount due', { x: 48, y: y - 14, size: 11, font: bold, color: PURPLE });
  page.drawText(`PHP ${Number(request.total_amount || 0).toFixed(2)}`, { x: width - 135, y: y - 14, size: 11, font: bold, color: PURPLE });
  y -= 50;

  page.drawText('Clinic Notice', { x: 42, y: y - 12, size: 12, font: bold, color: PURPLE });
  y = drawWrapped(page, request.admin_note || 'Please bring this slip and arrive during your designated time window. Payment may be settled at the clinic cashier before document release.', 42, y - 34, font, 10, MUTED, 88, 15);

  page.drawLine({ start: { x: 42, y: 92 }, end: { x: width - 42, y: 92 }, thickness: 1, color: BORDER });
  page.drawText('Please keep this slip for your clinic visit.', { x: 42, y: 68, size: 9, font, color: MUTED });
  page.drawText('Generated from your ClearMind client account.', { x: 42, y: 52, size: 9, font, color: MUTED });

  // Apply Watermarks — CTC skips watermark entirely; standard tiles diagonally
  if (!isCtc && requestingUser) {
    const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
    const dateStr = `${new Date().toLocaleString()}`;

    const rowSpacingY = 220;
    const colSpacingX = 200;
    for (let row = -1; row < Math.ceil(height / rowSpacingY) + 2; row++) {
      for (let col = -1; col < Math.ceil(width / colSpacingX) + 2; col++) {
        const baseX = col * colSpacingX + (row % 2 === 0 ? 0 : colSpacingX / 2);
        const baseY = row * rowSpacingY;

        page.drawText('CONFIDENTIAL - DO NOT DISTRIBUTE', {
          x: baseX,
          y: baseY + 44,
          size: 13,
          font: bold,
          color: rgb(0.60, 0.60, 0.60),
          opacity: 0.25,
          rotate: degrees(45),
        });
        page.drawText(userStr, {
          x: baseX,
          y: baseY + 22,
          size: 8,
          font,
          color: rgb(0.60, 0.60, 0.60),
          opacity: 0.25,
          rotate: degrees(45),
        });
        page.drawText(dateStr, {
          x: baseX,
          y: baseY,
          size: 8,
          font,
          color: rgb(0.60, 0.60, 0.60),
          opacity: 0.25,
          rotate: degrees(45),
        });
      }
    }
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { renderAssessmentReleaseSlipPdf };
