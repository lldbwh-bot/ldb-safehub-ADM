/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import accountsData from './data/ ACCOUNT.json';
import repairMappingMasterData from './repairMappingMasterData.json';
import { queueCentralSnapshot, queueCentralUsers } from './centralDataStore';
import { isDemoPreviewHost } from './apiClient';
import checklistData from './data/checklistitem.json';
import appSheetMappingData from './data/AppSheet_Mapping.json';
import branchData from './data/ສາຂາ.json';
import sectorData from './data/ຂະແໜງ.json';
import assetCategoryData from './data/ໝວດຊັບສິນ.json';
import inspectionData from './data/ກວດກາອາຄານ INSPECTION.json';
import incidentData from './data/INCIDENT ບັນທຶກຂໍ້ມູນເຫດການທີ່ພ.json';
import approvalData from './data/ອະນຸມັດການສ້ອມແປງ.json';
import repairData from './data/ບັນທືກການສ້ອມແປງ.json';

// Safe localStorage wrapper to shadow the global one and prevent security crashes in sandboxed iframes
const inMemoryStorage: Record<string, string> = {};
const localStorage = (() => {
  try {
    const testKey = "__storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return window.localStorage;
  } catch (e) {
    console.warn("Standard localStorage is not accessible in this context. Using in-memory fallback.", e);
    return {
      getItem(key: string): string | null {
        return Object.prototype.hasOwnProperty.call(inMemoryStorage, key) ? inMemoryStorage[key] : null;
      },
      setItem(key: string, value: string): void {
        inMemoryStorage[key] = String(value);
      },
      removeItem(key: string): void {
        delete inMemoryStorage[key];
      },
      clear(): void {
        for (const k in inMemoryStorage) {
          delete inMemoryStorage[k];
        }
      },
      key(index: number): string | null {
        return Object.keys(inMemoryStorage)[index] || null;
      },
      get length(): number {
        return Object.keys(inMemoryStorage).length;
      }
    } as any;
  }
})();

export const LEGACY_ACCOUNTING_STORAGE_AREA_POINT =
  "ຫ້ອງສາງເຄື່ື່ອງຊັ້ນ 4 ຂອງ ຝ່າຍບັນຊີ";
export const CANONICAL_ACCOUNTING_STORAGE_AREA_POINT =
  "ຫ້ອງສາງເຄື່ອງຊັ້ນ4ຂອງຝ່າຍບັນຊີ";

export function canonicalizeAreaPointLabel(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text === LEGACY_ACCOUNTING_STORAGE_AREA_POINT
    ? CANONICAL_ACCOUNTING_STORAGE_AREA_POINT
    : text;
}

export function canonicalizeAreaPointData<T>(value: T): T {
  if (typeof value === "string") {
    return canonicalizeAreaPointLabel(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map(item => canonicalizeAreaPointData(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        canonicalizeAreaPointData(entry),
      ]),
    ) as T;
  }
  return value;
}

const AREA_POINT_STORAGE_KEYS = [
  "ldb_checklist_items_v10",
  "ldb_local_inspections",
  "ldb_local_incidents",
  "ldb_local_assessments",
  "ldb_local_approvals",
  "ldb_local_repair_tracking",
  "ldb_local_repairs",
  "ldb_pm_assets",
  "ldb_pm_history",
] as const;

export function migrateLegacyAreaPointStorage(): number {
  let migratedStores = 0;

  AREA_POINT_STORAGE_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (!raw || !raw.includes(LEGACY_ACCOUNTING_STORAGE_AREA_POINT)) return;

    try {
      const migrated = canonicalizeAreaPointData(JSON.parse(raw));
      localStorage.setItem(key, JSON.stringify(migrated));
      migratedStores += 1;
    } catch (error) {
      console.error(`Failed to migrate Area/Point data in ${key}`, error);
    }
  });

  return migratedStores;
}

migrateLegacyAreaPointStorage();

import { 
  UserAccount, 
  ChecklistItem, 
  BranchInfo, 
  SectorInfo, 
  AssetCategoryInfo, 
  InspectionRecord, 
  IncidentRecord, 
  RepairApprovalRecord, 
  RepairLogRecord,
  RepairTrackingRecord,
  PMAsset,
  PMHistoryRecord,
  RepairSubItem,
  RepairAssessmentRecord,
  RepairPreset
} from './types';

// Normalization Helpers
export function cleanString(str: any): string {
  if (str === undefined || str === null) return "";
  let val = String(str).trim();
  
  // Normalize spelling of Restroom "ຫ້ອງນໍ້າ" -> "ຫ້ອງນ້ຳ"
  val = val.replace(/ຫ້ອງນໍ້າ/g, "ຫ້ອງນ້ຳ");
  
  // Normalize spelling of Security System "ລະບົບຄວາມປອດໄພ" (handling double vowel combinations or spelling mistakes)
  val = val.replace(/ລະບົົບຄວາມປອດໄພ/g, "ລະບົບຄວາມປອດໄພ");
  val = val.replace(/ລະບົ້ບຄວາມປອດໄພ/g, "ລະບົບຄວາມປອດໄພ");
  
  // Normalize spelling of CCTV System "ລະບົບກ້ອງວົງຈອນCCTV"
  val = val.replace(/ລະບົົບ\s*ກ້ອງວົງຈອນ\s*CCTV/g, "ລະບົບກ້ອງວົງຈອນCCTV");
  val = val.replace(/ລະບົ້ບ\s*ກ້ອງວົງຈອນ\s*CCTV/g, "ລະບົບກ້ອງວົງຈອນCCTV");
  val = val.replace(/ລະບົ້ບກ້ອງວົງຈອນ/g, "ລະບົບກ້ອງວົງຈອນCCTV");
  val = val.replace(/ລະບົົບກ້ອງວົງຈອນ/g, "ລະບົບກ້ອງວົງຈອນCCTV");
  val = val.replace(/ລະບົບກ້ອງວົງຈອນ\s*CCTV/g, "ລະບົບກ້ອງວົງຈອນCCTV");
  val = val.replace(/ລະບົບກ້ອງວົງຈອນ/g, "ລະບົບກ້ອງວົງຈອນCCTV");
  val = val.replace(/ລະບົບກ້ອງວົງຈອນCCTVCCTV/g, "ລະບົບກ້ອງວົງຈອນCCTV");

  return canonicalizeAreaPointLabel(val);
}

export function formatExcelTime(serial: any): string {
  if (!serial) return "";
  const str = cleanString(serial);
  if (str.includes(":")) return str;
  const num = Number(str);
  if (isNaN(num)) return str;
  
  if (num >= 0 && num <= 1) {
    const totalSeconds = Math.round(num * 24 * 60 * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }
  return str;
}

// Format currency as Lao Kip (LAK)
export function formatLAK(amount: number | string | undefined): string {
  if (amount === undefined || amount === null) return "0 LAK";
  const num = Number(cleanString(amount).replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return cleanString(amount) || "0 LAK";
  return num.toLocaleString() + " LAK";
}

// Normalized Static Data
export const ACCOUNTS: UserAccount[] = accountsData.map((item: any) => ({
  username: cleanString(item.username),
  password_raw: cleanString(item["password "]), // Notice trailing space
  status: cleanString(item.status),
  branch: cleanString(item["ສາຂາ"] || item["ສາຂາ "]),
  image: cleanString(item.Image),
})).filter(acc => acc.username !== "");

export interface AppSheetMapping {
  Form_Type: string;
  ລະບົບທີ່ກວດ: string;
  ໝວດລະບົບກວດ: string;
  ລາຍການກວດ: string;
}

export const APPSHEET_MAPPING: AppSheetMapping[] = (() => {
  const rawList = (appSheetMappingData as any[]).map((item: any) => ({
    Form_Type: cleanString(item["Form_Type"]),
    ລະບົບທີ່ກວດ: cleanString(item["System (ລະບົບທີ່ກວດ)"]),
    ໝວດລະບົບກວດ: cleanString(item["Category (ໝວດລະບົບຍ່ອຍ)"]),
    ລາຍການກວດ: cleanString(item["Inspection Item (ລາຍການກວດກາ)"]),
  })).filter(item => 
    item.Form_Type !== "" && 
    item.ລະບົບທີ່ກວດ !== "" && 
    item.ລາຍການກວດ !== ""
  );

  const uniqueMap = new Map<string, AppSheetMapping>();
  rawList.forEach(item => {
    const key = `${item.Form_Type}|||${item.ລະບົບທີ່ກວດ}|||${item.ໝວດລະບົບກວດ}|||${item.ລາຍການກວດ}`;
    uniqueMap.set(key, item);
  });
  return Array.from(uniqueMap.values());
})();

export const CHECKLIST_ITEMS: ChecklistItem[] = (() => {
  return APPSHEET_MAPPING.map(item => ({
    Form_Type: item.Form_Type,
    ລະບົບທີ່ກວດ: item.ລະບົບທີ່ກວດ,
    ໝວດລະບົບກວດ: item.ໝວດລະບົບກວດ,
    ລາຍການກວດ: item.ລາຍການກວດ,
  }));
})();

export function getSavedChecklistItems(): ChecklistItem[] {
  ensureDemoPreviewSeedData();
  const local = localStorage.getItem("ldb_checklist_items_v10");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error("Failed to parse saved checklist items, falling back to static CHECKLIST_ITEMS", e);
    }
  }
  localStorage.setItem("ldb_checklist_items_v10", JSON.stringify(CHECKLIST_ITEMS));
  return CHECKLIST_ITEMS;
}

