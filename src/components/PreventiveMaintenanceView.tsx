/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Check, ShieldAlert, Calendar, Clock, 
  Eye, HelpCircle, Pencil, Download, Trash2, ClipboardCheck, 
  AlertTriangle, CheckCircle, Info, X, Camera, RefreshCw
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { PMAsset, PMHistoryRecord, UserAccount, IncidentRecord } from '../types';
import { getSavedBranches, getSavedSectors, cleanString, addCycleToDate, ASSET_CATEGORIES, getSavedChecklistItems, getSavedPMAssets } from '../dataStore';
import { LOCATION_FLOOR_LABEL, LOCATION_FLOOR_OPTIONS } from '../locationFloorOptions';
import {
  buildPMAssetExportRow,
  buildPMHistoryExportRow,
  formatSectorForDisplay,
  floorLabelToLegacyFloor,
  getAreaPointOptions,
  getAssetCategoryOptions,
  getAssetGroupOptions,
  getAssetNameOptions,
  getBranchOptions,
  getDivisionOptions,
  getSystemOptions,
  normalizeSector,
  isReservedPMAssetMasterValue,
  uniqueNormalizedStrings,
} from '../pmAssetMasterData';

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

interface PreventiveMaintenanceViewProps {
  key?: any;
  currentUser: UserAccount;
  incidents: IncidentRecord[];
  onAddIncident: (newInc: Omit<IncidentRecord, "ລ/ດ"> | Omit<IncidentRecord, "ລ/ດ">[]) => void;
}

