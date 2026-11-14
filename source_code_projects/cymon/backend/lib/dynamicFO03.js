const fs = require('node:fs/promises');
const path = require('node:path');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { loadTemplateImageBytes } = require('./formTemplateImages');
const { embedSignatureInk } = require('./signatureInk');
const { applyPreviewWatermark } = require('./pdfWatermark');

const WHITE = rgb(1, 1, 1);
const INK = rgb(0.15, 0.15, 0.15);
const PURPLE = rgb(0.35, 0.20, 0.55);
const LIGHT_PURPLE = rgb(0.90, 0.85, 0.95);

// hasRemarks: true => show remarks column for this domain
const BEHAV_STRUCTURE = [
  {
    key: 'conceptual',
    title: 'I. Conceptual Domain',
    hasRemarks: false,
    items: [
      { key: 'conceptual_1', label: 'States full name, age, and identifies parents when asked.' },
      { key: 'conceptual_2', label: 'Follows two-step instructions (e.g., "Pick up your bag and sit down") without repeated prompting.' },
      { key: 'conceptual_3', label: 'Answers WH-questions (who, what, where, why) appropriately in simple conversations.' },
      { key: 'conceptual_4', label: 'Identifies and names common objects and their use (e.g. spoon is for eating).' },
      { key: 'conceptual_5', label: 'Recognizes letters, numbers, colors, or shapes appropriate to age level.' },
      { key: 'conceptual_6', label: 'Can count objects correctly and perform simple math (if age-appropriate).' },
      { key: 'conceptual_7', label: 'Understands time concepts (today, yesterday, tomorrow) and daily schedule.' },
      { key: 'conceptual_8', label: 'Expresses needs, thoughts, and feelings using understandable words or gestures.' },
      { key: 'conceptual_9', label: 'Maintains attention on structured task for at least 10-15 minutes (age-appropriate).' },
      { key: 'conceptual_10', label: 'Demonstrates understanding of cause and effect (e.g., "If I run, I might fall").' },
      { key: 'conceptual_11', label: 'Understands simple problem-solving (e.g., finds alternative if toy is unavailable).' },
      { key: 'conceptual_12', label: 'Reads simple words or sentences (if school-aged).' }
    ]
  },
  {
    key: 'social',
    title: 'II. Social Domain',
    hasRemarks: false,
    items: [
      { key: 'social_1', label: 'Initiates interaction with peers or adults appropriately.' },
      { key: 'social_2', label: 'Maintains appropriate eye contact during conversation.' },
      { key: 'social_3', label: 'Responds appropriately when name is called.' },
      { key: 'social_4', label: 'Engages in cooperative play (sharing, turn-taking).' },
      { key: 'social_5', label: 'Understands personal space and boundaries.' },
      { key: 'social_6', label: 'Expresses emotions appropriately without extreme reactions.' },
      { key: 'social_7', label: 'Recovers from frustration within reasonable time (without prolonged meltdown).' },
      { key: 'social_8', label: 'Shows empathy (comforts others who are hurt or sad).' },
      { key: 'social_9', label: 'Follows group rules in school/home setting.' },
      { key: 'social_10', label: 'Adjusts behavior according to situation (formal vs play setting).' },
      { key: 'social_11', label: 'Understands simple social cues (e.g., someone is angry or joking).' },
      { key: 'social_12', label: 'Avoids aggressive behaviors (hitting, biting, throwing objects).' },
      { key: 'social_13', label: 'Can recognize familiar faces such as family members, teacher, or peers.' }
    ]
  },
  {
    key: 'practical',
    title: 'III. Practical Domain',
    hasRemarks: false,
    items: [
      { key: 'practical_1', label: 'Eats independently using utensils properly.' },
      { key: 'practical_2', label: 'Dresses and undresses with minimal help.' },
      { key: 'practical_3', label: 'Uses toilet independently and maintains cleanliness.' },
      { key: 'practical_4', label: 'Brushes teeth and washes hands independently.' },
      { key: 'practical_5', label: 'Follows daily routine (wakes up, prepares for school).' },
      { key: 'practical_6', label: 'Packs and organizes school materials.' },
      { key: 'practical_7', label: 'Understands basic money value and transactions (age-appropriate).' },
      { key: 'practical_8', label: 'Demonstrates awareness of safety (traffic, strangers, sharp objects).' },
      { key: 'practical_9', label: 'Completes simple household chores when instructed.' },
      { key: 'practical_10', label: 'Travels short familiar distances with supervision (age-appropriate).' },
      { key: 'practical_11', label: 'Manages personal belongings responsibly.' },
      { key: 'practical_12', label: 'Seeks help appropriately when confused or unsafe.' }
    ]
  },
  {
    key: 'gross_motor',
    title: 'IV. Motor Development Domain - A. Gross Motor Skills',
    hasRemarks: false,
    items: [
      { key: 'gross_1', label: 'Walks, runs, and stops without losing balance.' },
      { key: 'gross_2', label: 'Jumps forward with both feet together.' },
      { key: 'gross_3', label: 'Climbs stairs alternating feet (age-appropriate).' },
      { key: 'gross_4', label: 'Kicks a ball with coordination and balance.' },
      { key: 'gross_5', label: 'Throws and catches a medium-sized ball.' },
      { key: 'gross_6', label: 'Maintains balance while standing on one foot for 5 seconds.' },
      { key: 'gross_7', label: 'Participates in playground activities without excessive clumsiness.' },
      { key: 'gross_8', label: 'Demonstrates body awareness (avoids bumping into objects frequently).' },
      { key: 'gross_9', label: 'Coordinates both sides of the body (e.g., skipping, hopping).' },
      { key: 'gross_10', label: 'Shows adequate muscle strength for age (e.g., lifting school bag).' }
    ]
  },
  {
    key: 'fine_motor',
    title: 'B. Fine Motor Skills',
    hasRemarks: false,
    items: [
      { key: 'fine_1', label: 'Holds pencil or crayon with appropriate grip.' },
      { key: 'fine_2', label: 'Copies basic shapes (circle, square, triangle).' },
      { key: 'fine_3', label: 'Writes letters or name legibly (age-appropriate).' },
      { key: 'fine_4', label: 'Uses scissors to cut along a line.' },
      { key: 'fine_5', label: 'Buttons/unbuttons clothing independently.' },
      { key: 'fine_6', label: 'Manipulates small objects (beads, coins) without dropping frequently.' },
      { key: 'fine_7', label: 'Colors within lines most of the time.' },
      { key: 'fine_8', label: 'Assembles puzzles appropriate for age.' },
      { key: 'fine_9', label: 'Demonstrates hand-eye coordination (e.g., tracing, drawing).' },
      { key: 'fine_10', label: 'Shows endurance during writing tasks (does not tire easily).' }
    ]
  },
  {
    key: 'perceptual',
    title: 'Perceptual Disturbances',
    hasRemarks: true,
    items: [
      { key: 'perceptual_1', label: 'Hallucination' },
      { key: 'perceptual_2', label: 'Delusions' }
    ]
  },
  {
    key: 'stimming',
    title: 'Stimming',
    hasRemarks: true,
    items: [
      { key: 'stimming_1', label: 'Verbal (echolalia, humming)' },
      { key: 'stimming_2', label: 'Auditory (sound sensitivity)' },
      { key: 'stimming_3', label: 'Visual (fixation to objects, constant eye movement)' },
      { key: 'stimming_4', label: 'Proprioceptive (jumping, crashing into objects)' },
      { key: 'stimming_5', label: 'Vestibular (rocking, spinning)' },
      { key: 'stimming_6', label: 'Oral (chewing, biting, sucking)' },
      { key: 'stimming_7', label: 'Tactile (excoriation, skin rubbing, fidgeting)' }
    ]
  }
];

