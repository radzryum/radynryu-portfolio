const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

async function run() {
  const pdfBytes = fs.readFileSync('docs/forms-pdf/Forms/CMPS_SE-FO-01 Student Admission Form.pdf');
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPages()[0];
  console.log("Page size:", page.getSize());
}
run();
