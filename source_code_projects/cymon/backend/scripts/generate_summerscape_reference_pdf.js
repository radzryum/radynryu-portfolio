const fs = require('node:fs');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

const root = path.resolve(__dirname, '../..');
const templatePath = path.join(root, 'docs/forms-pdf/Templates/CMPS Form Template.png');
const outputPath = path.join(root, 'docs/forms-pdf/Forms/CMPS_SE-FO-12 SummerScape Waiver Form.pdf');
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PURPLE = rgb(0.30, 0.11, 0.55);
const INK = rgb(0.08, 0.08, 0.10);
const LIGHT_PURPLE = rgb(0.94, 0.91, 0.98);

const clauses = [
  ['Nature and Purpose of the Program', 'I understand that the SummerScape Program, organized by ClearMind Psychological Services (CMPS), is a summer play-based activity program designed to provide children with structured opportunities for social interaction, creativity, emotional expression, and developmental engagement. Program activities may include structured play, group games, creative tasks, cooperative activities, sensory play, and guided recreational learning experiences. I acknowledge that the SummerScape Program is an enrichment and recreational program and does not replace formal therapy or psychological treatment unless specifically indicated by the clinic.'],
  ['A. Program Schedule, Session Coverage, and Fees', 'I understand that the SummerScape Program consists of ten (10) sessions conducted during the April and May summer program period, following the schedule assigned by CMPS. CMPS may modify schedules, activities, or program arrangements when necessary due to student accommodations, operational needs, or unforeseen circumstances. The program fee covers participation in scheduled sessions and facilitation of activities only. Missed sessions are generally counted as part of the total sessions and are non-transferable, non-convertible to cash, and non-refundable unless officially approved. The program fee does not cover materials or supplies required for activities.'],
  ['B. Parental Disclosure of Information', 'I affirm that I have fully disclosed relevant medical conditions, allergies, developmental concerns, behavioral considerations, or special needs, if applicable, that may affect my child\'s participation in the SummerScape Program.'],
  ['C. Confidentiality and Data Privacy', 'I consent to the collection, use, storage, and processing of my child\'s personal information for program participation, documentation, safety monitoring, and administrative record-keeping. Information will be treated with strict confidentiality and accessed only by authorized personnel in accordance with applicable data privacy laws and professional ethical standards.'],
  ['D. Student Safety and Monitoring', 'For safety and security purposes, I acknowledge that CCTV cameras are installed in designated clinic areas, including activity and play areas. These are used solely for safety monitoring, security purposes, and incident review, and will only be accessed by authorized personnel in accordance with applicable policies and laws.'],
  ['E. Health, Safety, and Emergency Medical Consent', 'I understand that reasonable precautions will be taken to ensure the safety and well-being of participants. In an emergency when I cannot be reached immediately, I authorize the clinic and its representatives to seek appropriate medical care or assistance for my child. I agree to assume responsibility for medical expenses incurred.'],
  ['F. Participation in Activities', 'I understand that the SummerScape Program involves physical movement, interactive play, and group-based activities appropriate for children. While supervision and safety precautions are provided, participation may involve minor risks such as slips, falls, or minor injuries that may occur despite proper supervision.'],
  ['G. Parental Cooperation and Responsibility', 'I agree to cooperate with the SummerScape Program by ensuring my child arrives on time, bringing my child to and fetching them promptly after each session, supporting program guidelines and staff instructions, and communicating relevant concerns or updates. CMPS is not responsible for students outside official program hours and designated supervision periods.'],
  ['H. Photo and Video Documentation Consent', 'I consent to photographs and/or video recordings during program activities for documentation and promotional purposes only. CMPS commits that faces of non-consenting children will be blurred or obscured, no personally identifiable information will be shared without explicit consent, and media content will be used only for legitimate purposes stated above.'],
  ['I. Program Withdrawal and Discharge Policy', 'I understand that CMPS may discharge a participant for persistent aggressive or unsafe behavior, non-compliance with program policies, medical or health conditions beyond the program scope, non-payment, or conflict with program operations. If discharge is initiated by CMPS, fees for unused sessions may be refunded on a pro-rata basis less applicable administrative charges. Withdrawal is subject to CMPS refund and cancellation policy.'],
];