export function saveChecklistItems(list: ChecklistItem[]) {
  localStorage.setItem("ldb_checklist_items_v10", JSON.stringify(list));
  return queueCentralSnapshot("checklist-items", list as unknown as Record<string, unknown>[]);
}

export const BRANCHES: BranchInfo[] = branchData.map((item: any) => ({
  ລຳດັບ: Number(item["ລຳດັບ"]),
  ສາຂາ: cleanString(item["ສາຂາ"]),
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": cleanString(item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || item["ຝ່າຍ/ໜ່ວຍບໍລິການ "])
})).filter(b => b.ສາຂາ !== "");

export function getSavedBranches(): BranchInfo[] {
  ensureDemoPreviewSeedData();
  const local = localStorage.getItem("ldb_branches");
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved branches, falling back to static BRANCHES", e);
    }
  }
  localStorage.setItem("ldb_branches", JSON.stringify(BRANCHES));
  return BRANCHES;
}

export function saveBranches(list: BranchInfo[]) {
  localStorage.setItem("ldb_branches", JSON.stringify(list));
  return queueCentralSnapshot("branches", list as unknown as Record<string, unknown>[]);
}

const rawSectors = sectorData.map((item: any) => ({
  ຂະແໜງ: cleanString(item["ຂະແໜງ"]),
})).filter(s => {
  const val = s.ຂະແໜງ.trim();
  if (!val) return false;
  return val.startsWith("ຂະ") || val.includes("ຂະແໜງ") || val.includes("ຂະเເໜງ");
});

const uniqueSectorsMap = new Map<string, SectorInfo>();
rawSectors.forEach(s => {
  uniqueSectorsMap.set(s.ຂະແໜງ, s);
});

export const SECTORS: SectorInfo[] = [
  { ຂະແໜງ: "none" },
  ...Array.from(uniqueSectorsMap.values())
];

export function getSavedSectors(): SectorInfo[] {
  ensureDemoPreviewSeedData();
  const local = localStorage.getItem("ldb_sectors");
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved sectors, falling back to static SECTORS", e);
    }
  }
  localStorage.setItem("ldb_sectors", JSON.stringify(SECTORS));
  return SECTORS;
}

export function saveSectors(list: SectorInfo[]) {
  localStorage.setItem("ldb_sectors", JSON.stringify(list));
  return queueCentralSnapshot("sectors", list as unknown as Record<string, unknown>[]);
}

export const ASSET_CATEGORIES: AssetCategoryInfo[] = assetCategoryData.map((item: any) => ({
  ພາກສ່ວນ: cleanString(item["ພາກສ່ວນ"]),
})).filter(a => a.ພາກສ່ວນ !== "");

// Initial Seed Data normalized from sheets
const BASE_INSPECTIONS: InspectionRecord[] = inspectionData.map((item: any) => ({
  "ລ/ດ": item["ລ/ດ"] || "",
  PID: cleanString(item.PID),
  ລະຫັດກວດກາ: cleanString(item["ລະຫັດກວດກາ"]),
  ວັນທີ່ກວດ: item["ວັນທີ່ກວດ"] || "",
  ເວລາກວດ: item["ເວລາກວດ"] || "",
  ຜູ້ກວດກາ: cleanString(item["ຜູ້ກວດກາ"]),
  ຊື່ຜູ້ກວດ: cleanString(item["ຊື່ຜູ້ກວດ"]),
  ສະຖານທີ: cleanString(item["ສະຖານທີ"]),
  ສະຖານທີ່_ຫ້ອງ: cleanString(item["ສະຖານທີ່_ຫ້ອງ"] || item["ສະຖານທີ່ / ຫ້ອງ"] || item["Specify Room/Location"] || "ບໍ່ລະບຸ"),
  "ສາຂາ ": cleanString(item["ສາຂາ "] || item["ສາຂາ"]),
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": cleanString(item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]),
  ຂະແໜງ: cleanString(item["ຂະແໜງ"]),
  ຊັ້ນອາຄານ: item["ຊັ້ນອາຄານ"] || "",
  ຮູບແບບການກວດ: cleanString(item["ຮູບແບບການກວດ"]),
  ລະບົບທີ່ກວດ: cleanString(item["ລະບົບທີ່ກວດ"]),
  ໝວດລະບົບກວດ: cleanString(item["ໝວດລະບົບກວດ"]),
  ລາຍການກວດ: cleanString(item["ລາຍການກວດ"]),
  ສະຖານະ: (cleanString(item["ສະຖານະ"]) === "ຜິດປົກກະຕີ" ? "ຜິດປົກກະຕີ" : "ປົກກະຕີ") as "ປົກກະຕີ" | "ຜິດປົກກະຕີ",
  ຈຳນວນເຫດການທີ່ພົບ: Number(item["ຈຳນວນເຫດການທີ່ພົບ"] || 0),
  ເດືອນ: Number(item["ເດືອນ"] || 6),
  ປີ: Number(item["ປີ"] || 2026),
  ຮັບອໍເດີ: Number(item["ຮັບອໍເດີ"] || 0),
  ຈຳນວນຄົງຄ້າງ: Number(item["ຈຳນວນຄົງຄ້າງ"] || 0),
  ສະຖານະຮັບ: cleanString(item["ສະຖານະຮັບ"]),
  "key status": cleanString(item["key status"]),
})).filter((item: any) => item.PID !== "");

// Helper functions to infer asset details dynamically for pre-seeded database items
export function inferAssetBranch(item: any): string {
  if (item.ສາຂາຊັບສິນ) return cleanString(item.ສາຂາຊັບສິນ);
  return cleanString(item["ສາຂາ "] || item["ສາຂາ"] || "none");
}

export function inferAssetUnit(item: any): string {
  if (item.ຝ່າຍຊັບສິນ) return cleanString(item.ຝ່າຍຊັບສິນ);
  return cleanString(item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "none");
}

export function inferAssetSector(item: any): string {
  if (item.ຂະແໜງຊັບສິນ) return cleanString(item.ຂະແໜງຊັບສິນ);
  
  const system = cleanString(item["ລະບົບທີ່ກວດ"] || "");
  const category = cleanString(item["ໝວດລະບົົບກວດ"] || item["ໝວດລະບົບກວດ"] || "");
  const assetCategory = cleanString(item["ພາກສ່ວນຊັບສົມບັດ"] || "");
  const assetGroup = cleanString(item["ໝວດລາຍການ"] || "");
  const name = cleanString(item["ລາຍການ"] || "");
  const issue = cleanString(item["ລາຍລະອຽດປັນຫາທີ່ພົບ"] || "");
  const sector = cleanString(item["ຂະແໜງ"] || "");

  // IT & Computers logic
  const isIT = /notebook|laptop|computer|printer|asus|dell|hp|cnet|network|wifi|router|switch|it|server/i.test(
    assetGroup + " " + name + " " + assetCategory + " " + issue
  );
  if (isIT) {
    return "ຂະແໜງ ໄອທີ";
  }

  // Security & CCTV logic 
  const isSecurity = /ກ້ອງ|cctv|security|fire|alarm|sensor|ລະບົບຄວາມປອດໄພ|ແຈ້ງເຕືອນ|ດັກຈັບ/i.test(
    system + " " + category + " " + name
  );
  if (isSecurity) {
    return "ຂະແໜງ ບໍລິຫານ";
  }

  // Accounting / Safes logic
  const isAccounting = /accounting|finance|money|cash|vault|ຕູ້ເຊັບ|ນັບເງິນ|ບັນຊີ/i.test(
    assetGroup + " " + name + " " + assetCategory
  );
  if (isAccounting) {
    return "ຂະແໜງບັນຊີ";
  }

  // General operations / fallbacks
  if (sector === "ຂະແແໜງ ບໍລິການ" || sector === "ຂະແໜງ ບໍລິການ") {
    return "ຂະແໜງ ບໍລິຫານ";
  }
  
  return "ຂະແໜງ ບໍລິການ";
}

const BASE_INCIDENTS: IncidentRecord[] = incidentData.map((item: any) => ({
  "ລ/ດ": item["ລ/ດ"] || "",
  PID: cleanString(item.PID),
  ລະຫັດກວດກາ: cleanString(item["ລະຫັດກວດກາ"]),
  ລະບົບທີ່ກວດ: cleanString(item["ລະບົບທີ່ກວດ"]),
  ໝວດລະບົບກວດ: cleanString(item["ໝວດລະບົບກວດ"]),
  ລາຍການກວດ: cleanString(item["ລາຍການກວດ"]),
  ລະຫັດຊັບສິນ: cleanString(item["ລະຫັດຊັບສິນ"]),
  ພາກສ່ວນຊັບສົມບັດ: cleanString(item["ພາກສ່ວນຊັບສົມບັດ"]),
  ໝວດລາຍການ: cleanString(item["ໝວດລາຍການ"]),
  ລາຍການ: cleanString(item["ລາຍການ"]),
  ຮູບພາບລາຍການທີ່ເພ: cleanString(item["ຮູບພາບລາຍການທີ່ເພ"]),
  ລາຍລະອຽດປັນຫາທີ່ພົບ: cleanString(item["ລາຍລະອຽດປັນຫາທີ່ພົບ"]),
  ...{
    "ສາຂາຊັບສິນ": inferAssetBranch(item),
    "ຝ່າຍຊັບສິນ": inferAssetUnit(item),
    "ຂະແໜງຊັບສິນ": inferAssetSector(item),
  } as any,
  ປະເມີນຜົນກະທົບ: cleanString(item["ປະເມີນຜົນກະທົບ"]),
  ວີທີແກ້ໄຂ: cleanString(item["ວີທີແກ້ໄຂ"]),
  ...{
    "ສາຂາຊັບສິນ": inferAssetBranch(item),
    "ຝ່າຍຊັບສິນ": inferAssetUnit(item),
    "ຂະແໜງຊັບສິນ": inferAssetSector(item),
  } as any,
  ວັນທີ່ກວດ: item["ວັນທີ່ກວດ"] || "",
  ເວລາກວດ: item["ເວລາກວດ"] || "",
  ຜູ້ກວດກາ: cleanString(item["ຜູ້ກວດກາ"]),
  ຊື່ຜູ້ກວດ: cleanString(item["ຊື່ຜູ້ກວດ"]),
  ສະຖານທີພົບເຫດການ: cleanString(item["ສະຖານທີພົບເຫດການ"]),
  ສະຖານທີ່_ຫ້ອງ: cleanString(item["ສະຖານທີ່_ຫ້ອງ"] || item["ສະຖານທີ່ / ຫ້ອງ"] || item["Specify Room/Location"] || "ບໍ່ລະບຸ"),
  "ສາຂາ ": cleanString(item["ສາຂາ "] || item["ສາຂາ"]),
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": cleanString(item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]),
  ຂະແໜງ: cleanString(item["ຂະແໜງ"]),
  ຊັ້ນອາຄານ: item["ຊັ້ນອາຄານ"] || "",
  ເດືອນ: Number(item["ເດືອນ"] || 6),
  ປີ: Number(item["ປີ"] || 2026),
  order: Number(item["order"] || 0),
  ຮັບອໍເດີ: Number(item["ຮັບອໍເດີ"] || 0),
  ຈຳນວນຄົງຄ້າງ: Number(item["ຈຳນວນຄົງຄ້າງ"] || 0),
  ສະຖານະ: cleanString(item["ສະຖານະ"]),
  "key status": cleanString(item["key status"]),
})).filter((item: any) => item.PID !== "");

