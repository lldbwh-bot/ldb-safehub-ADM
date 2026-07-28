/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserAccount {
  username: string;
  password_raw: string; // cleaned password
  status: string; // "Admin" | "User"
  branch: string; // "00.ສໍານັກງານໃຫຍ່", etc.
  image?: string;
  allowedTabs?: string[]; // permissions configuration for visible tabs
}

export interface ChecklistItem {
  ລະບົບທີ່ກວດ: string; // e.g. "ລະບົບຄວາມປອດໄພ"
  ໝວດລະບົບກວດ: string; // e.g. "ລະບົບກ້ອງວົງຈອນCCTV"
  ລາຍການກວດ: string; // e.g. "ກວດເຊັກການເຮັດວຽກຂອງກ້ອງປົກກະຕິ"
  Form_Type?: string; // e.g. "ສາຂາ", "ສຳນັກງານໃຫຍ່" etc.
}

export interface BranchInfo {
  ລຳດັບ: number;
  ສາຂາ: string;
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": string;
}

export interface SectorInfo {
  ຂະແໜງ: string;
}

export interface AssetCategoryInfo {
  ພາກສ່ວນ: string;
}

export interface InspectionRecord {
  "ລ/ດ"?: number | string;
  PID: string;
  ລະຫັດກວດກາ: string;
  ວັນທີ່ກວດ: string | number; // Excel serial or string
  ເວລາກວດ: string | number;
  ຜູ້ກວດກາ: string;
  ຊື່ຜູ້ກວດ: string;
  ສະຖານທີ?: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  "ສາຂາ ": string; // Trailing space in spreadsheet key!
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": string;
  ຂະແໜງ: string;
  ຊັ້ນອາຄານ: string | number;
  ຮູບແບບການກວດ: string; // "ສຸມກວດ", "ກວດປະຈໍາວັນ", etc.
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລາຍການກວດ: string; // Comma separated items
  ສະຖານະ: "ປົກກະຕີ" | "ຜິດປົກກະຕີ";
  ຈຳນວນເຫດການທີ່ພົບ: number;
  ເດືອນ: number;
  ປີ: number;
  ຮັບອໍເດີ: number;
  ຈຳນວນຄົງຄ້າງ: number;
  ສະຖານະຮັບ: string;
  "key status"?: string;
}

export interface IncidentRecord {
  "ລ/ດ"?: number | string;
  PID: string;
  ລະຫັດກວດກາ: string;
  ຮູບແບບການກວດ?: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລາຍການກວດ: string;
  ລະຫັດຊັບສິນ: string;
  ພາກສ່ວນຊັບສົມບັດ: string; // "ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ", etc.
  ໝວດລາຍການ: string; // "NOTEBOOK", etc.
  ລາຍການ: string; // "ASUS", etc.
  ຮູບພາບລາຍການທີ່ເພ?: string;
  ລາຍລະອຽດປັນຫາທີ່ພົບ: string;
  ປະເມີນຜົນກະທົບ: "ສູງ" | "ປານກາງ" | "ຕ່ຳ" | string;
  ວີທີແກ້ໄຂ: string;
  ວັນທີ່ກວດ: string | number;
  ເວລາກວດ: string | number;
  ຜູ້ກວດກາ: string;
  ຊື່ຜູ້ກວດ: string;
  ສະຖານທີພົບເຫດການ?: string;
  "ສາຂາ ": string; // Trailing space!
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": string;
  ຂະແໜງ: string;
  "ສາຂາຊັບສິນ"?: string;
  "ຝ່າຍຊັບສິນ"?: string;
  "ຂະແໜງຊັບສິນ"?: string;
  ຊັ້ນອາຄານ: string | number;
  ເດືອນ: number;
  ປີ: number;
  order: number;
  ຮັບອໍເດີ: number;
  ຈຳນວນຄົງຄ້າງ: number;
  ສະຖານະ: string; // "ລໍຖ້າການອະນຸມັດ", "ອະນຸມັດແລ້ວ", etc.
  "key status"?: string;
}

