import xlsx from 'xlsx';

async function main() {
  const url = "https://docs.google.com/spreadsheets/d/1OcsqERFIypDV7P8ZamHXi4o4dPn2luR4/export?format=xlsx";
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'array' });
  
  for (const name of workbook.SheetNames) {
    if (name === 'Summary') continue;
    const sheet = workbook.Sheets[name];
    const data = xlsx.utils.sheet_to_json(sheet);
    console.log(`\n================ Sheet: ${name} ================`);
    if (data.length === 0) continue;
    
    // Check first 5 rows keys and values
    console.log("Columns:", Object.keys(data[0]));
    console.log("Sample rows:");
    console.log(data.slice(0, 5));
  }
}

main().catch(console.error);