const BASE_APPROVALS: RepairApprovalRecord[] = approvalData.map((item: any) => ({
  "ລ/ດ": item["ລ/ດ"] || "",
  PID: cleanString(item.PID),
  ລະຫັດກວດກາ: cleanString(item["ລະຫັດກວດກາ"]),
  ລະບົບທີ່ກວດ: cleanString(item["ລະບົບທີ່ກວດ"]),
  ໝວດລະບົບກວດ: cleanString(item["ໝວດລະບົບກວດ"]),
  ລາຍການກວດ: cleanString(item["ລາຍການກວດ"]),
  ລະຫັດຊັບສິນ: cleanString(item["ລະຫັດຊັບສິນ"]),
  ພາກສ່ວນຊັບສົມບັດ: cleanString(item["ພາກສ່ວນຊັບສົມບັດ"]),
  ໝວດລາຍການ: cleanString(item["ໝວດລາຍການ"]),
  ລາຍການ: cleanString(item["ລາຍການ"]),
  ຮູບພາບລາຍການທີ່ເພ: cleanString(item["ຮູບພາບລາຍການທີ່ເພ"]),
  ລາຍລະອຽດປັນຫາທີ່ພົບ: cleanString(item["ລາຍລະອຽດປັນຫາທີ່ພົບ"]),
  ປະເມີນຜົນກະທົບ: cleanString(item["ປະເມີນຜົນກະທົບ"]),
  ວີທີແກ້ໄຂ: cleanString(item["ວີທີແກ້ໄຂ"]),
  ວັນທີ່ກວດ: item["ວັນທີ່ກວດ"] || "",
  ເວລາກວດ: item["ເວລາກວດ"] || "",
  ຜູ້ກວດກາ: cleanString(item["ຜູ້ກວດກາ"]),
  ຊື່ຜູ້ກວດ: cleanString(item["ຊື່ຜູ້ກວດ"]),
  ສະຖານທີພົບເຫດການ: cleanString(item["ສະຖານທີພົບເຫດການ"]),
  ສະຖານທີ່_ຫ້ອງ: cleanString(item["ສະຖານທີ່_ຫ້ອງ"] || item["ສະຖານທີ່ / ຫ້ອງ"] || item["Specify Room/Location"] || "ບໍ່ລະບຸ"),
  "ສາຂາ ": cleanString(item["ສາຂາ "] || item["ສາຂາ"]),
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": cleanString(item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]),
  ຂະແໜງ: cleanString(item["ຂະແໜງ"]),
  ສາຂາຊັບສິນ: inferAssetBranch(item),
  ຝ່າຍຊັບສິນ: inferAssetUnit(item),
  ຂະແໜງຊັບສິນ: inferAssetSector(item),
  ຊັ້ນອາຄານ: item["ຊັ້ນອາຄານ"] || "",
  ການດຳເນີນງານ: cleanString(item["ການດຳເນີນງານ"]),
  "vendor ຜູ້ສະໜອງ": cleanString(item["vendor ຜູ້ສະໜອງ"]),
  ວັນທີ່ອະນຸມັດ: item["ວັນທີ່ອະນຸມັດ"] || "",
  ຜູ້ອະນຸມັດ: cleanString(item["ຜູ້ອະນຸມັດ"]),
  ເອກະສານອະນຸມັດ: cleanString(item["ເອກະສານອະນຸມັດ"]),
  ເດືອນ: Number(item["ເດືອນ"] || 6),
  ປີ: Number(item["ປີ"] || 2026),
  order: Number(item["order"] || 0),
  ຮັບອໍເດີ: Number(item["ຮັບອໍເດີ"] || 0),
  ຈຳນວນຄົງຄ້າງ: Number(item["ຈຳນວນຄົງຄ້າງ"] || 0),
  ສະຖານະ: cleanString(item["ສະຖານະ"]),
  "key status": cleanString(item["key status"]),
})).filter((item: any) => item.PID !== "");

const BASE_REPAIRS: RepairLogRecord[] = repairData.map((item: any) => ({
  "ລ/ດ": item["ລ/ດ"] || "",
  PID: cleanString(item.PID),
  ລະຫັດກວດກາ: cleanString(item["ລະຫັດກວດກາ"]),
  ລະບົບທີ່ກວດ: cleanString(item["ລະບົບທີ່ກວດ"]),
  ໝວດລະບົບກວດ: cleanString(item["ໝວດລະບົບກວດ"]),
  ລາຍການກວດ: cleanString(item["ລາຍການກວດ"]),
  ລະຫັດຊັບສິນ: cleanString(item["ລະຫັດຊັບສິນ"]),
  ພາກສ່ວນຊັບສົມບັດ: cleanString(item["ພາກສ່ວນຊັບສົມບັດ"]),
  ໝວດລາຍການ: cleanString(item["ໝວດລາຍການ"]),
  ລາຍການ: cleanString(item["ລາຍການ"]),
  ຮູບພາບກ່ອນສ້ອມແປງ: cleanString(item["ຮູບພາບກ່ອນສ້ອມແປງ"] || item["ຮູບພາບລາຍການທີ່ເພ"]),
  ລາຍລະອຽດປັນຫາທີ່ພົບ: cleanString(item["ລາຍລະອຽດປັນຫາທີ່ພົບ"]),
  ປະເມີນຜົນກະທົບ: cleanString(item["ປະເມີນຜົນກະທົບ"]),
  ວີທີແກ້ໄຂ: cleanString(item["ວີທີແກ້ໄຂ"]),
  ວັນທີ່ກວດ: item["ວັນທີ່ກວດ"] || "",
  ເວລາກວດ: item["ເວລາກວດ"] || "",
  ຜູ້ກວດກາ: cleanString(item["ຜູ້ກວດກາ"]),
  ຊື່ຜູ້ກວດ: cleanString(item["ຊື່ຜູ້ກວດ"]),
  ສະຖານທີ່_ຫ້ອງ: cleanString(item["ສະຖານທີ່_ຫ້ອງ"] || item["ສະຖານທີ່ / ຫ້ອງ"] || item["Specify Room/Location"] || "ບໍ່ລະບຸ"),
  "ສາຂາ ": cleanString(item["ສາຂາ "] || item["ສາຂາ"]),
  "ຝ່າຍ/ໜ່ວຍບໍລິການ": cleanString(item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]),
  ຂະແໜງ: cleanString(item["ຂະແໜງ"]),
  ສາຂາຊັບສິນ: inferAssetBranch(item),
  ຝ່າຍຊັບສິນ: inferAssetUnit(item),
  ຂະແໜງຊັບສິນ: inferAssetSector(item),
  ຊັ້ນອາຄານ: item["ຊັ້ນອາຄານ"] || "",
  ການດຳເນີນການ: cleanString(item["ການດຳເນີນການ"]),
  "vendor ຜູ້ສະໜອງ": cleanString(item["vendor ຜູ້ສະໜອງ"]),
  ວັນທີ່ສ້ອມແປງ: item["ວັນທີ່ສ້ອມແປງ"] || "",
  ຜົນການແກ້ໄຂ: cleanString(item["ຜົນການແກ້ໄຂ"]),
  ຜົນທົດສອບ: cleanString(item["ຜົນທົດສອບ"]),
  ຮູບພາຍຫຼັງການແກ້ໄຂ: cleanString(item["ຮູບພາຍຫຼັງການແກ້ໄຂ"]),
  ມູນຄ່າສ້ອມແປງ: Number(item["ມູນຄ່າສ້ອມແປງ"] || 0),
  ຊຸດເອກະສານຈ່າຍເງິນ: cleanString(item["ຊຸດເອກະສານຈ່າຍເງິນ"]),
  ວັນທີ່ສຳເລັດ: item["ວັນທີ່ສຳເລັດ"] || "",
  ລວມມື້ທີ່ສຳເລັດ: Number(item["ລວມມື້ທີ່ສຳເລັດ"] || 0),
  ເດືອນ: Number(item["ເດືອນ"] || 6),
  ປີ: Number(item["ປີ"] || 2026),
  order: Number(item["order"] || 0),
  ສະຖານະ: cleanString(item["ສະຖານະ"]),
  "key status": cleanString(item["key status"]),
})).filter((item: any) => item.PID !== "");


