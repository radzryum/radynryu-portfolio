-- CMPS:SE-FO-05 now follows the two-page Child Adaptive Functioning
-- Assessment Tool reference PDF. The metadata column stores the page-one
-- identity fields separately from the scored/form responses.

ALTER TABLE public.assessment_submissions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.assessment_templates
SET
  title = 'Child Adaptive Functioning Assessment Tool',
  max_score = 3,
  structure = $$
  [
    {
      "key": "mathematics",
      "title": "Mathematics",
      "page": 1,
      "items": [
        {"key": "math_colors", "label": "Colors", "response_type": "text", "stimuli": ["Red", "Green", "Pink", "Purple", "Brown", "Blue", "Yellow", "Orange", "Black", "White"]},
        {"key": "math_shapes", "label": "Shapes", "response_type": "text", "stimuli": ["Square", "Rectangle", "Heart", "Oval", "Triangle", "Circle", "Diamond", "Star"]},
        {"key": "math_numbers_value", "label": "Numbers Value", "response_type": "text", "stimuli": ["1", "5", "7", "9", "3", "2", "6", "4", "8", "10", "13", "15", "17", "12", "19", "14", "11", "18", "16", "22", "24", "29", "35", "40", "60", "20", "25", "50", "90", "21", "100"]},
        {"key": "math_word_recognition", "label": "Word Recognition", "response_type": "text", "stimuli": ["One", "Seven", "Four", "Six", "Nine", "Five", "Two", "Three", "Eight", "Ten", "Eleven", "Nineteen", "Twenty-One", "Thirty", "Thirteen", "Seventeen", "Fifty", "Sixty-Five"]}
      ]
    },
    {
      "key": "literacy_letter_recognition",
      "title": "Literacy (Letter Recognition)",
      "page": 1,
      "items": [
        {"key": "literacy_uppercase", "label": "Uppercase", "response_type": "text", "stimuli": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"]},
        {"key": "literacy_lowercase", "label": "lowercase", "response_type": "text", "stimuli": ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]},
        {"key": "literacy_letter_sounds", "label": "Letter Sounds", "response_type": "text", "stimuli": ["Aa", "Bb", "Cc", "Dd", "Ee", "Ff", "Gg", "Hh", "Ii", "Jj", "Kk", "Ll", "Mm", "Nn", "Oo", "Pp", "Qq", "Rr", "Ss", "Tt", "Uu", "Vv", "Ww", "Xx", "Yy", "Zz"]}
      ]
    },
    {
      "key": "literacy_word_recognition",
      "title": "Literacy (Word Recognition)",
      "page": 1,
      "items": [
        {"key": "literacy_cvc_words", "label": "CVC Words", "response_type": "text", "stimuli": ["Cat", "Bed", "Wig", "Fun", "Did", "Jam", "Pet", "Rim", "Leg", "Tap", "Pin", "Cut", "Hen", "Van", "Tip", "Gum", "Fin", "Set", "Pan", "Mat", "Run", "Him", "Peg", "Jam"]},
        {"key": "literacy_action_words", "label": "Action Words", "response_type": "text", "stimuli": ["Jump", "Push", "Walk", "Throw", "Climb", "Pull", "Eat", "Sing", "Swim", "Read", "Write", "Laugh", "Clean", "Wash", "Sleep", "Dance", "Talk", "Think", "Crawl", "Ride", "Cry", "Kick", "Sit"]},
        {"key": "literacy_describing_words", "label": "Describing Words", "response_type": "text", "stimuli": ["Loud", "Hard", "Smooth", "Dry", "Hot", "Small", "Soft", "Sharp", "Wet", "Quiet", "Large", "Cold", "Dark", "Sweet", "Light", "Sour", "Salty", "Spicy", "Bitter"]},
        {"key": "literacy_prepositions", "label": "Prepositions", "response_type": "text", "stimuli": ["In", "Under", "At", "Beside", "Between", "Over", "On", "Behind", "As", "Near", "Front", "Down", "Up", "An", "Above", "Next", "Across", "Off", "Right", "Through", "Among"]}
      ]
    },
    {
      "key": "writing_name_recognition",
      "title": "Writing and Name Recognition",
      "page": 1,
      "items": [
        {"key": "writing_name_recognition", "label": "Name Recognition", "response_type": "yes_no", "options": ["yes", "no"]},
        {"key": "writing_name_recognition_interpretation", "label": "Name Recognition Verbal Interpretation", "response_type": "text"},
        {"key": "writing_write_name", "label": "Write Name", "response_type": "yes_no", "options": ["yes", "no"]},
        {"key": "writing_write_name_interpretation", "label": "Write Name Verbal Interpretation", "response_type": "text"},
        {"key": "writing_spell_name", "label": "Spell Name", "response_type": "yes_no", "options": ["yes", "no"]},
        {"key": "writing_spell_name_interpretation", "label": "Spell Name Verbal Interpretation", "response_type": "text"},
        {"key": "writing_dominant_hand", "label": "Dominant Hand", "response_type": "select", "options": ["left", "right", "both"]},
        {"key": "writing_dominant_hand_interpretation", "label": "Dominant Hand Verbal Interpretation", "response_type": "text"},
        {"key": "writing_pencil_grip", "label": "Pencil Grip", "response_type": "select", "options": ["fisted", "four_finger", "static_tripod", "dynamic_tripod"]},
        {"key": "writing_pencil_grip_interpretation", "label": "Pencil Grip Verbal Interpretation", "response_type": "text"}
      ]
    }
  ]
  $$::jsonb
WHERE document_type_code = 'CMPS:SE-FO-05';

NOTIFY pgrst, 'reload schema';
