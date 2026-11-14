const { PDFDocument, StandardFonts, rgb, degrees } = require('pdf-lib');
const { loadTemplateImageBytes } = require('./formTemplateImages');
const { embedSignatureInk } = require('./signatureInk');
const { FO05_STRUCTURE, responseValue } = require('./assessmentSchemas');

const WHITE = rgb(1, 1, 1);
const INK = rgb(0.15, 0.15, 0.15);
const PURPLE = rgb(0.35, 0.20, 0.55);
const LIGHT_PURPLE = rgb(0.90, 0.85, 0.95);
const MUTED = rgb(0.42, 0.42, 0.48);

const FORM_NUMBER = 'CMPS:SE-FO-05 rev.0 02192026';

// Matches the web form's option labels (displayOption in AdaptiveFunctioningAssessmentForm).
const OPTION_LABELS = {
  yes: 'YES',
  no: 'NO',
  left: 'LEFT',
  right: 'RIGHT',
  both: 'BOTH',
  fisted: 'FISTED',
  four_finger: '4-FINGER',
  static_tripod: 'STATIC TRIPOD',
  dynamic_tripod: 'DYNAMIC TRIPOD',
};

const optionLabel = (value) => OPTION_LABELS[String(value || '').toLowerCase()] || String(value || '');

let FO05_TEMPLATE_BYTES = null;
let FO05_TEMPLATE_DOC = null;