// Deleted PIDs Tracker for Admin deletions
export function getDeletedPIDs(): string[] {
  const local = localStorage.getItem("ldb_deleted_pids");
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse ldb_deleted_pids", e);
    }
  }
  return [];
}

export function saveDeletedPIDs(list: string[]) {
  localStorage.setItem("ldb_deleted_pids", JSON.stringify(list));
}

export function addDeletedPIDs(pids: string[]) {
  const current = getDeletedPIDs();
  const next = Array.from(new Set([...current, ...pids]));
  saveDeletedPIDs(next);
}

export function clearDeletedPIDs() {
  localStorage.removeItem("ldb_deleted_pids");
}

// Local Storage Load / Merging
export function getSavedInspections(): InspectionRecord[] {
  const local = localStorage.getItem("ldb_local_inspections");
  let localList: InspectionRecord[] = [];
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved inspections from localStorage", e);
    }
  }
  
  if (localStorage.getItem("ldb_base_data_cleared") === "true") {
    return localList;
  }
  
  const deletedPids = getDeletedPIDs();
  const map = new Map<string, InspectionRecord>();
  BASE_INSPECTIONS.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  localList.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  return Array.from(map.values());
}

// Helper to clean/optimize large base64 file payloads to avoid QuotaExceededError in localStorage
function cleanRecordForStorage<T>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  const cleaned = { ...record } as any;
  for (const key in cleaned) {
    if (typeof cleaned[key] === 'string' && cleaned[key].length > 50000) {
      if (cleaned[key].includes('|')) {
        const parts = cleaned[key].split('|');
        if (parts[1] && parts[1].startsWith('data:')) {
          cleaned[key] = `${parts[0]}|[Large File Truncated for Storage]`;
        } else {
          cleaned[key] = `[Large Content Truncated]`;
        }
      } else if (cleaned[key].startsWith('data:')) {
        cleaned[key] = `[Truncated Base64]`;
      }
    }
  }
  return cleaned;
}

export function saveInspections(list: InspectionRecord[]) {
  queueCentralSnapshot("inspections", list as unknown as Record<string, unknown>[]);
  const localList = list.filter(item => {
    const base = BASE_INSPECTIONS.find(b => b.PID === item.PID);
    if (!base) return true; // Newly created
    // Check if anything changed
    return JSON.stringify(base) !== JSON.stringify(item);
  });
  
  try {
    localStorage.setItem("ldb_local_inspections", JSON.stringify(localList));
  } catch (err) {
    console.warn("localStorage quota warnings, cleaning files...", err);
    try {
      const optimized = localList.map(item => cleanRecordForStorage(item));
      localStorage.setItem("ldb_local_inspections", JSON.stringify(optimized));
    } catch (innerErr) {
      console.error("Failed to save inspections to localStorage after optimization", innerErr);
    }
  }
}

export function getSavedIncidents(): IncidentRecord[] {
  const local = localStorage.getItem("ldb_local_incidents");
  let localList: IncidentRecord[] = [];
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved incidents from localStorage", e);
    }
  }
  
  if (localStorage.getItem("ldb_base_data_cleared") === "true") {
    return localList;
  }
  
  const deletedPids = getDeletedPIDs();
  const map = new Map<string, IncidentRecord>();
  BASE_INCIDENTS.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  localList.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  return Array.from(map.values());
}

export function saveIncidents(list: IncidentRecord[]) {
  queueCentralSnapshot("incidents", list as unknown as Record<string, unknown>[]);
  const localList = list.filter(item => {
    const base = BASE_INCIDENTS.find(b => b.PID === item.PID);
    if (!base) return true;
    return JSON.stringify(base) !== JSON.stringify(item);
  });
  
  try {
    localStorage.setItem("ldb_local_incidents", JSON.stringify(localList));
  } catch (err) {
    console.warn("localStorage quota warnings, cleaning files...", err);
    try {
      const optimized = localList.map(item => cleanRecordForStorage(item));
      localStorage.setItem("ldb_local_incidents", JSON.stringify(optimized));
    } catch (innerErr) {
      console.error("Failed to save incidents to localStorage after optimization", innerErr);
    }
  }
}

export function getSavedAssessments(): RepairAssessmentRecord[] {
  const local = localStorage.getItem("ldb_local_assessments");
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved assessments from localStorage", e);
    }
  }
  return [];
}

export function saveAssessments(list: RepairAssessmentRecord[]) {
  queueCentralSnapshot("assessments", list as unknown as Record<string, unknown>[]);
  try {
    localStorage.setItem("ldb_local_assessments", JSON.stringify(list));
  } catch (err) {
    console.warn("localStorage quota warnings, cleaning files for assessments...", err);
    try {
      const optimized = list.map(item => cleanRecordForStorage(item));
      localStorage.setItem("ldb_local_assessments", JSON.stringify(optimized));
    } catch (innerErr) {
      console.error("Failed to save assessments to localStorage after optimization", innerErr);
    }
  }
}

export function getSavedApprovals(): RepairApprovalRecord[] {
  const local = localStorage.getItem("ldb_local_approvals");
  let localList: RepairApprovalRecord[] = [];
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved approvals from localStorage", e);
    }
  }
  
  if (localStorage.getItem("ldb_base_data_cleared") === "true") {
    return localList;
  }
  
  const deletedPids = getDeletedPIDs();
  const map = new Map<string, RepairApprovalRecord>();
  BASE_APPROVALS.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  localList.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  return Array.from(map.values());
}

export function saveApprovals(list: RepairApprovalRecord[]) {
  queueCentralSnapshot("approvals", list as unknown as Record<string, unknown>[]);
  const localList = list.filter(item => {
    const base = BASE_APPROVALS.find(b => b.PID === item.PID);
    if (!base) return true;
    return JSON.stringify(base) !== JSON.stringify(item);
  });
  
  try {
    localStorage.setItem("ldb_local_approvals", JSON.stringify(localList));
  } catch (err) {
    console.warn("localStorage quota warnings, cleaning files...", err);
    try {
      const optimized = localList.map(item => cleanRecordForStorage(item));
      localStorage.setItem("ldb_local_approvals", JSON.stringify(optimized));
    } catch (innerErr) {
      console.error("Failed to save approvals to localStorage after optimization", innerErr);
    }
  }
}

export function getSavedRepairs(): RepairLogRecord[] {
  const local = localStorage.getItem("ldb_local_repairs");
  let localList: RepairLogRecord[] = [];
  if (local) {
    try {
      localList = JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse saved repairs from localStorage", e);
    }
  }
  
  if (localStorage.getItem("ldb_base_data_cleared") === "true") {
    return localList;
  }
  
  const deletedPids = getDeletedPIDs();
  const map = new Map<string, RepairLogRecord>();
  BASE_REPAIRS.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  localList.forEach(item => {
    if (!deletedPids.includes(item.PID)) {
      map.set(item.PID, item);
    }
  });
  return Array.from(map.values());
}

export function saveRepairs(list: RepairLogRecord[]) {
  queueCentralSnapshot("repairs", list as unknown as Record<string, unknown>[]);
  const localList = list.filter(item => {
    const base = BASE_REPAIRS.find(b => b.PID === item.PID);
    if (!base) return true;
    return JSON.stringify(base) !== JSON.stringify(item);
  });
  
  try {
    localStorage.setItem("ldb_local_repairs", JSON.stringify(localList));
  } catch (err) {
    console.warn("localStorage quota warnings, cleaning files...", err);
    try {
      const optimized = localList.map(item => cleanRecordForStorage(item));
      localStorage.setItem("ldb_local_repairs", JSON.stringify(optimized));
    } catch (innerErr) {
      console.error("Failed to save repairs to localStorage after optimization", innerErr);
    }
  }
}

export function getSavedUsers(): UserAccount[] {
  ensureDemoPreviewSeedData();
  const staticPasswords = new Map(
    ACCOUNTS.map(acc => [
      acc.username.normalize("NFKC").toLocaleLowerCase("en-US"),
      acc.password_raw || "",
    ]),
  );
  const local = localStorage.getItem("ldb_users");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed)) {
        let migrated = false;
        const updated = (parsed as UserAccount[]).map(u => {
          let newTabs = u.allowedTabs ? [...u.allowedTabs] : [];
          if (u.allowedTabs && !u.allowedTabs.includes("tracking")) {
            migrated = true;
            const idx = newTabs.indexOf("repairs");
            if (idx !== -1) {
              newTabs.splice(idx, 0, "tracking");
            } else {
              newTabs.push("tracking");
            }
          }
          if (u.allowedTabs && !newTabs.includes("pm")) {
            migrated = true;
            const idx = newTabs.indexOf("inspections");
            if (idx !== -1) {
              newTabs.splice(idx, 0, "pm");
            } else {
              const idxInc = newTabs.indexOf("incidents");
              if (idxInc !== -1) {
                newTabs.splice(idxInc, 0, "pm");
              } else {
                newTabs.push("pm");
              }
            }
          }
          if (u.allowedTabs && !newTabs.includes("assessment")) {
            migrated = true;
            const idxInc = newTabs.indexOf("incidents");
            if (idxInc !== -1) {
              newTabs.splice(idxInc + 1, 0, "assessment");
            } else {
              newTabs.push("assessment");
            }
          }
          
          // Ensure correct ordering where pm is placed before inspections
          const idxPm = newTabs.indexOf("pm");
          const idxIns = newTabs.indexOf("inspections");
          if (idxPm !== -1 && idxIns !== -1 && idxPm > idxIns) {
            migrated = true;
            newTabs.splice(idxPm, 1);
            const newIdxIns = newTabs.indexOf("inspections");
            newTabs.splice(newIdxIns, 0, "pm");
          }
          
          const fallbackPassword = staticPasswords.get(
            String(u.username || "").normalize("NFKC").toLocaleLowerCase("en-US"),
          ) || "";
          const normalizedUser = {
            ...u,
            password_raw: u.password_raw || fallbackPassword,
          };
          return migrated ? { ...normalizedUser, allowedTabs: newTabs } : normalizedUser;
        });
        if (migrated) {
          localStorage.setItem("ldb_users", JSON.stringify(updated));
        }
        return updated;
      }
    } catch (e) {
      console.error("Failed to parse saved users, falling back to static ACCOUNTS", e);
    }
  }
  
  const defaultList = ACCOUNTS.map(acc => ({
    ...acc,
    allowedTabs: acc.allowedTabs || (acc.status === "Admin" 
      ? ["dashboard", "pm", "inspections", "incidents", "assessment", "approvals", "tracking", "repairs", "accounts"]
      : ["dashboard", "pm", "inspections", "incidents", "assessment", "approvals", "tracking", "repairs"])
  }));
  localStorage.setItem("ldb_users", JSON.stringify(defaultList));
  return defaultList;
}

