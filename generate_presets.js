import xlsx from 'xlsx';
import fs from 'fs';

async function main() {
  const url = "https://docs.google.com/spreadsheets/d/1OcsqERFIypDV7P8ZamHXi4o4dPn2luR4/export?format=xlsx";
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets['ชีต4'];
  const data = xlsx.utils.sheet_to_json(sheet);

  const presets = data.map((row) => {
    const id = `p${row['ລຳດັບ']}`;
    const category = String(row['ໝວດຍ່ອຍ'] || '').trim();
    const subItem = String(row['ລາຍການສ້ອມຍ່ອຍ'] || '').trim();
    const sparePart = String(row['ອະໄຫຼ່/ຄ່າບໍລິການ'] || '').trim();
    const unit = String(row['ຫົວໜ່ວຍ'] || 'ອັນ').trim();
    
    // Determine workType
    let workType = "ປ່ຽນອະໄຫຼ່";
    if (
      subItem.includes("ບໍລິການ") || 
      sparePart.includes("ບໍລິການ") || 
      subItem.includes("ລ້າງ") || 
      subItem.includes("ດູດ") || 
      subItem.includes("ລອກ") || 
      subItem.includes("ເຕີມ")
    ) {
      workType = "ບໍລິການ";
    } else if (
      subItem.includes("ກວດເຊັກ") || 
      subItem.includes("ກວດ") || 
      sparePart.includes("ກວດເຊັກ")
    ) {
      workType = "ກວດເຊັກ/ສ້ອມ";
    }

    // Determine estimated cost from previous values if known, else default to 0
    let estimatedUnitCost = 0;
    if (sparePart === "ດອກໄຟ LED 18W") estimatedUnitCost = 25000;
    else if (sparePart === "ສະວິດໄຟ") estimatedUnitCost = 15000;
    else if (sparePart === "ປັກສຽບໄຟ") estimatedUnitCost = 20000;
    else if (sparePart === "ເບຣກເກີ້ 30A") estimatedUnitCost = 65000;
    else if (sparePart === "ກັອກນໍ້າ 2 ທາງ") estimatedUnitCost = 45000;
    else if (sparePart === "ສາຍສີດຊຳລະ") estimatedUnitCost = 35000;
    else if (sparePart === "ສາຍອ່ອນ 1/2\"") estimatedUnitCost = 15000;
    else if (sparePart === "ບໍລິການລ້າງແອ") estimatedUnitCost = 150000;
    else if (sparePart === "ລ້າງທໍ່ນໍ້າທິ້ງແອ") estimatedUnitCost = 100000;
    else if (sparePart === "ຄ່າກວດເຊັກແອ") estimatedUnitCost = 50000;
    else if (sparePart === "ບໍລິການລອກໂຖສ້ວມ") estimatedUnitCost = 200000;
    else if (sparePart === "ຊຸດລູກລອຍໂຖສ້ວມ") estimatedUnitCost = 85000;
    else if (sparePart === "ບໍລິການດູດສິ່ງປະຕິກູນ") estimatedUnitCost = 350000;
    else if (sparePart === "ຄ່າກວດເຊັກ Network") estimatedUnitCost = 150000;
    else if (sparePart === "Router / Switch") estimatedUnitCost = 450000;
    else if (sparePart === "ສາຍ LAN") estimatedUnitCost = 15000;
    else if (sparePart === "ບໍລິການອັດນໍ້າຢາ") estimatedUnitCost = 120000;
    else if (sparePart === "Smoke Detector / Alarm") estimatedUnitCost = 180000;
    else if (sparePart === "ຄ່າກວດເຊັກປໍ້າດັບເພີງ") estimatedUnitCost = 250000;

    return {
      id,
      repairSubCategory: category,
      repairSubItem: subItem,
      workType,
      sparePart,
      unit,
      estimatedUnitCost
    };
  });

  fs.writeFileSync('src/data/generated_presets.json', JSON.stringify(presets, null, 2), 'utf8');
  console.log("Successfully wrote generated presets to src/data/generated_presets.json");
}

main().catch(console.error);