export interface RepairApprovalRecord {
  "ລ/ດ"?: number | string;
  PID: string;
  ລະຫັດກວດກາ: string;
  ຮູບແບບການກວດ?: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລາຍການກວດ: string;
  ລະຫັດຊັບສິນ: string;
  ພາກສ່ວນຊັບສົມບັດ: string;
  ໝວດລາຍການ: string;
  ລາຍການ: string;
  ຮູບພາບລາຍການທີ່ເພ?: string;
  ລາຍລະອຽດປັນຫາທີ່ພົບ: string;
  ປະເມີນຜົນກະທົບ: string;
  ວີທີແກ້ໄຂ: string;
  ວັນທີ່ກວດ: string | number;
  ເວລາກວດ: string | number;
  ຜູ້ກວດກາ: string;
  ຊື່ຜູ້ກວດ: string;
  ສະຖານທີພົບເຫດການ?: string;
  "ສາຂາ ": string;
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": string;
  ຂະແໜງ: string;
  ສາຂາຊັບສິນ?: string;
  ຝ່າຍຊັບສິນ?: string;
  ຂະແໜງຊັບສິນ?: string;
  ຊັ້ນອາຄານ: string | number;
  ການດຳເນີນງານ: string; // "ຈ້າງພາຍນອກ" | "ສ້ອມແປງເອງ" | etc.
  "vendor ຜູ້ສະໜອງ": string;
  ວັນທີ່ອະນຸມັດ: string | number;
  ຜູ້ອະນຸມັດ: string; // "ຫົວໜ້າຝ່າຍ", etc.
  ເອກະສານອະນຸມັດ?: string;
  ເດືອນ: number;
  ປີ: number;
  order: number;
  "ຮັບອໍເດີ": number;
  ຈຳນວນຄົງຄ້າງ: number;
  ສະຖານະ: string; // "ລໍຖ້າສ້ອມແປງ", "ສຳເລັດ"
  "key status"?: string;
}

export interface RepairLogRecord {
  "ລ/ດ"?: number | string;
  PID: string;
  ລະຫັດກວດກາ: string;
  ຮູບແບບການກວດ?: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລາຍການກວດ: string;
  ລະຫັດຊັບສິນ: string;
  ພາກສ່ວນຊັບສົມບັດ: string;
  ໝວດລາຍການ: string;
  ລາຍການ: string;
  ຮູບພາບກ່ອນສ້ອມແປງ?: string;
  ລາຍລະອຽດປັນຫາທີ່ພົບ: string;
  ປະເມີນຜົນກະທົບ: string;
  ວີທີແກ້ໄຂ: string;
  ວັນທີ່ກວດ: string | number;
  ເວລາກວດ: string | number;
  ຜູ້ກວດກາ: string;
  ຊື່ຜູ້ກວດ: string;
  "ສາຂາ ": string;
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": string;
  ຂະແໜງ: string;
  ສາຂາຊັບສິນ?: string;
  ຝ່າຍຊັບສິນ?: string;
  ຂະແໜງຊັບສິນ?: string;
  ຊັ້ນອາຄານ: string | number;
  ການດຳເນີນການ: string;
  "vendor ຜູ້ສະໜອງ": string;
  ວັນທີ່ສ້ອມແປງ: string | number;
  ຜົນການແກ້ໄຂ: string;
  ຜົນທົດສອບ: string;
  ຮູບພາຍຫຼັງການແກ້ໄຂ?: string;
  ມູນຄ່າສ້ອມແປງ: number;
  ຊຸດເອກະສານຈ່າຍເງິນ?: string;
  ວັນທີ່ສຳເລັດ: string | number;
  ລວມມື້ທີ່ສຳເລັດ: number;
  ເດືອນ: number;
  ປີ: number;
  order: number;
  ສະຖານະ: string; // "ສຳເລັດ"
  "key status"?: string;
}