export function saveUsers(list: UserAccount[]) {
  localStorage.setItem("ldb_users", JSON.stringify(list));
  return queueCentralUsers(list as unknown as (Record<string, unknown> & { username: string })[]);
}

export function findIncidentByPID(pid: string): IncidentRecord | undefined {
  if (!pid) return undefined;
  const list = getSavedIncidents();
  return list.find(inc => inc.PID === pid);
}

export function getSavedRepairTracking(): RepairTrackingRecord[] {
  const local = localStorage.getItem("ldb_local_repair_tracking");
  let list: RepairTrackingRecord[] = [];
  let loadedFromLocal = false;
  if (local) {
    try {
      list = JSON.parse(local);
      loadedFromLocal = true;
    } catch (e) {
      console.error("Failed to parse saved repair tracking from localStorage", e);
    }
  }
  
  if (!loadedFromLocal) {
    // Smart seeding from existing non-completed and completed approvals to populate mock dashboard data instantly
    const approvals = getSavedApprovals();
    if (approvals && approvals.length > 0) {
      const seed: RepairTrackingRecord[] = approvals.map(app => {
        const isCompleted = app.ສະຖານະ === "ສຳເລັດ" || app.ສະຖານະ === "ສໍາເລັດ";
        const status = isCompleted ? "ປິດງານແລ້ວ" : "ລໍຖ້າເລີ່ມສ້ອມ";
        
        const impact = app.ປະເມີນຜົນກະທົບ || "ຕ່ຳ";
        let slaDays = 15;
        if (impact === "ສູງ") slaDays = 3;
        else if (impact === "ປານກາງ") slaDays = 7;
        
        let expectedStr = "";
        let startStr = "";
        let actualStr = "";
        let costVal = undefined;
        
        if (isCompleted) {
          startStr = formatDateSafe(parseDateSafe(app.ວັນທີ່ອະນຸມັດ || app.ວັນທີ່ກວດ));
          const expDate = parseDateSafe(startStr);
          expDate.setDate(expDate.getDate() + slaDays);
          expectedStr = formatDateSafe(expDate);
          actualStr = expectedStr; // fallback completed
          costVal = 1200000; // seed default cost
        } else {
          startStr = formatDateSafe(parseDateSafe(app.ວັນທີ່ອະນຸມັດ || app.ວັນທີ່ກວດ));
          const expDate = parseDateSafe(startStr);
          expDate.setDate(expDate.getDate() + slaDays);
          expectedStr = formatDateSafe(expDate);
        }

        return {
          PID: app.PID,
          ລະຫັດກວດກາ: app.ລະຫັດກວດກາ || "",
          ສະຖານທີ່_ຫ້ອງ: app.ສະຖານທີ່_ຫ້ອງ || "ບໍ່ລະບຸ",
          "ສາຂາ ": app["ສາຂາ "] || "",
          "ຝ່າຍ/ໜ່ວຍບໍລິການ": app["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "",
          ຂະແໜງ: app.ຂະແໜງ || "",
          ຮູບແບບການກວດ: app.ຮູບແບບການກວດ || "ກວດກາອາຄານ",
          ລະບົບທີ່ກວດ: app.ລະບົບທີ່ກວດ || "",
          ໝວດລະບົບກວດ: app.ໝວດລະບົບກວດ || "",
          ລະຫັດຊັບສິນ: app.ລະຫັດຊັບສິນ || "",
          ລາຍການ: app.ລາຍການ || "",
          ພາກສ່ວນຊັບສົມບັດ: app.ພາກສ່ວນຊັບສົມບັດ || "",
          ໝວດລາຍການ: app.ໝວດລາຍການ || "",
          ສາຂາຊັບສິນ: app.ສາຂາຊັບສິນ || "",
          ຝ່າຍຊັບສິນ: app.ຝ່າຍຊັບສິນ || "",
          ຂະແໜງຊັບສິນ: app.ຂະແໜງຊັບສິນ || "",
          ລາຍລະອຽດປັນຫາທີ່ພົບ: app.ລາຍລະອຽດປັນຫາທີ່ພົບ || "",
          ວີທີແກ້ໄຂ: app.ວີທີແກ້ໄຂ || "",
          // Ensure impact is valid or fallback
          ປະເມີນຜົນກະທົບ: impact,
          // Make sure we have a valid problem
          problem: app.ລາຍລະອຽດປັນຫາທີ່ພົບ || app.ລາຍການ || "",
          // Ensure we have a valid category
          category: app.ໝວດລະບົບກວດ || "ອື່ນໆ",
          // Ensure status matches standard format
          status: isCompleted ? "ປິດງານແລ້ວ" : "ລໍຖ້າເລີ່ມສ້ອມ",
          // Keep additional fields
          ວັນທີ່ກວດ: app.ວັນທີ່ກວດ || "",
          ເວລາກວດ: app.ເວລາກວດ || "",
          // Merge missing fields
          ຜູ້ກວດກາ: app.ຜູ້ກວດກາ || "",
          ชື່ຜູ້ກວດ: app.ຊື່ຜູ້ກວດ || "",
          ສະຖານະ: isCompleted ? "ສຳເລັດ" : "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ",
          ວັນທີ່ອະນຸມັດ: app.ວັນທີ່ອະນຸມັດ || "",
          ຜູ້ອະນຸມັດ: app.ຜູ້ອະນຸມັດ || "",
          owner: "ພະນັກງານ ທພລ",
          vendor: app["vendor ຜູ້ສະໜອງ"] || "ບໍລິສັດ ຮັບເໝົາ",
          execution: app.ການດຳເນີນງານ || "ຈ້າງພາຍນອກ",
          startRepairDate: startStr,
          expectedFinishDate: expectedStr,
          actualFinishDate: actualStr,
          progressPercent: isCompleted ? 100 : 0,
          trackingStatus: status,
          slaStatus: isCompleted ? "ສຳເລັດແລ້ວ" : "ຢູ່ໃນກຳນົດ",
          repairResult: isCompleted ? "ສ້ອມແປງສຳເລັດ" : "",
          testResult: isCompleted ? "ທົດສອບຜ່ານ" : "",
          repairCost: costVal,
          closedAt: isCompleted ? actualStr : ""
        };
      });
      list = seed;
      try {
        localStorage.setItem("ldb_local_repair_tracking", JSON.stringify(seed));
      } catch (err) {
        console.warn("Storage quota warning on seed", err);
      }
    }
  }

  // Robust Deduplication: Use a Map to filter out any duplicate tracking records by PID
  const map = new Map<string, RepairTrackingRecord>();
  list.forEach(item => {
    if (item && item.PID) {
      map.set(item.PID, item);
    }
  });
  const dedupedList = Array.from(map.values());
  
  // If duplicates were filtered out, write back the cleaned list to localStorage
  if (loadedFromLocal && list.length !== dedupedList.length) {
    try {
      localStorage.setItem("ldb_local_repair_tracking", JSON.stringify(dedupedList));
    } catch (err) {
      console.warn("localStorage write error during deduplication", err);
    }
  }
  
  return dedupedList;
}

export function saveRepairTracking(list: RepairTrackingRecord[]) {
  queueCentralSnapshot("repair-tracking", list as unknown as Record<string, unknown>[]);
  try {
    localStorage.setItem("ldb_local_repair_tracking", JSON.stringify(list));
  } catch (err) {
    console.warn("localStorage quota warnings, cleaning files for repair tracking...", err);
    try {
      const optimized = list.map(item => cleanRecordForStorage(item));
      localStorage.setItem("ldb_local_repair_tracking", JSON.stringify(optimized));
    } catch (innerErr) {
      console.error("Failed to save repair tracking to localStorage after optimization", innerErr);
    }
  }
}

export function parseDateSafe(dateVal: any): Date {
  if (!dateVal) return new Date();
  if (dateVal instanceof Date) return dateVal;
  const str = String(dateVal).trim();
  if (!str) return new Date();
  
  // Try DD/MM/YYYY or DD/MM/YY
  if (str.includes("/")) {
    const parts = str.split("/");
    if (parts.length === 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const yRaw = parseInt(parts[2], 10);
      const y = parts[2].trim().length <= 2 ? 2000 + yRaw : yRaw;
      const parsed = new Date(y, m, d);
      if (!isNaN(parsed.getTime())) return parsed;
    }
  }
  
  // Try YYYY-MM-DD
  if (str.includes("-")) {
    const parts = str.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) return parsed;
      } else {
        const d = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const yRaw = parseInt(parts[2], 10);
        const y = parts[2].trim().length <= 2 ? 2000 + yRaw : yRaw;
        const parsed = new Date(y, m, d);
        if (!isNaN(parsed.getTime())) return parsed;
      }
    }
  }

  // Fallback
  const res = new Date(str);
  if (!isNaN(res.getTime())) return res;
  return new Date();
}

