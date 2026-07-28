import fs from 'fs';

const data = JSON.parse(fs.readFileSync('src/data/AppSheet_Mapping.json', 'utf8'));
console.log("Total entries in original mapping:", data.length);
const formTypes = [...new Set(data.map(i => i.Form_Type))];
console.log("Form types in original mapping:", formTypes);
console.log("Sample original entry:", data[0]);
