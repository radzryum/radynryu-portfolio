// Manual positioning for the CMPS behavioral assessment PDFs. Coordinates use
// the source PDF's point system: x increases from left to right and y
// increases from bottom to top.
//
// Adjust offsetX/offsetY to move a whole content group. Adjust an individual
// x/y value when only one field, checkbox, row, or signature needs to move.

const FO03_LAYOUT = {
  page1: {
    offsetX: 0,
    offsetY: 0,
    fields: {
      assessmentDate: { x: 220, y: 671, width: 200, size: 11, minSize: 8 },
      studentName: { x: 220, y: 639, width: 290, size: 11, minSize: 8 },
      studentDob: { x: 220, y: 624, width: 290, size: 11, minSize: 8 },
      studentAgeSex: { x: 220, y: 609, width: 290, size: 11, minSize: 8 },
      diagnosis: { x: 220, y: 549, width: 290, size: 11, minSize: 8 },
      medicalHistory: { x: 220, y: 534, width: 290, size: 11, minSize: 8 },
      familyHistory: { x: 220, y: 519, width: 290, size: 11, minSize: 8 },
      otherRespondent: { x: 442, y: 591, width: 105, size: 11, minSize: 8 },
    },
    respondentChecks: {
      parent: { x: 221.8, y: 591.5 },
      guardian: { x: 273, y: 591.5 },
      teacher: { x: 335.7, y: 591.5 },
      others: { x: 392, y: 592 },
    },
    diagnosisChecks: {
      yes: { x: 378.5, y: 562 },
      no: { x: 432, y: 561 },
      na: { x: 486, y: 562, width: 40, size: 6.5 },
    },
  },

  // Each y value belongs to the corresponding key in the same page's keys
  // array. These values are intentionally exposed so every checklist row can
  // be moved independently when the source template changes.
  answerPages: {
    0: {
      offsetX: 0,
      offsetY: 0,
      keys: Array.from({ length: 12 }, (_, i) => `conceptual_${i + 1}`),
      y: [376.9, 344.3, 311.7, 283.9, 255.9, 228.0, 200.2, 172.5, 144.7, 117.0, 89.2, 61.5],
      columns: { yes: 480, no: 512, na: 545 },
    },
    1: {
      offsetX: 0,
      offsetY: 0,
      keys: [
        ...Array.from({ length: 13 }, (_, i) => `social_${i + 1}`),
        ...Array.from({ length: 6 }, (_, i) => `practical_${i + 1}`),
      ],
      y: [617.1, 589.3, 561.6, 533.6, 505.7, 477.9, 450.2, 422.4, 394.7, 366.9, 339.2, 311.2, 283.2, 202.8, 175.0, 147.1, 119.1, 91.4, 63.6],
      columns: { yes: 469, no: 502, na: 537 },
    },
    2: {
      offsetX: 0,
      offsetY: 0,
      keys: [
        ...Array.from({ length: 6 }, (_, i) => `practical_${i + 7}`),
        ...Array.from({ length: 10 }, (_, i) => `gross_${i + 1}`),
        ...Array.from({ length: 2 }, (_, i) => `fine_${i + 1}`),
      ],
      y: [644.8, 617.1, 589.3, 561.4, 533.4, 505.7, 425.5, 397.8, 370.0, 342.3, 314.3, 286.3, 258.5, 230.8, 203.0, 175.3, 94.8, 66.9],
      columns: { yes: 467, no: 501, na: 537 },
      removeNaRange: [6, 16],
    },
    3: {
      offsetX: 0,
      offsetY: 0,
      keys: [
        ...Array.from({ length: 8 }, (_, i) => `fine_${i + 3}`),
        ...Array.from({ length: 2 }, (_, i) => `perceptual_${i + 1}`),
        ...Array.from({ length: 7 }, (_, i) => `stimming_${i + 1}`),
      ],
      y: [645.0, 617.2, 589.5, 561.5, 533.5, 505.8, 478.0, 450.3, 398.2, 378.7, 330.3, 310.8, 291.3, 271.8, 252.3, 232.8, 213.3],
      columns: { yes: 466, no: 500, na: 536 },
      remarksFrom: 8,
      remarks: 380,
      remarksWidth: 175,
      removeNaFrom: 8,
      remarksYes: 326,
      remarksNo: 358,
    },
  },

  page4: {
    offsetX: 0,
    offsetY: 0,
    signatures: {
      respondent: { x: 50, y: 100, width: 245, height: 60 },
      reviewer: { x: 319, y: 100, width: 245, height: 60 },
    },
    signatureLines: {
      respondent: { x: 60, y: 120, width: 257, size: 10, minSize: 7 },
      reviewer: { x: 313, y: 120, width: 257, size: 10, minSize: 7 },
    },
  },
};

