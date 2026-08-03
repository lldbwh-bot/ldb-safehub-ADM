/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, Plus, CheckCircle2, AlertTriangle, Filter, Calendar, 
  Building2, User, Layers, CheckSquare, X, Info, Download, Scan, QrCode, Check, Eye, Trash2, Edit
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { InspectionRecord, UserAccount, ChecklistItem, IncidentRecord, SectorInfo } from '../types';
import { ASSET_CATEGORIES, getSavedBranches, SECTORS, cleanString, formatExcelDate, formatDateInputValue } from '../dataStore';
import { LOCATION_FLOOR_LABEL, LOCATION_FLOOR_OPTIONS } from '../locationFloorOptions';
import {
  INCIDENT_ASSET_ADD_NEW_SENTINEL,
  canonicalizeIncidentMasterValue,
  getIncidentItemTypeOptions,
  getInspectionAssetNameOptions,
  isReservedIncidentAssetMasterValue,
} from '../incidentAssetMasterData';
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

interface InspectionsViewProps {
  inspections: InspectionRecord[];
  onAddInspection: (
    newInsp: Omit<InspectionRecord, "ລ/ດ">, 
    newIncident?: {
      assetCode: string;
      assetCategory: string;
      assetGroup: string;
      assetName: string;
      problem: string;
      impact: string;
      solution: string;
    }
  ) => void;
  currentUser: UserAccount;
  incidents: IncidentRecord[];
  onAddIncident: (newInc: Omit<IncidentRecord, "ລ/ດ"> | Omit<IncidentRecord, "ລ/ດ">[]) => void;
  checklistItems?: ChecklistItem[];
  onDeleteInspections?: (pids: string[]) => void;
  getDeleteImpact?: (pids: string[]) => CascadeDeleteImpact;
  onClearAllData?: (type: "all" | "inspections" | "incidents" | "approvals" | "repairs") => void;
  onUpdateInspection?: (
    pid: string,
    updatedFields: Partial<InspectionRecord>,
    updatedLinkedIncidents?: Omit<IncidentRecord, "ລ/ດ">[]
  ) => void;
  sectors?: SectorInfo[];
  autoEditInspectionCode?: string | null;
  onClearAutoEdit?: () => void;
}

interface RoomComboboxProps {
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  id?: string;
  customOptions?: string[];
  onRemoveOption?: (val: string) => void;
}

