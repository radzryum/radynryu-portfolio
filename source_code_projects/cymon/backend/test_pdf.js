const fs = require('fs');

async function extract() {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync('../docs/forms-pdf/Forms/CMPS_SE-FO-12 SummerScape Waiver Form.pdf'));
  const doc = await pdfjs.getDocument({ data }).promise;
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    console.log(`--- Page ${i} ---`);
    for (const item of textContent.items) {
      if (item.str.trim().length > 0) {
        console.log(`y: ${Math.round(item.transform[5])}, x: ${Math.round(item.transform[4])} | ${item.str}`);
      }
    }
  }
}
extract().catch(console.error);