const FO04_LAYOUT = {
  page1: {
    offsetX: 0,
    offsetY: 0,
    fields: {
      assessmentDate: { x: 224, y: 682, width: 190, size: 12 },
      studentName: { x: 224, y: 649, width: 290, size: 12 },
      studentAgeSex: { x: 224, y: 634, width: 290, size: 12 },
      studentDob: { x: 224, y: 619, width: 290, size: 12 },
      diagnosis: { x: 224, y: 571, width: 290, size: 12 },
      medicalHistory: { x: 224, y: 556, width: 290, size: 12 },
      familyHistory: { x: 224, y: 541, width: 290, size: 12 },
      previouslyDiagnosedNa: { x: 488, y: 586, width: 40, size: 12 },
    },
    previouslyDiagnosedChecks: {
      yes: { x: 381.5, y: 584.5 },
      no: { x: 435, y: 585 },
    },
  },

  // Each y value belongs to the corresponding key in the same page's keys
  // array. Change a single y value to move only that response row.
  answerPages: {
    0: {
      offsetX: 0,
      offsetY: 0,
      size: 12,
      keys: [
        'practical_a1', 'practical_b1', 'practical_b2', 'practical_b3', 'practical_b4',
        'conceptual_a1', 'conceptual_a2', 'conceptual_b1', 'conceptual_b2',
        'conceptual_c1', 'conceptual_c2', 'conceptual_d1', 'conceptual_d2', 'conceptual_e1', 'conceptual_e2',
      ],
      y: [471.1, 432.1, 412.6, 393.1, 373.6, 312.1, 292.5, 253.5, 234.0, 195.0, 175.5, 136.5, 117.0, 78.0, 58.5],
      columns: { yes: 322, no: 347, na: 374, remarks: 395, remarksWidth: 166 },
    },
    1: {
      offsetX: 0,
      offsetY: 0,
      size: 12,
      keys: [
        ...Array.from({ length: 5 }, (_, i) => `social_a${i + 1}`),
        ...Array.from({ length: 5 }, (_, i) => `bodily_a${i + 1}`),
        ...Array.from({ length: 4 }, (_, i) => `bodily_b${i + 1}`),
        'perceptual_1', 'perceptual_2',
        ...Array.from({ length: 7 }, (_, i) => `stimming_${i + 1}`),
      ],
      y: [647.4, 627.9, 608.4, 588.9, 569.4, 511.4, 491.9, 472.4, 452.9, 433.4, 394.4, 374.9, 355.4, 335.9, 291.5, 272.0, 226.8, 207.3, 187.8, 168.3, 148.8, 129.3, 109.8],
      columns: { yes: 322, no: 347, na: 374, remarks: 395, remarksWidth: 166 },
      removeNaFrom: 16,
      remarksYes: 325,
      remarksNo: 370,
      remarks: 395,
    },
  },

  page2: {
    offsetX: 0,
    offsetY: 0,
    signature: { x: 195, y: 38, width: 220, height: 45 },
    signatoryLine: { x: 179, y: 65, width: 256, size: 10.5 },
  },
};

