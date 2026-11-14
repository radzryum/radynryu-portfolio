const { PDFDocument } = require('pdf-lib');
const formPdf = require('./backend/lib/formPdf');

async function test() {
  try {
    const bundle = {
      patient: { name: 'Test Student' },
      patientName: 'Test Student',
      parentName: 'Test Parent'
    };
    const submission = {
      document_type_code: 'CMPS:SE-FO-02',
      provisions_agreed: JSON.stringify({ parent_name: 'Test Parent' })
    };
    const pdfBytes = await formPdf.renderFormPdf('CMPS:SE-FO-02', bundle, submission);
    console.log('PDF generated successfully, size:', pdfBytes.length);
  } catch (e) {
    console.error('Error generating PDF:', e);
  }
}
test();

