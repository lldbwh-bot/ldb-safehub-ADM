/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Search, Plus, Hammer, ShieldAlert, Filter, Info, X, Check, Eye, HelpCircle, Pencil, Scan, QrCode, Download, ChevronDown, Trash2, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { IncidentRecord, UserAccount, RepairApprovalRecord, InspectionRecord, SectorInfo, RepairAssessmentRecord } from '../types';
import {
  ASSET_CATEGORIES,
  getSavedBranches,
  getSavedChecklistItems,
  SECTORS,
  cleanString,
  formatExcelDate,
  CHECKLIST_ITEMS,
  APPSHEET_MAPPING,
} from '../dataStore';
import { LOCATION_FLOOR_LABEL, LOCATION_FLOOR_OPTIONS } from '../locationFloorOptions';
import {
  INCIDENT_ASSET_ADD_NEW_SENTINEL,
  canonicalizeIncidentMasterValue,
  getDirectIncidentAssetNameOptions,
  getIncidentItemTypeOptions,
  isReservedIncidentAssetMasterValue,
} from '../incidentAssetMasterData';
import {
  getIncidentCaseDisplayCode,
  resolveIncidentCaseReference,
} from '../incidentCaseReference';
import {
  detectSafetyFormType,
  getAreasForFormTypeAndSystem,
  getSystemsForFormType,
  type SafetyFormType,
} from '../safetyFormMasterData';
import type { CascadeDeleteImpact } from '../cascadeDelete';

const EMPTY_DELETE_IMPACT: CascadeDeleteImpact = {
  inspections: 0,
  incidents: 0,
  assessments: 0,
  approvals: 0,
  repairTracking: 0,
  repairs: 0,
  attachments: 0,
  totalRecords: 0,
};

function DeleteImpactSummary({ impact }: { impact: CascadeDeleteImpact }) {
  const rows = [
    ['Inspection', impact.inspections],
    ['Incident', impact.incidents],
    ['Assessment', impact.assessments],
    ['Approval', impact.approvals],
    ['Tracking', impact.repairTracking],
    ['History', impact.repairs],
    ['Attachments / Evidence', impact.attachments],
  ];

  return (
    <div data-delete-impact-summary className="grid grid-cols-2 gap-1.5 rounded-xl border border-red-100 bg-red-50/60 p-3">
      {rows.map(([label, value]) => (
        <div key={String(label)} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-600">
          <span>{label}</span>
          <strong className="text-red-700">{value}</strong>
        </div>
      ))}
      <div className="col-span-2 flex items-center justify-between border-t border-red-100 pt-2 text-xs font-bold text-slate-800">
        <span>ລວມ Records</span>
        <strong className="text-red-700">{impact.totalRecords}</strong>
      </div>
    </div>
  );
}

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

interface IncidentsViewProps {
  incidents: IncidentRecord[];
  onAddIncident: (newInc: Omit<IncidentRecord, "ລ/ດ"> | Omit<IncidentRecord, "ລ/ດ">[]) => void;
  onUpdateIncident: (pid: string, updatedFields: Partial<IncidentRecord>) => void;
  onApproveIncident: (incidentPID: string, approvalData: {
    operation: string;
    vendor: string;
    approvedBy: string;
    approvalDate?: string;
    approvalDoc?: string;
  }) => void;
  onCancelIncident?: (pid: string, cancelReason: string) => void;
  currentUser: UserAccount;
  inspections?: InspectionRecord[];
  onDeleteIncidents?: (pids: string[]) => void;
  getDeleteImpact?: (pids: string[]) => CascadeDeleteImpact;
  onClearAllData?: (type: "inspections" | "incidents" | "approvals" | "repairs" | "all") => void;
  sectors?: SectorInfo[];
  onNavigateToEditInspection?: (inspectionCode: string) => void;
  onNavigateToAssessment?: (pid?: string) => void;
  assessments?: RepairAssessmentRecord[];
}