const FO05_LAYOUT = {
  // The current FO-05 source is portrait 540x720. Coordinates are kept in the
  // source PDF's native point system so each field/cell can be adjusted by eye.
  page1: {
    fields: {
      // The source uses printed underline glyphs. Keep entered values above
      // those rules instead of drawing directly on top of them.
      assessmentDate: { x: 199, y: 615, width: 198, size: 11, minSize: 8 },
      studentName: { x: 199, y: 579, width: 198, size: 11, minSize: 8 },
      ageGender: { x: 199, y: 562, width: 198, size: 11, minSize: 8 },
      guardianName: { x: 199, y: 544, width: 198, size: 11, minSize: 8 },
      assessorName: { x: 199, y: 525, width: 198, size: 11, minSize: 8 },
      assessorSignature: { x: 332, y: 524, width: 72, height: 14 },
    },
    interpretations: [
      { key: 'math_colors', x: 241, width: 255, top: 493, bottom: 470, maxLines: 2 },
      { key: 'math_shapes', x: 241, width: 255, top: 470, bottom: 447, maxLines: 2 },
      { key: 'math_numbers_value', x: 241, width: 255, top: 447, bottom: 423, maxLines: 2 },
      { key: 'math_word_recognition', x: 241, width: 255, top: 423, bottom: 400, maxLines: 2 },
      { key: 'literacy_uppercase', x: 241, width: 255, top: 376, bottom: 353, maxLines: 2 },
      { key: 'literacy_lowercase', x: 241, width: 255, top: 353, bottom: 329, maxLines: 2 },
      { key: 'literacy_letter_sounds', x: 241, width: 255, top: 329, bottom: 306, maxLines: 2 },
      { key: 'literacy_cvc_words', x: 241, width: 255, top: 282, bottom: 259, maxLines: 2 },
      { key: 'literacy_action_words', x: 241, width: 255, top: 259, bottom: 235, maxLines: 2 },
      { key: 'literacy_describing_words', x: 241, width: 255, top: 235, bottom: 212, maxLines: 2 },
      { key: 'literacy_prepositions', x: 241, width: 255, top: 212, bottom: 189, maxLines: 2 },
      { key: 'writing_name_recognition_interpretation', x: 241, width: 255, top: 162, bottom: 139, maxLines: 2 },
      { key: 'writing_write_name_interpretation', x: 241, width: 255, top: 139, bottom: 115, maxLines: 2 },
      { key: 'writing_spell_name_interpretation', x: 241, width: 255, top: 116, bottom: 92, maxLines: 2 },
    ],
    selections: {
      writing_name_recognition: {
        yes: { x: 158, y: 140, width: 35, height: 21, label: 'YES', textY: 145 },
        no: { x: 196, y: 140, width: 40, height: 21, label: 'NO', textY: 145 },
      },
      writing_write_name: {
        yes: { x: 158, y: 117, width: 35, height: 21, label: 'YES', textY: 122 },
        no: { x: 196, y: 117, width: 40, height: 21, label: 'NO', textY: 122 },
      },
      writing_spell_name: {
        yes: { x: 158, y: 93, width: 35, height: 21, label: 'YES', textY: 99 },
        no: { x: 196, y: 93, width: 40, height: 21, label: 'NO', textY: 99 },
      },
    },
  },
  page2: {
    interpretations: [
      { key: 'writing_dominant_hand_interpretation', x: 339, width: 165, top: 592, bottom: 560, maxLines: 2 },
      { key: 'writing_pencil_grip_interpretation', x: 339, width: 165, top: 561, bottom: 529, maxLines: 2 },
    ],
    reviewerComment: { labelX: 44, textX: 153, y: 490, width: 351, maxLines: 3 },
    // The updated FO-05 template includes Prepared by / Noted by signatory
    // fields below the writing table. Coordinates are in the source PDF's
    // native 540 x 720 point system.
    signatories: {
      prepared: {
        signature: { x: 35, y: 440, width: 150, height: 60 },
        name: { x: 117, y: 436, width: 145, size: 10, minSize: 7 },
        license: { x: 115, y: 422, width: 145, size: 10, minSize: 7 },
      },
      noted: {
        signature: { x: 287, y: 440, width: 150, height: 60 },
        name: { x: 350, y: 437, width: 145, size: 10, minSize: 7 },
        license: { x: 365, y: 422, width: 130, size: 10, minSize: 7 },
      },
    },
    selections: {
      writing_dominant_hand: {
        left: { x: 109, y: 560, width: 46, height: 31, label: 'LEFT', textY: 576 },
        right: { x: 158, y: 560, width: 115, height: 31, label: 'RIGHT', textY: 576 },
        both: { x: 276, y: 560, width: 57, height: 31, label: 'BOTH', textY: 576 },
      },
      writing_pencil_grip: {
        fisted: { x: 109, y: 529, width: 46, height: 29, label: 'FISTED', textY: 543 },
        four_finger: { x: 158, y: 529, width: 58, height: 29, label: '4-FINGER', textY: 543 },
        static_tripod: { x: 220, y: 529, width: 53, height: 29, lines: ['STATIC', 'TRIPOD'], textY: 543, lineHeight: 13 },
        dynamic_tripod: { x: 276, y: 529, width: 57, height: 29, lines: ['DYNAMIC', 'TRIPOD'], textY: 543, lineHeight: 13 },
      },
    },
  },
};

