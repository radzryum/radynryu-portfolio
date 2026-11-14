const fs = require('fs');
const path = 'c:/Users/Radyn Ryu/Desktop/cymon/frontend/src/pages/Landing.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import
content = content.replace(
  "import AnnouncementCard from '../components/ui/AnnouncementCard'",
  "import AnnouncementCard from '../components/ui/AnnouncementCard'\nimport SpecialtiesScrollytelling from '../components/ui/SpecialtiesScrollytelling'"
);

// 2. Remove MessyMind section
const startIdx = content.indexOf('{/* Interactive Section: Pathway Cards */}');
const endMarker = '{/* About & Foundation Section */}';
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
  content = content.substring(0, startIdx) + 
            "{/* Interactive Section: Specialties Scrollytelling */}\n      <SpecialtiesScrollytelling />\n\n      " + 
            content.substring(endIdx);
}

fs.writeFileSync(path, content);
console.log('Replaced MessyMind section with SpecialtiesScrollytelling');
