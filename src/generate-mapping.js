import fs from 'fs';
import path from 'path';

const files = [
  { name: 'ຟອມສຳນັກງານໃຫຍ່.json', type: 'ສຳນັກງານໃຫຍ່', key: 'ຟອມສຳນັກງານໃຫຍ່' },
  { name: 'ຟອມສາຂາ.json', type: 'ສາຂາ', key: 'ຟອມສາຂາ' },
  { name: 'ຟອມໜ່ວຍບໍລິການ.json', type: 'ໜ່ວຍບໍລິການ', key: 'ຟອມໜ່ວຍບໍລິການ' },
  { name: 'ຟອມຫ້ອງຮັບເງິນ.json', type: 'ຫ້ອງຮັບເງິນ', key: 'ຟອມຫ້ອງຮັບເງິນ' }
];

const mapping = [];
const seenKeys = new Set();

for (const file of files) {
  const filePath = path.resolve(`./src/data/${file.name}`);
  if (!fs.existsSync(filePath)) {
    console.error(`File ${file.name} does not exist at ${filePath}`);
    continue;
  }
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log(`Processing ${file.name} with ${content.length} raw entries`);
  
  // Skip the first two rows (metadata and header row)
  const rows = content.slice(2);
  
  let validCount = 0;
  let duplicateCount = 0;
  for (const row of rows) {
    const system = String(row[file.key] || '').trim();
    const category = String(row['__EMPTY'] || '').trim();
    const item = String(row['__EMPTY_1'] || '').trim();
    
    // Ignore header lookalikes or empty items
    if (system && item && system !== 'System (ລະບົບທີ່ກວດ)' && item !== 'Inspection Item (ລາຍການກວດກາ)') {
      // Normalize to prevent duplicates with minor space/case differences
      const normalizedKey = `${file.type.trim()}|||${system.toLowerCase().replace(/\s+/g, ' ')}|||${category.toLowerCase().replace(/\s+/g, ' ')}|||${item.toLowerCase().replace(/\s+/g, ' ')}`;
      
      if (!seenKeys.has(normalizedKey)) {
        seenKeys.add(normalizedKey);
        mapping.push({
          Form_Type: file.type,
          "System (ລະບົບທີ່ກວດ)": system,
          "Category (ໝວດລະບົບຍ່ອຍ)": category,
          "Inspection Item (ລາຍການກວດກາ)": item
        });
        validCount++;
      } else {
        duplicateCount++;
      }
    }
  }
  console.log(`Extracted ${validCount} valid entries for ${file.type} (skipped ${duplicateCount} duplicates)`);
}

const outputPath = path.resolve('./src/data/AppSheet_Mapping.json');
fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2));
console.log(`Successfully wrote ${mapping.length} entries to ${outputPath}!`);