export function formatDateSafe(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

export function formatTimeSafe(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatDateTimeSafe(date: Date = new Date()): string {
  return `${formatDateSafe(date)} ${formatTimeSafe(date)}`;
}

export function formatExcelDate(val: any): string {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (!str) return "";

  // 1. If it's a pure number (Excel serial number)
  const num = Number(str);
  if (!isNaN(num) && num > 20000 && num < 60000) {
    const date = new Date((num - 25569) * 86400 * 1000);
    const d = String(date.getUTCDate()).padStart(2, "0");
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const y = date.getUTCFullYear();
    return `${d}/${m}/${y}`;
  }

  // 2. If it's already in DD/MM/YYYY or DD/MM/YY format, normalize it
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
    const parts = str.split("/");
    const d = parts[0].padStart(2, "0");
    const m = parts[1].padStart(2, "0");
    const yRaw = parseInt(parts[2], 10);
    const y = parts[2].trim().length <= 2 ? 2000 + yRaw : yRaw;
    return `${d}/${m}/${y}`;
  }

  // 3. Otherwise, parse it safely and format as DD/MM/YY
  const date = parseDateSafe(str);
  if (!isNaN(date.getTime())) {
    return formatDateSafe(date);
  }

  return str;
}

export function calculateSLAStatus(expectedFinishDate: string | undefined, trackingStatus: string): string {
  if (trackingStatus === "ປິດງານແລ້ວ") {
    return "ສຳເລັດແລ້ວ";
  }
  if (!expectedFinishDate) {
    return "ຢູ່ໃນກຳນົດ";
  }
  
  const expected = parseDateSafe(expectedFinishDate);
  expected.setHours(23, 59, 59, 999);
  
  const now = new Date();
  const diffTime = expected.getTime() - now.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  if (diffTime < 0) {
    return "ເກີນກຳນົດ";
  } else if (diffDays <= 1.0) {
    return "ໃກ້ເກີນກຳນົດ";
  } else {
    return "ຢູ່ໃນກຳນົດ";
  }
}

// ==========================================
// PREVENTIVE MAINTENANCE STORAGE & LOGIC
// ==========================================

export function calculatePMAlertStatus(lastMaintenanceDate: string, nextMaintenanceDate: string, alertBeforeDays: number): string {
  if (!nextMaintenanceDate) return "ປົກກະຕິ";
  
  const nextDate = parseDateSafe(nextMaintenanceDate);
  nextDate.setHours(23, 59, 59, 999);
  
  const now = new Date();
  const diffTime = nextDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return "ເກີນກຳນົດ";
  } else if (diffDays === 0) {
    return "ຮອດກຳນົດ";
  } else if (diffDays <= alertBeforeDays) {
    return "ໃກ້ຮອດກຳນົດ";
  } else {
    return "ປົກກະຕິ";
  }
}

export function addCycleToDate(startDateStr: string, cycle: string, customDays?: number): string {
  const date = parseDateSafe(startDateStr);
  if (cycle === "7 ມື້") {
    date.setDate(date.getDate() + 7);
  } else if (cycle === "15 ມື້") {
    date.setDate(date.getDate() + 15);
  } else if (cycle === "1 ເດືອນ") {
    date.setMonth(date.getMonth() + 1);
  } else if (cycle === "3 ເດືອນ") {
    date.setMonth(date.getMonth() + 3);
  } else if (cycle === "6 ເດືອນ") {
    date.setMonth(date.getMonth() + 6);
  } else if (cycle === "1 ປີ") {
    date.setFullYear(date.getFullYear() + 1);
  } else if (cycle === "Custom" && customDays) {
    date.setDate(date.getDate() + customDays);
  } else {
    date.setMonth(date.getMonth() + 1); // fallback to 1 month
  }
  return formatDateSafe(date);
}

const DEFAULT_PM_ASSETS: PMAsset[] = [
  {
    assetCode: "PM-CCTV-001",
    assetName: "ລະບົບກ້ອງວົງຈອນປິດ CCTV ຫ້ອງໂຖງໃຫຍ່",
    assetCategory: "ພាកສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ",
    assetGroup: "CCTV",
    branch: "00.ສໍານັກງານໃຫຍ່",
    division: "ຝ່າຍບໍລິການ",
    sector: "ຂະແໜງ ບໍລິຫານ",
    floor: "1",
    locationDetail: "ຫ້ອງໂຖງຕ້ອນຮັບຊັ້ນ 1",
    systemCategory: "ລະບົບຄວາມປອດໄພ",
    subsystemCategory: "ລະບົບກ້ອງວົງຈອນCCTV",
    maintenanceCycle: "1 ເດືອນ",
    lastMaintenanceDate: "2026-06-01",
    nextMaintenanceDate: "2026-07-01",
    alertBeforeDays: 5,
    responsiblePerson: "ທ້າວ ສົມພອນ ແກ້ວມະນີ",
    vendor: "ບໍລິສັດ ໄອທີ ເຊີວິດ ຈຳກັດ",
    maintenanceStatus: "ປົກກະຕິ"
  },
  {
    assetCode: "PM-UPS-001",
    assetName: "ເຄື່ອງສຳຮອງໄຟຟ້າ UPS Server Room",
    assetCategory: "ພាកສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ",
    assetGroup: "UPS",
    branch: "00.ສໍານັກງານໃຫຍ່",
    division: "ຝ່າຍບໍລິການ",
    sector: "ຂະແໜງ ໄອທີ",
    floor: "3",
    locationDetail: "ຫ້ອງ Server ຊັ້ນ 3",
    systemCategory: "ລະບົບຄວາມປອດໄພ",
    subsystemCategory: "ລະບົບຄວບຄຸມການເຂົ້າອອກ",
    maintenanceCycle: "3 ເດືອນ",
    lastMaintenanceDate: "2026-04-15",
    nextMaintenanceDate: "2026-07-15",
    alertBeforeDays: 7,
    responsiblePerson: "ທ້າວ ວິໄຊ ພົມມະຈັນ",
    vendor: "ບໍລິສັດ ພາວເວີເທັກ ລາວ ຈຳກັດ",
    maintenanceStatus: "ປົກກະຕິ"
  },
  {
    assetCode: "PM-AIR-002",
    assetName: "ເຄື່ອງປັບອາກາດ Air Carrier 36,000 BTU",
    assetCategory: "ພាកສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ",
    assetGroup: "AIR_CONDITIONER",
    branch: "00.ສໍານັກງານໃຫຍ່",
    division: "ຝ່າຍບໍລິການ",
    sector: "ຂະແໜງ ບໍລິຫານ",
    floor: "2",
    locationDetail: "ຫ້ອງປະຊຸມໃຫຍ່ຊັ້ນ 2",
    systemCategory: "ດ້ານໃນອາຄານ",
    subsystemCategory: "ຫ້ອງປະຊຸມ",
    maintenanceCycle: "6 ເດືອນ",
    lastMaintenanceDate: "2026-01-10",
    nextMaintenanceDate: "2026-07-10",
    alertBeforeDays: 10,
    responsiblePerson: "ທ້າວ ຄຳໄສ ສີປະເສີດ",
    vendor: "ຮ້ານ ແອດີດີ ເຊີວິດ",
    maintenanceStatus: "ປົກກະຕິ"
  },
  {
    assetCode: "PM-GEN-001",
    assetName: "ເຄື່ອງປັ່ນໄຟສຳຮອງ Generator Cummins 250 kVA",
    assetCategory: "ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ",
    assetGroup: "GENERATOR",
    branch: "00.ສໍານັກງານໃຫຍ່",
    division: "ຝ່າຍບໍລິການ",
    sector: "ຂະແໜງ ບໍລິຫານ",
    floor: "G",
    locationDetail: "ໂຮງຈອດລົດດ້ານຫຼັງອາຄານ",
    systemCategory: "ດ້ານນອກອາຄານ",
    subsystemCategory: "ສະຖານທີ່ຈອດລົດ",
    maintenanceCycle: "3 ເດືອນ",
    lastMaintenanceDate: "2026-03-10",
    nextMaintenanceDate: "2026-06-10",
    alertBeforeDays: 7,
    responsiblePerson: "ທ້າວ ສົມບັດ ມີໄຊ",
    vendor: "ບໍລິສັດ ລາວເອັນຈિເນຍຣິງ ຈຳກັດ",
    maintenanceStatus: "ເກີນກຳນົດ"
  },
  {
    assetCode: "PM-FIRE-001",
    assetName: "ລະບົບແຈ້ງເຕືອນອັກຄີໄພ Fire Alarm Control Panel",
    assetCategory: "ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ",
    assetGroup: "FIRE_ALARM",
    branch: "00.ສໍານັກງານໃຫຍ່",
    division: "ຝ່າຍບໍລິການ",
    sector: "ຂະແໜງ ບໍລິຫານ",
    floor: "1",
    locationDetail: "ທາງເດີນຊັ້ນ 1 ໃກ້ຫ້ອງໄອທີ",
    systemCategory: "ລະບົບຄວາມປອດໄພ",
    subsystemCategory: "ລະບົບແຈ້ງເຕືອນອັກຄີໄພ",
    maintenanceCycle: "1 ປີ",
    lastMaintenanceDate: "2025-07-01",
    nextMaintenanceDate: "2026-07-01",
    alertBeforeDays: 15,
    responsiblePerson: "ທ້າວ ບຸນທັນ ຫຼວງໂຄດ",
    vendor: "ບໍລິສັດ ໄຟຣໂປຣເທັກ ຈຳກັດ",
    maintenanceStatus: "ໃກ້ຮອດກຳນົດ"
  },
  {
    assetCode: "PM-ATM-001",
    assetName: "ຕູ້ເອທີເອັມ ATM LDB Front Office",
    assetCategory: "ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ",
    assetGroup: "ATM",
    branch: "00.ສໍານັກງານໃຫຍ່",
    division: "ຝ່າຍບໍລິການ",
    sector: "ຂະແໜງ ບໍລິຫານ",
    floor: "1",
    locationDetail: "ດ້ານໜ້າທາງເຂົ້າສໍານັກງານໃຫຍ່",
    systemCategory: "ດ້ານນອກອາຄານ",
    subsystemCategory: "ຕູ້ເອທີ ATM ດ້ານໜ້າອາຄານ",
    maintenanceCycle: "15 ມື້",
    lastMaintenanceDate: "2026-06-12",
    nextMaintenanceDate: "2026-06-27",
    alertBeforeDays: 3,
    responsiblePerson: "นาง ແກ້ວດາລາ ສຸວັນນາ",
    vendor: "ບໍລິສັດ ບີພີເອັສ ເຕັກໂນໂລຢີ ຈຳກັດ",
    maintenanceStatus: "ໃກ້ຮອດກຳນົດ"
  }
];