export default function IncidentsView({
  incidents,
  onAddIncident,
  onUpdateIncident,
  onApproveIncident,
  onCancelIncident,
  currentUser,
  inspections = [],
  onDeleteIncidents,
  getDeleteImpact,
  onClearAllData,
  sectors = [],
  onNavigateToEditInspection,
  onNavigateToAssessment,
  assessments = []
}: IncidentsViewProps) {
  const BRANCHES = React.useMemo(() => getSavedBranches(), []);
  const sectorList = sectors && sectors.length > 0 ? sectors : SECTORS;

  const getCaseReference = (inc: IncidentRecord) =>
    resolveIncidentCaseReference(inc, inspections || [], CHECKLIST_ITEMS);

  const getResolvedInspectionType = (inc: IncidentRecord) => {
    const resolved = getCaseReference(inc).inspectionType;
    if (resolved) return resolved;
    return String(inc.ລະຫັດກວດກາ || '').toUpperCase().startsWith('INC-')
      ? 'ການແຈ້ງເຫດດ່ວນ'
      : 'ກວດປະຈໍາວັນ';
  };

  const getResolvedSystemCategory = (inc: IncidentRecord) =>
    getCaseReference(inc).systemCategory || '—';

  const getResolvedSubsystemCategory = (inc: IncidentRecord) =>
    getCaseReference(inc).areaPoint || '—';

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(currentUser.status === "Admin" ? 'ALL' : currentUser.branch);
  const [unitFilter, setUnitFilter] = useState('ALL');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [impactFilter, setImpactFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedPids, setSelectedPids] = useState<string[]>([]);
  const [singleToDelete, setSingleToDelete] = useState<string | null>(null);
  const [showSingleDeleteConfirm, setShowSingleDeleteConfirm] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const pendingDeletePids = showSingleDeleteConfirm && singleToDelete
    ? [singleToDelete]
    : showBulkDeleteConfirm
      ? selectedPids
      : [];
  const deleteImpact = pendingDeletePids.length > 0 && getDeleteImpact
    ? getDeleteImpact(pendingDeletePids)
    : EMPTY_DELETE_IMPACT;

  const toggleSelectedPid = (pid: string) => {
    setSelectedPids(current => current.includes(pid)
      ? current.filter(item => item !== pid)
      : [...current, pid]);
  };

  // Inner tabs: 'pending' (ລໍຖ້າກົດອະນຸມັດສ້ອມ) & 'approved' (ຂໍ້ມູນທີ່ອະນຸມັດສ້ອມແປງແລ້ວ)
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // Dialog State for Direct / Standalone Incident Creation
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [hasAsset, setHasAsset] = useState<'yes' | 'no'>('yes');
  const [assetCode, setAssetCode] = useState('');
  const [assetCategory, setAssetCategory] = useState('ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
  const [assetGroup, setAssetGroup] = useState('');
  const [assetName, setAssetName] = useState('');
  const [isAddingAssetGroup, setIsAddingAssetGroup] = useState(false);
  const [isAddingAssetName, setIsAddingAssetName] = useState(false);
  const [newAssetGroup, setNewAssetGroup] = useState('');
  const [newAssetName, setNewAssetName] = useState('');
  const [previousAssetGroup, setPreviousAssetGroup] = useState('');
  const [previousAssetName, setPreviousAssetName] = useState('');
  const [problem, setProblem] = useState('');
  const [impact, setImpact] = useState('ປານກາງ');
  const [proposedSolution, setProposedSolution] = useState('');

  const [systemCategory, setSystemCategory] = useState('ລະບົບຄວາມປອດໄພ');
  const [subsystemCategory, setSubsystemCategory] = useState('ລະບົບກ້ອງວົງຈອນCCTV');
  const [inspectionType, setInspectionType] = useState('ການແຈ້ງເຫດດ່ວນ');
  const [directChecklistItems, setDirectChecklistItems] = useState(() => getSavedChecklistItems());
  const [directFormType, setDirectFormType] = useState<SafetyFormType>(() =>
    detectSafetyFormType(currentUser.branch, currentUser.branch));

  const incidentItemTypeOptions = React.useMemo(
    () => getIncidentItemTypeOptions(incidents),
    [incidents],
  );
  const directIncidentAssetNameOptions = React.useMemo(
    () => getDirectIncidentAssetNameOptions(incidents, assetGroup),
    [incidents, assetGroup],
  );

  const resetDirectIncidentAddModes = () => {
    setIsAddingAssetGroup(false);
    setIsAddingAssetName(false);
    setNewAssetGroup('');
    setNewAssetName('');
    setPreviousAssetGroup('');
    setPreviousAssetName('');
  };

  const selectDirectIncidentItemType = (value: string) => {
    if (value === INCIDENT_ASSET_ADD_NEW_SENTINEL) {
      setPreviousAssetGroup(assetGroup);
      setNewAssetGroup('');
      setIsAddingAssetGroup(true);
      return;
    }

    setIsAddingAssetName(false);
    setNewAssetName('');
    setAssetGroup(value);
    const namesForItemType = getDirectIncidentAssetNameOptions(incidents, value);
    const canonicalAssetName = canonicalizeIncidentMasterValue(assetName, namesForItemType);
    const hasValidAssetName = namesForItemType.some(
      option => option.toLocaleLowerCase() === canonicalAssetName.toLocaleLowerCase(),
    );
    if (!hasValidAssetName) setAssetName('');
  };

  const acceptNewDirectIncidentItemType = (value: string) => {
    const canonicalValue = canonicalizeIncidentMasterValue(value, incidentItemTypeOptions);
    if (isReservedIncidentAssetMasterValue(canonicalValue)) {
      setAssetGroup(previousAssetGroup);
    } else {
      setIsAddingAssetName(false);
      setNewAssetName('');
      setAssetGroup(canonicalValue);
      const namesForItemType = getDirectIncidentAssetNameOptions(incidents, canonicalValue);
      const hasValidAssetName = namesForItemType.some(
        option => option.toLocaleLowerCase() === assetName.trim().toLocaleLowerCase(),
      );
      if (!hasValidAssetName) setAssetName('');
    }
    setNewAssetGroup('');
    setIsAddingAssetGroup(false);
  };

  const acceptNewDirectIncidentAssetName = (value: string) => {
    const canonicalValue = canonicalizeIncidentMasterValue(value, directIncidentAssetNameOptions);
    setAssetName(
      isReservedIncidentAssetMasterValue(canonicalValue) ? previousAssetName : canonicalValue,
    );
    setNewAssetName('');
    setIsAddingAssetName(false);
  };

  // Unique list of systems and categories for forms
  const uniqueSystems = React.useMemo(() => {
    const systems = new Set<string>();
    systems.add("ລະບົບຄວາມປອດໄພ");
    systems.add("ດ້ານນອກອາຄານ");
    systems.add("ດ້ານໃນອາຄານ");
    systems.add("ຊັບສິນ");
    if (typeof CHECKLIST_ITEMS !== 'undefined') {
      CHECKLIST_ITEMS.forEach(item => {
        if (item.ລະບົບທີ່ກວດ) systems.add(item.ລະບົບທີ່ກວດ);
      });
    }
    if (typeof APPSHEET_MAPPING !== 'undefined') {
      APPSHEET_MAPPING.forEach(item => {
        if (item.ລະບົບທີ່ກວດ) systems.add(item.ລະບົບທີ່ກວດ);
      });
    }
    return Array.from(systems).filter(sys => sys && sys !== "ການແຈ້ງເຫດດ່ວນ");
  }, []);

  const getSubsystemCategories = React.useCallback((sysCategory: string) => {
    const cats = new Set<string>();
    if (sysCategory === "ຊັບສິນ") {
      cats.add("ຊັບສິນ");
    }
    if (typeof CHECKLIST_ITEMS !== 'undefined') {
      CHECKLIST_ITEMS.forEach(item => {
        if (item.ລະບົບທີ່ກວດ === sysCategory && item.ໝວດລະບົບກວດ) {
          cats.add(item.ໝວດລະບົບກວດ);
        }
      });
    }
    if (typeof APPSHEET_MAPPING !== 'undefined') {
      APPSHEET_MAPPING.forEach(item => {
        if (item.ລະບົບທີ່ກວດ === sysCategory && item.ໝວດລະບົບກວດ) {
          cats.add(item.ໝວດລະບົບກວດ);
        }
      });
    }
    
    if (cats.size === 0) {
      if (sysCategory === "ລະບົບຄວາມປອດໄພ") {
        cats.add("ລະບົບກ້ອງວົງຈອນCCTV");
        cats.add("ລະບົບແຈ້ງເຕືອນອັກຄີໄຟ");
        cats.add("ລະບົບແຈ້ງເຕືອນເຫດສຸກເສີນ");
        cats.add("ລະບົບຄວບຄຸມການເຂົ້າອອກ");
      } else if (sysCategory === "ດ້ານນອກອາຄານ") {
        cats.add("ສະຖານທີ່ຈອດລົດ");
        cats.add("ຕູ້ເອທີ ATM ດ້ານໜ້າອາຄານ");
        cats.add("ປ້າຍສັນຍາລັກຕ່າງໆ");
      } else if (sysCategory === "ດ້ານໃນອາຄານ") {
        cats.add("ຫ້ອງໂຖງ");
        cats.add("ຫ້ອງນ້ຳ");
        cats.add("ຫ້ອງປະຊຸມ");
      } else {
        cats.add("ທົ່ວໄປ / ກວດສອບອື່ນໆ");
      }
    }
    return Array.from(cats).filter(cat => cat && cat !== "ການແຈ້ງເຫດດ່ວນ");
  }, []);

  // Extract unique historic assets from the incidents database for matching
  const uniqueAssets = React.useMemo(() => {
    const map = new Map<string, {
      ລະຫັດຊັບສິນ: string;
      ພາກສ່ວນຊັບສົມບັດ: string;
      ໝວດລາຍການ: string;
      ລາຍການ: string;
      ສາຂາຊັບສິນ?: string;
      ຝ່າຍຊັບສິນ?: string;
      ຂະແໜງຊັບສິນ?: string;
    }>();

    incidents.forEach(item => {
      const code = String(item.ລະຫັດຊັບສິນ || '').trim();
      if (code) {
        map.set(code.toLowerCase(), {
          ລະຫັດຊັບສິນ: code,
          ພາກສ່ວນຊັບສົມບັດ: item.ພາກສ່ວນຊັບສົມບັດ || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ',
          ໝວດລາຍການ: item.ໝວດລາຍການ || '',
          ລາຍການ: item.ລາຍການ || '',
          ສາຂາຊັບສິນ: (item as any).ສາຂາຊັບສິນ || '',
          ຝ່າຍຊັບສິນ: (item as any).ຝ່າຍຊັບສິນ || '',
          ຂະແໜງຊັບສິນ: (item as any).ຂະແໜງຊັບສິນ || ''
        });
      }
    });

    return Array.from(map.values());
  }, [incidents]);

  // Audio Beep generator for Barcode scan success sound
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {
      console.warn('Audio feedback failed or was blocked by browser guidelines', e);
    }
  };

  // State to control simulated barcode scanning modal
  const [scannerConfig, setScannerConfig] = useState<{
    isOpen: boolean;
    onScan: (scannedCode: string) => void;
  }>({ isOpen: false, onScan: () => {} });
  const [scannerSearch, setScannerSearch] = useState('');

  const handleAssetCodeChange = (val: string) => {
    setAssetCode(val);
    const matched = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (val || '').toLowerCase().trim());
    if (matched) {
      const canonicalAssetGroup = canonicalizeIncidentMasterValue(
        matched.ໝວດລາຍການ,
        incidentItemTypeOptions,
      );
      const namesForItemType = getDirectIncidentAssetNameOptions(incidents, canonicalAssetGroup);
      setAssetCategory(matched.ພາກສ່ວນຊັບສົມບັດ);
      setAssetGroup(canonicalAssetGroup);
      setAssetName(canonicalizeIncidentMasterValue(matched.ລາຍການ, namesForItemType));
      setIsAddingAssetGroup(false);
      setIsAddingAssetName(false);
      setNewAssetGroup('');
      setNewAssetName('');
      if (matched.ສາຂາຊັບສິນ) {
        setAssetBranch(matched.ສາຂາຊັບສິນ);
        setAssetUnit(matched.ຝ່າຍຊັບສິນ || '');
        setAssetSector(matched.ຂະແໜງຊັບສິນ || 'ຂະແໜງ ບໍລິການ');
      }
    }
  };

  const handleEditAssetCodeChange = (val: string) => {
    setEditAssetCode(val);
    const matched = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (val || '').toLowerCase().trim());
    if (matched) {
      setEditAssetCategory(matched.ພາກສ່ວນຊັບສົມບັດ);
      setEditAssetGroup(matched.ໝວດລາຍການ);
      setEditAssetName(matched.ລາຍການ);
      if (matched.ສາຂາຊັບສິນ) {
        setEditAssetBranch(matched.ສາຂາຊັບສິນ);
        setEditAssetUnit(matched.ຝ່າຍຊັບສິນ || '');
        setEditAssetSector(matched.ຂະແໜງຊັບສິນ || 'ຂະແໜງ ບໍລິການ');
      }
    }
  };
  const [targetBranch, setTargetBranch] = useState(() => currentUser?.branch || '');
  const [targetUnit, setTargetUnit] = useState(() => currentUser?.branch || '');
  const [targetSector, setTargetSector] = useState('ຂະແໜງ ບໍລິການ');
  const [locationDetail, setLocationDetail] = useState('');
  const [assetBranch, setAssetBranch] = useState(() => currentUser?.branch || '');
  const [assetUnit, setAssetUnit] = useState(() => currentUser?.branch || '');
  const [assetSector, setAssetSector] = useState('ຂະແໜງ ບໍລິການ');
  const [floor, setFloor] = useState('1');
  const [inspectorName, setInspectorName] = useState(() => currentUser?.username || '');
  const [inspectorStatus, setInspectorStatus] = useState("ພະນັກງານ ທພລ"); // "ພະນັກງານ ທພລ" | "ພາຍນອກ"

  const directSystems = React.useMemo(
    () => getSystemsForFormType(directChecklistItems, directFormType),
    [directChecklistItems, directFormType],
  );
  const directAreas = React.useMemo(
    () => getAreasForFormTypeAndSystem(
      directChecklistItems,
      directFormType,
      systemCategory,
    ),
    [directChecklistItems, directFormType, systemCategory],
  );

  React.useEffect(() => {
    if (isNewOpen) {
      setDirectChecklistItems(getSavedChecklistItems());
    }
  }, [isNewOpen]);

  React.useEffect(() => {
    setDirectFormType(detectSafetyFormType(targetBranch, targetUnit));
  }, [targetBranch, targetUnit]);

  React.useEffect(() => {
    setSystemCategory(current =>
      directSystems.includes(current) ? current : (directSystems[0] ?? ''));
  }, [directSystems]);

  React.useEffect(() => {
    setSubsystemCategory(current =>
      directAreas.includes(current) ? current : (directAreas[0] ?? ''));
  }, [directAreas]);

  // Dialog State for Manager Approval
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [operation, setOperation] = useState('ຈ້າງພາຍນອກ'); // "ຈ້າງພາຍນອກ" | "ສ້ອມແປງເອງ"
  const [vendor, setVendor] = useState('');
  const [approvedBy, setApprovedBy] = useState(() => currentUser?.username || '');
  const [approvalDate, setApprovalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [approvalDoc, setApprovalDoc] = useState(''); // Stores uploaded filename or data
  const [cancelReason, setCancelReason] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // State for Viewing Incident Details
  const [viewingIncident, setViewingIncident] = useState<IncidentRecord | null>(null);

  // Dialog State for Editing Incident
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<IncidentRecord | null>(null);

  const editSystemOptions = React.useMemo(() => {
    if (!editingIncident) return uniqueSystems;
    const isInspectionRef = editingIncident.ລະຫັດກວດກາ && !String(editingIncident.ລະຫັດgວດກາ).toUpperCase().startsWith("INC-");
    if (isInspectionRef) {
      return uniqueSystems;
    } else {
      const systems = new Set<string>();
      systems.add("ການແຈ້ງເຫດດ່ວນ");
      systems.add("ວຽກຈາກການແຈ້ງເຫດ");
      uniqueSystems.forEach(sys => {
        if (sys !== "none" && sys !== "ວຽກຈາກການແຈ້ງເຫດ" && sys !== "ການແຈ້ງເຫດດ່ວນ") {
          systems.add(sys);
        }
      });
      return Array.from(systems);
    }
  }, [editingIncident, uniqueSystems]);

  const getEditSubsystemOptions = React.useCallback((sysCategory: string) => {
    if (!editingIncident) return [];
    const isInspectionRef = editingIncident.ລະຫັດກວດກາ && !String(editingIncident.ລະຫັດກວດກາ).toUpperCase().startsWith("INC-");
    if (isInspectionRef) {
      return getSubsystemCategories(sysCategory);
    } else {
      if (sysCategory === "ການແຈ້ງເຫດດ່ວນ" || sysCategory === "ວຽກຈາກການແຈ້ງເຫດ") {
        return ["ການແຈ້ງເຫດດ່ວນ", "ວຽກຈາກການແຈ້ງເຫດ", "ທົ່ວໄປ / ກວດສອບອື່ນໆ"];
      }
      return getSubsystemCategories(sysCategory);
    }
  }, [editingIncident, getSubsystemCategories]);
  const [editAssetCode, setEditAssetCode] = useState('');
  const [editAssetCategory, setEditAssetCategory] = useState('ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
  const [editAssetGroup, setEditAssetGroup] = useState('');
  const [editAssetName, setEditAssetName] = useState('');
  const [editProblem, setEditProblem] = useState('');
  const [editImpact, setEditImpact] = useState('ປານກາງ');
  const [editProposedSolution, setEditProposedSolution] = useState('');
  const [editTargetBranch, setEditTargetBranch] = useState(currentUser.branch);
  const [editTargetUnit, setEditTargetUnit] = useState(currentUser.branch);
  const [editTargetSector, setEditTargetSector] = useState('ຂະແໜງ ບໍລິການ');
  const [editLocationDetail, setEditLocationDetail] = useState('');
  const [editAssetBranch, setEditAssetBranch] = useState(currentUser.branch);
  const [editAssetUnit, setEditAssetUnit] = useState(currentUser.branch);
  const [editAssetSector, setEditAssetSector] = useState('ຂະແໜງ ບໍລິການ');
  const [editFloor, setEditFloor] = useState('1');

  const [editSystemCategory, setEditSystemCategory] = useState('ລະບົບຄວາມປອດໄພ');
  const [editSubsystemCategory, setEditSubsystemCategory] = useState('ລະບົບກ້ອງວົງຈອນCCTV');
  const [editInspectionType, setEditInspectionType] = useState('ການແຈ້ງເຫດດ່ວນ');

  // Building-floor selection state
  const [roomOrLocation, setRoomOrLocation] = useState('');

  const [editRoomOrLocation, setEditRoomOrLocation] = useState('');

  React.useEffect(() => {
    if (isNewOpen) {
      setLocationDetail("ການແຈ້ງເຫດດ່ວນ");
      setInspectionType("ການແຈ້ງເຫດດ່ວນ");
    }
  }, [isNewOpen]);

  const startEditing = (inc: IncidentRecord) => {
    const caseReference = resolveIncidentCaseReference(
      inc,
      inspections || [],
      CHECKLIST_ITEMS,
    );
    setEditingIncident(inc);
    setEditAssetCode(inc.ລະຫັດຊັບສິນ || '');
    setEditAssetCategory(inc.ພາກສ່ວນຊັບສົມບັດ || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
    setEditAssetGroup(inc.ໝວດລາຍການ || '');
    setEditAssetName(inc.ລາຍການ || '');
    setEditProblem(inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || '');
    setEditImpact(inc.ປະເມີນຜົນກະທົບ || 'ປານກາງ');
    setEditProposedSolution(inc.ວີທີແກ້ໄຂ || '');
    setEditTargetBranch(inc["ສາຂາ "] || currentUser.branch);
    setEditTargetUnit(inc["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || currentUser.branch);
    setEditTargetSector(inc.ຂະແໜງ || 'ຂະແໜງ ບໍລິການ');
    setEditLocationDetail(inc.ສະຖານທີພົບເຫດການ || '');
    setEditAssetBranch((inc as any).ສາຂາຊັບສິນ || inc["ສາຂາ "] || currentUser.branch);
    setEditAssetUnit((inc as any).ຝ່າຍຊັບສິນ || inc["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || currentUser.branch);
    setEditAssetSector((inc as any).ຂະແໜງຊັບສິນ || 'none');
    setEditFloor(caseReference.floor || '1');
    setEditRoomOrLocation(caseReference.roomLocation);
    
    setEditSystemCategory(caseReference.systemCategory);
    setEditSubsystemCategory(caseReference.areaPoint);
    setEditInspectionType(
      caseReference.inspectionType
      || (String(inc.ລະຫັດກວດກາ || '').toUpperCase().startsWith('INC-')
        ? 'ການແຈ້ງເຫດດ່ວນ'
        : 'ກວດປະຈໍາວັນ'),
    );
    
    setIsEditOpen(true);
  };

  const handleUpdateIncidentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;

    if (!editAssetCode.trim() || !editAssetGroup.trim() || !editAssetName.trim() || !editProblem.trim()) {
      alert("ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ");
      return;
    }

    const finalRoom = editRoomOrLocation.trim() || "ບໍ່ລະບຸ";
    onUpdateIncident(editingIncident.PID, {
      ລະຫັດຊັບສິນ: editAssetCode.trim(),
      ພາກສ່ວນຊັບສົມບັດ: editAssetCategory,
      ໝວດລາຍການ: editAssetGroup.trim().toUpperCase(),
      ລາຍການ: editAssetName.trim(),
      ລາຍລະອຽດປັນຫາທີ່ພົບ: editProblem.trim(),
      ປະເມີນຜົນກະທົບ: editImpact,
      ວີທີແກ້ໄຂ: editProposedSolution.trim() || "ລໍຖ້າກວດສອບ",
      "ສາຂາ ": editTargetBranch,
      "ຝ່າຍ/ໜ່ວຍບໍລິການ": editTargetUnit,
      ຂະແໜງ: editTargetSector,
      ລະບົບທີ່ກວດ: editSystemCategory,
      ໝວດລະບົບກວດ: editSubsystemCategory,
      ຮູບແບບການກວດ: editInspectionType,
      ສະຖານທີພົບເຫດການ: editLocationDetail || editSubsystemCategory,
      ສະຖານທີ່_ຫ້ອງ: finalRoom,
      ຊັ້ນອາຄານ: editFloor,
      ...{
        "ສາຂາຊັບສິນ": editAssetBranch,
        "ຝ່າຍຊັບສິນ": editAssetUnit,
        "ຂະແໜງຊັບສິນ": editAssetSector
      } as any
    });

    setIsEditOpen(false);
    setEditingIncident(null);
  };

  // Submit direct incident
  const handleSaveIncident = (e: React.FormEvent) => {
    e.preventDefault();

    const isWithAsset = hasAsset !== 'no';
    const submittedAssetGroup = isAddingAssetGroup
      ? canonicalizeIncidentMasterValue(newAssetGroup, incidentItemTypeOptions)
      : assetGroup;
    const submittedAssetNameOptions = getDirectIncidentAssetNameOptions(
      incidents,
      submittedAssetGroup,
    );
    const submittedAssetName = isAddingAssetName
      ? canonicalizeIncidentMasterValue(newAssetName, submittedAssetNameOptions)
      : assetName;

    if (isWithAsset) {
      if (
        !assetCode.trim()
        || isReservedIncidentAssetMasterValue(submittedAssetGroup)
        || isReservedIncidentAssetMasterValue(submittedAssetName)
        || !problem.trim()
      ) {
        alert("ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ");
        return;
      }
    } else {
      if (!problem.trim()) {
        alert("ກະລຸນາປ້ອນລາຍລະອຽດບັນຫາທີ່ພົບເຫັນ");
        return;
      }
    }

    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    const pid = Math.random().toString(36).substr(2, 9);
    const incidentCode = `INC-${Math.floor(Math.random() * 900 + 100)}`;

    const finalAssetCode = isWithAsset ? assetCode.trim() : "ບໍ່ມີຊັບສິນ";
    const finalAssetCategory = isWithAsset ? assetCategory : "none";
    const finalAssetGroup = isWithAsset ? submittedAssetGroup.trim().toUpperCase() : "NONE";
    const finalAssetName = isWithAsset ? submittedAssetName.trim() : "none";
    const finalAssetBranch = isWithAsset ? assetBranch : "none";
    const finalAssetUnit = isWithAsset ? assetUnit : "none";
    const finalAssetSector = isWithAsset ? assetSector : "none";

    const finalRoom = roomOrLocation.trim() || "ບໍ່ລະບຸ";
    const newInc: Omit<IncidentRecord, "ລ/ດ"> = {
      PID: pid,
      ລະຫັດກວດກາ: incidentCode,
      ຮູບແບບການກວດ: inspectionType,
      ລະບົບທີ່ກວດ: systemCategory,
      ໝວດລະບົບກວດ: subsystemCategory,
      ລາຍການກວດ: "ວຽກຈາກການແຈ້ງເຫດ",
      ລະຫັດຊັບສິນ: finalAssetCode,
      ພາກສ່ວນຊັບສົມບັດ: finalAssetCategory,
      ໝວດລາຍການ: finalAssetGroup,
      ລາຍການ: finalAssetName,
      ລາຍລະອຽດປັນຫາທີ່ພົບ: problem.trim(),
      ປະເມີນຜົນກະທົບ: impact,
      ວີທີແກ້ໄຂ: proposedSolution.trim() || "ລໍຖ້າກວດສອບ",
      "ສາຂາ ": targetBranch,
      "ຝ່າຍ/ໜ່ວຍບໍລິການ": targetUnit,
      ຂະແໜງ: targetSector,
      ສະຖານທີພົບເຫດການ: locationDetail || subsystemCategory,
      ສະຖານທີ່_ຫ້ອງ: finalRoom,
      ຊັ້ນອາຄານ: floor,
      ເດືອນ: today.getMonth() + 1,
      ປີ: today.getFullYear(),
      order: 1,
      ຮັບອໍເດີ: 1,
      ຈຳນວນຄົງຄ້າງ: 1,
      ສະຖານະ: "ລໍຖ້າປະເມີນລາຍການສ້ອມ",
      ...{
        "ສາຂາຊັບສິນ": finalAssetBranch,
        "ຝ່າຍຊັບສິນ": finalAssetUnit,
        "ຂະແໜງຊັບສິນ": finalAssetSector
      } as any
    };

    onAddIncident(newInc);

    // Reset details
    setAssetCode('');
    setAssetGroup('');
    setAssetName('');
    setProblem('');
    setProposedSolution('');
    setLocationDetail('');
    setRoomOrLocation('');
    setAssetBranch(currentUser.branch);
    setAssetUnit(currentUser.branch);
    setAssetSector('ຂະແໜງ ບໍລິການ');
    setHasAsset('yes');
    resetDirectIncidentAddModes();
    setIsNewOpen(false);
  };



  // Submit repair approval logic
  const handleSaveApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    
    if (operation === "ຈ້າງພາຍນອກ" && !vendor.trim()) {
      alert("ກະລຸນາລະບຸຜູ້ສະໜອງ/ຜູ້ຮັບຈ້າງ (Vendor)");
      return;
    }

    if (!approvalDoc) {
      alert("ກະລຸນາແນບໄຟລ໌ເອກະສານອ້າງອີງອະນຸມັດກ່ອນບັນທຶກ!");
      return;
    }

    try {
      onApproveIncident(selectedIncident.PID, {
        operation,
        vendor: operation === "ສ້ອມແປງເອງ" ? "ຊ່າງໄອທີ/ຊ່າງເຕັກນິກທະນາຄານ" : vendor.trim(),
        approvedBy,
        approvalDate,
        approvalDoc
      });
    } catch (err) {
      console.error("Failed to approve incident due to hooks or local storage error:", err);
    }

    setIsApproveOpen(false);
    setSelectedIncident(null);
    setVendor('');
    setApprovalDate(new Date().toISOString().split('T')[0]);
    setApprovalDoc('');
    setCancelReason('');
  };

  // Cancel approval handler
  const handleCancelAction = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;

    if (!cancelReason.trim()) {
      alert("ກະລຸນາລະບຸ ເຫດຜົນການ Cancel ກ່ອນບັນທຶກ!");
      return;
    }

    try {
      if (onCancelIncident) {
        onCancelIncident(selectedIncident.PID, cancelReason.trim());
      } else {
        onUpdateIncident(selectedIncident.PID, { ສະຖານະ: "Cancelled" });
      }
    } catch (err) {
      console.error("Failed to cancel incident:", err);
    }

    setIsApproveOpen(false);
    setSelectedIncident(null);
    setCancelReason('');
    setVendor('');
    setApprovalDate(new Date().toISOString().split('T')[0]);
    setApprovalDoc('');
  };

  // Helper to convert date to ISO YYYY-MM-DD for standard comparable filtering
  const getISOStyleDate = (val: any): string => {
    if (!val) return "";
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      const parts = str.split('/');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const num = Number(str);
    if (!isNaN(num) && num > 0) {
      const date = new Date((num - 25569) * 86400 * 1000);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${year}-${month}-${day}`;
    }
    return str;
  };

  // Dynamic unique list of units for dropdown selection
  const uniqueUnits = React.useMemo(() => {
    const list = incidents.map(item => item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]).filter(Boolean);
    return Array.from(new Set(list)).sort();
  }, [incidents]);

  // Handle Export to Excel
  const handleExportExcel = () => {
    const dataToExport = activeTab === 'pending' ? pendingIncidents : approvedIncidents;
    const exportData = dataToExport.map((inc, index) => {
      const caseReference = resolveIncidentCaseReference(
        inc,
        inspections || [],
        CHECKLIST_ITEMS,
      );
      const inspectionType = caseReference.inspectionType || (
        String(inc.ລະຫັດກວດກາ || '').toUpperCase().startsWith('INC-')
          ? 'ການແຈ້ງເຫດດ່ວນ'
          : 'ກວດປະຈໍາວັນ'
      );
      const systemCategory = caseReference.systemCategory || 'none';
      const subsystemCategory = caseReference.areaPoint || 'none';

      const matchedAsset = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (inc.ລະຫັດຊັບສິນ || '').toLowerCase().trim());
      const assetBranchVal = (inc as any).ສາຂາຊັບສິນ || (matchedAsset ? matchedAsset.ສາຂາຊັບສິນ : 'none') || 'none';
      const assetUnitVal = (inc as any).ຝ່າຍຊັບສິນ || (matchedAsset ? matchedAsset.ຝ່າຍຊັບສິນ : 'none') || 'none';
      const assetSectorVal = (inc as any).ຂະແໜງຊັບສິນ || (matchedAsset ? matchedAsset.ຂະແໜງຊັບສິນ : 'none') || 'none';

      const branchValue = caseReference.branch || 'none';
      const unitValue = caseReference.division || 'none';
      const sectorValue = caseReference.sector || 'none';

      return {
        "ລ/ດ (No.)": index + 1,
        "ລະຫັດ PID (PID)": inc.PID,
        "ລະຫັດກວດກາ (Inspection Ref)": inc.ລະຫັດກວດກາ,
        "ສາຂາ (Branch)": branchValue,
        "ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)": unitValue,
        "ຂະແໜງ (Sector)": sectorValue,
        "ຮູບແບບການກວດ (Inspection Type)": inspectionType,
        "ລະບົບທີ່ກວດ (System Category)": systemCategory,
        "ພື້ນທີ່/ຈຸດກວດ ( Area / Point)": subsystemCategory,
        [LOCATION_FLOOR_LABEL]: caseReference.roomLocation || "—",
        "ລະຫັດຊັບສິນ (Asset Code)": inc.ລະຫັດຊັບສິນ || 'none',
        "ລາຍການຊັບສິນ (Asset Name)": inc.ລາຍການ || '',
        "ພາກສ່ວນຊັບສົມບັດ (Asset Category)": inc.ພາກສ່ວນຊັບສົມບັດ || '',
        "ໝວດລາຍການ (Asset Group)": inc.ໝວດລາຍການ || '',
        "ສາຂາຂອງຊັບສິນ (Asset Branch)": assetBranchVal || 'none',
        "ຝ່າຍ/ໜ່ວຍບໍລິການຊັບສິນ (Asset Division/Unit)": assetUnitVal || 'none',
        "ຂະແໜງຊັບສິນ (Asset Sector)": assetSectorVal || 'none',
        "ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)": inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || '',
        "ປະເມີນຜົນກະທົບ (Impact Level)": inc.ປະເມີນຜົນກະທົບ || '',
        "ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)": inc.ວີທີແກ້ໄຂ || '',
        "ວັນທີ່ກວດ (Detected Date)": formatExcelDate(inc.ວັນທີ່ກວດ),
        "ເວລາກວດ (Detected Time)": inc.ເວລາກວດ || '',
        "ຜູ້ກວດກາ (Reporter)": inc.ຊື່ຜູ້ກວດ || '',
        "ສະຖານະ (Status)": inc.ສະຖານະ || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-fit column widths
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const cols = [];
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
      let maxLen = 10;
      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: colNum })];
        if (cell && cell.v) {
          const valStr = String(cell.v);
          if (valStr.length > maxLen) {
            maxLen = valStr.length;
          }
        }
      }
      cols.push({ wch: maxLen + 2 });
    }
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    const sheetName = activeTab === 'pending' ? "ລໍຖ້າອະນຸມັດ" : "ອະນຸມັດແລ້ວ";
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, `ລາຍງານທະບຽນເຫດການ_${sheetName === 'ລໍຖ້າອະນຸມັດ' ? 'ລໍຖ້າກົດອະນຸມັດ' : 'ອະນຸມັດສ້ອມແປງແລ້ວ'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Filter application
  const filteredList = incidents.filter(item => {
    if (item.ສະຖານະ === "Cancelled") return false;
    const sBranch = item["ສາຂາ "] || "";
    const sStatus = item.ສະຖານະ || "ລໍຖ້າການອະນຸມັດ";
    const sImpact = item.ປະເມີນຜົນກະທົບ || "ຕ່ຳ";
    const sAsset = item.ລາຍການ || "";
    const sCode = item.ລະຫັດກວດກາ || "";
    const sProb = item.ລາຍລະອຽດປັນຫາທີ່ພົບ || "";
    const sUnit = item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "";
    const sDate = getISOStyleDate(item.ວັນທີ່ກວດ);

    const matchesSearch = 
      sCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sProb.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;
    const matchesUnit = unitFilter === "ALL" || sUnit === unitFilter;
    const matchesImpact = impactFilter === "ALL" || sImpact === impactFilter;
    const matchesStatus = statusFilter === "ALL" || sStatus === statusFilter;
    const matchesStartDate = !startDateFilter || sDate >= startDateFilter;
    const matchesEndDate = !endDateFilter || sDate <= endDateFilter;

    return matchesSearch && matchesBranch && matchesUnit && matchesImpact && matchesStatus && matchesStartDate && matchesEndDate;
  }).sort((a,b) => {
    const scrapB = String(b.ວັນທີ່ກວດ);
    const scrapA = String(a.ວັນທີ່ກວດ);
    return scrapB.localeCompare(scrapA);
  });

  const pendingIncidents = filteredList.filter(item => {
    const status = item.ສະຖານະ || "ລໍຖ້າປະເມີນລາຍການສ້ອມ";
    
    // Exclude approved, repairing, completed, or cancelled
    if (
      status === "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ" ||
      status === "ອະນຸມັດແລ້ວ" ||
      status === "ລໍຖ້າສ້ອມແປງ" ||
      status === "ກຳລັງສ້ອມແປງ" ||
      status === "ສ້ອມສຳເລັດ (ລໍຖ້າປິດງານ)" ||
      status === "ສຳເລັດ" ||
      status === "ສໍາເລັດ" ||
      status === "Cancelled" ||
      status === "ຢຸດຊົ່ວຄາວ" ||
      status === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" ||
      status === "No Assessment Required"
    ) {
      return false;
    }

    // Exclude if there is already a completed/submitted assessment
    const assessment = (assessments || []).find(asm => asm.incidentId === item.PID);
    if (assessment) {
      const asmStatus = assessment.assessmentStatus;
      const isPending = 
        asmStatus === "Pending" || 
        asmStatus === "Waiting" || 
        asmStatus === "ລໍຖ້າປະເມີນ" || 
        asmStatus === "ລໍຖ້າປະເມີນລາຍການສ້ອມ" || 
        asmStatus === "ກຳລັງປະເມີນ";
      if (!isPending) {
        return false;
      }
    }

    return true;
  });

  const approvedIncidents = filteredList.filter(item => {
    const status = item.ສະຖານະ || "ລໍຖ້າປະເມີນລາຍການສ້ອມ";
    return (
      status === "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ" ||
      status === "ອະນຸມັດແລ້ວ" ||
      status === "ລໍຖ້າສ້ອມແປງ" ||
      status === "ກຳລັງສ້ອມແປງ" ||
      status === "ສ້ອມສຳເລັດ (ລໍຖ້າປິດງານ)" ||
      status === "ສຳເລັດ" ||
      status === "ສໍາເລັດ" ||
      status === "ຢຸດຊົ່ວຄາວ" ||
      status === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" ||
      status === "No Assessment Required"
    );
  });

  return (
    <div className="space-y-6">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-850">ທະບຽນເຫດການ & ຄວາມສ່ຽງ (Incident Register)</h3>
          <p className="text-xs text-slate-500">
            ຕິດຕາມຄວາມເສຍຫາຍ, ຈຸດບົກພ່ອງທີ່ພົບໃນອາຄານ ແລະ ຂັ້ນຕອນການອະນຸມັດສ້ອມແປງ
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          {currentUser.status === "Admin" && selectedPids.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center justify-center p-3 text-xs font-bold rounded-xl text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition shadow-sm shrink-0 cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              ລຶບທີ່ເລືອກ ({selectedPids.length})
            </button>
          )}
          <button
            onClick={handleExportExcel}
            className="flex items-center justify-center p-3 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50 border border-emerald-150 hover:bg-emerald-100 transition shadow-sm shrink-0 uppercase cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1.5 text-emerald-600" />
            ດາວໂຫຼດ Excel (Export)
          </button>
          <button
            onClick={() => setIsNewOpen(true)}
            className="flex items-center justify-center p-3 text-xs font-bold rounded-xl text-white bg-indigo-700 hover:bg-indigo-800 transition shadow-sm shrink-0 uppercase cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            ແຈ້ງເຫດການເສຍຫາຍ (Direct Incident Report)
          </button>
        </div>
      </div>

      {/* Linear Flow Notice Banner */}
      <div className="bg-[#071f33] border border-sky-400/30 p-4 rounded-xl flex items-start space-x-2.5 text-xs text-sky-200 animate-fadeIn">
        <Info className="h-5 w-5 text-sky-650 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-sky-900">🔄 ຂັ້ນຕອນການເຮັດວຽກແບບ Linear (Linear Repair Flow Active)</p>
          <p className="text-slate-655 font-medium mt-1 leading-relaxed">
            ທຸກໆເຫດການທີ່ຖືກແຈ້ງ (ບໍ່ວ່າຈະມາຈາກການກວດກາອາຄານ Building Inspection ຫຼື ແຈ້ງເຫດດ່ວນ Direct Incident) ຈະຕ້ອງໄດ້ຮັບການປະເມີນລາຍການສ້ອມແປງກ່ອນ (**Repair Assessment**) ໂດຍຊ່າງພາຍໃນ ຫຼື Vendor, ຫຼັງຈາກນັ້ນຈຶ່ງຈະຖືກສົ່ງຕໍ່ໄປຍັງຂັ້ນຕອນອະນຸມັດ (**Repair Approval**) ແລະ ຕິດຕາມຜົນການສ້ອມແປງຕາມລຳດັບ.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4 text-xs font-semibold">
        <div>
          <label className="block text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ລະຫັດ, ຊັບສິນ, ບັນຫາ..."
              className="w-full border border-slate-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-indigo-500 bg-white"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ສາຂາ</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={currentUser.status !== "Admin"}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
          >
            {currentUser.status === "Admin" && <option value="ALL">ທຸກສາຂາ (ALL)</option>}
            {Array.from(new Set(incidents.map(i => i["ສາຂາ "]))).filter(Boolean).map((br, idx) => (
              <option key={idx} value={br}>{br}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ໜ່ວຍບໍລິການ</label>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
          >
            <option value="ALL">ທຸກໜ່ວຍບໍລິການ (ALL)</option>
            {uniqueUnits.map((u, idx) => (
              <option key={idx} value={u}>{u}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ວັນທີ່ເລີ່ມຕົ້ນ</label>
          <input
            type="date"
            value={startDateFilter}
            onChange={(e) => setStartDateFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ວັນທີ່ສິ້ນສຸດ</label>
          <input
            type="date"
            value={endDateFilter}
            onChange={(e) => setEndDateFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
          />
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ລະດັບຜົນກະທົບ</label>
          <select
            value={impactFilter}
            onChange={(e) => setImpactFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
          >
            <option value="ALL">ທຸກລະດັບ</option>
            <option value="ສູງ">ສູງ (High)</option>
            <option value="ປານກາງ">ປານກາງ (Medium)</option>
            <option value="ຕ່ຳ">ຕ່ຳ (Low)</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ສະຖານະ</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold"
          >
            <option value="ALL">ທຸກສະຖານະ</option>
            <option value="ລໍຖ້າການອະນຸມັດ">ລໍຖ້າການອະນຸມັດ (Pending Approval)</option>
            <option value="ອະນຸມັດແລ້ວ">ອະນຸມັດແລ້ວ (Approved)</option>
            <option value="ລໍຖ້າສ້ອມແປງ">ລໍຖ້າສ້ອມແປງ (Awaiting Repair)</option>
            <option value="ສຳເລັດ">ສຳເລັດ (Completed)</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'pending'
              ? 'border-indigo-600 bg-indigo-50/20 text-indigo-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <span className="text-sm">⏳</span>
          <span>1. ລໍຖ້າປະເມີນລາຍການສ້ອມ (Waiting for Repair Assessment)</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'pending' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {pendingIncidents.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('approved')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'approved'
              ? 'border-emerald-600 bg-emerald-50/20 text-emerald-800 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <span className="text-sm">✅</span>
          <span>2. ຂໍ້ມູນທີ່ອະນຸມັດສ້ອມແປງແລ້ວ</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {approvedIncidents.length}
          </span>
        </button>
      </div>

      {/* Tab View Container */}
      <div className="w-full">
        {activeTab === 'pending' ? (
          /* Column 1: Awaiting Repair Approval */
          <div className="bg-white rounded-b-xl rounded-t-none border border-t-0 border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[35rem] max-h-[50rem] animate-fadeIn">
            <div className="p-4 bg-red-50/60 border-b border-red-100 flex items-center justify-between">
              <span className="text-xs font-bold text-red-900 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                🔴 ຟາກທີ 1: ລໍຖ້າປະເມີນລາຍການສ້ອມ ({pendingIncidents.length} ລາຍການ)
              </span>
              <span className="text-[10px] text-red-655 bg-red-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Awaiting</span>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
              {pendingIncidents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingIncidents.map((inc, i) => {
                    const isHigh = inc.ປະເມີນຜົນກະທົບ === "ສູງ";
                    const isMedium = inc.ປະເມີນຜົນກະທົບ === "ປານກາງ";
                    const caseReference = getCaseReference(inc);
                    const displayCode = getIncidentCaseDisplayCode(inc, incidents);
                    return (
                      <div 
                        key={i} 
                        onClick={() => setViewingIncident(inc)}
                        className="bg-white p-4 rounded-xl border border-slate-150 hover:shadow-lg hover:border-red-400 hover:scale-[1.015] transition-all duration-200 space-y-3 cursor-pointer group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded group-hover:bg-indigo-100 transition">
                              {displayCode}
                            </span>
                            <div className="flex items-center gap-2">
                              {currentUser.status === "Admin" && (
                                <input
                                  type="checkbox"
                                  aria-label={`Select incident ${inc.PID}`}
                                  checked={selectedPids.includes(inc.PID)}
                                  onClick={(event) => event.stopPropagation()}
                                  onChange={() => toggleSelectedPid(inc.PID)}
                                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                />
                              )}
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isHigh ? 'bg-red-50 text-red-655 border border-red-150 animate-pulse' :
                                isMedium ? 'bg-amber-50 text-amber-600 border border-amber-150' :
                                'bg-blue-50 text-blue-600 border border-blue-150'
                              }`}>
                                ຜົນກະທົບ: {inc.ປະເມີນຜົນກະທົບ || "ຕ່ຳ"}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-1.5 text-xs text-slate-700 mt-2">
                            <p className="font-bold text-slate-850 group-hover:text-red-700 text-xs sm:text-[13px] transition">{inc.ລາຍການ || 'ບໍ່ຮູ້ຊື່ຊັບສິນ'}</p>
                            <p className="text-[10px] text-indigo-600 font-mono font-medium">ລະຫັດຊັບສິນ: {inc.ລະຫັດຊັບສິນ}</p>
                            
                            <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-[11px] space-y-1">
                              <p className="text-slate-500 font-semibold text-[10px]">
                                <strong>ສາຂາ:</strong> <span className="text-indigo-950 font-bold">{caseReference.branch || "ບໍ່ລະບຸ"}</span>
                              </p>
                              <p className="text-slate-500 font-semibold text-[10px]">
                                <strong>ໜ່ວຍບໍລິການ:</strong> <span className="text-slate-700">{caseReference.division || "ບໍ່ລະບຸ"}</span>
                              </p>
                              <p className="text-slate-500 font-semibold text-[10px]">
                                <strong>ຮູບແບບການກວດ:</strong> <span className="text-indigo-950 font-bold">{getResolvedInspectionType(inc)}</span>
                              </p>
                              <p className="text-slate-500 font-semibold text-[10px]">
                                <strong>ລະບົບທີ່ກວດ (System Category):</strong> <span className="text-indigo-950 font-bold">{getResolvedSystemCategory(inc)}</span>
                              </p>
                              <p className="text-slate-500 font-semibold text-[10px]">
                                <strong>ພື້ນທີ່/ຈຸດກວດ ( Area / Point):</strong> <span className="text-indigo-950 font-bold">{getResolvedSubsystemCategory(inc)}</span>
                              </p>
                              {caseReference.roomLocation && (
                                <p className="text-slate-500 font-semibold text-[10px]">
                                  <strong>{LOCATION_FLOOR_LABEL}:</strong> <span className="text-indigo-950 font-bold">🚪 {caseReference.roomLocation}</span>
                                </p>
                              )}
                              <p className="text-slate-650 leading-relaxed pt-1 border-t border-slate-100">
                                <strong>ບັນຫາທີ່ພົບ:</strong> <span className="text-slate-800 font-medium">{inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}</span>
                              </p>
                              <p className="text-red-655 leading-relaxed">
                                <strong>ວິທີແກ້ໄຂສະເໜີ:</strong> <span className="font-semibold text-slate-850">{inc.ວີທີແກ້ໄຂ || "ລໍຖ້າກວດສອບ"}</span>
                              </p>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                              <span>ຜູ້ແຈ້ງ: <strong className="text-slate-600">{inc.ຊື່ຜູ້ກວດ}</strong></span>
                              <span className="font-mono">{formatExcelDate(inc.ວັນທີ່ກວດ)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 mt-3 border-t border-slate-100 flex justify-between gap-2">
                          {currentUser.status === "Admin" && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSingleToDelete(inc.PID);
                                setShowSingleDeleteConfirm(true);
                              }}
                              className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold py-1.5 px-2.5 rounded-lg flex items-center justify-center transition cursor-pointer shadow-sm shrink-0"
                              title="Delete incident and linked workflow"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(inc);
                            }}
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] cursor-pointer shadow-sm shrink-0"
                            title="ແກ້ໄຂຂໍ້ມູນເຫດການ"
                          >
                            <Pencil className="h-3.5 w-3.5 shrink-0" />
                            ແກ້ໄຂ (Edit)
                          </button>
                          {(!inc.ສະຖານະ || inc.ສະຖານະ === "ລໍຖ້າປະເມີນລາຍການສ້ອມ" || inc.ສະຖານະ === "ກຳລັງປະເມີນ") ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!inc.ສະຖານະ) {
                                  onUpdateIncident(inc.PID, { ສະຖານະ: "ລໍຖ້າປະເມີນລາຍການສ້ອມ" });
                                }
                                if (onNavigateToAssessment) {
                                  onNavigateToAssessment(inc.PID);
                                }
                              }}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition text-[11px] cursor-pointer shadow-sm"
                            >
                              <FileText className="h-4 w-4 text-white shrink-0" />
                              ສົ່ງໄປ Repair Assessment
                            </button>
                          ) : (
                            <div className="flex-1 bg-slate-100 border border-slate-200 text-slate-500 font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 text-[11px]">
                              <span>ສະຖານະ: {inc.ສະຖານະ}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-20 bg-white m-2 rounded-xl border border-dashed border-slate-200 animate-fadeIn">
                  <span className="text-2xl mb-1 mt-2">✨</span>
                  <p className="font-bold text-[11px] text-slate-500">ດີເລີດ! ບໍ່ມີລາຍການຄົງຄ້າງທີ່ລໍຖ້າການອະນຸມັດໃນໝວດນີ້</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Column 2: Approved List Table View */
          <div className="bg-white rounded-b-xl rounded-t-none border border-t-0 border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[35rem] max-h-[50rem] animate-fadeIn">
            <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 animate-fadeIn">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0"></span>
                🟢 ຟາກທີ່ອະນຸມັດສ້ອມແປງແລ້ວ ({approvedIncidents.length} ລາຍການ)
              </span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Approved Table View</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/40">
              {approvedIncidents.length > 0 ? (
                <div className="overflow-x-auto text-xs bg-white rounded-xl border border-slate-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-550 font-bold border-b border-slate-200 text-[11px] uppercase tracking-wider">
                        {currentUser.status === "Admin" && <th className="p-3 text-center w-20">Delete</th>}
                        <th className="p-3 text-center w-12">ລ/ດ</th>
                        <th className="p-3">ລະຫັດ / ວັນທີ່</th>
                        <th className="p-3">ສາຂາ / ໜ່ວຍບໍລິການ</th>
                        <th className="p-3">ຂະແໜງ (Sector)</th>
                        <th className="p-3">{LOCATION_FLOOR_LABEL}</th>
                        <th className="p-3">ລາຍການຊັບສິນ</th>
                        <th className="p-3">ຂະແໜງຂອງຊັບສິນ</th>
                        <th className="p-3">ບັນຫາທີ່ພົບ</th>
                        <th className="p-3 text-center">ລະດັບຜົນກະທົບ</th>
                        <th className="p-3">ວິທີແກ້ໄຂ</th>
                        <th className="p-3 text-center">ຜູ້ແຈ້ງ</th>
                        <th className="p-3 text-center">ສະຖານະ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {approvedIncidents.map((inc, index) => {
                        const isHigh = inc.ປະເມີນຜົນກະທົບ === "ສູງ";
                        const isMedium = inc.ປະເມີນຜົນກະທົບ === "ປານກາງ";
                        const status = inc.ສະຖານະ || "ອະນຸມັດແລ້ວ";
                        const isCompleted = status === "ສຳເລັດ" || status === "ສໍາເລັດ";
                        const caseReference = getCaseReference(inc);
                        const displayCode = getIncidentCaseDisplayCode(inc, incidents);
                        return (
                          <tr 
                            key={index} 
                            onClick={() => setViewingIncident(inc)}
                            className="hover:bg-emerald-50/30 transition-colors duration-150 cursor-pointer text-slate-700 font-medium"
                          >
                            {currentUser.status === "Admin" && (
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-2">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select incident ${inc.PID}`}
                                    checked={selectedPids.includes(inc.PID)}
                                    onClick={(event) => event.stopPropagation()}
                                    onChange={() => toggleSelectedPid(inc.PID)}
                                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                                  />
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSingleToDelete(inc.PID);
                                      setShowSingleDeleteConfirm(true);
                                    }}
                                    className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 cursor-pointer"
                                    title="Delete incident and linked workflow"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            )}
                            <td className="p-3 text-center font-mono font-semibold text-slate-400">{index + 1}</td>
                            <td className="p-3">
                              <div className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded inline-block mb-1">
                                {displayCode}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono">{formatExcelDate(inc.ວັນທີ່ກວດ)}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-indigo-950">{caseReference.branch || "ບໍ່ລະບຸ"}</div>
                              <div className="text-[10px] text-slate-500">{caseReference.division || "ບໍ່ລະບຸ"}</div>
                            </td>
                            <td className="p-3">
                              <span className="bg-slate-100 border border-slate-200 text-slate-650 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                {caseReference.sector || '—'}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                {caseReference.roomLocation || '—'}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800">{inc.ລາຍການ || 'ບໍ່ຮູ້ຊື່ຊັບສິນ'}</div>
                              <div className="text-[10px] text-indigo-600 font-mono">ລະຫັດ: {inc.ລະຫັດຊັບສິນ}</div>
                              <div className="text-[10px] text-indigo-600 mt-1 font-bold">
                                {caseReference.systemCategory || "—"} / {caseReference.areaPoint || "—"}
                              </div>
                            </td>
                            <td className="p-3">
                              <span className="bg-indigo-50 border border-indigo-100 text-indigo-750 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                                {(inc as any).ຂະແໜງຊັບສິນ || '—'}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] max-w-xs truncate" title={inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}>
                              {inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isHigh ? 'bg-red-50 text-red-655 border border-red-150' :
                                isMedium ? 'bg-amber-50 text-amber-600 border border-amber-150' :
                                'bg-blue-50 text-blue-600 border border-blue-150'
                              }`}>
                                {isHigh ? "🔴 ສູງ" : isMedium ? "🟡 ກາງ" : "🔵 ຕ່ຳ"}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-emerald-800">
                              <div className="font-semibold line-clamp-2">{inc.ວີທີແກ້ໄຂ || "ລໍຖ້າກວດສອບ"}</div>
                            </td>
                            <td className="p-3 text-center font-semibold text-slate-655 underline decoration-slate-300">{inc.ຊື່ຜູ້ກວດ}</td>
                            <td className="p-3 text-center">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                isCompleted ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-blue-100 text-blue-805 border border-blue-200'
                              }`}>
                                {status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-20 bg-white m-2 rounded-xl border border-dashed border-slate-200 animate-fadeIn">
                  <span className="text-2xl mb-1">🏜️</span>
                  <p className="font-bold text-[11px] text-slate-500">ບໍ່ມີລາຍການທີ່ໄດ້ຮັບການອະນຸມັດເທື່ອ</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {(showSingleDeleteConfirm || showBulkDeleteConfirm) && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-red-100 bg-white p-5 shadow-2xl">
            <div className="flex items-center gap-2 text-red-700">
              <Trash2 className="h-5 w-5" />
              <h4 className="text-base font-bold">ຢືນຢັນການລຶບ Incident</h4>
            </div>
            <p className="text-xs font-semibold leading-relaxed text-slate-600">
              ການລຶບນີ້ຈະລົບ Incident ທີ່ເລືອກ ແລະທຸກຂໍ້ມູນ Workflow ທີ່ຜູກກັນ ລວມທັງ Attachments / Evidence. ຂໍ້ມູນຈະບໍ່ສາມາດກູ້ຄືນໄດ້.
            </p>
            <DeleteImpactSummary impact={deleteImpact} />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowSingleDeleteConfirm(false);
                  setShowBulkDeleteConfirm(false);
                  setSingleToDelete(null);
                }}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                disabled={deleteImpact.totalRecords === 0}
                onClick={() => {
                  if (onDeleteIncidents && pendingDeletePids.length > 0) {
                    onDeleteIncidents(pendingDeletePids);
                  }
                  setSelectedPids([]);
                  setShowSingleDeleteConfirm(false);
                  setShowBulkDeleteConfirm(false);
                  setSingleToDelete(null);
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 cursor-pointer"
              >
                ຢືນຢັນການລຶບ ({pendingDeletePids.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog 1: Direct Incident Creation Form */}
      {isNewOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full flex flex-col max-h-[90vh]">
            <div className="bg-indigo-800 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" />
                <h4 className="font-bold text-sm sm:text-base">
                  ຟອມແຈ້ງການເສຍຫາຍ ແລະ ຄວາມສ່ຽງ (Direct Incident Report)
                </h4>
              </div>
              <button 
                onClick={() => setIsNewOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIncident} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              
              {/* Branch and Division info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="col-span-1 sm:col-span-2 pb-1 border-b border-slate-200/60 mb-1">
                  <span className="font-bold text-indigo-900 text-[13px] flex items-center gap-1.5">
                    📍 ສະຖານທີ່ພົບເຫດການ (Incident Occurrence Location)
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສາຂາ</label>
                  <select
                    value={targetBranch}
                    onChange={(e) => {
                      setTargetBranch(e.target.value);
                      setTargetUnit(e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                  >
                    {currentUser.status === "Admin" ? (
                      Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map((br, idx) => (
                        <option key={idx} value={br}>{br}</option>
                      ))
                    ) : (
                      <option value={currentUser.branch}>{currentUser.branch}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຝ່າຍ/ໜ່ວຍບໍລິການ</label>
                  <select
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    {BRANCHES.filter(b => b.ສາຂາ === targetBranch).map((b, idx) => (
                      <option key={idx} value={b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}>
                        {b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ
                        }
                      </option>
                    ))}
                    {BRANCHES.filter(b => b.ສາຂາ === targetBranch).length === 0 && (
                      <option value={targetBranch}>{targetBranch}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຂະແໜງ</label>
                  <select
                    value={targetSector}
                    onChange={(e) => setTargetSector(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  >
                    {sectorList.map((s, idx) => (
                      <option key={idx} value={s.ຂະແໜງ}>{s.ຂະແໜງ}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    {LOCATION_FLOOR_LABEL} *
                  </label>
                  <select
                    value={roomOrLocation}
                    onChange={(e) => setRoomOrLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs shadow-sm"
                    required
                  >
                    <option value="">-- ເລືອກຊັ້ນອາຄານ --</option>
                    {LOCATION_FLOOR_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2 bg-emerald-50/40 p-3 rounded-lg border border-emerald-100/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="block font-bold text-slate-700">
                      ແຍກຟອມກວດກາຄວາມປອດໄພ (Safety Form Type)
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      {currentUser.status === "Admin"
                        ? "ລະບົບກວດພົບອັດຕະໂນມັດຕາມສາຂາ/ໜ່ວຍງານ ຫຼື Admin ສາມາດປ່ຽນໄດ້"
                        : "ລະບົບລັອກຟອມຕາມສາຂາ/ໜ່ວຍງານຂອງທ່ານ"}
                    </span>
                  </div>
                  <select
                    id="direct-incident-form-type-select"
                    value={directFormType}
                    disabled={currentUser.status !== "Admin"}
                    onChange={(event) =>
                      setDirectFormType(event.target.value as SafetyFormType)}
                    className={`border rounded-lg p-2 font-bold min-w-[200px] ${
                      currentUser.status === "Admin"
                        ? "border-emerald-300 text-emerald-800 cursor-pointer bg-white"
                        : "border-slate-300 text-slate-500 bg-slate-100 cursor-not-allowed"
                    }`}
                  >
                    <option value="ສຳນັກງານໃຫຍ່">ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>
                    <option value="ສາຂາ">ຟອມ ສາຂາ (Branch)</option>
                    <option value="ໜ່ວຍບໍລິການ">ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>
                    <option value="ຫ້ອງຮັບເງິນ">ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຮູບແບບການກວດ (Inspection Type) *</label>
                  <select
                    value={inspectionType}
                    onChange={(e) => setInspectionType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-slate-100 text-slate-500 font-semibold cursor-not-allowed"
                    required
                    disabled
                  >
                    <option value="ການແຈ້ງເຫດດ່ວນ">ການແຈ້ງເຫດດ່ວນ</option>
                    <option value="ກວດປະຈໍາວັນ">ກວດປະຈໍາວັນ</option>
                    <option value="ກວດປະຈໍາອາທິດ">ກວດປະຈໍາອາທິດ</option>
                    <option value="ສຸມກວດ">ສຸມກວດ</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ລະບົບທີ່ກວດ (System Category) *</label>
                  <select
                    id="direct-incident-system-category-select"
                    value={systemCategory}
                    onChange={(e) => setSystemCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold"
                    required
                  >
                    {directSystems.map((sys, idx) => (
                      <option key={idx} value={sys}>{sys}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block font-bold text-slate-600 mb-1">ພື້ນທີ່/ຈຸດກວດ ( Area / Point) *</label>
                  <select
                    id="direct-incident-area-point-select"
                    value={subsystemCategory}
                    onChange={(e) => setSubsystemCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold"
                    required
                  >
                    {directAreas.map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຊື່ຜູ້ກວດ (Inspector Name)</label>
                  <input
                    type="text"
                    value={inspectorName}
                    onChange={(e) => setInspectorName(e.target.value)}
                    placeholder="ລະບຸຊື່ຜູ້ກວດກາ"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສະຖານະຂອງຜູ້ກວດ (Inspector Type)</label>
                  <select
                    value={inspectorStatus}
                    onChange={(e) => setInspectorStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-medium"
                  >
                    <option value="ພະນັກງານ ທພລ">ພະນັກງານ ທພລ (LDB Staff)</option>
                    <option value="ພາຍນອກ">ພາຍນອກ (External)</option>
                  </select>
                </div>
              </div>

              {/* Asset Specific and Problems */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <div className="bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                      🔍 ປະເພດຈຸດເປເພ (Defect Type):
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHasAsset('yes');
                        }}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                          hasAsset !== 'no'
                            ? 'bg-indigo-600 border-indigo-650 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📦 ມີຊັບສິນ (Has Asset Ref)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHasAsset('no');
                          setAssetCode('');
                        }}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                          hasAsset === 'no'
                            ? 'bg-amber-600 border-amber-650 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📝 ບໍ່ມີຊັບສິນ / ແຈ້ງເປັນ Case
                      </button>
                    </div>
                  </div>
                </div>

                {hasAsset !== 'no' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-700">ລະຫັດຊັບສິນ (Asset Code) *</label>
                      {assetCode.trim() && (
                        (() => {
                          const m = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (assetCode || '').toLowerCase().trim());
                          return m ? (
                            <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-0.5">
                              🟢 ພົບຊັບສິນເດີ່ມ ({m.ລາຍການ})
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                              ⚙️ ລະຫັດຊັບສິນໃໝ່
                            </span>
                          );
                        })()
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={assetCode}
                        onChange={(e) => handleAssetCodeChange(e.target.value)}
                        placeholder="ຕົວຢ່າງ: LDB-PC-1200, 745829"
                        className="font-mono w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setScannerConfig({
                          isOpen: true,
                          onScan: (scannedCode) => handleAssetCodeChange(scannedCode)
                        })}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 px-3.5 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 shadow-sm"
                        title="ສະແກນ Barcode"
                      >
                        <Scan className="h-4.5 w-4.5 shrink-0" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="block font-bold text-slate-400 mb-1">ລະຫັດຊັບສິນ (Asset Code)</span>
                    <input
                      type="text"
                      value="ບໍ່ມີຊັບສິນ (ແຈ້ງເປັນ Case ທົ່ວໄປ)"
                      disabled
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-105 text-slate-400 font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ພາກສ່ວນຊັບສົມບັດ *</label>
                  <select
                    value={hasAsset === 'no' ? 'none' : assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    disabled={hasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white disabled:bg-slate-100 disabled:text-slate-400 font-semibold"
                  >
                    {hasAsset === 'no' ? (
                      <option value="none">none</option>
                    ) : (
                      ASSET_CATEGORIES.map((cat, idx) => (
                        <option key={idx} value={cat.ພາກສ່ວນ}>{cat.ພາກສ່ວນ}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${hasAsset === 'no' ? 'text-slate-400' : 'text-slate-705'}`}>ໝວດລາຍການ (Item Type) *</label>
                  {hasAsset !== 'no' && isAddingAssetGroup ? (
                    <input
                      id="new-incident-item-type-input"
                      type="text"
                      value={newAssetGroup}
                      onChange={(e) => setNewAssetGroup(e.target.value)}
                      onBlur={(e) => {
                        if (e.currentTarget.dataset.cancelled !== 'true') {
                          acceptNewDirectIncidentItemType(e.currentTarget.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          acceptNewDirectIncidentItemType(e.currentTarget.value);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.currentTarget.dataset.cancelled = 'true';
                          setAssetGroup(previousAssetGroup);
                          setNewAssetGroup('');
                          setIsAddingAssetGroup(false);
                        }
                      }}
                      placeholder="ຕົວຢ່າງ: NOTEBOOK, CCTV, ແອ, ປໍ້ານໍ້າ"
                      autoFocus
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  ) : (
                    <select
                      id="incident-item-type-select"
                      value={hasAsset === 'no' ? 'none' : assetGroup}
                      onChange={(e) => selectDirectIncidentItemType(e.target.value)}
                      disabled={hasAsset === 'no'}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {hasAsset === 'no' ? (
                        <option value="none">none</option>
                      ) : (
                        <>
                          <option value="">-- ເລືອກໝວດລາຍການ --</option>
                          {incidentItemTypeOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                          {!isReservedIncidentAssetMasterValue(assetGroup)
                            && !incidentItemTypeOptions.includes(assetGroup) && (
                            <option value={assetGroup}>{assetGroup}</option>
                          )}
                          <option value={INCIDENT_ASSET_ADD_NEW_SENTINEL}>+ ເພີ່ມໝວດລາຍການໃໝ່</option>
                        </>
                      )}
                    </select>
                  )}
                </div>

                <div>
                  <label className={`block font-bold mb-1 ${hasAsset === 'no' ? 'text-slate-400' : 'text-slate-705'}`}>ຊື່ລາຍການຊັບສິນ *</label>
                  {hasAsset !== 'no' && isAddingAssetName ? (
                    <input
                      id="new-incident-asset-name-input"
                      type="text"
                      value={newAssetName}
                      onChange={(e) => setNewAssetName(e.target.value)}
                      onBlur={(e) => {
                        if (e.currentTarget.dataset.cancelled !== 'true') {
                          acceptNewDirectIncidentAssetName(e.currentTarget.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          acceptNewDirectIncidentAssetName(e.currentTarget.value);
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          e.currentTarget.dataset.cancelled = 'true';
                          setAssetName(previousAssetName);
                          setNewAssetName('');
                          setIsAddingAssetName(false);
                        }
                      }}
                      placeholder="ຕົວຢ່າງ: DELL Inspiron, CCTV Dome Sony"
                      autoFocus
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  ) : (
                    <select
                      id="incident-asset-name-select"
                      value={hasAsset === 'no' ? 'none' : assetName}
                      onChange={(e) => {
                        if (e.target.value === INCIDENT_ASSET_ADD_NEW_SENTINEL) {
                          setPreviousAssetName(assetName);
                          setNewAssetName('');
                          setIsAddingAssetName(true);
                        } else {
                          setAssetName(e.target.value);
                        }
                      }}
                      disabled={hasAsset === 'no'}
                      className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {hasAsset === 'no' ? (
                        <option value="none">none</option>
                      ) : (
                        <>
                          <option value="">-- ເລືອກລາຍການ --</option>
                          {directIncidentAssetNameOptions.map(option => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                          {!isReservedIncidentAssetMasterValue(assetName)
                            && !directIncidentAssetNameOptions.includes(assetName) && (
                            <option value={assetName}>{assetName}</option>
                          )}
                          <option value={INCIDENT_ASSET_ADD_NEW_SENTINEL}>+ ເພີ່ມລາຍການໃໝ່</option>
                        </>
                      )}
                    </select>
                  )}
                </div>

                <div className="col-span-1 sm:col-span-2 mt-2 pt-2 border-t border-slate-200/60 mb-1">
                  <span className="font-bold text-slate-705 text-[11px] flex items-center gap-1">
                    🏢 ຝ່າຍ/ໜ່ວຍງານ ຫຼື ສາຂາ ທີ່ເປັນຜູ້ນໍາໃຊ້/ດູແດຊັບສິນ (Asset Owner/Custodian)
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສາຂາຂອງຊັບສິນ</label>
                  <select
                    value={hasAsset === 'no' ? 'none' : assetBranch}
                    onChange={(e) => {
                      setAssetBranch(e.target.value);
                      setAssetUnit(e.target.value);
                    }}
                    disabled={hasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {hasAsset === 'no' ? (
                      <option value="none">none</option>
                    ) : (
                      Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map((br, idx) => (
                        <option key={idx} value={br}>{br}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຝ່າຍ/ໜ່ວຍບໍລິການຂອງຊັບສິນ</label>
                  <select
                    value={hasAsset === 'no' ? 'none' : assetUnit}
                    onChange={(e) => setAssetUnit(e.target.value)}
                    disabled={hasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {hasAsset === 'no' ? (
                      <option value="none">none</option>
                    ) : (
                      <>
                        {BRANCHES.filter(b => b.ສາຂາ === assetBranch).map((b, idx) => (
                          <option key={idx} value={b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}>
                            {b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}
                          </option>
                        ))}
                        {BRANCHES.filter(b => b.ສາຂາ === assetBranch).length === 0 && (
                          <option value={assetBranch}>{assetBranch}</option>
                        )}
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຂະແໜງຂອງຊັບສິນ</label>
                  <select
                    value={hasAsset === 'no' ? 'none' : assetSector}
                    onChange={(e) => setAssetSector(e.target.value)}
                    disabled={hasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-[11px] disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {hasAsset === 'no' ? (
                      <option value="none">none</option>
                    ) : (
                      sectorList.map((s, idx) => (
                        <option key={idx} value={s.ຂະແໜງ}>{s.ຂະແໜງ}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-705 mb-1 text-[11px]">ປະເມີນຜົນກະທົບ (Impact Level)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setImpact('ຕ່ຳ')}
                      className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                        impact === 'ຕ່ຳ'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg mb-0.5">🔵</span>
                      <span className="font-bold text-[10.5px]">ຕ່ຳ (Low)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setImpact('ປານກາງ')}
                      className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                        impact === 'ປານກາງ'
                          ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-500/20 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg mb-0.5">🟡</span>
                      <span className="font-bold text-[10.5px]">ປານກາງ (Medium)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setImpact('ສູງ')}
                      className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all duration-200 relative overflow-hidden cursor-pointer ${
                        impact === 'ສູງ'
                          ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/20 shadow-sm scale-[1.01]'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {impact === 'ສູງ' && (
                        <span className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
                      )}
                      <span className={`text-lg mb-0.5 ${impact === 'ສູງ' ? 'animate-bounce' : ''}`}>🔴</span>
                      <span className="font-bold text-[10.5px] flex items-center justify-center">
                        ສູງ (High)
                        {impact === 'ສູງ' && (
                          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">ລາຍລະອຽດບັນຫາທີ່ພົບເຫັນ *</label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="ກະລຸນາປ້ອນລາຍລະອຽດຄວາມເສຍຫາຍຂອງອຸປະກອນ ຫຼື ຈຸດທີ່ບໍ່ປອດໄພ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 text-slate-900 animate-fadeIn"
                  ></textarea>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">ຂໍ້ສະເໜີແນະວິທີແກ້ໄຂ / ປັບປຸງເບື້ອງຕົ້ນ</label>
                  <input
                    type="text"
                    value={proposedSolution}
                    onChange={(e) => setProposedSolution(e.target.value)}
                    placeholder="ຕົວຢ່າງ: ປ່ຽນເຄື່ອງໃຫມ່, ຈ້າງຊ່າງມາສ້ອມແປງ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsNewOpen(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 font-bold text-slate-500"
                >
                  ຍົກເລີກ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl font-bold shadow transition"
                >
                  ແຈ້ງເຫດການ (Submit Incident)
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Dialog 2: Manager Repair Approval Form */}
      {isApproveOpen && selectedIncident && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full flex flex-col">
            <div className="bg-emerald-800 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hammer className="h-5 w-5 text-amber-400" />
                <h4 className="font-bold text-sm">
                  ອະນຸມັດການສ້ອມແປງ: {selectedIncident.ລະຫັດກວດກາ}
                </h4>
              </div>
              <button 
                onClick={() => {
                  setIsApproveOpen(false);
                  setSelectedIncident(null);
                }}
                className="text-white/85 hover:text-white hover:bg-white/10 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveApproval} className="p-6 space-y-4 text-xs text-slate-700">
              
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800 text-xs">
                  ຊັບສິນ: {selectedIncident.ລາຍການ} ({selectedIncident.ລະຫັດຊັບສິນ})
                </p>
                <p className="text-slate-500 text-[11px]">
                  <strong>ບັນຫາທີ່ແຈ້ງ:</strong> {selectedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ}
                </p>
                <p className="text-[11px] text-indigo-700">
                  <strong>ສາຂາ:</strong> {selectedIncident["ສາຂາ "]}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">ຮູບແບບການດຳເນີນງານ (Execution)</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setOperation('ຈ້າງພາຍນອກ')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center ${
                      operation === 'ຈ້າງພາຍນອກ' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/10' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    ຈ້າງພາຍນອກ (Vendor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperation('ສ້ອມແປງເອງ')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center ${
                      operation === 'ສ້ອມແປງເອງ' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/10' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    ສ້ອມແປງເອງ (Internal)
                  </button>
                </div>
              </div>

              {operation === "ຈ້າງພາຍນອກ" && (
                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຊື່ອຸປະສະໜອງ / ຜູ້ຮັບຈ້າງ (Vendor Supplier) *</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="ຕົວຢ່າງ: ບໍລິສັດ ຊີເນັດ, ຮ້ານໄອທີ ວຽງຈັນ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-600 mb-1">ຜູ້ອະນຸມັດ (Approval Signature)</label>
                <input
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder="ຊື່ ຫຼື ຕຳແໜ່ງຜູ້ອະນຸມັດ"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">ວັນທີ່ອະນຸມັດສ້ອມແປງ (Approval Date) *</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium text-slate-800"
                  value={approvalDate}
                  onChange={(e) => setApprovalDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">ໄຟລ໌ເອກະສານອ້າງອີງອະນຸມັດ (Approval Ref Document) *</label>
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      const file = e.dataTransfer.files[0];
                      const reader = new FileReader();
                      reader.onload = () => {
                        setApprovalDoc(`${file.name}|${reader.result}`);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-4 text-center transition duration-200 ${
                    isDragging 
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-800' 
                      : approvalDoc 
                        ? 'border-teal-500 bg-teal-50/20 text-teal-900' 
                        : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 text-slate-500'
                  }`}
                >
                  {approvalDoc ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center space-x-2 text-emerald-700 font-bold">
                        <span className="text-xl">📄</span>
                        <span className="truncate max-w-[250px]">{approvalDoc.split('|')[0]}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setApprovalDoc('')}
                        className="text-xs text-red-600 hover:text-red-800 font-bold underline cursor-pointer"
                      >
                        ລຶບອອກ (Remove File)
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block space-y-1">
                      <span className="text-2xl block">📤</span>
                      <span className="text-[11px] block font-semibold text-slate-600">
                        ລາກ ແລະ ວາງໄຟລ໌ອະນຸມັດ ຫຼື <span className="text-emerald-700 underline text-xs">ກົດເພື່ອເລືອກໄຟລ໌</span>
                      </span>
                      <span className="text-[10px] text-slate-400 block">ຮອງຮັບໄຟລ໌ PDF, ຮູບພາບ (ສູງສຸດ 10MB)</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            const reader = new FileReader();
                            reader.onload = () => {
                              setApprovalDoc(`${file.name}|${reader.result}`);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="border-t pt-3.5 space-y-2">
                <label className="block font-bold text-slate-600 mb-1">
                  ເຫດຜົນການຍົກເລີກ / ບໍ່ອະນຸມັດ (Cancellation Reason) * 
                  <span className="text-red-500 ml-1 font-semibold text-[10px]">(ບັງຄັບລະບຸ ຖ້າເລືອກກົດ Cancel)</span>
                </label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="ລະບຸເຫດຜົນການຍົກເລີກ ຫຼື ບໍ່ອະນຸມັດສ້ອມແປງ..."
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 text-xs focus:ring-2 focus:ring-red-500"
                  rows={2}
                />
              </div>

              <div className="bg-amber-50 p-3 rounded-lg text-[10px] text-amber-800 flex items-start border border-amber-100">
                <Info className="h-4 w-4 mr-1 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <strong>ຂັ້ນຕອນຖັດໄປ:</strong> ການອະນຸມັດນີ້ຈະສົ່ງຜົນໃຫ້ສະຖານະຂອງເຫດການປ່ຽນເປັນ <strong>"ລໍຖ້າສ້ອມແປງ"</strong>, ຫຼື ຫາກເລືອກກົດ Cancel ຈະປ່ຽນສະຖານະເປັນ <strong>"Cancelled"</strong> ແລະ ເກັບປະຫວັດໃນ Repair Log.
                </div>
              </div>

              {/* Submit approval form */}
              <div className="flex items-center justify-between pt-4 border-t gap-2">
                <button
                  type="button"
                  onClick={handleCancelAction}
                  className="px-3.5 py-2 bg-rose-600 text-white rounded-xl hover:bg-rose-700 font-bold shadow transition flex items-center text-xs cursor-pointer"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel (ບໍ່ອະນຸມັດສ້ອມ)
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsApproveOpen(false);
                      setSelectedIncident(null);
                      setCancelReason('');
                    }}
                    className="px-3.5 py-2 border rounded-xl hover:bg-slate-50 font-semibold text-slate-500 text-xs"
                  >
                    ປິດ
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-emerald-850 text-white rounded-xl hover:bg-emerald-900 font-bold shadow transition flex items-center text-xs"
                  >
                    <Check className="h-3.5 w-3.5 mr-1 text-amber-400" />
                    ອະນຸມັດສ້ອມແປງ
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Dialog 3: View Incident Details Modal */}
      {viewingIncident && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full flex flex-col max-h-[90vh]">
            <div className="bg-indigo-900 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="h-5 w-5 text-amber-400" />
                <h4 className="font-bold text-sm sm:text-base">
                  ລາຍລະອຽດເຫດການ & ຄວາມສ່ຽງ
                </h4>
              </div>
              <button 
                onClick={() => setViewingIncident(null)}
                className="text-white/85 hover:text-white hover:bg-white/10 rounded-full p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs text-slate-700">
              
              {/* Header/Code section */}
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                <div>
                  <p className="text-[10px] text-indigo-850 uppercase font-bold tracking-wider">ລະຫັດກວດກາ</p>
                  <p className="text-sm font-bold text-indigo-950 font-mono">{getIncidentCaseDisplayCode(viewingIncident, incidents)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">ສະຖານະປະຈຸບັນ</p>
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    viewingIncident.ສະຖານະ === "ລໍຖ້າການອະນຸມັດ"
                      ? "bg-red-50 text-red-700 border border-red-250 animate-pulse"
                      : viewingIncident.ສະຖານະ === "ສຳເລັດ" || viewingIncident.ສະຖານະ === "ສໍາເລັດ"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-blue-100 text-blue-800 border border-blue-200"
                  }`}>
                    {viewingIncident.ສະຖານະ || "ລໍຖ້າການອະນຸມັດ"}
                  </span>
                </div>
              </div>

              {/* Asset details category and code */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">ຊື່ລາຍການຊັບສິນ</span>
                  <span className="font-bold text-slate-800 text-xs sm:text-[13px]">{viewingIncident.ລາຍການ || "ບໍ່ຮູ້ຊື່ຊັບສິນ"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">ລະຫັດຊັບສິນ</span>
                  <span className="font-mono font-bold text-slate-700 text-xs">{viewingIncident.ລະຫັດຊັບສິນ || "ບໍ່ລະບຸ"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">ພາກສ່ວນຊັບສົມບັດ</span>
                  <span className="text-slate-700 font-medium">{viewingIncident.ພາກສ່ວນຊັບສົມບັດ || "ບໍ່ລະບຸ"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">ໝວດລາຍການ (Type)</span>
                  <span className="text-slate-700 font-bold uppercase">{viewingIncident.ໝວດລາຍການ || "ບໍ່ລະບຸ"}</span>
                </div>
              </div>

              {/* Inspection System Categories */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                <span className="block text-[10px] font-bold text-indigo-900 uppercase tracking-wider pb-1 border-b border-indigo-100">
                  📋 ຂໍ້ມູນການກວດກາ (Inspection Information)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ຮູບແບບການກວດ</span>
                    <span className="text-slate-800 font-bold text-xs">{getResolvedInspectionType(viewingIncident)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ລະບົບທີ່ກວດ (System Category)</span>
                    <span className="text-slate-800 font-bold text-xs">{getResolvedSystemCategory(viewingIncident)}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ພື້ນທີ່/ຈຸດກວດ ( Area / Point)</span>
                    <span className="text-slate-800 font-bold text-xs">{getResolvedSubsystemCategory(viewingIncident)}</span>
                  </div>
                </div>
              </div>

              {/* Location hierarchy details */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                  📍 ສະຖານທີ່ພົບເຫດການ (Incident Location)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ສາຂາ</span>
                    <span className="text-slate-800 font-bold text-[11px] block truncate">{getCaseReference(viewingIncident).branch || "ບໍ່ລະບຸ"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ຝ່າຍ / ໜ່ວຍບໍລິການ</span>
                    <span className="text-slate-750 font-bold text-[11px] block truncate">{getCaseReference(viewingIncident).division || "ບໍ່ລະບຸ"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ຂະແໜງ</span>
                    <span className="text-slate-700 font-medium text-[11px] block truncate">{getCaseReference(viewingIncident).sector || "-"}</span>
                  </div>
                </div>
                {viewingIncident.ສະຖານທີພົບເຫດການ && (
                  <div className="pt-1.5 border-t border-slate-150">
                    <span className="block text-[10px] text-slate-400 font-bold">ສະຖານທີ່ພົບເຫດການລະອຽດ</span>
                    <span className="text-slate-800 font-bold text-[11px]">{viewingIncident.ສະຖານທີພົບເຫດການ}</span>
                  </div>
                )}
                {getCaseReference(viewingIncident).roomLocation && (
                  <div className="pt-1.5 border-t border-slate-150">
                    <span className="block text-[10px] text-slate-400 font-bold">{LOCATION_FLOOR_LABEL}</span>
                    <span className="text-slate-800 font-bold text-[11px]">🚪 {getCaseReference(viewingIncident).roomLocation}</span>
                  </div>
                )}
              </div>

              {/* Asset Responsibility / Owner Details */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 space-y-3">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/60 pb-1">
                  🏢 ຝ່າຍ/ໜ່ວຍງານ ຫຼື ສາຂາ ຊັບສິນ (Asset Owner/Custodian)
                </span>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ສາຂາຊັບສິນ</span>
                    <span className="text-slate-800 font-bold text-[11px] block truncate">{(viewingIncident as any).ສາຂາຊັບສິນ || viewingIncident["ສາຂາ "] || "ບໍ່ລະບຸ"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ຝ່າຍ/ໜ່ວຍງານຊັບສິນ</span>
                    <span className="text-slate-755 font-bold text-[11px] block truncate">{(viewingIncident as any).ຝ່າຍຊັບສິນ || viewingIncident["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "ບໍ່ລະບຸ"}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-400 font-bold">ຂະແໜງຊັບສິນ</span>
                    <span className="text-slate-700 font-semibold text-[11px] block truncate">{(viewingIncident as any).ຂະແໜງຊັບສິນ || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Problem detail, solutions */}
              <div className="space-y-3">
                <div className="p-3.5 bg-red-50/40 border border-red-100 rounded-xl">
                  <span className="block text-[10px] text-red-700 font-bold uppercase tracking-wider mb-1">🔴 ບັນຫາທີ່ພົບເຫັນ</span>
                  <p className="text-slate-800 text-xs font-semibold leading-relaxed">{viewingIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ}</p>
                </div>

                <div className="p-3.5 bg-emerald-50/40 border border-emerald-100 rounded-xl">
                  <span className="block text-[10px] text-emerald-800 font-bold uppercase tracking-wider mb-1">🟢 ວິທີແກ້ໄຂ / ສະເໜີປັບປຸງ</span>
                  <p className="text-slate-800 text-xs font-semibold leading-relaxed">{viewingIncident.ວີທີແກ້ໄຂ || "ລໍຖ້າການວິເຄາະ"}</p>
                </div>
              </div>

              {/* Impact assessment and Inspector info */}
              <div className="grid grid-cols-2 gap-4 pt-1">
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="block text-[10px] text-slate-400 font-semibold">ລະດັບຜົນກະທົບ</span>
                  <span className="font-bold text-slate-800 mt-1 block">
                    {viewingIncident.ປະເມີນຜົນກະທົບ === "ສູງ" ? "🔴 ສູງ (High Impact)" :
                     viewingIncident.ປະເມີນຜົນກະທົບ === "ປານກາງ" ? "🟡 ປານກາງ (Medium)" : 
                     "🔵 ຕ່ຳ (Low Impact)"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <span className="block text-[10px] text-slate-400 font-semibold">ຜູ້ກວດກາ & ວັນເວລາ</span>
                  <span className="font-bold text-slate-705 mt-1 block">
                    {viewingIncident.ຊື່ຜູ້ກວດ || viewingIncident.ຜູ້ກວດກາ || "ລະບົບ"}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    {formatExcelDate(viewingIncident.ວັນທີ່ກວດ)} {viewingIncident.ເວລາກວດ}
                  </span>
                </div>
              </div>

            </div>

            <div className="p-4 bg-slate-50 rounded-b-2xl flex items-center justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={() => setViewingIncident(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-950 text-white rounded-xl font-bold transition cursor-pointer"
              >
                ປິດໜ້າຕ່າງນີ້ (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog 4: Edit Incident Modal (Pending Approval) */}
      {isEditOpen && editingIncident && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-xl w-full flex flex-col max-h-[90vh]">
            <div className="bg-indigo-950 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Pencil className="h-5 w-5 text-amber-400" />
                <h4 className="font-bold text-sm sm:text-base">
                  ແກ້ໄຂຂໍ້ມູນເຫດການເສຍຫາຍ (Edit Incident Report)
                </h4>
              </div>
              <button 
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingIncident(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateIncidentSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              
              {/* Branch and Division info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="col-span-1 sm:col-span-2 pb-1 border-b border-slate-200/60 mb-1">
                  <span className="font-bold text-indigo-900 text-[13px] flex items-center gap-1.5">
                    📍 ສະຖານທີ່ພົບເຫດການ (Incident Occurrence Location)
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສາຂາ</label>
                  <select
                    value={editTargetBranch}
                    onChange={(e) => {
                      setEditTargetBranch(e.target.value);
                      setEditTargetUnit(e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                  >
                    {currentUser.status === "Admin" ? (
                      Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map((br, idx) => (
                        <option key={idx} value={br}>{br}</option>
                      ))
                    ) : (
                      <option value={currentUser.branch}>{currentUser.branch}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຝ່າຍ/ໜ່ວຍບໍລິການ</label>
                  <select
                    value={editTargetUnit}
                    onChange={(e) => setEditTargetUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                  >
                    {BRANCHES.filter(b => b.ສາຂາ === editTargetBranch).map((b, idx) => (
                      <option key={idx} value={b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}>
                        {b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}
                      </option>
                    ))}
                    {BRANCHES.filter(b => b.ສາຂາ === editTargetBranch).length === 0 && (
                      <option value={editTargetBranch}>{editTargetBranch}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຂະແໜງ</label>
                  <select
                    value={editTargetSector}
                    onChange={(e) => setEditTargetSector(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  >
                    {sectorList.map((s, idx) => (
                      <option key={idx} value={s.ຂະແໜງ}>{s.ຂະແໜງ}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    {LOCATION_FLOOR_LABEL} *
                  </label>
                  <select
                    value={LOCATION_FLOOR_OPTIONS.includes(editRoomOrLocation as typeof LOCATION_FLOOR_OPTIONS[number]) ? editRoomOrLocation : ""}
                    onChange={(e) => setEditRoomOrLocation(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs shadow-sm"
                    required
                  >
                    <option value="">-- ເລືອກຊັ້ນອາຄານ --</option>
                    {LOCATION_FLOOR_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-655 mb-1 font-sans">
                    ຮູບແບບການກວດ (Inspection Type) * {
                      editingIncident?.ລະຫັດກວດກາ && !String(editingIncident.ລະຫັດກວດກາ).toUpperCase().startsWith("INC-") ? (
                        <span className="text-emerald-700 font-extrabold text-[10px] ml-1 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 uppercase tracking-wider animate-fadeIn">
                          (ຂໍ້ມູນຈາກ Building Inspection)
                        </span>
                      ) : (
                        <span className="text-indigo-700 font-extrabold text-[10px] ml-1 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase tracking-wider animate-fadeIn">
                          (ຂໍ້ມູນຈາກ Incident Register)
                        </span>
                      )
                    }
                  </label>
                  <select
                    value={editInspectionType}
                    onChange={(e) => setEditInspectionType(e.target.value)}
                    className={`w-full border rounded-lg p-2.5 font-bold transition-all duration-200 cursor-not-allowed text-[11px] shadow-sm ${
                      editingIncident?.ລະຫັດກວດກາ && !String(editingIncident.ລະຫັດກວດກາ).toUpperCase().startsWith("INC-")
                        ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                        : "bg-indigo-50/70 border-indigo-150 text-indigo-900"
                    }`}
                    required
                    disabled
                  >
                    {editingIncident?.ລະຫັດກວດກາ && !String(editingIncident.ລະຫັດກວດກາ).toUpperCase().startsWith("INC-") ? (
                      <>
                        <option value="ກວດປະຈໍາວັນ">ກວດປະຈໍາວັນ</option>
                        <option value="ກວດປະຈໍາອາທິດ">ກວດປະຈໍາອາທິດ</option>
                        <option value="ສຸມກວດ">ສຸມກວດ</option>
                        <option value="ການແຈ້ງເຫດດ່ວນ">ການແຈ້ງເຫດດ່ວນ</option>
                      </>
                    ) : (
                      <>
                        <option value="ການແຈ້ງເຫດດ່ວນ">ການແຈ້ງເຫດດ່ວນ</option>
                        <option value="ວຽກຈາກການແຈ້ງເຫດ">ວຽກຈາກການແຈ້ງເຫດ</option>
                        <option value="ກວດປະຈໍາວັນ">ກວດປະຈໍາວັນ</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ລະບົບທີ່ກວດ (System Category) *</label>
                  <select
                    value={editSystemCategory}
                    onChange={(e) => {
                      const newSysVal = e.target.value;
                      setEditSystemCategory(newSysVal);
                      const subcats = getEditSubsystemOptions(newSysVal);
                      if (subcats.length > 0) {
                        setEditSubsystemCategory(subcats[0]);
                      }
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold"
                    required
                  >
                    {editSystemOptions.map((sys, idx) => (
                      <option key={idx} value={sys}>{sys}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-1 sm:col-span-2">
                  <label className="block font-bold text-slate-600 mb-1">ພື້ນທີ່/ຈຸດກວດ ( Area / Point) *</label>
                  <select
                    value={editSubsystemCategory}
                    onChange={(e) => setEditSubsystemCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold"
                    required
                  >
                    {getEditSubsystemOptions(editSystemCategory).map((sub, idx) => (
                      <option key={idx} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asset Specific and Problems */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">ລະຫັດຊັບສິນ (Asset Code) *</label>
                    {editAssetCode.trim() && (
                      (() => {
                        const m = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (editAssetCode || '').toLowerCase().trim());
                        return m ? (
                          <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-100 flex items-center gap-0.5">
                            🟢 ພົບຊັບສິນເດີ່ມ ({m.ລາຍການ})
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-100">
                            ⚙️ ລະຫັດຊັບສິນໃໝ່
                          </span>
                        );
                      })()
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editAssetCode}
                      onChange={(e) => handleEditAssetCodeChange(e.target.value)}
                      placeholder="ຕົວຢ່າງ: LDB-PC-1200, 745829"
                      className="font-mono w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setScannerConfig({
                        isOpen: true,
                        onScan: (scannedCode) => handleEditAssetCodeChange(scannedCode)
                      })}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 px-3.5 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 shadow-sm"
                      title="ສະແກນ Barcode"
                    >
                      <Scan className="h-4.5 w-4.5 shrink-0" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ພາກສ່ວນຊັບສົມບັດ *</label>
                  <select
                    value={editAssetCategory}
                    onChange={(e) => setEditAssetCategory(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  >
                    {ASSET_CATEGORIES.map((cat, idx) => (
                      <option key={idx} value={cat.ພາກສ່ວນ}>{cat.ພາກສ່ວນ}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-705 mb-1">ໝວດລາຍການ (Item Type) *</label>
                  <input
                    type="text"
                    value={editAssetGroup}
                    onChange={(e) => setEditAssetGroup(e.target.value)}
                    placeholder="ຕົວຢ່າງ: NOTEBOOK, CCTV, ແອ, ປໍ້ານໍ້າ"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-705 mb-1">ຊື່ລາຍການຊັບສິນ *</label>
                  <input
                    type="text"
                    value={editAssetName}
                    onChange={(e) => setEditAssetName(e.target.value)}
                    placeholder="ຕົວຢ່າງ: DELL Inspiron, CCTV Dome Sony"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-900"
                  />
                </div>

                <div className="col-span-1 sm:col-span-2 mt-2 pt-2 border-t border-slate-200/60 mb-1">
                  <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                    🏢 ຝ່າຍ/ໜ່ວຍງານ ຫຼື ສາຂາ ທີ່ເປັນຜູ້ນໍາໃຊ້/ດູແດຊັບສິນ (Asset Owner/Custodian)
                  </span>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສາຂາຂອງຊັບສິນ</label>
                  <select
                    value={editAssetBranch}
                    onChange={(e) => {
                      setEditAssetBranch(e.target.value);
                      setEditAssetUnit(e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 text-[11px]"
                  >
                    {Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map((br, idx) => (
                      <option key={idx} value={br}>{br}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຝ່າຍ/ໜ່ວຍບໍລິການຂອງຊັບສິນ</label>
                  <select
                    value={editAssetUnit}
                    onChange={(e) => setEditAssetUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 text-[11px]"
                  >
                    {BRANCHES.filter(b => b.ສາຂາ === editAssetBranch).map((b, idx) => (
                      <option key={idx} value={b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}>
                        {b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ}
                      </option>
                    ))}
                    {BRANCHES.filter(b => b.ສາຂາ === editAssetBranch).length === 0 && (
                      <option value={editAssetBranch}>{editAssetBranch}</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຂະແໜງຂອງຊັບສິນ</label>
                  <select
                    value={editAssetSector}
                    onChange={(e) => setEditAssetSector(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-[11px]"
                  >
                    {sectorList.map((s, idx) => (
                      <option key={idx} value={s.ຂະແໜງ}>{s.ຂະແໜງ}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-705 mb-1 text-[11px]">ປະເມີນຜົນກະທົບ (Impact Level)</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setEditImpact('ຕ່ຳ')}
                      className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                        editImpact === 'ຕ່ຳ'
                          ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg mb-0.5">🔵</span>
                      <span className="font-bold text-[10.5px]">ຕ່ຳ (Low)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setEditImpact('ປານກາງ')}
                      className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all duration-200 cursor-pointer ${
                        editImpact === 'ປານກາງ'
                          ? 'bg-amber-50 border-amber-500 text-amber-700 ring-2 ring-amber-500/20 shadow-sm'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-lg mb-0.5">🟡</span>
                      <span className="font-bold text-[10.5px]">ປານກາງ (Medium)</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setEditImpact('ສູງ')}
                      className={`flex flex-col items-center justify-center py-2.5 px-1.5 rounded-xl border text-center transition-all duration-200 relative overflow-hidden cursor-pointer ${
                        editImpact === 'ສູງ'
                          ? 'bg-red-50 border-red-500 text-red-700 ring-2 ring-red-500/20 shadow-sm scale-[1.01]'
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {editImpact === 'ສູງ' && (
                        <span className="absolute inset-0 bg-red-500/5 animate-pulse pointer-events-none" />
                      )}
                      <span className={`text-lg mb-0.5 ${editImpact === 'ສູງ' ? 'animate-bounce' : ''}`}>🔴</span>
                      <span className="font-bold text-[10.5px] flex items-center justify-center">
                        ສູງ (High)
                        {editImpact === 'ສູງ' && (
                          <span className="ml-1 w-1.5 h-1.5 rounded-full bg-red-600 animate-ping inline-block" />
                        )}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">ລາຍລະອຽດບັນຫາທີ່ພົບເຫັນ *</label>
                  <textarea
                    value={editProblem}
                    onChange={(e) => setEditProblem(e.target.value)}
                    placeholder="ກະລຸນາປ້ອນລາຍລະອຽດຄວາມເສຍຫາຍຂອງອຸປະກອນ ຫຼື ຈຸດທີ່ບໍ່ປອດໄພ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-24 text-slate-900"
                  ></textarea>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">ຂໍ້ສະເໜີແນະວິທີແກ້ໄຂ / ປັບປຸງເບື້ອງຕົ້ນ</label>
                  <input
                    type="text"
                    value={editProposedSolution}
                    onChange={(e) => setEditProposedSolution(e.target.value)}
                    placeholder="ຕົວຢ່າງ: ປ່ຽນເຄື່ອງໃຫມ່, ຈ້າງຊ່າງມາສ້ອມແປງ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"
                  />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingIncident(null);
                  }}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 font-bold text-slate-500 cursor-pointer"
                >
                  ຍົກເລີກ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-900 hover:bg-indigo-950 text-white rounded-xl font-bold shadow transition cursor-pointer"
                >
                  ບັນທຶກການແກ້ໄຂ (Save Changes)
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Simulated Barcode Scanner Modal */}
      {scannerConfig.isOpen && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
            {/* Style sheet for scanning laser line */}
            <style>{`
              @keyframes scanLaserLoop {
                0% { top: 5%; }
                50% { top: 95%; }
                100% { top: 5%; }
              }
              .animate-scan-laser-line {
                animation: scanLaserLoop 2s infinite ease-in-out;
              }
            `}</style>
            
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <QrCode className="h-5 w-5 text-emerald-400 animate-pulse" />
                <h4 className="font-bold text-sm sm:text-base">
                  ເຄື່ອງສະແກນບາໂຄດຊັບສິນ (Asset Barcode Scanner Tool)
                </h4>
              </div>
              <button 
                onClick={() => setScannerConfig({ isOpen: false, onScan: () => {} })}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 cursor-pointer transition text-xs font-bold"
              >
                ປິດ (X)
              </button>
            </div>

            <div className="p-5 flex-1 overflow-y-auto space-y-4">
              {/* Scan simulation screen */}
              <div className="bg-slate-950 aspect-[16/9] rounded-xl relative overflow-hidden flex flex-col justify-center items-center text-white border-2 border-slate-800 shadow-inner">
                {/* Visual Camera simulation framing */}
                <span className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-emerald-500 rounded-tl" />
                <span className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-emerald-500 rounded-tr" />
                <span className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-emerald-500 rounded-bl" />
                <span className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-emerald-500 rounded-br" />
                
                {/* Pulsing red lasers */}
                <div className="absolute left-4 right-4 h-0.5 bg-red-500 shadow-[0_0_12px_#ef4444,0_0_20px_#ef4444] animate-scan-laser-line rounded opacity-90" />
                
                <div className="flex flex-col items-center justify-center space-y-2 select-none relative z-10 text-center px-4">
                  <div className="bg-emerald-500/10 text-emerald-400 p-2.5 rounded-full border border-emerald-500/25 animate-pulse">
                    <Scan className="h-7 w-7" />
                  </div>
                  <p className="font-bold text-[13px] text-emerald-400 tracking-wide">
                    🎥 ກຳລັງຈຳລອງການສະແກນ (Webcam Simulator Active)
                  </p>
                  <p className="text-[10px] text-slate-400 max-w-[280px]">
                    ສາມາດໃຊ້ປືນຍິງ Barcode ຍິງເຂົ້າໃສ່ຊ່ອງດ້ານລຸ່ມ ຫຼື ເລືອກຊັບສິນເກົ່າດ້ານລຸ່ມເພື່ອທົດສອບສະແກນໄດ້ເລີຍ
                  </p>
                </div>
                
                {/* Grid Overlay decoration */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-slate-950/20 to-slate-950/70 pointer-events-none" />
              </div>

              {/* Direct Input scan emulation */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <label className="block text-[11px] font-bold text-slate-705">
                  ⌨️ ປ້ອນລະຫັດເພື່ອສະແກນ / ຍິງດ້ວຍປືນສະແກນ (Enter code or fire scanner gun):
                </label>
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formVal = new FormData(e.currentTarget);
                    const codeVal = String(formVal.get('barcodeVal') || '').trim();
                    if (!codeVal) return;
                    playBeep();
                    scannerConfig.onScan(codeVal);
                    setScannerConfig({ isOpen: false, onScan: () => {} });
                  }}
                  className="flex gap-2"
                >
                  <input
                    name="barcodeVal"
                    type="text"
                    required
                    autoFocus
                    placeholder="ພິມລະຫັດບາໂຄດ..."
                    className="font-mono flex-1 border border-slate-300 bg-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <button 
                    type="submit" 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-lg text-xs shadow cursor-pointer transition shrink-0"
                  >
                    ຍິງ (Scan) 🔊
                  </button>
                </form>
              </div>

              {/* Unique assets list suggestion section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600">
                    📜 ເລືອກຊັບສິນເກົ່າເພື່ອຈຳລອງການຍິງ ({uniqueAssets.length} ລາຍການ):
                  </span>
                  <input
                    type="text"
                    value={scannerSearch}
                    onChange={(e) => setScannerSearch(e.currentTarget.value)}
                    placeholder="ຄົ້ນຫາລະຫັດ/ຊື່..."
                    className="border border-slate-300 rounded-lg p-1 px-2.5 text-[10px] w-36 bg-white"
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-2 max-h-[180px] overflow-y-auto pr-1">
                  {uniqueAssets
                    .filter(item => 
                      item.ລະຫັດຊັບສິນ.toLowerCase().includes(scannerSearch.toLowerCase()) ||
                      item.ລາຍການ.toLowerCase().includes(scannerSearch.toLowerCase()) ||
                      item.ໝວດລາຍການ.toLowerCase().includes(scannerSearch.toLowerCase())
                    )
                    .map((asset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          playBeep();
                          scannerConfig.onScan(asset.ລະຫັດຊັບສິນ);
                          setScannerConfig({ isOpen: false, onScan: () => {} });
                        }}
                        className="bg-white border hover:bg-emerald-50 hover:border-emerald-200 border-slate-200 p-2.5 rounded-xl flex items-center justify-between text-left group cursor-pointer transition text-xs shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-bold text-slate-800 text-[11px] truncate group-hover:text-emerald-800">
                            🏷️ {asset.ລະຫັດຊັບສິນ}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                            ຊື່: <strong className="text-slate-700">{asset.ລາຍການ}</strong>
                          </p>
                          <span className="inline-block mt-1 bg-slate-100 border border-slate-200 text-slate-600 rounded px-1.5 py-0.5 text-[9px]">
                            {asset.ພាកສ່ວນຊັບສົມບັດ} • {asset.ໝວດລາຍການ}
                          </span>
                        </div>
                        <div className="bg-slate-50 border group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 text-slate-700 rounded-lg px-2 py-1.5 font-bold transition text-[10px] select-none shrink-0 flex items-center gap-1">
                          <Scan className="h-3.5 w-3.5" />
                          ຍິງສະແກນ
                        </div>
                      </button>
                    ))
                  }
                  {uniqueAssets.length === 0 && (
                    <p className="text-center py-6 text-slate-400 italic text-[11px]">
                      ບໍ່ມີປະຫວັດຊັບສິນໃນລະບົບເທື່ອ
                    </p>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
