import xlsx from 'xlsx';

async function main() {
  const url = "https://docs.google.com/spreadsheets/d/1OcsqERFIypDV7P8ZamHXi4o4dPn2luR4/export?format=xlsx";
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['ชีต4'];
  const data = xlsx.utils.sheet_to_json(sheet);
  
  console.log("=== FIRST 10 ITEMS ===");
  console.log(JSON.stringify(data.slice(0, 10), null, 2));
}

main().catch(console.error);
