const fs = require('node:fs/promises');
const path = require('node:path');
const {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
} = require('pdf-lib');
const { renderDynamicFO03Pdf } = require('./dynamicFO03');
const { renderDynamicFO05Pdf } = require('./dynamicFO05');
const { loadTemplateImageBytes } = require('./formTemplateImages');
const { embedSignatureInk } = require('./signatureInk');
const { applyPreviewWatermark } = require('./pdfWatermark');
const {
  FO03_LAYOUT,
  FO04_LAYOUT,
  FO05_LAYOUT,
  FO06_LAYOUT,
  FO07_LAYOUT,
  FO08_LAYOUT,
  FO10_LAYOUT,
} = require('./formLayouts');

const WHITE = rgb(1, 1, 1);
const INK = rgb(0.15, 0.15, 0.15);
const PURPLE = rgb(0.35, 0.20, 0.55);
const {
  BEHAVIORAL_ADMINISTERED_TESTS,
  normalizeBehavioralReportDraft,
} = require('./behavioralReport');
const { shortDisplayName, capitalizeNamePart } = require('./names');
const { iepDurationWeeks } = require('./iep');

const LONG_BOND_WIDTH = 612;
const LONG_BOND_HEIGHT = 936;
const EMAIL_LIKE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TEMPLATE_ROOT = path.resolve(__dirname, '../../docs/forms-pdf');
const TEMPLATE_BYTES_CACHE = new Map();
const TEMPLATE_PATHS = {
  'CMPS:SE-FO-01': path.join(TEMPLATE_ROOT, 'Forms', 'CMPS_SE-FO-01 Student Admission Form.pdf'),
  'CMPS:SE-FO-02': path.join(TEMPLATE_ROOT, 'Forms', 'CMPS_SE-FO-02 Parent_Caregiver Consent and Waiver Form.pdf'),
  'CMPS:SE-FO-03': path.join(TEMPLATE_ROOT, 'Behavioral Assessment', 'CMPS_SE-FO-03 Caregiver Behavioral Observation Checklist.pdf'),
  'CMPS:SE-FO-04': path.join(TEMPLATE_ROOT, 'Behavioral Assessment', 'CMPS_SE-FO-04 Mini Mental Status Examination.pdf'),
  'CMPS:SE-FO-05': path.join(TEMPLATE_ROOT, 'Behavioral Assessment', 'CMPS-SE-FO-05-Child-Adaptive-Functioning-Assessment-Tool-Template-Version.pdf'),
  'CMPS:SE-FO-06': path.join(TEMPLATE_ROOT, 'Behavioral Assessment', 'CMPS_SE-FO-06 Behavioral Assessment Report Editable.pdf'),
  'CMPS:SE-FO-07': path.join(TEMPLATE_ROOT, 'Forms', 'CMPS_SE-FO-07 Daily Activity Report_Blank.pdf'),
  'CMPS:SE-FO-08': path.join(TEMPLATE_ROOT, 'Forms', 'CMPS_SE-FO-09 Sample Progress Summary Report.pdf'),
  'CMPS:SE-FO-09': path.join(TEMPLATE_ROOT, 'Forms', 'CMPS_SE-FO-09 Sample Progress Summary Report.pdf'),
  'CMPS:SE-FO-10': path.join(TEMPLATE_ROOT, 'Forms', 'CMPS_SE-FO-10 Individualized Educational Plan.pdf'),
};

function isIepLikeReport(report = {}) {
  return (
    report.report_type === 'iep' ||
    /(individualized educat(?:ion|ional) plan|\biep\b)/i.test(report.title || '')
  );
}

function inferFormCode(record = {}) {
  const iepLike = isIepLikeReport(record);
  // Legacy IEP rows were sometimes saved with the monthly report code.
  // The title/type is authoritative for those records so they render on FO-10.
  if (iepLike && (!record.document_type_code || record.document_type_code === 'CMPS:SE-FO-08')) {
    return 'CMPS:SE-FO-10';
  }
  if (record.document_type_code) return record.document_type_code;
  if (record.report_type === 'behavioral') return 'CMPS:SE-FO-06';
  if (iepLike) return 'CMPS:SE-FO-10';
  if (record.report_type === 'daily_activity') return 'CMPS:SE-FO-07';
  return 'CMPS:SE-FO-08';
}

function normalizeDailyActivityRecord(record, bundle = {}) {
  if (!record || record.report_type !== 'daily_activity') return record;
  const patient = bundle.patient || {};
  return {
    ...record,
    title: record.title || 'Daily Activity Report',
    finalized_at: record.reviewed_at || record.updated_at || record.created_at,
    prepared_by_id: record.prepared_by_id || record.author_id,
    content: {
      form: {
        session_number: record.session_number,
        student_name: patient.full_name || [patient.first_name, patient.middle_name, patient.last_name].filter(Boolean).join(' '),
        activity_title: record.activity_title,
        targeted_domains: record.target_domain,
        objectives: record.objectives,
        activity_procedure: record.procedure,
        activity_date: record.session_date,
        observations: record.observations,
      },
    },
  };
}

const safe = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const first = (...values) => values.map((value) => safe(value)).find(Boolean) || '';

// Keys that hold a signature image (data-url, base64, or remote URL). Layout
// position objects (page.signatures.*, signatureLines) never match: they are
// objects, and the `signatures` container key itself ends in "s".
const SIGNATURE_IMAGE_KEY_RE = /signature(_image)?$/i;

// Returns a copy of the payload with every signature image nulled out.
// Names, licenses, and dates are kept — only the ink is hidden. Used for
// non-admin previews so signatures stay recorded in the DB but are only
// visible on admin-generated (official) copies.
function stripSignatureImages(value) {
  if (Array.isArray(value)) return value.map(stripSignatureImages);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return JSON.stringify(stripSignatureImages(parsed));
        }
      } catch {
        // Not JSON — leave the string untouched.
      }
    }
    return value;
  }
  if (value && typeof value === 'object') {
    const out = { ...value };
    for (const key of Object.keys(out)) {
      if (SIGNATURE_IMAGE_KEY_RE.test(key) && typeof out[key] === 'string') {
        out[key] = null;
      } else {
        out[key] = stripSignatureImages(out[key]);
      }
    }
    return out;
  }
  return value;
}

function printableName(value) {
  const name = safe(value);
  return name && !EMAIL_LIKE_RE.test(name) ? name : '';
}

function profileDisplayName(profile) {
  const p = profile || {};
  const structuredName = [p.first_name, p.middle_name, p.last_name]
    .map((value) => safe(value))
    .filter(Boolean)
    .join(' ');
  // Hand-typed records may be lowercase — normalize here so every PDF
  // signatory line (admission, waivers, assessments, attendance) renders
  // formally. This is the single funnel for PDF staff/assessor names.
  return capitalizeNamePart(first(
    printableName(structuredName),
    printableName(p.full_name),
    printableName(p.name),
    printableName(p.display_name),
  ));
}

function canonicalHonorific(value) {
  const text = safe(value);
  if (/\brp\s*m\b/i.test(text)) return 'RPm';
  if (/\brp\s*sy\b/i.test(text)) return 'RPsy';
  return '';
}

function honorificForProfession(profession) {
  const text = safe(profession);
  if (/\bpsychometrician\b/i.test(text) || /\brp\s*m\b/i.test(text)) return 'RPm';
  if (/\bpsychologist\b/i.test(text) || /\brp\s*sy\b/i.test(text)) return 'RPsy';
  return '';
}

function nameWithHonorific(name, profession = '') {
  const cleanName = printableName(name);
  if (!cleanName) return '';

  const targetHonorific = honorificForProfession(profession) || canonicalHonorific(cleanName);
  if (!targetHonorific) return cleanName;

  const parts = cleanName.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    const trailingHonorific = parts[0].match(/^(.*)\s+(rp\s*m|rp\s*sy)$/i);
    if (trailingHonorific) return `${trailingHonorific[1].trim()}, ${targetHonorific}`;
    return `${cleanName}, ${targetHonorific}`;
  }
  let hasTargetHonorific = false;
  const normalizedParts = parts.map((part) => {
    const existingHonorific = /^(rp\s*m|rp\s*sy)$/i.test(part) ? canonicalHonorific(part) : '';
    if (!existingHonorific) return part;
    const normalized = existingHonorific;
    if (normalized === targetHonorific) hasTargetHonorific = true;
    return normalized;
  });

  if (!hasTargetHonorific) {
    const existingHonorificIndex = normalizedParts.findIndex((part) => canonicalHonorific(part));
    if (existingHonorificIndex >= 0) normalizedParts.splice(existingHonorificIndex, 0, targetHonorific);
    else normalizedParts.splice(1, 0, targetHonorific);
  }
  return normalizedParts.join(', ');
}

function dateText(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ageFromDob(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const month = now.getMonth() - date.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? String(age) : '';
}

function shortDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return safe(value);
  return date.toLocaleDateString('en-US');
}

function parseJson(value, fallback = {}) {
  if (value && typeof value === 'object') return value;
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function patientDisplay(patient) {
  const p = patient || {};
  return first(p.full_name, [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' '));
}

function booleanValue(value) {
  if (typeof value === 'boolean') return value;
  const normalized = safe(value).toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalized)) return true;
  if (['no', 'false', '0', 'n'].includes(normalized)) return false;
  return null;
}

function sameAddressValue(patient) {
  const p = patient || {};
  const present = safe(p.home_address).toLowerCase();
  const permanent = safe(p.permanent_address).toLowerCase();
  if (!present) return null;
  // Older records predate the explicit address question and have no
  // permanent_address value. The web form treats that as "Same".
  if (!permanent) return true;
  return present === permanent;
}

function signatoryLine(name, profession, license) {
  const cleanProfession = safe(profession);
  const displayName = nameWithHonorific(name, cleanProfession);
  let professionText = cleanProfession;
  // The honorific is already embedded in the name — don't print a profession
  // segment that just repeats it ("Dela Cruz, RPm - RPm - PRC No. ...").
  if (displayName && honorificForProfession(cleanProfession) && canonicalHonorific(displayName)) {
    const residual = cleanProfession
      .replace(/\brp\s*m\b/gi, '')
      .replace(/\brp\s*sy\b/gi, '')
      .replace(/[()\s,.-]+/g, ' ')
      .trim();
    professionText = residual
      ? cleanProfession.replace(/\s*\(\s*(rp\s*m|rp\s*sy)\s*\)/i, '').trim()
      : '';
  }
  return [
    displayName,
    professionText,
    safe(license) ? `PRC No. ${safe(license)}` : '',
  ].filter(Boolean).join(' - ');
}

function profileLine(profile, fallbackName = '', fallbackProfession = '', fallbackLicense = '') {
  const p = profile || {};
  return signatoryLine(
    first(printableName(fallbackName), profileDisplayName(p)),
    first(fallbackProfession, p.title, p.profession),
    first(fallbackLicense, p.license_no, p.prc_no, p.prc_number),
  );
}

function normalizeBundle(bundle = {}) {
  const patient = bundle.patient || {};
  const guardians = Array.isArray(bundle.guardians) ? bundle.guardians : [];
  const primaryGuardian = guardians.find((g) => g.is_primary === true) || guardians[0] || {};
  const mother = guardians.find((g) => String(g.relationship || '').toLowerCase() === 'mother') || guardians[0] || {};
  const father = guardians.find((g) => String(g.relationship || '').toLowerCase() === 'father') || guardians[1] || {};
  const emergency = bundle.emergency || {};
  const clinical = bundle.clinical || {};
  const representative = patient.treating_psychometrician || patient.treating_psychologist || {};

  return {
    patient,
    patientName: patientDisplay(patient),
    primaryGuardian,
    mother,
    father,
    emergency,
    clinical,
    representative,
    parentName: first(
      printableName(patient.parent_printed_name),
      printableName(primaryGuardian.full_name),
      printableName(mother.full_name),
      printableName(father.full_name),
    ),
    parentSignature: patient.parent_signature,
    representativeName: first(printableName(patient.rep_printed_name), profileDisplayName(representative)),
    representativeSignature: patient.rep_signature,
    representativeProfession: first(patient.rep_profession, representative.title, representative.profession),
    representativeLicense: first(patient.rep_license_no, representative.license_no, representative.prc_no),
  };
}

function fitPageToLongBond(page) {
  const sourceWidth = page.getWidth();
  const sourceHeight = page.getHeight();
  const landscape = sourceWidth > sourceHeight;
  const targetWidth = landscape ? LONG_BOND_HEIGHT : LONG_BOND_WIDTH;
  const targetHeight = landscape ? LONG_BOND_WIDTH : LONG_BOND_HEIGHT;
  const sx = targetWidth / sourceWidth;
  const sy = targetHeight / sourceHeight;
  page.scaleContent(sx, sy);
  page.setSize(targetWidth, targetHeight);
  return { sx, sy, sourceWidth, sourceHeight, targetWidth, targetHeight, landscape };
}

function point(layout, x, y) {
  return { x: x * layout.sx, y: y * layout.sy };
}

function textOptions(font, size, color = INK) {
  return { font, size, color, lineHeight: size * 1.18 };
}

function drawText(page, font, value, x, y, options = {}) {
  const valueText = safe(value);
  if (!valueText) return;
  const size = options.size || 9;
  page.drawText(valueText, {
    x,
    y,
    ...textOptions(font, size, options.color || INK),
    maxWidth: options.width || undefined,
  });
}

function drawFitted(page, font, value, x, y, width, options = {}) {
  const valueText = safe(value);
  if (!valueText) return;
  const maxSize = options.size || 9;
  const minSize = options.minSize || 5.5;
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(valueText, size) > width) size -= 0.25;
  page.drawText(valueText, {
    x,
    y,
    ...textOptions(font, size, options.color || PURPLE),
  });
}

function drawCenteredFitted(page, font, value, centerX, y, width, options = {}) {
  const valueText = safe(value);
  if (!valueText) return;
  const maxSize = options.size || 9;
  const minSize = options.minSize || 5.5;
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(valueText, size) > width) size -= 0.25;
  const textWidth = Math.min(width, font.widthOfTextAtSize(valueText, size));
  drawText(page, font, valueText, centerX - textWidth / 2, y, {
    ...options,
    size,
  });
}

