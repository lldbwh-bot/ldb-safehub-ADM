import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

async function main() {
  const url = 'https://docs.google.com/spreadsheets/d/1OcsqERFIypDV7P8ZamHXi4o4dPn2luR4/export?format=xlsx';
  console.log('Fetching sheet from:', url);
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    
    console.log('Worksheet names found:', workbook.SheetNames);
    
    const outputDir = path.resolve('./src/data');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const outputPath = path.join(outputDir, `${sheetName}.json`);
      fs.writeFileSync(outputPath, JSON.stringify(json, null, 2));
      console.log(`Saved sheet ${sheetName} to ${outputPath} (${json.length} rows)`);
    }
    
    console.log('All worksheets have been successfully extracted!');
  } catch (err) {
    console.error('Error fetching/extracting sheet:', err);
  }
}

main();
