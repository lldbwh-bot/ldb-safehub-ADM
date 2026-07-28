import xlsx from 'xlsx';
import fs from 'fs';

async function main() {
  console.log("Fetching spreadsheet...");
  const url = "https://docs.google.com/spreadsheets/d/1OcsqERFIypDV7P8ZamHXi4o4dPn2luR4/export?format=xlsx";
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch: ${res.statusText}`);
  }
  const buffer = await res.arrayBuffer();
  console.log("Loaded spreadsheet, length:", buffer.byteLength);

  const workbook = xlsx.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['All_Forms'];
  const data = xlsx.utils.sheet_to_json(sheet);

  const parsedItems = [];
  // Columns: 'All Forms - System / Category / Inspection Item', '__EMPTY', '__EMPTY_1', '__EMPTY_2'
  for (const row of data) {
    const rawFormType = row['All Forms - System / Category / Inspection Item'];
    const rawSystem = row['__EMPTY'];
    const rawCategory = row['__EMPTY_1'];
    const rawItem = row['__EMPTY_2'];

    if (rawFormType && rawFormType !== 'Form Type' && rawSystem && rawCategory && rawItem) {
      let formType = String(rawFormType).trim();
      // Clean form type prefix "ຟອມ"
      formType = formType.replace(/^ຟອມ\s*/, '');

      parsedItems.push({
        "Form_Type": formType,
        "System (ລະບົບທີ່ກວດ)": String(rawSystem).trim(),
        "Category (ໝວດລະບົບຍ່ອຍ)": String(rawCategory).trim(),
        "Inspection Item (ລາຍການກວດກາ)": String(rawItem).trim()
      });
    }
  }

  console.log(`\nSuccessfully parsed ${parsedItems.length} items from All_Forms.`);
  
  // Save to AppSheet_Mapping.json
  const mappingPath = 'src/data/AppSheet_Mapping.json';
  fs.writeFileSync(mappingPath, JSON.stringify(parsedItems, null, 2), 'utf8');
  console.log(`Saved mapping data to ${mappingPath}`);

  // Empty checklistitem.json
  const checklistitemPath = 'src/data/checklistitem.json';
  fs.writeFileSync(checklistitemPath, '[]', 'utf8');
  console.log(`Emptied checklistitem.json at ${checklistitemPath}`);

  // Print summary by Form Type
  const formTypes = [...new Set(parsedItems.map(i => i.Form_Type))];
  console.log("\nSummary of Imported Data:");
  for (const ft of formTypes) {
    const items = parsedItems.filter(i => i.Form_Type === ft);
    const systems = [...new Set(items.map(i => i["System (ລະບົບທີ່ກວດ)"]))];
    const categories = [...new Set(items.map(i => i["Category (ໝວດລະບົບຍ່ອຍ)"]))];
    console.log(`- ${ft}:`);
    console.log(`  * Inspection Items: ${items.length}`);
    console.log(`  * Systems: ${systems.length} (${systems.join(', ')})`);
    console.log(`  * Categories: ${categories.length}`);
  }
}

main().catch(console.error);