export default function PreventiveMaintenanceView({
  currentUser,
  incidents,
  onAddIncident
}: PreventiveMaintenanceViewProps) {
  const BRANCHES = useMemo(() => getSavedBranches(), []);
  const sectorMaster = useMemo(() => getSavedSectors(), []);

  // Tabs inside Preventive Maintenance
  const [activeSubTab, setActiveSubTab] = useState<'assets' | 'schedule' | 'history'>('assets');

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(currentUser.status === "Admin" ? 'ALL' : currentUser.branch);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Load and persist PM assets and history in local state backed by localStorage
  const [pmAssets, setPmAssets] = useState<PMAsset[]>(() => {
    return getSavedPMAssets();
  });

  const [pmHistory, setPmHistory] = useState<PMHistoryRecord[]>(() => {
    const local = localStorage.getItem("ldb_pm_history");
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        console.error("Failed to parse ldb_pm_history in PM view", e);
      }
    }
    return [];
  });

  // Save changes to localStorage helper
  const updatePmAssetsState = (newAssets: PMAsset[]) => {
    setPmAssets(newAssets);
    localStorage.setItem("ldb_pm_assets", JSON.stringify(newAssets));
  };

  const updatePmHistoryState = (newHistory: PMHistoryRecord[]) => {
    setPmHistory(newHistory);
    localStorage.setItem("ldb_pm_history", JSON.stringify(newHistory));
  };

  // -----------------------------------------------------
  // DEFAULT CHECKLIST ITEMS PER ASSET GROUP
  // -----------------------------------------------------
  const getSystemChecklist = (group: string): string[] => {
    const key = String(group || '').toUpperCase();
    if (key.includes("CCTV") || key.includes("ກ້ອງ")) {
      return [
        "ກວດກາສະພາບພາຍນອກຂອງກ້ອງວົງຈອນປິດ ແລະ ຂາຕັ້ງກ້ອງ",
        "ກວດກາຄວາມສະອາດຂອງໜ້າເລນກ້ອງວົງຈອນປິດ",
        "ກວດກາສັນຍານພາບ ແລະ ຄວາມຄົມຊັດຂອງກ້ອງແຕ່ລະໜ້າຈໍ",
        "ກວດກາສະຖານະການບັນທຶກວິດີໂອຍ້ອນຫຼັງຢ່າງໜ້ອຍ 30 ວັນ"
      ];
    }
    if (key.includes("UPS") || key.includes("ສຳຮອງໄຟ") || key.includes("ສໍາຮອງໄຟ")) {
      return [
        "ກວດກາໄຟສະຖານະການເຮັດວຽກຂອງ UPS (Line / Battery Mode)",
        "ກວດກາສະພາບພາຍນອກ ແລະ ອຸນຫະພູມຂອງຕູ້ UPS",
        "ທົດສອບລະບົບການຈ່າຍໄຟສຳຮອງ (Self-Test / Battery runtime test)"
      ];
    }
    if (key.includes("AIR") || key.includes("ແອ") || key.includes("ປັບອາກາດ")) {
      return [
        "ກວດກາຄວາມເຢັນ ແລະ ລົມທີ່ອອກຈາກເຄື່ອງປັບອາກາດ",
        "ກວດກາ ແລະ ອະນາໄມແຜ່ນກອງຝຸ່ນ (Filter)",
        "ກວດກາການລະບາຍນ້ຳຖິ້ມ ແລະ ຄວາມສະອາດຂອງທໍ່ນ້ຳຖິ້ມ",
        "ກວດກາສຽງດັງ ຫຼື ຄວາມສັ່ນສະເທືອນທີ່ຜິດປົກກະຕິ"
      ];
    }
    if (key.includes("GEN") || key.includes("ປັ່ນໄຟ") || key.includes("ເຄື່ອງປັ່ນ")) {
      return [
        "ກວດກາລະດັບນ້ຳມັນເຊື້ອໄຟ (Diesel Level)",
        "ກວດກາລະດັບນ້ຳມັນເຄື່ອງ ແລະ ນ້ຳໃນໝໍ້ນ້ຳ",
        "ກວດກາສະພາບ ແລະ ແຮງດັນໄຟຟ້າຂອງໝໍ້ໄຟສະຕາດ (Starter Battery)",
        "ທົດສອບການຕິດເຄື່ອງ (No-Load Test Run 10-15 ນາທີ)"
      ];
    }
    if (key.includes("FIRE") || key.includes("ດັບເພີງ") || key.includes("ເຕືອນໄພ")) {
      return [
        "ກວດກາສະຖານະຂອງຕູ້ຄວບຄຸມຫຼັກ (FACP Status: Normal)",
        "ທົດສອບອຸປະກອນກວດຈັບຄວັນ/ຄວາມຮ້ອນ (Smoke/Heat Detector)",
        "ທົດສອບປຸ່ມແຈ້ງເຫດດ້ວຍມື (Manual Pull Station)",
        "ທົດສອບສຽງແຈ້ງເຕືອນ ແລະ ໄຟກະພິບ (Siren & Strobe)"
      ];
    }
    if (key.includes("ACCESS") || key.includes("ປະຕູ") || key.includes("ຄອນໂທຣ")) {
      return [
        "ທົດສອບການອ່ານບັດ, ລາຍນິ້ວມື ຫຼື ໃບບັນທຶກໃບໜ້າ",
        "ກວດກາການເຮັດວຽກຂອງກອນປະຕູໄຟຟ້າ (Magnetic Lock)",
        "ທົດສອບປຸ່ມກົດອອກ (Exit Button) ແລະ ປຸ່ມສຸກເສີນ (Break Glass)"
      ];
    }
    if (key.includes("ATM")) {
      return [
        "ກວດກາຄວາມສະອາດ ແລະ ສະພາບພາຍນອກຂອງຕູ້ ATM",
        "ກວດກາການເຮັດວຽກຂອງຊ່ອງສຽບບັດ (Card Reader)",
        "ກວດກາການເຮັດວຽກຂອງຊ່ອງຮັບ-ຈ່າຍເງິນ (Dispenser/Shutter)",
        "ກວດກາກ້ອງວົງຈອນປິດປະຈຳຕູ້ ATM (Pin Hole Camera)"
      ];
    }
    // Generic fallback
    return [
      "ກວດກາສະພາບພາຍນອກ ແລະ ຄວາມສະອາດທົ່ວໄປ",
      "ກວດກາລະບົບສາຍໄຟ ແລະ ການເຊື່ອມຕໍ່ຕ່າງໆ",
      "ທົດສອບການເຮັດວຽກຫຼັກຂອງອຸປະກອນ",
      "ກວດກາຄວາມປອດໄພໃນການໃຊ້ງານ"
    ];
  };

  // Play a standard feedback audio beep
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Beep audio blocked by browser settings", e);
    }
  };

  // -----------------------------------------------------
  // ADD / EDIT ASSET STATE & LOGIC
  // -----------------------------------------------------
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<PMAsset | null>(null);

  // Get unique checklist categories (Subsystem Category) from saved checklist items
  const pmChecklistItems = useMemo(() => {
    return getSavedChecklistItems();
  }, [isAssetModalOpen]);

  // Dynamically compute all unique asset categories from both ASSET_CATEGORIES and the incidents list (Building Inspection database)
  const allAssetCategories = useMemo(() => {
    const staticCats = ASSET_CATEGORIES.map(cat => cat.ພາກສ່ວນ.trim());
    const incidentCats = incidents.map(item => (item.ພາກສ່ວນຊັບສົມບັດ || '').trim()).filter(Boolean);
    return getAssetCategoryOptions([...staticCats, ...incidentCats]);
  }, [incidents]);

  const defaultAssetCategory = allAssetCategories[0] || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ';
  const defaultAssetGroup = 'CCTV';
  const branchOptions = useMemo(() => getBranchOptions(BRANCHES), [BRANCHES]);
  const assetGroupOptions = useMemo(() => getAssetGroupOptions(pmAssets), [pmAssets]);
  const systemOptions = useMemo(() => getSystemOptions(pmChecklistItems), [pmChecklistItems]);
  const sectorOptions = useMemo(
    () => uniqueNormalizedStrings(sectorMaster.map(item => normalizeSector(item.ຂະແໜງ))),
    [sectorMaster],
  );

  // Dynamically compute all unique asset names from existing assets and building inspection incidents for autocomplete suggestions
  const allAssetNames = useMemo(() => {
    const namesFromAssets = pmAssets.map(a => a.assetName.trim());
    const namesFromIncidents = incidents.map(item => (item.ລາຍການ || '').trim()).filter(Boolean);
    return getAssetNameOptions([...namesFromAssets, ...namesFromIncidents]);
  }, [pmAssets, incidents]);

  // Form Fields for Asset
  const [assetCode, setAssetCode] = useState('');
  const [assetName, setAssetName] = useState('');
  const [isAddingAssetName, setIsAddingAssetName] = useState(false);
  const [assetNameBeforeAdd, setAssetNameBeforeAdd] = useState('');
  const [assetCategory, setAssetCategory] = useState(defaultAssetCategory);
  const [assetGroup, setAssetGroup] = useState(defaultAssetGroup);
  const [isAddingAssetGroup, setIsAddingAssetGroup] = useState(false);
  const [assetGroupBeforeAdd, setAssetGroupBeforeAdd] = useState(defaultAssetGroup);
  const [branch, setBranch] = useState(currentUser.branch);
  const [division, setDivision] = useState('ຝ່າຍບໍລິການ');
  const [sector, setSector] = useState('none');
  const [floor, setFloor] = useState('1');
  const [locationDetail, setLocationDetail] = useState('');
  const [roomLocation, setRoomLocation] = useState('');
  const [systemCategory, setSystemCategory] = useState('ລະບົບຄວາມປອດໄພ');
  const [subsystemCategory, setSubsystemCategory] = useState('ລະບົບກ້ອງວົງຈອນCCTV');
  const [maintenanceCycle, setMaintenanceCycle] = useState('1 ເດືອນ');
  const [customCycleDays, setCustomCycleDays] = useState<number>(30);
  const [lastMaintenanceDate, setLastMaintenanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [alertBeforeDays, setAlertBeforeDays] = useState<number>(5);
  const [responsiblePerson, setResponsiblePerson] = useState('');
  const [vendor, setVendor] = useState('');
  const divisionOptions = useMemo(() => getDivisionOptions(BRANCHES, branch), [BRANCHES, branch]);
  const areaPointOptions = useMemo(
    () => getAreaPointOptions(pmChecklistItems, systemCategory),
    [pmChecklistItems, systemCategory],
  );

  const openAddAssetModal = () => {
    const initialBranch = currentUser?.status === "Admin"
      ? (branchOptions[0] || '00.ສໍານັກງານໃຫຍ່')
      : (currentUser?.branch || branchOptions[0] || '');
    const initialDivisions = getDivisionOptions(BRANCHES, initialBranch);
    const initialSystem = systemOptions[0] || '';
    const initialAreas = getAreaPointOptions(pmChecklistItems, initialSystem);

    setEditingAsset(null);
    setAssetCode(`PM-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`);
    setAssetName('');
    setIsAddingAssetName(false);
    setAssetNameBeforeAdd('');
    setAssetCategory(defaultAssetCategory);
    setAssetGroup(defaultAssetGroup);
    setIsAddingAssetGroup(false);
    setAssetGroupBeforeAdd(defaultAssetGroup);
    setBranch(initialBranch);
    setDivision(initialDivisions[0] || initialBranch);
    setSector(sectorOptions[0] || 'none');
    setFloor('1');
    setLocationDetail('');
    setRoomLocation('');
    setSystemCategory(initialSystem);
    setSubsystemCategory(initialAreas[0] || '');
    setMaintenanceCycle('1 ເດືອນ');
    setCustomCycleDays(30);
    setLastMaintenanceDate(new Date().toISOString().split('T')[0]);
    setAlertBeforeDays(5);
    setResponsiblePerson(currentUser?.username || '');
    setVendor('');
    setIsAssetModalOpen(true);
  };

  const openEditAssetModal = (asset: PMAsset) => {
    setEditingAsset(asset);
    setAssetCode(asset.assetCode);
    setAssetName(asset.assetName);
    setIsAddingAssetName(false);
    setAssetNameBeforeAdd(asset.assetName);
    setAssetCategory(asset.assetCategory);
    setAssetGroup(asset.assetGroup);
    setIsAddingAssetGroup(false);
    setAssetGroupBeforeAdd(asset.assetGroup);
    setBranch(asset.branch);
    setDivision(asset.division);
    setSector(asset.sector);
    setFloor(String(asset.floor));
    setLocationDetail(asset.locationDetail);
    setRoomLocation(
      LOCATION_FLOOR_OPTIONS.includes(asset.ສະຖານທີ່_ຫ້ອງ as typeof LOCATION_FLOOR_OPTIONS[number])
        ? asset.ສະຖານທີ່_ຫ້ອງ || ''
        : '',
    );
    setSystemCategory(asset.systemCategory);
    setSubsystemCategory(asset.subsystemCategory);
    setMaintenanceCycle(asset.maintenanceCycle);
    setCustomCycleDays(asset.customCycleDays || 30);
    setLastMaintenanceDate(asset.lastMaintenanceDate);
    setAlertBeforeDays(asset.alertBeforeDays);
    setResponsiblePerson(asset.responsiblePerson);
    setVendor(asset.vendor);
    setIsAssetModalOpen(true);
  };

  const handleAssetCodeChange = (val: string) => {
    setAssetCode(val);
    const trimmed = (val || '').trim().toLowerCase();
    if (!trimmed) return;

    // Search in building inspection incidents database (same database as building inspection function)
    const incidentMatch = incidents.find(item => {
      const code = String(item.ລະຫັດຊັບສິນ || '').trim().toLowerCase();
      return code && code === trimmed;
    });

    if (incidentMatch) {
      const rawName = (incidentMatch.ລາຍການ || '').trim();
      const matchedName = allAssetNames.find(
        name => name.toLocaleLowerCase() === rawName.toLocaleLowerCase(),
      );
      setAssetName(matchedName || rawName);
      setIsAddingAssetName(Boolean(rawName) && !matchedName);
      setAssetNameBeforeAdd(matchedName || '');
      setAssetCategory(incidentMatch.ພາກສ່ວນຊັບສົມບັດ || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
      
      const rawGroup = (incidentMatch.ໝວດລາຍການ || incidentMatch.ໝວດລະບົບກວດ || '').trim();
      if (rawGroup) {
        const matchedGroup = assetGroupOptions.find(
          group => group.toLocaleLowerCase() === rawGroup.toLocaleLowerCase(),
        );
        setAssetGroup(matchedGroup || rawGroup);
        setIsAddingAssetGroup(!matchedGroup);
        setAssetGroupBeforeAdd(matchedGroup || defaultAssetGroup);
      }
      
      // Also autofill branch, division, sector if available
      const bName = incidentMatch.ສາຂາຊັບສິນ || (incidentMatch as any)["ສາຂາຊັບສິນ"] || incidentMatch["ສາຂາ "] || '';
      if (bName) {
        setBranch(bName);
        const matchingDivisions = getDivisionOptions(BRANCHES, bName);
        setDivision(matchingDivisions[0] || bName);
      }
      
      const dName = incidentMatch.ຝ່າຍຊັບສິນ || (incidentMatch as any)["ຝ່າຍຊັບສິນ"] || incidentMatch["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '';
      if (dName && getDivisionOptions(BRANCHES, bName || branch).includes(dName)) setDivision(dName);
      
      const sName = incidentMatch.ຂະແໜງຊັບສິນ || (incidentMatch as any)["ຂະແໜງຊັບສິນ"] || incidentMatch.ຂະແໜງ || '';
      if (sName) setSector(normalizeSector(sName));

      const rName = incidentMatch.ສະຖານທີ່_ຫ້ອງ || (incidentMatch as any)["ສະຖານທີ່_ຫ້ອງ"] || '';
      if (LOCATION_FLOOR_OPTIONS.includes(rName as typeof LOCATION_FLOOR_OPTIONS[number])) {
        setRoomLocation(rName);
        setFloor(floorLabelToLegacyFloor(rName));
      }
    }
  };

  const handleSaveAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const validDivisions = getDivisionOptions(BRANCHES, branch);
    const validAreas = getAreaPointOptions(pmChecklistItems, systemCategory);
    const canonicalAssetGroup = assetGroupOptions.find(
      group => group.toLocaleLowerCase() === assetGroup.trim().toLocaleLowerCase(),
    ) || assetGroup.trim();
    const isPreservedLegacyAssetCategory = Boolean(
      editingAsset
      && editingAsset.assetCategory === assetCategory
      && !allAssetCategories.includes(assetCategory),
    );
    const isPreservedLegacyBranch = Boolean(editingAsset && editingAsset.branch === branch);
    const isPreservedLegacyDivision = Boolean(
      editingAsset
      && editingAsset.branch === branch
      && editingAsset.division === division,
    );
    const isPreservedLegacySystem = Boolean(editingAsset && editingAsset.systemCategory === systemCategory);
    const isPreservedLegacyArea = Boolean(
      editingAsset
      && editingAsset.systemCategory === systemCategory
      && editingAsset.subsystemCategory === subsystemCategory,
    );
    const originalLocation = editingAsset?.ສະຖານທີ່_ຫ້ອງ?.trim() || '';
    const hasLegacyLocation = Boolean(
      editingAsset
      && !LOCATION_FLOOR_OPTIONS.includes(originalLocation as typeof LOCATION_FLOOR_OPTIONS[number]),
    );
    const isPreservedLegacyLocation = hasLegacyLocation && !roomLocation;
    const isValidFloor = LOCATION_FLOOR_OPTIONS.includes(roomLocation as typeof LOCATION_FLOOR_OPTIONS[number])
      || isPreservedLegacyLocation;

    if (
      !assetName.trim()
      || !assetCode.trim()
      || !canonicalAssetGroup
      || isReservedPMAssetMasterValue(assetName)
      || isReservedPMAssetMasterValue(canonicalAssetGroup)
      || (!allAssetCategories.includes(assetCategory) && !isPreservedLegacyAssetCategory)
      || (!branchOptions.includes(branch) && !isPreservedLegacyBranch)
      || (!validDivisions.includes(division) && !isPreservedLegacyDivision)
      || (!systemOptions.includes(systemCategory) && !isPreservedLegacySystem)
      || (!validAreas.includes(subsystemCategory) && !isPreservedLegacyArea)
      || !isValidFloor
    ) {
      alert("ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ");
      return;
    }

    const calculatedNextDate = addCycleToDate(lastMaintenanceDate, maintenanceCycle, customCycleDays);
    const canonicalAssetName = allAssetNames.find(
      name => name.toLocaleLowerCase() === assetName.trim().toLocaleLowerCase(),
    ) || assetName.trim();
    const savedLocation = isPreservedLegacyLocation ? originalLocation : roomLocation;
    const legacyFloor = isPreservedLegacyLocation
      ? String(editingAsset?.floor ?? '')
      : floorLabelToLegacyFloor(roomLocation);
    const savedSector = editingAsset?.sector === sector
      ? sector
      : normalizeSector(sector);

    const newAsset: PMAsset = {
      assetCode: editingAsset?.assetCode || assetCode.trim(),
      assetName: canonicalAssetName,
      assetCategory,
      assetGroup: canonicalAssetGroup,
      branch,
      division,
      sector: savedSector,
      floor: legacyFloor,
      locationDetail: locationDetail.trim(),
      ສະຖານທີ່_ຫ້ອງ: savedLocation,
      systemCategory,
      subsystemCategory,
      maintenanceCycle,
      customCycleDays: maintenanceCycle === "Custom" ? customCycleDays : undefined,
      lastMaintenanceDate,
      nextMaintenanceDate: calculatedNextDate,
      alertBeforeDays,
      responsiblePerson: responsiblePerson.trim(),
      vendor: vendor.trim(),
      maintenanceStatus: 'ປົກກະຕິ' // will be recalculated dynamically by standard getter
    };

    let updatedList: PMAsset[];
    const duplicateAssetCode = pmAssets.some(
      item => item.assetCode !== editingAsset?.assetCode
        && item.assetCode.toLocaleLowerCase() === newAsset.assetCode.toLocaleLowerCase(),
    );
    if (duplicateAssetCode) {
      alert("ລະຫັດຊັບສິນນີ້ມີຢູ່ແລ້ວໃນລະບົບ!");
      return;
    }

    if (editingAsset) {
      updatedList = pmAssets.map(item => item.assetCode === editingAsset.assetCode ? newAsset : item);
    } else {
      updatedList = [newAsset, ...pmAssets];
    }

    updatePmAssetsState(updatedList);
    setIsAssetModalOpen(false);
    playBeep();
  };

  const handleDeleteAsset = (code: string) => {
    if (window.confirm(`ທ່ານຕ້ອງການລຶບຊັບສິນລະຫັດ ${code} ອອກຈາກທະບຽນແທ້ຫຼືບໍ່?`)) {
      const updated = pmAssets.filter(item => item.assetCode !== code);
      updatePmAssetsState(updated);
    }
  };


  // -----------------------------------------------------
  // PERFORM MAINTENANCE CHECK LIST STATE & FORM LOGIC
  // -----------------------------------------------------
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedAssetForCheck, setSelectedAssetForCheck] = useState<PMAsset | null>(null);

  // Checklist responses state: maps "checklist item string" -> "ປົກກະຕິ" | "ຜິດປົກກະຕິ" | "ບໍ່ກ່ຽວຂ້ອງ"
  const [checklistResults, setChecklistResults] = useState<{ [item: string]: "ປົກກະຕິ" | "ຜິດປົກກະຕິ" | "ບໍ່ກ່ຽວຂ້ອງ" }>({});
  
  // Incident connection state
  const [issueDetails, setIssueDetails] = useState('');
  const [impactLevel, setImpactLevel] = useState('ປານກາງ');
  const [proposedSolution, setProposedSolution] = useState('');
  const [attachmentPhoto, setAttachmentPhoto] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [inspectorName, setInspectorName] = useState(() => currentUser?.username || '');
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().split('T')[0]);

  const openPerformCheckModal = (asset: PMAsset) => {
    setSelectedAssetForCheck(asset);
    
    // Set default checklist state
    const items = getSystemChecklist(asset.assetGroup);
    const initialRes: { [item: string]: "ປົກກະຕິ" | "ຜິດປົກກະຕິ" | "ບໍ່ກ່ຽວຂ້ອງ" } = {};
    items.forEach(it => {
      initialRes[it] = "ປົກກະຕິ";
    });
    setChecklistResults(initialRes);

    setIssueDetails('');
    setImpactLevel('ປານກາງ');
    setProposedSolution('');
    setAttachmentPhoto('');
    setInspectorName(currentUser?.username || '');
    setCheckDate(new Date().toISOString().split('T')[0]);
    setIsCheckModalOpen(true);
  };

  const handleCheckResultChange = (item: string, val: "ປົກກະຕິ" | "ຜິດປົກກະຕິ" | "ບໍ່ກ່ຽວຂ້ອງ") => {
    setChecklistResults(prev => ({ ...prev, [item]: val }));
  };

  // Determine if any item is abnormal
  const hasAbnormalItem = useMemo(() => {
    return Object.values(checklistResults).some(v => v === "ຜິດປົກກະຕິ");
  }, [checklistResults]);

  // Handle Drag & Drop photo uploads
  const handlePhotoUpload = (file: File) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("ໄຟລ໌ຮູບພາບມີຂະໜາດໃຫຍ່ເກີນໄປ (ຫ້າມເກີນ 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setAttachmentPhoto(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handlePhotoUpload(e.dataTransfer.files[0]);
    }
  };

  // Save full preventive maintenance result
  const handleSaveCheckResult = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetForCheck) return;

    if (hasAbnormalItem) {
      if (!issueDetails.trim()) {
        alert("ພົບລາຍການຜິດປົກກະຕິ! ກະລຸນາປ້ອນລາຍລະອຽດບັນຫາທີ່ພົບເຫັນ");
        return;
      }
      if (!proposedSolution.trim()) {
        alert("ພົບລາຍການຜິດປົກກະຕິ! ກະລຸນາປ້ອນວິທີແກ້ໄຂສະເໜີ");
        return;
      }
    }

    const historyId = `PM-HIS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const generatedPid = `PM-INC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const relatedIncidentCode = `INC-PM-${Math.floor(Math.random() * 900 + 100)}`;

    let activeIncidentId = undefined;

    // 1. If abnormal, trigger flows directly into Incident Register
    if (hasAbnormalItem) {
      activeIncidentId = generatedPid;
      const today = new Date(checkDate);

      const newIncRecord: Omit<IncidentRecord, "ລ/ດ"> = {
        PID: generatedPid,
        ລະຫັດກວດກາ: relatedIncidentCode,
        ຮູບແບບການກວດ: "ການບຳລຸງຮັກສາ", // as requested
        ລະບົບທີ່ກວດ: selectedAssetForCheck.systemCategory,
        ໝວດລະບົບກວດ: selectedAssetForCheck.subsystemCategory,
        ລາຍການກວດ: "ຜົນການກວດບຳລຸງຮັກສາ PM ພົບຂໍ້ຜິດພາດ",
        ລະຫັດຊັບສິນ: selectedAssetForCheck.assetCode,
        ພາກສ່ວນຊັບສົມບັດ: selectedAssetForCheck.assetCategory,
        ໝວດລາຍການ: selectedAssetForCheck.assetGroup,
        ລາຍການ: selectedAssetForCheck.assetName,
        ຮູບພາບລາຍການທີ່ເພ: attachmentPhoto || undefined,
        ລາຍລະອຽດປັນຫາທີ່ພົບ: issueDetails.trim(),
        ປະເມີນຜົນກະທົບ: impactLevel,
        ວີທີແກ້ໄຂ: proposedSolution.trim(),
        ວັນທີ່ກວດ: checkDate,
        ເວລາກວດ: new Date().toTimeString().split(' ')[0].substring(0, 5),
        ຜູ້ກວດກາ: currentUser?.username || '',
        ຊື່ຜູ້ກວດ: inspectorName,
        ສະຖານທີພົບເຫດການ: selectedAssetForCheck.locationDetail || selectedAssetForCheck.subsystemCategory,
        ສະຖານທີ່_ຫ້ອງ: selectedAssetForCheck.ສະຖານທີ່_ຫ້ອງ || "ບໍ່ລະບຸ",
        "ສາຂາ ": selectedAssetForCheck.branch,
        "ຝ່າຍ/ໜ່ວຍບໍລິການ": selectedAssetForCheck.division,
        ຂະແໜງ: selectedAssetForCheck.sector,
        ຊັ້ນອາຄານ: selectedAssetForCheck.floor,
        ເດືອນ: today.getMonth() + 1,
        ປີ: today.getFullYear(),
        order: 1,
        ຮັບອໍເດີ: 1,
        ຈຳນວນຄົງຄ້າງ: 1,
        ສະຖານະ: "ລໍຖ້າປະເມີນລາຍການສ້ອມ", // as requested
        ...{
          "ສາຂາຊັບສິນ": selectedAssetForCheck.branch,
          "ຝ່າຍຊັບສິນ": selectedAssetForCheck.division,
          "ຂະແໜງຊັບສິນ": selectedAssetForCheck.sector
        } as any
      };

      // Call prop to pipe to main state / localStorage
      onAddIncident(newIncRecord);
    }

    // 2. Create the PM History log
    const histRecord: PMHistoryRecord = {
      id: historyId,
      assetCode: selectedAssetForCheck.assetCode,
      assetName: selectedAssetForCheck.assetName,
      assetCategory: selectedAssetForCheck.assetCategory,
      assetGroup: selectedAssetForCheck.assetGroup,
      branch: selectedAssetForCheck.branch,
      division: selectedAssetForCheck.division,
      sector: selectedAssetForCheck.sector,
      floor: selectedAssetForCheck.floor,
      locationDetail: selectedAssetForCheck.locationDetail,
      ສະຖານທີ່_ຫ້ອງ: selectedAssetForCheck.ສະຖານທີ່_ຫ້ອງ || "ບໍ່ລະບຸ",
      systemCategory: selectedAssetForCheck.systemCategory,
      subsystemCategory: selectedAssetForCheck.subsystemCategory,
      maintenanceCycle: selectedAssetForCheck.maintenanceCycle,
      inspectionDate: checkDate,
      inspector: inspectorName,
      overallResult: hasAbnormalItem ? "ຜິດປົກກະຕິ" : "ປົກກະຕິ",
      checklistResults: Object.entries(checklistResults).map(([it, res]) => ({ item: it, result: res as "ປົກກະຕິ" | "ຜິດປົກກະຕິ" | "ບໍ່ກ່ຽວຂ້ອງ" })),
      issueDetails: hasAbnormalItem ? issueDetails.trim() : undefined,
      impactLevel: hasAbnormalItem ? impactLevel : undefined,
      proposedSolution: hasAbnormalItem ? proposedSolution.trim() : undefined,
      photo: attachmentPhoto || undefined,
      relatedIncidentId: activeIncidentId
    };

    const updatedHistory = [histRecord, ...pmHistory];
    updatePmHistoryState(updatedHistory);

    // 3. Update Asset's Last Maintenance Date and calculate Next Date
    const nextDate = addCycleToDate(checkDate, selectedAssetForCheck.maintenanceCycle, selectedAssetForCheck.customCycleDays);
    const updatedAssets = pmAssets.map(item => {
      if (item.assetCode === selectedAssetForCheck.assetCode) {
        return {
          ...item,
          lastMaintenanceDate: checkDate,
          nextMaintenanceDate: nextDate,
          maintenanceStatus: hasAbnormalItem ? "ຜິດປົກກະຕິ" : "ປົກກະຕິ" // temporary status till next cycle logic update
        };
      }
      return item;
    });
    updatePmAssetsState(updatedAssets);

    setIsCheckModalOpen(false);
    setSelectedAssetForCheck(null);
    playBeep();

    if (hasAbnormalItem) {
      alert(`ບັນທຶກຜົນບຳລຸງຮັກສາສຳເລັດ!\nພົບຂໍ້ຜິດປົກກະຕິ: ຂໍ້ມູນບັນຫາໄດ້ໄຫຼເຂົ້າສູ່ "ທະບຽນເຫດການ (Incident Register)" ໂດຍອັດຕະໂນມັດແລ້ວ!`);
    } else {
      alert("ບັນທຶກການບຳລຸງຮັກສາ (PM Check) ຮຽບຮ້ອຍແລ້ວ!");
    }
  };


  // -----------------------------------------------------
  // VIEW HISTORIC LOG MODAL
  // -----------------------------------------------------
  const [viewingHistoryLog, setViewingHistoryLog] = useState<PMHistoryRecord | null>(null);

  // Filter & Search PM Assets lists
  const filteredAssets = useMemo(() => {
    return pmAssets.filter(item => {
      const matchesSearch = 
        item.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.responsiblePerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.vendor.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === "ALL" || item.branch === branchFilter;
      const matchesCategory = categoryFilter === "ALL" || item.systemCategory === categoryFilter;
      
      let matchesStatus = true;
      if (statusFilter !== "ALL") {
        matchesStatus = item.maintenanceStatus === statusFilter;
      }

      return matchesSearch && matchesBranch && matchesCategory && matchesStatus;
    });
  }, [pmAssets, searchTerm, branchFilter, categoryFilter, statusFilter]);

  // Filter History Logs list
  const filteredHistory = useMemo(() => {
    return pmHistory.filter(item => {
      const matchesSearch = 
        item.assetCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.inspector.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.issueDetails || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === "ALL" || item.branch === branchFilter;
      const matchesCategory = categoryFilter === "ALL" || item.systemCategory === categoryFilter;

      return matchesSearch && matchesBranch && matchesCategory;
    });
  }, [pmHistory, searchTerm, branchFilter, categoryFilter]);


  // -----------------------------------------------------
  // CALCULATE CALENDAR / DASHBOARD COUNTERS
  // -----------------------------------------------------
  const counters = useMemo(() => {
    let overdue = 0;
    let due = 0;
    let nearDue = 0;
    let normal = 0;

    pmAssets.forEach(item => {
      if (item.maintenanceStatus === "ເກີນກຳນົດ") overdue++;
      else if (item.maintenanceStatus === "ຮອດກຳນົດ") due++;
      else if (item.maintenanceStatus === "ໃກ້ຮອດກຳນົດ") nearDue++;
      else normal++;
    });

    return { overdue, due, nearDue, normal };
  }, [pmAssets]);


  // -----------------------------------------------------
  // EXPORT EXCEL LOGIC
  // -----------------------------------------------------
  const handleExportPMAssetsExcel = () => {
    const exportData = filteredAssets.map(buildPMAssetExportRow);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ທະບຽນຊັບສິນ PM");
    XLSX.writeFile(workbook, `ທະບຽນຊັບສິນ_Preventive_Maintenance_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportPMHistoryExcel = () => {
    const exportData = filteredHistory.map(buildPMHistoryExportRow);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ປະຫວັດການກວດ PM");
    XLSX.writeFile(workbook, `ປະຫວັດການບຳລຸງຮັກສາ_PM_History_${new Date().toISOString().split('T')[0]}.xlsx`);
  };


  return (
    <div className="flex-1 p-5 md:p-8 overflow-y-auto bg-slate-50 select-none">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-800">
            <ClipboardCheck className="h-6 w-6 shrink-0" />
            <h1 className="text-xl font-black tracking-tight">ການບຳລຸງຮັກສາຄວາມປອດໄພຂອງອາຄານ (Preventive Maintenance)</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            ທະບຽນ ແລະ ກວດກາບຳລຸງຮັກສາຊັບສິນຫຼັກ ເຊັ່ນ CCTV, UPS, ເຄື່ອງປັບອາກາດ, ເຄື່ອງປັ່ນໄຟ, Fire Alarm, Access Control, ATM ແລະ ລະບົບສຳຄັນ
          </p>
        </div>
        
        {/* Export Excel Button & Add New Asset */}
        <div className="flex items-center space-x-2 self-stretch md:self-auto">
          {activeSubTab === 'assets' && (
            <button
              onClick={handleExportPMAssetsExcel}
              className="flex items-center justify-center space-x-1 text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>ສົ່ງອອກ Excel</span>
            </button>
          )}
          {activeSubTab === 'history' && (
            <button
              onClick={handleExportPMHistoryExcel}
              className="flex items-center justify-center space-x-1 text-slate-700 bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 shadow-sm cursor-pointer"
            >
              <Download className="h-4 w-4" />
              <span>ສົ່ງອອກ Excel ປະຫວັດ</span>
            </button>
          )}
          
          <button
            onClick={openAddAssetModal}
            className="flex-1 md:flex-initial flex items-center justify-center space-x-1 text-[#050a14] bg-amber-400 hover:bg-amber-500 px-4 py-2.5 rounded-xl text-xs font-bold shadow transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>ທະບຽນຊັບສິນໃໝ່ (Add Asset)</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs Selection */}
      <div
        id="pm-subtab-navigation"
        className="flex gap-1 rounded-xl border border-cyan-300/20 bg-[#071426] p-1 mb-6 shadow-[0_14px_35px_rgba(2,8,23,0.24)]"
      >
        <button
          onClick={() => setActiveSubTab('assets')}
          className={`px-5 py-3 text-xs font-bold transition-all relative ${
            activeSubTab === 'assets' 
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)] rounded-t-lg'
              : '!text-slate-400 hover:!text-white hover:bg-white/5 rounded-t-lg'
          }`}
        >
          <div className="flex items-center space-x-1.5">
            <ClipboardCheck className="h-4.5 w-4.5" />
            <span>ທະບຽນຊັບສິນ PM ({pmAssets.length})</span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveSubTab('schedule')}
          className={`px-5 py-3 text-xs font-bold transition-all relative ${
            activeSubTab === 'schedule' 
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)] rounded-t-lg'
              : '!text-slate-400 hover:!text-white hover:bg-white/5 rounded-t-lg'
          }`}
        >
          <div className="flex items-center space-x-1.5">
            <Calendar className="h-4.5 w-4.5" />
            <span>ແຜນກຳນົດ & ແຈ້ງເຕືອນ</span>
            {counters.overdue > 0 && (
              <span className="bg-red-500 text-white rounded-full text-[9px] px-1.5 py-0.5 animate-pulse font-mono">
                {counters.overdue}
              </span>
            )}
          </div>
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-5 py-3 text-xs font-bold transition-all relative ${
            activeSubTab === 'history' 
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)] rounded-t-lg'
              : '!text-slate-400 hover:!text-white hover:bg-white/5 rounded-t-lg'
          }`}
        >
          <div className="flex items-center space-x-1.5">
            <Clock className="h-4.5 w-4.5" />
            <span>ປະຫວັດການບຳລຸງຮັກສາ ({pmHistory.length})</span>
          </div>
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mb-6 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 text-slate-400 h-4.5 w-4.5" />
          <input
            type="text"
            placeholder="ຄົ້ນຫາລະຫັດ, ຊື່ຊັບສິນ, ຜູ້ຮັບຜິດຊອບ, ຜູ້ຮັບເໝົາ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-slate-50/50"
          />
        </div>

        {/* Branch Filter */}
        <div className="w-full md:w-56">
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={currentUser.status !== "Admin"}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
          >
            <option value="ALL">ສາຂາທັງໝົດ (All Branches)</option>
            {Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map(brName => (
              <option key={brName} value={brName}>{brName}</option>
            ))}
          </select>
        </div>

        {/* System Category Filter */}
        <div className="w-full md:w-48">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
          >
            <option value="ALL">ທຸກໝວດລະບົບ (All Systems)</option>
            <option value="ລະບົບຄວາມປອດໄພ">ລະບົບຄວາມປອດໄພ</option>
            <option value="ດ້ານນອກອາຄານ">ດ້ານນອກອາຄານ</option>
            <option value="ດ້ານໃນອາຄານ">ດ້ານໃນອາຄານ</option>
          </select>
        </div>

        {/* Status Filter (Only in Assets Tab) */}
        {activeSubTab === 'assets' && (
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
            >
              <option value="ALL">ທຸກສະຖານະແຈ້ງເຕືອນ</option>
              <option value="ປົກກະຕິ">ປົກກະຕິ (On Track)</option>
              <option value="ໃກ້ຮອດກຳນົດ">ໃກ້ຮອດກຳນົດ (Near Due)</option>
              <option value="ຮອດກຳນົດ">ຮອດກຳນົດ (Due)</option>
              <option value="ເກີນກຳນົດ">ເກີນກຳນົດ (Overdue)</option>
            </select>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {/* 1. TAB: PM ASSETS REGISTER */}
      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {activeSubTab === 'assets' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-650 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">ລຳດັບ</th>
                  <th className="p-4">ລະຫັດຊັບສິນ</th>
                  <th className="p-4">ຊື່ຊັບສິນ / ໝວດກຸ່ມ</th>
                  <th className="p-4">ສາຂາ & ຝ່າຍ</th>
                  <th className="p-4">ຮອບວຽນ PM</th>
                  <th className="p-4 text-center">ບຳລຸງຮັກສາຫຼ້າສຸດ</th>
                  <th className="p-4 text-center">ບຳລຸງຮັກສາຄັ້ງຕໍ່ໄປ</th>
                  <th className="p-4 text-center">ແຈ້ງເຕືອນ</th>
                  <th className="p-4 text-center">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredAssets.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-12 text-center text-slate-400 font-medium">
                      <ClipboardCheck className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-500" />
                      ບໍ່ພົບຂໍ້ມູນທະບຽນຊັບສິນບຳລຸງຮັກສາທີ່ກົງກັບເງື່ອນໄຂ
                    </td>
                  </tr>
                ) : (
                  filteredAssets.map((asset, idx) => {
                    let statusColor = "bg-green-50 text-green-700 border-green-150";
                    if (asset.maintenanceStatus === "ເກີນກຳນົດ") {
                      statusColor = "bg-red-50 text-red-700 border-red-200 animate-pulse";
                    } else if (asset.maintenanceStatus === "ຮອດກຳນົດ") {
                      statusColor = "bg-orange-50 text-orange-700 border-orange-200";
                    } else if (asset.maintenanceStatus === "ໃກ້ຮອດກຳນົດ") {
                      statusColor = "bg-amber-50 text-amber-700 border-amber-200";
                    }

                    return (
                      <tr key={asset.assetCode} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-4 font-mono font-bold text-slate-900">{asset.assetCode}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800 line-clamp-1">{asset.assetName}</p>
                          <div className="flex items-center space-x-1.5 mt-1 font-mono text-[10px] text-slate-400">
                            <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded uppercase">{asset.assetGroup}</span>
                            <span>•</span>
                            <span>{asset.subsystemCategory}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-700 line-clamp-1">{asset.branch.replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{asset.division} • {formatSectorForDisplay(asset.sector)}</p>
                        </td>
                        <td className="p-4 font-semibold text-slate-600">{asset.maintenanceCycle}</td>
                        <td className="p-4 text-center font-mono text-slate-500">{asset.lastMaintenanceDate || "—"}</td>
                        <td className="p-4 text-center font-mono font-bold text-slate-800">{asset.nextMaintenanceDate || "—"}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded-lg border text-[10px] font-extrabold ${statusColor}`}>
                            {asset.maintenanceStatus}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button
                              onClick={() => openPerformCheckModal(asset)}
                              title="ກວດກາບຳລຸງຮັກສາ (PM Check)"
                              className="bg-emerald-800 text-white hover:bg-emerald-900 p-1.5 rounded-lg transition shadow-sm cursor-pointer"
                            >
                              <ClipboardCheck className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openEditAssetModal(asset)}
                              title="ແກ້ໄຂທະບຽນ"
                              className="bg-slate-100 text-slate-600 hover:bg-slate-200 p-1.5 rounded-lg transition cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset.assetCode)}
                              title="ລຶບຊັບສິນ"
                              className="bg-red-50 text-red-600 hover:bg-red-100 p-1.5 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {/* 2. TAB: SCHEDULES AND ALERTS DASHBOARD */}
      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {activeSubTab === 'schedule' && (
        <div>
          {/* Dashboard Cards summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white border-l-4 border-red-500 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">ເກີນກຳນົດບຳລຸງຮັກສາ</p>
                <h3 className="text-2xl font-black text-red-600 mt-1">{counters.overdue}</h3>
                <p className="text-[10px] text-red-500 mt-1 font-semibold">ຕ້ອງໄດ້ກວດກາທັນທີ</p>
              </div>
              <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center text-red-500">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border-l-4 border-orange-500 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">ຮອດກຳນົດມື້ນີ້</p>
                <h3 className="text-2xl font-black text-orange-600 mt-1">{counters.due}</h3>
                <p className="text-[10px] text-orange-500 mt-1 font-semibold">ຮອດຮອບວຽນກວດ</p>
              </div>
              <div className="h-12 w-12 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500">
                <Calendar className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border-l-4 border-amber-500 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">ໃກ້ຮອດກຳນົດ (Near Due)</p>
                <h3 className="text-2xl font-black text-amber-600 mt-1">{counters.nearDue}</h3>
                <p className="text-[10px] text-amber-500 mt-1 font-semibold">ແຈ້ງເຕືອນລ່ວງໜ້າ</p>
              </div>
              <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-500">
                <Info className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border-l-4 border-emerald-500 rounded-2xl p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">ສະຖານະປົກກະຕິ (On Track)</p>
                <h3 className="text-2xl font-black text-emerald-600 mt-1">{counters.normal}</h3>
                <p className="text-[10px] text-emerald-500 mt-1 font-semibold">ຢູ່ໃນແຜນບຳລຸງຮັກສາ</p>
              </div>
              <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-500">
                <CheckCircle className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Upcoming Schedule list */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
              <Calendar className="h-4.5 w-4.5 text-emerald-800 mr-2" />
              ລາຍການກວດກາທີ່ຮີບດ່ວນ & Upcoming (ລຽງຕາມວັນທີກຳນົດ)
            </h3>
            
            <div className="divide-y divide-slate-100">
              {pmAssets
                .filter(asset => asset.maintenanceStatus !== "ປົກກະຕິ")
                .sort((a,b) => a.nextMaintenanceDate.localeCompare(b.nextMaintenanceDate))
                .map((asset, index) => {
                  let alertBadge = "bg-red-50 text-red-700 border-red-100";
                  if (asset.maintenanceStatus === "ຮອດກຳນົດ") alertBadge = "bg-orange-50 text-orange-700 border-orange-100";
                  if (asset.maintenanceStatus === "ໃກ້ຮອດກຳນົດ") alertBadge = "bg-amber-50 text-amber-700 border-amber-100";

                  return (
                    <div key={asset.assetCode} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start space-x-3">
                        <div className={`p-2.5 rounded-xl border shrink-0 ${
                          asset.maintenanceStatus === "ເກີນກຳນົດ" ? "bg-red-50 text-red-500" : "bg-amber-50 text-amber-500"
                        }`}>
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-xs sm:text-sm">{asset.assetName}</p>
                          <p className="text-[11px] text-slate-400 mt-1">
                            ລະຫັດ: <span className="font-mono text-slate-600 font-bold">{asset.assetCode}</span> • 
                            ສາຂາ: <span className="text-slate-650">{asset.branch.replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}</span> • 
                            ຜູ້ຮັບຜິດຊອບ: <span className="text-slate-650">{asset.responsiblePerson}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 self-end sm:self-auto">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase">ກຳນົດວັນທີ</p>
                          <p className="font-mono text-xs font-black text-slate-800 mt-0.5">{asset.nextMaintenanceDate}</p>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[9px] font-black ${alertBadge}`}>
                            {asset.maintenanceStatus}
                          </span>
                        </div>
                        
                        <button
                          onClick={() => openPerformCheckModal(asset)}
                          className="bg-emerald-800 hover:bg-emerald-900 text-white text-[11px] font-bold px-4 py-2 rounded-xl shadow-sm cursor-pointer"
                        >
                          ກວດກາ PM (Check)
                        </button>
                      </div>
                    </div>
                  );
                })}

              {pmAssets.filter(asset => asset.maintenanceStatus !== "ປົກກະຕິ").length === 0 && (
                <div className="py-8 text-center text-slate-400 font-medium">
                  <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-50" />
                  ບໍ່ມີການແຈ້ງເຕືອນຄົງຄ້າງ! ທຸກໆຊັບສິນມີສະຖານະປົກກະຕິ ແລະ ບໍ່ທັນຮອດກຳນົດ.
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {/* 3. TAB: MAINTENANCE HISTORY LOGS */}
      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-650 text-[11px] font-bold uppercase tracking-wider">
                  <th className="p-4 w-12 text-center">ລຳດັບ</th>
                  <th className="p-4">ລະຫັດຊັບສິນ / ຊື່</th>
                  <th className="p-4">ລະບົບກວດ & ສາຂາ</th>
                  <th className="p-4 text-center">ວັນທີ່ກວດ</th>
                  <th className="p-4">ຜູ້ກວດ</th>
                  <th className="p-4 text-center">ຜົນການກວດ</th>
                  <th className="p-4">ລາຍລະອຽດບັນຫາ / Incident Link</th>
                  <th className="p-4 text-center">ລາຍລະອຽດ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400 font-medium">
                      <Clock className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-500" />
                      ຍັງບໍ່ມີປະຫວັດການກວດບຳລຸງຮັກສາ (PM) ໃນລະບົບ
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((item, idx) => {
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-4">
                          <p className="font-mono font-bold text-slate-900">{item.assetCode}</p>
                          <p className="font-bold text-slate-800 mt-1 line-clamp-1">{item.assetName}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold text-slate-700">{item.systemCategory} • {item.subsystemCategory}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{item.branch.replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}</p>
                        </td>
                        <td className="p-4 text-center font-mono text-slate-500">{item.inspectionDate}</td>
                        <td className="p-4 font-semibold text-slate-700">{item.inspector}</td>
                        <td className="p-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
                            item.overallResult === "ປົກກະຕິ" ? "bg-green-50 text-green-700 border border-green-150" : "bg-red-50 text-red-700 border border-red-150"
                          }`}>
                            {item.overallResult}
                          </span>
                        </td>
                        <td className="p-4">
                          {item.overallResult === "ຜິດປົກກະຕິ" ? (
                            <div>
                              <p className="text-red-600 line-clamp-1 font-medium">{item.issueDetails}</p>
                              {item.relatedIncidentId && (
                                <p className="text-[10px] mt-1 text-slate-500 flex items-center font-bold">
                                  <ShieldAlert className="h-3 w-3 text-red-500 mr-1 shrink-0" />
                                  Incident Ref: <span className="font-mono ml-0.5 text-red-600 underline">{item.relatedIncidentId}</span>
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 font-mono italic">ບໍ່ພົບບັນຫາ (On Track)</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setViewingHistoryLog(item)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {/* DIALOG MODAL: ADD / EDIT PM ASSET */}
      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {isAssetModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="h-5 w-5" />
                <h3 className="font-bold text-sm">
                  {editingAsset ? "ແກ້ໄຂທະບຽນຊັບສິນ PM (Edit Asset)" : "ເພີ່ມທະບຽນຊັບສິນ PM ໃໝ່ (Add PM Asset)"}
                </h3>
              </div>
              <button 
                onClick={() => setIsAssetModalOpen(false)}
                className="text-white hover:bg-emerald-900/40 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveAsset} className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ລະຫັດຊັບສິນ (Asset Code) <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingAsset)}
                    value={assetCode}
                    onChange={(e) => handleAssetCodeChange(e.target.value)}
                    placeholder="PM-CCTV-123"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-slate-50 font-mono font-bold text-slate-800 disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ຊື່ຊັບສິນ (Asset Name) <span className="text-red-500">*</span></label>
                  <div className="flex gap-2">
                    <select
                      id="asset-name-select"
                      value={isAddingAssetName ? '__ADD_NEW__' : assetName}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setAssetNameBeforeAdd(assetName);
                          setAssetName('');
                          setIsAddingAssetName(true);
                          return;
                        }
                        setAssetName(e.target.value);
                        setIsAddingAssetName(false);
                      }}
                      required={!isAddingAssetName}
                      className="min-w-0 flex-1 p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white text-slate-800 disabled:bg-slate-100"
                    >
                      <option value="">-- ເລືອກຊື່ຊັບສິນ --</option>
                      {allAssetNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                      <option value="__ADD_NEW__">+ ເພີ່ມລາຍການໃໝ່</option>
                    </select>
                  </div>
                  {isAddingAssetName && (
                    <input
                      id="new-asset-name-input"
                      type="text"
                      required
                      autoFocus
                      value={assetName}
                      onChange={(e) => setAssetName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setAssetName(assetNameBeforeAdd);
                          setIsAddingAssetName(false);
                        }
                      }}
                      placeholder="ພິມຊື່ຊັບສິນໃໝ່"
                      className="mt-2 w-full p-2.5 border border-emerald-400 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-emerald-50/30 text-slate-800"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ພາກສ່ວນຊັບສົມບັດ (Asset Category)</label>
                  <select
                    value={allAssetCategories.includes(assetCategory) ? assetCategory : ''}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    <option value="">-- ເລືອກພາກສ່ວນຊັບສົມບັດ --</option>
                    {allAssetCategories.map((cat, idx) => (
                      <option key={idx} value={cat}>{cat}</option>
                    ))}
                  </select>
                  {editingAsset && assetCategory && !allAssetCategories.includes(assetCategory) && (
                    <p className="mt-1 text-[10px] text-amber-700">
                      ຄ່າພາກສ່ວນເກົ່າທີ່ຮັກສາໄວ້: {assetCategory}.
                      ເລືອກຄ່າໃໝ່ເມື່ອຕ້ອງການປ່ຽນ.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ໝວດກຸ່ມລາຍການ (Asset Group)</label>
                  <div className="flex gap-2">
                    <select
                      id="asset-group-select"
                      value={isAddingAssetGroup ? '__ADD_NEW__' : assetGroup}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW__') {
                          setAssetGroupBeforeAdd(assetGroup);
                          setAssetGroup('');
                          setIsAddingAssetGroup(true);
                          return;
                        }
                        setAssetGroup(e.target.value);
                        setIsAddingAssetGroup(false);
                      }}
                      required={!isAddingAssetGroup}
                      className="min-w-0 flex-1 p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white text-slate-800 disabled:bg-slate-100"
                    >
                      <option value="">-- ເລືອກໝວດກຸ່ມລາຍການ --</option>
                      {assetGroupOptions.map(group => (
                        <option key={group} value={group}>{group}</option>
                      ))}
                      <option value="__ADD_NEW__">+ ເພີ່ມລາຍການໃໝ່</option>
                    </select>
                  </div>
                  {isAddingAssetGroup && (
                    <input
                      id="new-asset-group-input"
                      type="text"
                      required
                      autoFocus
                      value={assetGroup}
                      onChange={(e) => setAssetGroup(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setAssetGroup(assetGroupBeforeAdd);
                          setIsAddingAssetGroup(false);
                        }
                      }}
                      placeholder="ພິມໝວດກຸ່ມລາຍການໃໝ່"
                      className="mt-2 w-full p-2.5 border border-emerald-400 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 bg-emerald-50/30 text-slate-800"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ສາຂາ (Branch)</label>
                  <select
                    value={branch}
                    onChange={(e) => {
                      const nextBranch = e.target.value;
                      const nextDivisions = getDivisionOptions(BRANCHES, nextBranch);
                      setBranch(nextBranch);
                      setDivision(nextDivisions[0] || nextBranch);
                    }}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    {editingAsset && branch && !branchOptions.includes(branch) && (
                      <option value={branch}>{branch} (Legacy)</option>
                    )}
                    {branchOptions.map(brName => (
                      <option key={brName} value={brName}>{brName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ຝ່າຍ/ໜ່ວຍບໍລິການ (Division)</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    {editingAsset && division && !divisionOptions.includes(division) && (
                      <option value={division}>{division} (Legacy)</option>
                    )}
                    {divisionOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ຂະແໜງ (Sector)</label>
                  <select
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    {editingAsset && sector && !sectorOptions.includes(sector) && (
                      <option value={sector}>{sector} (Legacy)</option>
                    )}
                    {sectorOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ລາຍລະອຽດສະຖານທີ່ (Location Detail)</label>
                  <input
                    type="text"
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                    placeholder="ຕັ້ງຢູ່ຫ້ອງການໃຫຍ່ຂ້າງຂວາ"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">{LOCATION_FLOOR_LABEL} <span className="text-red-500">*</span></label>
                  <select
                    value={LOCATION_FLOOR_OPTIONS.includes(roomLocation as typeof LOCATION_FLOOR_OPTIONS[number]) ? roomLocation : ""}
                    onChange={(e) => {
                      setRoomLocation(e.target.value);
                      setFloor(floorLabelToLegacyFloor(e.target.value));
                    }}
                    required
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white text-sm"
                  >
                    <option value="">-- ເລືອກຊັ້ນອາຄານ --</option>
                    {LOCATION_FLOOR_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {editingAsset
                    && !LOCATION_FLOOR_OPTIONS.includes(
                      (editingAsset.ສະຖານທີ່_ຫ້ອງ || '') as typeof LOCATION_FLOOR_OPTIONS[number],
                    )
                    && !roomLocation && (
                      <p className="mt-1 text-[10px] text-amber-700">
                        ຄ່າເກົ່າທີ່ຮັກສາໄວ້: {editingAsset.ສະຖານທີ່_ຫ້ອງ || 'ບໍ່ລະບຸ'}.
                        ເລືອກຊັ້ນໃໝ່ເມື່ອຕ້ອງການປ່ຽນ.
                      </p>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 col-span-2 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ລະບົບທີ່ກວດ (System Category)</label>
                  <select
                    value={systemCategory}
                    onChange={(e) => {
                      const nextSystem = e.target.value;
                      const nextAreas = getAreaPointOptions(pmChecklistItems, nextSystem);
                      setSystemCategory(nextSystem);
                      setSubsystemCategory(nextAreas[0] || '');
                    }}
                    required
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    {editingAsset && systemCategory && !systemOptions.includes(systemCategory) && (
                      <option value={systemCategory}>{systemCategory} (Legacy)</option>
                    )}
                    {systemOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ພື້ນທີ່/ຈຸດກວດ (Area / Point)</label>
                  <select
                    value={subsystemCategory}
                    onChange={(e) => setSubsystemCategory(e.target.value)}
                    required
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    {editingAsset && subsystemCategory && !areaPointOptions.includes(subsystemCategory) && (
                      <option value={subsystemCategory}>{subsystemCategory} (Legacy)</option>
                    )}
                    {areaPointOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ຮອບວຽນການບຳລຸງຮັກສາ</label>
                  <select
                    value={maintenanceCycle}
                    onChange={(e) => setMaintenanceCycle(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  >
                    <option value="7 ມື້">7 ມື້ (Weekly)</option>
                    <option value="15 ມື້">15 ມື້ (Bi-weekly)</option>
                    <option value="1 ເດືອນ">1 ເດືອນ (Monthly)</option>
                    <option value="3 ເດືອນ">3 ເດືອນ (Quarterly)</option>
                    <option value="6 ເດືອນ">6 ເດືອນ (Semi-annually)</option>
                    <option value="1 ປີ">1 ປີ (Annually)</option>
                    <option value="Custom">Custom (ກຳນົດເອງ)</option>
                  </select>
                </div>

                {maintenanceCycle === "Custom" && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">ຈຳນວນມື້ Custom</label>
                    <input
                      type="number"
                      value={customCycleDays}
                      onChange={(e) => setCustomCycleDays(parseInt(e.target.value) || 30)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white font-mono"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ວັນທີ PM ຫຼ້າສຸດ</label>
                  <input
                    type="date"
                    value={lastMaintenanceDate}
                    onChange={(e) => setLastMaintenanceDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ແຈ້ງເຕືອນລ່ວງໜ້າ (ວັນ)</label>
                  <input
                    type="number"
                    value={alertBeforeDays}
                    onChange={(e) => setAlertBeforeDays(parseInt(e.target.value) || 5)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ຜູ້ຮັບຜິດຊອບ (Responsible Person)</label>
                  <input
                    type="text"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ບໍລິສັດຜູ້ຮັບເໝົາ / Vendor</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="— ບໍ່ມີ ຫຼື ລະບຸຊື່ບໍລິສັດ —"
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex border-t border-slate-100 pt-5 space-x-2 justify-end">
                <button
                  type="button"
                  onClick={() => setIsAssetModalOpen(false)}
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 bg-white rounded-xl font-bold hover:bg-slate-50 shadow-sm cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-800 text-white font-bold hover:bg-emerald-900 rounded-xl shadow-md transition cursor-pointer"
                >
                  {editingAsset ? "ບັນທຶກການແກ້ໄຂ" : "ບັນທຶກທະບຽນ"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {/* DIALOG MODAL: PERFORM PREVENTIVE MAINTENANCE CHECKLIST FORM */}
      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {isCheckModalOpen && selectedAssetForCheck && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="h-5 w-5 shrink-0" />
                <div>
                  <h3 className="font-bold text-sm">ຟອມກວດກາບຳລຸງຮັກສາ (Preventive Maintenance Form)</h3>
                  <p className="text-[10px] text-amber-300 mt-0.5">
                    ຊັບສິນ: {selectedAssetForCheck.assetName} • ລະຫັດ: {selectedAssetForCheck.assetCode}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsCheckModalOpen(false);
                  setSelectedAssetForCheck(null);
                }}
                className="text-white hover:bg-emerald-900/40 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveCheckResult} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              
              {/* Asset Info Row */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <p className="text-slate-400 font-bold">ໝວດລະບົບ:</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedAssetForCheck.subsystemCategory}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">ສະຖານທີ່ / ຊັ້ນ:</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedAssetForCheck.locationDetail} (ຊັ້ນ {selectedAssetForCheck.floor})</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">ຮອບວຽນບຳລຸງຮັກສາ:</p>
                  <p className="font-semibold text-slate-800 mt-0.5">{selectedAssetForCheck.maintenanceCycle}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">ວັນທີ PM ຫຼ້າສຸດ:</p>
                  <p className="font-semibold text-slate-800 mt-0.5 font-mono">{selectedAssetForCheck.lastMaintenanceDate}</p>
                </div>
              </div>

              {/* General check details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ວັນທີ່ກວດບຳລຸງຮັກສາ (Inspection Date)</label>
                  <input
                    type="date"
                    required
                    value={checkDate}
                    onChange={(e) => setCheckDate(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">ຊື່ຜູ້ກວດກາ (Inspector)</label>
                  <input
                    type="text"
                    required
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 bg-white"
                  />
                </div>
              </div>

              {/* Checklist Segment */}
              <div>
                <h4 className="font-black text-slate-700 mb-3 uppercase tracking-wider text-[11px] flex items-center">
                  <ClipboardCheck className="h-4 w-4 mr-1 text-emerald-800" />
                  ລາຍການ Checklist ກວດກາ (Inspection Items Checklist)
                </h4>

                <div className="border border-slate-150 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {getSystemChecklist(selectedAssetForCheck.assetGroup).map((item, index) => {
                    const activeResult = checklistResults[item] || "ປົກກະຕິ";

                    return (
                      <div key={index} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-slate-50/40 transition gap-3">
                        <div className="flex items-start space-x-2">
                          <span className="font-mono text-slate-400 font-bold">{index + 1}.</span>
                          <span className="font-semibold text-slate-750">{item}</span>
                        </div>

                        {/* Three state choices */}
                        <div className="flex items-center space-x-1 border border-slate-200 rounded-xl p-0.5 bg-slate-50 shrink-0 self-end sm:self-auto select-none">
                          <button
                            type="button"
                            onClick={() => handleCheckResultChange(item, "ປົກກະຕິ")}
                            className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                              activeResult === "ປົກກະຕິ" 
                                ? "bg-white text-emerald-800 shadow-sm border border-emerald-100 font-extrabold" 
                                : "text-slate-450 hover:text-slate-600"
                            }`}
                          >
                            ປົກກະຕິ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckResultChange(item, "ຜິດປົກກະຕິ")}
                            className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                              activeResult === "ຜິດປົກກະຕິ" 
                                ? "bg-red-500 text-white shadow-sm font-extrabold" 
                                : "text-slate-450 hover:text-slate-600"
                            }`}
                          >
                            ຜິດປົກກະຕິ
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCheckResultChange(item, "ບໍ່ກ່ຽວຂ້ອງ")}
                            className={`px-3 py-1 text-[10px] font-black rounded-lg transition-all cursor-pointer ${
                              activeResult === "ບໍ່ກ່ຽວຂ້ອງ" 
                                ? "bg-white text-slate-500 shadow-sm border border-slate-200" 
                                : "text-slate-450 hover:text-slate-600"
                            }`}
                          >
                            ບໍ່ກ່ຽວຂ້ອງ
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* IF ABNORMAL: SHOW INCIDENT CREATION BLOCK */}
              {hasAbnormalItem && (
                <div className="bg-red-50/50 p-5 rounded-2xl border border-red-100 space-y-4 animate-fadeIn">
                  <div className="flex items-center space-x-2 text-red-700">
                    <ShieldAlert className="h-5 w-5 shrink-0" />
                    <h5 className="font-extrabold">ພົບຂໍ້ຜິດປົກກະຕິ! ກະລຸນາປ້ອນລາຍລະອຽດເພື່ອໄຫຼເຂົ້າ Incident Register</h5>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-red-700 mb-1">ລາຍລະອຽດບັນຫາທີ່ພົບ (Issue Details) <span className="text-red-500">*</span></label>
                      <textarea
                        required={hasAbnormalItem}
                        value={issueDetails}
                        onChange={(e) => setIssueDetails(e.target.value)}
                        placeholder="ກ້ອງມົວ, UPS ສຽງດັງ, ແອບໍ່ເຢັນ..."
                        rows={3}
                        className="w-full p-2.5 border border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none rounded-xl bg-white text-slate-850"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-red-700 mb-1">ວິທີແກ້ໄຂສະເໜີ (Proposed Solution) <span className="text-red-500">*</span></label>
                      <textarea
                        required={hasAbnormalItem}
                        value={proposedSolution}
                        onChange={(e) => setProposedSolution(e.target.value)}
                        placeholder="ສະເໜີປ່ຽນສາຍ, ອະນາໄມແຜ່ນຕອງ, ເອີ້ນຊ່າງມາເຊັກ..."
                        rows={3}
                        className="w-full p-2.5 border border-red-200 focus:border-red-400 focus:ring-1 focus:ring-red-400 focus:outline-none rounded-xl bg-white text-slate-850"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold text-red-700 mb-1">ລະດັບຜົນກະທົບ (Impact Level)</label>
                      <select
                        value={impactLevel}
                        onChange={(e) => setImpactLevel(e.target.value)}
                        className="w-full p-2.5 border border-red-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                      >
                        <option value="ສູງ">ສູງ (High Impact)</option>
                        <option value="ປານກາງ">ປານກາງ (Medium Impact)</option>
                        <option value="ຕ່ຳ">ຕ່ຳ (Low Impact)</option>
                      </select>
                    </div>

                    {/* Drag & Drop Photo */}
                    <div>
                      <label className="block text-[11px] font-bold text-red-700 mb-1">ຮູບພາບປະກອບ (Photo Attachment)</label>
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`border-2 border-dashed rounded-xl p-3 text-center transition cursor-pointer flex flex-col items-center justify-center h-24 ${
                          isDragging ? "border-red-500 bg-red-100" : attachmentPhoto ? "border-emerald-500 bg-emerald-50/50" : "border-red-200 bg-white hover:border-red-400"
                        }`}
                        onClick={() => {
                          const fileInput = document.getElementById('pm-photo-input');
                          fileInput?.click();
                        }}
                      >
                        <input
                          id="pm-photo-input"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
                          }}
                        />
                        {attachmentPhoto ? (
                          <div className="flex items-center space-x-2 text-emerald-800">
                            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                            <span className="font-bold text-[10px]">ອັບໂຫຼດຮູບແລ້ວ</span>
                            <img src={attachmentPhoto} alt="Uploaded" className="h-10 w-10 object-cover rounded-lg border ml-2" />
                          </div>
                        ) : (
                          <div className="text-red-700 flex flex-col items-center">
                            <Camera className="h-5 w-5 mb-1" />
                            <p className="text-[10px] font-bold">ລາກ ແລະ ວາງ ຫຼື ຄລິກເພື່ອອັບໂຫຼດຮູບ</p>
                            <p className="text-[8px] text-slate-400 mt-0.5">JPEG / PNG (Max 2MB)</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex border-t border-slate-100 pt-5 space-x-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsCheckModalOpen(false);
                    setSelectedAssetForCheck(null);
                  }}
                  className="px-5 py-2.5 border border-slate-200 text-slate-500 bg-white rounded-xl font-bold hover:bg-slate-50 shadow-sm cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-800 text-white font-bold hover:bg-emerald-900 rounded-xl shadow-md transition cursor-pointer"
                >
                  ບັນທຶກຜົນກວດ (Submit PM Check)
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {/* DIALOG MODAL: VIEW DETAILED PM HISTORIC LOG */}
      {/* ---------------------------------------------------------------------------------------------------------------------- */}
      {viewingHistoryLog && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            
            <div className="p-5 border-b border-slate-100 bg-emerald-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="h-5 w-5" />
                <h3 className="font-bold text-sm">ລາຍລະອຽດຜົນການບຳລຸງຮັກສາ (PM Check Details)</h3>
              </div>
              <button 
                onClick={() => setViewingHistoryLog(null)}
                className="text-white hover:bg-emerald-900/40 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs text-slate-800">
              
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-slate-400 font-bold">ຊັບສິນ (Asset):</p>
                  <p className="font-bold mt-1 text-slate-900">{viewingHistoryLog.assetName} ({viewingHistoryLog.assetCode})</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">ສາຂາ & ຝ່າຍ:</p>
                  <p className="font-bold mt-1 text-slate-900">{viewingHistoryLog.branch} • {viewingHistoryLog.division}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">ວັນທີກວດ PM:</p>
                  <p className="font-bold mt-1 text-slate-900 font-mono">{viewingHistoryLog.inspectionDate}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold">ຜູ້ກວດກາ (Inspector):</p>
                  <p className="font-bold mt-1 text-slate-900">{viewingHistoryLog.inspector}</p>
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">ຜົນການກວດສອບແຕ່ລະລາຍການ:</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-100 rounded-xl p-2 bg-white">
                  {viewingHistoryLog.checklistResults?.map((res, index) => (
                    <div key={index} className="flex items-center justify-between p-2 hover:bg-slate-50/50 rounded-lg">
                      <span className="font-semibold">{index + 1}. {res.item}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        res.result === "ປົກກະຕິ" 
                          ? "bg-green-50 text-green-700" 
                          : res.result === "ຜິດປົກກະຕິ" 
                          ? "bg-red-50 text-red-700 font-extrabold" 
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {res.result}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {viewingHistoryLog.overallResult === "ຜິດປົກກະຕິ" && (
                <div className="bg-red-50 p-4 rounded-xl border border-red-100 space-y-3">
                  <div className="flex items-center space-x-1.5 text-red-700">
                    <ShieldAlert className="h-4.5 w-4.5 shrink-0" />
                    <h5 className="font-black text-[11px] uppercase">ລາຍງານຂໍ້ບົກພ່ອງທີ່ພົບ (Abnormal incident findings)</h5>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold">ລາຍລະອຽດບັນຫາທີ່ພົບ:</p>
                    <p className="font-semibold text-slate-850 mt-0.5">{viewingHistoryLog.issueDetails}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 font-bold">ວິທີແກ້ໄຂສະເໜີ:</p>
                    <p className="font-semibold text-slate-850 mt-0.5">{viewingHistoryLog.proposedSolution}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <p className="text-slate-400 font-bold">ລະດັບຜົນກະທົບ:</p>
                      <p className="font-bold text-red-700 mt-0.5">{viewingHistoryLog.impactLevel}</p>
                    </div>
                    {viewingHistoryLog.relatedIncidentId && (
                      <div>
                        <p className="text-slate-400 font-bold font-mono">Incident Register ID:</p>
                        <p className="font-mono font-bold text-red-700 mt-0.5">{viewingHistoryLog.relatedIncidentId}</p>
                      </div>
                    )}
                  </div>

                  {viewingHistoryLog.photo && (
                    <div className="pt-2 border-t border-red-200/50">
                      <p className="text-slate-400 font-bold mb-1.5">ຮູບພາບປະກອບ:</p>
                      <img 
                        src={viewingHistoryLog.photo} 
                        alt="PM Fault Attachment" 
                        className="max-h-56 rounded-xl border object-contain bg-black/5" 
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-3">
                <button
                  onClick={() => setViewingHistoryLog(null)}
                  className="px-5 py-2 border border-slate-200 text-slate-500 bg-white rounded-xl font-bold hover:bg-slate-50 shadow-sm cursor-pointer"
                >
                  ປິດໜ້າຕ່າງ
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
