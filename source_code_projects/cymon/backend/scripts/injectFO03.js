const fs = require('fs');

const path = 'backend/lib/formPdf.js';
let content = fs.readFileSync(path, 'utf8');

const fo03Implementation = `
const BEHAV_STRUCTURE = [
  {
    key: 'conceptual',
    title: 'I. Conceptual Domain',
    items: [
      { key: 'conceptual_1', label: 'States full name, age, and identifies parents when asked.' },
      { key: 'conceptual_2', label: 'Follows two-step instructions (e.g., "Pick up your bag and sit down") without repeated prompting.' },
      { key: 'conceptual_3', label: 'Answers WH-questions (who, what, where, why) appropriately in simple conversations.' },
      { key: 'conceptual_4', label: 'Identifies and names common objects and their use (e.g. spoon is for eating).' },
      { key: 'conceptual_5', label: 'Recognizes letters, numbers, colors, or shapes appropriate to age level.' },
      { key: 'conceptual_6', label: 'Can count objects correctly and perform simple math (if age-appropriate).' },
      { key: 'conceptual_7', label: 'Understands time concepts (today, yesterday, tomorrow) and daily schedule.' },
      { key: 'conceptual_8', label: 'Expresses needs, thoughts, and feelings using understandable words or gestures.' },
      { key: 'conceptual_9', label: 'Maintains attention on structured task for at least 10–15 minutes (age-appropriate).' },
      { key: 'conceptual_10', label: 'Demonstrates understanding of cause and effect (e.g., "If I run, I might fall").' },
      { key: 'conceptual_11', label: 'Understands simple problem-solving (e.g., finds alternative if toy is unavailable).' },
      { key: 'conceptual_12', label: 'Reads simple words or sentences (if school-aged).' }
    ]
  },
  {
    key: 'social',
    title: 'II. Social Domain',
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
    items: [
      { key: 'perceptual_1', label: 'Hallucination' },
      { key: 'perceptual_2', label: 'Delusions' }
    ]
  },
  {
    key: 'stimming',
    title: 'Stimming',
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

async function renderDynamicFO03Pdf({ bundle, submission, requestingUser, isCtc }) {
  const LONG_BOND_WIDTH = 612;
  const LONG_BOND_HEIGHT = 936;
  const MARGIN_LEFT = 50;
  const CONTENT_WIDTH = LONG_BOND_WIDTH - 2 * MARGIN_LEFT;

  if (!FO03_TEMPLATE_BYTES) {
    const tempPdf = await PDFDocument.create();
    const templatePath = path.resolve(__dirname, '../../frontend/public/cmps-form-template.png');
    const templateImageBytes = await fs.readFile(templatePath);
    const templateImage = await tempPdf.embedPng(templateImageBytes);
    const page = tempPdf.addPage([LONG_BOND_WIDTH, LONG_BOND_HEIGHT]);
    page.drawImage(templateImage, { x: 0, y: 0, width: LONG_BOND_WIDTH, height: LONG_BOND_HEIGHT });
    FO03_TEMPLATE_BYTES = await tempPdf.save();
    FO03_TEMPLATE_DOC = await PDFDocument.load(FO03_TEMPLATE_BYTES);
  }

  const pdf = await PDFDocument.load(FO03_TEMPLATE_BYTES);
  const [font, bold] = await Promise.all([
    pdf.embedFont(StandardFonts.Helvetica),
    pdf.embedFont(StandardFonts.HelveticaBold),
  ]);

  let currentPage = pdf.getPages()[0];
  let pages = [currentPage];
  let cursorY = LONG_BOND_HEIGHT - 120;

  const drawFormNumber = (page) => {
    page.drawText('CMPS:SE-FO-03 rev.0 02192026', {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize('CMPS:SE-FO-03 rev.0 02192026', 7),
      y: LONG_BOND_HEIGHT - 98,
      size: 8,
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

  drawFormNumber(currentPage);

  const d = normalizeBundle(bundle);
  const p = d.patient || {};
  const c = d.clinical || {};
  const content = parseJson(submission?.content) || {};
  const metadata = parseJson(submission?.metadata) || {};
  const answers = parseJson(submission?.answers) || {};

  const titleStr = 'CAREGIVER BEHAVIORAL OBSERVATION CHECKLIST';
  currentPage.drawText(titleStr, { x: (LONG_BOND_WIDTH - bold.widthOfTextAtSize(titleStr, 14)) / 2, y: cursorY, size: 14, font: bold, color: PURPLE });
  cursorY -= 15;
  const subtitleStr = 'SPECIAL EDUCATION PROGRAM';
  currentPage.drawText(subtitleStr, { x: (LONG_BOND_WIDTH - font.widthOfTextAtSize(subtitleStr, 10)) / 2, y: cursorY, size: 10, font: font, color: PURPLE });
  
  cursorY -= 30;

  // Header Details
  const details = [
    { label: 'Name of the Child:', value: d.patientName },
    { label: 'Age/Sex:', value: \`\${d.age || ''} / \${d.sex || ''}\` },
    { label: 'Date of Birth:', value: d.date_of_birth },
    { label: 'Date of Assessment:', value: submission?.submitted_at ? new Date(submission.submitted_at).toLocaleDateString() : '' },
    { label: 'Diagnosis:', value: metadata?.diagnosis || c.working_diagnosis || '' },
    { label: 'Medical History:', value: metadata?.medical_history || c.medical_history || '' },
    { label: 'Family History:', value: metadata?.family_history || c.family_history || '' },
  ];

  for (const row of details) {
    if (cursorY < 100) await addPage();
    currentPage.drawText(row.label, { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: INK });
    currentPage.drawText(String(row.value || ''), { x: MARGIN_LEFT + 120, y: cursorY, size: 10, font: font, color: INK });
    
    // Draw underline
    currentPage.drawLine({
      start: { x: MARGIN_LEFT + 115, y: cursorY - 2 },
      end: { x: MARGIN_LEFT + CONTENT_WIDTH, y: cursorY - 2 },
      thickness: 1,
      color: INK,
    });
    cursorY -= 15;
  }
  
  cursorY -= 5;
  
  // Respondent Block
  currentPage.drawText('Respondent:', { x: MARGIN_LEFT, y: cursorY, size: 10, font: bold, color: INK });
  const respondents = ['Parent', 'Guardian', 'Teacher', 'Others'];
  let rx = MARGIN_LEFT + 120;
  
  const currentRespondent = (submission?.respondent_relationship || '').toLowerCase();
  
  for (const resp of respondents) {
    // Checkbox
    currentPage.drawRectangle({ x: rx, y: cursorY - 1, width: 10, height: 10, borderColor: INK, borderWidth: 1 });
    if (currentRespondent === resp.toLowerCase() || (resp === 'Others' && !['parent', 'guardian', 'teacher'].includes(currentRespondent) && currentRespondent)) {
        drawCheckMark(currentPage, rx + 1, cursorY - 1, 10, INK);
    }
    currentPage.drawText(resp, { x: rx + 15, y: cursorY, size: 10, font: font, color: INK });
    
    if (resp === 'Others') {
        rx += 55;
        currentPage.drawLine({
          start: { x: rx, y: cursorY - 2 },
          end: { x: rx + 100, y: cursorY - 2 },
          thickness: 1,
          color: INK,
        });
        if (!['parent', 'guardian', 'teacher'].includes(currentRespondent) && currentRespondent) {
            currentPage.drawText(currentRespondent, { x: rx + 5, y: cursorY, size: 10, font: font, color: INK });
        }
    }
    
    rx += 70;
  }
  
  cursorY -= 25;

  const cols = [
    { name: 'items', x: MARGIN_LEFT, width: 250 },
    { name: 'yes', x: MARGIN_LEFT + 250, width: 40 },
    { name: 'no', x: MARGIN_LEFT + 290, width: 40 },
    { name: 'na', x: MARGIN_LEFT + 330, width: 40 },
    { name: 'remarks', x: MARGIN_LEFT + 370, width: CONTENT_WIDTH - 370 },
  ];

  const measureTextWrapped = (text, width, fnt, size) => {
    if (!text) return size * 1.5;
    const words = String(text).split(' ');
    let lines = 1;
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const testWidth = fnt.widthOfTextAtSize(testLine, size);
      if (testWidth > width && i > 0) {
        lines++;
        line = words[i] + ' ';
      } else {
        line = testLine;
      }
    }
    return Math.max(size * 1.5, lines * (size * 1.2) + 6);
  };

  const drawTextWrapped = (text, x, y, width, fnt, size, color) => {
    if (!text) return 0;
    const words = String(text).split(' ');
    let line = '';
    let currentY = y;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const testWidth = fnt.widthOfTextAtSize(testLine, size);
      if (testWidth > width && i > 0) {
        currentPage.drawText(line, { x, y: currentY, size, font: fnt, color });
        line = words[i] + ' ';
        currentY -= size * 1.2;
      } else {
        line = testLine;
      }
    }
    currentPage.drawText(line, { x, y: currentY, size, font: fnt, color });
    return y - currentY;
  };

  const drawRowLines = (y, height) => {
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: y - height,
      width: CONTENT_WIDTH,
      height: height,
      borderColor: PURPLE,
      borderWidth: 1,
    });
    for (let i = 1; i < cols.length; i++) {
      currentPage.drawLine({
        start: { x: cols[i].x, y: y },
        end: { x: cols[i].x, y: y - height },
        thickness: 1,
        color: PURPLE,
      });
    }
  };

  const drawTableHeader = async () => {
    if (cursorY < 120) await addPage();
    const rowHeight = 25;
    
    currentPage.drawRectangle({
      x: MARGIN_LEFT,
      y: cursorY - rowHeight,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: PURPLE,
      borderColor: PURPLE,
      borderWidth: 1,
    });
    
    for (let i = 1; i < cols.length; i++) {
      currentPage.drawLine({
        start: { x: cols[i].x, y: cursorY },
        end: { x: cols[i].x, y: cursorY - rowHeight },
        thickness: 1,
        color: PURPLE,
      });
    }

    const headers = [
      { text: 'Skills/Behaviors observed', x: cols[0].x, w: cols[0].width },
      { text: 'Yes', x: cols[1].x, w: cols[1].width },
      { text: 'No', x: cols[2].x, w: cols[2].width },
      { text: 'N/A', x: cols[3].x, w: cols[3].width },
      { text: 'Remarks', x: cols[4].x, w: cols[4].width },
    ];
    for (const h of headers) {
      const hw = bold.widthOfTextAtSize(h.text, 10);
      currentPage.drawText(h.text, {
        x: h.x + h.w / 2 - hw / 2,
        y: cursorY - 16,
        size: 10,
        font: bold,
        color: WHITE,
      });
    }
    cursorY -= rowHeight;
  };

  // Draw table header for first time
  await drawTableHeader();

  for (const domain of BEHAV_STRUCTURE) {
    if (cursorY < 80) {
        await addPage();
        await drawTableHeader();
    }
    
    const domainHeight = 20;
    currentPage.drawRectangle({
        x: MARGIN_LEFT,
        y: cursorY - domainHeight,
        width: CONTENT_WIDTH,
        height: domainHeight,
        color: rgb(0.9, 0.85, 0.95),
        borderColor: PURPLE,
        borderWidth: 1
    });
    currentPage.drawText(domain.title, {
        x: MARGIN_LEFT + 10,
        y: cursorY - 14,
        size: 10,
        font: bold,
        color: PURPLE
    });
    cursorY -= domainHeight;

    for (const item of domain.items) {
      const remarksText = answers[\`\${item.key}_remarks\`] || '';
      const labelHeight = measureTextWrapped(item.label, cols[0].width - 10, font, 9);
      const remHeight = measureTextWrapped(remarksText, cols[4].width - 10, font, 9);
      const rowHeight = Math.max(labelHeight, remHeight, 20);
      
      if (cursorY - rowHeight < 80) {
        await addPage();
        await drawTableHeader();
      }

      drawRowLines(cursorY, rowHeight);

      // Label
      drawTextWrapped(item.label, cols[0].x + 5, cursorY - 12, cols[0].width - 10, font, 9, INK);

      // Checkmarks
      const ans = answers[item.key];
      if (ans === 'yes') {
          drawCheckMark(currentPage, cols[1].x + 15, cursorY - 14, 10, PURPLE);
      } else if (ans === 'no') {
          drawCheckMark(currentPage, cols[2].x + 15, cursorY - 14, 10, PURPLE);
      } else if (ans === 'na') {
          drawCheckMark(currentPage, cols[3].x + 15, cursorY - 14, 10, PURPLE);
      }

      // Remarks
      if (remarksText) {
          drawTextWrapped(remarksText, cols[4].x + 5, cursorY - 12, cols[4].width - 10, font, 9, INK);
      }

      cursorY -= rowHeight;
    }
  }

  // Draw signatures
  if (cursorY < 150) await addPage();
  cursorY -= 30;

  const prepared = submission?.answered_profile || submission?.respondent_profile || p.treating_psychometrician || {};
  const noted = submission?.reviewer_profile || p.treating_psychologist || {};

  const preparedSignature = first(submission?.answered_signature_image, submission?.respondent_signature_image);
  const notedSignature = first(submission?.reviewer_signature_image, submission?.signed_by_signature_image);

  const drawSignatory = async (profile, imgBase64, textY, xOffset, fallbackTitle) => {
    if (imgBase64) {
      try {
        const image = imgBase64.startsWith('data:image/png')
          ? await pdf.embedPng(imgBase64)
          : await pdf.embedJpg(imgBase64);
        const dims = image.scale(0.25);
        currentPage.drawImage(image, {
          x: xOffset,
          y: textY,
          width: dims.width,
          height: dims.height,
        });
      } catch (e) { }
    }
    const name = nameWithHonorific(first(profileDisplayName(profile), profile.fallbackName), fallbackTitle);
    const license = first(profile.license_no, profile.prc_no, profile.prc_number);
    const profession = fallbackTitle;

    currentPage.drawText(\`\${profession}:\`, { x: xOffset, y: textY - 5, size: 10, font: font, color: INK });
    const profWidth = font.widthOfTextAtSize(\`\${profession}: \`, 10);
    currentPage.drawText(name, { x: xOffset + profWidth, y: textY - 5, size: 10, font: bold, color: PURPLE });

    if (license) {
      const labelStr = 'License Number: ';
      currentPage.drawText(labelStr, { x: xOffset, y: textY - 17, size: 10, font: font, color: INK });
      const labelWidth = font.widthOfTextAtSize(labelStr, 10);
      currentPage.drawText(String(license), { x: xOffset + labelWidth, y: textY - 17, size: 10, font: font, color: INK });
    }
  };

  const prepX = MARGIN_LEFT;
  const notX = MARGIN_LEFT + 270;
  const nameY = cursorY - 40;
  
  currentPage.drawText('Prepared by:', { x: prepX, y: cursorY, size: 10, font: bold, color: INK });
  currentPage.drawText('Noted by:', { x: notX, y: cursorY, size: 10, font: bold, color: INK });

  await drawSignatory({ ...prepared, fallbackName: content?.evaluatorName }, preparedSignature, nameY, prepX, 'Psychometrician');
  await drawSignatory({ ...noted, fallbackName: d.representativeName }, notedSignature, nameY, notX, 'Psychologist');

  // Page Numbers
  pages.forEach((p, idx) => {
    const text = \`Page \${idx + 1} of \${pages.length}\`;
    p.drawText(text, {
      x: LONG_BOND_WIDTH - MARGIN_LEFT - bold.widthOfTextAtSize(text, 10),
      y: 50,
      size: 10,
      font: bold,
      color: PURPLE,
    });
  });

  // Apply Watermarks
  if (!isCtc && requestingUser) {
    const { width, height } = currentPage.getSize();
    const userStr = \`Downloaded by: \${requestingUser.display_name || 'User'} (\${requestingUser.email || ''})\`;
    const dateStr = \`\${new Date().toLocaleString()}\`;

    // Tile diagonally with generous spacing so each group of 3 lines is readable
    const rowSpacingY = 220;
    const colSpacingX = 200;
    const { degrees } = require('pdf-lib');
    
    pages.forEach(p => {
        for (let row = -1; row < Math.ceil(height / rowSpacingY) + 2; row++) {
          for (let col = -1; col < Math.ceil(width / colSpacingX) + 2; col++) {
            const baseX = col * colSpacingX + (row % 2 === 0 ? 0 : colSpacingX / 2);
            const baseY = row * rowSpacingY;

            p.drawText('CONFIDENTIAL - DO NOT DISTRIBUTE', {
              x: baseX,
              y: baseY + 44,
              size: 13,
              opacity: 0.25,
              rotate: degrees(45),
            });
            p.drawText(userStr, {
              x: baseX,
              y: baseY + 22,
              size: 8,
              opacity: 0.25,
              rotate: degrees(45),
            });
            p.drawText(dateStr, {
              x: baseX,
              y: baseY,
              size: 8,
              opacity: 0.25,
              rotate: degrees(45),
            });
          }
        }
    });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
`;

// Insert the implementation
if (!content.includes('function renderDynamicFO03Pdf')) {
    content = content.replace('let MMSE_TEMPLATE_BYTES = null;', fo03Implementation + '\\nlet MMSE_TEMPLATE_BYTES = null;');
}

// Hook it up in renderFormPdf
const hook = `  if (code === 'CMPS:SE-FO-03') {
    return await renderDynamicFO03Pdf({ bundle, submission, requestingUser, isCtc });
  }
  if (code === 'CMPS:SE-FO-04') {`;

if (!content.includes("code === 'CMPS:SE-FO-03'") || !content.includes('return await renderDynamicFO03Pdf')) {
    content = content.replace("  if (code === 'CMPS:SE-FO-04') {", hook);
}

fs.writeFileSync(path, content, 'utf8');
console.log('Modified formPdf.js successfully.');
