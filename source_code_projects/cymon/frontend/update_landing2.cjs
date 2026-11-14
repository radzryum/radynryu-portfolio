const fs = require('fs');
const path = 'c:/Users/Radyn Ryu/Desktop/cymon/frontend/src/pages/Landing.jsx';
let content = fs.readFileSync(path, 'utf8');

// 3. Remove mindNotes array
const startIdx2 = content.indexOf('const mindNotes = [');
const endMarker2 = 'return (\n    <main id="top"';
const endIdx2 = content.indexOf(endMarker2);

if (startIdx2 !== -1 && endIdx2 !== -1) {
  content = content.substring(0, startIdx2) + content.substring(endIdx2);
}

fs.writeFileSync(path, content);
console.log('Removed mindNotes array');
