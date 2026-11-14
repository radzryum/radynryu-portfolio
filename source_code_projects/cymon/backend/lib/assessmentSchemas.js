const FO05_STRUCTURE = [
  {
    key: 'mathematics',
    title: 'Mathematics',
    page: 1,
    items: [
      { key: 'math_colors', label: 'Colors', response_type: 'text', stimuli: ['Red', 'Green', 'Pink', 'Purple', 'Brown', 'Blue', 'Yellow', 'Orange', 'Black', 'White'] },
      { key: 'math_shapes', label: 'Shapes', response_type: 'text', stimuli: ['Square', 'Rectangle', 'Heart', 'Oval', 'Triangle', 'Circle', 'Diamond', 'Star'] },
      { key: 'math_numbers_value', label: 'Numbers Value', response_type: 'text', stimuli: ['1', '5', '7', '9', '3', '2', '6', '4', '8', '10', '13', '15', '17', '12', '19', '14', '11', '18', '16', '22', '24', '29', '35', '40', '60', '20', '25', '50', '90', '21', '100'] },
      { key: 'math_word_recognition', label: 'Word Recognition', response_type: 'text', stimuli: ['One', 'Seven', 'Four', 'Six', 'Nine', 'Five', 'Two', 'Three', 'Eight', 'Ten', 'Eleven', 'Nineteen', 'Twenty-One', 'Thirty', 'Thirteen', 'Seventeen', 'Fifty', 'Sixty-Five'] },
    ],
  },
  {
    key: 'literacy_letter_recognition',
    title: 'Literacy (Letter Recognition)',
    page: 1,
    items: [
      { key: 'literacy_uppercase', label: 'Uppercase', response_type: 'text', stimuli: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('') },
      { key: 'literacy_lowercase', label: 'lowercase', response_type: 'text', stimuli: 'abcdefghijklmnopqrstuvwxyz'.split('') },
      { key: 'literacy_letter_sounds', label: 'Letter Sounds', response_type: 'text', stimuli: ['Aa', 'Bb', 'Cc', 'Dd', 'Ee', 'Ff', 'Gg', 'Hh', 'Ii', 'Jj', 'Kk', 'Ll', 'Mm', 'Nn', 'Oo', 'Pp', 'Qq', 'Rr', 'Ss', 'Tt', 'Uu', 'Vv', 'Ww', 'Xx', 'Yy', 'Zz'] },
    ],
  },
  {
    key: 'literacy_word_recognition',
    title: 'Literacy (Word Recognition)',
    page: 1,
    items: [
      { key: 'literacy_cvc_words', label: 'CVC Words', response_type: 'text', stimuli: ['Cat', 'Bed', 'Wig', 'Fun', 'Did', 'Jam', 'Pet', 'Rim', 'Leg', 'Tap', 'Pin', 'Cut', 'Hen', 'Van', 'Tip', 'Gum', 'Fin', 'Set', 'Pan', 'Mat', 'Run', 'Him', 'Peg', 'Jam'] },
      { key: 'literacy_action_words', label: 'Action Words', response_type: 'text', stimuli: ['Jump', 'Push', 'Walk', 'Throw', 'Climb', 'Pull', 'Eat', 'Sing', 'Swim', 'Read', 'Write', 'Laugh', 'Clean', 'Wash', 'Sleep', 'Dance', 'Talk', 'Think', 'Crawl', 'Ride', 'Cry', 'Kick', 'Sit'] },
      { key: 'literacy_describing_words', label: 'Describing Words', response_type: 'text', stimuli: ['Loud', 'Hard', 'Smooth', 'Dry', 'Hot', 'Small', 'Soft', 'Sharp', 'Wet', 'Quiet', 'Large', 'Cold', 'Dark', 'Sweet', 'Light', 'Sour', 'Salty', 'Spicy', 'Bitter'] },
      { key: 'literacy_prepositions', label: 'Prepositions', response_type: 'text', stimuli: ['In', 'Under', 'At', 'Beside', 'Between', 'Over', 'On', 'Behind', 'As', 'Near', 'Front', 'Down', 'Up', 'An', 'Above', 'Next', 'Across', 'Off', 'Right', 'Through', 'Among'] },
    ],
  },
  {
    key: 'writing_name_recognition',
    title: 'Writing and Name Recognition',
    page: 1,
    items: [
      { key: 'writing_name_recognition', label: 'Name Recognition', response_type: 'yes_no', options: ['yes', 'no'] },
      { key: 'writing_name_recognition_interpretation', label: 'Name Recognition Observation', response_type: 'text' },
      { key: 'writing_write_name', label: 'Write Name', response_type: 'yes_no', options: ['yes', 'no'] },
      { key: 'writing_write_name_interpretation', label: 'Write Name Observation', response_type: 'text' },
      { key: 'writing_spell_name', label: 'Spell Name', response_type: 'yes_no', options: ['yes', 'no'] },
      { key: 'writing_spell_name_interpretation', label: 'Spell Name Observation', response_type: 'text' },
      { key: 'writing_dominant_hand', label: 'Dominant Hand', response_type: 'select', options: ['left', 'right', 'both'] },
      { key: 'writing_dominant_hand_interpretation', label: 'Dominant Hand Observation', response_type: 'text' },
      { key: 'writing_pencil_grip', label: 'Pencil Grip', response_type: 'select', options: ['fisted', 'four_finger', 'static_tripod', 'dynamic_tripod'] },
      { key: 'writing_pencil_grip_interpretation', label: 'Pencil Grip Observation', response_type: 'text' },
    ],
  },
];

const FO05_METADATA_FIELDS = [
  'assessment_date',
  'student_name',
  'age_gender',
  'guardian_name',
  'assessor_name',
];

function isFo05Template(template = {}) {
  return template.document_type_code === 'CMPS:SE-FO-05';
}

function structureForTemplate(template = {}) {
  return isFo05Template(template) ? FO05_STRUCTURE : template.structure || [];
}

function responseValue(answers, key) {
  const item = answers?.[key];
  if (item && typeof item === 'object') return item.response ?? item.value ?? item.answer ?? '';
  return item ?? '';
}

function isAssessmentResponseComplete(item = {}, value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (item.response_type === 'text') return Boolean(normalized);
  if (item.response_type === 'select') {
    return (item.options || []).some((option) => String(option).toLowerCase() === normalized);
  }
  if (item.response_type === 'yes_no') return ['yes', 'no'].includes(normalized);
  return ['yes', 'no', 'na'].includes(normalized);
}

function assessmentQuestions(structure = []) {
  return (Array.isArray(structure) ? structure : []).flatMap((domain) =>
    (Array.isArray(domain?.items) ? domain.items : []).map((item) => ({
      ...item,
      domain: domain?.title || domain?.name || domain?.label || '',
    })),
  ).filter((item) => item.key);
}

function findIncompleteAssessmentItems(structure = [], answers = {}) {
  return assessmentQuestions(structure).filter((item) =>
    !isAssessmentResponseComplete(item, responseValue(answers, item.key)),
  );
}

function scoreAssessment(structure = [], answers = {}) {
  const scoredItems = assessmentQuestions(structure).filter((item) => item.response_type === 'yes_no' || !item.response_type);
  const total = scoredItems.filter((item) => String(responseValue(answers, item.key)).toLowerCase() === 'yes').length;
  return { total, max: scoredItems.length };
}

module.exports = {
  FO05_METADATA_FIELDS,
  FO05_STRUCTURE,
  assessmentQuestions,
  findIncompleteAssessmentItems,
  isAssessmentResponseComplete,
  isFo05Template,
  responseValue,
  scoreAssessment,
  structureForTemplate,
};
