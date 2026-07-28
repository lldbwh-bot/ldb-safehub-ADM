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

  const uniqueCategories = [...new Set(parsedItems.map(i => i.Category))];
  console.log("All categories in spreadsheet:", uniqueCategories);
}

main().catch(console.error);