function wrap(font, text, size, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLine(page, font, text, x, y, width, size = 6.7, color = INK) {
  const lineHeight = size * 1.18;
  const lines = wrap(font, text, size, width);
  lines.forEach((line, index) => page.drawText(line, { x, y: y - index * lineHeight, font, size, color }));
  return lines.length * lineHeight;
}

function drawClause(page, fonts, clause, index, y) {
  const { font, bold } = fonts;
  page.drawText(`${index + 1}. ${clause[0]}`, { x: 44, y, font: bold, size: 8.2, color: PURPLE });
  y -= 11;
  y -= drawLine(page, font, clause[1], 44, y, 520, 6.7);
  y -= 5;
  page.drawRectangle({ x: 44, y: y - 3, width: 9, height: 9, borderColor: PURPLE, borderWidth: 0.8, color: LIGHT_PURPLE });
  page.drawText(`I have read, understood, and agree to the terms in item ${index + 1}.`, {
    x: 60,
    y,
    font: bold,
    size: 6.5,
    color: PURPLE,
  });
  // Use the available long-page space so the clauses are easy to scan and
  // the acknowledgement page does not need to carry a fourth mostly-empty page.
  return y - 35;
}

function drawPageHeader(page, fonts, pageNumber, title) {
  const { font, bold } = fonts;
  page.drawText('CMPS:SE-FO-12 rev.1 03122026', { x: 385, y: 700, font, size: 6.8, color: PURPLE });
  page.drawText('CyMon SummerScape Program', { x: 44, y: 674, font: bold, size: 15, color: PURPLE });
  page.drawText(title, { x: 44, y: 657, font, size: 8.5, color: INK });
  page.drawText(`Page ${pageNumber} of 3`, { x: 500, y: 657, font, size: 6.8, color: PURPLE });
}

async function main() {
  const pdf = await PDFDocument.create();
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const background = await pdf.embedPng(fs.readFileSync(templatePath));
  const fonts = { font, bold };

  for (let pageIndex = 0; pageIndex < 3; pageIndex += 1) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    page.drawImage(background, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT });
    if (pageIndex < 2) {
      const ranges = [[0, 5], [5, 10]][pageIndex];
      drawPageHeader(page, fonts, pageIndex + 1, pageIndex === 0 ? 'Parent/Caregiver Consent and Waiver Form' : 'Terms and Acknowledgement (continued)');
      let y = 640;
      for (let index = ranges[0]; index < ranges[1]; index += 1) y = drawClause(page, fonts, clauses[index], index, y);
    } else {
      drawPageHeader(page, fonts, 3, 'Parent/Caregiver Acknowledgement Form');
      page.drawText('I,', { x: 44, y: 625, font, size: 8, color: INK });
      page.drawLine({ start: { x: 54, y: 623 }, end: { x: 250, y: 623 }, thickness: 0.7, color: INK });
      page.drawText(', the parent/legal guardian of', { x: 255, y: 625, font, size: 8, color: INK });
      page.drawLine({ start: { x: 370, y: 623 }, end: { x: 560, y: 623 }, thickness: 0.7, color: INK });
      page.drawText('Hereby, I voluntarily enroll my child in the CyMon SummerScape Program of ClearMind Psychological Services.', { x: 44, y: 607, font, size: 8, color: INK });
      page.drawText('By signing below, I affirm that I have read and understood this consent and waiver form and voluntarily agree to its terms.', { x: 44, y: 587, font, size: 8, color: INK });

      page.drawRectangle({ x: 44, y: 390, width: 240, height: 155, borderColor: PURPLE, borderWidth: 0.8, color: rgb(0.98, 0.97, 1) });
      page.drawRectangle({ x: 328, y: 390, width: 240, height: 155, borderColor: PURPLE, borderWidth: 0.8, color: rgb(0.98, 0.97, 1) });
      page.drawText('PARENT / GUARDIAN', { x: 55, y: 525, font: bold, size: 8.5, color: PURPLE });
      page.drawText('CMPS REPRESENTATIVE', { x: 339, y: 525, font: bold, size: 8.5, color: PURPLE });
      page.drawText('Contact Number', { x: 55, y: 505, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 55, y: 495 }, end: { x: 270, y: 495 }, thickness: 0.6, color: INK });
      page.drawText('Representative Name', { x: 339, y: 505, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 339, y: 495 }, end: { x: 554, y: 495 }, thickness: 0.6, color: INK });
      page.drawText('Contact Number', { x: 339, y: 476, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 339, y: 466 }, end: { x: 554, y: 466 }, thickness: 0.6, color: INK });
      page.drawText('Signature', { x: 55, y: 457, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 55, y: 435 }, end: { x: 270, y: 435 }, thickness: 0.6, color: INK });
      page.drawText('Signature', { x: 339, y: 457, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 339, y: 435 }, end: { x: 554, y: 435 }, thickness: 0.6, color: INK });
      page.drawText('Date', { x: 55, y: 417, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 55, y: 407 }, end: { x: 270, y: 407 }, thickness: 0.6, color: INK });
      page.drawText('Date', { x: 339, y: 417, font: bold, size: 6.8, color: INK });
      page.drawLine({ start: { x: 339, y: 407 }, end: { x: 554, y: 407 }, thickness: 0.6, color: INK });
      page.drawText('Signature over Printed Name / Date', { x: 55, y: 395, font: bold, size: 6.2, color: INK });
      page.drawText('Signature over Printed Name / Date', { x: 339, y: 395, font: bold, size: 6.2, color: INK });
    }
  }

  fs.writeFileSync(outputPath, await pdf.save({ useObjectStreams: false }));
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