// Breaks a single unbroken word (no spaces) into chunks that fit maxWidth,
// so long strings like "vvvv..." wrap downward instead of overflowing.
function splitLongWord(font, word, size, maxWidth) {
  if (!word || font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const chunks = [];
  let current = '';
  for (const char of word) {
    const next = current + char;
    if (font.widthOfTextAtSize(next, size) <= maxWidth || !current) {
      current = next;
    } else {
      chunks.push(current);
      current = char;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Wraps text to lines that fit maxWidth. Words break at spaces; unbroken
// words longer than maxWidth break at the character level. Returns lines.
function wrapWordsToLines(font, value, size, maxWidth) {
  const valueText = safe(value);
  const lines = [];
  if (!valueText) return lines;
  valueText.split(/\r?\n/).forEach((paragraph) => {
    const words = paragraph.trim() ? paragraph.trim().split(/\s+/) : [];
    if (!words.length) {
      lines.push('');
      return;
    }
    let current = '';
    const pushCurrent = () => {
      if (current) {
        lines.push(current);
        current = '';
      }
    };
    words.forEach((word) => {
      splitLongWord(font, word, size, maxWidth).forEach((part, partIndex) => {
        if (partIndex === 0 && current) {
          const next = `${current} ${part}`;
          if (font.widthOfTextAtSize(next, size) <= maxWidth) {
            current = next;
            return;
          }
          pushCurrent();
        } else if (partIndex > 0) {
          pushCurrent();
        }
        current = part;
      });
    });
    if (current) lines.push(current);
  });
  return lines;
}

function drawWrapped(page, font, value, x, y, width, options = {}) {
  const valueText = safe(value);
  if (!valueText) return 0;
  const size = options.size || 8;
  const lineHeight = options.lineHeight || 10;
  const lines = wrapWordsToLines(font, valueText, size, width);
  const maxLines = options.maxLines || lines.length;
  const drawLines = lines.slice(0, maxLines);
  drawLines.forEach((line, index) => {
    const isLastLine = index === drawLines.length - 1;
    if (options.align === 'justify' && !isLastLine) {
      const wordsInLine = line.trim().split(/\s+/);
      if (wordsInLine.length > 1) {
        const wordsWidth = wordsInLine.reduce((sum, word) => sum + font.widthOfTextAtSize(word, size), 0);
        const spaceWidth = (width - wordsWidth) / (wordsInLine.length - 1);
        let currentX = x;
        wordsInLine.forEach((word) => {
          page.drawText(word, {
            x: currentX,
            y: y - index * lineHeight,
            ...textOptions(font, size, options.color || INK),
          });
          currentX += font.widthOfTextAtSize(word, size) + spaceWidth;
        });
        return;
      }
    }

    page.drawText(line, {
      x,
      y: y - index * lineHeight,
      ...textOptions(font, size, options.color || INK),
    });
  });
  return Math.min(lines.length, maxLines) * lineHeight;
}

function wrapByCharacterCount(value, maxCharacters = 140) {
  const valueText = safe(value);
  if (!valueText) return [];
  const lines = [];
  valueText.split(/\r?\n/).forEach((paragraph) => {
    let remaining = paragraph;
    if (!remaining) {
      lines.push('');
      return;
    }
    while (remaining.length > maxCharacters) {
      let breakAt = remaining.lastIndexOf(' ', maxCharacters);
      if (breakAt <= 0) breakAt = maxCharacters;
      lines.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trimStart();
    }
    lines.push(remaining.trim());
  });
  return lines;
}

function drawCharacterLimited(page, font, value, x, y, width, options = {}) {
  const size = options.size || 7.2;
  const lines = [];
  wrapByCharacterCount(value, options.maxCharacters || 140).forEach((chunk) => {
    if (!chunk) {
      lines.push('');
      return;
    }
    const words = chunk.split(/\s+/);
    let current = '';
    words.forEach((word) => {
      let remainingWord = word;
      while (remainingWord) {
        const next = current ? `${current} ${remainingWord}` : remainingWord;
        if (font.widthOfTextAtSize(next, size) <= width) {
          current = next;
          remainingWord = '';
          continue;
        }
        if (current) {
          lines.push(current);
          current = '';
          continue;
        }

        // A long token (for example a pasted URL or identifier) must not
        // escape the cell just because it contains no spaces to wrap at.
        let splitAt = remainingWord.length;
        while (
          splitAt > 1 &&
          font.widthOfTextAtSize(remainingWord.slice(0, splitAt), size) > width
        ) {
          splitAt -= 1;
        }
        lines.push(remainingWord.slice(0, splitAt));
        remainingWord = remainingWord.slice(splitAt);
      }
    });
    if (current) lines.push(current);
  });
  const maxLines = options.maxLines || lines.length;
  const lineHeight = options.lineHeight || 9;
  lines.slice(0, maxLines).forEach((line, index) => {
    drawFitted(page, font, line, x, y - index * lineHeight, width, {
      size,
      minSize: options.minSize || 4.5,
      color: options.color || INK,
    });
  });
  return Math.min(lines.length, maxLines) * lineHeight;
}

function drawActivityPlanCell(page, font, value, column, row, layout) {
  const lineHeight = 8;
  const insetX = 3;
  const insetY = 12;
  return drawCharacterLimited(
    page,
    font,
    value,
    column.x + insetX,
    row.top - insetY,
    column.width - insetX * 2,
    {
      layout,
      size: 6.8,
      lineHeight,
      maxLines: Math.max(1, Math.floor((row.top - row.bottom - 8) / lineHeight)),
      maxCharacters: 140,
      color: INK,
    },
  );
}

function drawCheck(page, font, layout, x, y, checked) {
  if (!checked) return;
  drawCheckMark(page, x, y, 10, PURPLE);
}

function drawCheckMark(page, x, y, size = 8, color = PURPLE) {
  const s = size / 8;
  const cx = x - 2;

  // Use an SVG path to ensure the line join at the corner is rendered cleanly without jutting out.
  const path = 'M 0,4 L 3,7 L 8,1';
  
  page.drawSvgPath(path, {
    x: cx,
    y: y + size - 1,
    scale: s,
    borderColor: color,
    borderWidth: 1.5,
  });
}

function drawFo05Selection(page, font, selection) {
  if (!selection) return;
  page.drawRectangle({
    x: selection.x,
    y: selection.y,
    width: selection.width,
    height: selection.height,
    color: PURPLE,
  });
  const lines = selection.lines || [selection.label];
  const lineHeight = selection.lineHeight || 0;
  lines.forEach((line, index) => {
    drawCenteredFitted(
      page,
      font,
      line,
      selection.x + selection.width / 2,
      selection.textY - index * lineHeight,
      selection.width - 4,
      { size: 9, minSize: 6, color: WHITE },
    );
  });
}

function drawSignatoryLine(page, font, profile, fallbackName, fallbackProfession, fallbackLicense, x, y, width, options = {}) {
  const value = profileLine(profile, fallbackName, fallbackProfession, fallbackLicense);
  if (!value) return;
  drawFitted(page, font, value, x, y, width, {
    size: options.size || 6.5,
    minSize: options.minSize || 4.5,
    color: options.color || PURPLE,
  });
}

async function drawFo06SignatoryBlock(page, pdf, fonts, profile, fallbackName, fallbackProfession, fallbackLicense, signoff, signature, layout) {
  await drawSignature(
    page,
    pdf,
    signature,
    layout,
    signoff.signature.x,
    signoff.signature.y - 8,
    signoff.signature.width,
    signoff.signature.height + 20,
    { thicken: true },
  );

  const profession = first(fallbackProfession, profile.title, profile.profession);
  const license = first(fallbackLicense, profile.license_no, profile.prc_no, profile.prc_number);
  const name = nameWithHonorific(first(profileDisplayName(profile), fallbackName), profession);
  const block = signoff.block;
  drawFitted(page, fonts.bold, name, block.x, block.nameY, block.width, {
    size: block.nameSize,
    minSize: block.minSize,
    color: PURPLE,
  });
  drawFitted(page, fonts.font, profession, block.x, block.professionY, block.width, {
    size: block.detailSize,
    minSize: block.minSize,
    color: INK,
  });
  drawFitted(page, fonts.font, license ? `License Number: ${license}` : '', block.x, block.licenseY, block.width, {
    size: block.detailSize,
    minSize: block.minSize,
    color: INK,
  });
}

async function embedImage(pdf, source) {
  if (!source) return null;
  try {
    let bytes;
    let contentType = '';
    const match = /^data:(image\/(?:png|jpe?g));base64,(.+)$/i.exec(source);
    if (match) {
      contentType = match[1].toLowerCase();
      bytes = Buffer.from(match[2], 'base64');
    } else if (/^https?:\/\//i.test(source)) {
      // Remote photos/signatures must never hang the whole PDF render —
      // a slow storage host used to push previews past 10s. Cap the fetch
      // and render without the image instead of failing the document.
      const response = await fetch(source, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      contentType = response.headers.get('content-type') || '';
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      return null;
    }
    return /jpe?g/i.test(contentType) || /^data:image\/jpe?g/i.test(source)
      ? pdf.embedJpg(bytes)
      : pdf.embedPng(bytes);
  } catch {
    return null;
  }
}

async function drawSignature(page, pdf, source, layout, x, y, width, height, options = {}) {
  const image = (await embedSignatureInk(pdf, source)) || (await embedImage(pdf, source));
  if (!image) return;
  const scale = Math.min(width / image.width, height / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const imageX = x + (width - w) / 2;
  const draw = (offsetX = 0, offsetY = 0) => page.drawImage(image, {
    x: imageX + offsetX,
    y: y + offsetY,
    width: w,
    height: h,
  });
  draw();
  // SignaturePad stores transparent PNGs. A very small offset redraw makes
  // anti-aliased ink strokes read darker without changing uploaded JPGs.
  if (options.thicken && /^data:image\/png;base64,/i.test(source)) draw(0.35, -0.2);
}

async function drawAdmission(page, pdf, fonts, bundle, layout) {
  const { font, bold } = fonts;
  const d = normalizeBundle(bundle);
  const p = d.patient;
  const c = d.clinical;
  const sameAddress = sameAddressValue(p);
  const previouslyDiagnosed = booleanValue(p.previously_diagnosed);
  const otherDisability = booleanValue(p.other_disability);
  const value = (v, x, y, width = 245) => drawFitted(page, font, v, x, y + 3, width, { layout, size: 10.5, minSize: 7.5 });

  value(p.last_name, 226, 654);
  value(p.first_name, 226, 642);
  value(p.middle_name, 226, 627);
  value(dateText(p.date_of_birth), 226, 613);
  value(p.place_of_birth, 226, 598);
  value([p.age ? `${p.age}` : ageFromDob(p.date_of_birth), p.sex ? String(p.sex).toUpperCase() : ''].filter(Boolean).join(' / '), 226, 583);
  value(p.nick_name, 226, 552);
  value(p.home_address, 226, 520, 245);
  value(sameAddress === true ? 'Same' : p.permanent_address, 226, 474, 245);
  drawCheck(page, bold, layout, 381.5, 505, sameAddress === true);
  drawCheck(page, bold, layout, 435, 508, sameAddress === false);
  value(p.citizenship, 226, 461);
  value(p.religion, 226, 447);

  value(d.mother.full_name, 226, 417);
  value(d.mother.occupation, 226, 403);
  value(d.mother.contact_number, 226, 388);
  value(d.mother.email, 226, 374);
  value(d.father.full_name, 226, 355);
  value(d.father.occupation, 226, 343);
  value(d.father.contact_number, 226, 329);
  value(d.father.email, 226, 314);

  value(d.emergency.full_name, 274, 283, 195);
  value(d.emergency.contact_number, 274, 267, 195);
  value(d.emergency.relationship, 274, 253, 195);
  value(c.primary_diagnosis, 226, 214);
  drawCheck(page, bold, layout, 381.5, 225, previouslyDiagnosed === true);
  drawCheck(page, bold, layout, 434.5, 225, previouslyDiagnosed === false);
  value(c.secondary_diagnosis, 226, 171);
  drawCheck(page, bold, layout, 459.4, 184, otherDisability === true);
  drawCheck(page, bold, layout, 507, 184, otherDisability === false);
  value(c.allergies, 75, 145, 395);

  drawCheck(page, bold, layout, 72, 117, c.iep_level === 'HSN');
  drawCheck(page, bold, layout, 72, 105, c.iep_level === 'MSN');
  drawCheck(page, bold, layout, 72, 93, c.iep_level === 'LSN');
  drawCheck(page, bold, layout, 72, 81, c.iep_level === 'Individual');

  const photo = await embedImage(pdf, p.photo_url);
  if (photo) {
    // 1. Define a strictly sized photo frame that perfectly avoids the title text
    const photoSize = 138;
    const photoX = 400; // Shifted right to avoid "STUDENT ADMISSION FORM"
    const photoY = 552;

    // 2. Exactly white out only the space the photo will take, 
    // ensuring no "white halo" is visible outside the frame.
    page.drawRectangle({ x: photoX, y: photoY, width: photoSize, height: photoSize, color: WHITE });

    // 3. Draw the photo perfectly fitting the square
    page.drawImage(photo, { x: photoX, y: photoY, width: photoSize, height: photoSize });

    // 4. Draw the automatic frame tightly around the photo
    page.drawRectangle({
      x: photoX,
      y: photoY,
      width: photoSize,
      height: photoSize,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.5
    });
  }
  // The reference has a white signature rule at native y=49. Draw the signatures
  // so they naturally overlap the rule and the printed names beneath them.
  // Signature dates: the captured DatePicker value wins; the admission date
  // fills gaps (e-sign happens at registration) so the "/DATE" caption under
  // each printed name is never blank, including pre-migration rows.
  // Layout (all native template units — the page CTM scales everything ×1.18,
  // verified by measuring the rendered PDF): checkboxes end ≈83, white
  // caption glyphs ≈47–56, rule ≈58. The name keeps its production baseline
  // (60) and the date sits ABOVE it at 73 — the only arrangement where name,
  // date, checkboxes, and caption all clear each other.
  const parentSigDate = shortDate(first(d.patient.parent_signature_date, d.patient.created_at));
  const repSigDate = shortDate(first(d.patient.rep_signature_date, d.patient.created_at));
  const drawDatedSignatory = (line, date, x, nameY, width) => {
    drawFitted(page, bold, line, x, nameY, width, { size: 10.5, minSize: 7 });
    // Date on its own centered bold purple line above the name.
    // (drawCenteredFitted defaults to INK, so PURPLE must be explicit.)
    // Centered over the rendered NAME (not the block): short names like
    // "Anna Santos" would otherwise leave the date floating far to the right.
    if (!date) return;
    let nameSize = 10.5;
    while (nameSize > 7 && bold.widthOfTextAtSize(line, nameSize) > width) nameSize -= 0.25;
    const nameW = line ? Math.min(width, bold.widthOfTextAtSize(line, nameSize)) : width;
    drawCenteredFitted(page, bold, `Date: ${date}`, x + nameW / 2, nameY + 13, width, { size: 8.5, minSize: 7, color: PURPLE });
  };
  await drawSignature(page, pdf, d.parentSignature, layout, 48, 42, 220, 60, { thicken: true });
  await drawSignature(page, pdf, d.representativeSignature, layout, 307, 42, 255, 60, { thicken: true });
  drawDatedSignatory(profileLine({}, d.parentName, '', ''), parentSigDate, 98, 60, 220);
  drawDatedSignatory(profileLine(d.representative, d.representativeName, d.representativeProfession, d.representativeLicense), repSigDate, 307, 60, 255);
}

async function drawConsent(page, pdf, fonts, bundle, submission, layout, pageIndex) {
  if (!submission || !String(submission.document_type_code || '').endsWith('FO-02')) return;
  const { font, bold } = fonts;
  const d = normalizeBundle(bundle);
  const values = parseJson(submission.provisions_agreed);
  const parentName = first(printableName(values.parent_name), printableName(submission.signature_text), d.parentName);
  const childName = first(values.child_name, d.patientName);
  const parentContact = first(values.parent_contact, d.primaryGuardian.contact_number, d.mother.contact_number, d.father.contact_number, d.patient.contact_number);
  const representativeProfile = [
    d.representative,
    submission.answered_profile,
    submission.signed_by_profile,
  ].find((profile) => profileDisplayName(profile)) || d.representative || {};
  const repName = first(printableName(values.rep_name), profileDisplayName(representativeProfile), d.representativeName);
  const repContact = first(values.rep_contact, representativeProfile.phone, d.representative.phone);
  const parentDate = first(values.parent_date, submission.signed_at);
  const repDate = first(values.rep_date, submission.signed_at);
  const parentSignature = first(values.signature_image, values.parent_signature, values.parent_sig, submission.signature_image, submission.parent_signature, submission.parent_sig);
  const representativeSignature = first(values.rep_signature_image, values.representative_signature, values.rep_sig, submission.rep_signature_image, submission.representative_signature, submission.rep_sig);
  if (pageIndex === 0) return;
  // Keep each value just above its reference rule. The signature image belongs
  // to the Signature/Date row and must never cover the printed name row.

  drawFitted(page, font, parentName, 80, 360, 250, { layout, size: 10.5, minSize: 7.5 });
  drawFitted(page, font, childName, 45, 346, 370, { layout, size: 10.5, minSize: 7.5 });
  drawFitted(page, font, parentName, 183, 276, 240, { layout, size: 10.5, minSize: 7.5 });
  drawFitted(page, font, shortDate(parentDate), 183, 265, 240, { layout, size: 10.5, minSize: 7.5 });
  drawFitted(page, font, parentContact, 183, 254, 240, { layout, size: 10.5, minSize: 7.5 });
  drawSignatoryLine(
    page,
    bold,
    representativeProfile,
    repName,
    first(representativeProfile.title, representativeProfile.profession, d.representativeProfession),
    first(representativeProfile.license_no, representativeProfile.prc_no, d.representativeLicense),
    183,
    230,
    240,
    { size: 10.5, minSize: 7.5 },
  );
  drawFitted(page, font, shortDate(repDate), 183, 218, 240, { layout, size: 10.5, minSize: 7.5 });
  drawFitted(page, font, repContact, 183, 206, 240, { layout, size: 10.5, minSize: 7.5 });
  // Allow signatures to comfortably overlap text fields for a more natural look.
  await drawSignature(page, pdf, parentSignature, layout, 183, 245, 240, 50, { thicken: true });
  await drawSignature(page, pdf, representativeSignature, layout, 183, 198, 240, 50, { thicken: true });
}


function answerEntries(submission) {
  const answers = parseJson(submission?.answers);
  return Object.entries(answers || {}).map(([key, item]) => {
    const response = typeof item === 'object' ? first(item.response, item.answer, item.value) : safe(item);
    const remarks = typeof item === 'object' ? first(item.remarks, item.note, item.comment) : '';
    return { key, response, remarks };
  }).filter((item) => item.response || item.remarks);
}

function answerEntry(submission, key) {
  const answers = parseJson(submission?.answers);
  const item = answers?.[key];
  if (item === undefined || item === null) return { key, response: '', remarks: '' };
  return {
    key,
    response: typeof item === 'object' ? first(item.response, item.answer, item.value) : safe(item),
    remarks: typeof item === 'object' ? first(item.remarks, item.note, item.comment) : '',
  };
}

function normalizedAnswer(value) {
  const normalized = safe(value).toLowerCase().replace(/\s+/g, ' ');
  if (['yes', 'true', '1', 'y'].includes(normalized)) return 'yes';
  if (['no', 'false', '0', 'n'].includes(normalized)) return 'no';
  if (['na', 'n/a', 'not applicable'].includes(normalized)) return 'na';
  return normalized;
}

function storedSubmissionValue(submission, ...keys) {
  const answers = parseJson(submission?.answers);
  const metadata = parseJson(submission?.metadata);
  const values = [];
  keys.forEach((key) => {
    values.push(submission?.[key]);
    values.push(metadata?.[key]);
    const item = answers?.[key];
    if (item && typeof item === 'object') values.push(item.value, item.text, item.response);
    else values.push(item);
  });
  return first(...values);
}

function drawAnswerRows(page, fonts, submission, layout, rows, offset = 0) {
  const { font } = fonts;
  const entries = answerEntries(submission);
  const entriesByKey = Object.fromEntries(entries.map((answer) => [answer.key, answer]));
  rows.forEach((row, index) => {
    const answer = row.key ? (entriesByKey[row.key] || answerEntry(submission, row.key)) : entries[offset + index];
    if (!answer) return;
    const response = normalizedAnswer(answer.response);
    const markX = response === 'yes' ? row.yes : response === 'no' ? row.no : response === 'na' ? row.na : null;
    const markSize = row.size || 8;
    const remarksSize = row.remarksSize || row.size || 8;
    if (markX) drawCheckMark(page, markX, row.y, markSize, PURPLE);
    if (answer.remarks && row.remarks) drawFitted(page, font, answer.remarks, row.remarks, row.y, row.remarksWidth || 55, { layout, size: remarksSize, minSize: 6 });
  });
}

function fo05Metadata(submission) {
  return parseJson(submission?.metadata, {});
}

async function drawFo05Assessment(page, pdf, fonts, bundle, submission, pageIndex, layout) {
  const { font, bold } = fonts;
  const d = normalizeBundle(bundle);
  const metadata = fo05Metadata(submission);
  const answerValue = (key) => answerEntry(submission, key).response;

  if (pageIndex === 0) {
    const page1 = FO05_LAYOUT.page1;
    const drawField = (name, value) => {
      const position = page1.fields[name];
      drawFitted(page, bold, value, position.x, position.y, position.width, {
        layout,
        size: position.size,
        minSize: position.minSize,
        color: PURPLE,
      });
    };
    drawField('assessmentDate', first(metadata.assessment_date, shortDate(submission?.submitted_at || submission?.created_at)));
    const p = d.patient || {};
    const rawStudentName = first(metadata.student_name, d.patientName);
    const studentNameLnFnMi = p.last_name || p.first_name
      ? [p.last_name, [p.first_name, p.middle_name ? p.middle_name.charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
      : String(rawStudentName || '').toUpperCase();
    drawField('studentName', studentNameLnFnMi);

    const rawAgeGender = first(
      metadata.age_gender,
      [ageFromDob(p.date_of_birth), p.sex].filter(Boolean).join(' / '),
    );
    const ageGenderParts = (rawAgeGender || '').split(' / ');
    if (ageGenderParts.length > 1) {
      ageGenderParts[1] = ageGenderParts[1].toUpperCase();
    }
    drawField('ageGender', ageGenderParts.join(' / '));
    drawField('guardianName', first(metadata.guardian_name, d.parentName));
    const assessorProfile = submission?.respondent_profile || {};
    const assessorName = first(profileDisplayName(assessorProfile), printableName(submission?.respondent_name));
    const assessorDetails = assessorName
      ? nameWithHonorific(
        assessorName,
        assessorProfile.title || assessorProfile.profession || d.representativeProfession || 'Psychometrician',
      )
      : '';
    drawField('assessorName', first(
      assessorDetails,
      metadata.assessor_name,
      d.representativeName,
    ));
    // The signature on the right is removed because it's already at the bottom of the form.
    page1.interpretations.forEach((cell) => {
      drawCharacterLimited(page, font, answerValue(cell.key), cell.x, cell.top - 10, cell.width, {
        layout,
        size: 9,
        lineHeight: 11,
        maxLines: cell.maxLines,
        maxCharacters: 9999,
        color: INK,
      });
    });
    ['writing_name_recognition', 'writing_write_name', 'writing_spell_name']
      .forEach((key) => drawFo05Selection(page, bold, page1.selections[key]?.[normalizedAnswer(answerValue(key))]));
    return;
  }

  if (pageIndex === 1) {
    const page2 = FO05_LAYOUT.page2;
    page2.interpretations.forEach((cell) => {
      drawCharacterLimited(page, font, answerValue(cell.key), cell.x, cell.top - 10, cell.width, {
        layout,
        size: 9,
        lineHeight: 11,
        maxLines: cell.maxLines,
        maxCharacters: 9999,
        color: INK,
      });
    });
    const reviewerComment = first(submission?.reviewer_comment, fo05Metadata(submission).reviewer_comment);
    if (reviewerComment) {
      drawText(page, bold, 'Psychologist Comment:', page2.reviewerComment.labelX, page2.reviewerComment.y, {
        size: 6.8,
        color: PURPLE,
      });
      drawCharacterLimited(page, font, reviewerComment, page2.reviewerComment.textX, page2.reviewerComment.y, page2.reviewerComment.width, {
        layout,
        size: 9,
        lineHeight: 11,
        maxLines: page2.reviewerComment.maxLines,
        maxCharacters: 9999,
        color: INK,
      });
    }
    ['writing_dominant_hand', 'writing_pencil_grip']
      .forEach((key) => drawFo05Selection(page, bold, page2.selections[key]?.[normalizedAnswer(answerValue(key))]));

    const psychometrician = d.patient.treating_psychometrician
      || submission?.respondent_profile
      || d.representative
      || {};
    const psychologist = d.patient.treating_psychologist
      || submission?.reviewer_profile
      || {};
    const preparedProfession = first(psychometrician.title, psychometrician.profession, 'Psychometrician');
    const notedProfession = first(psychologist.title, psychologist.profession, 'Psychologist');
    const preparedName = nameWithHonorific(
      first(profileDisplayName(psychometrician), printableName(submission?.respondent_name), d.representativeName),
      preparedProfession,
    );
    const notedName = nameWithHonorific(
      first(profileDisplayName(psychologist), profileDisplayName(submission?.reviewer_profile), d.representativeName),
      notedProfession,
    );
    const preparedLicense = first(psychometrician.license_no, psychometrician.prc_no, d.representativeLicense);
    const notedLicense = first(psychologist.license_no, psychologist.prc_no);
    // Erase the old printed signatory block from the template completely
    page.drawRectangle({ x: 30, y: 360, width: 480, height: 130, color: rgb(1, 1, 1) });

    const SIG_BLOCK_TOP = 460;
    const SIG_COL_W = 230;
    const MAX_SIG_W = 150;
    const MAX_SIG_H = 50;

    const prepX = 35;
    const notX = 285;

    page.drawText('Prepared by:', { x: prepX, y: SIG_BLOCK_TOP, size: 10, font: bold, color: INK });
    page.drawText('Noted by:', { x: notX, y: SIG_BLOCK_TOP, size: 10, font: bold, color: INK });

    const drawSigBox = async (profile, imgBase64, blockTopY, blockX, colW, title) => {
      // The requested format has ", RPm" or ", RPsy" at the end of the name.
      const name = nameWithHonorific(first(profileDisplayName(profile), profile?.fallbackName), title);
      const cleanTitle = title;
      const license = first(profile?.license_no, profile?.prc_no, profile?.prc_number);
      const dateVal = submission?.submitted_at || submission?.created_at || new Date();
      let dateStr = '';
      try { dateStr = new Date(dateVal).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
      catch (e) { dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }

      if (imgBase64) {
        try {
          const isJpg = imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg');
          const image = isJpg ? await pdf.embedJpg(imgBase64) : await pdf.embedPng(imgBase64);
          const { width: iw, height: ih } = image.scale(1);
          const scale = Math.min(MAX_SIG_W / iw, MAX_SIG_H / ih, 1);
          const sw = iw * scale;
          const sh = ih * scale;
          page.drawImage(image, {
            x: blockX + (colW / 2) - (sw / 2),
            y: blockTopY - MAX_SIG_H - 18,
            width: sw,
            height: sh,
          });
        } catch (_) {}
      }

      const lineY = blockTopY - MAX_SIG_H;
      page.drawLine({ start: { x: blockX, y: lineY }, end: { x: blockX + colW, y: lineY }, thickness: 0.75, color: PURPLE });

      const titleLabel = `${cleanTitle}: `;
      const titleLabelW = font.widthOfTextAtSize(titleLabel, 10);
      page.drawText(titleLabel, { x: blockX, y: lineY - 14, size: 10, font: font, color: INK });
      
      // If the name is very long, it might still overflow, but we've increased colW
      page.drawText(name || '', { x: blockX + titleLabelW, y: lineY - 14, size: 10, font: bold, color: PURPLE });

      if (license) {
        const licLabel = 'License Number: ';
        const licLabelW = font.widthOfTextAtSize(licLabel, 10);
        page.drawText(licLabel, { x: blockX, y: lineY - 28, size: 10, font: font, color: INK });
        page.drawText(String(license), { x: blockX + licLabelW, y: lineY - 28, size: 10, font: font, color: INK });
      }

      const dateLabel = 'Date: ';
      const dateLabelW = font.widthOfTextAtSize(dateLabel, 10);
      page.drawText(dateLabel, { x: blockX, y: lineY - 42, size: 10, font: font, color: INK });
      page.drawText(dateStr, { x: blockX + dateLabelW, y: lineY - 42, size: 10, font: font, color: INK });
    };

    const prepSig = first(submission?.respondent_signature_image, fo05Metadata(submission).assessor_signature);
    const notSig = submission?.reviewer_signature_image;
    
    await drawSigBox({ ...psychometrician, fallbackName: printableName(submission?.respondent_name) || d.representativeName }, prepSig, SIG_BLOCK_TOP - 2, prepX, SIG_COL_W, 'Psychometrician');
    await drawSigBox({ ...psychologist, fallbackName: profileDisplayName(submission?.reviewer_profile) || d.representativeName }, notSig, SIG_BLOCK_TOP - 2, notX, SIG_COL_W, 'Psychologist');
  }
}

const FO03_SOURCE_HEIGHT = 792;

function rowBaseline(top, bottom) {
  // The source PDF is 792pt high. Draw the baseline slightly above the
  // vertical center of each source row so the X sits inside the checkbox.
  return FO03_SOURCE_HEIGHT - ((top + bottom) / 2) + 4;
}

function offsetPosition(position, group = {}) {
  return {
    ...position,
    x: position.x + (Number(group.offsetX) || 0),
    y: position.y + (Number(group.offsetY) || 0),
  };
}

function rowsFromPositions(keys, positions, columns, group = {}) {
  const offsetX = Number(group.offsetX) || 0;
  const offsetY = Number(group.offsetY) || 0;
  return keys.map((key, index) => {
    const row = {
      key,
      y: positions[index] + offsetY,
      size: group.size,
      remarksSize: group.remarksSize,
      ...columns,
    };
    ['yes', 'no', 'na', 'remarks'].forEach((coordinate) => {
      if (typeof row[coordinate] === 'number') row[coordinate] += offsetX;
    });
    return row;
  });
}

function rowsFromBounds(keys, bounds, columns) {
  return keys.map((key, index) => ({
    key,
    y: rowBaseline(bounds[index][0], bounds[index][1]),
    ...columns,
  }));
}

function assessmentRowsFor(code, pageIndex, layout = { sx: 1, sy: 1 }) {
  if (code === 'CMPS:SE-FO-05') {
    const spec = FO05_LAYOUT.answerPages[pageIndex];
    if (!spec) return [];
    return rowsFromPositions(spec.keys, spec.y, spec.columns, spec);
  }
  if (code === 'CMPS:SE-FO-03') {
    const spec = FO03_LAYOUT.answerPages[pageIndex];
    if (!spec) return [];
    const rows = rowsFromPositions(spec.keys, spec.y, spec.columns, spec);
    if (spec.removeNaRange) {
      rows.slice(spec.removeNaRange[0], spec.removeNaRange[1]).forEach((row) => { row.na = null; });
    }
    if (spec.removeNaFrom !== undefined) {
      // Perceptual and stimming use Yes/No and have a remarks column.
      const offsetX = Number(spec.offsetX) || 0;
      rows.slice(spec.removeNaFrom).forEach((row) => {
        row.yes = spec.remarksYes + offsetX;
        row.no = spec.remarksNo + offsetX;
        row.na = null;
        row.remarks = spec.remarks + offsetX;
        row.remarksWidth = spec.remarksWidth;
      });
    }
    return rows;
  }
  if (code === 'CMPS:SE-FO-04') {
    const spec = FO04_LAYOUT.answerPages[pageIndex];
    if (!spec) return [];
    const rows = rowsFromPositions(spec.keys, spec.y, spec.columns, spec);
    if (spec.removeNaFrom !== undefined) {
      // The official stimming table has wider Yes/No cells and no N/A column.
      const offsetX = Number(spec.offsetX) || 0;
      rows.slice(spec.removeNaFrom).forEach((row) => {
        row.yes = spec.remarksYes + offsetX;
        row.no = spec.remarksNo + offsetX;
        row.na = null;
        row.remarks = spec.remarks + offsetX;
        row.remarksWidth = spec.columns.remarksWidth;
      });
    }
    return rows;
  }
  return [];
}

async function drawAssessment(page, pdf, fonts, bundle, submission, code, pageIndex, layout) {
  const { font, bold } = fonts;
  if (code === 'CMPS:SE-FO-05') {
    await drawFo05Assessment(page, pdf, fonts, bundle, submission, pageIndex, layout);
    return;
  }
  const d = normalizeBundle(bundle);
  const p = d.patient;
  const assessmentDate = first(
    storedSubmissionValue(submission, 'assessment_date', 'date'),
    submission?.submitted_at,
    submission?.created_at,
  );
  const studentName = first(
    storedSubmissionValue(submission, 'student_name', 'full_name', 'patient_name'),
    d.patientName,
  );
  const studentDob = first(
    storedSubmissionValue(submission, 'birthday', 'date_of_birth', 'birthdate'),
    p.date_of_birth,
  );
  const studentAge = first(
    storedSubmissionValue(submission, 'age'),
    p.age,
    ageFromDob(studentDob),
  );
  const rawStudentSex = first(storedSubmissionValue(submission, 'sex'), p.sex);
  const studentSex = rawStudentSex ? rawStudentSex.charAt(0).toUpperCase() + rawStudentSex.slice(1).toLowerCase() : '';
  const diagnosis = first(
    storedSubmissionValue(submission, 'diagnosis'),
    d.clinical.primary_diagnosis,
    d.clinical.working_diagnosis,
    d.clinical.secondary_diagnosis,
    p.diagnosis,
  );
  const medicalHistory = first(
    storedSubmissionValue(submission, 'medical_history', 'medicalHistory'),
    d.clinical.medical_history,
    d.clinical.medicalHistory,
    p.medical_history,
  );
  const familyHistory = first(
    storedSubmissionValue(submission, 'family_history', 'familyHistory'),
    d.clinical.family_history,
    d.clinical.familyHistory,
    p.family_history,
  );
  const respondentName = first(
    printableName(submission?.respondent_name),
    profileDisplayName(submission?.respondent_profile),
    printableName(storedSubmissionValue(submission, 'respondent_name', 'respondent')),
    d.parentName,
  );
  const formValue = (value) => first(value, 'N/A');
  if (code === 'CMPS:SE-FO-05' && pageIndex === 0) {
    const page1 = FO05_LAYOUT.page1;
    const field = (name) => offsetPosition(page1.fields[name], page1);
    const drawField = (name, value) => {
      const position = field(name);
      drawFitted(page, font, value, position.x, position.y, position.width, {
        layout,
        size: position.size,
        minSize: position.minSize,
      });
    };
    drawField('childName', formValue(studentName));
    drawField('assessmentDate', formValue(shortDate(assessmentDate)));
    drawField('age', formValue(studentAge));

    const gender = safe(studentSex).toLowerCase();
    const genderOption = gender.startsWith('f') ? 'female' : gender.startsWith('m') ? 'male' : '';
    Object.entries(page1.genderChecks).forEach(([option, position]) => {
      const spot = offsetPosition(position, page1);
      drawCheck(page, bold, layout, spot.x, spot.y, genderOption === option);
    });

    const relationship = first(
      submission?.respondent_relationship,
      storedSubmissionValue(submission, 'respondent_relationship', 'relationship', 'respondent'),
    ).toLowerCase();
    const respondentText = respondentName.toLowerCase();
    const respondentOption = relationship.includes('teacher')
      ? 'teacher'
      : relationship.includes('caregiver')
        ? 'caregiver'
        : relationship.includes('parent') || relationship.includes('mother') || relationship.includes('father') || relationship.includes('guardian')
          ? 'parent'
          : respondentText.includes('teacher')
            ? 'teacher'
            : respondentText.includes('caregiver') || respondentText.includes('guardian') || respondentText.includes('parent')
              ? 'caregiver'
              : 'others';
    Object.entries(page1.respondentChecks).forEach(([option, position]) => {
      const spot = offsetPosition(position, page1);
      drawCheck(page, bold, layout, spot.x, spot.y, respondentOption === option);
    });
    if (respondentOption === 'others') {
      drawField('others', first(
        storedSubmissionValue(submission, 'respondent_relationship', 'relationship'),
        respondentName,
      ));
    }
  }
  if (code === 'CMPS:SE-03' || code === 'CMPS:SE-FO-03' || code === 'CMPS:SE-FO-04') {
    if (code === 'CMPS:SE-FO-03') {
      if (pageIndex === 0) {
        const page1 = FO03_LAYOUT.page1;
        const field = (name) => offsetPosition(page1.fields[name], page1);
        const drawField = (name, value) => {
          const position = field(name);
          drawFitted(page, bold, value, position.x, position.y, position.width, {
            layout,
            size: position.size,
            minSize: position.minSize,
            color: PURPLE,
          });
        };
        drawField('assessmentDate', formValue(dateText(assessmentDate)));
        const studentNameLnFnMi = p.last_name || p.first_name
          ? [p.last_name, [p.first_name, p.middle_name ? p.middle_name.charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
          : String(studentName || '').toUpperCase();
        drawField('studentName', formValue(studentNameLnFnMi));
        drawField('studentDob', formValue(dateText(studentDob)));
        drawField('studentAgeSex', formValue([studentAge, studentSex].filter(Boolean).join(' / ')));

        const diagPos = field('diagnosis');
        const medPos = field('medicalHistory');
        const famPos = field('familyHistory');
        const fieldGap = Math.abs(diagPos.y - medPos.y);
        const lineHeight = 10;

        const wrapField = (pos, value) => {
          const text = safe(value);
          if (!text) return;
          const fs = pos.size || 9;
          const words = text.split(/\s+/);
          const lines = [];
          let currentLine = '';
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (bold.widthOfTextAtSize(testLine, fs) > pos.width && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
          const maxLines = Math.max(1, Math.floor(fieldGap / lineHeight));
          const drawLines = lines.slice(0, maxLines);
          drawLines.forEach((line, idx) => {
            page.drawText(line, {
              x: pos.x,
              y: pos.y - (idx * lineHeight),
              ...textOptions(bold, fs, PURPLE),
            });
          });
        };

        wrapField(diagPos, diagnosis);
        wrapField(medPos, medicalHistory);
        wrapField(famPos, familyHistory);

        const metadata = parseJson(submission?.metadata, {});
        const relationship = first(
          metadata.respondent_relationship,
          submission?.respondent_relationship,
          storedSubmissionValue(submission, 'respondent_relationship', 'relationship'),
        ).toLowerCase();
        const respondentText = respondentName.toLowerCase();
        const respondentOption = relationship.includes('guardian')
          ? 'guardian'
          : relationship.includes('teacher')
            ? 'teacher'
            : relationship.includes('parent') || relationship.includes('mother') || relationship.includes('father') || relationship.includes('caregiver')
              ? 'parent'
              : respondentText.includes('parent') || respondentText.includes('mother') || respondentText.includes('father') || respondentText.includes('caregiver')
                ? 'parent'
                : 'others';
        Object.entries(page1.respondentChecks).forEach(([option, position]) => {
          const spot = offsetPosition(position, page1);
          drawCheck(page, bold, layout, spot.x, spot.y, respondentOption === option);
        });
        if (respondentOption === 'others') {
          const position = field('otherRespondent');
          drawFitted(page, font, first(
            storedSubmissionValue(submission, 'respondent_relationship', 'relationship'),
            formValue(respondentName),
          ), position.x, position.y, position.width, { layout, size: position.size });
        }

        const previouslyDiagnosed = booleanValue(first(
          metadata.previously_diagnosed,
          storedSubmissionValue(submission, 'previously_diagnosed', 'previously_assessed'),
          p.previously_diagnosed,
          d.clinical.previously_diagnosed,
        ));
        const diagnosisChecks = page1.diagnosisChecks;
        const yesPosition = offsetPosition(diagnosisChecks.yes, page1);
        const noPosition = offsetPosition(diagnosisChecks.no, page1);
        const naPosition = offsetPosition(diagnosisChecks.na, page1);
        drawCheck(page, bold, layout, yesPosition.x, yesPosition.y, previouslyDiagnosed === true);
        drawCheck(page, bold, layout, noPosition.x, noPosition.y, previouslyDiagnosed === false);
        if (previouslyDiagnosed === null) {
          drawFitted(page, font, 'N/A', naPosition.x, naPosition.y, naPosition.width, { layout, size: naPosition.size });
        }
      }
    } else {
      if (pageIndex === 0) {
        const page1 = FO04_LAYOUT.page1;
        const field = (name) => offsetPosition(page1.fields[name], page1);
        const drawField = (name, value, addLine = true) => {
          const position = field(name);
          drawFitted(page, bold, value, position.x, position.y, position.width, {
            layout,
            size: position.size,
            minSize: position.minSize,
            color: PURPLE,
          });
          if (addLine) {
            page.drawLine({
              start: { x: position.x - 3, y: position.y - 3 },
              end: { x: position.x + position.width + 10, y: position.y - 3 },
              thickness: 0.75,
              color: INK,
            });
          }
        };
        drawField('assessmentDate', formValue(dateText(assessmentDate)));
        const studentNameLnFnMi = p.last_name || p.first_name
          ? [p.last_name, [p.first_name, p.middle_name ? p.middle_name.charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
          : String(studentName || '').toUpperCase();
        drawField('studentName', formValue(studentNameLnFnMi));
        drawField('studentAgeSex', formValue([studentAge, studentSex].filter(Boolean).join(' / ')));
        drawField('studentDob', formValue(dateText(studentDob)));

        const diagPos = field('diagnosis');
        const medPos = field('medicalHistory');
        const famPos = field('familyHistory');
        const fieldGap = Math.abs(diagPos.y - medPos.y);
        const lineHeight = 10;

        const wrapField = (pos, value) => {
          const text = safe(value);
          if (!text) return;
          const fs = pos.size || 9;
          const words = text.split(/\s+/);
          const lines = [];
          let currentLine = '';
          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (bold.widthOfTextAtSize(testLine, fs) > pos.width && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
          const maxLines = Math.max(1, Math.floor(fieldGap / lineHeight));
          const drawLines = lines.slice(0, maxLines);
          drawLines.forEach((line, idx) => {
            page.drawText(line, {
              x: pos.x,
              y: pos.y - (idx * lineHeight),
              ...textOptions(bold, fs, PURPLE),
            });
          });
        };

        wrapField(diagPos, diagnosis);
        wrapField(medPos, medicalHistory);
        wrapField(famPos, familyHistory);
        const metadata = parseJson(submission?.metadata, {});
        const previouslyDiagnosed = booleanValue(first(
          metadata.previously_diagnosed,
          storedSubmissionValue(submission, 'previously_diagnosed', 'previously_assessed'),
          p.previously_diagnosed,
          d.clinical.previously_diagnosed,
        ));
        const yesPosition = offsetPosition(page1.previouslyDiagnosedChecks.yes, page1);
        const noPosition = offsetPosition(page1.previouslyDiagnosedChecks.no, page1);
        const naPosition = offsetPosition(page1.fields.previouslyDiagnosedNa, page1);
        drawCheck(page, bold, layout, yesPosition.x, yesPosition.y, previouslyDiagnosed === true);
        drawCheck(page, bold, layout, noPosition.x, noPosition.y, previouslyDiagnosed === false);
        if (previouslyDiagnosed === null) {
          drawFitted(page, font, 'N/A', naPosition.x, naPosition.y, naPosition.width, { layout, size: naPosition.size });
        }
      }
    }
  }
  const rows = assessmentRowsFor(code, pageIndex, layout);
  if (rows.length) {
    const priorRows = Array.from({ length: pageIndex }, (_, priorPage) => assessmentRowsFor(code, priorPage, layout).length)
      .reduce((sum, count) => sum + count, 0);
    drawAnswerRows(page, fonts, submission, layout, rows, priorRows);
  }

  const respondent = submission?.respondent_profile || {};
  const reviewer = submission?.reviewer_profile || d.representative || {};
  const reviewerProfession = first(reviewer.title, reviewer.profession, d.representativeProfession, 'Psychologist');
  const reviewerName = nameWithHonorific(first(profileDisplayName(reviewer), d.representativeName), reviewerProfession);
  if (code === 'CMPS:SE-FO-05' && pageIndex === 2) {
    const page3 = FO05_LAYOUT.page3;
    const checkedBy = submission?.answered_profile || submission?.respondent_profile || d.representative || {};
    const approvedBy = submission?.reviewer_profile || d.representative || {};
    const checkedProfession = first(checkedBy.title, checkedBy.profession, d.representativeProfession);
    const approvedProfession = first(approvedBy.title, approvedBy.profession, d.representativeProfession, 'Psychologist');
    const checkedName = nameWithHonorific(first(profileDisplayName(checkedBy), printableName(submission?.respondent_name), d.representativeName), checkedProfession);
    const approvedName = nameWithHonorific(first(profileDisplayName(approvedBy), d.representativeName), approvedProfession);
    const checkedSignature = first(
      submission?.answered_signature_image,
      submission?.respondent_signature_image,
    );
    const approvedSignature = first(
      submission?.reviewer_signature_image,
      submission?.signed_by_signature_image,
    );
    const checkedPosition = offsetPosition(page3.signatures.checkedBy, page3);
    const approvedPosition = offsetPosition(page3.signatures.approvedBy, page3);
    await drawSignature(page, pdf, checkedSignature, layout, checkedPosition.x, checkedPosition.y, checkedPosition.width, checkedPosition.height);
    await drawSignature(page, pdf, approvedSignature, layout, approvedPosition.x, approvedPosition.y, approvedPosition.width, approvedPosition.height);

    const checkedLinePosition = offsetPosition(page3.printedLines.checkedBy, page3);
    const approvedLinePosition = offsetPosition(page3.printedLines.approvedBy, page3);
    const signatureDate = shortDate(assessmentDate);
    drawFitted(
      page,
      bold,
      [checkedName, signatureDate].filter(Boolean).join(' - '),
      checkedLinePosition.x,
      checkedLinePosition.y,
      checkedLinePosition.width,
      { size: checkedLinePosition.size, minSize: checkedLinePosition.minSize, color: PURPLE },
    );
    drawFitted(
      page,
      bold,
      [approvedName, signatureDate].filter(Boolean).join(' - '),
      approvedLinePosition.x,
      approvedLinePosition.y,
      approvedLinePosition.width,
      { size: approvedLinePosition.size, minSize: approvedLinePosition.minSize, color: PURPLE },
    );
  }
  if (code === 'CMPS:SE-FO-03' && pageIndex === 3) {
    const page4 = FO03_LAYOUT.page4;
    const respondentSignature = offsetPosition(page4.signatures.respondent, page4);
    const reviewerSignature = offsetPosition(page4.signatures.reviewer, page4);
    await drawSignature(page, pdf, submission?.respondent_signature_image, layout, respondentSignature.x, respondentSignature.y, respondentSignature.width, respondentSignature.height);
    await drawSignature(page, pdf, submission?.reviewer_signature_image, layout, reviewerSignature.x, reviewerSignature.y, reviewerSignature.width, reviewerSignature.height);
    const signatureDate = shortDate(assessmentDate);
    const respondentLine = [respondentName, signatureDate].filter(Boolean).join(' - ');
    const reviewerLine = [
      reviewerName,
      reviewerProfession,
      first(reviewer.license_no, d.representativeLicense) ? `PRC No. ${first(reviewer.license_no, d.representativeLicense)}` : '',
      signatureDate,
    ].filter(Boolean).join(' - ');
    const respondentLinePosition = offsetPosition(page4.signatureLines.respondent, page4);
    const reviewerLinePosition = offsetPosition(page4.signatureLines.reviewer, page4);
    drawFitted(page, bold, respondentLine, respondentLinePosition.x, respondentLinePosition.y, respondentLinePosition.width, {
      size: respondentLinePosition.size,
      minSize: respondentLinePosition.minSize,
      color: PURPLE,
    });
    drawFitted(page, bold, reviewerLine, reviewerLinePosition.x, reviewerLinePosition.y, reviewerLinePosition.width, {
      size: reviewerLinePosition.size,
      minSize: reviewerLinePosition.minSize,
      color: PURPLE,
    });
  }
  if (code === 'CMPS:SE-FO-04' && pageIndex === 1) {
    const prepared = submission?.answered_profile || submission?.respondent_profile || p.treating_psychometrician || {};
    const noted = submission?.reviewer_profile || p.treating_psychologist || {};
    const preparedSig = first(submission?.answered_signature_image, submission?.respondent_signature_image);
    const notedSig = first(submission?.reviewer_signature_image, submission?.signed_by_signature_image);

    const SIG_COL_W = 220;
    const MAX_SIG_W = 190;
    const MAX_SIG_H = 64;
    const blockTopY = 160;

    const drawSignatory = async (profile, imgBase64, blockX, title) => {
      const name = nameWithHonorific(first(profileDisplayName(profile), profile?.fallbackName, respondentName), title);
      const license = first(profile?.license_no, profile?.prc_no, profile?.prc_number, d.representativeLicense);

      if (imgBase64) {
        try {
          const isJpg = imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg');
          const image = (await embedSignatureInk(pdf, imgBase64))
            || (isJpg ? await pdf.embedJpg(imgBase64) : await pdf.embedPng(imgBase64));
          const { width: iw, height: ih } = image.scale(1);
          const scale = Math.min(MAX_SIG_W / iw, MAX_SIG_H / ih, 1);
          const sw = iw * scale;
          const sh = ih * scale;
          page.drawImage(image, {
            x: blockX + (SIG_COL_W / 2) - (sw / 2),
            // Bottom sits just below the name baseline so the signature
            // overlaps the printed name like a natural wet signature.
            y: blockTopY - MAX_SIG_H - 20,
            width: sw,
            height: sh,
          });
        } catch (_) {}
      }

      const lineY = blockTopY - MAX_SIG_H - 4;
      page.drawLine({
        start: { x: blockX, y: lineY },
        end: { x: blockX + SIG_COL_W, y: lineY },
        thickness: 0.75, color: PURPLE,
      });

      const titleLabel = `${title}: `;
      const titleLabelW = fonts.font.widthOfTextAtSize(titleLabel, 9);
      drawFitted(page, fonts.font, titleLabel, blockX, lineY - 10, SIG_COL_W, { size: 9, minSize: 9, color: INK });
      drawFitted(page, bold, name || '', blockX + titleLabelW, lineY - 10, SIG_COL_W - titleLabelW, { size: 9, minSize: 9, color: PURPLE });

      if (license) {
        const licLabel = 'License Number: ';
        const licLabelW = fonts.font.widthOfTextAtSize(licLabel, 9);
        drawFitted(page, fonts.font, licLabel, blockX, lineY - 22, SIG_COL_W, { size: 9, minSize: 9, color: INK });
        drawFitted(page, fonts.font, String(license), blockX + licLabelW, lineY - 22, SIG_COL_W - licLabelW, { size: 9, minSize: 9, color: INK });
      }

      const dateLabel = 'Date: ';
      const dateLabelW = fonts.font.widthOfTextAtSize(dateLabel, 9);
      drawFitted(page, fonts.font, dateLabel, blockX, lineY - 34, SIG_COL_W, { size: 9, minSize: 9, color: INK });
      drawFitted(page, fonts.font, shortDate(assessmentDate) || '', blockX + dateLabelW, lineY - 34, SIG_COL_W - dateLabelW, { size: 9, minSize: 9, color: INK });
    };

    drawFitted(page, bold, 'Prepared by:', 72, blockTopY + 10, SIG_COL_W, { size: 9, minSize: 9, color: INK });
    drawFitted(page, bold, 'Noted by:', 320, blockTopY + 10, SIG_COL_W, { size: 9, minSize: 9, color: INK });

    await drawSignatory(prepared, preparedSig, 72, 'Psychometrician');
    await drawSignatory(noted, notedSig, 320, 'Psychologist');
  }
}

function reportContent(report) {
  const content = parseJson(report?.content, null);
  if (!content || typeof content !== 'object') return safe(report?.content);
  const root = content.report_draft || content.form || content.monthly || content.iep || content;
  const ignored = new Set([
    'schema_version', 'patient_id', 'patient_name', 'birthdate', 'evalDate', 'age', 'sex',
    'preparedById', 'preparedDate', 'prepared_signature_image', 'reviewerSignature',
    'reviewer_signature_image', 'signatures',
  ]);
  const lines = [];
  const visit = (value, label = '') => {
    if (value === null || value === undefined || value === '') return;
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      lines.push(label ? `${label}: ${value}` : String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, label ? `${label} ${index + 1}` : ''));
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => {
        if (!ignored.has(key)) visit(item, label ? `${label} / ${key}` : key);
      });
    }
  };
  visit(root);
  return lines.join('\n\n');
}

function whiteout(page, layout, x, y, width, height) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: WHITE,
    opacity: 1,
  });
}

async function drawReport(page, pdf, fonts, bundle, report, code, pageIndex, layout) {
  const { font, bold } = fonts;
  const d = normalizeBundle(bundle);
  const p = d.patient;
  if (code === 'CMPS:SE-FO-06') {
    const content = parseJson(report?.content, {});
    const draft = normalizeBehavioralReportDraft(
      content.report_draft || content.draft || content.form || content,
      content.schema_version,
    );
    const tableValues = draft.tableValues || {};
    const selectedTests = new Set(draft.administeredTests || []);
    const pageLayout = FO06_LAYOUT[`page${pageIndex + 1}`];
    if (!pageLayout) return;

    whiteout(page, layout, pageLayout.pageNumber.x - 3, pageLayout.pageNumber.y - 2, pageLayout.pageNumber.width + 8, 18);
    drawFitted(page, font, `Page ${pageIndex + 1} of 3`, pageLayout.pageNumber.x, pageLayout.pageNumber.y, pageLayout.pageNumber.width, {
      size: pageLayout.pageNumber.size,
      minSize: 5,
      color: PURPLE,
    });

    const drawCellValues = (values, cells, options = {}) => {
      (cells || []).forEach((cell, index) => {
        drawCharacterLimited(page, font, values?.[`${index}:0`], cell.x + 3, cell.y + 3, cell.width - 6, {
          size: options.size || 6.2,
          minSize: options.minSize || 4.5,
          maxCharacters: options.maxCharacters || 40,
          maxLines: 1,
          lineHeight: 7,
          color: options.color || PURPLE,
        });
      });
    };
    const drawDualCellValues = (values, firstCells, secondCells, options = {}) => {
      (firstCells || []).forEach((cell, index) => {
        drawCharacterLimited(page, font, values?.[`${index}:0`], cell.x + 3, cell.y + 3, cell.width - 6, {
          size: options.size || 6.1,
          minSize: options.minSize || 4.2,
          maxCharacters: Array.isArray(options.maxCharacters) ? options.maxCharacters[0] : options.maxCharacters || 40,
          maxLines: 1,
          lineHeight: 7,
          color: options.color || PURPLE,
        });
        const secondCell = secondCells?.[index];
        if (secondCell) {
          drawCharacterLimited(page, font, values?.[`${index}:1`], secondCell.x + 3, secondCell.y + 3, secondCell.width - 6, {
            size: options.size || 6.1,
            minSize: options.minSize || 4.2,
            maxCharacters: Array.isArray(options.maxCharacters) ? options.maxCharacters[1] : options.maxCharacters || 40,
            maxLines: 1,
            lineHeight: 7,
            color: options.color || PURPLE,
          });
        }
      });
    };
    const drawSummary = (value, box) => {
      drawCharacterLimited(page, font, value, box.x + 8, box.y + box.height - 12, box.width - 16, {
        size: 7.2,
        lineHeight: 9,
        maxLines: 4,
        maxCharacters: 140,
        color: INK,
      });
    };
    const drawNotIncluded = (tableLayouts) => {
      const layouts = Array.isArray(tableLayouts) ? tableLayouts : [tableLayouts];
      const summary = layouts.find((table) => table?.summary)?.summary;
      if (!summary) return;
      drawCenteredFitted(page, font, 'Not included', summary.x + summary.width / 2, summary.y + summary.height / 2 - 3, summary.width - 16, {
        size: 8,
        minSize: 5.5,
        color: PURPLE,
      });
    };
    const drawOptionalTable = (testId, tableLayouts, drawIncluded) => {
      if (selectedTests.has(testId)) drawIncluded();
      else drawNotIncluded(tableLayouts);
    };

    if (pageIndex === 0) {
      const personal = pageLayout.personal;
      const birthdate = first(draft.birthdate, content.birthdate, p.date_of_birth);
      const age = first(draft.age, content.age, p.age, ageFromDob(birthdate));
      const sex = first(draft.sex, content.sex, p.sex);
      drawFitted(page, bold, first(draft.patient_name, draft.patientName, content.patient_name, d.patientName), personal.fullName.x, personal.fullName.y, personal.fullName.width, { size: personal.fullName.size, minSize: 5.5, color: PURPLE });
      drawFitted(page, bold, dateText(birthdate) || birthdate, personal.birthdate.x, personal.birthdate.y, personal.birthdate.width, { size: personal.birthdate.size, minSize: 5.5, color: PURPLE });
      drawFitted(page, bold, [age, sex].filter(Boolean).join(' / '), personal.ageSex.x, personal.ageSex.y, personal.ageSex.width, { size: personal.ageSex.size, minSize: 5.5, color: PURPLE });
      drawFitted(page, bold, dateText(first(draft.evalDate, draft.evaluationDate, content.evalDate, report?.evaluation_date, report?.finalized_at, report?.updated_at)), personal.evaluationDate.x, personal.evaluationDate.y, personal.evaluationDate.width, { size: personal.evaluationDate.size, minSize: 5.5, color: PURPLE });

      const backgroundText = first(draft.background, content.background);
      if (backgroundText) {
        whiteout(page, layout, pageLayout.background.x, pageLayout.background.y, pageLayout.background.width, pageLayout.background.height);
        drawCharacterLimited(page, font, backgroundText, pageLayout.background.x, pageLayout.background.textY, pageLayout.background.width, {
          size: pageLayout.background.size,
          lineHeight: pageLayout.background.lineHeight,
          maxLines: pageLayout.background.maxLines,
          maxCharacters: 140,
          color: INK,
        });
      }
      const administeredTests = pageLayout.administeredTests;
      if (administeredTests) {
        const points = administeredTests.points || [];
        BEHAVIORAL_ADMINISTERED_TESTS.forEach((test, index) => {
          const point = points[index];
          if (!point) return;
          page.drawRectangle({
            x: point.x,
            y: point.y,
            width: administeredTests.boxSize,
            height: administeredTests.boxSize,
            color: WHITE,
            borderColor: INK,
            borderWidth: 0.7,
          });
          if (selectedTests.has(test.id)) {
            drawText(page, bold, 'X', point.x + 1, point.y + 0.8, {
              layout,
              size: 7,
              color: PURPLE,
            });
          }
        });
      }
      drawOptionalTable('caregiver_observation', pageLayout.tables.caregiver, () => {
        drawCellValues(tableValues.caregiver, pageLayout.tables.caregiver.valueCells);
        drawSummary(draft.observationsA, pageLayout.tables.caregiver.summary);
      });
      drawOptionalTable('mmse', pageLayout.tables.mmse, () => {
        drawCellValues(tableValues.mmse, pageLayout.tables.mmse.valueCells);
        drawSummary(draft.observationsB, pageLayout.tables.mmse.summary);
      });
    } else if (pageIndex === 1) {
      drawOptionalTable('adaptive_functioning', pageLayout.tables.adaptive, () => {
        drawCellValues(tableValues.adaptive, pageLayout.tables.adaptive.valueCells);
        drawSummary(draft.observationsC, pageLayout.tables.adaptive.summary);
      });
      drawOptionalTable('ctoni_2', [pageLayout.tables.ctoniSubtests, pageLayout.tables.ctoniComposite], () => {
        drawDualCellValues(
          tableValues.ctoniSubtests,
          pageLayout.tables.ctoniSubtests.valueCells,
          pageLayout.tables.ctoniSubtests.descriptiveCells,
          { maxCharacters: [18, 36] },
        );
        drawSummary(draft.ctoniSubtests, pageLayout.tables.ctoniSubtests.summary);
        drawCellValues(tableValues.ctoniComposite, pageLayout.tables.ctoniComposite.descriptiveCells, { maxCharacters: 36 });
        drawSummary(draft.ctoniComposite, pageLayout.tables.ctoniComposite.summary);
      });
    } else if (pageIndex === 2) {
      drawOptionalTable('gars_3', [pageLayout.tables.garsSubscales, pageLayout.tables.garsComposites], () => {
        drawCellValues(tableValues.garsSubscales, pageLayout.tables.garsSubscales.valueCells);
        drawSummary(draft.garsSubscales, pageLayout.tables.garsSubscales.summary);
        drawCellValues(tableValues.garsComposite, pageLayout.tables.garsComposites.valueCells);
        drawSummary(draft.garsComposites, pageLayout.tables.garsComposites.summary);
      });
      drawSummary(draft.diagnosis, pageLayout.diagnosis);
      drawSummary(draft.recommendations, pageLayout.recommendations);

      const prepared = report?.prepared_profile || report?.prepared_by || {};
      const noted = report?.noted_profile || report?.reviewer_profile || report?.noted_by || {};
      const preparedSignoff = pageLayout.signatories.prepared;
      const notedSignoff = pageLayout.signatories.noted;
      await drawFo06SignatoryBlock(page, pdf, { font, bold }, prepared, prepared.display_name, prepared.title || 'Psychometrician', prepared.license_no, preparedSignoff, report?.prepared_signature_image, layout);
      await drawFo06SignatoryBlock(page, pdf, { font, bold }, noted, noted.display_name, noted.title || 'Psychologist', noted.license_no, notedSignoff, report?.reviewer_signature_image || report?.noted_signature_image, layout);
    }
    return;
  }
  if (code === 'CMPS:SE-FO-08' || code === 'CMPS:SE-FO-09') {
    if (pageIndex === 0) {
      const content = parseJson(report?.content, {});
      const draft = content.form || content.monthly || content;
      const period = first(draft.period, report?.period, content.period);
      const domains = Array.isArray(draft.selectedDomains)
        ? draft.selectedDomains.map((domain) => `- ${domain}`).join('\n')
        : first(draft.domains, content.domains);
      const dataText = [first(draft.dataNarrative, content.dataNarrative), domains]
        .filter(Boolean)
        .join('\n');
      const domainText = draft.domainAssessments && typeof draft.domainAssessments === 'object'
        ? Object.entries(draft.domainAssessments)
          .filter(([, value]) => String(value || '').trim())
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n')
        : '';
      const assessmentText = [
        first(draft.generalOverview, draft.assessmentNarrative, draft.summary, content.assessment),
        domainText,
      ].filter(Boolean).join('\n');
      const studentName = first(draft.patientName, draft.patient_name, d.patientName);
      const age = first(draft.age, ageFromDob(p.date_of_birth), p.age);
      const sex = first(draft.sex, p.sex);
      const diagnosis = first(draft.diagnosis, d.clinical.primary_diagnosis, d.clinical.working_diagnosis);

      // Remove only the reference period and sample narrative blocks. Keep the
      // official background art and the field rules intact.
      whiteout(page, layout, 190, 663, 235, 19);
      whiteout(page, layout, 40, 495, 530, 100);
      whiteout(page, layout, 40, 125, 530, 350);
      drawCenteredFitted(page, font, period, 306, 670, 220, { layout, size: 8, color: PURPLE });
      drawFitted(page, font, studentName, 138, 645, 420, { layout, size: 8 });
      drawFitted(page, font, [age, sex].filter(Boolean).join(' / '), 138, 632, 420, { layout, size: 8 });
      drawCharacterLimited(page, font, diagnosis, 138, 619, 420, {
        layout,
        size: 8,
        lineHeight: 9,
        maxLines: 2,
        maxCharacters: 100,
        color: INK,
      });
      drawText(page, bold, 'DATA', 42, 580, { layout, size: 10, color: PURPLE });
      drawCharacterLimited(page, font, dataText, 42, 560, 520, { layout, size: 7.5, lineHeight: 9, maxLines: 7, maxCharacters: 140, color: INK });
      drawCharacterLimited(page, font, assessmentText, 42, 460, 520, { layout, size: 7.2, lineHeight: 8.5, maxLines: 31, maxCharacters: 140, color: INK });
    } else if (pageIndex === 1) {
      const content = parseJson(report?.content, {});
      const draft = content.form || content.monthly || content;
      const rows = Array.isArray(draft.planRows) ? draft.planRows : [];
      const columns = [
        { x: 43, width: 104 },
        { x: 150, width: 118 },
        { x: 270, width: 55 },
        { x: 327, width: 97 },
        { x: 426, width: 147 },
      ];
      const rowGeometry = [
        { top: 638, bottom: 589 },
        { top: 587, bottom: 535 },
        { top: 533, bottom: 469 },
        { top: 467, bottom: 375 },
        { top: 373, bottom: 295 },
      ];
      rowGeometry.forEach((row) => columns.forEach((column) => {
        whiteout(page, layout, column.x + 1, row.bottom + 1, column.width - 2, row.top - row.bottom + 4);
      }));
      const fields = ['objective', 'activities', 'timeFrame', 'responsible', 'outcome'];
      rows.slice(0, rowGeometry.length).forEach((row, rowIndex) => {
        const geometry = rowGeometry[rowIndex];
        fields.forEach((field, columnIndex) => {
          drawActivityPlanCell(page, font, row?.[field], columns[columnIndex], geometry, layout);
        });
      });

      const prepared = report?.prepared_profile || report?.prepared_by || {};
      const reviewed = report?.reviewed_profile || report?.reviewer_profile || {};
      const noted = report?.noted_profile || report?.noted_by || {};
      const signoffLayout = FO08_LAYOUT.page2.signoffs;
      const notedSignature = first(
        report?.noted_signature_image,
        report?.content && parseJson(report.content, {}).signatures?.notedSignature,
        // Existing monthly reports have one psychologist approval signature.
        // Use it for the Noted by slot when a distinct noted signature was not
        // stored, so the official form never leaves the sign-off slot blank.
        report?.reviewer_signature_image,
      );
      const signoffs = [
        { key: 'prepared', profile: prepared, signature: report?.prepared_signature_image },
        { key: 'reviewed', profile: reviewed, signature: report?.reviewer_signature_image },
        { key: 'noted', profile: noted, signature: notedSignature },
      ];
      for (const { key, profile, signature } of signoffs) {
        const position = signoffLayout[key];
        whiteout(page, layout, 38, position.nameY - 35, 295, 50);
        await drawSignature(page, pdf, signature, layout, position.x, position.y, position.width, position.height, { thicken: true });
        drawSignatoryLine(page, bold, profile, profile.display_name, profile.title, profile.license_no, position.x, position.nameY, position.width, { size: 6.7, color: INK });
      }
    }
  }
}

async function drawDailyActivity(page, pdf, fonts, report, layout) {
  const { font, bold } = fonts;
  const savedContent = parseJson(report?.content, {});
  const content = savedContent.form || savedContent.daily || savedContent.report_draft || savedContent;
  const values = {
    session: first(content.session_number, content.sessionNumber, report?.period),
    students: first(content.student_name, content.studentName, report?.patients && patientDisplay(report.patients)),
    title: first(content.activity_title, content.title, report?.title),
    domains: first(content.targeted_domains, content.domains),
    objectives: first(content.objectives, content.objective),
    procedure: first(content.activity_procedure, content.procedure, report?.content && typeof report.content === 'string' ? report.content : ''),
    date: first(content.activity_date, content.date, report?.finalized_at),
    observations: first(content.observations, content.responses, content.behavior),
  };

  // Form ID and Title
  drawText(page, bold, 'CMPS:SE-FO-08 rev.0 03032026', 420, 692, { size: 9, color: PURPLE });
  drawCenteredFitted(page, bold, 'DAILY ACTIVITY REPORT', 306, 680, 500, { layout, size: 14, color: PURPLE });
  drawCenteredFitted(page, font, '(Highly Confidential)', 306, 665, 500, { layout, size: 10, color: PURPLE });

  const fontSize = 9;

  // Targeted Domains wraps at a fixed size instead of shrinking: count how
  // many lines it needs, then push every row below it down so nothing overlaps.
  const countWrappedLines = (text, size, width, maxLines) => {
    const valueText = String(text || '').trim();
    if (!valueText) return 1;
    const lines = [];
    valueText.split(/\r?\n/).forEach((paragraph) => {
      const words = paragraph.trim() ? paragraph.trim().split(/\s+/) : [];
      if (!words.length) {
        lines.push('');
        return;
      }
      let current = '';
      words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) <= width || !current) current = next;
        else {
          lines.push(current);
          current = word;
        }
      });
      if (current) lines.push(current);
    });
    return Math.min(Math.max(lines.length, 1), maxLines);
  };
  const domainLines = countWrappedLines(values.domains, fontSize, 370, 3);
  const domainShift = (domainLines - 1) * 10;

  // Table grid for top section
  page.drawRectangle({ x: 40, y: 400 - domainShift, width: 520, height: 250 + domainShift, borderColor: INK, borderWidth: 1 });
  page.drawLine({ start: { x: 180, y: 400 - domainShift }, end: { x: 180, y: 650 }, color: INK, thickness: 1 });
  [635, 620, 605, 590 - domainShift, 510 - domainShift, 415 - domainShift].forEach(y => {
    page.drawLine({ start: { x: 40, y }, end: { x: 560, y }, color: INK, thickness: 1 });
  });

  const drawLabel = (label, y) => {
    drawText(page, bold, label, 45, y, { size: fontSize, color: PURPLE });
  };

  drawLabel('Session No.', 639);
  drawLabel('Name of Student', 624);
  drawLabel('Activity Title', 609);
  drawLabel('Targeted Domains/Skills', 594);
  drawLabel('Objectives', 578 - domainShift);
  drawLabel('Procedure', 498 - domainShift);
  drawLabel('Date', 404 - domainShift);

  drawFitted(page, font, values.session, 185, 639, 370, { layout, size: fontSize });
  drawFitted(page, font, values.students, 185, 624, 370, { layout, size: fontSize });
  drawFitted(page, font, values.title, 185, 609, 370, { layout, size: fontSize });
  drawWrapped(page, font, values.domains, 185, 594, 370, { layout, size: fontSize, lineHeight: 10, maxLines: 3, color: PURPLE });
  drawCharacterLimited(page, font, values.objectives, 185, 582 - domainShift, 370, { layout, size: fontSize, lineHeight: 10, maxLines: 7, maxCharacters: 180 });
  drawCharacterLimited(page, font, values.procedure, 185, 502 - domainShift, 370, { layout, size: fontSize, lineHeight: 10, maxLines: 9, maxCharacters: 250 });
  drawFitted(page, font, dateText(values.date), 185, 404 - domainShift, 370, { layout, size: fontSize });

  // Table for Responses
  page.drawRectangle({ x: 40, y: 275 - domainShift, width: 520, height: 125, borderColor: INK, borderWidth: 1 });
  page.drawLine({ start: { x: 40, y: 375 - domainShift }, end: { x: 560, y: 375 - domainShift }, color: INK, thickness: 1 });
  drawCenteredFitted(page, bold, 'Responses/Observed Behavior', 300, 380 - domainShift, 510, { layout, size: fontSize, color: PURPLE });
  drawCharacterLimited(page, font, values.observations, 45, 365 - domainShift, 510, { layout, size: fontSize, lineHeight: 10, maxLines: 9, maxCharacters: 300 });

  // Signatures
  const prepared = report?.prepared_profile || report?.prepared_by || {};
  const reviewer = report?.reviewer_profile || report?.reviewer || report?.noted_by || {};

  const drawSignatory = async (profile, label, labelY, imgBase64, textY) => {
    drawText(page, font, label, 42, labelY, { size: fontSize, color: INK });
    const name = nameWithHonorific(first(profileDisplayName(profile), profile.fallbackName), profile.title);
    const license = first(profile.license_no, profile.prc_no, profile.prc_number);

    drawText(page, bold, name, 42, textY - 5, { size: fontSize, color: PURPLE });
    if (license) {
      const labelStr = 'License Number:  ';
      drawText(page, bold, labelStr, 42, textY - 17, { size: fontSize, color: INK });
      const labelWidth = bold.widthOfTextAtSize(labelStr, fontSize);
      drawText(page, bold, String(license), 42 + labelWidth, textY - 17, { size: fontSize, color: PURPLE });
    }
    // Wet-signature look: draw the ink AFTER the printed name so it sits
    // directly on top of the name (not floating above it). Harder to
    // cut-and-paste forge, and reads as naturally signed.
    if (imgBase64) {
      await drawSignature(page, pdf, imgBase64, layout, 14, textY - 20, 220, 50, { thicken: true });
    }
  };

  await drawSignatory(
    { ...prepared, fallbackName: prepared.display_name, title: prepared.title || 'Psychometrician' },
    'Prepared by:',
    260 - domainShift,
    report?.prepared_signature_image,
    220 - domainShift
  );

  await drawSignatory(
    { ...reviewer, fallbackName: reviewer.display_name, title: reviewer.title || 'Psychologist' },
    'Noted by:',
    170 - domainShift,
    first(report?.reviewer_signature_image, report?.noted_signature_image),
    130 - domainShift
  );
}

const FO11_RUBRIC = [
  {
    title: 'Assistance',
    sub: 'Physical Support',
    min: 'Completes task independently; 1-2 instances of physical assistance.',
    mod: 'Requires 3-4 brief physical assists, such as HOHA positioning.',
    max: 'Requires 5+ physical assists or sustained hand-over-hand support.',
  },
  {
    title: 'Prompts',
    sub: 'Instructional Guidance',
    min: 'Follows task after 1-2 simple prompts.',
    mod: 'Requires 3-4 structured prompts or step reminders.',
    max: 'Requires 5+ prompts or full step-by-step prompting.',
  },
  {
    title: 'Cues',
    sub: 'Verbal/Visual Signals',
    min: 'Responds appropriately after 1-2 cues.',
    mod: 'Requires 3-4 cues to initiate or complete the task.',
    max: 'Requires 5+ cues or continuous cueing throughout the task.',
  },
  {
    title: 'Prodding',
    sub: 'Motivation/Redirection',
    min: 'Needs 1-2 redirections to stay engaged.',
    mod: 'Needs 3-4 redirections to sustain participation.',
    max: 'Needs 5+ redirections or continuous motivational support.',
  },
];

function attendanceMonthInfo(value) {
  const text = safe(value);
  const keyMatch = /^(\d{4})-(\d{1,2})/.exec(text);
  if (keyMatch) {
    const year = Number(keyMatch[1]);
    const month = Number(keyMatch[2]) - 1;
    return {
      year,
      month,
      label: new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }
  const parsed = text ? new Date(`1 ${text}`) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
}

function attendanceHours(rows = []) {
  return rows.reduce((total, row) => {
    if (!row || row.status !== 'Present' || !row.time_in || !row.time_out) return total;
    const [inHour, inMinute] = String(row.time_in).split(':').map(Number);
    const [outHour, outMinute] = String(row.time_out).split(':').map(Number);
    if ([inHour, inMinute, outHour, outMinute].some((value) => Number.isNaN(value))) return total;
    const minutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
    return minutes > 0 ? total + minutes / 60 : total;
  }, 0);
}
function drawFo11Frame(page, fonts, background, pageNumber, pageCount, title) {
  const { font, bold } = fonts;
  if (background) page.drawImage(background, { x: 0, y: 0, width: 612, height: 792 });

  // Center Attendance & Session Record title
  drawText(page, bold, 'Attendance & Session Record', 205, 686, { size: 14, color: PURPLE });
  const fo11Text = 'CMPS:SE-FO-11 rev.0 03092026';
  drawText(page, bold, fo11Text, 612 - 44 - bold.widthOfTextAtSize(fo11Text, 9), 705, { size: 9, color: PURPLE });
  drawText(page, font, title, 44, 669, { size: 8.5, color: INK });
  drawText(page, bold, `Page ${pageNumber} of ${pageCount}`, 520, 40, { size: 8, color: PURPLE });
}

function drawFo11SectionTitle(page, bold, label, title, y) {
  drawText(page, bold, title, 44, y, { size: 12, color: PURPLE });
}

function drawFo11TableCell(page, font, value, x, y, width, height, options = {}) {
  const size = options.size || 6.2;
  const maxLines = options.maxLines || 3;
  const lineHeight = options.lineHeight || size * 1.15;
  const valueText = safe(value);
  if (!valueText) return;

  const lines = wrapWordsToLines(font, valueText, size, width - 8);

  const drawLines = lines.slice(0, maxLines);
  const totalTextHeight = drawLines.length * lineHeight;
  const startY = y + height - (height - totalTextHeight) / 2 - size;

  drawLines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, size);
    page.drawText(line, {
      x: x + (width - lineWidth) / 2,
      y: startY - index * lineHeight,
      size,
      font,
      color: options.color || INK,
    });
  });
}

async function renderAttendancePdf({ bundle = {}, form: attendanceForm = {}, attendance = [], sessions = [], monthYear = '', hideSignatures, requestingUser, isCtc }) {
  if (hideSignatures) {
    bundle = stripSignatureImages(bundle);
    attendanceForm = stripSignatureImages(attendanceForm);
    sessions = stripSignatureImages(sessions);
  }
  const pdf = await PDFDocument.create();
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const fonts = { font, bold };
  let background = null;
  try {
    background = await pdf.embedPng(await fs.readFile(path.join(TEMPLATE_ROOT, 'Templates', 'CMPS Form Template.png')));
  } catch {
    background = null;
  }

  const patient = bundle.patient || {};
  const studentName = patientDisplay(patient) || 'Student';
  const monthInfo = attendanceMonthInfo(first(attendanceForm.month_year, monthYear));
  const program = first(attendanceForm.program_enrolled, patient.enrollment_type, 'Program not specified');
  const rows = Array.isArray(attendance) ? attendance : [];
  const sessionRows = Array.isArray(sessions) ? sessions : [];
  const sessionChunks = [];
  if (!sessionRows.length) sessionChunks.push([]);
  for (let index = 0; index < sessionRows.length; index += 8) sessionChunks.push(sessionRows.slice(index, index + 8));
  const pageCount = sessionChunks.length + 2;
  const addPage = (pageNumber, title) => {
    const page = pdf.addPage([612, 792]);
    drawFo11Frame(page, fonts, background, pageNumber, pageCount, title);
    return page;
  };

  const page1 = addPage(1, '');
  const attendanceByDate = Object.fromEntries(rows.map((row) => [safe(row.date).slice(0, 10), row]));
  const daysInMonth = new Date(monthInfo.year, monthInfo.month + 1, 0).getDate();
  const firstDayOffset = new Date(monthInfo.year, monthInfo.month, 1).getDay();
  drawFo11SectionTitle(page1, bold, '01', 'Student Information', 641);
  drawText(page1, font, 'Name of Student:', 44, 625, { size: 11, color: INK });
  drawText(page1, bold, studentName, 148, 625, { size: 11, color: PURPLE });

  drawText(page1, font, 'Program Enrolled:', 44, 605, { size: 11, color: INK });
  drawText(page1, bold, program, 148, 605, { size: 11, color: PURPLE });

  drawText(page1, font, 'Month / Year:', 44, 585, { size: 11, color: INK });
  drawText(page1, bold, monthInfo.label, 148, 585, { size: 11, color: PURPLE });

  drawFo11SectionTitle(page1, bold, '02', 'Attendance Record', 548);
  drawText(page1, bold, monthInfo.label, 470, 548, { size: 11, color: PURPLE });
  const calendarX = 44;
  const calendarWidth = 524;
  const calendarColumnWidth = calendarWidth / 7;
  const calendarTop = 526;
  const headerHeight = 22;
  const cellHeight = 38;
  const weekdayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  weekdayLabels.forEach((label, index) => {
    const x = calendarX + index * calendarColumnWidth;
    page1.drawRectangle({ x, y: calendarTop - headerHeight, width: calendarColumnWidth, height: headerHeight, color: rgb(0.91, 0.87, 0.96), borderColor: rgb(0.78, 0.70, 0.88), borderWidth: 0.5 });
    drawFo11TableCell(page1, bold, label, x, calendarTop - headerHeight, calendarColumnWidth, headerHeight, { size: 10, color: PURPLE });
  });
  const statusColors = {
    Present: rgb(0.86, 0.95, 0.88),
    Absent: rgb(0.98, 0.90, 0.90),
    Excused: rgb(0.99, 0.95, 0.86),
  };
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cellIndex = firstDayOffset + day - 1;
    const column = cellIndex % 7;
    const rowIndex = Math.floor(cellIndex / 7);
    const x = calendarX + column * calendarColumnWidth;
    const y = calendarTop - headerHeight - ((rowIndex + 1) * cellHeight);
    const isoDate = `${monthInfo.year}-${String(monthInfo.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const record = attendanceByDate[isoDate] || {};
    const status = safe(record.status);
    page1.drawRectangle({ x, y, width: calendarColumnWidth, height: cellHeight, color: statusColors[status] || WHITE, borderColor: rgb(0.78, 0.70, 0.88), borderWidth: 0.5 });

    const dayStr = String(day);
    const dayWidth = bold.widthOfTextAtSize(dayStr, 10);
    drawText(page1, bold, dayStr, x + (calendarColumnWidth - dayWidth) / 2, y + cellHeight - 12, { size: 10, color: status ? PURPLE : INK });

    if (status) {
      const statWidth = bold.widthOfTextAtSize(status, 10);
      drawText(page1, bold, status, x + (calendarColumnWidth - statWidth) / 2, y + 16, { size: 10, color: INK });
    }

    const time = [record.time_in, record.time_out].filter(Boolean).join(' - ');
    if (time) {
      const timeWidth = font.widthOfTextAtSize(time, 7.5);
      drawText(page1, font, time, x + (calendarColumnWidth - timeWidth) / 2, y + 5, { size: 7.5, color: INK });
    }
  }
  drawText(page1, bold, 'Monthly Summary', 44, 258, { size: 11, color: PURPLE });
  const summary = [
    ['Present', rows.filter((row) => row.status === 'Present').length],
    ['Absent', rows.filter((row) => row.status === 'Absent').length],
    ['Excused', rows.filter((row) => row.status === 'Excused').length],
    ['Total Hours', `${attendanceHours(rows).toFixed(1)} h`],
  ];
  summary.forEach(([label, value], index) => {
    const x = 44 + index * 132;
    page1.drawRectangle({ x, y: 205, width: 122, height: 36, color: rgb(0.96, 0.94, 0.98), borderColor: rgb(0.82, 0.76, 0.90), borderWidth: 0.6 });

    const valStr = String(value);
    const valWidth = bold.widthOfTextAtSize(valStr, 12);
    drawText(page1, bold, valStr, x + (122 - valWidth) / 2, 224, { size: 12, color: PURPLE });

    const labelWidth = font.widthOfTextAtSize(label, 11);
    drawText(page1, font, label, x + (122 - labelWidth) / 2, 209, { size: 11, color: INK });
  });

  let currentPageIndex = 2;
  let page = addPage(currentPageIndex, '');
  drawText(page, bold, studentName, 44, 641, { size: 11, color: PURPLE });
  drawText(page, font, `${monthInfo.label} - ${program}`, 44, 626, { size: 11, color: INK });
  const columns = [
    { label: '#', x: 44, width: 30 },
    { label: 'Date', x: 74, width: 70 },
    { label: 'Targeted Domain', x: 144, width: 140 },
    { label: 'Activity', x: 284, width: 160 },
    { label: 'Support Levels', x: 444, width: 124 },
  ];
  let cursorY = 608;
  const tableHeaderHeight = 38;
  const drawHeaders = () => {
    columns.forEach((column) => {
      page.drawRectangle({ x: column.x, y: cursorY - tableHeaderHeight, width: column.width, height: tableHeaderHeight, color: rgb(0.91, 0.87, 0.96), borderColor: rgb(0.78, 0.70, 0.88), borderWidth: 0.5 });
      drawFo11TableCell(page, bold, column.label, column.x, cursorY - tableHeaderHeight, column.width, tableHeaderHeight, { size: 11, maxLines: 2, color: PURPLE });
    });
    cursorY -= tableHeaderHeight;
  };
  drawHeaders();

  const displayRows = sessionRows.length ? sessionRows : [{ date: '', domain: '', activity: 'No session entries recorded.', notes: '' }];

  const getCellHeight = (text, width, size) => {
    const lines = wrapWordsToLines(font, text, size, width - 8);
    if (!lines.length) return 15;
    return Math.max(30, lines.length * (size * 1.15) + 16);
  };

  // Detailed Support Levels block, mirroring the web form: each selected
  // category shows its level plus the rubric description. The same line list
  // drives both measuring and drawing so the row height always fits.
  const SUPPORT_LEVEL_LABEL = { min: 'Min', mod: 'Mod', max: 'Max' };
  const SUPPORT_KEYS = ['assistance', 'prompts', 'cues', 'prodding'];
  const SUPPORT_TEXT_WIDTH = 124 - 5 * 2;
  const SUPPORT_LABEL_SIZE = 9;
  const SUPPORT_DESC_SIZE = 8;
  const SUPPORT_DESC_LH = 9.5;
  const SUPPORT_BLOCK_GAP = 4;
  const SUPPORT_PAD = 6;

  const buildSupportLines = (session) => {
    const lines = [];
    SUPPORT_KEYS.forEach((key, rubricIndex) => {
      if (!session[key]) return;
      const tier = String(session[key]).toLowerCase();
      const rubric = FO11_RUBRIC[rubricIndex];
      const levelLabel = SUPPORT_LEVEL_LABEL[tier];
      const desc = rubric?.[tier];
      if (!rubric || !levelLabel || !desc) {
        wrapWordsToLines(font, `${rubric?.title || key}: ${session[key]}`, SUPPORT_DESC_SIZE, SUPPORT_TEXT_WIDTH)
          .forEach((text) => lines.push({ text, useFont: font, size: SUPPORT_DESC_SIZE, lh: SUPPORT_DESC_LH }));
      } else {
        wrapWordsToLines(bold, `${rubric.title.toUpperCase()} - ${levelLabel}`, SUPPORT_LABEL_SIZE, SUPPORT_TEXT_WIDTH)
          .forEach((text) => lines.push({ text, useFont: bold, size: SUPPORT_LABEL_SIZE, lh: SUPPORT_LABEL_SIZE * 1.15, color: PURPLE }));
        wrapWordsToLines(font, desc, SUPPORT_DESC_SIZE, SUPPORT_TEXT_WIDTH)
          .forEach((text) => lines.push({ text, useFont: font, size: SUPPORT_DESC_SIZE, lh: SUPPORT_DESC_LH }));
      }
      lines.push({ spacer: SUPPORT_BLOCK_GAP });
    });
    if (lines.length && lines[lines.length - 1].spacer) lines.pop();
    return lines;
  };

  const getSupportHeight = (lines) => {
    if (!lines.length) return 15;
    return lines.reduce((sum, line) => sum + (line.spacer || line.lh), SUPPORT_PAD * 2);
  };

  const drawSupportBlock = (targetPage, lines, x, yBottom, rowHeight) => {
    let cursor = yBottom + rowHeight - SUPPORT_PAD;
    lines.forEach((line) => {
      if (line.spacer) {
        cursor -= line.spacer;
        return;
      }
      cursor -= line.size;
      targetPage.drawText(line.text, {
        x: x + 5,
        y: cursor,
        size: line.size,
        font: line.useFont,
        color: line.color || INK,
      });
      cursor -= (line.lh - line.size);
    });
  };

  displayRows.forEach((session, index) => {
    const supportLines = buildSupportLines(session);

    const hDomain = getCellHeight(session.domain, 140, 11);
    const hActivity = getCellHeight(session.activity, 160, 11);
    const hSupport = getSupportHeight(supportLines);
    const hMainRow = Math.max(hDomain, hActivity, hSupport, 40);

    // Notes uses size 11, and we draw it starting at x=85, so width = 524 - (85 - 44) = 483.
    // getCellHeight uses (width - 8) internally, so if we pass 491, it uses 483.
    const hNotes = session.notes ? getCellHeight(`Notes: ${session.notes}`, 491, 11) : 0;
    const sessionRowHeight = hMainRow + hNotes;

    if (cursorY - sessionRowHeight < 80) {
      currentPageIndex++;
      page = addPage(currentPageIndex, '');
      drawText(page, bold, studentName, 44, 641, { size: 11, color: PURPLE });
      drawText(page, font, `${monthInfo.label} - ${program}`, 44, 626, { size: 11, color: INK });
      cursorY = 608;
      drawHeaders();
    }

    const mainBottom = cursorY - hMainRow;
    columns.forEach((column) => page.drawRectangle({ x: column.x, y: mainBottom, width: column.width, height: hMainRow, borderColor: rgb(0.84, 0.80, 0.90), borderWidth: 0.5 }));

    drawFo11TableCell(page, font, sessionRows.length ? String(index + 1) : '', 44, mainBottom, 30, hMainRow, { size: 11, maxLines: 1 });
    drawFo11TableCell(page, font, shortDate(session.date), 74, mainBottom, 70, hMainRow, { size: 11, maxLines: 2 });
    drawFo11TableCell(page, font, session.domain, 144, mainBottom, 140, hMainRow, { size: 11, maxLines: 50 });
    drawFo11TableCell(page, font, session.activity, 284, mainBottom, 160, hMainRow, { size: 11, maxLines: 50 });
    drawSupportBlock(page, supportLines, 444, mainBottom, hMainRow);

    if (session.notes) {
      const notesBottom = cursorY - sessionRowHeight;
      page.drawRectangle({ x: 44, y: notesBottom, width: 524, height: hNotes, borderColor: rgb(0.84, 0.80, 0.90), borderWidth: 0.5, color: rgb(0.99, 0.985, 1) });
      drawWrapped(page, bold, 'Notes:', 50, notesBottom + hNotes - 16, 512, { size: 11, lineHeight: 12.65, color: PURPLE });
      drawWrapped(page, font, session.notes, 85, notesBottom + hNotes - 16, 483, { size: 11, lineHeight: 12.65, color: INK, align: 'justify' });
    }

    cursorY -= sessionRowHeight;
  });

  const guidePage = addPage(pageCount, '');
  drawFo11SectionTitle(guidePage, bold, '03', 'Support Level Guide', 641);
  const guideColumns = [
    { label: 'Category', x: 44, width: 106 },
    { label: 'Minimum Support', x: 150, width: 120 },
    { label: 'Moderate Support', x: 270, width: 120 },
    { label: 'Maximum Support', x: 390, width: 178 },
  ];
  const guideTop = 625;
  const guideHeaderHeight = 35;
  const guideRowHeight = 65;
  guideColumns.forEach((column) => {
    guidePage.drawRectangle({ x: column.x, y: guideTop - guideHeaderHeight, width: column.width, height: guideHeaderHeight, color: rgb(0.91, 0.87, 0.96), borderColor: rgb(0.78, 0.70, 0.88), borderWidth: 0.5 });
    drawFo11TableCell(guidePage, bold, column.label, column.x, guideTop - guideHeaderHeight, column.width, guideHeaderHeight, { size: 9, maxLines: 2, color: PURPLE });
  });
  FO11_RUBRIC.forEach((rubric, index) => {
    const bottom = guideTop - guideHeaderHeight - ((index + 1) * guideRowHeight);
    const cells = [
      `${rubric.title}\n${rubric.sub}`,
      rubric.min,
      rubric.mod,
      rubric.max,
    ];
    guideColumns.forEach((column, columnIndex) => {
      guidePage.drawRectangle({ x: column.x, y: bottom, width: column.width, height: guideRowHeight, color: columnIndex === 0 ? rgb(0.98, 0.97, 1) : WHITE, borderColor: rgb(0.84, 0.80, 0.90), borderWidth: 0.5 });
      drawFo11TableCell(guidePage, columnIndex === 0 ? bold : font, cells[columnIndex], column.x, bottom, column.width, guideRowHeight, { size: 9, maxLines: 6, color: columnIndex === 0 ? PURPLE : INK });
    });
  });

  const preparedByProfile = attendanceForm.prepared_profile || attendanceForm.prepared_by_profile || attendanceForm.prepared_by || {};
  const preparedByName = preparedByProfile.display_name || preparedByProfile.name || first(attendanceForm.facilitator_name, '');
  const preparedByProfession = preparedByProfile.title || preparedByProfile.profession || '';
  const preparedByLicense = preparedByProfile.license_no ? `PRC No. ${preparedByProfile.license_no}` : '';

  const drawSignatoryOverlay = async (page, name, profession, license, signImg, type, x, y, width, dateText) => {
    // Signatory line reads "Jinky C. Malabanan / 2026-09-26": short
    // middle-initial name with the signoff date beside it, per the paper form.
    const shortName = shortDisplayName(name);
    const parts = [nameWithHonorific(shortName, profession), profession, license].filter(Boolean);
    const topText = dateText ? `${parts.join(' - ')} / ${dateText}` : parts.join(' - ');
    const centerX = x + width / 2;

    // Draw Text over wave background FIRST, ink LAST.
    drawCenteredFitted(page, bold, topText, centerX, y + 4, width, { size: 12, minSize: 8, color: PURPLE });
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: 1.5, color: PURPLE });
    drawCenteredFitted(page, bold, `Signature over Printed Name of ${type}/Date`, centerX, y - 14, width, { size: 10, minSize: 6, color: PURPLE });

    // Draw Signature Image straddling the printed line — slightly bigger box
    // whose bottom dips below the line, with transparent ink overlapping the
    // name text like real pen. A floating cutout above the line screams
    // pasted; ink crossing the line reads as a natural signature and makes
    // forgery-by-overlay obvious.
    if (signImg) {
      await drawSignature(page, pdf, signImg, null, x + 5, y - 8, width - 10, 80, { thicken: true });
    }
  };

  // Ensure there's space for the sign-off, or create a new page if needed
  let signoffPage = guidePage;
  const signoffY = 95;

  if (attendanceForm.additional_notes) {
    drawText(signoffPage, bold, 'Additional Notes', 44, 230, { size: 12, color: PURPLE });
    drawWrapped(signoffPage, font, attendanceForm.additional_notes, 44, 215, 524, { size: 10, lineHeight: 12, maxLines: 6, color: INK });
  }

  // Prepared By (Facilitator) - Centered
  await drawSignatoryOverlay(signoffPage, preparedByName, preparedByProfession, preparedByLicense, attendanceForm.prepared_signature_image || attendanceForm.facilitator_signature, 'Facilitator', 156, signoffY, 300, first(attendanceForm.signoff_date, ''));

  // Preview watermark (who generated this copy) on every non-CTC render.
  await applyPreviewWatermark(pdf, requestingUser, isCtc);

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

let BEHAVIORAL_TEMPLATE_BYTES = null;
let BEHAVIORAL_TEMPLATE_DOC = null;

async function renderDynamicBehavioralPdf({ bundle, report, requestingUser, isCtc }) {
  if (!BEHAVIORAL_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templateImageBytes = await loadTemplateImageBytes('cmps-form-template.png');
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_WIDTH, LONG_BOND_HEIGHT]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_WIDTH, height: LONG_BOND_HEIGHT });
    BEHAVIORAL_TEMPLATE_BYTES = await tempPdf.save();
    BEHAVIORAL_TEMPLATE_DOC = await PDFDocument.load(BEHAVIORAL_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(BEHAVIORAL_TEMPLATE_BYTES);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  const pages = [];
  let currentPage = pdf.getPage(0);
  pages.push(currentPage);

  let cursorY = LONG_BOND_HEIGHT - 120; // 120 from top to clear letterhead
  const MARGIN_LEFT = 50;
  const MARGIN_RIGHT = 50;
  const CONTENT_WIDTH = LONG_BOND_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  const drawFormNumber = (p) => {
    const text = 'CMPS:SE-FO-06 rev.0 03032026';
    p.drawText(text, {
      x: LONG_BOND_WIDTH - 40 - bold.widthOfTextAtSize(text, 10),
      y: LONG_BOND_HEIGHT - 100,
      size: 10,
      font: bold,
      color: PURPLE
    });
  };

  const addPage = async () => {
    const [copiedPage] = await pdf.copyPages(BEHAVIORAL_TEMPLATE_DOC, [0]);
    pdf.addPage(copiedPage);
    currentPage = copiedPage;
    pages.push(currentPage);
    drawFormNumber(currentPage);
    cursorY = LONG_BOND_HEIGHT - 120;
  };

  drawFormNumber(currentPage);

  const d = normalizeBundle(bundle);
  const p = d.patient || {};
  const savedContent = parseJson(report?.content, {});
  const draft = normalizeBehavioralReportDraft(
    savedContent.report_draft || savedContent.draft || savedContent.form || savedContent,
    savedContent.schema_version,
  );

  const selectedTests = new Set(draft.administeredTests || []);

  const getLines = (text, width, isBold = false) => {
    if (!text) return [];
    const f = isBold ? bold : font;
    const fs = 9.5;
    const lines = [];
    const paragraphs = String(text).split('\n');
    for (const pr of paragraphs) {
      if (!pr.trim()) {
        lines.push({ text: '', isLast: true });
        continue;
      }
      const words = pr.split(/\s+/);
      let currentLine = '';
      for (let i = 0; i < words.length; i++) {
        let word = words[i];
        if (!word) continue;

        if (f.widthOfTextAtSize(word, fs) > width) {
          let broken = '';
          let rest = word;
          while (rest.length > 0) {
            let char = rest[0];
            if (f.widthOfTextAtSize(broken + char, fs) > width - 10) break;
            broken += char;
            rest = rest.slice(1);
          }
          if (broken.length > 0 && rest.length > 0) {
            words.splice(i + 1, 0, rest);
            word = broken;
          }
        }

        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (f.widthOfTextAtSize(testLine, fs) > width - 5 && currentLine) {
          lines.push({ text: currentLine, isLast: false });
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push({ text: currentLine, isLast: true });
    }
    return lines;
  };

  const drawTextFlow = async (text, indent = 0, isBold = false, extraSpace = 15, justify = false) => {
    const lines = getLines(text, CONTENT_WIDTH - indent, isBold);
    const textFont = isBold ? bold : font;
    for (const lineObj of lines) {
      const lineText = lineObj.text;
      if (cursorY < 80) await addPage();

      if (justify && !lineObj.isLast && lineText.includes(' ')) {
        const words = lineText.split(' ');
        const textWidth = textFont.widthOfTextAtSize(lineText.replace(/\s/g, ''), 9.5);
        const spaceToFill = CONTENT_WIDTH - indent - textWidth;
        const spaceWidth = spaceToFill / (words.length - 1);

        let currentX = MARGIN_LEFT + indent;
        for (const word of words) {
          currentPage.drawText(word, { x: currentX, y: cursorY, size: 9.5, font: textFont, color: INK });
          currentX += textFont.widthOfTextAtSize(word, 9.5) + spaceWidth;
        }
      } else {
        currentPage.drawText(lineText, { x: MARGIN_LEFT + indent, y: cursorY, size: 9.5, font: textFont, color: INK });
      }
      cursorY -= 12;
    }
    cursorY -= extraSpace;
  };

  const drawSectionHeader = async (text) => {
    if (cursorY < 120) await addPage();
    currentPage.drawText(text, { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: PURPLE });
    cursorY -= 20;
  };

  const drawTable = async (title, headers, rows, values, tableKey) => {
    if (cursorY < 150) await addPage();
    if (title) {
      currentPage.drawText(title, { x: MARGIN_LEFT, y: cursorY, size: 9.5, font: bold, color: INK });
      cursorY -= 15;
    }

    // Draw headers
    let currentX = MARGIN_LEFT;
    const cellWidth = CONTENT_WIDTH / headers.length;

    currentPage.drawLine({ start: { x: currentX, y: cursorY + 12 }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY + 12 }, thickness: 1, color: PURPLE });

    for (let i = 0; i < headers.length; i++) {
      currentPage.drawText(headers[i], { x: currentX + 5, y: cursorY, size: 9, font: bold, color: PURPLE });
      currentX += cellWidth;
    }
    cursorY -= 15;

    currentPage.drawLine({ start: { x: MARGIN_LEFT, y: cursorY + 12 }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY + 12 }, thickness: 1, color: PURPLE });

    for (let i = 0; i < rows.length; i++) {
      if (cursorY < 80) await addPage();
      currentX = MARGIN_LEFT;
      currentPage.drawText(rows[i], { x: currentX + 5, y: cursorY, size: 9, font: bold, color: INK });

      for (let j = 1; j < headers.length; j++) {
        currentX += cellWidth;
        const val = values?.[`${i}:${j - 1}`] || '';
        currentPage.drawText(val, { x: currentX + 5, y: cursorY, size: 9, font, color: INK });
      }
      cursorY -= 15;
    }

    currentPage.drawLine({ start: { x: MARGIN_LEFT, y: cursorY + 12 }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY + 12 }, thickness: 1, color: PURPLE });

    cursorY -= 15;
  };

  const drawDynamicTextBox = async (text, label) => {
    if (!text) return;
    if (cursorY < 100) await addPage();
    if (label) {
      currentPage.drawText(label, { x: MARGIN_LEFT, y: cursorY, size: 9.5, font: bold, color: INK });
      cursorY -= 15;
    }
    await drawTextFlow(text, 0, false, 15, true);
  };


  const titleStr = 'BEHAVIORAL ASSESSMENT REPORT';
  currentPage.drawText(titleStr, { x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(titleStr, 14)) / 2, y: cursorY, size: 14, font: bold, color: PURPLE });
  cursorY -= 15;
  const subtitleStr = 'SPECIAL EDUCATION PROGRAM';
  currentPage.drawText(subtitleStr, { x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(subtitleStr, 11)) / 2, y: cursorY, size: 11, font: bold, color: PURPLE });
  cursorY -= 40;

  await drawSectionHeader('I. PERSONAL INFORMATION');

  const birthdate = first(draft.birthdate, savedContent.birthdate, p.date_of_birth);
  const age = first(draft.age, savedContent.age, p.age, ageFromDob(birthdate));
  const rawSex = first(draft.sex, savedContent.sex, p.sex) || '';
  const sex = rawSex ? rawSex.charAt(0).toUpperCase() + rawSex.slice(1).toLowerCase() : '';
  const evalDate = first(draft.evalDate, savedContent.evalDate, report?.evaluation_date, report?.finalized_at, report?.updated_at);
  const patientName = first(draft.patient_name, savedContent.patient_name, d.patientName);

  const col1X = MARGIN_LEFT;
  const col2X = MARGIN_LEFT + 120;

  currentPage.drawText('Name:', { x: col1X, y: cursorY, size: 9.5, font: bold, color: INK });
  currentPage.drawText(patientName || '', { x: col2X, y: cursorY, size: 9.5, font: bold, color: PURPLE });
  cursorY -= 15;

  currentPage.drawText('Birthdate:', { x: col1X, y: cursorY, size: 9.5, font: bold, color: INK });
  currentPage.drawText(dateText(birthdate) || String(birthdate || ''), { x: col2X, y: cursorY, size: 9.5, font: bold, color: PURPLE });
  cursorY -= 15;

  currentPage.drawText('Age/Sex:', { x: col1X, y: cursorY, size: 9.5, font: bold, color: INK });
  currentPage.drawText([age, sex].filter(Boolean).join(' / '), { x: col2X, y: cursorY, size: 9.5, font: bold, color: PURPLE });
  cursorY -= 15;

  currentPage.drawText('Date of Evaluation:', { x: col1X, y: cursorY, size: 9.5, font: bold, color: INK });
  currentPage.drawText(dateText(evalDate) || String(evalDate || ''), { x: col2X, y: cursorY, size: 9.5, font: bold, color: PURPLE });
  cursorY -= 30;

  await drawSectionHeader('II. BACKGROUND INFORMATION');
  await drawTextFlow(first(draft.background, savedContent.background) || 'No background information provided.', 0, false, 15, true);

  await drawSectionHeader('III. BEHAVIORAL TESTS ADMINISTERED');
  const ADMINISTERED_TESTS = [
    { id: 'caregiver_observation', label: 'Caregiver Behavioral Observation Checklist' },
    { id: 'mmse', label: 'Mini-Mental Status Examination (MMSE)' },
    { id: 'adaptive_functioning', label: 'Child Adaptive Functioning Assessment Tool' },
    { id: 'ctoni_2', label: 'Comprehensive Test of Nonverbal Intelligence-2 (CTONI-2)' },
    { id: 'gars_3', label: "Gilliam's Autism Rating Scale-3 (GARS-3)" }
  ];
  for (const test of ADMINISTERED_TESTS) {
    if (selectedTests.has(test.id)) {
      await drawTextFlow(`• ${test.label}`, 15, false, 5);
    }
  }
  cursorY -= 15;

  const hasObservationTests = ['caregiver_observation', 'mmse', 'adaptive_functioning'].some(id => selectedTests.has(id));
  if (hasObservationTests) {
    await drawSectionHeader('IV. BEHAVIORAL OBSERVATIONS');
    const tableValues = draft.tableValues || {};

    if (selectedTests.has('caregiver_observation')) {
      await drawTable(
        'Caregiver Behavioral Observation Checklist',
        ['Domain', 'Verbal Interpretation'],
        ['Practical Domain', 'Social Domain', 'Conceptual Domain', 'Motor Skills', 'Total'],
        tableValues.caregiver,
        'caregiver'
      );
      if (draft.observationsA) await drawDynamicTextBox(draft.observationsA, 'Remarks / Summary:');
    }

    if (selectedTests.has('mmse')) {
      await drawDynamicTextBox(draft.observationsB, 'Mini-Mental Status Examination (MMSE) Remarks:');
    }

    if (selectedTests.has('adaptive_functioning')) {
      await drawDynamicTextBox(draft.observationsC, 'Child Adaptive Functioning Assessment Tool Remarks:');
    }
  }

  if (selectedTests.has('ctoni_2')) {
    const tableValues = draft.tableValues || {};
    await drawSectionHeader('Comprehensive Test of Nonverbal Intelligence-2 (CTONI-2)');
    await drawTable(
      'Subtests',
      ['Subtest', 'Age Equivalent', 'Descriptive Term'],
      ['Pictorial Analogies (PA)', 'Geometric Analogies (GA)', 'Pictorial Categories (PC)', 'Geometric Categories (GC)', 'Pictorial Sequences (PS)', 'Geometric Sequences (GS)'],
      tableValues.ctoniSubtests,
      'ctoniSubtests'
    );
    if (draft.ctoniSubtests) await drawTextFlow(draft.ctoniSubtests, 0, false, 15, true);

    await drawTable(
      'Composites',
      ['Composite', 'Descriptive Term'],
      ['Pictorial Scale', 'Geometric Scale'],
      tableValues.ctoniComposite,
      'ctoniComposite'
    );
    if (draft.ctoniComposite) await drawTextFlow(draft.ctoniComposite, 0, false, 15, true);
  }

  if (selectedTests.has('gars_3')) {
    const tableValues = draft.tableValues || {};
    await drawSectionHeader("Gilliam's Autism Rating Scale-3 (GARS-3)");
    await drawTable(
      'Subscales',
      ['Subscales', 'Verbal Interpretation'],
      ['Restricted/Repetitive Behaviors (RB)', 'Social Interaction (SI)', 'Social Communication (SC)', 'Emotional Responses (ER)', 'Cognitive Style (CS)', 'Maladaptive Speech (MS)'],
      tableValues.garsSubscales,
      'garsSubscales'
    );
    if (draft.garsSubscales) await drawTextFlow(draft.garsSubscales, 0, false, 15, true);

    await drawTable(
      'Composites',
      ['Composites', 'Severity Level'],
      ['4 scores', '6 scores'],
      tableValues.garsComposite,
      'garsComposite'
    );
    if (draft.garsComposite) await drawTextFlow(draft.garsComposite, 0, false, 15, true);
  }

  await drawSectionHeader('V. WORKING DIAGNOSIS');
  await drawTextFlow(first(draft.diagnosis, savedContent.diagnosis) || 'No working diagnosis provided.', 0, false, 15, true);

  await drawSectionHeader('VI. RECOMMENDATIONS');
  await drawTextFlow(first(draft.recommendations, savedContent.recommendations) || 'No recommendations provided.', 0, false, 15, true);

  cursorY -= 40;
  // The signatory block extends ~120pt below the labels; break early so it
  // stays inside the template's printed content box.
  if (cursorY < 175) await addPage();

  const preparedByProfile = report?.prepared_profile || report?.prepared_by || report?.prepared_by_profile || {};
  const preparedByName = preparedByProfile.display_name || preparedByProfile.name || '';
  const preparedByLicense = preparedByProfile.license_no || '';

  const reviewerProfile = report?.noted_profile || report?.reviewer_profile || report?.noted_by || {};
  const reviewerName = reviewerProfile.display_name || reviewerProfile.name || '';
  const reviewerLicense = reviewerProfile.license_no || '';
  const SIG_COL_W = (CONTENT_WIDTH - 20) / 2;
  const MAX_SIG_W = 190;
  const MAX_SIG_H = 68;
  const prepX = MARGIN_LEFT;
  const notX = MARGIN_LEFT + SIG_COL_W + 20;

  currentPage.drawText('Prepared by:', { x: prepX, y: cursorY, size: 10, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: notX, y: cursorY, size: 10, font: bold, color: INK });

  const sigDate = report?.evaluation_date || report?.created_at;

  const drawSignatory = async (name, license, imgBase64, blockX, title) => {
    const blockTopY = cursorY - 10;

    // Signature image — centered horizontally within the column
    if (imgBase64) {
      try {
        const isJpg = imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg');
        const imageBytes = Buffer.from(imgBase64.split(',')[1], 'base64');
        const sigImg = (await embedSignatureInk(pdf, imgBase64))
          || (isJpg ? await pdf.embedJpg(imageBytes) : await pdf.embedPng(imageBytes));
        const { width: iw, height: ih } = sigImg.scale(1);
        const scale = Math.min(MAX_SIG_W / iw, MAX_SIG_H / ih, 1);
        const sw = iw * scale;
        const sh = ih * scale;
        // Centre the image horizontally, bottom just below the name baseline
        // so the signature overlaps the printed name like a wet signature.
        currentPage.drawImage(sigImg, {
          x: blockX + (SIG_COL_W / 2) - (sw / 2),
          y: blockTopY - MAX_SIG_H - 22,
          width: sw,
          height: sh,
        });
      } catch (_) {}
    }

    // Overline just above the name
    const lineY = blockTopY - MAX_SIG_H - 4;
    currentPage.drawLine({
      start: { x: blockX, y: lineY },
      end: { x: blockX + SIG_COL_W, y: lineY },
      thickness: 0.75, color: PURPLE,
    });

    // Title label (normal) + Name (bold, purple)
    const titleLabel = `${title}: `;
    const titleLabelW = font.widthOfTextAtSize(titleLabel, 9.5);
    currentPage.drawText(titleLabel, { x: blockX, y: lineY - 12, size: 9.5, font: font, color: INK });
    currentPage.drawText(name || '', { x: blockX + titleLabelW, y: lineY - 12, size: 9.5, font: bold, color: PURPLE });

    // License
    if (license) {
      const licLabel = 'License Number: ';
      const licLabelW = font.widthOfTextAtSize(licLabel, 9.5);
      currentPage.drawText(licLabel, { x: blockX, y: lineY - 24, size: 9.5, font: font, color: INK });
      currentPage.drawText(String(license), { x: blockX + licLabelW, y: lineY - 24, size: 9.5, font: font, color: INK });
    }

    // Date
    const dateLabel = 'Date: ';
    const dateLabelW = font.widthOfTextAtSize(dateLabel, 9.5);
    currentPage.drawText(dateLabel, { x: blockX, y: lineY - 36, size: 9.5, font: font, color: INK });
    currentPage.drawText(sigDate ? new Date(sigDate).toLocaleDateString() : '', { x: blockX + dateLabelW, y: lineY - 36, size: 9.5, font: font, color: INK });
  };

  await drawSignatory(preparedByName, preparedByLicense, report?.prepared_signature_image, prepX, 'Psychometrician');
  await drawSignatory(reviewerName, reviewerLicense, report?.reviewer_signature_image, notX, 'Psychologist');

  for (let i = 0; i < pages.length; i++) {
    const pageObj = pages[i];
    const footerText = `Page ${i + 1} of ${pages.length}`;
    pageObj.drawText(footerText, {
      x: LONG_BOND_WIDTH - MARGIN_RIGHT - font.widthOfTextAtSize(footerText, 9.5),
      y: 40,
      size: 9.5,
      font: font,
      color: INK
    });
  }

  if (!isCtc && requestingUser) {
    for (const page of pages) {
      const { width, height } = page.getSize();
      const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
      const dateStr = `${new Date().toLocaleString()}`;
      const rowSpacingY = 220;
      const colSpacingX = 200;
      for (let row = -1; row < Math.ceil(height / rowSpacingY) + 2; row++) {
        for (let col = -1; col < Math.ceil(width / colSpacingX) + 2; col++) {
          const baseX = col * colSpacingX + (row % 2 === 0 ? 0 : colSpacingX / 2);
          const baseY = row * rowSpacingY;
          page.drawText('CONFIDENTIAL - DO NOT DISTRIBUTE', { x: baseX, y: baseY + 44, size: 13, font: bold, color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45) });
          page.drawText(userStr, { x: baseX, y: baseY + 22, size: 8, font, color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45) });
          page.drawText(dateStr, { x: baseX, y: baseY, size: 8, font, color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45) });
        }
      }
    }
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

let IEP_TEMPLATE_BYTES = null;
let IEP_TEMPLATE_DOC = null;

async function renderDynamicIepPdf({ bundle, report, requestingUser, isCtc }) {
  if (!IEP_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templateImageBytes = await loadTemplateImageBytes('cmps-form-template-landscape.png');
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_HEIGHT, LONG_BOND_WIDTH]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_HEIGHT, height: LONG_BOND_WIDTH });
    IEP_TEMPLATE_BYTES = await tempPdf.save();
    IEP_TEMPLATE_DOC = await PDFDocument.load(IEP_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(IEP_TEMPLATE_BYTES);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  const pages = [];
  let currentPage = pdf.getPage(0);
  pages.push(currentPage);

  let cursorY = LONG_BOND_WIDTH - 80;
  const MARGIN_LEFT = 40;
  const MARGIN_RIGHT = 40;
  const CONTENT_WIDTH = LONG_BOND_HEIGHT - MARGIN_LEFT - MARGIN_RIGHT;

  const drawFormNumber = (p) => {
    const text = 'CMPS:SE-FO-10 rev.0 03182026';
    p.drawText(text, {
      x: LONG_BOND_HEIGHT - 750 - bold.widthOfTextAtSize(text, 10),
      y: LONG_BOND_WIDTH - 75,
      size: 10,
      font: bold,
      color: PURPLE
    });
  };

  const addPage = async () => {
    const [copiedPage] = await pdf.copyPages(IEP_TEMPLATE_DOC, [0]);
    pdf.addPage(copiedPage);
    currentPage = copiedPage;
    pages.push(currentPage);
    drawFormNumber(currentPage);
    cursorY = LONG_BOND_WIDTH - 80;
  };

  drawFormNumber(currentPage);

  const d = normalizeBundle(bundle);
  const p = d.patient || {};
  const savedContent = parseJson(report?.content, {});
  const content = savedContent.form || savedContent.iep || savedContent;

  // Cycle length: explicit metadata wins, otherwise keep the legacy 4-week
  // shape unless stored weeks reach further. Mirrors lib/iep.js so the PDF
  // always covers exactly the weeks the form allows.
  const iepTotalWeeks = iepDurationWeeks(content);

  const titleStr = 'INDIVIDUALIZED EDUCATION PLAN';
  currentPage.drawText(titleStr, { x: (LONG_BOND_HEIGHT - bold.widthOfTextAtSize(titleStr, 14)) / 2, y: cursorY, size: 14, font: bold, color: PURPLE });
  cursorY -= 30;

  const rawStudentName = first(content.learnerName, d.patientName) || '';
  const studentName = (p.last_name || p.first_name)
    ? [p.last_name, [p.first_name, p.middle_name ? p.middle_name.charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
    : String(rawStudentName).toUpperCase();

  const dateStr = first(content.planStart, content.date, report?.updated_at, report?.created_at);
  const age = content.age || ageFromDob(p.date_of_birth) || p.age || '';
  const rawSex = content.sex || p.sex || '';
  const sex = rawSex ? rawSex.charAt(0).toUpperCase() + rawSex.slice(1).toLowerCase() : '';
  const dob = dateText(p.date_of_birth) || '';
  const diagnosis = d.clinical?.primary_diagnosis || content.diagnosis || '';

  const getLines = (text, width, isBold = false, customSize = 9.5) => {
    if (!text) return [];
    const f = isBold ? bold : font;
    const fs = customSize;
    const lines = [];
    const paragraphs = String(text).split('\n');
    for (const p of paragraphs) {
      const words = p.split(/\s+/);
      let currentLine = '';
      for (let i = 0; i < words.length; i++) {
        let word = words[i];
        if (!word) continue;

        let wordWidth = f.widthOfTextAtSize(word, fs);
        if (wordWidth > width) {
          let broken = '';
          let rest = word;
          while (rest.length > 0) {
            let char = rest[0];
            if (f.widthOfTextAtSize(broken + char, fs) > width - 10) break;
            broken += char;
            rest = rest.slice(1);
          }
          if (broken.length > 0 && rest.length > 0) {
            words.splice(i + 1, 0, rest);
            word = broken;
          }
        }

        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (f.widthOfTextAtSize(testLine, fs) > width - 10 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
    return lines;
  };

  const rightX = MARGIN_LEFT + CONTENT_WIDTH - 200;

  currentPage.drawText('Name of Student:', { x: MARGIN_LEFT, y: cursorY, size: 10, font: font, color: INK });
  currentPage.drawText(studentName, { x: MARGIN_LEFT + 95, y: cursorY, size: 10, font: bold, color: PURPLE });
  currentPage.drawText('Date:', { x: rightX, y: cursorY, size: 10, font: font, color: INK });
  currentPage.drawText(dateText(dateStr) || String(dateStr || ''), { x: rightX + 35, y: cursorY, size: 10, font: bold, color: PURPLE });
  cursorY -= 15;
  currentPage.drawText('Age / Sex:', { x: MARGIN_LEFT, y: cursorY, size: 10, font: font, color: INK });
  currentPage.drawText([age, sex].filter(Boolean).join(' / '), { x: MARGIN_LEFT + 65, y: cursorY, size: 10, font: bold, color: PURPLE });
  
  currentPage.drawText('Diagnosis:', { x: rightX, y: cursorY, size: 10, font: font, color: INK });
  const diagLines = getLines(diagnosis, 135, true, 10);
  let maxDiagLines = 1;
  for (let i = 0; i < diagLines.length; i++) {
    currentPage.drawText(diagLines[i], { x: rightX + 60, y: cursorY - (i * 15), size: 10, font: bold, color: PURPLE });
    maxDiagLines = Math.max(maxDiagLines, i + 1);
  }

  cursorY -= (maxDiagLines * 15);
  // Date of Birth stays anchored to the left column, independent of how many
  // lines the right-column Diagnosis wraps into.
  const dobY = cursorY + maxDiagLines * 15 - 15;
  currentPage.drawText('Date of Birth:', { x: MARGIN_LEFT, y: dobY, size: 10, font: font, color: INK });
  currentPage.drawText(dob, { x: MARGIN_LEFT + 75, y: dobY, size: 10, font: bold, color: PURPLE });

  cursorY -= 30;

  const cw = [
    CONTENT_WIDTH * 0.065, // Week: 56
    CONTENT_WIDTH * 0.16, // Level: 137
    CONTENT_WIDTH * 0.14, // Domains: 120
    CONTENT_WIDTH * 0.18, // Activity: 154
    CONTENT_WIDTH * 0.265, // Objectives: 227
    CONTENT_WIDTH * 0.19  // Materials: 163
  ];
  const colXs = [MARGIN_LEFT, MARGIN_LEFT + cw[0], MARGIN_LEFT + cw[0] + cw[1], MARGIN_LEFT + cw[0] + cw[1] + cw[2], MARGIN_LEFT + cw[0] + cw[1] + cw[2] + cw[3], MARGIN_LEFT + cw[0] + cw[1] + cw[2] + cw[3] + cw[4], MARGIN_LEFT + CONTENT_WIDTH];

  // Which week table is currently being drawn (null outside week tables).
  // Lets drawRow re-print the week context when a week splits across pages,
  // so a continuation page never shows orphan rows under a bare header.
  let currentWeekNumber = null;
  const drawWeekContinuedBanner = async (weekNumber) => {
    const fs = 10;
    const rowH = 22;
    const rowY = cursorY;
    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: rowY - rowH, width: CONTENT_WIDTH, height: rowH,
      color: PURPLE, borderColor: PURPLE, borderWidth: 1,
    });
    const label = `WEEK ${weekNumber} — CONTINUED`;
    const w = bold.widthOfTextAtSize(label, fs);
    currentPage.drawText(label, {
      x: MARGIN_LEFT + (CONTENT_WIDTH - w) / 2, y: rowY - 7 - fs,
      size: fs, font: bold, color: rgb(1, 1, 1),
    });
    cursorY -= rowH;
  };

  const drawRow = async (cellTexts, isHeader = false) => {
    const fs = 9.5;

    const cellLines = cellTexts.map((text, i) => {
      if (i > 5) return [];
      return getLines(text, cw[i] - 10, isHeader || (i === 2)); // col 2 is domains (bold)
    });

    let maxLines = Math.max(...cellLines.map(l => l.length));
    if (maxLines === 0) maxLines = 1;
    let rowH = maxLines * (fs + 4) + 12;
    if (rowH < 25) rowH = 25;

    if (isHeader) rowH = 30;

    if (cursorY - rowH < 60) {
      await addPage();
      // Mid-week page break: re-print the week banner (marked continued)
      // above the repeated column header so the new page keeps its context.
      if (currentWeekNumber != null) {
        await drawWeekContinuedBanner(currentWeekNumber);
      }
      await drawRow(['Week', 'Level of Needs', 'Targeted Domains', 'Name of Activity', 'Objectives', 'Instructional Materials\nNeeded'], true);
    }

    const rowY = cursorY;

    // Left and right outer borders
    currentPage.drawLine({ start: { x: MARGIN_LEFT, y: rowY }, end: { x: MARGIN_LEFT, y: rowY - rowH }, color: INK, thickness: 1.5 });
    currentPage.drawLine({ start: { x: MARGIN_LEFT + CONTENT_WIDTH, y: rowY }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: rowY - rowH }, color: INK, thickness: 1.5 });

    // Top border — always draw for every row (header and data)
    currentPage.drawLine({ start: { x: MARGIN_LEFT, y: rowY }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: rowY }, color: INK, thickness: 1.5 });

    // Bottom border
    currentPage.drawLine({ start: { x: MARGIN_LEFT, y: rowY - rowH }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: rowY - rowH }, color: INK, thickness: 1.5 });

    // Vertical dividers
    for (let i = 1; i < colXs.length - 1; i++) {
      currentPage.drawLine({ start: { x: colXs[i], y: rowY }, end: { x: colXs[i], y: rowY - rowH }, color: INK, thickness: 1.5 });
    }

    // Draw text
    cellLines.forEach((lines, i) => {
      if (i > 5) return;
      let textY = rowY - 8 - fs;
      if (isHeader) textY = rowY - 6 - fs;

      lines.forEach((line, lineIdx) => {
        let cx = colXs[i] + 5;
        if (isHeader || i === 0) {
          const w = (isHeader ? bold : font).widthOfTextAtSize(line, fs);
          cx = colXs[i] + (cw[i] - w) / 2;
        }
        let cF = isHeader ? bold : font;
        if (i === 2 && !isHeader) cF = bold;

        if (i === 3 && !isHeader && lineIdx === 0 && (line.includes('Fine Motor') || line.includes('Gross Motor'))) {
          cF = bold;
        }

        let cColor = isHeader ? PURPLE : INK;
        currentPage.drawText(line, { x: cx, y: textY, size: fs, font: cF, color: cColor });
        textY -= (fs + 4);
      });
    });

    cursorY -= rowH;
  };

  await drawRow(['Week', 'Level of Needs', 'Targeted Domains', 'Name of Activity', 'Objectives', 'Instructional Materials\nNeeded'], true);

  // Full-width purple band so each week's coverage is unmistakable no matter
  // how many border lines the rows below it draw.
  const drawWeekBanner = async (weekNumber, labelText = null) => {
    const fs = 11;
    const rowH = 26;
    if (cursorY - rowH < 60) await addPage();
    const rowY = cursorY;
    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: rowY - rowH, width: CONTENT_WIDTH, height: rowH,
      color: PURPLE, borderColor: PURPLE, borderWidth: 1,
    });
    const label = labelText || `WEEK ${weekNumber}`;
    const w = bold.widthOfTextAtSize(label, fs);
    currentPage.drawText(label, {
      x: MARGIN_LEFT + (CONTENT_WIDTH - w) / 2, y: rowY - 9 - fs,
      size: fs, font: bold, color: rgb(1, 1, 1),
    });
    cursorY -= rowH;
  };

  const drawWeekTable = async (weekNumber, weekData) => {
    const level = weekData?.level || '';
    const weekLabel = String(weekNumber);
    // Keep-with-next: never strand the WEEK banner alone at the bottom of a
    // page. Reserve banner + column header + a minimum first data row; if
    // they don't fit, start the whole week on a fresh page instead.
    const KEEP_H = 26 + 30 + 60;
    if (cursorY - KEEP_H < 60) await addPage();
    currentWeekNumber = weekNumber;
    await drawWeekBanner(weekNumber);
    // Every level shows every targeted-domain group — practical, social,
    // conceptual, plus bodily kinesthetics (fine + gross motor) — so entered
    // data is never hidden (e.g. an HSN week previously showed only the
    // kinesthetics row). The week number and level sit on the first row.
    const levelLabels = {
      LSN: 'a. Low Support Needs\nProgram (LSN)',
      MSN: 'b. Moderate Support\nNeeds Program (MSN)',
      HSN: 'c. High Support Needs\nProgram (HSN)',
    };
    const levelLabel = levelLabels[level] || '';
    const prac = weekData['practical'] || {};
    const soc = weekData['social'] || {};
    const conc = weekData['conceptual'] || {};
    const fine = weekData['kinFine'] || {};
    const gross = weekData['kinGross'] || {};
    const rows = [
      ['Practical Domain', prac.activity || '', prac.objectives || '', prac.materials || ''],
      ['Social Domain', soc.activity || '', soc.objectives || '', soc.materials || ''],
      ['Conceptual Domain', conc.activity || '', conc.objectives || '', conc.materials || ''],
      ['Bodily Kinesthetics', `Fine Motor Skills:\n${fine.activity || ''}`, fine.objectives || '', fine.materials || ''],
      ['Bodily Kinesthetics', `Gross Motor Skills:\n${gross.activity || ''}`, gross.objectives || '', gross.materials || ''],
    ];
    for (let i = 0; i < rows.length; i += 1) {
      const [domain, activity, objectives, materials] = rows[i];
      const firstRow = i === 0;
      await drawRow(
        [firstRow ? weekLabel : '', firstRow ? levelLabel : '', domain, activity, objectives, materials],
        false,
      );
    }
    // Week finished: later page breaks (e.g. signatures) must not print a
    // continued banner.
    currentWeekNumber = null;
  };

  for (let w = 1; w <= iepTotalWeeks; w++) {
    const weekData = content.weeks?.[w] || content.weeks?.[String(w)] || {};
    // No-session weeks print as a single band + reason row instead of the
    // domain table. Untouched weeks are still skipped so a Week 1-only IEP
    // doesn't print blank tables.
    if (weekData?.noSession) {
      const KEEP_H = 26 + 30 + 60;
      if (cursorY - KEEP_H < 60) await addPage();
      currentWeekNumber = w;
      await drawWeekBanner(w, `WEEK ${w} - NO SESSION`);
      const reason = String(weekData?.noSessionReason || 'No reason recorded.');
      await drawRow([String(w), '', 'No session', reason, '', ''], false);
      currentWeekNumber = null;
      continue;
    }
    if (!weekData?.level) continue;
    await drawWeekTable(w, weekData);
  }

  if (cursorY < 200) await addPage();
  cursorY -= 20;

  const prepared = report?.prepared_profile || report?.prepared_by || {};
  const noted = report?.noted_profile || report?.reviewer_profile || report?.noted_by || {};
  const savedSignatures = savedContent.signatures || {};
  const preparedSignature = first(report?.prepared_signature_image, savedContent.preparedSignature, savedSignatures.preparedSignature, savedSignatures.prepared);
  const notedSignature = first(report?.reviewer_signature_image, savedContent.reviewerSignature, savedSignatures.notedSignature, savedSignatures.noted);

  const SIG_COL_W = 320;
  const tableX = MARGIN_LEFT;
  const tableW = CONTENT_WIDTH;
  const colW = tableW / 2;
  const prepX = tableX + 40;
  const notX = tableX + colW + 40;

  const sigLabelY = cursorY - 40;
  const sigLineY = sigLabelY - 60;
  const sigNameY = sigLineY - 20;
  const sigLicenseY = sigNameY - 14;
  const sigDateY = sigLicenseY - 14;
  const sigOverlapY = sigLineY - 10;

  currentPage.drawText('Prepared by:', { x: prepX, y: sigLabelY, size: 10, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: notX, y: sigLabelY, size: 10, font: bold, color: INK });

  const toDateStr = (d) => {
    try { return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); } 
    catch (e) { return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  };
  const pDate = report?.prepared_at || report?.created_at || new Date();
  const nDate = report?.reviewer_date || report?.reviewed_at || report?.noted_at || new Date();

  const drawSigBox = (profile, fallbackTitle, dateVal, blockX, fallbackName) => {
    const nameWithHonors = nameWithHonorific(first(profileDisplayName(profile), fallbackName, ''), fallbackTitle);
    const cleanTitle = fallbackTitle;
    const license = first(profile.license_no, profile.prc_no, profile.prc_number);
    const dateStr = toDateStr(dateVal);

    currentPage.drawLine({ start: { x: blockX, y: sigLineY }, end: { x: blockX + SIG_COL_W, y: sigLineY }, color: PURPLE, thickness: 1 });

    const titlePrefix = `${cleanTitle}: `;
    const titleWidth = font.widthOfTextAtSize(titlePrefix, 10);
    
    currentPage.drawText(titlePrefix, { x: blockX, y: sigNameY, size: 10, font: font, color: INK });
    currentPage.drawText(nameWithHonors, { x: blockX + titleWidth, y: sigNameY, size: 10, font: bold, color: PURPLE });

    if (license) {
      currentPage.drawText(`License Number: ${license}`, { x: blockX, y: sigLicenseY, size: 10, font: font, color: INK });
    }
    currentPage.drawText(`Date: ${dateStr}`, { x: blockX, y: sigDateY, size: 10, font: font, color: INK });
  };

  drawSigBox(prepared, 'Psychometrician', pDate, prepX, content.techName);
  drawSigBox(noted, 'Psychologist', nDate, notX, content.reviewerName);

  // Ink goes on LAST so it sits on top of the signature rule (like signing
  // over the line) instead of being sliced by it.
  if (preparedSignature) await drawSignature(currentPage, pdf, preparedSignature, null, prepX, sigOverlapY, SIG_COL_W, 60, { thicken: true });
  if (notedSignature) await drawSignature(currentPage, pdf, notedSignature, null, notX, sigOverlapY, SIG_COL_W, 60, { thicken: true });

  if (!isCtc && requestingUser) {
    const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
    const dateStr = `${new Date().toLocaleString()}`;
    const rowSpacingY = 220;
    const colSpacingX = 200;
    for (const pg of pages) {
      for (let row = -1; row < Math.ceil(LONG_BOND_WIDTH / rowSpacingY) + 2; row++) {
        for (let col = -1; col < Math.ceil(LONG_BOND_HEIGHT / colSpacingX) + 2; col++) {
          const baseX = col * colSpacingX + (row % 2 === 0 ? 0 : colSpacingX / 2);
          const baseY = row * rowSpacingY;
          pg.drawText('CONFIDENTIAL - DO NOT DISTRIBUTE', { x: baseX, y: baseY + 44, size: 13, font: bold, color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45) });
          pg.drawText(userStr, { x: baseX, y: baseY + 22, size: 8, font, color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45) });
          pg.drawText(dateStr, { x: baseX, y: baseY, size: 8, font, color: rgb(0.60, 0.60, 0.60), opacity: 0.25, rotate: degrees(45) });
        }
      }
    }
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

let FO08_TEMPLATE_BYTES = null;
let FO08_TEMPLATE_DOC = null;

async function renderDynamicMonthlyAssessmentReport({ bundle, report, requestingUser, isCtc }) {
  if (!FO08_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templateImageBytes = await loadTemplateImageBytes('cmps-form-template.png');
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_WIDTH, LONG_BOND_HEIGHT]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_WIDTH, height: LONG_BOND_HEIGHT });
    FO08_TEMPLATE_BYTES = await tempPdf.save();
    FO08_TEMPLATE_DOC = await PDFDocument.load(FO08_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(FO08_TEMPLATE_BYTES);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  let pages = [pdf.getPage(0)];
  let currentPage = pages[0];
  let cursorY = LONG_BOND_HEIGHT - 120;

  const drawFormNumber = (p) => {
    const text = 'CMPS:SE-FO-09 rev.0 03172026';
    p.drawText(text, {
      x: LONG_BOND_WIDTH - 40 - bold.widthOfTextAtSize(text, 10),
      y: LONG_BOND_HEIGHT - 100,
      size: 10,
      font: bold,
      color: PURPLE
    });
  };

  // Draw form number on the first page
  drawFormNumber(currentPage);

  const addPage = async () => {
    const [copiedPage] = await pdf.copyPages(FO08_TEMPLATE_DOC, [0]);
    pdf.addPage(copiedPage);
    currentPage = copiedPage;
    pages.push(currentPage);
    drawFormNumber(currentPage);
    cursorY = LONG_BOND_HEIGHT - 120;
  };

  const d = normalizeBundle(bundle);
  const p = d.patient || {};
  const content = parseJson(report?.content, {});
  const draft = content.form || content.monthly || content;
  // The plan-context line below needs the cycle length. It was copied from
  // the IEP renderer without its iepTotalWeeks definition, which crashed
  // every monthly preview with "iepTotalWeeks is not defined".
  // Prefer the unwrapped draft (content is sometimes { form: {...} }).
  const iepTotalWeeks = iepDurationWeeks(draft?.cycle || draft?.weeks ? draft : content);

  const period = first(draft.period, report?.period, content.period) || '';
  const rawStudentName = first(draft.patientName, draft.patient_name, d.patientName) || '';
  const studentName = p.last_name || p.first_name
    ? [p.last_name, [p.first_name, p.middle_name ? p.middle_name.charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
    : String(rawStudentName).toUpperCase();

  const age = first(draft.age, ageFromDob(p.date_of_birth), p.age) || '';
  const rawSex = first(draft.sex, p.sex) || '';
  const sex = rawSex ? rawSex.charAt(0).toUpperCase() + rawSex.slice(1).toLowerCase() : '';
  const diagnosis = first(draft.diagnosis, d.clinical?.primary_diagnosis, d.clinical?.working_diagnosis) || '';

  const domains = Array.isArray(draft.selectedDomains)
    ? draft.selectedDomains.map((domain) => `- ${domain}`).join('\n')
    : first(draft.domains, content.domains) || '';
  const dataText = [first(draft.dataNarrative, content.dataNarrative), domains].filter(Boolean).join('\n\n');

  const domainText = draft.domainAssessments && typeof draft.domainAssessments === 'object'
    ? Object.entries(draft.domainAssessments).filter(([, val]) => String(val || '').trim()).map(([k, v]) => `${k}: ${v}`).join('\n\n')
    : '';
  const assessmentText = [first(draft.generalOverview, draft.assessmentNarrative, draft.summary, content.assessment), domainText].filter(Boolean).join('\n\n');

  const BOLD_TARGETS = [
    'Conceptual Domain:',
    'Social Domain:',
    'Bodily Kinesthetics Domain:',
    'Practical Domain:'
  ];

  const drawParagraphs = async (text, startX, width, fontSize, isBold = false, justify = false, textColor = INK) => {
    const f = isBold ? bold : font;
    let cleanText = String(text).replace(/([^\n])\n(?!\n)(?!\- )(?!\u2022 )(?!(?:Conceptual|Social|Bodily|Practical) Domain:)([^\n])/g, '$1 $2');

    const lines = cleanText.split('\n');
    for (const paragraph of lines) {
      if (!paragraph.trim()) {
        cursorY -= (fontSize * 0.5);
        continue;
      }
      if (cursorY < 80) await addPage();

      let words = paragraph.split(/\s+/);
      let currentLineWords = [];
      let currentLineWidth = 0;

      for (let w = 0; w < words.length; w++) {
        let word = words[w];
        if (!word) continue;

        let wordF = f;
        let isSpecialBold = false;

        // Check for 3-word targets
        if (w < words.length - 2) {
          const threeWords = words[w] + ' ' + words[w + 1] + ' ' + words[w + 2];
          if (BOLD_TARGETS.includes(threeWords)) {
            word = threeWords;
            w += 2;
            wordF = bold;
            isSpecialBold = true;
          }
        }

        // Check for 2-word targets if not matched
        if (!isSpecialBold && w < words.length - 1) {
          const twoWords = words[w] + ' ' + words[w + 1];
          if (BOLD_TARGETS.includes(twoWords)) {
            word = twoWords;
            w++;
            wordF = bold;
            isSpecialBold = true;
          }
        }

        const spaceWidth = currentLineWords.length > 0 ? font.widthOfTextAtSize(' ', fontSize) : 0;
        let wordWidth = wordF.widthOfTextAtSize(word, fontSize);

        if (wordWidth > width) {
          let broken = '';
          let rest = word;
          while (rest.length > 0) {
            let char = rest[0];
            if (wordF.widthOfTextAtSize(broken + char, fontSize) > width) break;
            broken += char;
            rest = rest.slice(1);
          }
          if (broken.length > 0 && rest.length > 0) {
            words.splice(w + 1, 0, rest);
            word = broken;
            wordWidth = wordF.widthOfTextAtSize(word, fontSize);
          }
        }

        if (currentLineWords.length > 0 && currentLineWidth + spaceWidth + wordWidth > width) {
          if (justify && currentLineWords.length > 1) {
            const extraSpace = width - currentLineWidth;
            const spaceAdd = extraSpace / (currentLineWords.length - 1);
            let cx = startX;
            for (let i = 0; i < currentLineWords.length; i++) {
              const item = currentLineWords[i];
              const drawF = item.isSpecialBold ? bold : f;
              currentPage.drawText(item.text, { x: cx, y: cursorY, size: fontSize, font: drawF, color: textColor });
              cx += drawF.widthOfTextAtSize(item.text, fontSize) + spaceWidth + spaceAdd;
            }
          } else {
            let cx = startX;
            for (let i = 0; i < currentLineWords.length; i++) {
              const item = currentLineWords[i];
              const drawF = item.isSpecialBold ? bold : f;
              currentPage.drawText(item.text, { x: cx, y: cursorY, size: fontSize, font: drawF, color: textColor });
              cx += drawF.widthOfTextAtSize(item.text, fontSize) + spaceWidth;
            }
          }
          cursorY -= (fontSize * 1.5);
          currentLineWords = [{ text: word, isSpecialBold }];
          currentLineWidth = wordWidth;
          if (cursorY < 80) await addPage();
        } else {
          currentLineWords.push({ text: word, isSpecialBold });
          currentLineWidth += spaceWidth + wordWidth;
        }
      }

      if (currentLineWords.length > 0) {
        let cx = startX;
        for (let i = 0; i < currentLineWords.length; i++) {
          const item = currentLineWords[i];
          const drawF = item.isSpecialBold ? bold : f;
          currentPage.drawText(item.text, { x: cx, y: cursorY, size: fontSize, font: drawF, color: textColor });
          cx += drawF.widthOfTextAtSize(item.text, fontSize) + font.widthOfTextAtSize(' ', fontSize);
        }
        cursorY -= (fontSize * 1.5);
      }
      cursorY -= (fontSize * 0.5);
    }
  };

  currentPage.drawText('MONTHLY ASSESSMENT REPORT', { x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize('MONTHLY ASSESSMENT REPORT', 14)) / 2, y: cursorY, size: 14, font: bold, color: PURPLE });
  cursorY -= 15;
  currentPage.drawText(period, { x: (LONG_BOND_WIDTH - font.widthOfTextAtSize(period, 10)) / 2, y: cursorY, size: 10, font: font, color: PURPLE });
  cursorY -= 30;

  const drawField = async (label, value) => {
    currentPage.drawText(label, { x: 50, y: cursorY, size: 10, font: font, color: INK });
    await drawParagraphs(value, 150, 400, 10, true, false, PURPLE);
    cursorY -= 5;
  };
  await drawField('Name of Student:', studentName);
  await drawField('Age / Sex:', [age, sex].filter(Boolean).join(' / '));
  await drawField('Diagnosis:', diagnosis);
  cursorY -= 15;

  if (dataText) {
    // Avoid orphaned titles
    if (cursorY < 120) await addPage();

    currentPage.drawText('DATA', { x: 50, y: cursorY, size: 11, font: bold, color: PURPLE });
    cursorY -= 15;
    await drawParagraphs(dataText, 50, 512, 10, false, true);
    cursorY -= 15;
  }

  // Omission-guard evidence compiled at submit time (POST /progress stamps
  // draft.sourceCoverage). Prints the reporting range plus session,
  // attendance, and activity-log counts so reviewers verify completeness.
  const coverage = draft.sourceCoverage && typeof draft.sourceCoverage === 'object'
    ? draft.sourceCoverage
    : null;
  if (coverage) {
    if (cursorY < 120) await addPage();

    currentPage.drawText('SOURCES', { x: 50, y: cursorY, size: 11, font: bold, color: PURPLE });
    cursorY -= 15;
    const fmtCount = (v, singular, plural) => (v == null ? 'n/a' : `${v} ${v === 1 ? singular : plural}`);
    const sourcesText = [
      `Reporting range: ${coverage.rangeLabel || `${coverage.rangeFrom || ''} to ${coverage.rangeTo || ''}`.trim() || '—'}`,
      `Sessions: ${fmtCount(coverage.sessions, 'session', 'sessions')} · Attendance days: ${fmtCount(coverage.attendanceDays, 'day', 'days')} · Daily activity logs: ${fmtCount(coverage.activityLogs, 'log', 'logs')}`,
    ].join('\n');
    await drawParagraphs(sourcesText, 50, 512, 10, false, true);
    cursorY -= 15;
  }

  if (assessmentText) {
    if (cursorY < 120) await addPage();

    currentPage.drawText('ASSESSMENT / OVERVIEW', { x: 50, y: cursorY, size: 11, font: bold, color: PURPLE });
    cursorY -= 15;
    await drawParagraphs(assessmentText, 50, 512, 10, false, true);
    cursorY -= 20;
  }

  const rows = Array.isArray(draft.planRows) ? draft.planRows : [];
  if (rows.length > 0) {
    const colX = [50, 130, 310, 370, 440];
    const colW = [80, 180, 60, 70, 122];
    const headers = ['Objective', 'Activities/Procedures', 'Time Frame', 'Responsible', 'Outcome'];

    // Measure a row's height without drawing, so the title + header + first
    // data row can be kept together. Mirrors the wrapping in drawTableRow.
    const measureRowHeight = (rowValues, isHeaderRow = false) => {
      const mFont = isHeaderRow ? bold : font;
      const mFs = 10;
      let mMax = 0;
      rowValues.forEach((val, i) => {
        const mLines = [];
        for (const p of String(val || '').split('\n')) {
          const words = p.split(/\s+/);
          let currentLine = '';
          for (let w = 0; w < words.length; w++) {
            let word = words[w];
            if (!word) continue;
            if (mFont.widthOfTextAtSize(word, mFs) > colW[i] - 10) {
              let broken = '';
              let rest = word;
              while (rest.length > 0) {
                const char = rest[0];
                if (mFont.widthOfTextAtSize(broken + char, mFs) > colW[i] - 10) break;
                broken += char;
                rest = rest.slice(1);
              }
              if (broken.length > 0 && rest.length > 0) {
                words.splice(w + 1, 0, rest);
                word = broken;
              }
            }
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (mFont.widthOfTextAtSize(testLine, mFs) > colW[i] - 10 && currentLine) {
              mLines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) mLines.push(currentLine);
        }
        const h = mLines.length * (mFs * 1.5) + 12;
        if (h > mMax) mMax = h;
      });
      return Math.max(mMax, 25);
    };

    // Keep title + header + first data row together: if they don't all fit
    // below (with slack), start a fresh page instead of orphaning the header.
    // Single header only — it is never repeated, so it can't appear twice.
    const firstRowValues = [rows[0].objective, rows[0].activities, rows[0].timeFrame, rows[0].responsible, rows[0].outcome];
    const keepTogether = 15 + measureRowHeight(headers, true) + measureRowHeight(firstRowValues, false);
    if (cursorY - keepTogether < 140) await addPage();

    currentPage.drawText('ACTIVITY PLAN', { x: 50, y: cursorY, size: 11, font: bold, color: PURPLE });
    cursorY -= 15;

    const drawTableRow = async (rowValues, isHeader = false, allowMove = true) => {
      let maxHeight = 0;
      const cellLines = [];
      rowValues.forEach((val, i) => {
        const f = isHeader ? bold : font;
        const fs = 10;
        const lines = [];
        const paragraphs = String(val || '').split('\n');

        for (const p of paragraphs) {
          const words = p.split(/\s+/);
          let currentLine = '';
          for (let w = 0; w < words.length; w++) {
            let word = words[w];
            if (!word) continue;

            if (f.widthOfTextAtSize(word, fs) > colW[i] - 10) {
              let broken = '';
              let rest = word;
              while (rest.length > 0) {
                let char = rest[0];
                if (f.widthOfTextAtSize(broken + char, fs) > colW[i] - 10) break;
                broken += char;
                rest = rest.slice(1);
              }
              if (broken.length > 0 && rest.length > 0) {
                words.splice(w + 1, 0, rest);
                word = broken;
              }
            }

            const testLine = currentLine ? `${currentLine} ${word}` : word;
            if (f.widthOfTextAtSize(testLine, fs) > colW[i] - 10 && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);
        }

        cellLines.push(lines);
        const h = lines.length * (fs * 1.5) + 12;
        if (h > maxHeight) maxHeight = h;
      });

      if (maxHeight < 25) maxHeight = 25;
      const rowFs = 10;
      const rowFont = isHeader ? bold : font;
      const PAGE_TOP = LONG_BOND_HEIGHT - 120;
      const PAGE_BOTTOM = 70;

      // Draw one chunk of the row (the whole row when it fits).
      const drawChunk = (chunkLines, chunkHeight, shadeHeader) => {
        const rowY = cursorY;
        if (shadeHeader) {
          currentPage.drawRectangle({ x: 50, y: rowY - chunkHeight, width: 512, height: chunkHeight, color: rgb(0.95, 0.90, 0.98) });
        }
        currentPage.drawRectangle({ x: 50, y: rowY - chunkHeight, width: 512, height: chunkHeight, borderColor: PURPLE, borderWidth: 1 });
        for (let i = 1; i < colX.length; i++) {
          currentPage.drawLine({ start: { x: colX[i], y: rowY }, end: { x: colX[i], y: rowY - chunkHeight }, color: PURPLE, thickness: 1 });
        }
        chunkLines.forEach((lines, i) => {
          let textY = rowY - 6 - rowFs;
          lines.forEach(line => {
            let cx = colX[i] + 5;
            if (isHeader) {
              const lw = rowFont.widthOfTextAtSize(line, rowFs);
              cx = colX[i] + (colW[i] - lw) / 2;
            }
            currentPage.drawText(line, { x: cx, y: textY, size: rowFs, font: rowFont, color: isHeader ? PURPLE : INK });
            textY -= (rowFs * 1.5);
          });
        });
        cursorY -= chunkHeight;
      };

      // Fits in the remaining space: draw whole.
      if (cursorY - maxHeight >= PAGE_BOTTOM) {
        drawChunk(cellLines, maxHeight, isHeader);
        return;
      }
      // Fits on a fresh page but not here: move the whole row — unless
      // moving would strand the just-drawn header alone (first data row),
      // in which case fall through and split below the header instead.
      if (allowMove && maxHeight <= PAGE_TOP - PAGE_BOTTOM) {
        await addPage();
        drawChunk(cellLines, maxHeight, isHeader);
        return;
      }
      // Taller than one page: split the row's lines across pages so no text
      // is cut off mid-row. Only the first chunk carries the header shade.
      const remaining = cellLines.map((lines) => [...lines]);
      let firstChunk = true;
      while (remaining.some((lines) => lines.length > 0)) {
        const availLines = Math.max(1, Math.floor((cursorY - PAGE_BOTTOM - 12) / (rowFs * 1.5)));
        const chunk = remaining.map((lines) => lines.splice(0, availLines));
        const chunkHeight = Math.max(
          25,
          Math.max(...chunk.map((lines) => lines.length * (rowFs * 1.5) + 12)),
        );
        drawChunk(chunk, chunkHeight, isHeader && firstChunk);
        firstChunk = false;
        if (remaining.some((lines) => lines.length > 0)) await addPage();
      }
    };

    await drawTableRow(headers, true, false);
    const valueRows = rows.map((r) => [r.objective, r.activities, r.timeFrame, r.responsible, r.outcome]);
    for (let i = 0; i < valueRows.length; i++) {
      // The first data row must never move to a fresh page on its own — that
      // would strand the header. It splits below the header instead.
      await drawTableRow(valueRows[i], false, i > 0);
    }
  cursorY -= 30;

  // Plan context line: which plan this is, its kind, its dates, and
  // how many weeks it covers. Numbering is 1-based (no Plan 0): legacy
  // "Month N" rows and interim "Cycle N" rows read as Plan N.
  // Drawn only when the report carries real plan context — otherwise legacy
  // monthlies would print a fabricated-looking "Plan 1 (Initial Plan) | —".
  {
    const planMatch = /^\s*(?:Plan|Cycle)\s+(\d+)\s*$/i.exec(report?.period || '');
    const legacyMatch = /^\s*Month\s+(\d+)\s*$/i.exec(report?.period || '');
    const cycStartRaw = String(content?.cycle?.startDate || content.planStart || '').slice(0, 10);
    const hasPlanContext = Boolean(content?.cycle || planMatch || legacyMatch || cycStartRaw);
    if (hasPlanContext) {
    const cycNumber = content?.cycle?.number
      ?? (planMatch ? Math.max(1, Number(planMatch[1])) : legacyMatch ? Math.max(1, Number(legacyMatch[1])) : 1);
    // 'initial_assessment' is retired: interim rows read as Initial Plan.
    const rawKind = content?.cycle?.kind === 'initial_assessment' ? 'initial_plan' : content?.cycle?.kind;
    const cycKind = rawKind
      || (cycNumber <= 1 ? 'initial_plan' : 'renewal');
    const cycKindLabel = { initial_plan: 'Initial Plan', renewal: 'Renewal' }[cycKind] || 'Plan';
    let cycEndRaw = '';
    const cycStartDate = new Date(`${cycStartRaw}T00:00:00`);
    if (cycStartRaw && !Number.isNaN(cycStartDate.getTime())) {
      const cycEndDate = new Date(cycStartDate);
      cycEndDate.setDate(cycEndDate.getDate() + iepTotalWeeks * 7 - 1);
      cycEndRaw = cycEndDate.toISOString().slice(0, 10);
    }
    const cycleLine = `Plan ${cycNumber} (${cycKindLabel})  |  ${dateText(cycStartRaw) || cycStartRaw || '—'} - ${dateText(cycEndRaw) || cycEndRaw || '—'}  |  ${iepTotalWeeks} week${iepTotalWeeks === 1 ? '' : 's'}`;
    // Monthly layout uses a hard-coded 40pt left margin (see prepX below) —
    // MARGIN_LEFT only exists in the behavioral/IEP renderers this block was
    // copied from.
    currentPage.drawText(cycleLine, { x: 40, y: cursorY, size: 10, font: bold, color: PURPLE });
    cursorY -= 18;
    }
  }
  }

  if (cursorY < 90) await addPage();

  const prepared = report?.prepared_profile || report?.prepared_by || {};
  const noted = report?.noted_profile || report?.reviewer_profile || report?.noted_by || {};
  const preparedSignature = report?.prepared_signature_image;
  const notedSignature = first(report?.noted_signature_image, report?.reviewer_signature_image);

  const sigLabelY = cursorY;
  const sigLineY = sigLabelY - 60;
  const sigNameY = sigLineY - 15;
  const sigLicenseY = sigNameY - 15;
  const sigDateY = sigLicenseY - 15;
  const sigOverlapY = sigLineY - 15; // Signature slightly overlapping the line

  const prepX = 40;
  const notX = 290;
  const SIG_COL_W = 230;

  currentPage.drawText('Prepared by:', { x: prepX, y: sigLabelY, size: 10, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: notX, y: sigLabelY, size: 10, font: bold, color: INK });

  cursorY -= 120;

  const dummyLayout = { sx: 1, sy: 1, landscape: false };
  if (preparedSignature) await drawSignature(currentPage, pdf, preparedSignature, dummyLayout, prepX, sigOverlapY, SIG_COL_W, 60, { thicken: true });
  if (notedSignature) await drawSignature(currentPage, pdf, notedSignature, dummyLayout, notX, sigOverlapY, SIG_COL_W, 60, { thicken: true });

  const toDateStr = (d) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) {
      return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  };
  const pDate = draft.preparedDate || report?.prepared_at || report?.created_at || new Date();
  const nDate = draft.notedDate || report?.reviewer_date || report?.reviewed_at || report?.noted_at || new Date();

  const drawSigBox = (profile, fallbackTitle, dateVal, blockX) => {
    const nameWithHonors = nameWithHonorific(first(profileDisplayName(profile), ''), fallbackTitle);
    const cleanTitle = fallbackTitle;
    const license = first(profile.license_no, profile.prc_no, profile.prc_number);
    const dateStr = toDateStr(dateVal);

    currentPage.drawLine({ start: { x: blockX, y: sigLineY }, end: { x: blockX + SIG_COL_W, y: sigLineY }, color: PURPLE, thickness: 1 });

    const titlePrefix = `${cleanTitle}: `;
    const titleWidth = font.widthOfTextAtSize(titlePrefix, 10);
    
    currentPage.drawText(titlePrefix, { x: blockX, y: sigNameY, size: 10, font: font, color: INK });
    currentPage.drawText(nameWithHonors, { x: blockX + titleWidth, y: sigNameY, size: 10, font: bold, color: PURPLE });

    if (license) {
      currentPage.drawText(`License Number: ${license}`, { x: blockX, y: sigLicenseY, size: 10, font: font, color: INK });
    }
    currentPage.drawText(`Date: ${dateStr}`, { x: blockX, y: sigDateY, size: 10, font: font, color: INK });
  };

  drawSigBox(prepared, 'Psychometrician', pDate, prepX);
  drawSigBox(noted, 'Psychologist', nDate, notX);

  pages.forEach((p, idx) => {
    const text = `Page ${idx + 1} of ${pages.length}`;
    p.drawText(text, { x: LONG_BOND_WIDTH - 50 - bold.widthOfTextAtSize(text, 10), y: 40, size: 10, font: bold, color: PURPLE });
  });

  if (!isCtc && requestingUser) {
    const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
    const dateStr = `${new Date().toLocaleString()}`;
    const rowSpacingY = 220;
    pages.forEach((p) => {
      const { width, height } = p.getSize();
      for (let y = height + rowSpacingY; y > -rowSpacingY; y -= rowSpacingY) {
        for (let x = -200; x < width + 200; x += 550) {
          p.drawText('CONFIDENTIAL', { x, y, size: 54, font: bold, color: rgb(0.8, 0.8, 0.8), opacity: 0.15, rotate: degrees(45) });
          p.drawText(userStr, { x: x + 40, y: y - 50, size: 12, font: bold, color: rgb(0.7, 0.7, 0.7), opacity: 0.25, rotate: degrees(45) });
          p.drawText(dateStr, { x: x + 80, y: y - 70, size: 10, font: font, color: rgb(0.7, 0.7, 0.7), opacity: 0.25, rotate: degrees(45) });
        }
      }
    });
  }

  return await pdf.save();
}

async function renderFormPdf({ code, bundle, submission, report, requestingUser, isCtc, hideSignatures }) {
  if (hideSignatures) {
    bundle = stripSignatureImages(bundle);
    submission = stripSignatureImages(submission);
    report = stripSignatureImages(report);
  }
  if (code === 'CMPS:SE-FO-03') {
    return await renderDynamicFO03Pdf({ bundle, submission, normalizeBundle, parseJson, first, profileDisplayName, nameWithHonorific, requestingUser, isCtc });
  }
  if (code === 'CMPS:SE-FO-04') {
    return await renderDynamicMMSEPdf({ bundle, submission, requestingUser, isCtc });
  }
  if (code === 'CMPS:SE-FO-05') {
    return await renderDynamicFO05Pdf({ bundle, submission, normalizeBundle, parseJson, first, profileDisplayName, nameWithHonorific, requestingUser, isCtc });
  }
  if (code === 'CMPS:SE-FO-08' || code === 'CMPS:SE-FO-09') {
    return await renderDynamicMonthlyAssessmentReport({ bundle, report, requestingUser, isCtc });
  }
  if (code === 'CMPS:SE-FO-06') {
    return await renderDynamicBehavioralPdf({ bundle, report, requestingUser, isCtc });
  }
  if (code === 'CMPS:SE-FO-10') {
    return await renderDynamicIepPdf({ bundle, report, requestingUser, isCtc });
  }

  const templatePath = TEMPLATE_PATHS[code];
  if (!templatePath) {
    const error = new Error(`No reference PDF is registered for ${code}`);
    error.status = 422;
    throw error;
  }
  // Templates are read-only reference bytes — keep one copy per code in
  // memory so repeat previews skip disk I/O (up to ~1.8MB per read).
  // PDFDocument.load copies the bytes, so sharing the buffer is safe.
  let source = TEMPLATE_BYTES_CACHE.get(code);
  if (!source) {
    source = await fs.readFile(templatePath);
    TEMPLATE_BYTES_CACHE.set(code, source);
  }
  const pdf = await PDFDocument.load(source);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const fonts = { font, bold };
  const pages = pdf.getPages();
  const layouts = pages.map((page) => {
    // FO-05 and FO-06 are supplied as official templates whose native page
    // dimensions must be preserved for measured fields and tables.
    if (code === 'CMPS:SE-FO-05' || code === 'CMPS:SE-FO-06' || code === 'CMPS:SE-FO-07') {
      return {
        sx: 1,
        sy: 1,
        sourceWidth: page.getWidth(),
        sourceHeight: page.getHeight(),
        targetWidth: page.getWidth(),
        targetHeight: page.getHeight(),
        landscape: page.getWidth() > page.getHeight(),
      };
    }
    return fitPageToLongBond(page);
  });

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    const layout = layouts[index];
    if (code === 'CMPS:SE-FO-01') await drawAdmission(page, pdf, fonts, bundle, layout);
    else if (code === 'CMPS:SE-FO-02') await drawConsent(page, pdf, fonts, bundle, submission, layout, index);

    else if (code === 'CMPS:SE-FO-03' || code === 'CMPS:SE-FO-04') await drawAssessment(page, pdf, fonts, bundle, submission, code, index, layout);
    else if (code === 'CMPS:SE-FO-05') await drawAssessment(page, pdf, fonts, bundle, submission, code, index, layout);
    else if (code === 'CMPS:SE-FO-08' || code === 'CMPS:SE-FO-09') await drawReport(page, pdf, fonts, bundle, report, code, index, layout);
    else if (code === 'CMPS:SE-FO-07') await drawDailyActivity(page, pdf, fonts, report, layout);

    // Apply Watermarks â€” CTC skips watermark entirely; standard tiles diagonally
    if (!isCtc && requestingUser) {
      const { width, height } = page.getSize();
      const userStr = `Downloaded by: ${requestingUser.display_name || 'User'} (${requestingUser.email || ''})`;
      const dateStr = `${new Date().toLocaleString()}`;

      // Tile diagonally with generous spacing so each group of 3 lines is readable
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
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = {
  TEMPLATE_PATHS,
  FO03_LAYOUT,
  FO04_LAYOUT,
  FO05_LAYOUT,
  FO06_LAYOUT,
  FO07_LAYOUT,
  FO08_LAYOUT,
  FO10_LAYOUT,
  renderFormPdf,
  renderAttendancePdf,
  normalizeBundle,
  honorificForProfession,
  nameWithHonorific,
  parseJson,
  inferFormCode,
  normalizeDailyActivityRecord,
};

let MMSE_TEMPLATE_BYTES = null;
let MMSE_TEMPLATE_DOC = null;

async function renderDynamicMMSEPdf({ bundle, submission, requestingUser, isCtc }) {
  const LONG_BOND_WIDTH = 612;
  const LONG_BOND_HEIGHT = 936;
  const MARGIN_LEFT = 50;
  const CONTENT_WIDTH = LONG_BOND_WIDTH - 2 * MARGIN_LEFT;

  if (!MMSE_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templateImageBytes = await loadTemplateImageBytes('cmps-form-template.png');
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_WIDTH, LONG_BOND_HEIGHT]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_WIDTH, height: LONG_BOND_HEIGHT });
    MMSE_TEMPLATE_BYTES = await tempPdf.save();
    MMSE_TEMPLATE_DOC = await PDFDocument.load(MMSE_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(MMSE_TEMPLATE_BYTES);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);
  const fonts = { font, bold };

  let currentPage = pdf.getPages()[0];
  let pages = [currentPage];
  let cursorY = LONG_BOND_HEIGHT - 120;

  const drawFormNumber = (page) => {
    page.drawText('CMPS:SE-FO-04 rev.0 02192026', {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize('CMPS:SE-FO-04 rev.0 02192026', 7),
      y: LONG_BOND_HEIGHT - 98,
      size: 8,
      font: bold,
      color: PURPLE
    });
  };

  const addPage = async () => {
    const [copiedPage] = await pdf.copyPages(MMSE_TEMPLATE_DOC, [0]);
    pdf.addPage(copiedPage);
    currentPage = copiedPage;
    pages.push(currentPage);
    drawFormNumber(currentPage);
    cursorY = LONG_BOND_HEIGHT - 120;
  };

  drawFormNumber(currentPage);

  const d = normalizeBundle(bundle);
  const p = d.patient || {};
  const content = parseJson(submission?.content, {});

  const titleStr = 'MINI-MENTAL STATUS EXAMINATION';
  currentPage.drawText(titleStr, { x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(titleStr, 14)) / 2, y: cursorY, size: 14, font: bold, color: PURPLE });
  cursorY -= 15;
  const subtitleStr = 'SPECIAL EDUCATION PROGRAM';
  currentPage.drawText(subtitleStr, { x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(subtitleStr, 11)) / 2, y: cursorY, size: 11, font: bold, color: PURPLE });
  cursorY -= 30;

  const drawSectionHeader = async (text) => {
    if (cursorY < 120) await addPage();
    currentPage.drawText(text, { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: PURPLE });
    cursorY -= 20;
  };

  await drawSectionHeader('I. PERSONAL INFORMATION OF STUDENT');

  const evalDate = first(content.evalDate, submission?.evaluation_date, submission?.created_at);
  const studentName = p.last_name || p.first_name
    ? [p.last_name, [p.first_name, p.middle_name ? p.middle_name.charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ')].filter(Boolean).join(', ').toUpperCase()
    : String(d.patientName || '').toUpperCase();

  const birthdate = p.date_of_birth;
  const studentAge = p.age ?? p.computed_age ?? (p.date_of_birth ? Math.floor((new Date() - new Date(p.date_of_birth)) / 31557600000) : '');
  const studentSex = p.sex ? p.sex.charAt(0).toUpperCase() + p.sex.slice(1).toLowerCase() : '';

  const col1X = MARGIN_LEFT;
  const col2X = MARGIN_LEFT + 150;

  const getLines = (text, maxWidth, fs = 9, isBold = false) => {
    if (!text) return [];
    const f = isBold ? bold : font;
    const lines = [];
    const paragraphs = String(text).split('\n');
    for (const pr of paragraphs) {
      if (!pr.trim()) {
        lines.push('');
        continue;
      }
      const words = pr.split(/\s+/);
      let currentLine = '';
      for (let i = 0; i < words.length; i++) {
        let word = words[i];
        if (!word) continue;

        let wordWidth = f.widthOfTextAtSize(word, fs);
        if (wordWidth > maxWidth) {
          let broken = '';
          let rest = word;
          while (rest.length > 0) {
            let char = rest[0];
            if (f.widthOfTextAtSize(broken + char, fs) > maxWidth - 10) break;
            broken += char;
            rest = rest.slice(1);
          }
          if (broken.length > 0 && rest.length > 0) {
            words.splice(i + 1, 0, rest);
            word = broken;
          }
        }

        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (f.widthOfTextAtSize(testLine, fs) > maxWidth - 5 && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);
    }
    return lines;
  };

  const drawMMSEHeaderRow = (label, value) => {
    currentPage.drawText(label, { x: col1X, y: cursorY, size: 9.5, font: bold, color: INK });
    const maxValWidth = LONG_BOND_WIDTH - MARGIN_LEFT - col2X - 5;
    const valLines = getLines(value, maxValWidth, 9.5, true);
    if (valLines.length <= 1) {
      currentPage.drawText(value, { x: col2X, y: cursorY, size: 9.5, font: bold, color: PURPLE });
      currentPage.drawLine({ start: { x: col2X, y: cursorY - 2 }, end: { x: LONG_BOND_WIDTH - MARGIN_LEFT, y: cursorY - 2 }, thickness: 0.75, color: INK });
      cursorY -= 15;
    } else {
      valLines.forEach((line, idx) => {
        currentPage.drawText(line, { x: col2X, y: cursorY - (idx * 12), size: 9.5, font: bold, color: PURPLE });
        currentPage.drawLine({ start: { x: col2X, y: cursorY - (idx * 12) - 2 }, end: { x: LONG_BOND_WIDTH - MARGIN_LEFT, y: cursorY - (idx * 12) - 2 }, thickness: 0.75, color: INK });
      });
      cursorY -= 15 + (valLines.length - 1) * 12;
    }
  };

  drawMMSEHeaderRow('Date:', evalDate ? new Date(evalDate).toLocaleDateString() : '');
  drawMMSEHeaderRow('Full Name (LN, FN MI):', studentName);
  drawMMSEHeaderRow('Age/Sex:', [studentAge, studentSex].filter(Boolean).join(' / '));
  drawMMSEHeaderRow('Birthdate:', birthdate ? new Date(birthdate).toLocaleDateString() : '');
  cursorY -= 15;

  await drawSectionHeader('II. DIAGNOSIS');

  const metadata = parseJson(submission?.metadata, {});
  const previouslyDiagnosed = booleanValue(first(
    metadata?.previously_diagnosed,
    storedSubmissionValue(submission, 'previously_diagnosed', 'previously_assessed'),
    content?.previouslyDiagnosed,
    content?.previously_diagnosed,
    p.previously_diagnosed,
    d.clinical?.previously_diagnosed,
  ));

  currentPage.drawText('Was the student previously diagnosed/assessed?', { x: col1X, y: cursorY, size: 9.5, font: bold, color: INK });

  const drawDiagnosedCheck = (label, xOffset, isChecked) => {
    if (isChecked) drawCheckMark(currentPage, col2X + 110 + xOffset, cursorY, 9.5, PURPLE);
    currentPage.drawText(label, { x: col2X + 110 + xOffset + 12, y: cursorY, size: 9.5, font: bold, color: PURPLE });
  };

  if (previouslyDiagnosed === true) {
    drawDiagnosedCheck('Yes', 0, true);
    drawDiagnosedCheck('No', 40, false);
  } else if (previouslyDiagnosed === false) {
    drawDiagnosedCheck('Yes', 0, false);
    drawDiagnosedCheck('No', 40, true);
  } else {
    drawDiagnosedCheck('Yes', 0, false);
    drawDiagnosedCheck('No', 40, false);
    drawDiagnosedCheck('N/A', 80, true);
  }

  const diagnosis = first(metadata?.diagnosis, content?.diagnosis, submission?.diagnosis, p.primary_diagnosis, p.diagnosis, d.clinical?.primary_diagnosis, d.clinical?.diagnosis);
  const medicalHistory = first(metadata?.medical_history, metadata?.medicalHistory, content?.medicalHistory, content?.medical_history, submission?.medicalHistory, p.medical_history, d.clinical?.medicalHistory);
  const familyHistory = first(metadata?.family_history, metadata?.familyHistory, content?.familyHistory, content?.family_history, submission?.familyHistory, p.family_history, d.clinical?.familyHistory);

  cursorY -= 15;
  drawMMSEHeaderRow('Diagnosis:', String(diagnosis || ''));
  // Blank histories print as "None" so the official record never shows an
  // ambiguous empty line (same rule as the FO-03 caregiver PDF below).
  drawMMSEHeaderRow('Medical History:', String(medicalHistory || '').trim() || 'None');
  drawMMSEHeaderRow('Family History:', String(familyHistory || '').trim() || 'None');
  cursorY -= 15;

  // Render Checklists

  const drawDomainChecklist = async (numeral, heading, items, hasNa = true) => {
    if (cursorY < 150) await addPage();
    if (numeral) {
      currentPage.drawText(`${numeral}. ${heading}`, { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: PURPLE });
    } else {
      currentPage.drawText(heading, { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: PURPLE });
    }
    cursorY -= 15;

    // Headers
    const yesX = MARGIN_LEFT + 250;
    const noX = yesX + 30;
    const naX = noX + 30;
    const remX = hasNa ? naX + 30 : noX + 30;

    // No standalone header row: the Yes/No/N/A/Remarks labels share each
    // category row below, saving one row per table.

    for (const item of items) {
      if (item.category) {
        if (cursorY < 80) await addPage();
        currentPage.drawText(item.category, { x: MARGIN_LEFT + 5, y: cursorY, size: 9, font: bold, color: INK });
        // Column headers live on the category row itself.
        currentPage.drawText('Yes', { x: yesX, y: cursorY, size: 9, font: bold, color: PURPLE });
        currentPage.drawText('No', { x: noX, y: cursorY, size: 9, font: bold, color: PURPLE });
        if (hasNa) currentPage.drawText('N/A', { x: naX, y: cursorY, size: 9, font: bold, color: PURPLE });
        currentPage.drawText('Remarks', { x: remX, y: cursorY, size: 9, font: bold, color: PURPLE });

        const catTopY = cursorY + 12;
        cursorY -= 15;
        const catBotY = cursorY + 12;
        currentPage.drawLine({ start: { x: MARGIN_LEFT, y: catTopY }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: catTopY }, thickness: 1, color: PURPLE });
        currentPage.drawLine({ start: { x: MARGIN_LEFT, y: catBotY }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: catBotY }, thickness: 1, color: PURPLE });
        [yesX - 5, noX - 5, naX - 5, remX - 5, MARGIN_LEFT + CONTENT_WIDTH].forEach(vx => {
          currentPage.drawLine({ start: { x: vx, y: catTopY }, end: { x: vx, y: catBotY }, thickness: 1, color: PURPLE });
        });
        currentPage.drawLine({ start: { x: MARGIN_LEFT, y: catTopY }, end: { x: MARGIN_LEFT, y: catBotY }, thickness: 1, color: PURPLE });
      }
      for (const row of item.rows) {
        const ansEntry = answerEntry(submission, row.key);
        const ans = normalizedAnswer(ansEntry.response); // "yes", "no", "na"

        // Render the full remarks text — it wraps and the row grows (with
        // page breaks as needed). Never silently drop the user's words.
        const remText = ansEntry.remarks || '';

        const remLines = getLines(remText, CONTENT_WIDTH - (remX - MARGIN_LEFT) - 5, 9);
        const rowHeight = 18 + Math.max(0, (remLines.length - 1) * 11);

        let isNewPage = false;
        if (cursorY - rowHeight < 80) {
          await addPage();
          isNewPage = true;
        }

        currentPage.drawText(`${row.n}`, { x: MARGIN_LEFT + 5, y: cursorY, size: 9, font: bold, color: INK });
        currentPage.drawText(row.text, { x: MARGIN_LEFT + 20, y: cursorY, size: 9, font, color: INK });

        if (ans === 'yes') drawCheckMark(currentPage, yesX + 3, cursorY - 1, 9, PURPLE);
        if (ans === 'no') drawCheckMark(currentPage, noX + 3, cursorY - 1, 9, PURPLE);
        if (hasNa && ans === 'na') drawCheckMark(currentPage, naX + 3, cursorY - 1, 9, PURPLE);

        for (let i = 0; i < remLines.length; i++) {
          currentPage.drawText(remLines[i], { x: remX, y: cursorY - (i * 11), size: 9, font, color: INK });
        }

        const topY = cursorY + 12;
        cursorY -= rowHeight;
        const botY = cursorY + 12;

        currentPage.drawLine({ start: { x: MARGIN_LEFT, y: botY }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: botY }, thickness: 1, color: PURPLE });
        if (isNewPage) {
          currentPage.drawLine({ start: { x: MARGIN_LEFT, y: topY }, end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: topY }, thickness: 1, color: PURPLE });
        }

        [yesX - 5, noX - 5, naX - 5, remX - 5, MARGIN_LEFT + CONTENT_WIDTH].forEach(vx => {
          currentPage.drawLine({ start: { x: vx, y: topY }, end: { x: vx, y: botY }, thickness: 1, color: PURPLE });
        });
        currentPage.drawLine({ start: { x: MARGIN_LEFT, y: topY }, end: { x: MARGIN_LEFT, y: botY }, thickness: 1, color: PURPLE });
      }
    }
  };

  await drawDomainChecklist('I', 'Practical Domain', [
    { category: 'A. APPEARANCE', rows: [{ n: 1, text: 'Dresses appropriately for the occasion', key: 'practical_a1' }] },
    {
      category: 'B. ACTIVITIES OF DAILY LIVING', rows: [
        { n: 1, text: 'Opens a simple container or zipper', key: 'practical_b1' },
        { n: 2, text: 'Can demonstrate handwashing when asked', key: 'practical_b2' },
        { n: 3, text: 'Removes or puts on a cloth/item (shoe, earring)', key: 'practical_b3' },
        { n: 4, text: 'Can independently drink from a cup or bottle', key: 'practical_b4' },
      ]
    }
  ]);

  await drawDomainChecklist('II', 'Conceptual Domain', [
    {
      category: 'A. OBJECT RECOGNITION', rows: [
        { n: 1, text: 'Names at least two(2) familiar objects (pen, bottle)', key: 'conceptual_a1' },
        { n: 2, text: 'Can identify familiar faces (mother, father)', key: 'conceptual_a2' },
      ]
    },
    {
      category: 'B. IDENTIFYING DETAILS', rows: [
        { n: 1, text: 'Can state his/her own name', key: 'conceptual_b1' },
        { n: 2, text: 'Can tell his/her birthday and/or age', key: 'conceptual_b2' },
      ]
    },
    {
      category: 'C. PLACE RECOGNITION', rows: [
        { n: 1, text: 'Can identify the current location', key: 'conceptual_c1' },
        { n: 2, text: 'Can tell his/her home address (landmark)', key: 'conceptual_c2' },
      ]
    },
    {
      category: 'D. TIME PERCEPTION', rows: [
        { n: 1, text: 'Can identify current time (approximate acceptable)', key: 'conceptual_d1' },
        { n: 2, text: 'Can identify the current year', key: 'conceptual_d2' },
      ]
    },
    {
      category: 'E. MEMORY', rows: [
        { n: 1, text: 'Can recall simple past details (food eaten yesterday)', key: 'conceptual_e1' },
        { n: 2, text: 'Can repeat two named objects', key: 'conceptual_e2' },
      ]
    }
  ]);

  await drawDomainChecklist('III', 'Social Domain', [
    {
      category: 'A. AFFECT & INTERACTION', rows: [
        { n: 1, text: 'Makes eye contact when name is called', key: 'social_a1' },
        { n: 2, text: 'Responds to greetings (verbal or gesture)', key: 'social_a2' },
        { n: 3, text: 'Can show emotions (happy, sad)', key: 'social_a3' },
        { n: 4, text: 'Does not show aggressive behaviors', key: 'social_a4' },
        { n: 5, text: 'Can identify basic emotions', key: 'social_a5' },
      ]
    }
  ]);

  await drawDomainChecklist('IV', 'Bodily Kinesthetics Domain', [
    {
      category: 'A. FINE MOTOR SKILLS', rows: [
        { n: 1, text: 'Can hold objects appropriately (pencil)', key: 'bodily_a1' },
        { n: 2, text: 'Writes letters or name legibly', key: 'bodily_a2' },
        { n: 3, text: 'Can color within the lines', key: 'bodily_a3' },
        { n: 4, text: 'Can demonstrate hand-eye coordination (tracing)', key: 'bodily_a4' },
        { n: 5, text: 'Can copy basic shapes (circle, triangle, square)', key: 'bodily_a5' },
      ]
    },
    {
      category: 'B. GROSS MOTOR SKILLS', rows: [
        { n: 1, text: 'Can stand on one foot briefly', key: 'bodily_b1' },
        { n: 2, text: 'Walks steadily across the room', key: 'bodily_b2' },
        { n: 3, text: 'Can jump forward with both feet together', key: 'bodily_b3' },
        { n: 4, text: 'Climb stairs using alternating feet', key: 'bodily_b4' },
      ]
    }
  ]);

  await drawDomainChecklist(null, 'Perceptual Disturbances', [
    {
      category: 'PERCEPTUAL DISTURBANCES', rows: [
        { n: 1, text: 'Hallucination', key: 'perceptual_1' },
        { n: 2, text: 'Delusions', key: 'perceptual_2' },
      ]
    }
  ]);

  await drawDomainChecklist(null, 'Stimming', [
    {
      category: 'STIMMING', rows: [
        { n: 1, text: 'Verbal (echolalia, humming)', key: 'stimming_1' },
        { n: 2, text: 'Auditory (sound sensitivity)', key: 'stimming_2' },
        { n: 3, text: 'Visual (fixation to objects, constant eye movement)', key: 'stimming_3' },
        { n: 4, text: 'Proprioceptive (jumping, crashing into objects)', key: 'stimming_4' },
        { n: 5, text: 'Vestibular (rocking, spinning)', key: 'stimming_5' },
        { n: 6, text: 'Oral (chewing, biting, sucking)', key: 'stimming_6' },
        { n: 7, text: 'Tactile (excoriation, skin rubbing, fidgeting)', key: 'stimming_7' },
      ]
    }
  ], false); // hasNa = false

  // Signatories — the block extends ~145pt below the labels, so break early
  // to keep it inside the template's printed content box.
  if (cursorY < 190) await addPage();
  cursorY -= 20;

  const prepared = submission?.answered_profile || submission?.respondent_profile || p.treating_psychometrician || {};
  const noted = submission?.reviewer_profile || p.treating_psychologist || {};

  const preparedSignature = first(submission?.answered_signature_image, submission?.respondent_signature_image);
  const notedSignature = first(submission?.reviewer_signature_image, submission?.signed_by_signature_image);

  const SIG_COL_W = (CONTENT_WIDTH - 20) / 2;
  const prepX = MARGIN_LEFT;
  const notX = MARGIN_LEFT + SIG_COL_W + 20;
  
  currentPage.drawText('Prepared by:', { x: prepX, y: cursorY, size: 10, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: notX, y: cursorY, size: 10, font: bold, color: INK });

  const drawSignatory = async (profile, imgBase64, blockX, title) => {
    const name = nameWithHonorific(first(profileDisplayName(profile), profile?.fallbackName), title);
    const license = first(profile?.license_no, profile?.prc_no, profile?.prc_number);
    const blockTopY = cursorY - 10;

    // Overline just above the name
    const lineY = blockTopY - 5;
    currentPage.drawLine({
      start: { x: blockX, y: lineY },
      end: { x: blockX + SIG_COL_W, y: lineY },
      thickness: 0.75, color: PURPLE,
    });

    // Title label (normal) + Name (bold, purple)
    const titleLabel = `${title}: `;
    const titleLabelW = font.widthOfTextAtSize(titleLabel, 9.5);
    const nameY = lineY - 14;
    currentPage.drawText(titleLabel, { x: blockX, y: nameY, size: 9.5, font: font, color: INK });
    currentPage.drawText(name || '', { x: blockX + titleLabelW, y: nameY, size: 9.5, font: bold, color: PURPLE });

    // License
    const licenseY = nameY - 14;
    if (license) {
      const licLabel = 'License Number: ';
      const licLabelW = font.widthOfTextAtSize(licLabel, 9.5);
      currentPage.drawText(licLabel, { x: blockX, y: licenseY, size: 9.5, font: font, color: INK });
      currentPage.drawText(String(license), { x: blockX + licLabelW, y: licenseY, size: 9.5, font: font, color: INK });
    }

    // Date
    const dateY = licenseY - 14;
    const dateLabel = 'Date: ';
    const dateLabelW = font.widthOfTextAtSize(dateLabel, 9.5);
    currentPage.drawText(dateLabel, { x: blockX, y: dateY, size: 9.5, font: font, color: INK });
    currentPage.drawText(evalDate ? new Date(evalDate).toLocaleDateString() : '', { x: blockX + dateLabelW, y: dateY, size: 9.5, font: font, color: INK });

    // Signature image — overlaps the name line for a natural wet-signature look
    if (imgBase64) {
      try {
        const isJpg = imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg');
        const imageBytes = Buffer.from(imgBase64.split(',')[1], 'base64');
        const sigImg = (await embedSignatureInk(pdf, imgBase64))
          || (isJpg ? await pdf.embedJpg(imageBytes) : await pdf.embedPng(imageBytes));
        const { width: iw, height: ih } = sigImg.scale(1);
        const sigW = 120;
        const sigH = 50;
        const scale = Math.min(sigW / iw, sigH / ih, 1);
        const sw = iw * scale;
        const sh = ih * scale;
        // Position signature overlapping the name, centered horizontally in the column
        currentPage.drawImage(sigImg, {
          x: blockX + (SIG_COL_W / 2) - (sw / 2),
          y: nameY - 2,
          width: sw,
          height: sh,
        });
      } catch (_) {}
    }
  };

  await drawSignatory({ ...prepared, fallbackName: content?.evaluatorName }, preparedSignature, prepX, 'Psychometrician');
  await drawSignatory({ ...noted, fallbackName: d.representativeName }, notedSignature, notX, 'Psychologist');

  pages.forEach((p, i) => {
    const pageText = `Page ${i + 1} of ${pages.length}`;
    p.drawText(pageText, {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize(pageText, 8),
      y: 65,
      size: 8,
      font: bold,
      color: PURPLE
    });
  });

  // Preview watermark (who generated this copy) on every non-CTC render.
  await applyPreviewWatermark(pdf, requestingUser, isCtc);

  return await pdf.save();
}