const FO06_LAYOUT = {
  // The supplied FO-06 template is letter size (612 x 792), so these are
  // native PDF coordinates with the origin at the bottom-left.
  page1: {
    pageNumber: { x: 515, y: 8, width: 58, size: 6.2 },
    personal: {
      fullName: { x: 241, y: 620, width: 267, size: 8 },
      birthdate: { x: 241, y: 608, width: 267, size: 8 },
      ageSex: { x: 241, y: 596, width: 267, size: 8 },
      evaluationDate: { x: 241, y: 584, width: 267, size: 8 },
    },
    background: { x: 46, y: 531, width: 510, height: 30, textY: 548, size: 7.2, lineHeight: 9, maxLines: 2 },
    administeredTests: {
      boxSize: 8,
      points: [
        { x: 49, y: 499 },
        { x: 49, y: 487 },
        { x: 49, y: 475 },
        { x: 49, y: 463 },
        { x: 49, y: 451 },
      ],
    },
    tables: {
      caregiver: {
        valueCells: [
          { x: 258, y: 386, width: 216, height: 13 },
          { x: 258, y: 372, width: 216, height: 13 },
          { x: 258, y: 358, width: 216, height: 13 },
          { x: 258, y: 344, width: 216, height: 13 },
          { x: 258, y: 330, width: 216, height: 13 },
        ],
        summary: { x: 80, y: 271, width: 439, height: 48 },
      },
      mmse: {
        valueCells: [
          { x: 258, y: 219, width: 216, height: 13 },
          { x: 258, y: 205, width: 216, height: 13 },
          { x: 258, y: 191, width: 216, height: 13 },
          { x: 258, y: 177, width: 216, height: 13 },
          { x: 258, y: 163, width: 216, height: 13 },
        ],
        summary: { x: 86, y: 92, width: 439, height: 48 },
      },
    },
  },
  page2: {
    pageNumber: { x: 515, y: 8, width: 58, size: 6.2 },
    tables: {
      adaptive: {
        valueCells: [
          { x: 258, y: 657, width: 216, height: 13 },
          { x: 258, y: 643, width: 216, height: 13 },
          { x: 258, y: 629, width: 216, height: 13 },
          { x: 258, y: 616, width: 216, height: 13 },
          { x: 258, y: 602, width: 216, height: 13 },
        ],
        summary: { x: 86, y: 532, width: 439, height: 48 },
      },
      ctoniSubtests: {
        valueCells: [
          { x: 277, y: 469, width: 60, height: 13 },
          { x: 277, y: 455, width: 60, height: 13 },
          { x: 277, y: 441, width: 60, height: 13 },
          { x: 277, y: 427, width: 60, height: 13 },
          { x: 277, y: 413, width: 60, height: 13 },
          { x: 277, y: 400, width: 60, height: 13 },
        ],
        descriptiveCells: [
          { x: 339, y: 469, width: 119, height: 13 },
          { x: 339, y: 455, width: 119, height: 13 },
          { x: 339, y: 441, width: 119, height: 13 },
          { x: 339, y: 427, width: 119, height: 13 },
          { x: 339, y: 413, width: 119, height: 13 },
          { x: 339, y: 400, width: 119, height: 13 },
        ],
        summary: { x: 86, y: 324, width: 439, height: 48 },
      },
      ctoniComposite: {
        descriptiveCells: [
          { x: 313, y: 282, width: 109, height: 13 },
          { x: 313, y: 268, width: 109, height: 13 },
        ],
        summary: { x: 86, y: 185, width: 439, height: 48 },
      },
    },
  },
  page3: {
    pageNumber: { x: 515, y: 8, width: 58, size: 6.2 },
    tables: {
      garsSubscales: {
        valueCells: [
          { x: 358, y: 657, width: 90, height: 13 },
          { x: 358, y: 643, width: 90, height: 13 },
          { x: 358, y: 630, width: 90, height: 13 },
          { x: 358, y: 616, width: 90, height: 13 },
          { x: 358, y: 602, width: 90, height: 13 },
          { x: 358, y: 588, width: 90, height: 13 },
        ],
        summary: { x: 86, y: 523, width: 439, height: 48 },
      },
      garsComposites: {
        valueCells: [
          { x: 311, y: 481, width: 91, height: 13 },
          { x: 311, y: 467, width: 91, height: 13 },
        ],
        summary: { x: 86, y: 395, width: 439, height: 48 },
      },
    },
    diagnosis: { x: 86, y: 312, width: 439, height: 48 },
    recommendations: { x: 86, y: 224, width: 439, height: 48 },
    signatories: {
      prepared: {
        signature: { x: 46, y: 166, width: 120, height: 18 },
        block: { x: 46, nameY: 148, professionY: 137, licenseY: 126, width: 510, nameSize: 8, detailSize: 7.2, minSize: 5.2 },
      },
      noted: {
        signature: { x: 46, y: 82, width: 120, height: 18 },
        block: { x: 46, nameY: 64, professionY: 53, licenseY: 42, width: 510, nameSize: 8, detailSize: 7.2, minSize: 5.2 },
      },
    },
  },
};

const FO07_LAYOUT = {
  signatures: {
    prepared: { x: 42, y: 210, width: 260, height: 45, nameY: 205 },
    noted: { x: 42, y: 147, width: 300, height: 45, nameY: 141 },
  },
};

const FO08_LAYOUT = {
  page2: {
    signoffs: {
      prepared: { x: 42, y: 242, width: 295, height: 18, nameY: 230 },
      reviewed: { x: 42, y: 167, width: 295, height: 18, nameY: 155 },
      noted: { x: 42, y: 91, width: 295, height: 18, nameY: 79 },
    },
  },
};

module.exports = {
  FO03_LAYOUT,
  FO04_LAYOUT,
  FO05_LAYOUT,
  FO06_LAYOUT,
  FO07_LAYOUT,
  FO08_LAYOUT,
};
