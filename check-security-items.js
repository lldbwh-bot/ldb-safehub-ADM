import xlsx from 'xlsx';

async function main() {
  const url = "https://docs.google.com/spreadsheets/d/1OcsqERFIypDV7P8ZamHXi4o4dPn2luR4/export?format=xlsx";
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['All_Forms'];
  const data = xlsx.utils.sheet_to_json(sheet);

  const parsedItems = [];
  for (const row of data) {
    const formType = row['All Forms - System / Category / Inspection Item'];
    const system = row['__EMPTY'];
    const category = row['__EMPTY_1'];
    const item = row['__EMPTY_2'];

    if (formType && formType !== 'Form Type' && system && category && item) {
      parsedItems.push({
        Form_Type: String(formType).trim(),
        System: String(system).trim(),
        Category: String(category).trim(),
        Item: String(item).trim()
      });
    }
  }

  const matches = parsedItems.filter(i => 
    i.System.includes("ຄວາມປອດໄພ") ||
    i.Category.includes("CCTV") ||
    i.Category.includes("ກ້ອງວົງຈອນ") ||
    i.Item.includes("CCTV") ||
    i.Item.includes("ກ້ອງວົງຈອນ")
  );

  console.log("Found matches in spreadsheet:", matches.length);
  if (matches.length > 0) {
    console.log("Sample matches:");
    console.log(matches.slice(0, 5));
  }
}

main().catch(console.error);
