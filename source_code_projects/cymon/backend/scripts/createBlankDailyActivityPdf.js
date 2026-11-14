const fs = require('fs/promises');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function main() {
  const templateRoot = path.resolve(__dirname, '../../docs/forms-pdf/Templates');
  const pngPath = path.join(templateRoot, 'CMPS Form Template.png');
  const outPath = path.join(templateRoot, '../Forms/CMPS_SE-FO-07 Daily Activity Report_Blank.pdf');

  console.log('Reading PNG...');
  const pngBytes = await fs.readFile(pngPath);
  
  console.log('Creating PDF...');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  
  console.log('Embedding PNG...');
  const background = await pdf.embedPng(pngBytes);
  page.drawImage(background, { x: 0, y: 0, width: 612, height: 792 });
  
  console.log('Saving PDF...');
  const pdfBytes = await pdf.save({ useObjectStreams: false });
  await fs.writeFile(outPath, pdfBytes);
  console.log('Done!');
}

main().catch(console.error);