export function getSavedPMAssets(): PMAsset[] {
  ensureDemoPreviewSeedData();
  const isBaseCleared = localStorage.getItem("ldb_base_data_cleared") === "true";
  const local = localStorage.getItem("ldb_pm_assets");
  let assets: PMAsset[] = [];
  if (local) {
    try {
      assets = JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse PM Assets", e);
      assets = [];
    }
  } else {
    assets = [];
  }
  
  // Recalculate status dynamically based on current date
  let changed = false;
  const recalculated = assets.map(asset => {
    const status = calculatePMAlertStatus(asset.lastMaintenanceDate, asset.nextMaintenanceDate, asset.alertBeforeDays);
    if (asset.maintenanceStatus !== status) {
      changed = true;
      return { ...asset, maintenanceStatus: status };
    }
    return asset;
  });
  
  if (changed) {
    localStorage.setItem("ldb_pm_assets", JSON.stringify(recalculated));
    return recalculated;
  }
  
  return assets;
}

export function savePMAssets(list: PMAsset[]) {
  localStorage.setItem("ldb_pm_assets", JSON.stringify(list));
  queueCentralSnapshot("pm-assets", list as unknown as Record<string, unknown>[]);
}

export function getSavedPMHistory(): PMHistoryRecord[] {
  const local = localStorage.getItem("ldb_pm_history");
  if (local) {
    try {
      return JSON.parse(local);
    } catch (e) {
      console.error("Failed to parse PM History", e);
    }
  }
  return [];
}

export function savePMHistory(list: PMHistoryRecord[]) {
  localStorage.setItem("ldb_pm_history", JSON.stringify(list));
  queueCentralSnapshot("pm-history", list as unknown as Record<string, unknown>[]);
}

const LEGACY_REPAIR_PRESETS: RepairPreset[] = [
  {
    "id": "p1",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ມໍເຕີພັດລົມແຜງເຢັນຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ມໍເຕີພັດລົມແຜງເຢັນ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p2",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ຕູ້ຄວາມຄຸມ Safety switchຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຕູ້ຄວາມຄຸມ Safety switch",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p3",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ເຕີມນໍ້າຢາ R410A",
    "workType": "ບໍລິການ",
    "sparePart": "ນໍ້າຢາແອ R410A",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p4",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ແຜນເມນບອດຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ແຜນເມນບອດ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p5",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ໄຟຈ່າຍ ແຜງຮ້ອນ ແລະ ແຜງເຢັນ ແອ ເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ໄຟຈ່າຍ ແຜງຮ້ອນ ແລະ ແຜງເຢັນ ແອ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p6",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ທໍ່ນໍ້າແອເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ທໍ່ນໍ້າແອ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p7",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ປໍ້ານໍ້າເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ປໍ້ານໍ້າແອ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p8",
    "repairSubCategory": "ລະບົບ ແອເຟັນ",
    "repairSubItem": "ເຊັນເຊີຕາຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ເຊັນເຊີ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p9",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ດອກໄຟຕາແມວ ຂອບທອງຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟຕາແມວ ຂອບທອງ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p10",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ນໍ້າມັນຈັກປັ່ນໄຟສໍາຮອງບໍ່ພຽງພໍ-ນໍ້າມັນຂາດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ເຕີມນໍ້າມັນຈັກປັ່ນໄຟສໍາຮອງ",
    "unit": "ລິດ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p11",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼັກສາຍດິນ 1ແມັດ ຊຳລຸດ-ຂາດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຫຼັກສາຍດິນ 1ແມັດ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p12",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ດອກໄຟນີອອນ LED 18wຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟນີອອນ LED 18w",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p13",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ທາມເມີສະວິດຊໍາລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ທາມເມີສະວິດ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p14",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ສະວິດແແສງຕາເວັນຊໍາລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ສະວິດແສງຕາເວັນ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p15",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ໄຟຫ້ອງ ນອນເຈົ້າໜ້າທີ່ຊໂລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ໄຟຫ້ອງ ນອນເຈົ້າໜ້າທີ່",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p16",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ໄຟໂລໂກ້ດ້ານໜ້າອາຄານຊໍາລຸດຂາດ-ເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ໄຟໂລໂກ້ດ້ານໜ້າອາຄານ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p17",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ດອກໄຟ ອ້ອມຮອບອາຄານຊໍາລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p18",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ດອກໄຟມົນ LED (ຕູ້ ATM)ຊຳລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟມົນ LED (ຕູ້ ATM)",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p19",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ດອກໄຟຕູ້ໂຊ LED ເສັ້ນຊຳລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟຕູ້ໂຊ LED ເສັ້ນ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p20",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ຖັງເກັບນໍ້າໃຊ້ ເປຶ້ອນ",
    "workType": "ບໍລິການ",
    "sparePart": "ບໍລິການລ້ຽງຖັງເກັບນໍ້າໃຊ້",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p21",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ຖັງເກັບນໍ້າໃຊ້ຊຳລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຖັງເກັບນໍ້າໃຊ້",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p22",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ປໍ້າສົ່ງນໍ້າດັບເພິງຊໍາລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ປໍ້າສົ່ງນໍ້າດັບເພິງ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p23",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ຊັກໂຄກຊໍາລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຊັກໂຄກ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p24",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ກັອກນໍ້າຮົ່ວຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ກັອກນໍ້າ 3ທາງ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p25",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຕູ້ ATM ເປເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຕູ້ ATM ດ້ານໜ້າອາຄານ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p26",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຈັກປັ່ນໄຟສໍາຮອງເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຈັກປັ່ນໄຟສໍາຮອງ",
    "unit": "ໜ່ວຍ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p27",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຕູ້ຄວາມຄຸມໄຟ MDBຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຕູ້ຄວາມຄຸມໄຟ MDB",
    "unit": "ຕູ້",
    "estimatedUnitCost": 0
  },
  {
    "id": "p28",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ໜໍ້ແປງໄຟຟ້າຊຳລຸດເພ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ໝໍ້ແປງໄຟຟ້າ",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p29",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ປັກສຽບໄຟຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ປັກສຽບກາວ ຄູ່ 16A 250V",
    "unit": "ອັນ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p30",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼອດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟສະປອດໄລ LED 100W",
    "unit": "ດອກ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p31",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼອດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟ Panel light 300*600mm",
    "unit": "ດອກ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p32",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼອດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟ Panel light 600*600mm",
    "unit": "ດອກ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p33",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼອດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟຕາແມວ 12W dia5\"ຜັງເພດານ",
    "unit": "ດອກ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p34",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼອດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟຕາແມວ 9W",
    "unit": "ດອກ",
    "estimatedUnitCost": 0
  },
  {
    "id": "p35",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ຫຼອດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ດອກໄຟ LED 18W",
    "unit": "ດອກ",
    "estimatedUnitCost": 25000
  },
  {
    "id": "p36",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ສະວິດໄຟເສຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ສະວິດໄຟ",
    "unit": "ອັນ",
    "estimatedUnitCost": 15000
  },
  {
    "id": "p37",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ປັກສຽບໄຟຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ປັກສຽບໄຟ",
    "unit": "ອັນ",
    "estimatedUnitCost": 20000
  },
  {
    "id": "p38",
    "repairSubCategory": "ລະບົບໄຟຟ້າ",
    "repairSubItem": "ເບຣກເກີ້ຕັດເລື້ອຍ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ເບຣກເກີ້ 30A",
    "unit": "ອັນ",
    "estimatedUnitCost": 65000
  },
  {
    "id": "p39",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ກັອກນໍ້າຮົ່ວ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ກັອກນໍ້າ 2 ທາງ",
    "unit": "ອັນ",
    "estimatedUnitCost": 45000
  },
  {
    "id": "p40",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ສາຍຊຳລະຮົ່ວ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ສາຍສີດຊຳລະ",
    "unit": "ອັນ",
    "estimatedUnitCost": 35000
  },
  {
    "id": "p41",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ສາຍອ່ອນນໍ້າຮົ່ວ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ສາຍອ່ອນ 1/2\"",
    "unit": "ອັນ",
    "estimatedUnitCost": 15000
  },
  {
    "id": "p42",
    "repairSubCategory": "ລະບົບເຄື່ອງປັບອາກາດ",
    "repairSubItem": "ແອເຢັນບໍ່ພໍ",
    "workType": "ບໍລິການ",
    "sparePart": "ບໍລິການລ້າງແອ",
    "unit": "ເຄື່ອງ",
    "estimatedUnitCost": 150000
  },
  {
    "id": "p43",
    "repairSubCategory": "ລະບົບເຄື່ອງປັບອາກາດ",
    "repairSubItem": "ແອມີນໍ້າຢອດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ລ້າງທໍ່ນໍ້າທິ້ງແອ",
    "unit": "ເຄື່ອງ",
    "estimatedUnitCost": 100000
  },
  {
    "id": "p44",
    "repairSubCategory": "ລະບົບເຄື່ອງປັບອາກາດ",
    "repairSubItem": "ແອບໍ່ເຮັດວຽກ",
    "workType": "ກວດເຊັກ/ສ້ອມ",
    "sparePart": "ຄ່າກວດເຊັກແອ",
    "unit": "ເຄື່ອງ",
    "estimatedUnitCost": 50000
  },
  {
    "id": "p45",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ໂຖສ້ວມຕັນ",
    "workType": "ບໍລິການ",
    "sparePart": "ບໍລິການລອກໂຖສ້ວມ",
    "unit": "ຄັ້ງ",
    "estimatedUnitCost": 200000
  },
  {
    "id": "p46",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ນໍ້າໄຫຼບໍ່ຢຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ຊຸດລູກລອຍໂຖສ້ວມ",
    "unit": "ອັນ",
    "estimatedUnitCost": 85000
  },
  {
    "id": "p47",
    "repairSubCategory": "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "repairSubItem": "ຖັງເສັບຕິກເຕັມ",
    "workType": "ບໍລິການ",
    "sparePart": "ບໍລິການດູດສິ່ງປະຕິກູນ",
    "unit": "ຖັງ",
    "estimatedUnitCost": 350000
  },
  {
    "id": "p48",
    "repairSubCategory": "ລະບົບເຄືອຂ່າຍ & IT",
    "repairSubItem": "ອິນເຕີເນັດໃຊ້ບໍ່ໄດ້",
    "workType": "ກວດເຊັກ/ສ້ອມ",
    "sparePart": "ຄ່າກວດເຊັກ Network",
    "unit": "ຄັ້ງ",
    "estimatedUnitCost": 150000
  },
  {
    "id": "p49",
    "repairSubCategory": "ລະບົບເຄືອຂ່າຍ & IT",
    "repairSubItem": "Router/Switch ຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "Router / Switch",
    "unit": "ເຄື່ອງ",
    "estimatedUnitCost": 450000
  },
  {
    "id": "p50",
    "repairSubCategory": "ລະບົບເຄືອຂ່າຍ & IT",
    "repairSubItem": "ສາຍ LAN ຂາດ/ຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ສາຍ LAN",
    "unit": "ເສັ້ນ",
    "estimatedUnitCost": 15000
  },
  {
    "id": "p51",
    "repairSubCategory": "ລະບົບປ້ອງກັນອັກຄີໄພ",
    "repairSubItem": "ຖັງດັບເພີງໝົດອາຍຸ",
    "workType": "ບໍລິການ",
    "sparePart": "ບໍລິການອັດນໍ້າຢາ",
    "unit": "ຖັງ",
    "estimatedUnitCost": 120000
  },
  {
    "id": "p52",
    "repairSubCategory": "ລະບົບປ້ອງກັນອັກຄີໄພ",
    "repairSubItem": "ສັນຍານເຕືອນໄຟບໍ່ເຮັດວຽກ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "Smoke Detector / Alarm",
    "unit": "ອັນ",
    "estimatedUnitCost": 180000
  },
  {
    "id": "p53",
    "repairSubCategory": "ລະບົບປ້ອງກັນອັກຄີໄພ",
    "repairSubItem": "ປໍ້ានໍ້າດັບເພີງຊຳລຸດ",
    "workType": "ກວດເຊັກ/ສ້ອມ",
    "sparePart": "ຄ່າກວດເຊັກປໍ້າດັບເພີງ",
    "unit": "ຄັ້ງ",
    "estimatedUnitCost": 250000
  },
  {
    "id": "p54",
    "repairSubCategory": "ອື່ນໆ",
    "repairSubItem": "ອຸປະກອນອື່ນໆຊຳລຸດ",
    "workType": "ປ່ຽນອະໄຫຼ່",
    "sparePart": "ລາຍການອື່ນໆ",
    "unit": "ລາຍການ",
    "estimatedUnitCost": 0
  }
];