export interface RepairTrackingRecord {
  "ລ/ດ"?: number | string;
  PID: string;
  ລະຫັດກວດກາ: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  "ສາຂາ ": string; // Branch with trailing space
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": string;
  ຂະແໜງ: string;
  ຮູບແບບການກວດ: string;
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລະຫັດຊັບສິນ: string;
  ລາຍການ: string; // Asset Name
  ພາກສ່ວນຊັບສົມບັດ: string;
  ໝວດລາຍການ: string;
  ສາຂາຊັບສິນ: string;
  ຝ່າຍຊັບສິນ: string;
  ຂະແໜງຊັບສິນ: string;
  ລາຍລະອຽດປັນຫາທີ່ພົບ: string;
  ປະເມີນຜົນກະທົບ: string;
  ວີທີແກ້ໄຂ: string; // Proposed Solution
  ວັນທີ່ກວດ: string | number;
  ເວລາກວດ: string | number;
  ຜູ້ກວດກາ: string;
  ຊື່ຜູ້ກວດ?: string;
  ສະຖານະ: string;
  ວັນທີ່ອະນຸມັດ: string | number;
  ຜູ້ອະນຸມັດ: string;
  
  // Tracking-specific fields
  owner: string; // ຜູ້ຮັບຜິດຊອບຕິດຕາມ
  vendor: string; // Vendor / ຜູ້ຮັບເໝົາ ຫຼື ຊ່າງ...
  execution: string; // ຮູບແບບການດຳເນີນງານ
  startRepairDate?: string; // ວັນທີ່ເລີ່ມສ້ອມ
  expectedFinishDate?: string; // ວັນທີ່ຄາດວ່າຈະສຳເລັດ
  actualFinishDate?: string; // ວັນທີ່ສຳເລັດຈິງ
  progressPercent: number; // ເປີເຊັນຄວາມຄືບໜ້າ
  trackingStatus: string; // ສະຖານະຕິດຕາມ: "ລໍຖ້າເລີ່ມສ້ອມ", "ກຳລັງດຳເນີນການ", "ລໍຖ້າອະໄຫຼ່", "ລໍຖ້າ Vendor", "ຢຸດຊົ່ວຄາວ", "ສ້ອມສຳເລັດ", "ປິດງານແລ້ວ"
  slaStatus: string; // ສະຖານະ SLA: "ເກີນກຳນົດ", "ໃກ້ເກີນກຳນົດ", "ຢູ່ໃນກຳນົດ", "ສຳເລັດແລ້ວ"
  delayReason?: string; // ເຫດຜົນລ່າຊ້າ / ເຫດຜົນທີ່ຢຸດ
  progressRemark?: string; // ໝາຍເຫດຄວາມຄືບໜ້າ
  beforePhoto?: string; // ຮູບກ່ອນສ້ອມ
  duringPhoto?: string; // ຮູບລະຫວ່າງສ້ອມ
  afterPhoto?: string; // ຮູບຫຼັງສ້ອມ
  repairResult?: string; // ຜົນການສ້ອມແປງ
  testResult?: string; // ຜົນການທົດສອບ
  repairCost?: number; // ມູນຄ່າສ້ອມແປງ
  closedAt?: string; // ວັນທີປິດງານ
}

export interface PMAsset {
  assetCode: string;
  assetName: string;
  assetCategory: string;
  assetGroup: string;
  branch: string;
  division: string;
  sector: string;
  floor: string | number;
  locationDetail: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  systemCategory: string;
  subsystemCategory: string;
  maintenanceCycle: string; // e.g. "7 ມື້", "15 ມື້", "1 ເດືອນ", "3 ເດືອນ", "6 ເດືອນ", "1 ປີ", "Custom"
  customCycleDays?: number;
  lastMaintenanceDate: string; // YYYY-MM-DD
  nextMaintenanceDate: string; // YYYY-MM-DD
  alertBeforeDays: number;
  responsiblePerson: string;
  vendor: string;
  maintenanceStatus: string; // Calculated dynamically or persisted: e.g. "ປົກກະຕິ", "ໃກ້ຮອດກຳນົດ", "ຮອດກຳນົດ", "ເກີນກຳນົດ"
}

export interface PMHistoryRecord {
  id: string;
  assetCode: string;
  assetName: string;
  assetCategory: string;
  assetGroup: string;
  branch: string;
  division: string;
  sector: string;
  floor: string | number;
  locationDetail: string;
  ສະຖານທີ່_ຫ້ອງ?: string; // Specify Room/Location
  systemCategory: string;
  subsystemCategory: string;
  maintenanceCycle: string;
  inspectionDate: string; // YYYY-MM-DD
  inspector: string;
  overallResult: "ປົກກະຕິ" | "ຜິດປົກກະຕິ";
  checklistResults: {
    item: string;
    result: "ປົກກະຕິ" | "ຜິດປົກກະຕິ" | "ບໍ່ກ່ຽວຂ້ອງ";
  }[];
  issueDetails?: string;
  impactLevel?: string;
  proposedSolution?: string;
  photo?: string; // base64 photo
  relatedIncidentId?: string;
}