async function renderDynamicFO05Pdf({
  bundle,
  submission,
  normalizeBundle,
  parseJson,
  first,
  profileDisplayName,
  nameWithHonorific,
  requestingUser,
  isCtc,
}) {
  const LONG_BOND_WIDTH = 612;
  const LONG_BOND_HEIGHT = 936;
  const MARGIN_LEFT = 50;
  const CONTENT_WIDTH = LONG_BOND_WIDTH - 2 * MARGIN_LEFT;
  const BOTTOM_LIMIT = 90;

  if (!FO05_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templateImageBytes = await loadTemplateImageBytes('cmps-form-template.png');
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_WIDTH, LONG_BOND_HEIGHT]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_WIDTH, height: LONG_BOND_HEIGHT });
    FO05_TEMPLATE_BYTES = await tempPdf.save();
    FO05_TEMPLATE_DOC = await PDFDocument.load(FO05_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(FO05_TEMPLATE_BYTES);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  let currentPage = pdf.getPages()[0];
  const pages = [currentPage];
  let cursorY = LONG_BOND_HEIGHT - 120;

  const drawFormNumber = (page) => {
    page.drawText(FORM_NUMBER, {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize(FORM_NUMBER, 7),
      y: LONG_BOND_HEIGHT - 98,
      size: 7,
      font: bold,
      color: PURPLE,
    });
  };

  const addPage = async () => {
    const [copiedPage] = await pdf.copyPages(FO05_TEMPLATE_DOC, [0]);
    pdf.addPage(copiedPage);
    currentPage = copiedPage;
    pages.push(currentPage);
    drawFormNumber(currentPage);
    cursorY = LONG_BOND_HEIGHT - 120;
  };

  function drawCheckMark(page, x, y, size, color) {
    const s = (size || 8) / 8;
    const path = 'M 0,4 L 3,7 L 8,1';
    page.drawSvgPath(path, {
      x: x - 1,
      y: y + size - 1,
      scale: s,
      borderColor: color,
      borderWidth: 1.5,
    });
  }

  const chunkLongWord = (word, width, fnt, size) => {
    if (fnt.widthOfTextAtSize(word, size) <= width) return [word];
    const chunks = [];
    let rest = word;
    while (rest.length > 0) {
      let broken = '';
      let charIdx = 0;
      while (charIdx < rest.length) {
        if (fnt.widthOfTextAtSize(broken + rest[charIdx], size) > width) {
          if (broken === '') {
            broken = rest[charIdx];
            charIdx += 1;
          }
          break;
        }
        broken += rest[charIdx];
        charIdx += 1;
      }
      chunks.push(broken);
      rest = rest.slice(charIdx);
    }
    return chunks;
  };

  const wrapLines = (text, width, fnt, size) => {
    const out = [];
    String(text || '').split(/\r?\n/).forEach((paragraph) => {
      if (!paragraph.trim()) {
        out.push('');
        return;
      }
      const words = [];
      paragraph.split(' ').forEach((w) => {
        if (!w) return;
        if (fnt.widthOfTextAtSize(w, size) > width) words.push(...chunkLongWord(w, width, fnt, size));
        else words.push(w);
      });
      let line = '';
      words.forEach((word) => {
        const test = line ? `${line} ${word}` : word;
        if (fnt.widthOfTextAtSize(test, size) > width && line) {
          out.push(line);
          line = word;
        } else {
          line = test;
        }
      });
      if (line) out.push(line);
    });
    return out;
  };

  const measureWrapped = (text, width, fnt, size) => {
    if (!text) return size * 1.4;
    return Math.max(size * 1.4, wrapLines(text, width, fnt, size).length * size * 1.25 + 4);
  };

  const drawWrapped = (text, x, y, width, fnt, size, color) => {
    wrapLines(text, width, fnt, size).forEach((line, index) => {
      if (!line) return;
      currentPage.drawText(line, { x, y: y - index * size * 1.25, size, font: fnt, color });
    });
  };

  // ─── main content ─────────────────────────────────────────────────────────

  drawFormNumber(currentPage);

  const d = normalizeBundle(bundle);
  const patient = d.patient || {};
  const metadata = parseJson(submission?.metadata) || {};
  const rawAnswers = parseJson(submission?.answers) || {};
  const answerOf = (key) => String(responseValue(rawAnswers, key) ?? '');

  const toDateStr = (v) => {
    if (!v) return '';
    try {
      return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '';
    }
  };

  // Title
  const titleStr = 'CHILD ADAPTIVE FUNCTIONING ASSESSMENT TOOL';
  currentPage.drawText(titleStr, {
    x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(titleStr, 13)) / 2,
    y: cursorY, size: 13, font: bold, color: PURPLE,
  });
  cursorY -= 22;

  // ─── metadata rows ────────────────────────────────────────────────────────
  const drawDetailRow = (label, value, xOffset = 150) => {
    currentPage.drawText(label, { x: MARGIN_LEFT, y: cursorY, size: 9, font, color: PURPLE });
    if (value) {
      drawWrapped(String(value), MARGIN_LEFT + xOffset + 3, cursorY, CONTENT_WIDTH - xOffset - 3, bold, 9, PURPLE);
    }
    currentPage.drawLine({
      start: { x: MARGIN_LEFT + xOffset, y: cursorY - 2 },
      end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY - 2 },
      thickness: 0.75, color: INK,
    });
    cursorY -= 9 * 1.25 + 2.75;
  };

  const assessmentDate = toDateStr(submission?.submitted_at)
    || toDateStr(submission?.created_at)
    || toDateStr(metadata?.assessment_date)
    || '';
  const lnFnMi = patient.last_name || patient.first_name
    ? [patient.last_name, [patient.first_name, patient.middle_name ? `${String(patient.middle_name).charAt(0).toUpperCase()}.` : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
    : '';
  const assessorProfile = submission?.respondent_profile || {};
  const printableName = (v) => String(v || '').trim();
  const assessorName = first(profileDisplayName(assessorProfile), printableName(submission?.respondent_name));

  drawDetailRow('Date', first(metadata.assessment_date ? toDateStr(metadata.assessment_date) : '', assessmentDate));
  drawDetailRow('Name of Student', first(metadata.student_name, lnFnMi, d.patientName));
  drawDetailRow('Age/Gender', first(metadata.age_gender, [patient.age, patient.sex].filter(Boolean).join(' / ')));
  drawDetailRow('Name of Guardian', first(metadata.guardian_name, d.parentName));
  drawDetailRow(
    'Name of Assessor',
    assessorName
      ? nameWithHonorific(assessorName, assessorProfile.title || assessorProfile.profession || d.representativeProfession || 'Psychometrician')
      : first(metadata.assessor_name, d.representativeName),
  );
  cursorY -= 10;

  // ─── domains ──────────────────────────────────────────────────────────────
  const LABEL_COL_W = 170;
  const CONTENT_X = MARGIN_LEFT + LABEL_COL_W;
  const CONTENT_COL_W = CONTENT_WIDTH - LABEL_COL_W;

  const drawDomainBanner = (title) => {
    const h = 20;
    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: cursorY - h,
      width: CONTENT_WIDTH, height: h,
      color: PURPLE, borderColor: PURPLE, borderWidth: 1,
    });
    currentPage.drawText(title, { x: MARGIN_LEFT + 8, y: cursorY - 14, size: 10, font: bold, color: WHITE });
    cursorY -= h;
  };

  const pillSize = (text, fnt, size) => fnt.widthOfTextAtSize(text, size) + 20;

  const layoutPills = (options, width, fnt, size) => {
    // Flow pills left-to-right, wrapping as needed. Returns rows of {text,w}.
    const rows = [];
    let current = [];
    let used = 0;
    options.forEach((text) => {
      const w = pillSize(text, fnt, size);
      const gap = current.length ? 6 : 0;
      if (used + gap + w > width && current.length) {
        rows.push(current);
        current = [];
        used = 0;
      }
      current.push({ text, w });
      used += (current.length > 1 ? 6 : 0) + w;
    });
    if (current.length) rows.push(current);
    return rows;
  };

  const drawPillRow = (options, selected, x, y, width, fnt, size) => {
    // Stored values are keys ('four_finger') while pills show labels
    // ('4-FINGER') — compare on the label form.
    const selectedLabel = optionLabel(selected);
    const rows = layoutPills(options, width, fnt, size);
    const pillH = 18;
    const gapY = 5;
    rows.forEach((row, ri) => {
      let px = x;
      const py = y - ri * (pillH + gapY);
      row.forEach(({ text, w }) => {
        const isSelected = text === selectedLabel;
        if (isSelected) {
          currentPage.drawRectangle({ x: px, y: py - pillH + 5, width: w, height: pillH, color: PURPLE });
        } else {
          currentPage.drawRectangle({ x: px, y: py - pillH + 5, width: w, height: pillH, color: WHITE, borderColor: MUTED, borderWidth: 0.75 });
        }
        const tw = (isSelected ? bold : fnt).widthOfTextAtSize(text, size);
        currentPage.drawText(text, {
          x: px + (w - tw) / 2, y: py - pillH + 5 + (pillH - size) / 2 - 1,
          size, font: isSelected ? bold : fnt, color: isSelected ? WHITE : INK,
        });
        px += w + 6;
      });
    });
    return rows.length * (pillH + gapY) - gapY;
  };

  const drawItemRow = (item, value) => {
    const normalized = String(value || '').toLowerCase();
    const isOption = item.response_type === 'yes_no' || item.response_type === 'select';
    const options = (item.options || []).map(optionLabel);
    const stimuliText = Array.isArray(item.stimuli) && item.stimuli.length
      ? `Stimuli: ${item.stimuli.join(', ')}`
      : '';

    const labelW = LABEL_COL_W - 10;
    const labelH = measureWrapped(item.label, labelW, font, 8.5);
    const stimuliH = stimuliText ? measureWrapped(stimuliText, labelW, font, 7) : 0;

    let contentH;
    if (isOption) {
      const rows = layoutPills(options.length ? options : ['YES', 'NO'], CONTENT_COL_W - 10, font, 8);
      contentH = Math.max(rows.length * (18 + 5) - 5, 18);
    } else {
      contentH = value ? measureWrapped(value, CONTENT_COL_W - 10, font, 8.5) : 14;
    }
    const rowH = Math.max(labelH + stimuliH, contentH) + 12;

    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: cursorY - rowH,
      width: CONTENT_WIDTH, height: rowH,
      borderColor: PURPLE, borderWidth: 0.75,
    });
    currentPage.drawLine({
      start: { x: CONTENT_X, y: cursorY }, end: { x: CONTENT_X, y: cursorY - rowH },
      thickness: 0.75, color: PURPLE,
    });

    drawWrapped(item.label, MARGIN_LEFT + 5, cursorY - 14, labelW, bold, 8.5, INK);
    if (stimuliText) {
      drawWrapped(stimuliText, MARGIN_LEFT + 5, cursorY - 14 - labelH, labelW, font, 7, MUTED);
    }

    if (isOption) {
      const opts = options.length ? options : ['YES', 'NO'];
      drawPillRow(opts, normalized, CONTENT_X + 5, cursorY - 9, CONTENT_COL_W - 10, font, 8);
    } else if (value) {
      drawWrapped(value, CONTENT_X + 5, cursorY - 14, CONTENT_COL_W - 10, font, 8.5, INK);
    }

    cursorY -= rowH;
  };

  for (const domain of FO05_STRUCTURE) {
    const items = domain.items || [];
    // Pre-measure the whole domain so the banner never strands alone.
    if (cursorY < 110) await addPage();
    drawDomainBanner(domain.title);
    for (const item of items) {
      const value = answerOf(item.key);
      // Rough height probe for the page-break check.
      const probeW = CONTENT_COL_W - 10;
      const probeH = item.response_type === 'text'
        ? (value ? measureWrapped(value, probeW, font, 8.5) : 14)
        : 24;
      if (cursorY - (probeH + 40) < BOTTOM_LIMIT) {
        await addPage();
        drawDomainBanner(`${domain.title} (cont.)`);
      }
      drawItemRow(item, value);
    }
    cursorY -= 12;
  }

  // ─── reviewer comment ─────────────────────────────────────────────────────
  const reviewerComment = submission?.reviewer_comment || metadata?.reviewer_comment || '';
  if (reviewerComment) {
    const commentH = measureWrapped(reviewerComment, CONTENT_WIDTH - 10, font, 9);
    if (cursorY - (commentH + 40) < BOTTOM_LIMIT) await addPage();
    currentPage.drawText('Psychologist Comment:', { x: MARGIN_LEFT, y: cursorY, size: 9, font: bold, color: PURPLE });
    cursorY -= 14;
    drawWrapped(reviewerComment, MARGIN_LEFT + 5, cursorY, CONTENT_WIDTH - 10, font, 9, INK);
    cursorY -= commentH + 10;
  }

  // ─── signatures ───────────────────────────────────────────────────────────
  if (cursorY < 200) await addPage();
  const SIG_BLOCK_TOP = cursorY;
  const SIG_COL_W = (CONTENT_WIDTH - 20) / 2;
  const MAX_SIG_W = 190;
  const MAX_SIG_H = 68;

  const drawSignatory = async (profile, imgBase64, blockTopY, blockX, colW, title) => {
    const name = nameWithHonorific(first(profileDisplayName(profile), profile?.fallbackName), title);
    const license = first(profile?.license_no, profile?.prc_no, profile?.prc_number);
    if (imgBase64) {
      try {
        const isJpg = String(imgBase64).startsWith('data:image/jpeg') || String(imgBase64).startsWith('data:image/jpg');
        const image = (await embedSignatureInk(pdf, imgBase64))
          || (isJpg ? await pdf.embedJpg(imgBase64) : await pdf.embedPng(imgBase64));
        const { width: iw, height: ih } = image.scale(1);
        const scale = Math.min(MAX_SIG_W / iw, MAX_SIG_H / ih, 1);
        const sw = iw * scale;
        const sh = ih * scale;
        currentPage.drawImage(image, {
          x: blockX + colW / 2 - sw / 2,
          y: blockTopY - MAX_SIG_H - 32,
          width: sw,
          height: sh,
        });
      } catch (_) { /* leave the box unsigned rather than failing the PDF */ }
    }
    const lineY = blockTopY - MAX_SIG_H - 4;
    currentPage.drawLine({ start: { x: blockX, y: lineY }, end: { x: blockX + colW, y: lineY }, thickness: 0.75, color: PURPLE });
    const titleLabel = `${title}: `;
    const titleLabelW = font.widthOfTextAtSize(titleLabel, 9);
    currentPage.drawText(titleLabel, { x: blockX, y: lineY - 10, size: 9, font, color: INK });
    currentPage.drawText(name || '', { x: blockX + titleLabelW, y: lineY - 10, size: 9, font: bold, color: PURPLE });
    if (license) {
      const licLabel = 'License Number: ';
      const licLabelW = font.widthOfTextAtSize(licLabel, 9);
      currentPage.drawText(licLabel, { x: blockX, y: lineY - 22, size: 9, font, color: INK });
      currentPage.drawText(String(license), { x: blockX + licLabelW, y: lineY - 22, size: 9, font, color: INK });
    }
    const dateLabel = 'Date: ';
    const dateLabelW = font.widthOfTextAtSize(dateLabel, 9);
    currentPage.drawText(dateLabel, { x: blockX, y: lineY - 34, size: 9, font, color: INK });
    currentPage.drawText(assessmentDate || '', { x: blockX + dateLabelW, y: lineY - 34, size: 9, font, color: INK });
  };

  const prepared = submission?.answered_profile || submission?.respondent_profile || patient.treating_psychometrician || {};
  const noted = submission?.reviewer_profile || patient.treating_psychologist || {};
  const preparedSig = first(submission?.answered_signature_image, submission?.respondent_signature_image);
  const notedSig = first(submission?.reviewer_signature_image, submission?.signed_by_signature_image);

  currentPage.drawText('Prepared by:', { x: MARGIN_LEFT, y: SIG_BLOCK_TOP, size: 9, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: MARGIN_LEFT + SIG_COL_W + 20, y: SIG_BLOCK_TOP, size: 9, font: bold, color: INK });
  await drawSignatory({ ...prepared }, preparedSig, SIG_BLOCK_TOP - 2, MARGIN_LEFT, SIG_COL_W, 'Psychometrician');
  await drawSignatory({ ...noted }, notedSig, SIG_BLOCK_TOP - 2, MARGIN_LEFT + SIG_COL_W + 20, SIG_COL_W, 'Psychologist');

  // ─── page numbers ─────────────────────────────────────────────────────────
  pages.forEach((pg, idx) => {
    const txt = `Page ${idx + 1} of ${pages.length}`;
    pg.drawText(txt, {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize(txt, 9),
      y: 52,
      size: 9, font: bold, color: PURPLE,
    });
  });

  // ─── watermark (same marking the template version carried) ────────────────
  if (!isCtc && requestingUser) {
    const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
    const dateStr = `${new Date().toLocaleString()}`;
    pages.forEach((pg) => {
      const { width, height } = pg.getSize();
      const rowSpacingY = 220;
      const colSpacingX = 200;
      for (let row = -1; row < Math.ceil(height / rowSpacingY) + 2; row += 1) {
        for (let col = -1; col < Math.ceil(width / colSpacingX) + 2; col += 1) {
          const baseX = col * colSpacingX + (row % 2 === 0 ? 0 : colSpacingX / 2);
          const baseY = row * rowSpacingY;
          pg.drawText('CONFIDENTIAL - DO NOT DISTRIBUTE', {
            x: baseX, y: baseY + 44, size: 13, font: bold,
            color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45),
          });
          pg.drawText(userStr, {
            x: baseX, y: baseY + 22, size: 8, font,
            color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45),
          });
          pg.drawText(dateStr, {
            x: baseX, y: baseY, size: 8, font,
            color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45),
          });
        }
      }
    });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { renderDynamicFO05Pdf };
