const fs = require('fs');
const { PDFDocument, rgb } = require('pdf-lib');

async function run() {
  const pdfBytes = fs.readFileSync('../docs/forms-pdf/Forms/CMPS_SE-FO-01 Student Admission Form.pdf');
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPages()[0];
  page.drawRectangle({
    x: 100, y: 100, width: 100, height: 100,
    borderColor: rgb(0,0,0),
    borderWidth: 1
  });
  console.log("Success");
}
run();