export interface RepairSubItem {
  id: string; // unique subitem identifier
  repairSubCategory?: string; // ໝວດຍ່ອຍລາຍການສ້ອມ
  repairSubItem: string; // ລາຍການສ້ອມແປງ
  workType: "ສ້ອມ" | "ປ່ຽນ" | "ປັບປຸງ" | "ກວດເຊັກ" | string;
  repairerType?: "ຊ່າງພາຍໃນ" | "Vendor" | string; // ຊ່າງພາຍໃນ / Vendor
  internalRepairerName?: string; // ຊື່ພະນັກງານຜູ້ສ້ອມ
  vendorName?: string; // ຊື່ບໍລິສັດ ຫຼື ຜູ້ຮັບເໝົາ
  partSource: "Stock" | "Purchase New" | "Vendor" | "No Part Required" | string;
  sparePart?: string; // ອະໄຫຼ່
  quantity?: number; // ຈຳນວນ
  unit?: string; // ຫົວໜ່ວຍ
  stockItemCode?: string; // ລະຫັດອະໄຫຼ່ໃນສາງ
  estimatedUnitCost?: number; // ລາຄາຕໍ່ໜ່ວຍ (Estimated Unit Cost)
  estimatedTotalCost?: number; // ລາຄາລວມ (Estimated Total Cost)
  costRule?: string; // ລະບຽບລາຄາ / Cost Rule
}

export interface RepairAssessmentRecord {
  "ລ/ດ"?: number | string;
  PID: string; // unique ID for this assessment record (e.g. ASM-xxxxx)
  assessmentId: string; // display ID for the assessment (same as PID or unique string)
  incidentId: string; // linked Incident PID
  inspectionId?: string; // ລະຫັດກວດກາ (Inspection ID)
  branch: string; // ສາຂາ
  division: string; // ຝ່າຍ/ໜ່ວຍບໍລິການ
  sector: string; // ຂະແໜງ
  roomOrLocation: string; // Specify Room/Location (ສະຖານທີ່_ຫ້ອງ)
  inspectionType?: string; // ຮູບແບບການກວດ
  systemCategory?: string; // ລະບົບທີ່ກວດ
  subsystemCategory?: string; // ໝວດລະບົບຍ່ອຍ / ໝວດລະບົບກວດ
  assetCode: string; // ລະຫັດຊັບສິນ
  assetName: string; // ລາຍການ
  itemType?: string; // ໝວດລາຍການ (Item Type)
  issueDetails?: string; // ລາຍລະອຽດປັນຫາທີ່ພົບ
  impactLevel?: string; // ປະເມີນຜົນກະທົບ
  proposedSolution?: string; // ວີທີແກ້ໄຂ (Proposed Solution)
  assessorName: string; // ຊື່ຜູ້ປະເມີນ
  assessorType: "ຊ່າງພາຍໃນ" | "Vendor" | string;
  vendorName?: string; // ຊື່ Vendor
  minorTaskRepairerName?: string; // Minor-task employee or Vendor name; optional for legacy records
  assessmentDate: string; // ວັນທີປະເມີນ (YYYY-MM-DD)
  subItems: RepairSubItem[];
  assessmentRemark?: string; // ໝາຍເຫດການປະເມີນ
  assessmentStatus: "ລໍຖ້າປະເມີນລາຍການສ້ອມ" | "ກຳລັງປະເມີນ" | "ປະເມີນແລ້ວ" | "ລໍຖ້າອະນຸມັດ" | string;
}

export interface RepairPreset {
  id: string; // unique ID for the mapping
  sparePart: string; // ອະໄຫຼ່/ຄ່າບໍລິການ
  repairSubCategory: string; // ໝວດຍ່ອຍ
  repairSubItem: string; // ລາຍການສ້ອມຍ່ອຍ
  workType: string; // ຮູບແບບ
  unit: string; // ຫົວໜ່ວຍ
  estimatedUnitCost: number; // ລາຄາ Default
}

