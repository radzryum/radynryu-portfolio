const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');

async function testPdf() {
  try {
    const existingPdfBytes = fs.readFileSync('C:\\Users\\Radyn Ryu\\.gemini\\antigravity-ide\\brain\\a65046ad-5429-44eb-9d3c-518c74394039\\.user_uploaded\\media_1787067273983.pdf');
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const pages = pdfDoc.getPages();
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const { width, height } = page.getSize();
      
      // Draw grid lines
      for (let x = 0; x < width; x += 50) {
        page.drawLine({ start: { x, y: 0 }, end: { x, y: height }, thickness: 0.5, color: rgb(1, 0, 0), opacity: 0.5 });
        page.drawText(x.toString(), { x, y: 10, size: 8, color: rgb(1, 0, 0) });
      }
      for (let y = 0; y < height; y += 50) {
        page.drawLine({ start: { x: 0, y }, end: { x: width, y }, thickness: 0.5, color: rgb(0, 0, 1), opacity: 0.5 });
        page.drawText(y.toString(), { x: 10, y, size: 8, color: rgb(0, 0, 1) });
      }
    }
    
    fs.writeFileSync('C:\\Users\\Radyn Ryu\\Desktop\\cymon\\grid_test.pdf', await pdfDoc.save());
    console.log('Grid PDF generated');
  } catch (e) {
    console.error('Error:', e);
  }
}

testPdf();