let FO03_TEMPLATE_BYTES = null;
let FO03_TEMPLATE_DOC = null;

async function renderDynamicFO03Pdf({
  bundle,
  submission,
  normalizeBundle,
  parseJson,
  first,
  profileDisplayName,
  nameWithHonorific,
  requestingUser,
  isCtc
}) {
  const LONG_BOND_WIDTH = 612;
  const LONG_BOND_HEIGHT = 936;
  const MARGIN_LEFT = 50;
  const CONTENT_WIDTH = LONG_BOND_WIDTH - 2 * MARGIN_LEFT;

  if (!FO03_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templateImageBytes = await loadTemplateImageBytes('cmps-form-template.png');
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_WIDTH, LONG_BOND_HEIGHT]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_WIDTH, height: LONG_BOND_HEIGHT });
    FO03_TEMPLATE_BYTES = await tempPdf.save();
    FO03_TEMPLATE_DOC = await PDFDocument.load(FO03_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(FO03_TEMPLATE_BYTES);
  const [font, bold, boldItalic] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
    pdf.embedFont(StandardFonts.HelveticaBoldOblique),
  ]);

  let currentPage = pdf.getPages()[0];
  let pages = [currentPage];
  let cursorY = LONG_BOND_HEIGHT - 120;

  // ─── helpers ────────────────────────────────────────────────────────────────

  const drawFormNumber = (page) => {
    const label = 'CMPS:SE-FO-03 rev.0 02192026';
    page.drawText(label, {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize(label, 7),
      y: LONG_BOND_HEIGHT - 98,
      size: 7,
      font: bold,
      color: PURPLE
    });
  };

  const addPage = async () => {
    const [copiedPage] = await pdf.copyPages(FO03_TEMPLATE_DOC, [0]);
    pdf.addPage(copiedPage);
    currentPage = copiedPage;
    pages.push(currentPage);
    drawFormNumber(currentPage);
    cursorY = LONG_BOND_HEIGHT - 120;
  };

  function drawCheckMark(page, x, y, size, color) {
    const s = (size || 8) / 8;
    const cx = x - 1;
    // SVG coordinates in pdf-lib have origin at bottom-left, but the path itself draws relative to the x/y provided.
    // In SVG, y usually goes down, but in PDF it goes up. drawSvgPath handles it if we use standard SVG syntax (where Y goes down).
    // Let's use a simple path: M 0,4 L 3,7 L 8,1
    // And position it at x, y + size
    const path = 'M 0,4 L 3,7 L 8,1';
    
    page.drawSvgPath(path, {
      x: cx,
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
            charIdx++;
          }
          break;
        }
        broken += rest[charIdx];
        charIdx++;
      }
      chunks.push(broken);
      rest = rest.slice(charIdx);
    }
    return chunks;
  };

  const measureWrapped = (text, width, fnt, size) => {
    if (!text) return size * 1.4;
    const paragraphs = String(text).split(/\r?\n/);
    let totalLines = 0;
    let paragraphSpaces = Math.max(0, paragraphs.length - 1);
    
    for (const p of paragraphs) {
      if (!p.trim()) {
        totalLines += 1;
        continue;
      }
      const rawWords = p.split(' ');
      const words = [];
      for (const w of rawWords) {
        if (fnt.widthOfTextAtSize(w, size) > width) words.push(...chunkLongWord(w, width, fnt, size));
        else words.push(w);
      }
      let lines = 1, line = '';
      for (const word of words) {
        const test = line + word + ' ';
        if (fnt.widthOfTextAtSize(test, size) > width && line) { lines++; line = word + ' '; }
        else line = test;
      }
      totalLines += lines;
    }
    
    return Math.max(size * 1.4, totalLines * (size * 1.25) + (paragraphSpaces * size * 0.75) + 4);
  };

  const drawWrapped = (text, x, y, width, fnt, size, color) => {
    if (!text) return 1;
    const paragraphs = String(text).split(/\r?\n/);
    let cy = y;
    let totalLines = 0;
    let paragraphSpaces = Math.max(0, paragraphs.length - 1);
    
    for (const p of paragraphs) {
      if (!p.trim()) {
        cy -= size * 1.25;
        totalLines++;
        continue;
      }
      const rawWords = p.split(' ');
      const words = [];
      for (const w of rawWords) {
        if (fnt.widthOfTextAtSize(w, size) > width) words.push(...chunkLongWord(w, width, fnt, size));
        else words.push(w);
      }
      let line = '';
      let lines = 1;
      for (let i = 0; i < words.length; i++) {
        const test = line + words[i] + ' ';
        if (fnt.widthOfTextAtSize(test, size) > width && line) {
          currentPage.drawText(line.trimEnd(), { x, y: cy, size, font: fnt, color });
          line = words[i] + ' ';
          cy -= size * 1.25;
          lines++;
        } else line = test;
      }
      if (line.trimEnd()) {
        currentPage.drawText(line.trimEnd(), { x, y: cy, size, font: fnt, color });
        cy -= size * 1.25;
      }
      totalLines += lines;
      // Paragraph spacing
      cy -= size * 0.75;
    }
    return totalLines + (paragraphSpaces * 0.75); // return equivalent line count
  };

  // ─── two column-set definitions ─────────────────────────────────────────────
  // No-remarks layout (Conceptual, Social, Practical, Motor)
  const COLS_NO_REM = [
    { name: 'items', x: MARGIN_LEFT,       width: 380 },
    { name: 'yes',   x: MARGIN_LEFT + 380, width: 42  },
    { name: 'no',    x: MARGIN_LEFT + 422, width: 42  },
    { name: 'na',    x: MARGIN_LEFT + 464, width: CONTENT_WIDTH - 464 },
  ];
  // With-remarks layout (Perceptual, Stimming)
  const COLS_REM = [
    { name: 'items',   x: MARGIN_LEFT,       width: 200 },
    { name: 'yes',     x: MARGIN_LEFT + 200, width: 40  },
    { name: 'no',      x: MARGIN_LEFT + 240, width: 40  },
    { name: 'na',      x: MARGIN_LEFT + 280, width: 40  },
    { name: 'remarks', x: MARGIN_LEFT + 320, width: CONTENT_WIDTH - 320 },
  ];

  let activeCols = COLS_NO_REM; // tracks current column set

  // ─── draw table header ──────────────────────────────────────────────────────
  const drawTableHeader = async (cols) => {
    if (cursorY < 120) await addPage();
    const rowH = 22;

    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: cursorY - rowH,
      width: CONTENT_WIDTH, height: rowH,
      color: PURPLE, borderColor: PURPLE, borderWidth: 1,
    });
    for (let i = 1; i < cols.length; i++) {
      currentPage.drawLine({ start: { x: cols[i].x, y: cursorY }, end: { x: cols[i].x, y: cursorY - rowH }, thickness: 1, color: PURPLE });
    }

    const HEADERS = {
      items: 'Skills/Behaviors Observed',
      yes: 'Yes', no: 'No', na: 'N/A', remarks: 'Remarks'
    };
    for (const col of cols) {
      const label = HEADERS[col.name] || '';
      const lw = bold.widthOfTextAtSize(label, 9);
      currentPage.drawText(label, { x: col.x + col.width / 2 - lw / 2, y: cursorY - 14, size: 9, font: bold, color: WHITE });
    }
    cursorY -= rowH;
  };

  // ─── draw domain row ────────────────────────────────────────────────────────
  const drawDomain = (title) => {
    const domH = 18;
    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: cursorY - domH,
      width: CONTENT_WIDTH, height: domH,
      color: LIGHT_PURPLE, borderColor: PURPLE, borderWidth: 1
    });
    currentPage.drawText(title, { x: MARGIN_LEFT + 8, y: cursorY - 12, size: 9, font: bold, color: PURPLE });
    cursorY -= domH;
  };

  // ─── draw item row ──────────────────────────────────────────────────────────
  const drawItemRow = (cols, item, ans, remarksText, hasRemarks) => {
    const itemColW = cols[0].width - 8;
    const labelH = measureWrapped(item.label, itemColW, font, 8);
    const remH = hasRemarks ? measureWrapped(remarksText, (cols[4] || {}).width - 8 || 80, font, 8) : 0;
    const rowH = Math.max(labelH, remH, 16) + 8; // Added vertical padding

    // Border + column dividers
    currentPage.drawRectangle({
      x: MARGIN_LEFT, y: cursorY - rowH,
      width: CONTENT_WIDTH, height: rowH,
      borderColor: PURPLE, borderWidth: 0.75,
    });
    for (let i = 1; i < cols.length; i++) {
      currentPage.drawLine({ start: { x: cols[i].x, y: cursorY }, end: { x: cols[i].x, y: cursorY - rowH }, thickness: 0.75, color: PURPLE });
    }

    // Item label
    drawWrapped(item.label, cols[0].x + 5, cursorY - 14, itemColW, font, 8, INK);

    // Checkmarks
    const checkY = cursorY - rowH / 2 - 2;
    const yesCol = cols[1], noCol = cols[2], naCol = cols[3];
    if (ans === 'yes') drawCheckMark(currentPage, yesCol.x + yesCol.width / 2, checkY, 8, PURPLE);
    else if (ans === 'no') drawCheckMark(currentPage, noCol.x + noCol.width / 2, checkY, 8, PURPLE);
    else if (ans === 'na') drawCheckMark(currentPage, naCol.x + naCol.width / 2, checkY, 8, PURPLE);

    // Remarks (only for hasRemarks domains)
    if (hasRemarks && cols[4] && remarksText) {
      drawWrapped(remarksText, cols[4].x + 5, cursorY - 14, cols[4].width - 8, font, 8, INK);
    }

    cursorY -= rowH;
  };

  // ─── main content ──────────────────────────────────────────────────────────

  drawFormNumber(currentPage);

  const d = normalizeBundle(bundle);
  const patient = d.patient || {};
  const clinical = d.clinical || {};
  const content = parseJson(submission?.content) || {};
  const metadata = parseJson(submission?.metadata) || {};
  const rawAnswers = parseJson(submission?.answers) || {};

  // Answers can be stored in two formats:
  //   flat:   { conceptual_1: 'yes', conceptual_1_remarks: 'text' }
  //   nested: { conceptual_1: { response: 'yes', remarks: 'text' } }
  // Normalize to flat for consistent access.
  const answers = {};
  for (const [k, v] of Object.entries(rawAnswers)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      answers[k] = String(v.response || '').trim().toLowerCase();
      if (v.remarks) answers[`${k}_remarks`] = String(v.remarks);
    } else {
      answers[k] = String(v || '').trim().toLowerCase();
    }
  }

  // Age from DOB or stored age field
  const dobVal = patient.date_of_birth || '';
  let ageStr = patient.age ? String(patient.age) : '';
  if (!ageStr && dobVal) {
    const now = new Date();
    const dob = new Date(dobVal);
    if (!isNaN(dob)) {
      let age = now.getFullYear() - dob.getFullYear();
      const m = now.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
      ageStr = age >= 0 ? String(age) : '';
    }
  }
  const sexStr = patient.sex ? String(patient.sex).toUpperCase() : '';
  const dobDisplay = dobVal ? new Date(dobVal).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';

  // Title
  const titleStr = 'CAREGIVER BEHAVIORAL OBSERVATION CHECKLIST';
  currentPage.drawText(titleStr, {
    x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(titleStr, 13)) / 2,
    y: cursorY, size: 13, font: bold, color: PURPLE
  });
  cursorY -= 14;
  const subStr = 'SPECIAL EDUCATION PROGRAM';
  currentPage.drawText(subStr, {
    x: (LONG_BOND_WIDTH - font.widthOfTextAtSize(subStr, 10)) / 2,
    y: cursorY, size: 10, font: font, color: PURPLE
  });
  cursorY -= 22;

  // ─── header detail rows ─────────────────────────────────────────────────────
  const drawDetailRow = (label, value, xOffset = 110, indent = 10) => {
    // Label: not bold, PURPLE
    currentPage.drawText(label, { x: MARGIN_LEFT + indent, y: cursorY, size: 9, font: font, color: PURPLE });
    
    let lines = 1;
    if (value) {
      lines = drawWrapped(String(value), MARGIN_LEFT + xOffset + 3, cursorY, CONTENT_WIDTH - xOffset - 3, bold, 9, PURPLE);
    }
    
    // Draw underline for each line
    for (let i = 0; i < lines; i++) {
      currentPage.drawLine({
        start: { x: MARGIN_LEFT + xOffset, y: cursorY - (i * 9 * 1.25) - 2 },
        end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY - (i * 9 * 1.25) - 2 },
        thickness: 0.75, color: INK,
      });
    }

    cursorY -= (lines * 9 * 1.25) + 2.75;
  };

  // Date of Assessment: submitted_at > created_at > metadata field
  const toDateStr = (v) => {
    if (!v) return '';
    try { return new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
    catch { return ''; }
  };
  const assessmentDate = toDateStr(submission?.submitted_at)
    || toDateStr(submission?.created_at)
    || toDateStr(metadata?.date_of_assessment)
    || toDateStr(metadata?.assessment_date)
    || '';

  const ln = patient.last_name ? patient.last_name + ',' : '';
  const fn = patient.first_name || '';
  const mi = patient.middle_name ? patient.middle_name.charAt(0) + '.' : '';
  const fullNameStr = [ln, fn, mi].filter(Boolean).join(' ');

  drawDetailRow('Date', assessmentDate, 110, 0);

  currentPage.drawText('Personal Information of Student', { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: PURPLE });
  cursorY -= 14;

  drawDetailRow('Full Name (LN, FN MI)', fullNameStr);
  drawDetailRow('Birthday', dobDisplay);
  drawDetailRow('Age/Sex', [ageStr, sexStr].filter(Boolean).join('/'));

  // ─── Respondent block ───────────────────────────────────────────────────────
  // ─── Respondent block ───────────────────────────────────────────────────────
  currentPage.drawText('Respondent', { x: MARGIN_LEFT + 10, y: cursorY, size: 9, font: font, color: PURPLE });
  const respondents = ['Parent', 'Guardian', 'Teacher', 'Others:'];
  let rx = MARGIN_LEFT + 115;
  // respondent_relationship may be on submission directly or in metadata
  const rawRespondent = submission?.respondent_relationship || metadata?.respondent_relationship || '';
  const currentRespondent = rawRespondent.toLowerCase();
  // Known canonical values
  const knownRespondents = ['parent', 'guardian', 'teacher'];
  const isOthers = !knownRespondents.includes(currentRespondent) && currentRespondent;

  for (const resp of respondents) {
    const boxX = rx;
    currentPage.drawRectangle({ x: boxX, y: cursorY - 1, width: 9, height: 9, borderColor: INK, borderWidth: 1.5 });
    const isMatch = currentRespondent === resp.replace(':', '').toLowerCase() || (resp === 'Others:' && isOthers);
    if (isMatch) drawCheckMark(currentPage, boxX + 1, cursorY - 1, 9, PURPLE);
    currentPage.drawText(resp, { x: boxX + 13, y: cursorY, size: 9, font: font, color: INK });

    if (resp === 'Others:') {
      // Show a line after "Others:" label with the custom text if provided
      const labelW = font.widthOfTextAtSize('Others:', 9);
      const lineX = boxX + 13 + labelW + 5;
      currentPage.drawLine({ start: { x: lineX, y: cursorY - 2 }, end: { x: lineX + 110, y: cursorY - 2 }, thickness: 1.5, color: INK });
      if (isOthers) {
        currentPage.drawText(rawRespondent, { x: lineX + 3, y: cursorY, size: 9, font: bold, color: PURPLE });
      }
    }
    rx += font.widthOfTextAtSize(resp, 9) + 28;
  }
  cursorY -= 14;

  currentPage.drawText('Diagnosis', { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: PURPLE });
  cursorY -= 14;

  currentPage.drawText('Was the student previously diagnosed/assessed?', { x: MARGIN_LEFT + 10, y: cursorY, size: 9, font: font, color: INK });
  const isPreviouslyDiagnosed = metadata?.previously_diagnosed === true || metadata?.previously_diagnosed === 'true' || metadata?.previously_diagnosed === 'Yes';
  const isNotPreviouslyDiagnosed = metadata?.previously_diagnosed === false || metadata?.previously_diagnosed === 'false' || metadata?.previously_diagnosed === 'No';
  
  currentPage.drawRectangle({ x: MARGIN_LEFT + 250, y: cursorY - 1, width: 9, height: 9, borderColor: INK, borderWidth: 1.5 });
  if (isPreviouslyDiagnosed) drawCheckMark(currentPage, MARGIN_LEFT + 251, cursorY - 1, 9, PURPLE);
  currentPage.drawText('Yes', { x: MARGIN_LEFT + 263, y: cursorY, size: 9, font: font, color: INK });

  currentPage.drawRectangle({ x: MARGIN_LEFT + 300, y: cursorY - 1, width: 9, height: 9, borderColor: INK, borderWidth: 1.5 });
  if (isNotPreviouslyDiagnosed) drawCheckMark(currentPage, MARGIN_LEFT + 301, cursorY - 1, 9, PURPLE);
  currentPage.drawText('No', { x: MARGIN_LEFT + 313, y: cursorY, size: 9, font: font, color: INK });
  cursorY -= 14;

  drawDetailRow('Diagnosis', metadata?.diagnosis || clinical.working_diagnosis || '');
  // Blank histories print as "None" so the official record never shows an
  // ambiguous empty line (same rule as the MMSE PDF in formPdf.js).
  drawDetailRow('Medical History', String(metadata?.medical_history || clinical.medical_history || '').trim() || 'None');
  drawDetailRow('Family History', String(metadata?.family_history || clinical.family_history || '').trim() || 'None');
  cursorY -= 10;

  // ─── table ──────────────────────────────────────────────────────────────────

  // Draw initial no-remarks header
  await drawTableHeader(COLS_NO_REM);
  let currentColSet = COLS_NO_REM;

  for (const domain of BEHAV_STRUCTURE) {
    const needsRemarks = domain.hasRemarks;
    const cols = needsRemarks ? COLS_REM : COLS_NO_REM;

    // If we're switching column layouts, draw a new header
    if (cols !== currentColSet) {
      currentColSet = cols;
      // draw a divider then new header
      if (cursorY < 120) await addPage();
      await drawTableHeader(cols);
    }

    // Domain title row
    if (cursorY < 80) {
      await addPage();
      await drawTableHeader(currentColSet);
    }
    drawDomain(domain.title);

    for (const item of domain.items) {
      const ans = String(answers[item.key] || '').toLowerCase();
      const remarksText = needsRemarks ? (String(answers[`${item.key}_remarks`] || '')).trim() : '';

      // Measure row height
      const itemColW = cols[0].width - 8;
      const labelH = measureWrapped(item.label, itemColW, font, 8);
      const remH = needsRemarks ? measureWrapped(remarksText, (cols[4] || {}).width - 8 || 80, font, 8) : 0;
      const rowH = Math.max(labelH, remH, 16);

      if (cursorY - rowH < 80) {
        await addPage();
        await drawTableHeader(currentColSet);
        // redraw domain banner
        drawDomain(domain.title + ' (cont.)');
      }

      drawItemRow(cols, item, ans, remarksText, needsRemarks);
    }
  }

  // ─── commitment text + signatures (atomic block) ────────────────────────
  // Keep the attestation paragraph and the Prepared/Noted signatory block on
  // the same page so the signatures read as proof of the statement above.
  cursorY -= 20; // spacing after table
  const commitmentText = 'I understand that the information I provide during this interview is essential to the accuracy of my child’s behavioral assessment. I commit to giving complete, and accurate responses to the best of my knowledge. I acknowledge that my responses will be considered as part of the evaluation process to help ensure that the results reflect my child’s current functioning and needs.';
  const commitmentLines = [];
  let currentLine = '';
  for (const word of commitmentText.split(' ')) {
    if (boldItalic.widthOfTextAtSize(currentLine + word + ' ', 9) > CONTENT_WIDTH) {
      commitmentLines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  }
  commitmentLines.push(currentLine.trim());

  const blockHeight = commitmentLines.length * 12;
  // Reserve room for: commitment + gap before signatures + full signatory block
  // (~115pt: image 68 + overline offset + 3 text rows). If it doesn't all fit,
  // break BEFORE the commitment so both land together on a fresh page.
  const SIG_RESERVE = 155;
  if (cursorY - blockHeight - 40 - SIG_RESERVE < 80) await addPage();

  for (let i = 0; i < commitmentLines.length; i++) {
    const line = commitmentLines[i];
    // Simple justification logic (distribute extra space), except for the last line
    if (i < commitmentLines.length - 1) {
      const words = line.split(' ');
      const wordsWidth = words.reduce((sum, w) => sum + boldItalic.widthOfTextAtSize(w, 9), 0);
      const extraSpace = CONTENT_WIDTH - wordsWidth;
      const spacePerGap = words.length > 1 ? extraSpace / (words.length - 1) : 0;
      
      let xOffset = MARGIN_LEFT;
      for (let j = 0; j < words.length; j++) {
        currentPage.drawText(words[j], { x: xOffset, y: cursorY, size: 9, font: boldItalic, color: PURPLE });
        xOffset += boldItalic.widthOfTextAtSize(words[j], 9) + spacePerGap;
      }
    } else {
      // Left align the last line
      currentPage.drawText(line, { x: MARGIN_LEFT, y: cursorY, size: 9, font: boldItalic, color: PURPLE });
    }
    cursorY -= 12;
  }

  // ─── signatures (same page as commitment — reserved above) ──────────────
  cursorY -= 40; // Spacing before signatures
  // Safety net only; the atomic reserve above should already guarantee fit.
  // The signatory block extends ~115pt below the labels; break early so it
  // stays inside the template's printed content box.
  if (cursorY < 200) await addPage();
  const SIG_BLOCK_TOP = cursorY;

  const prepared = submission?.answered_profile || submission?.respondent_profile || patient.treating_psychometrician || {};
  const noted = submission?.reviewer_profile || patient.treating_psychologist || {};
  const preparedSig = first(submission?.answered_signature_image, submission?.respondent_signature_image);
  const notedSig = first(submission?.reviewer_signature_image, submission?.signed_by_signature_image);

  // Column widths for the two signatory boxes
  const SIG_COL_W = (CONTENT_WIDTH - 20) / 2;  // ~246 pts each
  const MAX_SIG_W = 190;
  const MAX_SIG_H = 68;

  const drawSignatory = async (profile, imgBase64, blockTopY, blockX, colW, title) => {
    const name = nameWithHonorific(first(profileDisplayName(profile), profile?.fallbackName), title);
    const license = first(profile?.license_no, profile?.prc_no, profile?.prc_number);

    // Signature image — centered horizontally within the column
    if (imgBase64) {
      try {
        const isJpg = imgBase64.startsWith('data:image/jpeg') || imgBase64.startsWith('data:image/jpg');
        const image = (await embedSignatureInk(pdf, imgBase64))
          || (isJpg ? await pdf.embedJpg(imgBase64) : await pdf.embedPng(imgBase64));
        const { width: iw, height: ih } = image.scale(1);
        const scale = Math.min(MAX_SIG_W / iw, MAX_SIG_H / ih, 1);
        const sw = iw * scale;
        const sh = ih * scale;
        // Centre the image horizontally, bottom just below the name baseline
        // so the signature overlaps the printed name like a wet signature.
        currentPage.drawImage(image, {
          x: blockX + (colW / 2) - (sw / 2),
          y: blockTopY - MAX_SIG_H - 32,
          width: sw,
          height: sh,
        });
      } catch (_) {}
    }

    // Overline just above the name
    const lineY = blockTopY - MAX_SIG_H - 4;
    currentPage.drawLine({
      start: { x: blockX, y: lineY },
      end: { x: blockX + colW, y: lineY },
      thickness: 0.75, color: PURPLE,
    });

    // Title label (normal) + Name (bold, purple)
    const titleLabel = `${title}: `;
    const titleLabelW = font.widthOfTextAtSize(titleLabel, 9);
    currentPage.drawText(titleLabel, { x: blockX, y: lineY - 10, size: 9, font: font, color: INK });
    currentPage.drawText(name || '', { x: blockX + titleLabelW, y: lineY - 10, size: 9, font: bold, color: PURPLE });

    // License
    if (license) {
      const licLabel = 'License Number: ';
      const licLabelW = font.widthOfTextAtSize(licLabel, 9);
      currentPage.drawText(licLabel, { x: blockX, y: lineY - 22, size: 9, font: font, color: INK });
      currentPage.drawText(String(license), { x: blockX + licLabelW, y: lineY - 22, size: 9, font: font, color: INK });
    }

    // Date
    const dateLabel = 'Date: ';
    const dateLabelW = font.widthOfTextAtSize(dateLabel, 9);
    currentPage.drawText(dateLabel, { x: blockX, y: lineY - 34, size: 9, font: font, color: INK });
    currentPage.drawText(assessmentDate || '', { x: blockX + dateLabelW, y: lineY - 34, size: 9, font: font, color: INK });
  };

  // Header labels
  const prepX = MARGIN_LEFT;
  const notX = MARGIN_LEFT + SIG_COL_W + 20;

  currentPage.drawText('Prepared by:', { x: prepX, y: SIG_BLOCK_TOP, size: 9, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: notX, y: SIG_BLOCK_TOP, size: 9, font: bold, color: INK });

  await drawSignatory({ ...prepared, fallbackName: content?.evaluatorName }, preparedSig, SIG_BLOCK_TOP - 2, prepX, SIG_COL_W, 'Psychometrician');
  await drawSignatory({ ...noted, fallbackName: d.representativeName }, notedSig, SIG_BLOCK_TOP - 2, notX, SIG_COL_W, 'Psychologist');

  // ─── page numbers ───────────────────────────────────────────────────────────
  pages.forEach((pg, idx) => {
    const txt = `Page ${idx + 1} of ${pages.length}`;
    pg.drawText(txt, {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize(txt, 9),
      y: 52,
      size: 9, font: bold, color: PURPLE,
    });
  });

  // Preview watermark (who generated this copy) on every non-CTC render.
  await applyPreviewWatermark(pdf, requestingUser, isCtc);

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

module.exports = { renderDynamicFO03Pdf };
