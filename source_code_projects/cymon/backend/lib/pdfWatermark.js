const { StandardFonts, rgb, degrees } = require('pdf-lib');

// Diagonal preview watermark: "CONFIDENTIAL - DO NOT DISTRIBUTE" plus who
// generated the copy and when — the anti-leak control that identifies the
// source of an exposed screenshot or printout. Skipped for Certified True
// Copies (official admin downloads) and when no requesting user is known.
async function applyPreviewWatermark(pdf, requestingUser, isCtc) {
  if (isCtc || !requestingUser) return;
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
  const dateStr = `${new Date().toLocaleString()}`;
  const rowSpacingY = 220;
  const colSpacingX = 200;
  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize();
    for (let row = -1; row < Math.ceil(height / rowSpacingY) + 2; row++) {
      for (let col = -1; col < Math.ceil(width / colSpacingX) + 2; col++) {
        const baseX = col * colSpacingX + (row % 2 === 0 ? 0 : colSpacingX / 2);
        const baseY = row * rowSpacingY;
        page.drawText('CONFIDENTIAL - DO NOT DISTRIBUTE', {
          x: baseX, y: baseY + 44, size: 13, font: bold,
          color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45),
        });
        page.drawText(userStr, {
          x: baseX, y: baseY + 22, size: 8, font,
          color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45),
        });
        page.drawText(dateStr, {
          x: baseX, y: baseY, size: 8, font,
          color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45),
        });
      }
    }
  }
}

module.exports = { applyPreviewWatermark };