function RoomCombobox({ value, onChange, options, placeholder, id, customOptions, onRemoveOption }: RoomComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    return options.filter(opt =>
      opt.toLowerCase().includes(search.toLowerCase())
    );
  }, [options, search]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setSearch(val);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    setIsOpen(true);
  };

  const isExactMatch = options.some(opt => opt.toLowerCase() === search.trim().toLowerCase());

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder || "ລະບຸຫ້ອງ ຫຼື ສະຖານທີ່"}
          className="w-full border border-slate-300 rounded-lg p-2.5 pr-10 bg-white text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
        >
          <svg className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {search.trim() && !isExactMatch && (
            <button
              type="button"
              onClick={() => handleSelect(search.trim())}
              className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 font-semibold border-b border-slate-100 flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-600" />
              <span>ເພີ່ມໃໝ່: "{search.trim()}"</span>
            </button>
          )}

          {filteredOptions.length === 0 ? (
            <div className="px-4 py-3 text-xs text-slate-400 text-center">
              ບໍ່ພົບຂໍ້ມູນ (No options found)
            </div>
          ) : (
            filteredOptions.map((opt, index) => {
              const isSelected = opt === value;
              const isCustom = customOptions?.includes(opt);
              return (
                <div
                  key={index}
                  className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition hover:bg-slate-50 cursor-pointer ${
                    isSelected ? 'bg-emerald-50 text-emerald-800 font-semibold' : 'text-slate-700 font-medium'
                  }`}
                  onClick={() => handleSelect(opt)}
                >
                  <span>{opt}</span>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    {isCustom && onRemoveOption && (
                      <button
                        type="button"
                        onClick={() => onRemoveOption(opt)}
                        className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                        title="ລຶບລາຍການນີ້"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {isSelected && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function InspectionsView({
  inspections,
  onAddInspection,
  currentUser,
  incidents,
  onAddIncident,
  checklistItems = [],
  onDeleteInspections,
  getDeleteImpact,
  onClearAllData,
  onUpdateInspection,
  sectors = [],
  autoEditInspectionCode = null,
  onClearAutoEdit
}: InspectionsViewProps) {
  const finalChecklistItems = checklistItems;
  const BRANCHES = React.useMemo(() => getSavedBranches(), []);
  const sectorList = sectors && sectors.length > 0 ? sectors : SECTORS;

  // Filter/Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [systemFilter, setSystemFilter] = useState('ALL');
  
  // Deletion selection and confirmation States
  const [selectedPids, setSelectedPids] = useState<string[]>([]);
  const [showSingleConfirm, setShowSingleConfirm] = useState(false);
  const [singleToDelete, setSingleToDelete] = useState<string | null>(null);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearOption, setClearOption] = useState<'inspections' | 'all'>('inspections');
  const [branchFilter, setBranchFilter] = useState(currentUser.status === "Admin" ? 'ALL' : currentUser.branch);
  const pendingDeletePids = showSingleConfirm && singleToDelete
    ? [singleToDelete]
    : showBulkConfirm
      ? selectedPids
      : [];
  const deleteImpact = pendingDeletePids.length > 0 && getDeleteImpact
    ? getDeleteImpact(pendingDeletePids)
    : EMPTY_DELETE_IMPACT;

  // New Inspection Dialog State
  const [isOpen, setIsOpen] = useState(false);
  const [inspType, setInspType] = useState('ກວດປະຈໍາວັນ'); // "ສຸມກວດ" | "ກວດປະຈໍາວັນ"
  const [selSystem, setSelSystem] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const selCategory = selectedCategories[0] || '';
  const setSelCategory = (val: string) => {
    setSelectedCategories(val ? [val] : []);
  };
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [status, setStatus] = useState<'...'>(); // temp placeholder avoided
  const [inspectionStatus, setInspectionStatus] = useState<'常规' | '异常' | 'ປົກກະຕີ' | 'ຜິດປົກກະຕີ'>('ປົກກະຕີ');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [roomLocation, setRoomLocation] = useState('');

  const [targetBranch, setTargetBranch] = useState(() => currentUser?.branch || '');
  const [targetUnit, setTargetUnit] = useState(() => currentUser?.branch || '');
  const [targetSector, setTargetSector] = useState('ຂະແແໜງ ບໍລິການ');
  const [inspectorName, setInspectorName] = useState(() => currentUser?.username || '');
  const [inspectionDateInput, setInspectionDateInput] = useState(() => formatDateInputValue());
  const [inspectorStatus, setInspectorStatus] = useState("ພະນັກງານ ທພລ"); // "ພະນັກງານ ທພລ" | "ພາຍນອກ"

  // Edit Inspection Dialog State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState<InspectionRecord | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editSector, setEditSector] = useState('');
  const [editRoom, setEditRoom] = useState('');
  const [editRoomLocation, setEditRoomLocation] = useState('');
  const [editType, setEditType] = useState('');
  const [editSystem, setEditSystem] = useState('');
  const [editInspector, setEditInspector] = useState('');
  const [editInspectorStatus, setEditInspectorStatus] = useState('ພະນັກງານ ທພລ');
  const [editStatus, setEditStatus] = useState<'ປົກກະຕີ' | 'ຜິດປົກກະຕີ'>('ປົກກະຕີ');

  // Dynamic collections for the edit modal
  const [editSelectedCategories, setEditSelectedCategories] = useState<string[]>([]);
  const [editEvaluations, setEditEvaluations] = useState<Record<string, { status: '✓' | 'X' | null; note: string }>>({});
  const [editFormType, setEditFormType] = useState<SafetyFormType>('ສາຂາ');
  const [editManualIncidentForms, setEditManualIncidentForms] = useState<ManualIncidentForm[]>([]);

  // Parse evaluations from comma-separated logs
  const parseEvaluations = (checkedListText: string) => {
    const evs: Record<string, { status: '✓' | 'X' | null; note: string }> = {};
    if (!checkedListText) return evs;
    
    const parts = checkedListText.split(" , ");
    parts.forEach(part => {
      const isX = part.includes("❌") || part.includes("ຜິດປົກກະຕິ") || part.includes("异常");
      const isCheck = part.includes("✅") || part.includes("ປົກກະຕິ") || part.includes("常规");
      
      const lastOpenParen = part.lastIndexOf(" (");
      if (lastOpenParen !== -1) {
        const itemText = part.substring(0, lastOpenParen).trim();
        const parenContent = part.substring(lastOpenParen + 2, part.length - 1);
        
        let note = "";
        const dashIndex = parenContent.indexOf(" - ");
        if (dashIndex !== -1) {
          note = parenContent.substring(dashIndex + 3).trim();
        }
        
        evs[itemText] = {
          status: isX ? 'X' : (isCheck ? '✓' : null),
          note: note
        };
      } else {
        evs[part.trim()] = { status: '✓', note: '' };
      }
    });
    return evs;
  };

  const handleOpenEdit = (log: InspectionRecord) => {
    const fType = detectSafetyFormType(
      log["ສາຂາ "] || '',
      log["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '',
    );
    setEditingInspection(log);
    setEditDate(formatDateInputValue(log.ວັນທີ່ກວດ || new Date()));
    setEditTime(log.ເວລາກວດ || '');
    setEditBranch(log["ສາຂາ "] || '');
    setEditUnit(log["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '');
    setEditSector(log.ຂະແໜງ || '');
    setEditRoom(log.ສະຖານທີ || '');
    setEditRoomLocation(log.ສະຖານທີ່_ຫ້ອງ || '');
    setEditType(log.ຮູບແບບການກວດ || 'ກວດປະຈໍາວັນ');
    setEditSystem(log.ລະບົບທີ່ກວດ || 'ດ້ານໃນອາຄານ');
    
    // Parse categories from log.ໝວດລະບົບກວດ
    const cats = log.ໝວດລະບົບກວດ ? log.ໝວດລະບົບກວດ.split(" , ").map(c => c.trim()).filter(Boolean) : [];
    setEditSelectedCategories(cats);

    // Parse evaluations from log.ລາຍການກວດ
    const parsedEvs = parseEvaluations(log.ລາຍການກວດ || '');
    setEditEvaluations(parsedEvs);

    setEditInspector(log.ຊື່ຜູ້ກວດ || '');
    setEditInspectorStatus(log.ຜູ້ກວດກາ || 'ພະນັກງານ ທພລ');
    setEditStatus((log.ສະຖານະ === 'ຜິດປົກກະຕີ' ? 'ຜິດປົກກະຕີ' : 'ປົກກະຕີ') as any);
    setEditFormType(fType);

    // Parse existing incidents linked to this inspection's ລະຫັດກວດກາ
    const linkedIncidentForms: ManualIncidentForm[] = incidents
      .filter(inc => inc.ລະຫັດກວດກາ === log.ລະຫັດກວດກາ)
      .map((inc) => ({
        id: String(inc.PID || Math.random().toString(36).substring(2, 11)),
        selectedChecklistPoint: inc.ລາຍການກວດ || '',
        hasAsset: (!inc.ລະຫັດຊັບສິນ || inc.ລະຫັດຊັບສິນ === 'ບໍ່ມີຊັບສິນ') ? 'no' : 'yes',
        assetCode: (!inc.ລະຫັດຊັບສິນ || inc.ລະຫັດຊັບສິນ === 'ບໍ່ມີຊັບສິນ') ? '' : inc.ລະຫັດຊັບສິນ,
        assetCategory: inc.ພາກສ່ວນຊັບສົມບັດ || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ',
        assetGroup: inc.ໝວດລະບົບກວດ || '',
        assetName: inc.ລາຍການ || '',
        problem: inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || '',
        impact: inc.ປະເມີນຜົນກະທົບ || 'ປານກາງ',
        solution: inc.ວີທີແກ້ໄຂ || '',
        assetBranch: inc.ສາຂາຊັບສິນ || (inc as any)["ສາຂາຊັບສິນ"] || inc["ສາຂາ "] || log["ສາຂາ "],
        assetUnit: inc.ຝ່າຍຊັບສິນ || (inc as any)["ຝ່າຍຊັບສິນ"] || inc["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || log["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
        assetSector: inc.ຂະແໜງຊັບສິນ || (inc as any)["ຂະແໜງຊັບສິນ"] || inc.ຂະແໜງ || log.ຂະແໜງ,
      }));
    setEditManualIncidentForms(linkedIncidentForms);

    setIsEditOpen(true);
  };

  const handleEditSystemChange = (system: string) => {
    setEditSystem(system);
    const matchingCats = getAreasForFormTypeAndSystem(
      finalChecklistItems,
      editFormType,
      system,
    );
    setEditSelectedCategories(matchingCats.length > 0 ? [matchingCats[0]] : []);
    setEditEvaluations({});
    setEditManualIncidentForms([]);
  };

  const handleEditFormTypeChange = (formType: SafetyFormType) => {
    setEditFormType(formType);
    const matchingCats = getAreasForFormTypeAndSystem(
      finalChecklistItems,
      formType,
      editSystem,
    );
    setEditSelectedCategories(matchingCats.length > 0 ? [matchingCats[0]] : []);
    setEditEvaluations({});
    setEditManualIncidentForms([]);
  };

  const handleEditAddCategory = (cat: string) => {
    if (!cat) return;
    if (!editSelectedCategories.includes(cat)) {
      setEditSelectedCategories(prev => [...prev, cat]);
    }
  };

  const handleEditRemoveCategory = (catToRemove: string) => {
    setEditSelectedCategories(prev => prev.filter(c => c !== catToRemove));
  };

  const handleEditAddManualIncident = (defaultPoint?: string) => {
    const existingSelected = editManualIncidentForms.map(f => f.selectedChecklistPoint).filter(Boolean);
    const defectivePoints = filteredEditChecklistOptions.filter(chk => editEvaluations[chk.ລາຍການກວດ]?.status === 'X').map(chk => chk.ລາຍການກວດ);
    const availableDefective = defectivePoints.filter(p => !existingSelected.includes(p));
    const availableOverall = filteredEditChecklistOptions.map(chk => chk.ລາຍການກວດ).filter(p => !existingSelected.includes(p));

    const point = defaultPoint || availableDefective[0] || availableOverall[0] || defectivePoints[0] || filteredEditChecklistOptions[0]?.ລາຍການກວດ || '';
    
    // Resolve the category of this checklist item
    const matchedOpt = filteredEditChecklistOptions.find(chk => chk.ລາຍການກວດ === point);
    const itemCat = matchedOpt ? matchedOpt.ໝວດລະບົບກວດ : (editSelectedCategories[0] || '');

    const newForm: ManualIncidentForm = {
      id: Math.random().toString(36).substring(2, 11),
      selectedChecklistPoint: point,
      hasAsset: 'yes',
      assetCode: '',
      assetCategory: (ASSET_CATEGORIES[0] as any)["ພាកສ່ວນ"] || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ',
      assetGroup: itemCat,
      assetName: '',
      problem: point,
      impact: 'ປານກາງ',
      solution: '',
      assetBranch: editBranch,
      assetUnit: editUnit,
      assetSector: editSector
    };
    setEditManualIncidentForms(prev => [...prev, newForm]);
  };

  const handleEditRemoveManualIncident = (id: string) => {
    setEditManualIncidentForms(prev => prev.filter(f => f.id !== id));
  };

  const handleEditUpdateManualIncident = (id: string, field: keyof ManualIncidentForm, value: any) => {
    setEditManualIncidentForms(prev => prev.map(form => {
      if (form.id === id) {
        let updated = { ...form, [field]: value };
        if (field === 'hasAsset' && value === 'no') {
          updated.assetCode = 'ບໍ່ມີຊັບສິນ';
          updated.assetCategory = 'none';
          updated.assetName = 'ບໍ່ມີຊັບສິນ (Case ທົ່ວໄປ)';
        } else if (field === 'hasAsset' && value === 'yes') {
          updated.assetCode = '';
          updated.assetCategory = (ASSET_CATEGORIES[0] as any)["ພາກສ່ວນ"] || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ';
          updated.assetName = '';
        }
        return updated;
      }
      return form;
    }));
  };

  const handleEditManualAssetCodeChange = (id: string, code: string) => {
    setEditManualIncidentForms(prev => prev.map(form => {
      if (form.id === id) {
        const uppercaseVal = (code || '').toUpperCase().trim();
        const matched = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === uppercaseVal.toLowerCase());
        
        return {
          ...form,
          assetCode: code,
          assetName: matched ? matched.ລາຍການ : form.assetName,
          assetGroup: matched ? matched.ໝວດລາຍການ : form.assetGroup,
          assetCategory: matched ? matched.ພາກສ່ວນ : form.assetCategory
        };
      }
      return form;
    }));
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInspection) return;

    // Dynamically calculate defective checklist items
    const defectiveItemsList = filteredEditChecklistOptions.filter(chk => editEvaluations[chk.ລາຍການກວດ]?.status === 'X');

    // Validate filled fields for all manually added defective forms
    if (editManualIncidentForms.length > 0) {
      for (let i = 0; i < editManualIncidentForms.length; i++) {
        const dForm = editManualIncidentForms[i];
        const isWithAsset = dForm.hasAsset !== 'no';
        if (isWithAsset) {
          if (!dForm.assetCode?.trim() || !dForm.assetGroup?.trim() || !dForm.assetName?.trim()) {
            alert(`ກະລຸນາປ້ອນຂໍ້ມູນຊັບສິນ (ລະຫັດຊັບສິນ, ໜວດລາຍການຊັບສິນ, ແລະ ຊື່ຊັບສິນ) ໃຫ້ຄົບຖ້ວນ ສຳລັບລາຍການທີ ${i + 1}`);
            return;
          }
        } else {
          if (!dForm.assetGroup?.trim() || !dForm.assetName?.trim()) {
            alert(`ກະລຸນາປ້ອນຂໍ້ມູນ (ໜວດລາຍການຊັບສິນ ແລະ ຊື່ຊັບສິນ) ໃຫ້ຄົບຖ້ວນ ສຳລັບລາຍການທີ ${i + 1}`);
            return;
          }
        }
      }
    }

    // Format new checklist text
    const evaluatedList = filteredEditChecklistOptions.map((chk) => {
      const ev = editEvaluations[chk.ລາຍການກວດ] || { status: '✓', note: '' };
      return `${chk.ລາຍການກວດ} (${ev.status === 'X' ? '❌ ຜິດປົກກະຕິ' : '✅ ປົກກະຕິ'}${ev.note ? ' - ' + ev.note : ''})`;
    });

    const hasDefects = defectiveItemsList.length > 0 || editManualIncidentForms.length > 0;

    const formattedEditDate = formatDateInputValue(editDate);
    const editDateObject = formattedEditDate ? new Date(`${formattedEditDate}T00:00:00`) : null;

    const updatedFields: Partial<InspectionRecord> = {
      ວັນທີ່ກວດ: formattedEditDate,
      ເວລາກວດ: editTime,
      "ສາຂາ ": editBranch,
      "ຝ່າຍ/ໜ່ວຍບໍລິການ": editUnit,
      ຂະແໜງ: editSector,
      ສະຖານທີ: editRoom,
      ສະຖານທີ່_ຫ້ອງ: editRoomLocation,
      ຮູບແບບການກວດ: editType,
      ລະບົບທີ່ກວດ: editSystem,
      ໝວດລະບົບກວດ: editSelectedCategories.join(" , "),
      ລາຍການກວດ: evaluatedList.join(" , "),
      ສະຖານະ: hasDefects ? "ຜິດປົກກະຕີ" : "ປົກກະຕີ",
      ຈຳນວນເຫດການທີ່ພົບ: editManualIncidentForms.length,
      ເດືອນ: editDateObject ? editDateObject.getMonth() + 1 : editingInspection.ເດືອນ,
      ປີ: editDateObject ? editDateObject.getFullYear() : editingInspection.ປີ,
    };

    // Save and compile individual incidents (associated items)
    const incidentRecordsList: Omit<IncidentRecord, "ລ/ດ">[] = editManualIncidentForms.map((dForm, idx) => {
      const originalInc = incidents.find(inc => inc.PID === dForm.id);
      const itemText = dForm.selectedChecklistPoint || "ບໍ່ລະບຸຈຸດກວດ";
      const matchedCheckpoint = filteredEditChecklistOptions.find(
        checkpoint => checkpoint.ລາຍການກວດ === itemText,
      );
      const existingPid = dForm.id.includes("-") || dForm.id.length > 8 ? dForm.id : `${editingInspection.PID}-${idx + 1}`;
      const isWithAsset = dForm.hasAsset !== 'no';
      
      return {
        PID: existingPid,
        ລະຫັດກວດກາ: editingInspection.ລະຫັດກວດກາ,
        ລະບົບທີ່ກວດ: editSystem,
        ໝວດລະບົບກວດ: matchedCheckpoint?.ໝວດລະບົບກວດ || '',
        ລາຍການກວດ: itemText,
        ລະຫັດຊັບສິນ: isWithAsset ? dForm.assetCode.trim() : "ບໍ່ມີຊັບສິນ",
        ພາກສ່ວນຊັບສົມບັດ: dForm.assetCategory,
        ໝວດລາຍການ: (dForm.assetGroup || '').toUpperCase(),
        ລາຍການ: dForm.assetName.trim(),
        ລາຍລະອຽດປັນຫາທີ່ພົບ: dForm.problem.trim() || `${itemText}`,
        ປະເມີນຜົນກະທົບ: dForm.impact,
        ວີທີແກ້ໄຂ: dForm.solution.trim() || "ລໍຖ້າກວດສອບ ແລະ ວາງແຜນ",
        ວັນທີ່ກວດ: formattedEditDate,
        ເວລາກວດ: editTime,
        ຜູ້ກວດກາ: editInspectorStatus,
        ຊື່ຜູ້ກວດ: editInspector,
        "ສາຂາ ": editBranch,
        "ຝ່າຍ/ໜ່ວຍບໍລິການ": editUnit,
        ຂະແໜງ: editSector,
        ສະຖານທີ່_ຫ້ອງ: editRoomLocation || originalInc?.ສະຖານທີ່_ຫ້ອງ || "ບໍ່ລະບຸ",
        ...{
          "ສາຂາຊັບສິນ": dForm.assetBranch,
          "ຝ່າຍຊັບສິນ": dForm.assetUnit,
          "ຂະແໜງຊັບສິນ": dForm.assetSector
        } as any,
        ຊັ້ນອາຄານ: editingInspection.ຊັ້ນອາຄານ || '1',
        ເດືອນ: editDateObject ? editDateObject.getMonth() + 1 : editingInspection.ເດືອນ,
        ປີ: editDateObject ? editDateObject.getFullYear() : editingInspection.ປີ,
        order: originalInc?.order || editingInspection.order || idx + 1,
        ຮັບອໍເດີ: originalInc ? originalInc.ຮັບອໍເດີ : 1,
        ຈຳນວນຄົງຄ້າງ: originalInc ? originalInc.ຈຳນວນຄົງຄ້າງ : 1,
        ສະຖານະ: originalInc ? originalInc.ສະຖານະ : "ລໍຖ້າການອະນຸມັດ",
      } as any;
    });

    if (onUpdateInspection) {
      onUpdateInspection(editingInspection.PID, updatedFields, incidentRecordsList);
    }
    
    setIsEditOpen(false);
    setEditingInspection(null);
  };

  // Form Type State (ສຳນັກງານໃຫຍ່, ສາຂາ, ໜ່ວຍບໍລິການ, ຫ້ອງຮັບເງິນ)
  const [selectedFormType, setSelectedFormType] = useState<SafetyFormType>(() => {
    return detectSafetyFormType(currentUser.branch, currentUser.branch);
  });

  // Run auto detector on branch/unit change
  React.useEffect(() => {
    const detected = detectSafetyFormType(targetBranch, targetUnit);
    setSelectedFormType(detected);
  }, [targetBranch, targetUnit]);

  React.useEffect(() => {
    if (autoEditInspectionCode) {
      const match = inspections.find(ins => ins.ລະຫັດກວດກາ === autoEditInspectionCode || ins.PID === autoEditInspectionCode);
      if (match) {
        handleOpenEdit(match);
      }
      if (onClearAutoEdit) {
        onClearAutoEdit();
      }
    }
  }, [autoEditInspectionCode, inspections, onClearAutoEdit]);

  // Redesigned state for multi-item evaluation checklist (✓ / X and notes per item)
  const [evaluations, setEvaluations] = useState<Record<string, { status: '✓' | 'X' | null; note: string }>>({});

  interface ManualIncidentForm {
    id: string;
    selectedChecklistPoint: string;
    hasAsset?: 'yes' | 'no';
    assetCode: string;
    assetCategory: string;
    assetGroup: string;
    assetName: string;
    problem: string;
    impact: string;
    solution: string;
    assetBranch?: string;
    assetUnit?: string;
    assetSector?: string;
    isAddingAssetGroup?: boolean;
    isAddingAssetName?: boolean;
    newAssetGroup?: string;
    newAssetName?: string;
    previousAssetGroup?: string;
    previousAssetName?: string;
  }
  const [manualIncidentForms, setManualIncidentForms] = useState<ManualIncidentForm[]>([]);
  const inspectionAssetItemTypeOptions = useMemo(
    () => getIncidentItemTypeOptions(incidents),
    [incidents],
  );
  const isValidInspectionAssetName = (value: string, options: string[]) => {
    if (isReservedIncidentAssetMasterValue(value)) return false;
    const canonicalValue = canonicalizeIncidentMasterValue(value, options);
    return options.some(
      option => option.toLocaleLowerCase() === canonicalValue.toLocaleLowerCase(),
    );
  };

  // Dynamic Incident Forms dictionary associated with each checklist item marked "X"
  const [defectForms, setDefectForms] = useState<Record<string, {
    assetCode: string;
    assetCategory: string;
    assetGroup: string;
    assetName: string;
    problem: string;
    impact: string;
    solution: string;
  }>>({});
  
  // New Incident registration state (conditional sub-form during new inspection)
  const [assetCode, setAssetCode] = useState('');
  const [assetCategory, setAssetCategory] = useState('ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
  const [assetGroup, setAssetGroup] = useState('');
  const [assetName, setAssetName] = useState('');
  const [problem, setProblem] = useState('');
  const [impact, setImpact] = useState('ປານກາງ');
  const [proposedSolution, setProposedSolution] = useState('');
  const [linkHasAsset, setLinkHasAsset] = useState<'yes' | 'no'>('yes');

  // Extract unique historic assets from the incidents database for matching
  const uniqueAssets = React.useMemo(() => {
    const map = new Map<string, {
      ລະຫັດຊັບສິນ: string;
      ພາກສ່ວນຊັບສົມບັດ: string;
      ໝວດລາຍການ: string;
      ລາຍການ: string;
      assetBranch: string;
      assetUnit: string;
      assetSector: string;
    }>();

    incidents.forEach(item => {
      const code = String(item.ລະຫັດຊັບສິນ || '').trim();
      if (code) {
        map.set(code.toLowerCase(), {
          ລະຫັດຊັບສິນ: code,
          ພາກສ່ວນຊັບສົມບັດ: item.ພາກສ່ວນຊັບສົມບັດ || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ',
          ໝວດລາຍການ: item.ໝວດລາຍການ || '',
          ລາຍການ: item.ລາຍການ || '',
          assetBranch: item.ສາຂາຊັບສິນ || (item as any)["ສາຂາຊັບສິນ"] || item["ສາຂາ "] || '',
          assetUnit: item.ຝ່າຍຊັບສິນ || (item as any)["ຝ່າຍຊັບສິນ"] || item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '',
          assetSector: item.ຂະແໜງຊັບສິນ || (item as any)["ຂະແໜງຊັບສິນ"] || item.ຂະແໜງ || ''
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
      setAssetCategory(matched.ພາກສ່ວນຊັບສົມບັດ);
      setAssetGroup(matched.ໝວດລາຍການ);
      setAssetName(matched.ລາຍການ);
    }
  };

  // Link Incident Modal (for registering incident to an existing abnormal inspection record)
  const [isLinkIncidentOpen, setIsLinkIncidentOpen] = useState(false);
  const [linkInsp, setLinkInsp] = useState<InspectionRecord | null>(null);

  // Inspection Detail Modal State
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Auto-filled list of rooms/floors
  const floorOptions = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "ຊັ້ນໃຕ້ດິນ"];

  // Unique list of systems and categories for filter & forms
  const allSystems = React.useMemo(() => {
    const systems = new Set<string>();
    finalChecklistItems.forEach(item => {
      const system = String(item.ລະບົບທີ່ກວດ || '').trim();
      if (system) systems.add(system);
    });
    return Array.from(systems);
  }, [finalChecklistItems]);

  const formSystems = React.useMemo(
    () => getSystemsForFormType(finalChecklistItems, selectedFormType),
    [finalChecklistItems, selectedFormType],
  );

  const editFormSystems = React.useMemo(
    () => getSystemsForFormType(finalChecklistItems, editFormType),
    [finalChecklistItems, editFormType],
  );

  const uniqueCategories = React.useMemo(() => {
    return getAreasForFormTypeAndSystem(
      finalChecklistItems,
      selectedFormType,
      selSystem,
    );
  }, [selSystem, selectedFormType, finalChecklistItems]);

  const handleAddCategory = (cat: string) => {
    if (!cat) return;
    if (!selectedCategories.includes(cat)) {
      setSelectedCategories(prev => [...prev, cat]);
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setSelectedCategories(prev => prev.filter(c => c !== catToRemove));
  };

  // Filter lists based on chosen system & categories
  const filteredChecklistOptions = React.useMemo(() => {
    let baseItems: Array<{ ລະບົບທີ່ກວດ: string; ໝວດລະບົບກວດ: string; ລາຍການກວດ: string }> = [];

    selectedCategories.forEach(cat => {
      const catItems = finalChecklistItems.filter(item => 
        item.ລະບົບທີ່ກວດ === selSystem && 
        item.ໝວດລະບົບກວດ === cat &&
        (!item.Form_Type || item.Form_Type === selectedFormType)
      );

      // Clean up any existing placeholders starting with or containing "ອື່ນໆ"
      const cleanedItems = catItems.filter(item => {
        const cleanVal = (item.ລາຍການກວດ || "").trim();
        return (
          !cleanVal.includes("ອື່ນໆ") &&
          !cleanVal.startsWith("ອື່ນ") &&
          !cleanVal.includes("ແລະ ອື່ນໆ") &&
          !cleanVal.includes("ແລະອື່ນໆ")
        );
      });

      // Append exactly one standardized "ແລະ ອື່ນໆ:..................................................." item at the end of this category
      if (cat) {
        cleanedItems.push({
          ລະບົບທີ່ກວດ: selSystem,
          ໝວດລະບົບກວດ: cat,
          ລາຍການກວດ: `ແລະ ອື່ນໆ ຂອງ ${cat}:...................................................`
        });
      }

      baseItems = [...baseItems, ...cleanedItems];
    });

    return baseItems;
  }, [selectedFormType, selSystem, selectedCategories, finalChecklistItems]);

  const uniqueEditCategories = React.useMemo(() => {
    return getAreasForFormTypeAndSystem(
      finalChecklistItems,
      editFormType,
      editSystem,
    );
  }, [editSystem, editFormType, finalChecklistItems]);

  const filteredEditChecklistOptions = React.useMemo(() => {
    let baseItems: Array<{ ລະບົບທີ່ກວດ: string; ໝວດລະບົບກວດ: string; ລາຍການກວດ: string }> = [];

    editSelectedCategories.forEach(cat => {
      const catItems = finalChecklistItems.filter(item => 
        item.ລະບົບທີ່ກວດ === editSystem && 
        item.ໝວດລະບົບກວດ === cat &&
        (!item.Form_Type || item.Form_Type === editFormType)
      );

      // Clean up any existing placeholders starting with or containing "ອື່ນໆ"
      const cleanedItems = catItems.filter(item => {
        const cleanVal = (item.ລາຍການກວດ || "").trim();
        return (
          !cleanVal.includes("ອື່ນໆ") &&
          !cleanVal.startsWith("ອື່ນ") &&
          !cleanVal.includes("ແລະ ອື່ນໆ") &&
          !cleanVal.includes("ແລະອື່ນໆ")
        );
      });

      // Append exactly one standardized "ແລະ ອື່ນໆ:..................................................." item at the end of this category
      if (cat) {
        cleanedItems.push({
          ລະບົບທີ່ກວດ: editSystem,
          // Handle fallback type safekeeping
          ໝວດລະບົບກວດ: cat,
          ລາຍການກວດ: `ແລະ ອື່ນໆ ຂອງ ${cat}:...................................................`
        });
      }

      baseItems = [...baseItems, ...cleanedItems];
    });

    return baseItems;
  }, [editFormType, editSystem, editSelectedCategories, finalChecklistItems]);

  // Automatically adjust category selection when chosen system or form type changes
  React.useEffect(() => {
    const matchingSystems = getSystemsForFormType(finalChecklistItems, selectedFormType);
    const resolvedSystem = matchingSystems.includes(selSystem)
      ? selSystem
      : (matchingSystems[0] || '');

    if (resolvedSystem !== selSystem) {
      setSelSystem(resolvedSystem);
      return;
    }

    const matchingCats = getAreasForFormTypeAndSystem(
      finalChecklistItems,
      selectedFormType,
      resolvedSystem,
    );

    setSelectedCategories(previous => {
      const stillValid = previous.filter(category => matchingCats.includes(category));
      const next = stillValid.length > 0
        ? stillValid
        : (matchingCats[0] ? [matchingCats[0]] : []);
      const unchanged =
        previous.length === next.length &&
        previous.every((category, index) => category === next[index]);
      return unchanged ? previous : next;
    });
  }, [selectedFormType, selSystem, finalChecklistItems]);

  // Handlers for dynamic dropdown changes
  const handleSystemChange = (system: string) => {
    setSelSystem(system);
    setEvaluations({});
    setDefectForms({});
    setManualIncidentForms([]);
    setInspectionDateInput(formatDateInputValue());
  };

  const handleFormTypeChange = (
    formType: SafetyFormType,
  ) => {
    setSelectedFormType(formType);
    setEvaluations({});
    setDefectForms({});
    setManualIncidentForms([]);
  };

  const handleCategoryChange = (cat: string) => {
    if (cat) {
      setSelectedCategories([cat]);
    } else {
      setSelectedCategories([]);
    }
    setEvaluations({});
    setDefectForms({});
    setManualIncidentForms([]);
  };

  const handleAddManualIncident = (defaultPoint?: string) => {
    const existingSelected = manualIncidentForms.map(f => f.selectedChecklistPoint).filter(Boolean);
    const defectivePoints = filteredChecklistOptions.filter(chk => evaluations[chk.ລາຍການກວດ]?.status === 'X').map(chk => chk.ລາຍການກວດ);
    const availableDefective = defectivePoints.filter(p => !existingSelected.includes(p));
    const availableOverall = filteredChecklistOptions.map(chk => chk.ລາຍການກວດ).filter(p => !existingSelected.includes(p));

    const point = defaultPoint || availableDefective[0] || availableOverall[0] || defectivePoints[0] || filteredChecklistOptions[0]?.ລາຍການກວດ || '';
    
    const newForm: ManualIncidentForm = {
      id: Math.random().toString(36).substring(2, 11),
      selectedChecklistPoint: point,
      hasAsset: 'yes',
      assetCode: '',
      assetCategory: (ASSET_CATEGORIES[0] as any)["ພາກສ່ວນ"] || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ',
      assetGroup: '',
      assetName: '',
      problem: point,
      impact: 'ປານກາງ',
      solution: '',
      assetBranch: targetBranch,
      assetUnit: targetUnit,
      assetSector: targetSector
    };
    setManualIncidentForms(prev => [...prev, newForm]);
  };

  const handleRemoveManualIncident = (id: string) => {
    setManualIncidentForms(prev => prev.filter(f => f.id !== id));
  };

  const handleUpdateManualIncident = (id: string, field: keyof ManualIncidentForm, value: any) => {
    setManualIncidentForms(prev => prev.map(form => {
      if (form.id === id) {
        let updated = { ...form, [field]: value };
        if (field === 'hasAsset' && value === 'no') {
          updated.assetCode = '';
          updated.assetCategory = 'none';
          updated.assetGroup = 'none';
          updated.assetName = 'none';
          updated.assetBranch = 'none';
          updated.assetUnit = 'none';
          updated.assetSector = 'none';
          updated.previousAssetName = '';
        } else if (field === 'hasAsset' && value === 'yes') {
          updated.assetCode = '';
          updated.assetCategory = (ASSET_CATEGORIES[0] as any)["ພາກສ່ວນ"] || 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ';
          updated.assetGroup = '';
          updated.assetName = '';
          updated.assetBranch = targetBranch;
          updated.assetUnit = targetUnit;
          updated.assetSector = targetSector;
          updated.isAddingAssetGroup = false;
          updated.isAddingAssetName = false;
          updated.newAssetGroup = '';
          updated.newAssetName = '';
          updated.previousAssetGroup = '';
          updated.previousAssetName = '';
        }
        if (field === 'assetCategory' || field === 'assetGroup') {
          const validNames = getInspectionAssetNameOptions(
            incidents,
            updated.assetCategory,
            updated.assetGroup,
          );
          if (!isValidInspectionAssetName(updated.assetName, validNames)) {
            updated.assetName = '';
          }
          updated.previousAssetName = '';
          updated.isAddingAssetName = false;
          updated.newAssetName = '';
        }
        if (field === 'selectedChecklistPoint' && (!form.problem || form.problem === form.selectedChecklistPoint)) {
          updated.problem = value;
        }
        return updated;
      }
      return form;
    }));
  };

  const handleManualCheckpointChange = (id: string, value: string) => {
    setManualIncidentForms(prev => prev.map(form => {
      if (form.id !== id) return form;
      const isWithAsset = form.hasAsset !== 'no';
      return {
        ...form,
        selectedChecklistPoint: value,
        problem: !form.problem || form.problem === form.selectedChecklistPoint ? value : form.problem,
        assetGroup: isWithAsset ? '' : 'none',
        assetName: isWithAsset ? '' : 'none',
        ...(isWithAsset ? {
          isAddingAssetGroup: false,
          isAddingAssetName: false,
          newAssetGroup: '',
          newAssetName: '',
          previousAssetGroup: '',
          previousAssetName: '',
        } : {}),
      };
    }));
  };

  const selectInspectionAssetCategory = (id: string, value: string) => {
    if (value === INCIDENT_ASSET_ADD_NEW_SENTINEL) {
      setManualIncidentForms(prev => prev.map(form => form.id === id ? {
        ...form,
        isAddingAssetGroup: true,
        newAssetGroup: '',
        previousAssetGroup: form.assetGroup,
      } : form));
      return;
    }
    handleUpdateManualIncident(id, 'assetGroup', value);
  };

  const selectInspectionAssetName = (id: string, value: string) => {
    if (value === INCIDENT_ASSET_ADD_NEW_SENTINEL) {
      setManualIncidentForms(prev => prev.map(form => form.id === id ? {
        ...form,
        isAddingAssetName: true,
        newAssetName: '',
        previousAssetName: form.assetName,
      } : form));
      return;
    }
    handleUpdateManualIncident(id, 'assetName', value);
  };

  const acceptInspectionAssetMasterValue = (
    id: string,
    field: 'assetGroup' | 'assetName',
    value: string,
  ) => {
    setManualIncidentForms(prev => prev.map(form => {
      if (form.id !== id) return form;
      const validNames = field === 'assetGroup'
        ? inspectionAssetItemTypeOptions
        : getInspectionAssetNameOptions(incidents, form.assetCategory, form.assetGroup);
      const canonicalValue = canonicalizeIncidentMasterValue(value, validNames);
      const previousValue = field === 'assetGroup'
        ? form.previousAssetGroup || ''
        : form.previousAssetName || '';
      const acceptedValue = isReservedIncidentAssetMasterValue(canonicalValue)
        ? field === 'assetName'
          ? isValidInspectionAssetName(previousValue, validNames) ? previousValue : ''
          : previousValue
        : canonicalValue;

      if (field === 'assetName') {
        return {
          ...form,
          assetName: acceptedValue,
          isAddingAssetName: false,
          newAssetName: '',
        };
      }

      const namesForCategory = getInspectionAssetNameOptions(incidents, form.assetCategory, acceptedValue);
      return {
        ...form,
        assetGroup: acceptedValue,
        assetName: isValidInspectionAssetName(form.assetName, namesForCategory) ? form.assetName : '',
        isAddingAssetGroup: false,
        newAssetGroup: '',
        previousAssetName: '',
        isAddingAssetName: false,
        newAssetName: '',
      };
    }));
  };

  const cancelInspectionAssetMasterValue = (
    id: string,
    field: 'assetGroup' | 'assetName',
  ) => {
    setManualIncidentForms(prev => prev.map(form => {
      if (form.id !== id) return form;
      if (field === 'assetGroup') {
        return {
          ...form,
          assetGroup: form.previousAssetGroup || '',
          isAddingAssetGroup: false,
          newAssetGroup: '',
        };
      }
      const validNames = getInspectionAssetNameOptions(
        incidents,
        form.assetCategory,
        form.assetGroup,
      );
      const previousValue = form.previousAssetName || '';
      return {
        ...form,
        assetName: isValidInspectionAssetName(previousValue, validNames) ? previousValue : '',
        isAddingAssetName: false,
        newAssetName: '',
      };
    }));
  };

  const handleManualAssetCodeChange = (id: string, scannedVal: string) => {
    const trimmed = (scannedVal || '').trim();
    setManualIncidentForms(prev => prev.map(form => {
      if (form.id === id) {
        const matched = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === trimmed.toLowerCase());
        if (matched) {
          return {
            ...form,
            assetCode: trimmed,
            assetCategory: matched.ພາກສ່ວນຊັບສົມບັດ,
            assetGroup: matched.ໝວດລາຍການ,
            assetName: matched.ລາຍການ,
            assetBranch: matched.assetBranch || form.assetBranch || targetBranch,
            assetUnit: matched.assetUnit || form.assetUnit || targetUnit,
            assetSector: matched.assetSector || form.assetSector || targetSector,
            isAddingAssetGroup: false,
            isAddingAssetName: false,
            newAssetGroup: '',
            newAssetName: '',
            previousAssetGroup: '',
            previousAssetName: '',
          };
        } else {
          return {
            ...form,
            assetCode: trimmed
          };
        }
      }
      return form;
    }));
  };

  const handleDefectAssetChange = (itemText: string, field: string, value: any) => {
    setDefectForms(prev => ({
      ...prev,
      [itemText]: {
        ...(prev[itemText] || {
          assetCode: '',
          assetCategory: 'ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ',
          assetGroup: selCategory,
          assetName: '',
          problem: itemText,
          impact: 'ປານກາງ',
          solution: ''
        }),
        [field]: value
      }
    }));
  };

  // Submit new Inspection
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    // Dynamically calculate defective checklist items
    const defectiveItemsList = filteredChecklistOptions.filter(chk => evaluations[chk.ລາຍການກວດ]?.status === 'X');

    // Make sure we validate filled fields for ALL manually added defective forms
    if (manualIncidentForms.length > 0) {
      for (let i = 0; i < manualIncidentForms.length; i++) {
        const dForm = manualIncidentForms[i];
        const isWithAsset = dForm.hasAsset !== 'no';
        if (isWithAsset) {
          if (
            !dForm.assetCode?.trim()
            || !dForm.assetGroup?.trim()
            || isReservedIncidentAssetMasterValue(dForm.assetGroup)
            || isReservedIncidentAssetMasterValue(dForm.assetName)
          ) {
            alert(`ກະລຸນາປ້ອນຂໍ້ມູນຊັບສິນ (ລະຫັດຊັບສິນ, ໜວດລາຍການຊັບສິນ, ແລະ ຊື່ຊັບສິນ) ໃຫ້ຄົບຖ້ວນ ສຳລັບລາຍການທີ ${i + 1}`);
            return;
          }
        } else {
          if (!dForm.assetGroup?.trim() || !dForm.assetName?.trim()) {
            alert(`ກະລຸນາປ້ອນຂໍ້ມູນ (ໜວດລາຍການຊັບສິນ ແລະ ຊື່ຊັບສິນ) ໃຫ້ຄົບຖ້ວນ ສຳລັບລາຍການທີ ${i + 1}`);
            return;
          }
        }
      }
    }

    const randomHex = Math.floor(Math.random() * 4096).toString(16).padStart(3, '0');
    const inspectionCode = `LDB-SAF-${randomHex}`;
    const pid = Math.random().toString(36).substr(2, 9);
    
    const formattedDate = formatDateInputValue(inspectionDateInput); // Store as ISO for raw data
    const selectedDate = new Date(`${formattedDate}T00:00:00`);
    const today = Number.isNaN(selectedDate.getTime()) ? new Date() : selectedDate;
    const formattedTime = new Date().toTimeString().split(' ')[0].substring(0, 5); // HH:MM

    // Format final list of evaluations for the main record log
    const evaluatedList = filteredChecklistOptions.map((chk) => {
      const ev = evaluations[chk.ລາຍການກວດ] || { status: '✓', note: '' };
      return `${chk.ລາຍການກວດ} (${ev.status === 'X' ? '❌ ຜິດປົກກະຕິ' : '✅ ປົກກະຕິ'}${ev.note ? ' - ' + ev.note : ''})`;
    });

    const hasDefects = defectiveItemsList.length > 0 || manualIncidentForms.length > 0;

    const inspRecord: Omit<InspectionRecord, "ລ/ດ"> = {
      PID: pid,
      ລະຫັດກວດກາ: inspectionCode,
      ວັນທີ່ກວດ: formattedDate,
      ເວລາກວດ: formattedTime,
      ຜູ້ກວດກາ: inspectorStatus,
      ຊື່ຜູ້ກວດ: inspectorName,
      ... room.length >= 0 ? {
        ສະຖານທີ: room,
        "ສາຂາ ": targetBranch,
        "ຝ່າຍ/ໜ່ວຍບໍລິການ": targetUnit,
        ຂະແໜງ: targetSector,
        ຊັ້ນອາຄານ: floor,
        ຮູບແບບການກວດ: inspType,
        ລະບົບທີ່ກວດ: selSystem,
        ໝວດລະບົບກວດ: selectedCategories.join(" , "),
        ລາຍການກວດ: evaluatedList.join(" , "),
        ສະຖານະ: hasDefects ? "ຜິດປົກກະຕີ" : "ປົກກະຕີ",
        ຈຳນວນເຫດການທີ່ພົບ: manualIncidentForms.length,
        ເດືອນ: today.getMonth() + 1,
        ປີ: today.getFullYear(),
        ຮັບອໍເດີ: hasDefects ? 1 : 0,
        ຈຳນວນຄົງຄ້າງ: hasDefects ? 1 : 0,
        ສະຖານະຮັບ: hasDefects ? "ລໍຖ້າຮັບ" : "",
      } : {}
    } as any;

    // Save the main inspection record
    onAddInspection(inspRecord, undefined);

    // Save each individual manually added defect as an actionable Incident record
    const incidentRecordsList: Omit<IncidentRecord, "ລ/ດ">[] = [];
    manualIncidentForms.forEach((dForm, idx) => {
      const itemText = dForm.selectedChecklistPoint || "ບໍ່ລະບຸຈຸດກວດ";
      const matchedCheckpoint = filteredChecklistOptions.find(
        checkpoint => checkpoint.ລາຍການກວດ === itemText,
      );
      const uniqueIncidentPid = `${pid}-${idx + 1}`; // Create an absolutely unique PID for each defect item
      const isWithAsset = dForm.hasAsset !== 'no';

      const incident: Omit<IncidentRecord, "ລ/ດ"> = {
        PID: uniqueIncidentPid,
        ລະຫັດກວດກາ: inspectionCode,
        ຮູບແບບການກວດ: inspType,
        ລະບົບທີ່ກວດ: selSystem,
        ໝວດລະບົບກວດ: matchedCheckpoint?.ໝວດລະບົບກວດ || '',
        ລາຍການກວດ: itemText,
        ລະຫັດຊັບສິນ: isWithAsset ? dForm.assetCode.trim() : "ບໍ່ມີຊັບສິນ",
        ພາກສ່ວນຊັບສົມບັດ: dForm.assetCategory,
        ໝວດລາຍການ: dForm.assetGroup.toUpperCase(),
        ລາຍການ: dForm.assetName.trim(),
        ລາຍລະອຽດປັນຫາທີ່ພົບ: dForm.problem.trim() || `${itemText}`,
        ປະເມີນຜົນກະທົບ: dForm.impact,
        ວີທີແກ້ໄຂ: dForm.solution.trim() || "ລໍຖ້າກວດສອບ ແລະ ວາງແຜນ",
        ວັນທີ່ກວດ: formattedDate,
        ເວລາກວດ: formattedTime,
        ຜູ້ກວດກາ: inspectorStatus,
        ຊື່ຜູ້ກວດ: inspectorName,
        "ສາຂາ ": targetBranch,
        "ຝ່າຍ/ໜ່ວຍບໍລິການ": targetUnit,
        ຂະແໜງ: targetSector,
        ...{
          "ສາຂາຊັບສິນ": dForm.assetBranch,
          "ຝ່າຍຊັບສິນ": dForm.assetUnit,
          "ຂະແໜງຊັບສິນ": dForm.assetSector
        } as any,
        ຊັ້ນອາຄານ: floor,
        ເດືອນ: today.getMonth() + 1,
        ປີ: today.getFullYear(),
        order: 1,
        ຮັບອໍເດີ: 1,
        ຈຳນວນຄົງຄ້າງ: 1,
        ສະຖານະ: "ລໍຖ້າການອະນຸມັດ"
      };

      incidentRecordsList.push(incident);
    });

    if (incidentRecordsList.length > 0) {
      onAddIncident(incidentRecordsList);
    }

    // Reset Form Fields
    setIsOpen(false);
    setRoom('');
    setEvaluations({});
    setDefectForms({});
    setManualIncidentForms([]);
    setInspectionStatus('ປົກກະຕີ');
  };

  // Submit Incident Link for an existing abnormal Inspection
  const handleSaveLinkedIncident = (e: React.FormEvent) => {
    e.preventDefault();

    if (!linkInsp) return;

    const isWithAsset = linkHasAsset !== 'no';
    if (isWithAsset) {
      if (!assetCode.trim() || !assetGroup.trim() || !assetName.trim() || !problem.trim()) {
        alert("ກະລຸນາປ້ອນຂໍ້ມູນເຫດການ ແລະ ຊັບສິນ ເພື່ອບັນທຶກລົງທະບຽນເຫດການ");
        return;
      }
    } else {
      if (!assetGroup.trim() || !assetName.trim() || !problem.trim()) {
        alert("ກະລຸນາປ້ອນຂໍ້ມູນເຫດການ (ໜວດລາຍການຊັບສິນ ແລະ ຊື່ລາຍການ) ເພື່ອບັນທຶກລົງທະບຽນເຫດການ");
        return;
      }
    }

    const today = new Date();

    const newIncident: IncidentRecord = {
      PID: linkInsp.PID,
      ລະຫັດກວດກາ: linkInsp.ລະຫັດກວດກາ,
      ຮູບແບບການກວດ: linkInsp.ຮູບແບບການກວດ,
      ລະບົບທີ່ກວດ: linkInsp.ລະບົບທີ່ກວດ,
      ໝວດລະບົບກວດ: linkInsp.ໝວດລະບົບກວດ,
      ລາຍການກວດ: linkInsp.ລາຍການກວດ,
      ລະຫັດຊັບສິນ: isWithAsset ? assetCode.trim() : "ບໍ່ມີຊັບສິນ",
      ພາກສ່ວນຊັບສົມບັດ: assetCategory,
      ໝວດລາຍການ: assetGroup.trim().toUpperCase(),
      ລາຍການ: assetName.trim(),
      ລາຍລະອຽດປັນຫາທີ່ພົບ: problem.trim(),
      ປະເມີນຜົນກະທົບ: impact,
      ວີທີແກ້ໄຂ: proposedSolution.trim() || "ລໍຖ້າກວດສອບ ແລະ ວາງແຜນ",
      ວັນທີ່ກວດ: linkInsp.ວັນທີ່ກວດ,
      ເວລາກວດ: linkInsp.ເວລາກວດ,
      ຜູ້ກວດກາ: linkInsp.ຜູ້ກວດກາ,
      ຊື່ຜູ້ກວດ: linkInsp.ຊື່ຜູ້ກວດ,
      "ສາຂາ ": linkInsp["ສາຂາ "],
      "ຝ່າຍ/ໜ່ວຍບໍລິການ": linkInsp["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
      ຂະແໜງ: linkInsp.ຂະແໜງ,
      ຊັ້ນອາຄານ: linkInsp.ຊັ້ນອາຄານ,
      ເດືອນ: linkInsp.ເດືອນ || (today.getMonth() + 1),
      ປີ: linkInsp.ປີ || today.getFullYear(),
      order: 1,
      ຮັບອໍເດີ: 1,
      ຈຳນວນຄົງຄ້າງ: 1,
      ສະຖານະ: "ລໍຖ້າການອະນຸມັດ"
    };

    onAddIncident(newIncident);

    // Reset Link Modal States
    setIsLinkIncidentOpen(false);
    setLinkInsp(null);
    setAssetCode('');
    setAssetGroup('');
    setAssetName('');
    setProblem('');
    setProposedSolution('');
    setLinkHasAsset('yes');
  };

  // Perform filtering on the inspections list
  const filteredList = inspections.filter(item => {
    // 1. Search term match
    const term = searchTerm.toLowerCase().trim();
    const matchSearch = !term || 
      String(item.ລະຫັດກວດກາ || '').toLowerCase().includes(term) ||
      String(item.ຊື່ຜູ້ກວດ || '').toLowerCase().includes(term) ||
      String(item.ໝວດລະບົບກວດ || '').toLowerCase().includes(term) ||
      String(item.ລາຍການກວດ || '').toLowerCase().includes(term);

    // 2. Branch match
    const matchBranch = branchFilter === 'ALL' || String(item["ສາຂາ "] || '').trim() === branchFilter.trim();

    // 3. System match
    const matchSystem = systemFilter === 'ALL' || String(item.ລະບົບທີ່ກວດ || '').trim() === systemFilter.trim();

    // 4. Status match
    const matchStatus = statusFilter === 'ALL' || String(item.ສະຖານະ || '').trim() === statusFilter.trim();

    return matchSearch && matchBranch && matchSystem && matchStatus;
  });

  const handleExportExcel = () => {
    const exportData = filteredList.map(item => ({
      "ລະຫັດກວດກາ (Inspection ID)": item.ລະຫັດກວດກາ,
      "ວັນທີ່ກວດ (Date)": formatExcelDate(item.ວັນທີ່ກວດ),
      "ເວລາກວດ (Time)": item.ເວລາກວດ,
      "ຜູ້ກວດກາ (Auditor Class)": item.ຜູ້ກວດກາ,
      "ຊື່ຜູ້ກວດ (Auditor Name)": item.ຊື່ຜູ້ກວດ,
      "ສາຂາ (Branch)": item["ສາຂາ "],
      "ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)": item["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
      "ຂະແໜງ (Sector)": item.ຂະແໜງ,
      "ສະຖານທີ່ (Location Detail)": item.ສະຖານທີ || '',
      [LOCATION_FLOOR_LABEL]: item.ສະຖານທີ່_ຫ້ອງ || "—",
      "ຮູບແບບການກວດ (Inspection Type)": item.ຮູບແບບການກວດ,
      "ລະບົບທີ່ກວດ (System Category)": item.ລະບົບທີ່ກວດ,
      "ພື້ນທີ່/ຈຸດກວດ ( Area / Point)": item.ໝວດລະບົບກວດ,
      "ລາຍການກວດກາ (Inspection Item)": item.ລາຍການກວດ,
      "ສະຖານະກວດ (Result Status)": item.ສະຖານະ,
      "ຈຳນວນເຫດການທີ່ພົບ (Issues Found)": item.ຈຳນວນເຫດການທີ່ພົບ || 0,
      "ເດືອນ (Month)": item.ເດືອນ,
      "ປີ (Year)": item.ປີ,
      "ສະຖານະຮັບ (Order Status)": item.ສະຖານະຮັບ || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // Auto-fit columns
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inspections History");
    XLSX.writeFile(workbook, `ລາຍງານການກວດກາ_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Title & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">ບັນທຶກການກວດກາ can ຄວາມປອດໄພອາຄານ</h3>
          <p className="text-xs text-slate-500">
            ບັນທຶກ ແລະ ຄົ້ນຫາປະຫວັດການລົງກວດກາຄວາມປອດໄພຂອງແຕ່ລະສາຂາຢ່າງເປັນລະບົບ
          </p>
        </div>
        <button
          onClick={() => {
            setIsOpen(true);
            setTargetBranch(currentUser.branch);
            setTargetUnit(currentUser.branch);
            setCheckedItems([]);
            setInspectionStatus('...'.length > 0 ? 'ປົກກະຕີ' : 'ປົກກະຕີ');
          }}
          className="flex items-center justify-center p-3 text-xs font-semibold rounded-xl text-white bg-emerald-800 hover:bg-emerald-950 transition shadow-sm shrink-0 uppercase cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          ເຮັດການກວດກາໃໝ່ (New Inspection)
        </button>
      </div>

      {/* Filters Form */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-medium">
        <div>
          <label className="block text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ລະຫັດກວດກາ, ຜູ້ກວດ, ໝວດ..."
              className="w-full border border-slate-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-emerald-500 bg-white"
            />
            <Search className="h-4 w-4 text-slate-400 absolute left-2.5 top-2.5" />
          </div>
        </div>

        <div>
          <label className="block text-slate-500 mb-1 font-semibold">ສາຂາ</label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            disabled={currentUser.status !== "Admin"}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 disabled:opacity-75"
          >
            {currentUser.status === "Admin" && <option value="ALL">ທຸກສາຂາ (ALL)</option>}
            {Array.from(new Set(inspections.map(i => i["ສາຂາ "]))).filter(Boolean).map((br, idx) => (
              <option key={idx} value={br}>{br}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1 font-semibold">ລະບົບທີ່ກວດ</label>
          <select
            value={systemFilter}
            onChange={(e) => setSystemFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">ທຸກລະບົບ (ALL)</option>
            {allSystems.map((sys, idx) => (
              <option key={idx} value={sys}>{sys}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1 font-semibold">ສະຖານະ / ສະຖານະກວດ</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500 font-semibold"
          >
            <option value="ALL">ທຸກສະຖານະ (ALL)</option>
            <option value="ປົກກະຕີ">ປົກກະຕີ (Normal)</option>
            <option value="ຜິດປົກກະຕີ">ຜິດປົກກະຕີ (Defect / Abnormal)</option>
          </select>
        </div>
      </div>

      {/* Inspections Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
        <div className="p-4 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50">
          <span className="text-xs font-bold text-slate-650">
            ພົບທັງໝົດ {filteredList.length} ລາຍການກວດກາ {selectedPids.length > 0 && `(ເລືອກແລ້ວ ${selectedPids.length} ລາຍການ)`}
          </span>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {currentUser?.status === "Admin" && (
              <>
                {selectedPids.length > 0 && (
                  <button
                    onClick={() => {
                      setShowBulkConfirm(true);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition text-xs cursor-pointer shadow-sm border border-red-700"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    ລົບລາຍການທີ່ເລືອກ ({selectedPids.length})
                  </button>
                )}
                
                <button
                  onClick={() => {
                    setShowClearConfirm(true);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition text-xs cursor-pointer shadow-sm border border-amber-700"
                >
                  <Trash2 className="h-4 w-4 shrink-0" />
                  ລ້າງຂໍ້ມູນ (Clear Data)
                </button>
              </>
            )}

            <button
              onClick={handleExportExcel}
              className="bg-[#107c41] hover:bg-[#0e6b38] text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition text-xs cursor-pointer shadow-sm select-none"
            >
              <Download className="h-4 w-4 text-white shrink-0" />
              ດາວໂຫຼດ Excel (Export)
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 select-none">
                {currentUser?.status === "Admin" && (
                  <th className="p-3 w-10 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      checked={filteredList.length > 0 && selectedPids.length === filteredList.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPids(filteredList.map(item => item.PID));
                        } else {
                          setSelectedPids([]);
                        }
                      }}
                    />
                  </th>
                )}
                <th className="p-3">ລະຫັດກວດ</th>
                <th className="p-3">ສາຂາ / ພາກສ່ວນ</th>
                <th className="p-3">ລະບົບທີ່ກວດ / ພື້ນທີ່/ຈຸດກວດ</th>
                <th className="p-3">ສະຖານທີ່</th>
                <th className="p-3">ວັນ-ເວລາກວດ</th>
                <th className="p-3">ຜູ້ລົງກວດ</th>
                <th className="p-3 text-center">ສະຖານະກວດ</th>
                <th className="p-3 text-center">ລາຍການແຈ້ງເຫດ (Incident)</th>
                 <th className="p-3 text-center">ແກ້ໄຂ</th>
                {currentUser?.status === "Admin" && (
                  <th className="p-3 text-center">ລົບ</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
               {filteredList.slice(0, 30).map((log, index) => {
                 const isNormal = log.ສະຖານະ === "ປົກກະຕີ";
                 const isChecked = selectedPids.includes(log.PID);
                 return (
                   <tr 
                     key={index} 
                     onClick={(e) => {
                       const target = e.target as HTMLElement;
                       if (target.closest('button') || target.closest('.no-modal-click') || target.closest('input[type="checkbox"]')) {
                         return;
                       }
                       setSelectedInspection(log);
                       setIsDetailOpen(true);
                     }}
                     className={`${isChecked ? 'bg-emerald-50/30' : 'hover:bg-emerald-50/20'} text-slate-700 transition-colors cursor-pointer group`}
                   >
                     {currentUser?.status === "Admin" && (
                       <td className="p-3 text-center no-modal-click w-10">
                         <input 
                           type="checkbox" 
                           className="rounded text-emerald-600 border-slate-300 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                           checked={isChecked}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setSelectedPids(prev => [...prev, log.PID]);
                             } else {
                               setSelectedPids(prev => prev.filter(p => p !== log.PID));
                             }
                           }}
                         />
                       </td>
                     )}
                     <td className="p-3 font-mono font-bold text-slate-800 hover:text-emerald-700 hover:underline">
                       <span className="flex items-center gap-1.5">
                         <Eye className="h-3.5 w-3.5 text-emerald-600 shrink-0 group-hover:scale-110 transition-transform" />
                         {log.ລະຫັດກວດກາ}
                       </span>
                     </td>
                     <td className="p-3">
                       <div className="font-semibold">{log["ສາຂາ "]}</div>
                       <div className="text-[10px] text-slate-400">{log["ຝ່າຍ/ໜ່ວຍບໍລິການ"]}</div>
                     </td>
                     <td className="p-3">
                       <div>{log.ລະບົບທີ່ກວດ}</div>
                       <div className="text-[10px] text-emerald-800 font-medium">{log.ໝວດລະບົບກວດ}</div>
                     </td>
                     <td className="p-3">

                       <div className="font-semibold text-slate-700">{log.ສະຖານທີ || "ບໍ່ລະບຸສະຖານທີ່"}</div>
                     </td>
                     <td className="p-3">
                       <div>{formatExcelDate(log.ວັນທີ່ກວດ)}</div>
                       <div className="text-[10px] text-slate-400">{cleanString(log.ເວລາກວດ)}</div>
                     </td>
                     <td className="p-3">
                       <div className="font-medium flex items-center">
                         <User className="h-3.5 w-3.5 mr-1 text-slate-400 shrink-0" />
                         {log.ຊື່ຜູ້ກວດ}
                       </div>
                       <div className="text-[10px] text-slate-400">{log.ຜູ້ກວດກາ}</div>
                     </td>
                     <td className="p-3 text-center">
                       <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold ${
                         isNormal 
                           ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                           : 'bg-red-50 text-red-600 border border-red-100'
                       }`}>
                         {isNormal ? (
                           <CheckCircle2 className="h-3 w-3 mr-1" />
                         ) : (
                           <AlertTriangle className="h-3 w-3 mr-1" />
                         )}
                         {log.ສະຖານະ}
                       </span>
                     </td>
                     <td className="p-3 text-center">
                       {isNormal ? (
                         <span className="text-slate-400 font-medium">-</span>
                       ) : (() => {
                         const linkedInc = incidents.find(inc => inc.PID === log.PID || inc.ລະຫັດກວດກາ === log.ລະຫັດກວດກາ);
                         if (linkedInc) {
                           return (
                             <div className="flex flex-col items-center gap-0.5 select-none no-modal-click">
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-750 font-bold text-[9px] border border-emerald-100">
                                 🟢 ບັນທຶກແລ້ວ
                               </span>
                               <span className="text-[9px] text-slate-500 font-mono font-bold">{linkedInc.ລະຫັດຊັບສິນ}</span>
                             </div>
                           );
                         } else {
                           return (
                             <button
                               onClick={() => {
                                 setLinkInsp(log);
                                 setAssetCode('');
                                 setAssetCategory('ພາກສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
                                 setAssetGroup('');
                                 setAssetName('');
                                 setProblem(log.ລາຍການກວດ || '');
                                 setProposedSolution('');
                                 setIsLinkIncidentOpen(true);
                               }}
                               className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold transition shadow-xs cursor-pointer select-none inline-flex items-center"
                             >
                               <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                               ບັນທຶກເຫດການ
                             </button>
                           );
                         }
                       })()}
                     </td>
                     <td className="p-3 text-center no-modal-click">
                       <button
                         type="button"
                         onClick={() => handleOpenEdit(log)}
                         className="px-2 py-1 bg-sky-500 hover:bg-sky-600 text-white rounded text-[10px] font-bold transition shadow-xs cursor-pointer select-none inline-flex items-center gap-1"
                         title="ແກ້ໄຂລາຍການນີ້"
                       >
                         <Edit className="h-2.5 w-2.5" />
                         ແກ້ໄຂ
                       </button>
                     </td>
                     {currentUser?.status === "Admin" && (
                       <td className="p-3 text-center no-modal-click">
                         <button
                           type="button"
                           onClick={() => {
                             setSingleToDelete(log.PID);
                             setShowSingleConfirm(true);
                           }}
                           className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded transition cursor-pointer hover:border-red-300"
                           title="ລົບລາຍການນີ້"
                         >
                           <Trash2 className="h-3.5 w-3.5 shrink-0" />
                         </button>
                       </td>
                     )}
                   </tr>
                 );
               })}
               {filteredList.length === 0 && (
                 <tr>
                   <td colSpan={currentUser?.status === "Admin" ? 11 : 9} className="text-center py-12 text-slate-400">
                     ບໍ່ພົບປະຫວັດການກວດກາທີ່ກົງກັບເງື່ອນໄຂ
                   </td>
                 </tr>
               )}
            </tbody>
          </table>
        </div>
        {filteredList.length > 30 && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-slate-400 text-[10px]">
             ສະແດງສະເພາະ 30 ປະຫວັດຫຼ້າສຸດ. ໃຊ້ປຸ່ມຄົ້ນຫາ ແລະ ຕົວຕອງ ເພື່ອຊອກຫາຂໍ້ມູນເພີ່ມເຕີມ
          </div>
        )}
      </div>

      {/* Modal: New Inspection Form */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full flex flex-col max-h-[90vh]">
            <div className="bg-emerald-800 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="h-5 w-5 text-amber-400 animate-pulse" />
                <h4 className="font-bold text-sm sm:text-base">
                  ຟອມບັນທຶກການກວດກາຄວາມປອດໄພ (New Safety Inspection)
                </h4>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {/* Branch and Scope Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສາຂາ (Branch)</label>
                  <select
                    value={targetBranch}
                    onChange={(e) => {
                      setTargetBranch(e.target.value);
                      setTargetUnit(e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium cursor-pointer"
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
                  <label className="block font-bold text-slate-600 mb-1">ໜ່ວຍບໍລິການ / ຝ່າຍຍ່ອຍ</label>
                  <select
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer"
                  >
                    {BRANCHES.filter(b => b.ສາຂາ === targetBranch).map((b, idx) => {
                      const unitVal = b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ;
                      return (
                        <option key={idx} value={unitVal}>
                          {unitVal}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຂະແໜງ (Sector)</label>
                  <select
                    value={targetSector}
                    onChange={(e) => setTargetSector(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer"
                  >
                    {sectorList.map((sec, idx) => (
                      <option key={idx} value={sec.ຂະແໜງ}>{sec.ຂະແໜງ}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຮູບແບບການກວດ (Type)</label>
                  <select
                    value={inspType}
                    onChange={(e) => setInspType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer text-xs font-semibold"
                  >
                    <option value="ກວດປະຈໍາວັນ">ກວດປະຈໍາວັນ (Daily Inspection)</option>
                    <option value="ກວດປະຈໍາອາທິດ">ກວດປະຈໍາອາທິດ (Weekly Inspection)</option>
                    <option value="ສຸມກວດ">ສຸມກວດ (Spot Check)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ວັນທີກວດ (DD/MM/YYYY) *</label>
                  <input
                    id="new-inspection-date-input"
                    type="date"
                    value={inspectionDateInput}
                    onChange={(e) => setInspectionDateInput(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold cursor-pointer"
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-500">
                    ສະແດງໃນລະບົບ/Export: {formatExcelDate(inspectionDateInput)}
                  </p>
                </div>



                <div>
                  <label className="block font-bold text-slate-600 mb-1">ລະບົບທີ່ກວດ (System Category)</label>
                  <select
                    value={selSystem}
                    onChange={(e) => handleSystemChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-bold"
                  >
                    {formSystems.map((sys, idx) => (
                      <option key={idx} value={sys}>{sys}</option>
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
                  <label className="block font-bold text-slate-600 mb-1">{LOCATION_FLOOR_LABEL}</label>
                  <select
                    value={room}
                    onChange={(e) => setRoom(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-medium"
                  >
                    <option value="">-- ເລືອກຊັ້ນອາຄານ --</option>
                    {LOCATION_FLOOR_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
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

                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <label className="block font-bold text-slate-700 text-sm">
                      ພື້ນທີ່/ຈຸດກວດ ( Area / Point) - ສາມາດເລືອກໄດ້ຫຼາຍໝວດພ້ອມກັນ
                    </label>
                    <span className="text-[10.5px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      ເລືອກແລ້ວ {selectedCategories.length} ໝວດ
                    </span>
                  </div>

                  {/* Badges of selected categories */}
                  <div className="flex flex-wrap gap-2 p-2 bg-white rounded-lg border border-slate-200 min-h-[44px] items-center">
                    {selectedCategories.length === 0 ? (
                      <span className="text-xs text-rose-500 font-bold pl-1">⚠️ ຍັງບໍ່ທັນເລືອກພື້ນທີ່/ຈຸດກວດໃດໆ (ກະລຸນາເລືອກຢູ່ດ້ານລຸ່ມ)</span>
                    ) : (
                      selectedCategories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition hover:bg-emerald-100"
                        >
                          <span>📁 {cat}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat)}
                            className="text-rose-500 hover:text-rose-800 focus:outline-none ml-1 text-sm font-black cursor-pointer w-4 h-4 rounded-full hover:bg-rose-100 flex items-center justify-center"
                            title="ລົບໝວດນີ້"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Selection and add category row */}
                  <div className="flex gap-2 items-center flex-col sm:flex-row">
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleAddCategory(val);
                        }
                      }}
                      className="w-full sm:flex-1 border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-bold text-xs h-11"
                    >
                      <option value="">-- ເລືອກ ພື້ນທີ່/ຈຸດກວດ ເພີ່ມເຕີມ --</option>
                      {uniqueCategories.map((cat, idx) => (
                        <option key={idx} value={cat} disabled={selectedCategories.includes(cat)}>
                          {cat} {selectedCategories.includes(cat) ? "(ເລືອກແລ້ວ)" : ""}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          // Quick-add all remaining categories under this system!
                          const remaining = uniqueCategories.filter(cat => !selectedCategories.includes(cat));
                          if (remaining.length > 0) {
                            setSelectedCategories(prev => [...prev, ...remaining]);
                          }
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition h-11 cursor-pointer whitespace-nowrap"
                      >
                        + ເລືອກທັງໝົດ (Select All)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategories([]);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-600 hover:bg-amber-700 border border-amber-500 text-white font-bold text-xs rounded-lg transition h-11 cursor-pointer whitespace-nowrap"
                      >
                        × ລົບທັງໝົດ (Clear All)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 bg-emerald-50/40 p-3 rounded-lg border border-emerald-100/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="block font-bold text-slate-700">ແຍກຟອມກວດກາຄວາມປອດໄພ (Safety Form Type)</span>
                    <span className="text-slate-500 text-[10px]">
                      {currentUser.status === "Admin" 
                        ? "ລະບົບກວດສອບພົບອັດຕະໂນມັດ ຕາມປະເພດສາຂາ ຫຼື ສາມາດປ່ຽນເອງໄດ້" 
                        : "ລະບົບລັອກຟອມອັດຕະໂນມັດຕາມປະເພດສາຂາຂອງທ່ານ (ເພື່ອກວດສອບຄວາມຖືກຕ້ອງ)"}
                    </span>
                  </div>
                  <select
                    value={selectedFormType}
                    disabled={currentUser.status !== "Admin"}
                    onChange={(e) => handleFormTypeChange(e.target.value as any)}
                    className={`border rounded-lg p-2 font-bold min-w-[200px] ${
                      currentUser.status === "Admin" 
                        ? "border-emerald-300 text-emerald-800 cursor-pointer bg-white" 
                        : "border-slate-300 text-slate-500 bg-slate-100 cursor-not-allowed"
                    }`}
                  >
                    {currentUser.status === "Admin" ? (
                      <>
                        <option value="ສຳນັກງານໃຫຍ່">ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>
                        <option value="ສາຂາ">ຟອມ ສາຂາ (Branch)</option>
                        <option value="ໜ່ວຍບໍລິການ">ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>
                        <option value="ຫ້ອງຮັບເງິນ">ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>
                      </>
                    ) : (
                      <>
                        {selectedFormType === "ສຳນັກງານໃຫຍ່" && <option value="ສຳນັກງານໃຫຍ່">ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>}
                        {selectedFormType === "ສາຂາ" && <option value="ສາຂາ">ຟອມ ສາຂາ (Branch)</option>}
                        {selectedFormType === "ໜ່ວຍບໍລິການ" && <option value="ໜ່ວຍບໍລິການ">ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>}
                        {selectedFormType === "ຫ້ອງຮັບເງິນ" && <option value="ຫ້ອງຮັບເງິນ">ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Table implementation for beautiful Checklist */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs font-medium">
                      <thead>
                        <tr className="bg-slate-100 text-slate-705 uppercase font-bold border-b border-slate-200">
                          <th className="p-3">ລາຍການກວດກາ (Inspection Item)</th>
                          <th className="p-3 text-center w-36">ສະຖານະກວດກາ</th>
                          <th className="p-3">ໝາຍເຫດ (Remarks)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedCategories.map((cat, catIdx) => {
                          const catItems = filteredChecklistOptions.filter(item => item.ໝວດລະບົບກວດ === cat);
                          if (catItems.length === 0) return null;

                          return (
                            <React.Fragment key={catIdx}>
                              {/* Group Category Header Row */}
                              <tr className="bg-slate-50/70 border-y border-slate-200">
                                <td colSpan={3} className="px-3 py-2 font-bold text-emerald-800 text-[13px] bg-slate-100">
                                  📂 {cat}
                                </td>
                              </tr>
                              {catItems.map((chk, idx) => {
                                const itemText = chk.ລາຍການກວດ;
                                const ev = evaluations[itemText] || { status: null, note: '' };

                                return (
                                  <tr key={idx} className="hover:bg-rose-50/5 transition-colors">
                                    <td className="p-3 pl-6 font-semibold text-slate-700">{itemText}</td>
                                    <td className="p-3">
                                      <div className="flex justify-center items-center space-x-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEvaluations(prev => ({
                                              ...prev,
                                              [itemText]: { ...ev, status: '✓' }
                                            }));
                                          }}
                                          className={`w-10 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition ${
                                            ev.status === '✓'
                                              ? 'bg-emerald-600 text-white shadow-xs'
                                              : 'bg-slate-100 hover:bg-slate-200 text-slate-650'
                                          }`}
                                        >
                                          ✓
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEvaluations(prev => ({
                                              ...prev,
                                              [itemText]: { ...ev, status: 'X' }
                                            }));
                                          }}
                                          className={`w-10 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition ${
                                            ev.status === 'X'
                                              ? 'bg-rose-600 text-white shadow-xs'
                                              : 'bg-slate-100 hover:bg-slate-200 text-slate-650'
                                          }`}
                                        >
                                          X
                                        </button>
                                      </div>
                                    </td>
                                    <td className="p-3">
                                      <input
                                        type="text"
                                        value={ev.note}
                                        onChange={(e) => {
                                          setEvaluations(prev => ({
                                            ...prev,
                                            [itemText]: { ...ev, note: e.target.value }
                                          }));
                                        }}
                                        placeholder="ໝາຍເຫດເພີ່ມເຕີມ..."
                                        className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800 text-[11px]"
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                        {selectedCategories.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-10 text-rose-500 font-bold bg-rose-50/10">
                              ⚠️ ກະລຸນາເລືອກພື້ນທີ່/ຈຸດກວດຢ່າງໜ້ອຍ 1 ໝວດຢູ່ດ້ານເທິງ ເພື່ອກວດກາລາຍການ
                            </td>
                          </tr>
                        ) : filteredChecklistOptions.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-6 text-slate-400">
                              ບໍ່ມີລາຍການກວດກາໃນພື້ນທີ່/ຈຸດກວດນີ້
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Dynamic Defects Summary Box */}
                {(() => {
                  const defectiveItems = filteredChecklistOptions.filter(chk => evaluations[chk.ລາຍການກວດ]?.status === 'X');
                  const totalDefects = defectiveItems.length;

                  if (totalDefects > 0) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between space-x-4 shrink-0 animate-fadeIn text-xs">
                        <div className="flex items-center space-x-2.5">
                          <AlertTriangle className="h-6 w-6 text-amber-600 animate-bounce shrink-0" />
                          <div>
                            <p className="font-bold text-amber-900 text-[13px]">
                              ສະຫຼຸບຈຸດເປເພ-ຜິດປົກກະຕິ ({totalDefects} ຈຸດ)
                            </p>
                            <p className="text-amber-700 mt-0.5 text-[11px]">
                              ພົບຄວາມຜິດປົກກະຕິຈຳນວນ {totalDefects} ຈຸດ ໃນຕາຕະລາງກວດກາ. ກະລຸນາເພີ່ມຂໍ້ມູນຊັບສິນດ້ານລຸ່ມນີ້ຕາມຕ້ອງການ ເພື່ອອອກໃບແຈ້ງສ້ອມແປງ.
                            </p>
                          </div>
                        </div>
                        <div className="bg-amber-600 text-white font-black px-4 py-2 rounded-full text-lg shadow-sm">
                          {totalDefects}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl flex items-center space-x-2 text-xs">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                        <p className="text-emerald-800 font-medium">
                          ທຸກລາຍການກວດກາຢູ່ໃນສະພາບປົກກະຕິດີທັງໝົດ. ລະບົບຈະບັນທຶກສະຖານະເປັນ <strong>"ປົກກະຕິ"</strong>.
                        </p>
                      </div>
                    );
                  }
                })() /* End of Summary Box */}

                {/* Defect - Incident Form Options (Always accessible if any items are defective) */}
                {(() => {
                  const defectiveItemsList = filteredChecklistOptions.filter(chk => evaluations[chk.ລາຍການກວດ]?.status === 'X');
                  // We show this section if they have checked abnormal items OR if they have manual form entries
                  if (defectiveItemsList.length === 0 && manualIncidentForms.length === 0) return null;

                  return (
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-rose-100 pb-2 gap-2">
                        <h5 className="font-bold text-rose-800 flex items-center text-[11px] sm:text-xs">
                          <AlertTriangle className="h-4 w-4 mr-1.5 text-rose-600 animate-pulse" />
                          ລາຍລະອຽດການແຈ້ງເຫດການ & ຂໍ້ມູນຊັບສິນ ສໍາລັບແຕ່ລະຈຸດເປເພ
                        </h5>
                        <button
                          type="button"
                          onClick={() => handleAddManualIncident()}
                          className="bg-rose-650 hover:bg-rose-750 text-white font-bold py-1.5 px-3 rounded-xl flex items-center justify-center cursor-pointer transition shadow-xs text-[11px] gap-1 shrink-0 self-start sm:self-center"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>➕ ເພີ່ມຊັບສິນເປເພ</span>
                        </button>
                      </div>

                      {manualIncidentForms.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center text-xs text-slate-500 animate-fadeIn">
                          ⚠️ ຍັງບໍ່ມີຂໍ້ມູນຊັບສິນເປເພ. ກະລຸນາຄລິກທີ່ປຸ່ມ <strong>"➕ ເພີ່ມຊັບສິນເປເພ"</strong> ດ້ານເທິງ ເພື່ອປ້ອນລາຍລະອຽດຊັບສິນທີ່ຕ້ອງການແຈ້ງສ້ອມແປງ (ສາມາດເພີ່ມໄດ້ຕາມທີ່ຕ້ອງການ).
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {manualIncidentForms.map((dForm, dIdx) => {
                            const currentMatchedAsset = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (dForm.assetCode || '').toLowerCase().trim());
                            const dePointsList = filteredChecklistOptions.filter(chk => evaluations[chk.ລາຍການກວດ]?.status === 'X');
                            const otherSelectedPoints = manualIncidentForms
                              .filter(f => f.id !== dForm.id)
                              .map(f => f.selectedChecklistPoint)
                              .filter(Boolean);
                            const inspectionAssetNameOptions = getInspectionAssetNameOptions(incidents, dForm.assetCategory, dForm.assetGroup);

                            return (
                              <div key={dForm.id} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3.5 relative shadow-xs animate-fadeIn">
                                <div className="flex items-center justify-between border-b pb-1.5 border-rose-200">
                                  <span className="font-bold text-rose-900 text-xs flex items-center">
                                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] mr-2">
                                      {dIdx + 1}
                                    </span>
                                    ລາຍການຊັບສິນເປເພລາຍການທີ {dIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveManualIncident(dForm.id)}
                                    className="p-1 px-2 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 font-bold flex items-center gap-1 cursor-pointer transition text-[9px] sm:text-[10px]"
                                  >
                                    <X className="h-3 w-3 shrink-0" />
                                    <span>ລຶບລາຍການນີ້</span>
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-700">
                                  <div className="sm:col-span-2">
                                    <div className="bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                                        🔍 ປະເພດຈຸດເປເພ (Defect Type):
                                      </span>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateManualIncident(dForm.id, 'hasAsset', 'yes')}
                                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                                            dForm.hasAsset !== 'no'
                                              ? 'bg-indigo-600 border-indigo-650 text-white shadow-xs'
                                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                          }`}
                                        >
                                          📦 ມີຊັບສິນ (Has Asset Ref)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateManualIncident(dForm.id, 'hasAsset', 'no')}
                                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                                            dForm.hasAsset === 'no'
                                              ? 'bg-amber-600 border-amber-650 text-white shadow-xs'
                                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                          }`}
                                        >
                                          📝 ບໍ່ມີຊັບສິນ / ແຈ້ງເປັນ Case
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="sm:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                                      📍 ຈຸດກວດກາທີ່ພົບບັນຫາ (Referenced Checkpoint) *
                                    </label>
                                    {dePointsList.length > 1 ? (
                                      <select
                                        value={dForm.selectedChecklistPoint}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handleManualCheckpointChange(dForm.id, val);
                                        }}
                                        className="w-full border border-rose-300 rounded-lg p-2 bg-white text-rose-900 font-bold focus:ring-1 focus:ring-rose-500 text-[11px] cursor-pointer"
                                      >
                                        <option value="">-- ກະລຸນາເລືອກຈຸດກວດກາທີ່ພົບຄວາມເສຍຫາຍ --</option>
                                        {dePointsList.map((pt, pIdx) => {
                                          const isSelectedElsewhere = otherSelectedPoints.includes(pt.ລາຍການກວດ);
                                          return (
                                            <option key={pIdx} value={pt.ລາຍການກວດ} disabled={isSelectedElsewhere}>
                                              ⚠️ [{pt.ໝວດລະບົບກວດ}] {pt.ລາຍການກວດ} {isSelectedElsewhere ? ' (ເລືອກແລ້ວໃນລາຍການອື່ນ)' : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    ) : dePointsList.length === 1 ? (
                                      <div className="w-full border border-rose-200 bg-rose-50 text-rose-950 rounded-lg p-2.5 font-bold text-[11px] flex items-center justify-between">
                                        <span>⚙️ [{dePointsList[0].ໝວດລະບົບກວດ}] {dePointsList[0].ລາຍການກວດ}</span>
                                        <span className="text-[9px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-full uppercase">
                                          Auto
                                        </span>
                                      </div>
                                    ) : (
                                      <select
                                        value={dForm.selectedChecklistPoint}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handleManualCheckpointChange(dForm.id, val);
                                        }}
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 text-[11px] cursor-pointer"
                                      >
                                        <option value="">-- ເລືອກຈຸດກວດກາ --</option>
                                        {filteredChecklistOptions.map((pt, pIdx) => {
                                          const isSelectedElsewhere = otherSelectedPoints.includes(pt.ລາຍການກວດ);
                                          return (
                                            <option key={pIdx} value={pt.ລາຍການກວດ} disabled={isSelectedElsewhere}>
                                              [{pt.ໝວດລະບົບກວດ}] {pt.ລາຍການກວດ} {isSelectedElsewhere ? ' (ເລືອກແລ້ວໃນລາຍການອື່ນ)' : ''}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    )}
                                  </div>

                                  {dForm.hasAsset !== 'no' ? (
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="block font-bold text-slate-700 text-[11px]">
                                          ລະຫັດຊັບສິນ (Asset Code) *
                                        </label>
                                        {dForm.assetCode.trim() && (
                                          currentMatchedAsset ? (
                                            <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded-full border border-emerald-100">
                                              🟢 ພົບຊັບສິນເດີ່ມ ({currentMatchedAsset.ລາຍການ})
                                            </span>
                                          ) : (
                                            <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded-full border border-amber-100">
                                              ⚙️ ລະຫັດຊັບສິນໃໝ່
                                            </span>
                                          )
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <input
                                          type="text"
                                          value={dForm.assetCode}
                                          onChange={(e) => handleManualAssetCodeChange(dForm.id, e.target.value)}
                                          placeholder="ຕົວຢ່າງ: LDB-CCTV-004..."
                                          className="font-mono flex-1 border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[11px] focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => setScannerConfig({
                                            isOpen: true,
                                            onScan: (scannedVal) => handleManualAssetCodeChange(dForm.id, scannedVal)
                                          })}
                                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 px-3 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 text-[11px]"
                                          title="ສະແກນ Barcode"
                                        >
                                          <Scan className="h-4 w-4 shrink-0" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="block font-bold text-slate-400 text-[11px] mb-1">
                                        ລະຫັດຊັບສິນ (Asset Code)
                                      </label>
                                      <input
                                        type="text"
                                        value="ບໍ່ມີຊັບສິນ (ແຈ້ງເປັນ Case ທົ່ວໄປ)"
                                        disabled
                                        className="w-full border border-slate-200 rounded-lg p-2 bg-slate-100 text-slate-400 text-[11px] font-medium"
                                      />
                                    </div>
                                  )}

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ພາກສ່ວນຊັບສົມບັດ (Asset Group) *</label>
                                    <select
                                      value={dForm.assetCategory}
                                      onChange={(e) => handleUpdateManualIncident(dForm.id, 'assetCategory', e.target.value)}
                                      disabled={dForm.hasAsset === 'no'}
                                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                      {dForm.hasAsset === 'no' ? (
                                        <option value="none">none</option>
                                      ) : (
                                        ASSET_CATEGORIES.map((cat, idx) => (
                                          <option key={idx} value={cat.ພາກສ່ວນ}>{cat.ພາກສ່ວນ}</option>
                                        ))
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ໜວດລາຍການຊັບສິນ (Asset Category) *</label>
                                    {dForm.hasAsset !== 'no' && dForm.isAddingAssetGroup ? (
                                      <input
                                        data-incident-master-input="inspection-asset-category"
                                        type="text"
                                        value={dForm.newAssetGroup || ''}
                                        onChange={(e) => handleUpdateManualIncident(dForm.id, 'newAssetGroup', e.target.value)}
                                        onBlur={(e) => {
                                          if (e.currentTarget.dataset.cancelled !== 'true') {
                                            acceptInspectionAssetMasterValue(dForm.id, 'assetGroup', e.currentTarget.value);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            acceptInspectionAssetMasterValue(dForm.id, 'assetGroup', e.currentTarget.value);
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            e.currentTarget.dataset.cancelled = 'true';
                                            cancelInspectionAssetMasterValue(dForm.id, 'assetGroup');
                                          }
                                        }}
                                        autoFocus
                                        placeholder="ປ້ອນໝວດລາຍການຊັບສິນໃໝ່"
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                                      />
                                    ) : (
                                      <select
                                        data-incident-master="inspection-asset-category"
                                        value={dForm.hasAsset === 'no' ? 'none' : dForm.assetGroup}
                                        onChange={(e) => selectInspectionAssetCategory(dForm.id, e.target.value)}
                                        disabled={dForm.hasAsset === 'no'}
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                      >
                                        {dForm.hasAsset === 'no' ? (
                                          <option value="none">none</option>
                                        ) : (
                                          <>
                                            <option value="">-- ເລືອກໝວດລາຍການ --</option>
                                            {inspectionAssetItemTypeOptions.map(option => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                            {!isReservedIncidentAssetMasterValue(dForm.assetGroup)
                                              && !inspectionAssetItemTypeOptions.includes(dForm.assetGroup) && (
                                              <option value={dForm.assetGroup}>{dForm.assetGroup}</option>
                                            )}
                                            <option value={INCIDENT_ASSET_ADD_NEW_SENTINEL}>+ ເພີ່ມໝວດລາຍການໃໝ່</option>
                                          </>
                                        )}
                                      </select>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຊື່ລາຍການຊັບສິນ (Asset Name) *</label>
                                    {dForm.hasAsset !== 'no' && dForm.isAddingAssetName ? (
                                      <input
                                        data-incident-master-input="inspection-asset-name"
                                        type="text"
                                        value={dForm.newAssetName || ''}
                                        onChange={(e) => handleUpdateManualIncident(dForm.id, 'newAssetName', e.target.value)}
                                        onBlur={(e) => {
                                          if (e.currentTarget.dataset.cancelled !== 'true') {
                                            acceptInspectionAssetMasterValue(dForm.id, 'assetName', e.currentTarget.value);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            acceptInspectionAssetMasterValue(dForm.id, 'assetName', e.currentTarget.value);
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            e.currentTarget.dataset.cancelled = 'true';
                                            cancelInspectionAssetMasterValue(dForm.id, 'assetName');
                                          }
                                        }}
                                        autoFocus
                                        placeholder="ປ້ອນຊື່ລາຍການຊັບສິນໃໝ່"
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800"
                                      />
                                    ) : (
                                      <select
                                        data-incident-master="inspection-asset-name"
                                        value={dForm.hasAsset === 'no' ? 'none' : dForm.assetName}
                                        onChange={(e) => selectInspectionAssetName(dForm.id, e.target.value)}
                                        disabled={dForm.hasAsset === 'no'}
                                        className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                      >
                                        {dForm.hasAsset === 'no' ? (
                                          <option value="none">none</option>
                                        ) : (
                                          <>
                                            <option value="">-- ເລືອກລາຍການ --</option>
                                            {inspectionAssetNameOptions.map(option => (
                                              <option key={option} value={option}>{option}</option>
                                            ))}
                                            {!isReservedIncidentAssetMasterValue(dForm.assetName)
                                              && !inspectionAssetNameOptions.includes(dForm.assetName) && (
                                              <option value={dForm.assetName}>{dForm.assetName}</option>
                                            )}
                                            <option value={INCIDENT_ASSET_ADD_NEW_SENTINEL}>+ ເພີ່ມລາຍການໃໝ່</option>
                                          </>
                                        )}
                                      </select>
                                    )}
                                  </div>

                                  <div className="sm:col-span-2 mt-2 pt-2 border-t border-slate-200">
                                    <h6 className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                                      🏢 ຝ່າຍ/ໜ່ວຍງານ ຫຼື ສາຂາ ທີ່ເປັນຜູ້ໃຊ້/ດູແດຊັບສິນ (Asset Owner/Custodian)
                                    </h6>
                                  </div>

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ສາຂາຂອງຊັບສິນ</label>
                                    <select
                                      value={dForm.assetBranch || targetBranch}
                                      onChange={(e) => {
                                        const br = e.target.value;
                                        handleUpdateManualIncident(dForm.id, 'assetBranch', br);
                                        const firstUnit = BRANCHES.find(b => b.ສາຂາ === br);
                                        handleUpdateManualIncident(dForm.id, 'assetUnit', firstUnit ? (firstUnit["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || br) : br);
                                      }}
                                      disabled={dForm.hasAsset === 'no'}
                                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                      {dForm.hasAsset === 'no' ? (
                                        <option value="none">none</option>
                                      ) : (
                                        Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map((br, idx) => {
                                          const cleanBr = String(br || '').trim();
                                          return (
                                            <option key={idx} value={cleanBr}>{cleanBr}</option>
                                          );
                                        })
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຝ່າຍ/ໜ່ວຍບໍລິການຂອງຊັບສິນ</label>
                                    <select
                                      value={dForm.assetUnit || targetUnit}
                                      onChange={(e) => handleUpdateManualIncident(dForm.id, 'assetUnit', e.target.value)}
                                      disabled={dForm.hasAsset === 'no'}
                                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                      {dForm.hasAsset === 'no' ? (
                                        <option value="none">none</option>
                                      ) : (
                                        BRANCHES.filter(b => b.ສາຂາ === (dForm.assetBranch || targetBranch)).map((b, idx) => {
                                          const unitVal = b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ;
                                          return (
                                            <option key={idx} value={unitVal}>
                                              {unitVal}
                                            </option>
                                          );
                                        })
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຂະແໜງຂອງຊັບສິນ</label>
                                    <select
                                      value={dForm.assetSector || targetSector}
                                      onChange={(e) => handleUpdateManualIncident(dForm.id, 'assetSector', e.target.value)}
                                      disabled={dForm.hasAsset === 'no'}
                                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                    >
                                      {dForm.hasAsset === 'no' ? (
                                        <option value="none">none</option>
                                      ) : (
                                        sectorList.map((sec, idx) => (
                                          <option key={idx} value={sec.ຂະແໜງ}>{sec.ຂະແໜງ}</option>
                                        ))
                                      )}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block font-bold text-slate-700 mb-1 text-[11px]">ປະເມີນຜົນກະທົບ (Impact Level)</label>
                                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                                      {['ຕ່ຳ', 'ປານກາງ', 'ສູງ'].map((lvl) => {
                                        const labelEmoji = lvl === 'ຕ່ຳ' ? '🔵' : lvl === 'ປານກາງ' ? '🟡' : '🔴';
                                        const labelText = lvl === 'ຕ່ຳ' ? 'ຕ່ຳ (Low)' : lvl === 'ປານກາງ' ? 'ປານກາງ (Medium)' : 'ສູງ (High)';
                                        const isSelected = dForm.impact === lvl;

                                        let classes = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300';
                                        if (isSelected) {
                                          if (lvl === 'ຕ່ຳ') classes = 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500/20 shadow-sm';
                                          if (lvl === 'ປານກາງ') classes = 'bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500/20 shadow-sm';
                                          if (lvl === 'ສູງ') classes = 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500/20 shadow-sm scale-[1.01]';
                                        }

                                        return (
                                          <button
                                            key={lvl}
                                            type="button"
                                            onClick={() => handleUpdateManualIncident(dForm.id, 'impact', lvl)}
                                            className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-center transition-all duration-200 cursor-pointer ${classes}`}
                                          >
                                            <span className="text-[11px] mb-0.5">{labelEmoji}</span>
                                            <span className="font-bold text-[8.5px] whitespace-nowrap">{labelText}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                   <div className="sm:col-span-2">
                                     <label className="block font-bold text-slate-700 mb-1 text-[11px]">ລາຍລະອຽດບັນຫາທີ່ພົບ *</label>
                                     <textarea
                                       value={dForm.problem}
                                       onChange={(e) => handleUpdateManualIncident(dForm.id, 'problem', e.target.value)}
                                       placeholder="ກະລຸນາປ້ອນລາຍລະອຽດຄວາມເສຍຫາຍຂອງອຸປະກອນ ຫຼື ຈຸດທີ່ບໍ່ປອດໄພ..."
                                       className="w-full border border-slate-300 rounded-lg p-2 bg-white h-16 text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                     ></textarea>
                                   </div>

                                   <div className="sm:col-span-2">
                                     <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຂໍ້ສະເໜີແນະວິທີແກ້ໄຂ / ປັບປຸງເບື້ອງຕົ້ນ</label>
                                     <input
                                       type="text"
                                       value={dForm.solution}
                                       onChange={(e) => handleUpdateManualIncident(dForm.id, 'solution', e.target.value)}
                                       placeholder="ຕົວຢ່າງ: ປ່ຽນເຄື່ອງໃຫມ່, ຈ້າງຊ່າງມາສ້ອມແປງ..."
                                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 font-bold text-slate-500 cursor-pointer"
                >
                  ຍົກເລີກ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 font-bold shadow-xs transition flex items-center cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5 text-amber-400" />
                  ບັນທຶກຂໍ້ມູນ (Save Audit)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Link Incident Form (for registering incident to an existing abnormal record) */}
      {isLinkIncidentOpen && linkInsp && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeInByScale">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-150 max-w-lg w-full flex flex-col">
            {/* Header */}
            <div className="bg-amber-500 text-white p-4 rounded-t-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-white animate-bounce" />
                <h4 className="font-bold text-sm sm:text-base">
                  ແຈ້ງເຫດການ: {linkInsp.ລະຫັດກວດກາ}
                </h4>
              </div>
              <button 
                onClick={() => {
                  setIsLinkIncidentOpen(false);
                  setLinkInsp(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveLinkedIncident} className="p-5 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                <p className="font-bold text-amber-900 text-[11px] flex items-center">
                  <Info className="h-4 w-4 mr-1 shrink-0" /> Link inspection details
                </p>
                <div className="text-[10px] text-amber-800 grid grid-cols-2 gap-x-2 font-medium">
                  <div><strong>ສາຂາ:</strong> {linkInsp["ສາຂາ "]}</div>
                  <div><strong>ລະບົບກວດ:</strong> {linkInsp.ລະບົບທີ່ກວດ}</div>
                  <div><strong>ໝວດຍ່ອຍ:</strong> {linkInsp.ໝວດລະບົບກວດ}</div>
                  <div><strong>ລາຍການ:</strong> {linkInsp.ລາຍການກວດ.substring(0, 35)}...</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <div className="bg-slate-105 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                      🔍 ປະເພດຈຸດເປເພ (Defect Type):
                    </span>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setLinkHasAsset('yes');
                          setAssetCategory((ASSET_CATEGORIES[0] as any)["ພាកສ່ວນ"] || 'ພាកສ່ວນເຄື່ອງຈັກຮັບໃຊ້ຫ້ອງການ');
                          setAssetGroup(linkInsp.ໝວດລະບົບກວດ || '');
                          setAssetName('');
                          setAssetCode('');
                        }}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                          linkHasAsset !== 'no'
                            ? 'bg-indigo-600 border-indigo-650 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📦 ມີຊັບສິນ (Has Asset Ref)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLinkHasAsset('no');
                          setAssetCategory('none');
                          setAssetGroup('none');
                          setAssetName('none');
                          setAssetCode('');
                        }}
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                          linkHasAsset === 'no'
                            ? 'bg-amber-600 border-amber-650 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        📝 ບໍ່ມີຊັບສິນ / ແຈ້ງເປັນ Case
                      </button>
                    </div>
                  </div>
                </div>

                {linkHasAsset !== 'no' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-slate-650">ລະຫັດຊັບສິນ (Asset Code) *</label>
                      {(assetCode || '').trim() && (
                        (() => {
                          const m = uniqueAssets.find(a => (a.ລະຫັດຊັບສິນ || '').toLowerCase() === (assetCode || '').toLowerCase().trim());
                          return m ? (
                            <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded-full border border-emerald-100">
                              🟢 ພົບຊັບສິນເດີ່ມ ({m.ລາຍການ})
                            </span>
                          ) : (
                            <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded-full border border-amber-100">
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
                        placeholder="ຕົວຢ່າງ: LDB-CCTV-004, 7456454..."
                        className="font-mono flex-1 border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 text-[11px] focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setScannerConfig({
                          isOpen: true,
                          onScan: (scannedCode) => handleAssetCodeChange(scannedCode)
                        })}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 px-3 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 text-[11px]"
                        title="ສະແກນ Barcode"
                      >
                        <Scan className="h-4 w-4 shrink-0" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block font-bold text-slate-400 mb-1">ລະຫັດຊັບສິນ (Asset Code)</label>
                    <input
                      type="text"
                      value="ບໍ່ມີຊັບສິນ (ແຈ້ງເປັນ Case ທົ່ວໄປ)"
                      disabled
                      className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-100 text-slate-400 text-[11px] font-medium"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-650 mb-1">ພາກສ່ວນຊັບສົມບັດ (Asset Group) *</label>
                  <select
                    value={assetCategory}
                    onChange={(e) => setAssetCategory(e.target.value)}
                    disabled={linkHasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {linkHasAsset === 'no' ? (
                      <option value="none">none</option>
                    ) : (
                      ASSET_CATEGORIES.map((cat, idx) => (
                        <option key={idx} value={cat.ພາກສ່ວນ}>{cat.ພາກສ່ວນ}</option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-650 mb-1">ໜວດລາຍການຊັບສິນ (Asset Category) *</label>
                  <input
                    type="text"
                    value={assetGroup}
                    onChange={(e) => setAssetGroup(e.target.value)}
                    placeholder="ຕົວຢ່າງ: NOTEBOOK, CCTV, ຖັງດັບເພີ, ແອ..."
                    disabled={linkHasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-650 mb-1">ຊື່ລາຍການຊັບສິນ (Asset Name) *</label>
                  <input
                    type="text"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    placeholder="ຕົວຢ່າງ: LG Air Condition, Dell Laptop"
                    disabled={linkHasAsset === 'no'}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-655 mb-1">ປະເມີນຜົນກະທົບ (Impact Level)</label>
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
                          ? 'bg-red-50 border-red-505 text-red-700 ring-2 ring-red-500/20 shadow-sm scale-[1.01]'
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
                  <label className="block font-bold text-slate-655 mb-1">ລາຍລະອຽດຄວາມເສຍຫາຍ/ບັນຫາທີ່ພົບ *</label>
                  <textarea
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="ກະລຸນາປ້ອນລາຍລະອຽດຄວາມເສຍຫາຍ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white h-20 text-slate-800"
                    required
                  ></textarea>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-655 mb-1 font-sans">ຂໍ້ສະເໜີແນະວິທີແກ້ໄຂ / ປັບປຸງເບື້ອງຕົ້ນ</label>
                  <input
                    type="text"
                    value={proposedSolution}
                    onChange={(e) => setProposedSolution(e.target.value)}
                    placeholder="ຕົວຢ່າງ: ປ່ຽນເຄື່ອງໃຫມ່, ຈ້າງຊ່າງມາສ້ອມແປງ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsLinkIncidentOpen(false);
                    setLinkInsp(null);
                  }}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 font-bold text-slate-500 cursor-pointer"
                >
                  ຍົກເລີກ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold shadow transition flex items-center cursor-pointer"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  ບັນທຶກເຫດການ (Link Incident)
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
                    onChange={(e) => setScannerSearch(e.target.value)}
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

      {/* Modal: Inspection Details */}
      {isDetailOpen && selectedInspection && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-150 max-w-2xl w-full flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-slate-900 text-white p-4 rounded-t-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-emerald-400 animate-pulse" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    ລາຍລະອຽດການກວດກາ (Inspection Details)
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                    ID: {selectedInspection.ລະຫັດກວດກາ}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              {/* Quick Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Meta block 1 */}
                <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-150/60 space-y-2">
                  <div className="flex items-center text-slate-600 font-bold gap-1.5 border-b border-slate-150 pb-2 mb-2">
                    <Building2 className="h-4 w-4 text-emerald-605" />
                    <span>ສາຂາ & ພາກສ່ວນ (Branch)</span>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">ສາຂາ (Branch):</span>{" "}
                    <strong className="text-slate-800">{selectedInspection["ສາຂາ "]}</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">ຝ່າຍ/ໜ່ວຍບໍລິການ (Unit):</span>{" "}
                    <strong className="text-slate-800">{selectedInspection["ຝ່າຍ/ໜ່ວຍບໍລິການ"]}</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium font-lao">ຂະແໜງ / ພາກສ່ວນ:</span>{" "}
                    <strong className="text-slate-800">{selectedInspection.ຂະແໜງ || "-"}</strong>
                  </div>
                  {false ? (
                    <div>
                      <span className="text-slate-450 font-medium">ຊັ້ນອາຄານ (Floor):</span>{" "}
                      <strong className="text-slate-800">ຊັ້ນ {selectedInspection.ຊັ້ນອາຄານ}</strong>
                    </div>
                  ) : null}
                  {selectedInspection.ສະຖານທີ ? (
                    <div>
                      <span className="text-slate-450 font-medium">ສະຖານທີ່:</span>{" "}
                      <strong className="text-slate-800">{selectedInspection.ສະຖານທີ}</strong>
                    </div>
                  ) : null}
                </div>

                {/* Meta block 2 */}
                <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-150/60 space-y-2">
                  <div className="flex items-center text-slate-600 font-bold gap-1.5 border-b border-slate-150 pb-2 mb-2">
                    <Calendar className="h-4 w-4 text-emerald-605" />
                    <span>ຂໍ້ມູນທົ່ວໄປ (General Info)</span>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">ວັນ-ເວລາກວດ (Date & Time):</span>{" "}
                    <strong className="text-slate-800">
                      {formatExcelDate(selectedInspection.ວັນທີ່ກວດ)} {cleanString(selectedInspection.ເວລາກວດ)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">ຮູບແບບການກວດ (Type):</span>{" "}
                    <span className="bg-emerald-50 text-emerald-800 font-bold border border-emerald-100 px-2 py-0.5 rounded ml-1 text-[10px]">
                      {selectedInspection.ຮູບແບບການກວດ || "ກວດປະຈໍາວັນ"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">ລະບົບທີ່ກວດ (System Category):</span>{" "}
                    <strong className="text-slate-800">{selectedInspection.ລະບົບທີ່ກວດ}</strong>
                  </div>
                  <div>
                    <span className="text-slate-450 font-medium">ພື້ນທີ່/ຈຸດກວດ ( Area / Point):</span>{" "}
                    <strong className="text-slate-800">{selectedInspection.ໝວດລະບົບກວດ}</strong>
                  </div>
                  <div className="flex items-center gap-1 pt-1">
                    <span className="text-slate-450 font-medium">ຜູ້ກວດກາ:</span>{" "}
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-0.5 shadow-2xs">
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      {selectedInspection.ຊື່ຜູ້ກວດ}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status block */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-150/60 p-4 rounded-xl">
                <div>
                  <span className="text-slate-450 block mb-1 font-semibold">ສະຖານະການກວດລວມ (Inspection Status)</span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                    selectedInspection.ສະຖານະ === "ປົກກະຕີ" 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                      : 'bg-red-50 text-red-650 border border-red-100'
                  }`}>
                    {selectedInspection.ສະຖານະ === "ປົກກະຕີ" ? (
                      <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-605" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 mr-1.5 text-red-500" />
                    )}
                    {selectedInspection.ສະຖານະ === "ປົກກະຕີ" ? "ປົກກະຕີ (Normal)" : "ຜິດປົກກະຕິ (Abnormal)"}
                  </span>
                </div>
                {selectedInspection.ຈຳນວນເຫດການທີ່ພົບ > 0 && (
                  <div className="text-right">
                    <span className="text-slate-450 block mb-1 font-semibold">ເຫດການທີ່ພົບ (Incidents)</span>
                    <span className="inline-flex items-center bg-red-50 text-red-600 font-bold border border-red-100 px-2.5 py-1 rounded-lg text-xs">
                      ⚠️ {selectedInspection.ຈຳນວນເຫດການທີ່ພົບ} ລາຍການ (Defects)
                    </span>
                  </div>
                )}
              </div>

              {/* Checklist evaluations */}
              <div className="space-y-2">
                <span className="text-slate-650 font-bold block px-1 text-xs sm:text-[13px]">
                  ລາຍການກວດກາ ແລະ ຜົນການປະເມີນ (Evaluated Items)
                </span>
                <div className="border border-slate-150 rounded-xl overflow-hidden max-h-[220px] overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
                  {(() => {
                    const rawStr = selectedInspection.ລາຍການກວດ || "";
                    // Regex helper to split checking for custom spaces between commas
                    const parts = rawStr.split(/(?:\s+,\s+|\s*,\s*| , )/g).map(p => p.trim()).filter(Boolean);
                    const parsedItems = parts.map(part => {
                      const isAbnormal = part.includes('❌') || part.includes('ຜິດປົກກະຕິ') || part.includes('异常') || part.includes('X') || part.includes('abnormal');
                      let cleanText = part;
                      let statusText = isAbnormal ? 'ຜິດປົກກະຕິ' : 'ປົກກະຕິ';
                      let noteText = '';
                      
                      const bracketMatch = part.match(/\(([^)]+)\)$/);
                      if (bracketMatch) {
                        const inside = bracketMatch[1];
                        cleanText = part.replace(/\s*\([^)]+\)$/, '').trim();
                        const dashIdx = inside.indexOf(' - ');
                        if (dashIdx !== -1) {
                          noteText = inside.substring(dashIdx + 3).trim();
                        }
                      }
                      return {
                        text: cleanText,
                        isAbnormal,
                        status: statusText,
                        note: noteText
                      };
                    });

                    return parsedItems.map((item, idx) => (
                      <div key={idx} className="p-3.5 flex items-start gap-3 hover:bg-white transition-colors">
                        <span className="shrink-0 mt-0.5">
                          {item.isAbnormal ? (
                            <span className="text-red-500 font-bold">❌</span>
                          ) : (
                            <span className="text-emerald-500 font-bold">✅</span>
                          )}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold text-xs ${item.isAbnormal ? 'text-red-650' : 'text-slate-800'}`}>
                            {item.text}
                          </p>
                          {item.note && (
                            <div className="mt-1.5 bg-amber-50 text-amber-850 border border-amber-100/70 rounded-lg p-2 text-[10px] font-semibold inline-block shadow-2xs">
                              📝 ໝາຍເຫດ: {item.note}
                            </div>
                          )}
                        </div>
                        <span className={`text-[10px] font-bold shrink-0 px-2 py-0.5 rounded-full ${
                          item.isAbnormal 
                            ? 'bg-red-50 text-red-600 border border-red-100' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    ));
                  })()}
                  {!selectedInspection.ລາຍການກວດ && (
                    <p className="text-center py-6 text-slate-400 italic">ບໍ່ມີຂໍ້ມູນລາຍການກວດໃນລະບົບ</p>
                  )}
                </div>
              </div>

              {/* Linked Actionable Incidents in database */}
              {(() => {
                const linked = incidents.filter(inc => inc.ລະຫັດກວດກາ === selectedInspection.ລະຫັດກວດກາ || inc.PID === selectedInspection.PID);
                if (linked.length === 0) return null;
                return (
                  <div className="space-y-2.5 pt-1">
                    <span className="text-slate-650 font-bold block px-1 text-xs sm:text-[13px]">
                      ລາຍການແຈ້ງເຫດການທີ່ກ່ຽວຂ້ອງ (Linked Incidents)
                    </span>
                    <div className="space-y-3">
                      {linked.map((inc, idx) => (
                        <div key={idx} className="border border-slate-150 p-4 rounded-xl bg-orange-50/5/10 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-orange-100/50 pb-2">
                            <span className="font-mono font-bold text-slate-800 text-[10px] sm:text-[11px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                              🏷️ ລະຫັດຊັບສິນ: {inc.ລະຫັດຊັບສິນ}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              inc.ສະຖານະ.includes("ອະນຸມັດ") || inc.ສະຖານະ.includes("ສຳເລັດ")
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
                            }`}>
                              {inc.ສະຖານະ}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                            <div>ໜວດລາຍການຊັບສິນ: <strong className="text-slate-700">{inc.ໝວດລາຍການ}</strong></div>
                            <div>ຊື່ຊັບສິນ: <strong className="text-slate-700">{inc.ລາຍການ}</strong></div>
                          </div>
                          <p className="text-xs text-slate-800 mt-1">
                            <span className="font-bold text-red-650">🔴 ບັນຫາທີ່ພົບ:</span> {inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}
                          </p>
                          <p className="text-xs text-emerald-700">
                            <span className="font-bold text-slate-500">🟢 ວິທີແກ້ໄຂ:</span> {inc.ວີທີແກ້ໄຂ || "ກຳລັງປະເມີນ / ລໍຖ້າແກ້ໄຂ"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-150 p-4 rounded-b-2xl flex justify-end">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer text-xs"
              >
                ປິດໜ້າຕ່າງ (Close Detail)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Inspection Form */}
      {isEditOpen && editingInspection && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn select-none">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-150 max-w-2xl w-full flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-emerald-800 text-white p-4 rounded-t-2xl flex items-center justify-between shadow-xs">
              <div className="flex items-center space-x-2">
                <Edit className="h-5 w-5 text-amber-400 animate-pulse" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base text-white">
                    ແກ້ໄຂຂໍ້ມູນການກວດກາ (Edit Inspection Record)
                  </h4>
                  <p className="text-[10px] text-emerald-100 font-mono mt-0.5">
                    ID : {editingInspection.ລະຫັດກວດກາ}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingInspection(null);
                }}
                className="p-1.5 hover:bg-emerald-700 rounded-lg text-white/85 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveEdit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700">
              {/* Date, Time, Branch, and Scope Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                {/* Date & Time (Crucial for editing existing records) */}
                <div>
                  <label className="block font-bold text-slate-600 mb-1">ວັນທີ່ກວດ (Date)</label>
                  <input
                    id="edit-inspection-date-input"
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ເວລາກວດ (Time)</label>
                  <input
                    type="text"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    placeholder="HH:MM"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສາຂາ (Branch)</label>
                  <select
                    value={editBranch}
                    onChange={(e) => {
                      setEditBranch(e.target.value);
                      setEditUnit(e.target.value);
                    }}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium cursor-pointer"
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
                  <label className="block font-bold text-slate-600 mb-1">ໜ່ວຍບໍລິການ / ຝ່າຍຍ່ອຍ</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer"
                  >
                    {BRANCHES.filter(b => b.ສາຂາ === editBranch).map((b, idx) => {
                      const unitVal = b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ;
                      return (
                        <option key={idx} value={unitVal}>
                          {unitVal}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຂະແໜງ (Sector)</label>
                  <select
                    value={editSector}
                    onChange={(e) => setEditSector(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer"
                  >
                    {sectorList.map((sec, idx) => (
                      <option key={idx} value={sec.ຂະແໜງ}>{sec.ຂະແໜງ}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຮູບແບບການກວດ (Type)</label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer text-xs font-semibold"
                  >
                    <option value="ກວດປະຈໍາວັນ">ກວດປະຈໍາວັນ (Daily Inspection)</option>
                    <option value="ກວດປະຈໍາອາທິດ">ກວດປະຈໍາອາທິດ (Weekly Inspection)</option>
                    <option value="ສຸມກວດ">ສຸມກວດ (Spot Check)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ລະບົບທີ່ກວດ (System Category)</label>
                  <select
                    value={editSystem}
                    onChange={(e) => handleEditSystemChange(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-bold"
                  >
                    {editFormSystems.map((sys, idx) => (
                      <option key={idx} value={sys}>{sys}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ຊື່ຜູ້ກວດ (Inspector Name)</label>
                  <input
                    type="text"
                    value={editInspector}
                    onChange={(e) => setEditInspector(e.target.value)}
                    placeholder="ລະບຸຊື່ຜູ້ກວດກາ"
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 font-medium"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">{LOCATION_FLOOR_LABEL}</label>
                  <select
                    value={editRoom}
                    onChange={(e) => setEditRoom(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-medium"
                  >
                    <option value="">-- ເລືອກຊັ້ນອາຄານ --</option>
                    {LOCATION_FLOOR_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-600 mb-1">ສະຖານະຂອງຜູ້ກວດ (Inspector Type)</label>
                  <select
                    value={editInspectorStatus}
                    onChange={(e) => setEditInspectorStatus(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-medium"
                  >
                    <option value="ພະນັກງານ ທພລ">ພະນັກງານ ທພລ (LDB Staff)</option>
                    <option value="ພາຍນອກ">ພາຍນອກ (External)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-1">
                    <label className="block font-bold text-slate-700 text-sm">
                      ພື້ນທີ່/ຈຸດກວດ ( Area / Point) - ສາມາດເລືອກໄດ້ຫຼາຍໝວດພ້ອມກັນ
                    </label>
                    <span className="text-[10.5px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                      ເລືອກແລ້ວ {editSelectedCategories.length} ໝວດ
                    </span>
                  </div>

                  {/* Badges of selected categories */}
                  <div className="flex flex-wrap gap-2 p-2 bg-white rounded-lg border border-slate-200 min-h-[44px] items-center">
                    {editSelectedCategories.length === 0 ? (
                      <span className="text-xs text-rose-500 font-bold pl-1">⚠️ ຍັງບໍ່ທັນເລືອກພື້ນທີ່/ຈຸດກວດໃດໆ (ກະລຸນາເລືອກຢູ່ດ້ານລຸ່ມ)</span>
                    ) : (
                      editSelectedCategories.map((cat) => (
                        <span
                          key={cat}
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-lg transition hover:bg-emerald-100"
                        >
                          <span>📁 {cat}</span>
                          <button
                            type="button"
                            onClick={() => handleEditRemoveCategory(cat)}
                            className="text-rose-500 hover:text-rose-800 focus:outline-none ml-1 text-sm font-black cursor-pointer w-4 h-4 rounded-full hover:bg-rose-100 flex items-center justify-center font-sans"
                            title="ລົບໝວດນີ້"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </div>

                  {/* Selection and add category row */}
                  <div className="flex gap-2 items-center flex-col sm:flex-row">
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          handleEditAddCategory(val);
                        }
                      }}
                      className="w-full sm:flex-1 border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800 cursor-pointer font-bold text-xs h-11"
                    >
                      <option value="">-- ເລືອກ ພື້ນທີ່/ຈຸດກວດ ເພີ່ມເຕີມ --</option>
                      {uniqueEditCategories.map((cat, idx) => (
                        <option key={idx} value={cat} disabled={editSelectedCategories.includes(cat)}>
                          {cat} {editSelectedCategories.includes(cat) ? "(ເລືອກແລ້ວ)" : ""}
                        </option>
                      ))}
                    </select>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          const remaining = uniqueEditCategories.filter(cat => !editSelectedCategories.includes(cat));
                          if (remaining.length > 0) {
                            setEditSelectedCategories(prev => [...prev, ...remaining]);
                          }
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-lg transition h-11 cursor-pointer whitespace-nowrap"
                      >
                        + ເລືອກທັງໝົດ (Select All)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setEditSelectedCategories([]);
                        }}
                        className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-600 hover:bg-amber-700 border border-amber-500 text-white font-bold text-xs rounded-lg transition h-11 cursor-pointer whitespace-nowrap"
                      >
                        × ລົບທັງໝົດ (Clear All)
                      </button>
                    </div>
                  </div>
                </div>

                <div className="sm:col-span-2 bg-emerald-50/40 p-3 rounded-lg border border-emerald-100/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <span className="block font-bold text-slate-700">ແຍກຟອມກວດກາຄວາມປອດໄພ (Safety Form Type)</span>
                    <span className="text-slate-500 text-[10px]">
                      {currentUser.status === "Admin" 
                        ? "ລະບົບກວດສອບພົບອັດຕະໂນມັດ ຕາມປະເພດສາຂາ ຫຼື ສາມາດປ່ຽນເອງໄດ້" 
                        : "ລະບົບລັອກຟອມອັດຕະໂນມັດຕາມປະເພດສາຂາຂອງທ່ານ (ເພື່ອກວດສອບຄວາມຖືກຕ້ອງ)"}
                    </span>
                  </div>
                  <select
                    value={editFormType}
                    disabled={currentUser.status !== "Admin"}
                    onChange={(e) => handleEditFormTypeChange(e.target.value as any)}
                    className={`border rounded-lg p-2 font-bold min-w-[200px] ${
                      currentUser.status === "Admin" 
                        ? "border-emerald-300 text-emerald-800 cursor-pointer bg-white" 
                        : "border-slate-300 text-slate-500 bg-slate-100 cursor-not-allowed"
                    }`}
                  >
                    {currentUser.status === "Admin" ? (
                      <>
                        <option value="ສຳນັກງານໃຫຍ່">ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>
                        <option value="ສາຂາ">ຟອມ ສາຂາ (Branch)</option>
                        <option value="ໜ່ວຍບໍລິການ">ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>
                        <option value="ຫ້ອງຮັບເງິນ">ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>
                      </>
                    ) : (
                      <>
                        {editFormType === "ສຳນັກງານໃຫຍ່" && <option value="ສຳນັກງານໃຫຍ່">ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>}
                        {editFormType === "ສາຂາ" && <option value="ສາຂາ">ຟອມ ສາຂາ (Branch)</option>}
                        {editFormType === "ໜ່ວຍບໍລິການ" && <option value="ໜ່ວຍບໍລິການ">ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>}
                        {editFormType === "ຫ້ອງຮັບເງິນ" && <option value="ຫ້ອງຮັບເງິນ">ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Table implementation for beautiful Checklist */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-medium">
                    <thead>
                      <tr className="bg-slate-100 text-slate-705 uppercase font-bold border-b border-slate-200">
                        <th className="p-3">ລາຍການກວດກາ (Inspection Item)</th>
                        <th className="p-3 text-center w-36">ສະຖານະກວດກາ</th>
                        <th className="p-3">ໝາຍເຫດ (Remarks)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {editSelectedCategories.map((cat, catIdx) => {
                        const catItems = filteredEditChecklistOptions.filter(item => item.ໝວດລະບົບກວດ === cat);
                        if (catItems.length === 0) return null;

                        return (
                          <React.Fragment key={catIdx}>
                            <tr className="bg-slate-50/70 border-y border-slate-200">
                              <td colSpan={3} className="px-3 py-2 font-bold text-emerald-800 text-[13px] bg-slate-100">
                                📂 {cat}
                              </td>
                            </tr>
                            {catItems.map((chk, idx) => {
                              const itemText = chk.ລາຍການກວດ;
                              const ev = editEvaluations[itemText] || { status: null, note: '' };

                              return (
                                <tr key={idx} className="hover:bg-rose-50/5 transition-colors">
                                  <td className="p-3 pl-6 font-semibold text-slate-700">{itemText}</td>
                                  <td className="p-3">
                                    <div className="flex justify-center items-center space-x-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditEvaluations(prev => ({
                                            ...prev,
                                            [itemText]: { ...ev, status: '✓' }
                                          }));
                                        }}
                                        className={`w-10 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition ${
                                          ev.status === '✓'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-650'
                                        }`}
                                      >
                                        ✓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditEvaluations(prev => ({
                                            ...prev,
                                            [itemText]: { ...ev, status: 'X' }
                                          }));
                                        }}
                                        className={`w-10 h-8 rounded-lg font-bold flex items-center justify-center cursor-pointer transition ${
                                          ev.status === 'X'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-650'
                                        }`}
                                      >
                                        X
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <input
                                      type="text"
                                      value={ev.note}
                                      onChange={(e) => {
                                        setEditEvaluations(prev => ({
                                          ...prev,
                                          [itemText]: { ...ev, note: e.target.value }
                                        }));
                                      }}
                                      placeholder="ໝາຍເຫດເພີ່ມເຕີມ..."
                                      className="w-full border border-slate-300 rounded-lg p-1.5 bg-white text-slate-800 text-[11px]"
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                      {editSelectedCategories.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-10 text-rose-500 font-bold bg-rose-50/10 font-black">
                            ⚠️ ກະລຸນາເລືອກພື້ນທີ່/ຈຸດກວດຢ່າງໜ້ອຍ 1 ໝວດຢູ່ດ້ານເທິງ ເພື່ອກວດກາລາຍການ
                          </td>
                        </tr>
                      ) : filteredEditChecklistOptions.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-6 text-slate-400 font-bold">
                            ບໍ່ມີລາຍການກວດກາໃນພື້ນທີ່/ຈຸດກວດນີ້
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dynamic Defects Summary Box */}
              {(() => {
                const defectiveItems = filteredEditChecklistOptions.filter(chk => editEvaluations[chk.ລາຍການກວດ]?.status === 'X');
                const totalDefects = defectiveItems.length;

                if (totalDefects > 0) {
                  return (
                    <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center justify-between space-x-4 shrink-0 animate-fadeIn text-xs">
                      <div className="flex items-center space-x-2.5">
                        <AlertTriangle className="h-6 w-6 text-amber-600 animate-bounce shrink-0" />
                        <div>
                          <p className="font-bold text-amber-900 text-[13px]">
                            ສະຫຼຸບຈຸດເປເພ-ຜິດປົກກະຕິ ({totalDefects} ຈຸດ)
                          </p>
                          <p className="text-amber-700 mt-0.5 text-[11px] font-medium">
                            ພົບຄວາມຜິດປົກກະຕິຈຳນວນ {totalDefects} ຈຸດ ໃນຕາຕະລາງກວດກາ. ກະລຸນາເພີ່ມຂໍ້ມູນຊັບສິນດ້ານລຸ່ມນີ້ຕາມຕ້ອງການ ເພື່ອອອກໃບແຈ້ງສ້ອມແປງ.
                          </p>
                        </div>
                      </div>
                      <div className="bg-amber-600 text-white font-black px-4 py-2 rounded-full text-lg shadow-sm">
                        {totalDefects}
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl flex items-center space-x-2 text-xs">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <p className="text-emerald-800 font-medium">
                        ທຸກລາຍການກວດກາຢູ່ໃນສະພາບປົກກະຕິດີທັງໝົດ. ລະບົບຈະບັນທຶກສະຖານະເປັນ <strong>"ປົກກະຕິ"</strong>.
                      </p>
                    </div>
                  );
                }
              })()}

              {/* Defect - Incident Form Options */}
              {(() => {
                const defectiveItemsList = filteredEditChecklistOptions.filter(chk => editEvaluations[chk.ລາຍການກວດ]?.status === 'X');
                if (defectiveItemsList.length === 0 && editManualIncidentForms.length === 0) return null;

                return (
                  <div className="space-y-4 pt-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-rose-100 pb-2 gap-2">
                      <h5 className="font-bold text-rose-800 flex items-center text-[11px] sm:text-xs">
                        <AlertTriangle className="h-4 w-4 mr-1.5 text-rose-600 animate-pulse" />
                        ລາຍລະອຽດການແຈ້ງເຫດການ & ຂໍ້ມູນຊັບສິນ ສໍາລັບແຕ່ລະຈຸດເປເພ
                      </h5>
                      <button
                        type="button"
                        onClick={() => handleEditAddManualIncident()}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3 rounded-xl flex items-center justify-center cursor-pointer transition shadow-xs text-[11px] gap-1 shrink-0 self-start sm:self-center"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>➕ ເພີ່ມຊັບສິນເປເພ</span>
                      </button>
                    </div>

                    {editManualIncidentForms.length === 0 ? (
                      <div className="bg-slate-50 border border-slate-200 p-5 rounded-xl text-center text-xs text-slate-500 animate-fadeIn">
                        ⚠️ ຍັງບໍ່ມີຂໍ້ມູນຊັບສິນເປເພ. ກະລຸນາຄລິກທີ່ປຸ່ມ <strong>"➕ ເພີ່ມຊັບສິນເປເພ"</strong> ດ້ານເທິງ ເພື່ອປ້ອນລາຍລະອຽດຊັບສິນທີ່ຕ້ອງການແຈ້ງສ້ອມແປງ (ສາມາດເພີ່ມໄດ້ຕາມທີ່ຕ້ອງການ).
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {editManualIncidentForms.map((dForm, dIdx) => {
                          const currentMatchedAsset = uniqueAssets.find(a => (a.ລະහັດຊັບສິນ || '').toLowerCase() === (dForm.assetCode || '').toLowerCase().trim());
                          const dePointsList = filteredEditChecklistOptions.filter(chk => editEvaluations[chk.ລາຍການກວດ]?.status === 'X');
                          const otherSelectedPoints = editManualIncidentForms
                            .filter(f => f.id !== dForm.id)
                            .map(f => f.selectedChecklistPoint)
                            .filter(Boolean);

                          return (
                            <div key={dForm.id} className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-3.5 relative shadow-xs animate-fadeIn">
                              <div className="flex items-center justify-between border-b pb-1.5 border-rose-200">
                                <span className="font-bold text-rose-900 text-xs flex items-center">
                                  <span className="w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] mr-2">
                                    {dIdx + 1}
                                  </span>
                                  ລາຍການຊັບສິນເປເພລາຍການທີ {dIdx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleEditRemoveManualIncident(dForm.id)}
                                  className="p-1 px-2 border border-rose-200 text-rose-600 rounded-lg hover:bg-rose-50 font-bold flex items-center gap-1 cursor-pointer transition text-[9px] sm:text-[10px]"
                                >
                                  <X className="h-3 w-3 shrink-0" />
                                  <span>ລຶບລາຍການນີ້</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-slate-700">
                                <div className="sm:col-span-2">
                                  <div className="bg-slate-100/60 p-2.5 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                    <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                                      🔍 ປະເພດຈຸດເປເພ (Defect Type):
                                    </span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleEditUpdateManualIncident(dForm.id, 'hasAsset', 'yes')}
                                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                                          dForm.hasAsset !== 'no'
                                            ? 'bg-indigo-600 border-indigo-650 text-white shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        📦 ມີຊັບສິນ (Has Asset Ref)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleEditUpdateManualIncident(dForm.id, 'hasAsset', 'no')}
                                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center transition font-bold text-[10.5px] cursor-pointer ${
                                          dForm.hasAsset === 'no'
                                            ? 'bg-amber-600 border-amber-650 text-white shadow-xs'
                                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                      >
                                        📝 ບໍ່ມີຊັບສິນ / ແຈ້ງເປັນ Case
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">
                                    📍 ຈຸດກວດກາທີ່ພົບບັນຫາ (Referenced Checkpoint) *
                                  </label>
                                  {dePointsList.length > 1 ? (
                                    <select
                                      value={dForm.selectedChecklistPoint}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleEditUpdateManualIncident(dForm.id, 'selectedChecklistPoint', val);
                                        const matched = filteredEditChecklistOptions.find(chk => chk.ລາຍການກວດ === val);
                                        if (matched) {
                                          handleEditUpdateManualIncident(dForm.id, 'assetGroup', matched.ໝວດລະບົບກວດ);
                                        }
                                      }}
                                      className="w-full border border-rose-300 rounded-lg p-2 bg-white text-rose-900 font-bold focus:ring-1 focus:ring-rose-500 text-[11px] cursor-pointer"
                                    >
                                      <option value="">-- ກະລຸນາເລືອກຈຸດກວດກາທີ່ພົບຄວາມເສຍຫາຍ --</option>
                                      {dePointsList.map((pt, pIdx) => {
                                        const isSelectedElsewhere = otherSelectedPoints.includes(pt.ລາຍການກວດ);
                                        return (
                                          <option key={pIdx} value={pt.ລາຍການກວດ} disabled={isSelectedElsewhere}>
                                            ⚠️ [{pt.ໝວດລະບົບກວດ}] {pt.ລາຍການກວດ} {isSelectedElsewhere ? ' (ເລືອກແລ້ວໃນລາຍການອື່ນ)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  ) : dePointsList.length === 1 ? (
                                    <div className="w-full border border-rose-200 bg-rose-50 text-rose-950 rounded-lg p-2.5 font-bold text-[11px] flex items-center justify-between">
                                      <span>⚙️ [{dePointsList[0].ໝວດລະບົບກວດ}] {dePointsList[0].ລາຍການກວດ}</span>
                                      <span className="text-[9px] bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-full uppercase">
                                        Auto
                                      </span>
                                    </div>
                                  ) : (
                                    <select
                                      value={dForm.selectedChecklistPoint}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        handleEditUpdateManualIncident(dForm.id, 'selectedChecklistPoint', val);
                                        const matched = filteredEditChecklistOptions.find(chk => chk.ລາຍການກວດ === val);
                                        if (matched) {
                                          handleEditUpdateManualIncident(dForm.id, 'assetGroup', matched.ໝວດລະບົບກວດ);
                                        }
                                      }}
                                      className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 text-[11px] cursor-pointer"
                                    >
                                      <option value="">-- ເລືອກຈຸດກວດກາ --</option>
                                      {filteredEditChecklistOptions.map((pt, pIdx) => {
                                        const isSelectedElsewhere = otherSelectedPoints.includes(pt.ລາຍການກວດ);
                                        return (
                                          <option key={pIdx} value={pt.ລາຍການກວດ} disabled={isSelectedElsewhere}>
                                            [{pt.ໝວດລະບົບກວດ}] {pt.ລາຍການກວດ} {isSelectedElsewhere ? ' (ເລືອກແລ້ວໃນລາຍການອື່ນ)' : ''}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  )}
                                </div>

                                {dForm.hasAsset !== 'no' ? (
                                  <div>
                                    <div className="flex items-center justify-between mb-1">
                                      <label className="block font-bold text-slate-700 text-[11px]">
                                        ລະຫັດຊັບສິນ (Asset Code) *
                                      </label>
                                      {dForm.assetCode.trim() && (
                                        currentMatchedAsset ? (
                                          <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 py-0.5 rounded-full border border-emerald-100">
                                            🟢 ພົບຊັບສິນເດີມ ({currentMatchedAsset.ລາຍການ})
                                          </span>
                                        ) : (
                                          <span className="text-[9px] text-amber-600 font-bold bg-amber-50 px-1 py-0.5 rounded-full border border-amber-100">
                                            ⚙️ ລະຫັດຊັບສິນໃໝ່
                                          </span>
                                        )
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={dForm.assetCode}
                                        onChange={(e) => handleEditManualAssetCodeChange(dForm.id, e.target.value)}
                                        placeholder="ຕົວຢ່າງ: LDB-CCTV-004..."
                                        className="font-mono flex-1 border border-slate-300 rounded-lg p-2 bg-white text-slate-800 text-[11px] focus:ring-1 focus:ring-indigo-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setScannerConfig({
                                          isOpen: true,
                                          onScan: (scannedVal) => handleEditManualAssetCodeChange(dForm.id, scannedVal)
                                        })}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold border border-indigo-200 px-3 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 text-[11px]"
                                        title="ສະແກນ Barcode"
                                      >
                                        <Scan className="h-4 w-4 shrink-0" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="block font-bold text-slate-400 text-[11px] mb-1">
                                      ລະຫັດຊັບສິນ (Asset Code)
                                    </label>
                                    <input
                                      type="text"
                                      value="ບໍ່ມີຊັບສິນ (ແຈ້ງເປັນ Case ທົ່ວໄປ)"
                                      disabled
                                      className="w-full border border-slate-200 rounded-lg p-2 bg-slate-100 text-slate-400 text-[11px] font-medium"
                                    />
                                  </div>
                                )}

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ພາກສ່ວນຊັບສົມບັດ (Asset Group) *</label>
                                  <select
                                    value={dForm.assetCategory}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'assetCategory', e.target.value)}
                                    disabled={dForm.hasAsset === 'no'}
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {dForm.hasAsset === 'no' ? (
                                      <option value="none">none</option>
                                    ) : (
                                      ASSET_CATEGORIES.map((cat, idx) => (
                                        <option key={idx} value={cat.ພາກສ່ວນ}>{cat.ພາກສ່ວນ}</option>
                                      ))
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ໜວດລາຍການຊັບສິນ (Asset Category) *</label>
                                  <input
                                    type="text"
                                    value={dForm.assetGroup}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'assetGroup', e.target.value)}
                                    placeholder="ຕົວຢ່າງ: NOTEBOOK, CCTV..."
                                    disabled={dForm.hasAsset === 'no'}
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                  />
                                </div>

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຊື່ລາຍການຊັບສິນ (Asset Name) *</label>
                                  <input
                                    type="text"
                                    value={dForm.assetName}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'assetName', e.target.value)}
                                    placeholder="ຕົວຢ່າງ: LG Air Condition..."
                                    disabled={dForm.hasAsset === 'no'}
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                                  />
                                </div>

                                <div className="sm:col-span-2 mt-2 pt-2 border-t border-slate-200">
                                  <h6 className="font-bold text-slate-700 flex items-center gap-1.5 mb-1.5 text-[11px] uppercase tracking-wider">
                                    🏢 ຝ່າຍ/ໜ່ວຍງານ ຫຼື ສາຂາ ທີ່ເປັນຜູ້ໃຊ້/ດູແດຊັບສິນ (Asset Creator/Owner)
                                  </h6>
                                </div>

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ສາຂາຂອງຊັບສິນ</label>
                                  <select
                                    value={dForm.assetBranch || editBranch}
                                    onChange={(e) => {
                                      const br = e.target.value;
                                      handleEditUpdateManualIncident(dForm.id, 'assetBranch', br);
                                      const firstUnit = BRANCHES.find(b => b.ສາຂາ === br);
                                      handleEditUpdateManualIncident(dForm.id, 'assetUnit', firstUnit ? (firstUnit["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || br) : br);
                                    }}
                                    disabled={dForm.hasAsset === 'no'}
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {dForm.hasAsset === 'no' ? (
                                      <option value="none">none</option>
                                    ) : (
                                      Array.from(new Set(BRANCHES.map(b => b.ສາຂາ))).map((br, idx) => {
                                        const cleanBr = String(br || '').trim();
                                        return (
                                          <option key={idx} value={cleanBr}>{cleanBr}</option>
                                        );
                                      })
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຝ່າຍ/ໜ່ວຍບໍລິການຂອງຊັບສິນ</label>
                                  <select
                                    value={dForm.assetUnit || editUnit}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'assetUnit', e.target.value)}
                                    disabled={dForm.hasAsset === 'no'}
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {dForm.hasAsset === 'no' ? (
                                      <option value="none">none</option>
                                    ) : (
                                      BRANCHES.filter(b => b.ສາຂາ === (dForm.assetBranch || editBranch)).map((b, idx) => {
                                        const unitVal = b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || b.ສາຂາ;
                                        return (
                                          <option key={idx} value={unitVal}>
                                            {unitVal}
                                          </option>
                                        );
                                      })
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຂະແໜງຂອງຊັບສິນ</label>
                                  <select
                                    value={dForm.assetSector || editSector}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'assetSector', e.target.value)}
                                    disabled={dForm.hasAsset === 'no'}
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {dForm.hasAsset === 'no' ? (
                                      <option value="none">none</option>
                                    ) : (
                                      sectorList.map((sec, idx) => (
                                        <option key={idx} value={sec.ຂະແໜງ}>{sec.ຂະແໜງ}</option>
                                      ))
                                    )}
                                  </select>
                                </div>

                                <div>
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ປະເມີນຜົນກະທົບ (Impact Level)</label>
                                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                                    {['ຕ່ຳ', 'ປານກາງ', 'ສູງ'].map((lvl) => {
                                      const labelEmoji = lvl === 'ຕ່ຳ' ? '🔵' : lvl === 'ປານກາງ' ? '🟡' : '🔴';
                                      const labelText = lvl === 'ຕ່ຳ' ? 'ຕ່ຳ (Low)' : lvl === 'ປານກາງ' ? 'ປານກາງ (Medium)' : 'ສູງ (High)';
                                      const isSelected = dForm.impact === lvl;

                                      let classes = 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 hover:border-slate-300';
                                      if (isSelected) {
                                        if (lvl === 'ຕ່ຳ') classes = 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500/20 shadow-sm';
                                        if (lvl === 'ປານກາງ') classes = 'bg-amber-50 border-amber-500 text-amber-700 ring-1 ring-amber-500/20 shadow-sm';
                                        if (lvl === 'ສູງ') classes = 'bg-red-50 border-red-500 text-red-700 ring-1 ring-red-500/20 shadow-sm scale-[1.01]';
                                      }

                                      return (
                                        <button
                                          key={lvl}
                                          type="button"
                                          onClick={() => handleEditUpdateManualIncident(dForm.id, 'impact', lvl)}
                                          className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg border text-center transition-all duration-200 cursor-pointer ${classes}`}
                                        >
                                          <span className="text-[11px] mb-0.5">{labelEmoji}</span>
                                          <span className="font-bold text-[8.5px] whitespace-nowrap">{labelText}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ລາຍລະອຽດບັນຫາທີ່ພົບ *</label>
                                  <textarea
                                    value={dForm.problem}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'problem', e.target.value)}
                                    placeholder="ກະລຸນາປ້ອນລາຍລະອຽດຄວາມເສຍຫາຍຂອງອຸປະກອນ ຫຼື ຈຸດທີ່ບໍ່ປອດໄພ..."
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white h-16 text-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                                  ></textarea>
                                </div>

                                <div className="sm:col-span-2">
                                  <label className="block font-bold text-slate-700 mb-1 text-[11px]">ຂໍ້ສະເໜີແນະວິທີແກ້ໄຂ / ປັບປຸງເບື້ອງຕົ້ນ</label>
                                  <input
                                    type="text"
                                    value={dForm.solution}
                                    onChange={(e) => handleEditUpdateManualIncident(dForm.id, 'solution', e.target.value)}
                                    placeholder="ຕົວຢ່າງ: ປ່ຽນເຄື່ອງໃຫມ່, ຈ້າງຊ່າງມາສ້ອມແປງ..."
                                    className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-1 focus:ring-indigo-500 font-medium"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Buttons */}
              <div className="bg-slate-50 border-t border-slate-150 p-4 -mx-6 -mb-6 rounded-b-2xl flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditOpen(false);
                    setEditingInspection(null);
                  }}
                  className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition text-xs cursor-pointer"
                >
                  ຍົກເລີກ (Cancel)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition text-xs cursor-pointer flex items-center gap-1 shadow-md hover:shadow-lg"
                >
                  <Check className="h-4 w-4" />
                  ບັນທຶກການແກ້ໄຂ (Save Changes)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Single Delete Confirm */}
      {showSingleConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900">ຢືນຢັນການລຶບຂໍ້ມູນ</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              ການລຶບນີ້ຈະລົບທຸກຂໍ້ມູນທີ່ຜູກກັນຕາມ Workflow ລວມທັງ Attachments / Evidence ແລະບໍ່ສາມາດກູ້ຄືນໄດ້.
            </p>
            <DeleteImpactSummary impact={deleteImpact} />
            {singleToDelete && (
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[10px] text-slate-600 break-all">
                ID: <strong className="text-slate-950">{singleToDelete}</strong>
              </div>
            )}
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                disabled={deleteImpact.totalRecords === 0}
                onClick={() => {
                  setShowSingleConfirm(false);
                  setSingleToDelete(null);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-xs cursor-pointer"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (singleToDelete && onDeleteInspections) {
                    onDeleteInspections([singleToDelete]);
                  }
                  setShowSingleConfirm(false);
                  setSingleToDelete(null);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition text-xs cursor-pointer shadow-xs"
              >
                ຢືນຢັນການລຶບ (Confirm Delete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Bulk Delete Confirm */}
      {showBulkConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900">ຢືນຢັນການລຶບຫຼາຍລາຍການ</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              ທ່ານກຳລັງລຶບ <strong>{selectedPids.length} ລາຍການ</strong> ພ້ອມທຸກຂໍ້ມູນ Workflow ແລະ Attachments / Evidence ທີ່ຜູກກັນ. ການນີ້ບໍ່ສາມາດກູ້ຄືນໄດ້.
            </p>
            <DeleteImpactSummary impact={deleteImpact} />
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowBulkConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition text-xs cursor-pointer"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                disabled={deleteImpact.totalRecords === 0}
                onClick={() => {
                  if (onDeleteInspections) {
                    onDeleteInspections(selectedPids);
                  }
                  setSelectedPids([]);
                  setShowBulkConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg transition text-xs cursor-pointer shadow-xs"
              >
                ຢືນຢັນການລຶບ ({selectedPids.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Clear Confirm */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-5">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900">ຢືນຢັນການລ້າງຂໍ້ມູນ</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              ກະລຸນາເລືອກຂອບເຂດຂໍ້ມູນທີ່ຕ້ອງການລຶບລ້າງອອກຈາກລະບົບ:
            </p>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/50 transition">
                <input
                  type="radio"
                  name="clearOption"
                  checked={clearOption === 'inspections'}
                  onChange={() => setClearOption('inspections')}
                  className="mt-1 text-emerald-600 focus:ring-emerald-500 cursor-pointer w-4 h-4 shrink-0"
                />
                <div className="text-xs">
                  <div className="font-bold text-slate-800">ລ້າງສະເພາະປະຫວັດການກວດກา</div>
                  <div className="text-slate-500 text-[10.5px] mt-0.5 font-medium">
                    ລຶບຂໍ້ມູນປະຫວັດການກວດກາຄວາມປອດໄພທັງໝົດ ແຕ່ຍັງຄົງຮັກສາຂໍ້ມູນອື່ນໆໄວ້.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 bg-rose-50/35 border border-rose-200/60 rounded-xl cursor-pointer hover:bg-rose-50/50 transition">
                <input
                  type="radio"
                  name="clearOption"
                  checked={clearOption === 'all'}
                  onChange={() => setClearOption('all')}
                  className="mt-1 text-rose-650 focus:ring-rose-500 cursor-pointer w-4 h-4 shrink-0"
                />
                <div className="text-xs">
                  <div className="font-bold text-rose-800">ລ້າງຂໍ້ມູນທັງໝົດໃນແອັບ (Reset Full Database)</div>
                  <div className="text-slate-500 text-[10.5px] mt-0.5 font-medium">
                    ລຶບທຸກຂໍ້ມູນ: ປະຫວັດການກວດກາ, ໃບແຈ້ງເຫດ, ໃບອະນຸມັດ ແລະ ປະຫວັດການສ້ອມແປງ.
                  </div>
                </div>
              </label>
            </div>
            <div className="flex gap-2.5 justify-end font-bold">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition text-xs cursor-pointer font-bold"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onClearAllData) {
                    onClearAllData(clearOption === 'all' ? 'all' : 'inspections');
                  }
                  setShowClearConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-xs cursor-pointer shadow-xs font-bold"
              >
                ຢືນຢັນການລ້າງຂໍ້ມູນ (Confirm Reset)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