// Mapping Master Data supplied on 2026-07-15. Sequence 124 was not supplied,
// so the source intentionally contains 133 records rather than fabricating one.
export const DEFAULT_REPAIR_PRESETS: RepairPreset[] = repairMappingMasterData.map(row => ({
  id: `p${row.sequence}`,
  sparePart: row.sparePart,
  repairSubCategory: row.repairSubCategory,
  repairSubItem: row.repairSubItem,
  workType: '',
  unit: row.unit,
  estimatedUnitCost: 0
}));

void LEGACY_REPAIR_PRESETS;

const DEMO_PREVIEW_SEED_KEY = 'ldb_demo_preview_seed_v1';
const ALL_FUNCTION_TABS = [
  "dashboard",
  "pm",
  "inspections",
  "incidents",
  "assessment",
  "approvals",
  "tracking",
  "repairs",
  "accounts",
] as const;

const isDemoPreviewRuntime = (): boolean => {
  try {
    return typeof window !== 'undefined' && isDemoPreviewHost(window.location.hostname);
  } catch {
    return false;
  }
};

const pickBranch = (prefix: string, fallbackIndex: number): string =>
  BRANCHES.find((item) => String((item as any)["àºªàº²àº‚àº²"] || '').startsWith(prefix))?.["àºªàº²àº‚àº²"]
  || BRANCHES[fallbackIndex]?.["àºªàº²àº‚àº²"]
  || BRANCHES[0]?.["àºªàº²àº‚àº²"]
  || '';

const buildDemoPreviewUsers = (): UserAccount[] => {
  const hqBranch = pickBranch('00.', 0);
  const branchUser = pickBranch('01.', 1);
  const uatBranchUser = pickBranch('23.', 23);
  return [
    {
      username: 'demo_admin',
      password_raw: 'UAT-DEMO-ONLY',
      status: 'Admin',
      branch: hqBranch,
      image: '',
      allowedTabs: [...ALL_FUNCTION_TABS],
    },
    {
      username: 'demo_branch',
      password_raw: '1122',
      status: 'User',
      branch: branchUser,
      image: '',
      allowedTabs: ALL_FUNCTION_TABS.filter((tab) => tab !== 'accounts'),
    },
    {
      username: 'demo_uat',
      password_raw: '1122',
      status: 'User',
      branch: uatBranchUser,
      image: '',
      allowedTabs: ALL_FUNCTION_TABS.filter((tab) => tab !== 'accounts'),
    },
  ];
};

export function ensureDemoPreviewSeedData(): void {
  if (!isDemoPreviewRuntime()) return;
  if (localStorage.getItem(DEMO_PREVIEW_SEED_KEY) === 'true') return;

  localStorage.setItem("ldb_users", JSON.stringify(buildDemoPreviewUsers()));
  localStorage.setItem("ldb_branches", JSON.stringify(BRANCHES));
  localStorage.setItem("ldb_checklist_items_v10", JSON.stringify(CHECKLIST_ITEMS));
  localStorage.setItem("ldb_sectors", JSON.stringify(SECTORS));
  localStorage.setItem("ldb_repair_presets_v3", JSON.stringify(DEFAULT_REPAIR_PRESETS));
  localStorage.setItem("ldb_pm_assets", JSON.stringify(DEFAULT_PM_ASSETS));
  localStorage.removeItem("ldb_base_data_cleared");
  localStorage.removeItem("ldb_current_user");
  localStorage.setItem(DEMO_PREVIEW_SEED_KEY, 'true');
}

export function getSavedRepairPresets(): RepairPreset[] {
  ensureDemoPreviewSeedData();
  const local = localStorage.getItem("ldb_repair_presets_v3");
  if (local) {
    try {
      const parsed = JSON.parse(local);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Automatically migrate any 'ໂຖສ້ວມ ແລະ ອາຈົມ' to 'ລະບົບນໍ້າປະປາ & ສຸຂະພັນ'
        const migrated = parsed.map(p => {
          if (p.repairSubCategory === "ໂຖສ້ວມ ແລະ ອາຈົມ") {
            return { ...p, repairSubCategory: "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ" };
          }
          return p;
        });
        return migrated;
      }
    } catch (e) {
      console.error("Failed to parse repair presets from localStorage", e);
    }
  }
  localStorage.setItem("ldb_repair_presets_v3", JSON.stringify(DEFAULT_REPAIR_PRESETS));
  return DEFAULT_REPAIR_PRESETS;
}

export function saveRepairPresets(list: RepairPreset[]) {
  localStorage.setItem("ldb_repair_presets_v3", JSON.stringify(list));
  queueCentralSnapshot("repair-presets", list as unknown as Record<string, unknown>[]);
}
