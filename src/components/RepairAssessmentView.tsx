/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Search, Plus, Hammer, ShieldAlert, Filter, Info, X, Check, Eye, Pencil, Trash2, Download, Save, ClipboardCheck, FileText, Landmark, User, Calendar, AlertTriangle, Wrench
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { IncidentRecord, UserAccount, RepairAssessmentRecord, RepairSubItem, RepairTrackingRecord, RepairPreset } from '../types';
import { getSavedBranches, getSavedInspections, getSavedChecklistItems, cleanString, formatExcelDate, formatLAK, getSavedRepairPresets } from '../dataStore';
import { LOCATION_FLOOR_LABEL } from '../locationFloorOptions';
import { normalizeCaseSector, resolveIncidentCaseReference } from '../incidentCaseReference';
import { getRepairSubCategoryOptions, normalizeRepairSubCategory } from '../repairAssessmentCategories';
import {
  isNoPartRepairAssessmentWorkType,
  normalizeRepairAssessmentWorkType,
  REPAIR_ASSESSMENT_WORK_TYPES,
} from '../repairAssessmentWorkTypes';
import {
  type AssessmentRepairerType,
  isAssessmentLevelRepairerVisible,
  normalizeAssessmentRepairerForSave,
  resolveMinorTaskRepairerName,
  switchAssessmentMode,
  validateAssessmentLevelRepairer,
} from '../repairAssessmentMode';

interface PresetRepairItem {
  repairSubItem: string;
  workType: string;
  sparePart: string;
  defaultUnit: string;
  defaultPartSource: string;
}

const REPAIR_PRESETS: Record<string, PresetRepairItem[]> = new Proxy({}, {
  get(target, prop: string) {
    const list = getSavedRepairPresets();
    const filtered = list.filter(
      p => normalizeRepairSubCategory(p.repairSubCategory || 'ລະບົບໄຟຟ້າ') === prop,
    );
    return filtered.map(p => ({
      repairSubItem: p.repairSubItem,
      workType: normalizeRepairAssessmentWorkType(p.workType),
      sparePart: p.sparePart,
      defaultUnit: p.unit || 'ອັນ',
      defaultPartSource: isNoPartRepairAssessmentWorkType(p.workType) ? 'No Part Required' : 'Purchase New'
    }));
  }
}) as any;

interface RepairAssessmentViewProps {
  incidents: IncidentRecord[];
  assessments: RepairAssessmentRecord[];
  repairTracking?: RepairTrackingRecord[];
  onAddAssessment: (newAsm: RepairAssessmentRecord) => void;
  onUpdateAssessment: (pid: string, updatedAsm: Partial<RepairAssessmentRecord>) => void;
  onUpdateIncidentStatus: (pid: string, newStatus: string) => void;
  currentUser: UserAccount;
  initialIncidentId?: string | null;
  onClearInitialIncidentId?: () => void;
  onNavigateToTab?: (tab: string) => void;
}

export default function RepairAssessmentView({
  incidents,
  assessments,
  repairTracking = [],
  onAddAssessment,
  onUpdateAssessment,
  onUpdateIncidentStatus,
  currentUser,
  initialIncidentId,
  onClearInitialIncidentId,
  onNavigateToTab
}: RepairAssessmentViewProps) {
  const BRANCHES = useMemo(() => getSavedBranches(), []);
  const inspectionsList = useMemo(() => getSavedInspections(), []);
  const checklistItems = useMemo(() => getSavedChecklistItems(), []);

  const getCaseReference = (inc: IncidentRecord) =>
    resolveIncidentCaseReference(inc, inspectionsList, checklistItems);

  const getResolvedSubsystemCategory = (inc: IncidentRecord) =>
    getCaseReference(inc).areaPoint || "ບໍ່ລະບຸ";

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(currentUser.status === "Admin" ? 'ALL' : currentUser.branch);
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successModalType, setSuccessModalType] = useState<'draft' | 'submit'>('submit');
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  // Selected incident to assess
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [viewingAssessment, setViewingAssessment] = useState<RepairAssessmentRecord | null>(null);

  const isAlreadyInTracking = useMemo(() => {
    if (!selectedIncident) return false;
    return (repairTracking || []).some(t => t.PID === selectedIncident.PID);
  }, [selectedIncident, repairTracking]);

  // Form State
  const [assessorName, setAssessorName] = useState(() => currentUser?.username || '');
  const [assessorType, setAssessorType] = useState<AssessmentRepairerType>('');
  const [minorTaskRepairerName, setMinorTaskRepairerName] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [assessmentRemark, setAssessmentRemark] = useState('');
  const [subItems, setSubItems] = useState<RepairSubItem[]>([]);
  const [noAssessmentRequired, setNoAssessmentRequired] = useState(false);

  // Auto-open assessment form if an initialIncidentId is passed
  React.useEffect(() => {
    if (initialIncidentId) {
      const incident = incidents.find(inc => inc.PID === initialIncidentId);
      if (incident) {
        handleOpenAssess(incident);
      }
      if (onClearInitialIncidentId) {
        onClearInitialIncidentId();
      }
    }
  }, [initialIncidentId, incidents]);

  // Sub-item form controls (for adding/editing inline)
  const handleAddSubItemRow = () => {
    const newItem: RepairSubItem = {
      id: Math.random().toString(36).substr(2, 9),
      repairSubCategory: 'ລະບົບໄຟຟ້າ',
      repairSubItem: '',
      workType: 'ກວດເຊັກ-ສ້ອມ',
      repairerType: 'ຊ່າງພາຍໃນ',
      internalRepairerName: currentUser?.username || '',
      vendorName: '',
      partSource: 'No Part Required',
      sparePart: '',
      quantity: 1,
      unit: 'ອັນ',
      stockItemCode: '',
      estimatedUnitCost: 0,
      estimatedTotalCost: 0,
      costRule: 'Market Rate'
    };
    setSubItems([...subItems, newItem]);
  };

  const handleRemoveSubItemRow = (id: string) => {
    setSubItems(subItems.filter(item => item.id !== id));
  };

  const handleSubItemChange = (id: string, field: keyof RepairSubItem, value: any) => {
    setSubItems(currentItems => currentItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        // Recalculate estimated total cost if quantity or unit cost changes
        if (field === 'quantity' || field === 'estimatedUnitCost') {
          const qty = field === 'quantity' ? Number(value) : Number(item.quantity);
          const unitCost = field === 'estimatedUnitCost' ? Number(value) : Number(item.estimatedUnitCost);
          updatedItem.estimatedTotalCost = qty * unitCost;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const handleSparePartSelect = (id: string, sparePartName: string) => {
    const presets = getSavedRepairPresets();
    const matches = presets.filter(p => p.sparePart === sparePartName);
    
    setSubItems(subItems.map(item => {
      if (item.id === id) {
        if (matches.length > 0) {
          const matched = matches[0];
          const normalizedWorkType = normalizeRepairAssessmentWorkType(matched.workType);
          const qty = item.quantity || 1;
          const currentUnitCost = item.estimatedUnitCost || 0;
          return {
            ...item,
            sparePart: sparePartName,
            repairSubCategory: normalizeRepairSubCategory(matched.repairSubCategory),
            repairSubItem: matched.repairSubItem,
            workType: normalizedWorkType,
            unit: matched.unit || 'ອັນ',
            estimatedUnitCost: currentUnitCost,
            estimatedTotalCost: qty * currentUnitCost
          };
        } else {
          return {
            ...item,
            sparePart: sparePartName
          };
        }
      }
      return item;
    }));
  };

  const handleSubItemSelect = (id: string, subItemName: string) => {
    setSubItems(subItems.map(item => {
      if (item.id === id) {
        const cat = normalizeRepairSubCategory(item.repairSubCategory || 'ລະບົບໄຟຟ້າ');
        const presets = getSavedRepairPresets();
        const matches = presets.filter(
          p => normalizeRepairSubCategory(p.repairSubCategory) === cat && p.repairSubItem === subItemName,
        );
        
        if (matches.length > 0) {
          const matched = matches[0];
          const normalizedWorkType = normalizeRepairAssessmentWorkType(matched.workType);
          const qty = item.quantity || 1;
          const currentUnitCost = item.estimatedUnitCost || 0;
          return {
            ...item,
            repairSubItem: subItemName,
            sparePart: matched.sparePart,
            workType: normalizedWorkType,
            unit: matched.unit || 'ອັນ',
            estimatedUnitCost: currentUnitCost,
            estimatedTotalCost: qty * currentUnitCost
          };
        } else {
          return {
            ...item,
            repairSubItem: subItemName
          };
        }
      }
      return item;
    }));
  };

  // Open the assessment form
  const handleOpenAssess = (incident: IncidentRecord) => {
    setErrorAlert(null);
    // Check if an assessment already exists for this incident
    const existing = assessments.find(asm => asm.incidentId === incident.PID);
    const isMinorTask = existing?.assessmentStatus === "No Assessment Required";
    setSelectedIncident(incident);
    setAssessorName(existing?.assessorName || currentUser?.username || '');
    setAssessorType(
      isMinorTask &&
      (existing?.assessorType === 'ຊ່າງພາຍໃນ' || existing?.assessorType === 'Vendor')
        ? existing.assessorType
        : '',
    );
    setMinorTaskRepairerName(
      isMinorTask && existing
        ? resolveMinorTaskRepairerName(existing)
        : '',
    );
    setVendorName(
      isMinorTask && existing?.assessorType === 'Vendor'
        ? resolveMinorTaskRepairerName(existing)
        : '',
    );
    setAssessmentDate(existing?.assessmentDate || new Date().toISOString().split('T')[0]);
    setAssessmentRemark(existing?.assessmentRemark || '');
    
    // Fallback default values for legacy subItems when loaded
    const loadedSubItems = (existing?.subItems || []).map(item => {
      const subCat = normalizeRepairSubCategory(
        item.repairSubCategory || 'ລະບົບໄຟຟ້າ',
      );
      return {
        ...item,
        repairSubCategory: subCat,
        workType: normalizeRepairAssessmentWorkType(item.workType),
        repairerType: item.repairerType || 'ຊ່າງພາຍໃນ',
        internalRepairerName: item.internalRepairerName || (item.repairerType === 'ຊ່າງພາຍໃນ' ? existing?.assessorName || '' : ''),
        vendorName: item.vendorName || (item.repairerType === 'Vendor' ? existing?.vendorName || '' : '')
      };
    });
    
    setSubItems(loadedSubItems);
    setNoAssessmentRequired(isMinorTask);
  };

  // Cost and validation rule checks
  const validateAssessmentForm = (isFinalSubmit: boolean) => {
    setErrorAlert(null);

    if (!assessorName.trim()) {
      setErrorAlert("ກະລຸນາລະບຸ ຊື່ຜູ້ປະເມນ (Please specify Assessor Name)");
      return false;
    }

    if (!assessmentDate) {
      setErrorAlert("ກະລຸນາລະບຸ ວັນທີປະເມີນ (Please specify Assessment Date)");
      return false;
    }

    const assessmentLevelRepairerError = validateAssessmentLevelRepairer({
      noAssessmentRequired,
      assessorType,
      minorTaskRepairerName,
    });
    if (assessmentLevelRepairerError) {
      setErrorAlert(assessmentLevelRepairerError);
      return false;
    }

    if (isFinalSubmit) {
      if (!noAssessmentRequired) {
        if (subItems.length === 0) {
          setErrorAlert("ກະລຸນາເພີ່ມຢ່າງໜ້ອຍ 1 ລາຍການສ້ອມຍ່ອຍ (Please add at least 1 repair sub item)");
          return false;
        }

        for (let i = 0; i < subItems.length; i++) {
          const item = subItems[i];
          const rowNum = i + 1;

          if (!item.repairSubItem.trim()) {
            setErrorAlert(`ລາຍການທີ ${rowNum}: ກະລຸນາລະບຸ ລາຍການສ້ອມແປງ (Row ${rowNum}: Please specify repair sub item)`);
            return false;
          }

          // Rule 3: Repairer Type validation
          if (item.repairerType === 'ຊ່າງພາຍໃນ') {
            if (!item.internalRepairerName?.trim()) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ປະເພດຊ່າງພາຍໃນ ຕ້ອງລະບຸ ຊື່ພະນັກງານຜູ້ສ້ອມ (Row ${rowNum}: Internal repairer requires name)`);
              return false;
            }
          } else if (item.repairerType === 'Vendor') {
            if (!item.vendorName?.trim()) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ປະເພດ Vendor ຕ້ອງລະບຸ ຊື່ບໍລິສັດ ຫຼື ຜູ້ຮັບເໝົາ (Row ${rowNum}: Vendor repairer requires name)`);
              return false;
            }
          }

          // Rule 4: Cost rules validation
          if (item.partSource === 'Stock') {
            if (!item.sparePart?.trim()) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ພາກສ່ວນ Stock ບັງຄັບລະບຸ ຊື່ອະໄຫຼ່/ອຸປະກອນ (Row ${rowNum}: Stock requires spare part name)`);
              return false;
            }
            if (!item.quantity || item.quantity <= 0) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ພາກສ່ວນ Stock ບັງຄັບລະບຸ ຈຳນວນຫຼາຍກວ່າ 0 (Row ${rowNum}: Stock quantity must be greater than 0)`);
              return false;
            }
            if (!item.unit?.trim()) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ພາກສ່ວນ Stock ບັງຄັບລະບຸ ຫົວໜ່ວຍ (Row ${rowNum}: Stock unit is required)`);
              return false;
            }
          } else if (item.partSource === 'Purchase New' || item.partSource === 'Vendor') {
            if (!item.sparePart?.trim()) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ພາກສ່ວນ ${item.partSource} ບັງຄັບລະບຸ ຊື່ອະໄຫຼ່ / ຄ່າບໍລິການ (Row ${rowNum}: ${item.partSource} requires spare part name)`);
              return false;
            }
            if (!item.quantity || item.quantity <= 0) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ພາກສ່ວນ ${item.partSource} ບັງຄັບລະບຸ ຈຳນວນຫຼາຍກວ່າ 0 (Row ${rowNum}: ${item.partSource} quantity must be greater than 0)`);
              return false;
            }
            if (!item.unit?.trim()) {
              setErrorAlert(`ລາຍການທີ ${rowNum}: ພາກສ່ວນ ${item.partSource} ບັງຄັບລະບຸ ຫົວໜ່ວຍ (Row ${rowNum}: ${item.partSource} unit is required)`);
              return false;
            }
          }
        }
      }
    }

    return true;
  };

  // Save draft or submit for approval
  const handleSaveAssessmentSubmit = (isFinalSubmit: boolean) => {
    if (!selectedIncident) return;
    if (!validateAssessmentForm(isFinalSubmit)) return;

    // Rule 5: If the order already has tracking, prevent submit or draft
    const inTracking = (repairTracking || []).some(t => t.PID === selectedIncident.PID);
    if (inTracking) {
      setErrorAlert("ອໍເດີນີ້ໄດ້ຖືກສົ່ງໄປຕິດຕາມການສ້ອມແປງ (Repair Tracking) ແລ້ວ, ຫ້າມດຳເນີນການຊ້ຳ.");
      return;
    }

    const repairerSave = normalizeAssessmentRepairerForSave({
      noAssessmentRequired,
      assessorType,
      minorTaskRepairerName,
      vendorName,
      subItems,
    });

    const existing = assessments.find(asm => asm.incidentId === selectedIncident.PID);
    const caseReference = getCaseReference(selectedIncident);
    const statusVal = isFinalSubmit 
      ? (noAssessmentRequired ? "No Assessment Required" : "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ") 
      : "ກຳລັງປະເມີນ";
    
    // Total cost calculation for metadata
    const totalCost = noAssessmentRequired ? 0 : subItems.reduce((acc, curr) => acc + (curr.estimatedTotalCost || 0), 0);

    const assessmentRecord: RepairAssessmentRecord = {
      PID: existing?.PID || `ASM-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      assessmentId: existing?.assessmentId || `ASM-${Math.floor(Math.random() * 90000 + 10000)}`,
      incidentId: selectedIncident.PID,
      inspectionId: selectedIncident.ລະຫັດກວດກາ || "",
      branch: caseReference.branch,
      division: caseReference.division,
      sector: caseReference.sector,
      roomOrLocation: caseReference.roomLocation || "ບໍ່ລະບຸ",
      inspectionType: caseReference.inspectionType,
      systemCategory: caseReference.systemCategory,
      subsystemCategory: caseReference.areaPoint,
      assetCode: selectedIncident.ລະຫັດຊັບສິນ || "ບໍ່ມີຊັບສິນ",
      assetName: selectedIncident.ລາຍການ || "none",
      itemType: selectedIncident.ໝວດລາຍການ || "",
      issueDetails: selectedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ || "",
      impactLevel: selectedIncident.ປະເມີນຜົນກະທົບ || "",
      proposedSolution: selectedIncident.ວີທີແກ້ໄຂ || "",
      assessorName,
      assessorType: repairerSave.assessorType,
      minorTaskRepairerName: repairerSave.minorTaskRepairerName,
      vendorName: repairerSave.vendorName,
      assessmentDate,
      subItems: repairerSave.subItems,
      assessmentRemark,
      assessmentStatus: statusVal
    };

    if (existing) {
      onUpdateAssessment(existing.PID, assessmentRecord);
    } else {
      onAddAssessment(assessmentRecord);
    }

    // Flow integration: Update Incident status accordingly
    // If draft: status is 'ກຳລັງປະເມີນ'. If submitted for approval: status is 'ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ' or 'No Assessment Required'
    const incidentStatus = isFinalSubmit 
      ? (noAssessmentRequired ? "No Assessment Required" : "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ") 
      : "ກຳລັງປະເມີນ";
    onUpdateIncidentStatus(selectedIncident.PID, incidentStatus);

    setSelectedIncident(null);
    setSuccessModalType(isFinalSubmit ? 'submit' : 'draft');
    setShowSuccessModal(true);
  };

  // Helper to map Lao status displays
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "ລໍຖ້າປະເມີນລາຍການສ້ອມ":
        return "bg-amber-50 text-amber-600 border border-amber-200 animate-pulse";
      case "ກຳລັງປະເມີນ":
        return "bg-blue-50 text-blue-600 border border-blue-200";
      case "ປະເມີນແລ້ວ":
      case "ລໍຖ້າອະນຸມັດ":
        return "bg-indigo-50 text-indigo-600 border border-indigo-200";
      case "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ":
      case "ອະນຸມັດແລ້ວ":
      case "ສຳເລັດ":
        return "bg-emerald-50 text-emerald-600 border border-emerald-200";
      default:
        return "bg-slate-50 text-slate-600 border border-slate-200";
    }
  };

  // Filter list of incidents for Repair Assessment view
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (inc.ສະຖານະ === "Cancelled" || inc.ສະຖານະ === "ສຳເລັດ" || inc.ສະຖານະ === "ສໍາເລັດ") return false;

      // Rule 1: Exclude if already in tracking
      const inTracking = (repairTracking || []).some(t => t.PID === inc.PID);
      if (inTracking) return false;

      const sStatus = inc.ສະຖານະ || "ລໍຖ້າປະເມີນລາຍການສ້ອມ";

      // Rule 2: If order has already been approved, under repair, or completed, do not show in Repair Assessment
      if (
        sStatus === "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ" || 
        sStatus === "ອະນຸມັດແລ້ວ" || 
        sStatus === "ກຳລັງສ້ອມແປງ" || 
        sStatus === "ສ້ອມສຳເລັດ (ລໍຖ້າປິດງານ)" || 
        sStatus === "ລໍຖ້າສ້ອມແປງ" ||
        sStatus === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" ||
        sStatus === "No Assessment Required"
      ) {
        return false;
      }

      // Rule 3: Exclude if there is already a completed/submitted assessment
      const hasCompletedAssessment = assessments.some(asm => 
        asm.incidentId === inc.PID && 
        (asm.assessmentStatus === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" || asm.assessmentStatus === "No Assessment Required")
      );
      if (hasCompletedAssessment) return false;

      // Only show orders that are pending, waiting, or draft ("ລໍຖ້າປະເມີນລາຍການສ້ອມ", "ກຳລັງປະເມີນ", "ລໍຖ້າການອະນຸມັດ")
      if (sStatus !== "ລໍຖ້າປະເມີນລາຍການສ້ອມ" && sStatus !== "ກຳລັງປະເມີນ" && sStatus !== "ລໍຖ້າການອະນຸມັດ") {
        return false;
      }

      // Statuses involved in Repair Assessment:
      // - "ລໍຖ້າປະເມີນລາຍການສ້ອມ" / "ລໍຖ້າການອະນຸມັດ" / "ກຳລັງປະເມີນ"
      // If status filter is "ALL", show any incident
      const matchesSearch = 
        inc.ລະຫັດກວດກາ.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inc.ລາຍການ || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === "ALL" || String(inc["ສາຂາ "] || "").trim() === branchFilter.trim();
      
      let matchesStatus = true;
      if (statusFilter === "pending") {
        matchesStatus = sStatus === "ລໍຖ້າປະເມີນລາຍການສ້ອມ" || sStatus === "ກຳລັງປະເມີນ";
      } else if (statusFilter !== "ALL") {
        matchesStatus = sStatus === statusFilter;
      }

      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [incidents, assessments, repairTracking, searchTerm, branchFilter, statusFilter]);

  // Filter list of already assessed items (History)
  const completedAssessments = useMemo(() => {
    return assessments.filter(asm => {
      const linkedInc = incidents.find(inc => inc.PID === asm.incidentId);
      
      const branchVal = linkedInc ? (linkedInc["ສາຂາ "] || linkedInc["ສາຂາ"] || "") : (asm.division || "");
      const assetNameVal = asm.assetName || (linkedInc ? linkedInc.ລາຍການ : "") || "";
      const assetCodeVal = asm.assetCode || (linkedInc ? linkedInc.ລະຫັດຊັບສິນ : "") || "";
      const systemCategoryVal = asm.systemCategory || (linkedInc ? linkedInc.ລະບົບທີ່ກວດ : "") || "";
      const subsystemCategoryVal = asm.subsystemCategory || (linkedInc ? getResolvedSubsystemCategory(linkedInc) : "") || "";
      const remarkVal = asm.assessmentRemark || "";
      
      const matchesSearch = 
        String(asm.inspectionId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(asm.incidentId || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(asm.assessorName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(assetNameVal).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(assetCodeVal).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(systemCategoryVal).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(subsystemCategoryVal).toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(remarkVal).toLowerCase().includes(searchTerm.toLowerCase());

      const matchesBranch = branchFilter === "ALL" || String(branchVal).trim() === branchFilter.trim();

      return matchesSearch && matchesBranch;
    });
  }, [assessments, incidents, searchTerm, branchFilter, inspectionsList]);

  // Export Assessment log report
  const handleExportAssessmentReport = () => {
    const exportData = assessments.flatMap((asm, asmIdx) => {
      const linkedInc = incidents.find(inc => inc.PID === asm.incidentId);
      const subItemsList = asm.subItems || [];
      const minorTaskRepairerName = resolveMinorTaskRepairerName(asm);
      
      const refDetails = {
        "ລະຫັດ PID (PID)": asm.incidentId || linkedInc?.PID || "",
        "ລະຫັດກວດກາ (Inspection Ref)": asm.inspectionId || linkedInc?.ລະຫັດກວດກາ || "N/A",
        "ຮູບແບບການກວດ (Inspection Type)": asm.inspectionType || linkedInc?.ຮູບແບບການກວດ || "",
        "ລະບົບທີ່ກວດ (System Category)": asm.systemCategory || linkedInc?.ລະບົບທີ່ກວດ || "",
        "ພື້ນທີ່/ຈຸດກວດ ( Area / Point)": asm.subsystemCategory || (linkedInc ? getResolvedSubsystemCategory(linkedInc) : ""),
        "ສາຂາ (Branch)": asm.branch || linkedInc?.["ສາຂາ "] || "",
        "ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)": asm.division || linkedInc?.["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "",
        "ຂະແໜງ (Sector)": normalizeCaseSector(asm.sector || linkedInc?.ຂະແໜງ || ""),
        [LOCATION_FLOOR_LABEL]: asm.roomOrLocation || linkedInc?.ສະຖານທີ່_ຫ້ອງ || "—",
        "ລະຫັດຊັບສິນ (Asset Code)": asm.assetCode || linkedInc?.ລະຫັດຊັບສິນ || "",
        "ລາຍການຊັບສິນ (Asset Name)": asm.assetName || linkedInc?.ລາຍການ || "",
        "ໝວດລາຍການ (Asset Group)": asm.itemType || linkedInc?.ໝວດລາຍການ || "",
        "ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)": asm.issueDetails || linkedInc?.ລາຍລະອຽດປັນຫາທີ່ພົບ || "",
        "ປະເມີນຜົນກະທົບ (Impact Level)": asm.impactLevel || linkedInc?.ປະເມີນຜົນກະທົບ || "",
        "ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)": asm.proposedSolution || linkedInc?.ວີທີແກ້ໄຂ || "",
        "ຜູ້ປະເມີນ (Assessor)": asm.assessorName || "",
        "ປະເພດຜູ້ປະເມີນ": asm.assessorType || "",
        "ວັນທີປະເມີນ (Date)": asm.assessmentDate || ""
      };

      if (subItemsList.length === 0) {
        return [{
          "ລຳດັບ (No.)": String(asmIdx + 1),
          "ລະຫັດໃບປະເມີນ (Assessment ID)": asm.assessmentId,
          ...refDetails,
          "ໝວດຍ່ອຍສ້ອມ (Repair Sub Category)": "—",
          "ລາຍການສ້ອມຍ່ອຍ (Repair Sub Item)": "ບໍ່ມີ",
          "ຮູບແບບ (Work Type)": "—",
          "ປະເພດຜູ້ສ້ອມ (Repairer Type)": asm.assessorType || "",
          "ຊື່ພະນັກງານຜູ້ສ້ອມ (Internal Repairer)":
            asm.assessorType === 'Vendor' ? '' : minorTaskRepairerName,
          "ຊື່ບໍລິສັດ/ຜູ້ຮັບເໝົາ (Vendor)":
            asm.assessorType === 'Vendor' ? minorTaskRepairerName : '',
          "ແຫຼ່ງອະໄຫຼ່ (Part Source)": "—",
          "ຊື່ອະໄຫຼ່ (Spare Part)": "—",
          "ຈຳນວນ (Qty)": 0,
          "ຫົວໜ່ວຍ (Unit)": "—",
          "ລາຄາຕໍ່ໜ່ວຍ (Estimated Unit Cost)": 0,
          "ລາຄາລວມ (Estimated Total Cost)": 0,
          "ໝາຍເຫດ (Remark)": asm.assessmentRemark || "",
          "ສະຖານະ (Status)": asm.assessmentStatus
        }];
      }

      return subItemsList.map((sub, subIdx) => ({
        "ລຳດັບ (No.)": `${asmIdx + 1}.${subIdx + 1}`,
        "ລະຫັດໃບປະເມີນ (Assessment ID)": asm.assessmentId,
        ...refDetails,
        "ໝວດຍ່ອຍສ້ອມ (Repair Sub Category)": sub.repairSubCategory || "ລະບົບໄຟຟ້າ",
        "ລາຍການສ້ອມຍ່ອຍ (Repair Sub Item)": sub.repairSubItem,
        "ຮູບແບບ (Work Type)": sub.workType,
        "ປະເພດຜູ້ສ້ອມ (Repairer Type)": sub.repairerType || "ຊ່າງພາຍໃນ",
        "ຊື່ພະນັກງານຜູ້ສ້ອມ (Internal Repairer)": sub.internalRepairerName || "",
        "ຊື່ບໍລິສັດ/ຜູ້ຮັບເໝົາ (Vendor)": sub.vendorName || "",
        "ແຫຼ່ງອະໄຫຼ່ (Part Source)": sub.partSource,
        "ຊື່ອະໄຫຼ່ (Spare Part)": sub.sparePart || "",
        "ຈຳນວນ (Qty)": sub.quantity || 0,
        "ຫົວໜ່ວຍ (Unit)": sub.unit || "",
        "ລາຄາຕໍ່ໜ່ວຍ (Estimated Unit Cost)": sub.estimatedUnitCost || 0,
        "ລາຄາລວມ (Estimated Total Cost)": sub.estimatedTotalCost || 0,
        "ໝາຍເຫດ (Remark)": asm.assessmentRemark || "",
        "ສະຖານະ (Status)": asm.assessmentStatus
      }));
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const cols = [];
    for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
      let maxLen = 10;
      for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
        const cell = worksheet[XLSX.utils.encode_cell({ r: rowNum, c: colNum })];
        if (cell && cell.v) {
          const valStr = String(cell.v);
          if (valStr.length > maxLen) maxLen = valStr.length;
        }
      }
      cols.push({ wch: maxLen + 2 });
    }
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ລາຍການປະເມີນ");
    XLSX.writeFile(workbook, `ລາຍງານການປະເມີນລາຍການສ້ອມ_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-850 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-[#C5A059]" />
            ປະເມີນລາຍການສ້ອມແປງ (Repair Assessment)
          </h3>
          <p className="text-xs text-slate-500">
            ໃຊ້ໃຫ້ຊ່າງເຕັກນິກພາຍໃນ ຫຼື Vendor ປະເມີນລາຍລະອຽດການສ້ອມແປງ, ແຫຼ່ງອະໄຫຼ່, ແລະ ຄ່າໃຊ້ຈ່າຍ ກ່ອນການສະເໜີອະນຸມັດ
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            onClick={handleExportAssessmentReport}
            className="flex items-center justify-center p-3 text-xs font-bold rounded-xl text-emerald-800 bg-emerald-50 border border-emerald-150 hover:bg-emerald-100 transition shadow-sm cursor-pointer"
          >
            <Download className="h-4 w-4 mr-1.5 text-emerald-600" />
            ດາວໂຫຼດ Excel ປະເມີນ (Export)
          </button>
        </div>
      </div>

      {/* Intro info box */}
      <div className="bg-gradient-to-r from-[#071827] to-[#10152f] border border-indigo-300/25 p-4 rounded-xl flex items-start space-x-3 text-xs text-indigo-200 animate-fadeIn">
        <Info className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-indigo-950">⚙️ ຂັ້ນຕອນການປະເມີນ (Assessment Guidelines)</p>
          <p className="text-slate-650 font-medium leading-relaxed">
            1. ເລືອກລາຍການເຫດການທີ່ລໍຖ້າປະເມີນ ຈາກລາຍຊື່ດ້ານລຸ່ມ ແລະ ຄລິກ **"ປະເມີນ / ຕື່ມລາຍການສ້ອມ"**.<br/>
            2. ລະບຸລາຍການສ້ອມຍ່ອຍ, ປະເພດວຽກ, ແລະ ແຫຼ່ງອະໄຫຼ່ (Stock / Purchase New / Vendor).<br/>
            3. ລະບົບຈະກວດສອບຄວາມສອດຄ່ອງຂອງລາຄາ ແລະ ອະໄຫຼ່ ຕາມເງື່ອນໄຂແຫຼ່ງອະໄຫຼ່ອັດຕະໂນມັດ.<br/>
            4. ສາມາດກົດ **"ບັນທຶກສະບັບຮ່າງ"** ເພື່ອແກ້ໄຂຕໍ່ພາຍຫຼັງ ຫຼື **"ສົ່ງປະເມີນ (Submit)"** ເພື່ອສົ່ງໄປໃຫ້ຜູ້ມີອຳນາດອະນຸມັດການສ້ອມແປງ.
          </p>
        </div>
      </div>

      {/* Query Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-150 shadow-sm space-y-3">
        <div className="flex items-center gap-1 text-xs font-bold text-slate-800">
          <Filter className="h-4 w-4 text-[#C5A059]" />
          <span>ຄົ້ນຫາ ແລະ ກັ່ນຕອງຂໍ້ມູນເຫດການ</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ຄົ້ນຫາລະຫັດ, ຊັບສິນ, ບັນຫາ..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-250 bg-slate-50/50 text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={currentUser.status !== "Admin"}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-250 bg-slate-50/50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition disabled:opacity-75"
            >
              <option value="ALL">ທຸກສາຂາ / ທຸກໜ່ວຍບໍລິການ</option>
              {BRANCHES.map((b, i) => (
                <option key={i} value={b.ສາຂາ}>{b.ສາຂາ}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-250 bg-slate-50/50 text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            >
              <option value="ALL">ທຸກສະຖານະທີ່ລໍຖ້າປະເມີນ (All Pending)</option>
              <option value="pending">ລໍຖ້າປະເມີນ ແລະ ກຳລັງປະເມີນ</option>
              <option value="ລໍຖ້າປະເມີນລາຍການສ້ອມ">ລໍຖ້າປະເມີນລາຍການສ້ອມ</option>
              <option value="ກຳລັງປະເມີນ">ກຳລັງປະເມີນ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Incidents Table / List */}
      <div className="bg-white rounded-xl border border-slate-150 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-150 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-850 flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
            ບັນຊີລາຍການເຫດການທີ່ຕ້ອງການປະເມີນ ({filteredIncidents.length} ລາຍການ)
          </span>
        </div>

        {filteredIncidents.length > 0 ? (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-550 font-bold border-b border-slate-200 text-[10px] uppercase tracking-wider">
                  <th className="p-3.5 text-center w-12">ລ/ດ</th>
                  <th className="p-3.5">ລະຫັດກວດກາ</th>
                  <th className="p-3.5">ສາຂາ / ທີ່ຕັ້ງ</th>
                  <th className="p-3.5">ຊັບສິນ</th>
                  <th className="p-3.5">ລາຍລະອຽດບັນຫາ</th>
                  <th className="p-3.5 text-center">ລະດັບຄວາມສ່ຽງ</th>
                  <th className="p-3.5 text-center">ວັນທີ່ແຈ້ງ</th>
                  <th className="p-3.5 text-center">ສະຖານະ</th>
                  <th className="p-3.5 text-center w-36">ຈັດການ / ປະເມີນ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredIncidents.map((inc, index) => {
                  const isHigh = inc.ປະເມີນຜົນກະທົບ === "ສູງ";
                  const isMedium = inc.ປະເມີນຜົນກະທົບ === "ປານກາງ";
                  const sStatus = inc.ສະຖານະ || "ລໍຖ້າປະເມີນລາຍການສ້ອມ";
                  
                  // Check if there is an assessment associated
                  const assessment = assessments.find(asm => asm.incidentId === inc.PID);

                  return (
                    <tr key={index} className="hover:bg-slate-50/50 transition duration-150">
                      <td className="p-3.5 text-center font-semibold text-slate-400">{index + 1}</td>
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {inc.ລະຫັດກວດກາ || "INC-REPORT"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-800">{inc["ສາຂາ "]}</p>
                        <p className="text-[10px] text-slate-500">{inc.ສະຖານທີ່_ຫ້ອງ && inc.ສະຖານທີ່_ຫ້ອງ !== "ບໍ່ລະບຸ" ? `🚪 ${inc.ສະຖານທີ່_ຫ້ອງ}` : "—"}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-800">{inc.ລາຍການ || "ບໍ່ມີຊັບສິນ"}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">Code: {inc.ລະຫັດຊັບສິນ}</span>
                          {inc.ໝວດລາຍການ && (
                            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1 py-0.2 rounded border border-indigo-100">
                              {inc.ໝວດລາຍການ}
                            </span>
                          )}
                          <span className="text-[10px] text-indigo-600 font-bold ml-1">
                            {inc.ລະບົບທີ່ກວດ || "—"} / {getResolvedSubsystemCategory(inc) || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <p className="font-medium text-slate-800 max-w-xs truncate" title={inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}>
                          {inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}
                        </p>
                        <p className="text-[10px] text-red-600 font-semibold truncate max-w-xs" title={inc.ວີທີແກ້ໄຂ}>
                          ສະເໜີ: {inc.ວີທີແກ້ໄຂ || "ລໍຖ້າກວດສອບ"}
                        </p>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isHigh ? 'bg-red-50 text-red-600 border border-red-100 animate-pulse' :
                          isMedium ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {inc.ປະເມີນຜົນກະທົບ || "ຕ່ຳ"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-500">
                        {formatExcelDate(inc.ວັນທີ່ກວດ)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadgeClass(sStatus)}`}>
                          {sStatus}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {assessment ? (
                            <>
                              <button
                                onClick={() => setViewingAssessment(assessment)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition text-[11px] cursor-pointer"
                                title="ເບິ່ງລາຍລະອຽດການປະເມີນ"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                ເບິ່ງ
                              </button>
                              {sStatus !== "ອະນຸມັດແລ້ວ" && sStatus !== "ສຳເລັດ" && (
                                <button
                                  onClick={() => handleOpenAssess(inc)}
                                  className="bg-indigo-50 hover:bg-indigo-150 text-indigo-700 border border-indigo-150 font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition text-[11px] cursor-pointer"
                                  title="ແກ້ໄຂການປະເມີນ"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  ແກ້ໄຂ
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleOpenAssess(inc)}
                              className="bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 transition text-[11px] cursor-pointer shadow-sm"
                            >
                              <Hammer className="h-3.5 w-3.5 text-amber-400" />
                              ປະເມີນ / ຕື່ມລາຍການສ້ອມ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-24 bg-white m-2 rounded-xl border border-dashed border-slate-250">
            <span className="text-3xl mb-1.5">✨</span>
            <p className="font-bold text-xs text-slate-500">ບໍ່ມີລາຍການຄົງຄ້າງທີ່ລໍຖ້າການປະເມີນໃນໝວດນີ້</p>
          </div>
        )}
      </div>

      {/* 2. Completed Assessments History Section */}
      <div className="bg-white rounded-xl border border-slate-150 shadow-sm overflow-hidden mt-6">
        <div className="px-5 py-3.5 bg-slate-50/60 border-b border-slate-150 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-850 flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
            ລາຍການປະຫວັດທີ່ປະເມີນແລ້ວ (Assessment History) ({completedAssessments.length} ລາຍການ)
          </span>
        </div>

        {completedAssessments.length > 0 ? (
          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-[10px] uppercase tracking-wider font-bold">
                  <th className="p-3.5 text-center w-12">ລ/ດ</th>
                  <th className="p-3.5">ລະຫັດກວດກາ / PID</th>
                  <th className="p-3.5">ສາຂາ / ທີ່ຕັ້ງ</th>
                  <th className="p-3.5">ຊັບສິນ & ໝວດໝູ່</th>
                  <th className="p-3.5">ຜູ້ປະເມີນ / ວັນທີ</th>
                  <th className="p-3.5 text-right">ມູນຄ່າປະເມີນລວມ</th>
                  <th className="p-3.5 text-center">ສະຖານະປະເມີນ</th>
                  <th className="p-3.5 text-center w-36">ຈັດການ / ເບິ່ງລາຍລະອຽດ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {completedAssessments.map((asm, index) => {
                  const linkedInc = incidents.find(inc => inc.PID === asm.incidentId);
                  const branchVal = linkedInc ? (linkedInc["ສາຂາ "] || linkedInc["ສາຂາ"] || 'ບໍ່ລະບຸ') : (asm.division || 'ບໍ່ລະບຸ');
                  const roomVal = linkedInc ? (linkedInc.ສະຖານທີ່_ຫ້ອງ || '') : (asm.roomOrLocation || '');
                  const totalCost = (asm.subItems || []).reduce((acc, curr) => acc + (curr.estimatedTotalCost || 0), 0);
                  const incidentStatus = linkedInc?.ສະຖານະ || "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ";

                  return (
                    <tr key={asm.incidentId || index} className="hover:bg-slate-50/50 transition duration-150">
                      <td className="p-3.5 text-center font-semibold text-slate-400">{index + 1}</td>
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-indigo-750 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] block w-fit mb-1">
                          {asm.inspectionId || "INC-REPORT"}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400">PID: {asm.incidentId}</span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-800">{branchVal}</p>
                        {roomVal && roomVal !== "ບໍ່ລະບຸ" && (
                          <p className="text-[10px] text-slate-500">🚪 {roomVal}</p>
                        )}
                      </td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-800">{asm.assetName || "ບໍ່ມີຊື່ຊັບສິນ"}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">Code: {asm.assetCode}</span>
                          {asm.itemType && (
                            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1 rounded border border-indigo-100">
                              {asm.itemType}
                            </span>
                          )}
                          <span className="text-[10px] text-indigo-600 font-bold">
                            {asm.systemCategory || "—"} / {asm.subsystemCategory || "—"}
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-slate-800">{asm.assessorName || "ບໍ່ລະບຸ"}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{asm.assessorType || "ຊ່າງພາຍໃນ"} | 📅 {asm.assessmentDate}</p>
                      </td>
                      <td className="p-3.5 text-right font-bold font-mono text-indigo-950">
                        {formatLAK(totalCost)}
                      </td>
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          asm.assessmentStatus === "No Assessment Required" ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}>
                          {asm.assessmentStatus || "ປະເມີນແລ້ວ"}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingAssessment(asm)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition text-[11px] cursor-pointer"
                            title="ເບິ່ງລາຍລະອຽດການປະເມີນ"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            ເບິ່ງ
                          </button>
                          {linkedInc && incidentStatus !== "ອະນຸມັດແລ້ວ" && incidentStatus !== "ສຳເລັດ" && (
                            <button
                              onClick={() => handleOpenAssess(linkedInc)}
                              className="bg-indigo-50 hover:bg-indigo-150 text-indigo-700 border border-indigo-150 font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition text-[11px] cursor-pointer"
                              title="ແກ້ໄຂການປະເມີນ"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              ແກ້ໄຂ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center py-16 bg-white m-2 rounded-xl border border-dashed border-slate-250">
            <span className="text-3xl mb-1.5">📜</span>
            <p className="font-bold text-xs text-slate-500">ບໍ່ມີປະຫວັດລາຍການທີ່ປະເມີນແລ້ວໃນໝວດນີ້</p>
          </div>
        )}
      </div>

      {/* ASSESSMENT EDIT MODAL */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-2xl w-full max-w-[95%] xl:max-w-7xl max-h-[92vh] flex flex-col shadow-2xl border border-indigo-150 animate-scaleUp">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-t-2xl">
              <div className="flex items-center space-x-2.5">
                <Hammer className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base">ຟອມປະເມີນລາຍການສ້ອມແປງ (Assessment Entry)</h4>
                  <p className="text-[10px] text-slate-300">
                    ລະຫັດເຫດການ: {selectedIncident.ລະຫັດກວດກາ} | PID: {selectedIncident.PID}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedIncident(null)}
                className="text-slate-300 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {isAlreadyInTracking && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3.5 animate-fadeIn">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1 text-xs">
                    <h5 className="font-bold text-amber-900">ລາຍການນີ້ຢູ່ໃນຂັ້ນຕອນການຕິດຕາມແລ້ວ (Already in Repair Tracking)</h5>
                    <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                      ອໍເດີນີ້ໄດ້ຮັບການອະນຸມັດ ແລະ ຢູ່ລະຫວ່າງການດຳເນີນງານຕິດຕາມການສ້ອມແປງແລ້ວ. ຂໍ້ມູນການປະເມີນຈະສະແດງເປັນ **ອ່ານຢ່າງດຽວ (Read-Only)** ເພື່ອປ້ອງກັນການແກ້ໄຂຂໍ້ມູນຊ້ຳຊ້ອນ.
                    </p>
                  </div>
                </div>
              )}

              {errorAlert && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3.5 animate-fadeIn">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <h5 className="font-bold text-xs text-rose-900">ພົບຂໍ້ຜິດພາດໃນການກວດສອບ (Validation Error)</h5>
                    <p className="text-[11px] text-rose-700 font-medium leading-relaxed">{errorAlert}</p>
                  </div>
                  <button 
                    onClick={() => setErrorAlert(null)}
                    className="text-rose-400 hover:text-rose-600 transition p-1 cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>
              )}
              
              {/* Row 1: Read-Only Incident Info */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  <span>ຂໍ້ມູນອ້າງອີງຈາກຕົ້ນທາງ (Original Reference Details - Read-Only)</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-[11px] leading-relaxed">
                  <div>
                    <span className="text-slate-400 block font-semibold">Incident ID / PID:</span>
                    <strong className="text-slate-800 font-bold">{selectedIncident.PID}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">Inspection ID:</span>
                    <strong className="text-slate-800 font-bold">{selectedIncident.ລະຫັດກວດກາ || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ຮູບແບບການກວດ:</span>
                    <strong className="text-slate-800 font-bold">{getCaseReference(selectedIncident).inspectionType || "ບໍ່ລະບຸ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ລະບົບທີ່ກວດ (System Category):</span>
                    <strong className="text-indigo-900 font-bold">{getCaseReference(selectedIncident).systemCategory || "ບໍ່ລະບຸ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ພື້ນທີ່/ຈຸດກວດ ( Area / Point):</span>
                    <strong className="text-indigo-900 font-bold">{getResolvedSubsystemCategory(selectedIncident)}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] leading-relaxed border-t border-slate-150 pt-3">
                  <div>
                    <span className="text-slate-400 block font-semibold">ສາຂາ (Branch):</span>
                    <strong className="text-slate-800 font-bold">{getCaseReference(selectedIncident).branch || "ບໍ່ລະບຸ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ຝ່າຍ / ໜ່ວຍບໍລິການ:</span>
                    <strong className="text-slate-800 font-bold">{getCaseReference(selectedIncident).division || "ບໍ່ລະບຸ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ຂະແໜງ (Sector):</span>
                    <strong className="text-slate-800 font-bold">{getCaseReference(selectedIncident).sector || "ບໍ່ລະບຸ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">{LOCATION_FLOOR_LABEL}:</span>
                    <strong className="text-slate-800 font-bold">🚪 {getCaseReference(selectedIncident).roomLocation || "—"}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[11px] leading-relaxed border-t border-slate-150 pt-3">
                  <div>
                    <span className="text-slate-400 block font-semibold">ລະຫັດຊັບສິນ (Asset Code):</span>
                    <strong className="text-slate-800 font-bold">{selectedIncident.ລະຫັດຊັບສິນ || "ບໍ່ມີລະຫັດ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ໝວດລາຍການ (Item Type):</span>
                    <strong className="text-indigo-950 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150 text-[10px] inline-block">{selectedIncident.ໝວດລາຍການ || "ບໍ່ລະບຸ"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ຊື່ຊັບສິນ (Asset Name):</span>
                    <strong className="text-slate-850 font-bold text-xs">{selectedIncident.ລາຍການ || "none"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ລະດັບຜົນກະທົບ / ຜູ້ແຈ້ງ:</span>
                    <strong className="text-slate-800 font-bold">
                      ⚠️ {selectedIncident.ປະເມີນຜົນກະທົບ || "ປານກາງ"} | {selectedIncident.ຊື່ຜູ້ກວດ} ({formatExcelDate(selectedIncident.ວັນທີ່ກວດ)})
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px] leading-relaxed border-t border-slate-150 pt-3">
                  <div>
                    <span className="text-slate-400 block font-semibold">ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details):</span>
                    <p className="text-slate-800 font-medium bg-slate-100/60 p-2 rounded-lg border border-slate-200 whitespace-pre-wrap">{selectedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-semibold">ວິທີແກ້ໄຂສະເໜີ (Proposed Solution):</span>
                    <p className="text-indigo-900 font-semibold bg-indigo-50/60 p-2 rounded-lg border border-indigo-100 whitespace-pre-wrap">{selectedIncident.ວີທີແກ້ໄຂ || "ລໍຖ້າກວດສອບ"}</p>
                  </div>
                </div>
              </div>

              {/* Row 2: Assessor Details Form */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 border-b border-slate-200 pb-1.5">
                  <User className="h-4 w-4 text-[#C5A059]" />
                  <span>ຂໍ້ມູນຜູ້ປະເມີນ (Assessor Details)</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ຊື່ຜູ້ປະເມີນ (Assessor Name) *</label>
                    <input
                      type="text"
                      disabled={isAlreadyInTracking}
                      value={assessorName}
                      onChange={(e) => setAssessorName(e.target.value)}
                      placeholder="ຊື່ຜູ້ປະເມີນ..."
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-250 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>

                  {isAssessmentLevelRepairerVisible(noAssessmentRequired) && (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          ປະເພດຜູ້ສ້ອມ (Repairer Type) *
                        </label>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg h-9">
                          <button
                            type="button"
                            disabled={isAlreadyInTracking}
                            onClick={() => {
                              setAssessorType('ຊ່າງພາຍໃນ');
                              setMinorTaskRepairerName('');
                              setVendorName('');
                            }}
                            className={`flex-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                              assessorType === 'ຊ່າງພາຍໃນ'
                                ? 'bg-white text-indigo-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            ຊ່າງພາຍໃນ
                          </button>
                          <button
                            type="button"
                            disabled={isAlreadyInTracking}
                            onClick={() => {
                              setAssessorType('Vendor');
                              setMinorTaskRepairerName('');
                              setVendorName('');
                            }}
                            className={`flex-1 text-[11px] font-bold rounded-md transition cursor-pointer ${
                              assessorType === 'Vendor'
                                ? 'bg-white text-indigo-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Vendor
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          {assessorType === 'Vendor'
                            ? 'ຊື່ບໍລິສັດ / Vendor *'
                            : 'ຊື່ພະນັກງານຜູ້ສ້ອມ *'}
                        </label>
                        <input
                          type="text"
                          disabled={isAlreadyInTracking}
                          value={minorTaskRepairerName}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMinorTaskRepairerName(value);
                            setVendorName(assessorType === 'Vendor' ? value : '');
                          }}
                          placeholder={
                            assessorType === 'Vendor'
                              ? 'ຊື່ບໍລິສັດຜູ້ຮັບເໝົາ'
                              : 'ຊື່ພະນັກງານ / ຊ່າງ'
                          }
                          className="w-full h-9 px-3 text-xs rounded-lg border border-slate-250 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">ວັນທີປະເມີນ (Date) *</label>
                    <input
                      type="date"
                      disabled={isAlreadyInTracking}
                      value={assessmentDate}
                      onChange={(e) => setAssessmentDate(e.target.value)}
                      className="w-full h-9 px-3 text-xs rounded-lg border border-slate-250 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="checkbox"
                    id="noAssessmentRequired"
                    disabled={isAlreadyInTracking}
                    checked={noAssessmentRequired}
                    onChange={(e) => {
                      const nextMode = switchAssessmentMode({
                        noAssessmentRequired: e.target.checked,
                        assessorType,
                        minorTaskRepairerName,
                        vendorName,
                        subItems,
                      });
                      setNoAssessmentRequired(nextMode.noAssessmentRequired);
                      setAssessorType(nextMode.assessorType as AssessmentRepairerType);
                      setMinorTaskRepairerName(nextMode.minorTaskRepairerName);
                      setVendorName(nextMode.vendorName);
                      setSubItems(nextMode.subItems);
                    }}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="noAssessmentRequired" className="text-[11px] font-bold text-amber-700 cursor-pointer">
                    ⚠️ ວຽກນ້ອຍ ບໍ່ຈຳເປັນປະເມີນ (Minor task - No Assessment Required)
                  </label>
                </div>
              </div>

              {/* Row 3: Sub Items Costing Form */}
              <fieldset disabled={isAlreadyInTracking} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-150 pb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                    <Wrench className="h-4 w-4 text-[#C5A059]" />
                    <span>ລາຍການສ້ອມແປງຍ່ອຍ ແລະ ປະເມີນຄ່າໃຊ້ຈ່າຍ (Repair Sub-Items & Costing)</span>
                  </div>
                  {!noAssessmentRequired && (
                    <button
                      type="button"
                      onClick={handleAddSubItemRow}
                      className="bg-indigo-600 hover:bg-indigo-800 text-white font-bold py-1.5 px-3.5 rounded-xl flex items-center gap-1 transition text-[11px] cursor-pointer shadow-sm w-fit"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      ເພີ່ມລາຍການສ້ອມ (Add Item)
                    </button>
                  )}
                </div>

                {noAssessmentRequired ? (
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-xl text-center">
                    <span className="text-2xl">💡</span>
                    <h5 className="text-xs font-bold text-amber-900 mt-1">ກຳນົດເປັນວຽກນ້ອຍ (Set as Minor task)</h5>
                    <p className="text-[10px] text-amber-700 mt-1 leading-relaxed">
                      ທ່ານໄດ້ເລືອກ "ບໍ່ຈຳເປັນປະເມີນ" ສຳລັບວຽກງານນີ້. ລະບົບຈະບໍ່ມີການບັນທຶກລາຍການອະໄຫຼ່ ຫຼື ຄ່າໃຊ້ຈ່າຍ ແລະຈະດຳເນີນງານຂັ້ນຕອນຕໍ່ໄປທັນທີ.
                    </p>
                  </div>
                ) : subItems.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-sm">
                    <table className="min-w-[1550px] w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 text-[11px] h-9">
                          <th className="p-1.5 text-center w-10 align-middle">#</th>
                          <th className="p-1.5 w-48 align-middle whitespace-nowrap">ໝວດຍ່ອຍ *</th>
                          <th className="p-1.5 w-56 align-middle whitespace-nowrap">ລາຍການສ້ອມຍ່ອຍ *</th>
                          <th className="p-1.5 w-72 align-middle whitespace-nowrap">ຊື່ອະໄຫຼ່ / ຄ່າບໍລິການ *</th>
                          <th className="p-1.5 w-52 align-middle whitespace-nowrap">ແຫຼ່ງອະໄຫຼ່ (Source) *</th>
                          <th className="p-1.5 w-32 align-middle whitespace-nowrap">ຮູບແບບ *</th>
                          <th className="p-1.5 w-36 align-middle whitespace-nowrap">ປະເພດຜູ້ສ້ອມ *</th>
                          <th className="p-1.5 w-52 align-middle whitespace-nowrap">ຊື່ຜູ້ສ້ອມ / ບໍລິສັດ *</th>
                          <th className="p-1.5 w-20 text-center align-middle whitespace-nowrap">ຈຳນວນ</th>
                          <th className="p-1.5 w-24 align-middle whitespace-nowrap">ຫົວໜ່ວຍ</th>
                          <th className="p-1.5 w-36 align-middle whitespace-nowrap">ລາຄາຕໍ່ໜ່ວຍ</th>
                          <th className="p-1.5 w-36 text-right align-middle whitespace-nowrap">ລາຄາລວມ</th>
                          <th className="p-1.5 text-center w-12 align-middle">ລຶບ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {subItems.map((item, index) => {
                          const isStock = item.partSource === 'Stock';
                          const isPurchase = item.partSource === 'Purchase New';
                          const isVendor = item.partSource === 'Vendor';
                          const isNoPart = item.partSource === 'No Part Required';

                          const masterPresets = getSavedRepairPresets();
                          const masterSpareParts = Array.from(new Set(masterPresets.map(p => p.sparePart).filter(Boolean)));
                          const repairCategoryOptions = getRepairSubCategoryOptions(masterPresets);

                          const currentCat = normalizeRepairSubCategory(item.repairSubCategory || '');
                          const currentSubItem = item.repairSubItem || '';
                          const currentSparePart = item.sparePart || '';
                          const isUnknownLegacyCategory = Boolean(
                            currentCat && !repairCategoryOptions.includes(currentCat),
                          );

                          let filteredSubItems: string[] = [];
                          if (currentCat) {
                            filteredSubItems = Array.from(new Set(
                              masterPresets
                                .filter(p => normalizeRepairSubCategory(p.repairSubCategory) === currentCat)
                                .map(p => p.repairSubItem)
                                .filter(Boolean)
                            ));
                          } else {
                            filteredSubItems = Array.from(new Set(
                              masterPresets.map(p => p.repairSubItem).filter(Boolean)
                            ));
                          }

                          let filteredSpareParts: string[] = [];
                          if (currentCat && currentSubItem) {
                            filteredSpareParts = Array.from(new Set(
                              masterPresets
                                .filter(
                                  p =>
                                    normalizeRepairSubCategory(p.repairSubCategory) === currentCat
                                    && p.repairSubItem === currentSubItem,
                                )
                                .map(p => p.sparePart)
                                .filter(Boolean)
                            ));
                          } else if (currentCat) {
                            filteredSpareParts = Array.from(new Set(
                              masterPresets
                                .filter(p => normalizeRepairSubCategory(p.repairSubCategory) === currentCat)
                                .map(p => p.sparePart)
                                .filter(Boolean)
                            ));
                          } else {
                            filteredSpareParts = masterSpareParts;
                          }

                          const partMatchesCount = currentSparePart ? masterPresets.filter(p => p.sparePart === currentSparePart).length : 0;

                          const inputStyle = "w-full h-[30px] px-2 py-0.5 text-[11px] rounded-lg border border-slate-200 outline-none bg-white focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 transition-all";
                          const selectStyle = "w-full h-[30px] px-1 py-0.5 text-[11px] rounded-lg border border-slate-200 outline-none bg-white focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800 transition-all";

                          return (
                            <tr key={item.id} className="hover:bg-slate-50/40">
                              <td className="p-1.5 text-center text-slate-400 font-semibold align-middle">{index + 1}</td>
                              
                              {/* 1. Repair Sub Category */}
                              <td className="p-1.5 align-middle">
                                <select
                                  value={currentCat || 'ລະບົບໄຟຟ້າ'}
                                  onChange={(e) => {
                                    const newCat = e.target.value;
                                    setSubItems(subItems.map(row => {
                                      if (row.id === item.id) {
                                        return {
                                          ...row,
                                          repairSubCategory: newCat,
                                          repairSubItem: '', // reset on category change
                                          workType: 'ກວດເຊັກ-ສ້ອມ',
                                          sparePart: '',
                                          unit: 'ອັນ'
                                        };
                                      }
                                      return row;
                                    }));
                                  }}
                                  className={selectStyle}
                                >
                                  {repairCategoryOptions.map(category => (
                                    <option key={category} value={category}>{category}</option>
                                  ))}
                                  {isUnknownLegacyCategory && (
                                    <option value={currentCat}>{currentCat}</option>
                                  )}
                                </select>
                              </td>

                              {/* 2. Sub item desc */}
                              <td className="p-1.5 align-middle">
                                <select
                                  value={item.repairSubItem || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleSubItemSelect(item.id, val);
                                  }}
                                  className={selectStyle}
                                >
                                  <option value="">-- ເລືອກລາຍການສ້ອມຍ່ອຍ --</option>
                                  {filteredSubItems.map(subName => (
                                    <option key={subName} value={subName}>
                                      {subName}
                                    </option>
                                  ))}
                                  {item.repairSubItem && !filteredSubItems.includes(item.repairSubItem) && (
                                    <option value={item.repairSubItem}>{item.repairSubItem}</option>
                                  )}
                                </select>
                              </td>

                              {/* 3. Spare Part */}
                              <td className="p-1.5 align-middle">
                                <div className="space-y-1">
                                  <select
                                    value={masterSpareParts.includes(item.sparePart || '') ? (item.sparePart || '') : (item.sparePart ? 'custom' : '')}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'custom') {
                                        handleSubItemChange(item.id, 'sparePart', '');
                                      } else {
                                        handleSparePartSelect(item.id, val);
                                      }
                                    }}
                                    className={`${selectStyle} disabled:bg-slate-100 disabled:opacity-60`}
                                  >
                                    <option value="">-- ເລືອກອະໄຫຼ່/ຄ່າບໍລິການ --</option>
                                    {filteredSpareParts.map(sp => (
                                      <option key={sp} value={sp}>{sp}</option>
                                    ))}
                                    {item.sparePart && !filteredSpareParts.includes(item.sparePart) && item.sparePart !== '' && (
                                      <option value={item.sparePart}>{item.sparePart}</option>
                                    )}
                                    <option value="custom">✍️ ປ້ອນເອງ (Custom)...</option>
                                  </select>

                                  {/* Show text input for custom entry or if custom is selected */}
                                  {(!masterSpareParts.includes(item.sparePart || '') || item.sparePart === '') && (
                                    <input
                                      type="text"
                                      value={item.sparePart || ''}
                                      onChange={(e) => handleSubItemChange(item.id, 'sparePart', e.target.value)}
                                      placeholder="ຊື່ອະໄຫຼ່/ຄ່າບໍລິການ..."
                                      className={inputStyle}
                                    />
                                  )}

                                  {/* Multi-mapping notification */}
                                  {partMatchesCount > 1 && (
                                    <span className="text-[9px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-100 block mt-1 font-medium">
                                      ⚠️ ມີ {partMatchesCount} ຕົວເລືອກລາຍການສ້ອມ
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 4. Part Source */}
                              <td className="p-1.5 align-middle">
                                <select
                                  value={item.partSource}
                                  onChange={(e) => handleSubItemChange(item.id, 'partSource', e.target.value)}
                                  className={`${selectStyle} font-semibold`}
                                >
                                  <option value="No Part Required">No Part Required</option>
                                  <option value="Stock">Stock (ເບີກສາງ ທພລ)</option>
                                  <option value="Purchase New">Purchase New (ຊື້ໃໝ່)</option>
                                  <option value="Vendor">Vendor (ຮັບເໝົາ/ສະໜອງ)</option>
                                </select>
                              </td>

                              {/* 5. Work Type */}
                              <td className="p-1.5 align-middle">
                                <select
                                  value={normalizeRepairAssessmentWorkType(item.workType)}
                                  onChange={(e) => handleSubItemChange(item.id, 'workType', e.target.value)}
                                  className={selectStyle}
                                >
                                  {REPAIR_ASSESSMENT_WORK_TYPES.map(workType => (
                                    <option key={workType} value={workType}>{workType}</option>
                                  ))}
                                </select>
                              </td>

                              {/* 6. Repairer Type */}
                              <td className="p-1.5 align-middle">
                                <select
                                  value={item.repairerType || 'ຊ່າງພາຍໃນ'}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    handleSubItemChange(item.id, 'repairerType', val);
                                    // Prepopulate or clear names on toggle
                                    if (val === 'ຊ່າງພາຍໃນ') {
                                      handleSubItemChange(item.id, 'internalRepairerName', currentUser?.username || '');
                                      handleSubItemChange(item.id, 'vendorName', '');
                                    } else {
                                      handleSubItemChange(item.id, 'internalRepairerName', '');
                                      handleSubItemChange(item.id, 'vendorName', vendorName || '');
                                    }
                                  }}
                                  className={`${selectStyle} font-semibold`}
                                >
                                  <option value="ຊ່າງພາຍໃນ">ຊ່າງພາຍໃນ</option>
                                  <option value="Vendor">Vendor</option>
                                </select>
                              </td>

                              {/* 7. Repairer Name Input (Conditional) */}
                              <td className="p-1.5 align-middle">
                                {item.repairerType === 'Vendor' ? (
                                  <input
                                    type="text"
                                    value={item.vendorName || ''}
                                    onChange={(e) => handleSubItemChange(item.id, 'vendorName', e.target.value)}
                                    placeholder="ຊື່ບໍລິສັດ ຫຼື ຜູ້ຮັບເໝົາ *"
                                    className={`${inputStyle} border-indigo-100`}
                                  />
                                ) : (
                                  <input
                                    type="text"
                                    value={item.internalRepairerName || ''}
                                    onChange={(e) => handleSubItemChange(item.id, 'internalRepairerName', e.target.value)}
                                    placeholder="ຊື່ຊ່າງພາຍໃນ ທພລ *"
                                    className={inputStyle}
                                  />
                                )}
                              </td>

                              {/* 8. Quantity */}
                              <td className="p-1.5 text-center align-middle">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  disabled={isNoPart}
                                  onChange={(e) => handleSubItemChange(item.id, 'quantity', Number(e.target.value))}
                                  className={`${inputStyle} text-center font-bold disabled:bg-slate-100 disabled:opacity-60`}
                                />
                              </td>

                              {/* 9. Unit */}
                              <td className="p-1.5 align-middle">
                                <input
                                  type="text"
                                  value={item.unit}
                                  disabled={isNoPart}
                                  onChange={(e) => handleSubItemChange(item.id, 'unit', e.target.value)}
                                  placeholder="ອັນ"
                                  className={`${inputStyle} disabled:bg-slate-100 disabled:opacity-60`}
                                />
                              </td>

                              {/* 10. Estimated Unit Cost */}
                              <td className="p-1.5 align-middle">
                                <input
                                  type="text"
                                  value={item.estimatedUnitCost === 0 || item.estimatedUnitCost === undefined ? '' : item.estimatedUnitCost}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                    const parsed = val === '' ? 0 : Number(val);
                                    handleSubItemChange(item.id, 'estimatedUnitCost', parsed);
                                  }}
                                  placeholder="0"
                                  className={`${inputStyle} font-semibold`}
                                />
                              </td>

                              {/* 11. Estimated Total Cost */}
                              <td className="p-1.5 text-right font-bold font-mono text-slate-800 text-[11px] align-middle whitespace-nowrap">
                                {formatLAK(item.estimatedTotalCost || 0)}
                              </td>

                              {/* 12. Remove button */}
                              <td className="p-1.5 text-center align-middle">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveSubItemRow(item.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition cursor-pointer"
                                  title="ລຶບລາຍການນີ້"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-450">
                    <p className="font-bold text-xs">ຍັງບໍ່ມີລາຍການສ້ອມແປງຍ່ອຍ</p>
                    <p className="text-[10px] text-slate-400">ກະລຸນາຄລິກປຸ່ມ "ເພີ່ມລາຍການສ້ອມ" ເພື່ອເລີ່ມລະບຸອະໄຫຼ່ ແລະ ຄ່າໃຊ້ຈ່າຍ</p>
                  </div>
                )}

                {/* Show grand total cost */}
                {subItems.length > 0 && (
                  <div className="flex justify-end p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-right space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ມູນຄ່າການປະເມີນລວມ (Grand Total Estimated Cost)</span>
                      <strong className="text-lg font-black font-mono text-indigo-900">
                        {formatLAK(subItems.reduce((acc, curr) => acc + (curr.estimatedTotalCost || 0), 0))}
                      </strong>
                    </div>
                  </div>
                )}
              </fieldset>

              {/* Row 4: Assessment Remark */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ໝາຍເຫດການປະເມີນ (Assessment Remark / Assessor Notes)</label>
                <textarea
                  value={assessmentRemark}
                  disabled={isAlreadyInTracking}
                  onChange={(e) => setAssessmentRemark(e.target.value)}
                  placeholder="ລະບຸໝາຍເຫດ ຫຼື ຄຳແນະນຳເພີ່ມເຕີມຈາກການປະເມີນ..."
                  rows={2}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-250 bg-slate-50 text-slate-800 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition resize-none disabled:bg-slate-100 disabled:opacity-75"
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-150 flex flex-col sm:flex-row sm:justify-between items-center gap-3 bg-slate-50/60 rounded-b-2xl">
              <span className="text-[10px] text-slate-500 font-semibold leading-normal">
                * ຫມາຍເຫດ: ລະບົບຈະກວດສອບຄວາມສອດຄ່ອງຂອງລາຄາ ແລະ ອະໄຫຼ່ ຕາມແຫຼ່ງອະໄຫຼ່ທີ່ເລືອກອັດຕະໂນມັດ.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedIncident(null)}
                  className="px-4 py-2.5 border border-slate-250 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-100 transition cursor-pointer"
                >
                  {isAlreadyInTracking ? "ປິດ (Close)" : "ຍົກເລີກ (Cancel)"}
                </button>
                {!isAlreadyInTracking && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSaveAssessmentSubmit(false)}
                      className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Save className="h-4 w-4" />
                      ບັນທຶກສະບັບຮ່າງ (Save Draft)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSaveAssessmentSubmit(true)}
                      className="px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"
                    >
                      <Check className="h-4 w-4 text-amber-300" />
                      ສົ່ງປະເມີນ (Submit for Approval)
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* VIEW DETAILS DIALOG */}
      {viewingAssessment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-800 rounded-2xl w-full max-w-[95%] xl:max-w-6xl max-h-[90vh] flex flex-col shadow-2xl animate-scaleUp">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-900 text-white rounded-t-2xl">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-[#C5A059]" />
                <div>
                  <h4 className="font-bold text-sm sm:text-base">ລາຍລະອຽດການປະເມີນສ້ອມແປງ (Assessment Summary)</h4>
                  <p className="text-[10px] text-slate-300">
                    ID ປະເມີນ: {viewingAssessment.assessmentId} | ວັນທີ: {viewingAssessment.assessmentDate}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setViewingAssessment(null)}
                className="text-slate-300 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Meta information */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-150">
                <div>
                  <span className="text-slate-400 font-semibold block">ຜູ້ປະເມີນ (Assessor)</span>
                  <strong className="text-slate-800 text-sm font-bold">{viewingAssessment.assessorName}</strong>
                </div>
                {viewingAssessment.assessmentStatus === 'No Assessment Required' && (
                  <>
                    <div>
                      <span className="text-slate-400 font-semibold block">ປະເພດຜູ້ສ້ອມ</span>
                      <strong className="text-slate-800 text-sm font-bold">
                        {viewingAssessment.assessorType || 'ຊ່າງພາຍໃນ'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 font-semibold block">
                        {viewingAssessment.assessorType === 'Vendor'
                          ? 'ບໍລິສັດ / Vendor'
                          : 'ຊື່ພະນັກງານຜູ້ສ້ອມ'}
                      </span>
                      <strong className="text-slate-800 text-sm font-bold">
                        {resolveMinorTaskRepairerName(viewingAssessment) || 'ບໍ່ລະບຸ'}
                      </strong>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-slate-400 font-semibold block">ສະຖານະ (Status)</span>
                  <span className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] mt-0.5 ${getStatusBadgeClass(viewingAssessment.assessmentStatus)}`}>
                    {viewingAssessment.assessmentStatus}
                  </span>
                </div>
              </div>

              {/* Reference information */}
              <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-slate-400 font-semibold block">ລະຫັດອ້າງອີງ / ລະຫັດກວດກາ</span>
                  <strong className="text-slate-800 font-bold">{viewingAssessment.inspectionId || viewingAssessment.incidentId}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">ສາຂາ (Branch)</span>
                  <strong className="text-slate-800 font-bold">{viewingAssessment.branch}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">ລະບົບທີ່ກວດ (System Category)</span>
                  <strong className="text-indigo-900 font-bold">{viewingAssessment.systemCategory || "ບໍ່ລະບຸ"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">ພື້ນທີ່/ຈຸດກວດ ( Area / Point)</span>
                  <strong className="text-indigo-900 font-bold">{viewingAssessment.subsystemCategory || "ບໍ່ລະບຸ"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">ລະຫັດຊັບສິນ (Asset Code)</span>
                  <strong className="text-slate-800 font-bold">{viewingAssessment.assetCode || "ບໍ່ມີລະຫັດ"}</strong>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold block">ໝວດລາຍການ (Item Type)</span>
                  <strong className="text-indigo-950 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-150 text-[10px] inline-block">{viewingAssessment.itemType || "ບໍ່ລະບຸ"}</strong>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400 font-semibold block">ຊື່ຊັບສິນ (Asset Name)</span>
                  <strong className="text-slate-800 font-bold">{viewingAssessment.assetName || "ບໍ່ລະບຸ"}</strong>
                </div>
              </div>

              {/* Sub items rendered */}
              <div className="space-y-3">
                <span className="font-bold text-slate-800 block text-xs border-b border-slate-200 pb-1">ລາຍການປະເມີນສ້ອມແປງຍ່ອຍ</span>
                {viewingAssessment.assessmentStatus === "No Assessment Required" ? (
                  <div className="bg-amber-50/40 border border-amber-200/60 p-6 rounded-xl text-center">
                    <span className="text-xl">⚙️</span>
                    <h5 className="text-xs font-bold text-amber-900 mt-1">ວຽກນ້ອຍ ບໍ່ຈຳເປັນປະເມີນ (Minor task - No Assessment Required)</h5>
                    <p className="text-[11px] text-amber-700 mt-1 leading-relaxed">
                      ລາຍການນີ້ຖືກກຳນົດວ່າເປັນວຽກງານຂະໜາດນ້ອຍ ບໍ່ຈຳເປັນຕ້ອງມີລາຍການປະເມີນສ້ອມແປງຍ່ອຍ ແລະ ຄ່າໃຊ້ຈ່າຍອະໄຫຼ່
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="min-w-[1200px] w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <th className="p-3 text-center w-12">ລ/ດ</th>
                            <th className="p-3 w-48">ລາຍການສ້ອມຍ່ອຍ</th>
                            <th className="p-3 w-32">ຮູບແບບ</th>
                            <th className="p-3 w-40">ແຫຼ່ງອະໄຫຼ່</th>
                            <th className="p-3 w-64">ຊື່ອະໄຫຼ່</th>
                            <th className="p-3 text-center w-24">ຈຳນວນ</th>
                            <th className="p-3 w-28">ຫົວໜ່ວຍ</th>
                            <th className="p-3 text-right w-36">ລາຄາຕໍ່ໜ່ວຍ</th>
                            <th className="p-3 text-right w-36">ລາຄາລວມ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {(viewingAssessment.subItems || []).map((item, index) => (
                            <tr key={item.id} className="hover:bg-slate-50/20">
                              <td className="p-3 text-center font-mono font-semibold text-slate-400">{index + 1}</td>
                              <td className="p-3 font-bold text-slate-800">{item.repairSubItem}</td>
                              <td className="p-3">{item.workType}</td>
                              <td className="p-3 font-semibold text-slate-600">{item.partSource}</td>
                              <td className="p-3">{item.sparePart || "—"}</td>
                              <td className="p-3 text-center font-bold font-mono">{item.quantity || "—"}</td>
                              <td className="p-3">{item.unit || "—"}</td>
                              <td className="p-3 text-right font-mono">{formatLAK(item.estimatedUnitCost || 0)}</td>
                              <td className="p-3 text-right font-mono font-bold text-indigo-950">{formatLAK(item.estimatedTotalCost || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Grand total */}
                    <div className="flex justify-end p-4 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ມູນຄ່າການປະເມີນລວມທັງໝົດ</span>
                        <strong className="text-base font-black font-mono text-indigo-900">
                          {formatLAK((viewingAssessment.subItems || []).reduce((acc, curr) => acc + (curr.estimatedTotalCost || 0), 0))}
                        </strong>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Remarks */}
              {viewingAssessment.assessmentRemark && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <span className="text-slate-400 block font-semibold mb-1">ໝາຍເຫດຈາກຜູ້ປະເມີນ:</span>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{viewingAssessment.assessmentRemark}</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-150 flex justify-end bg-slate-50/60 rounded-b-2xl">
              <button
                type="button"
                onClick={() => setViewingAssessment(null)}
                className="px-4 py-2 border border-slate-250 text-xs font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-100 transition cursor-pointer"
              >
                ປິດໜ້າຕ່າງ (Close)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 animate-scaleUp">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100">
              <Check className="h-6 w-6 text-emerald-600" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                {successModalType === 'submit' ? 'ສົ່ງປະເມີນສຳເລັດແລ້ວ! (Submitted)' : 'ບັນທຶກສະບັບຮ່າງສຳເລັດ! (Draft Saved)'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {successModalType === 'submit' 
                  ? 'ລາຍການປະເມີນສ້ອມແປງໄດ້ຖືກສົ່ງໄປຍັງຂັ້ນຕອນອະນຸມັດສ້ອມແປງແລ້ວ. ທ່ານສາມາດຕິດຕາມ ຫຼື ອະນຸມັດໄດ້ທີ່ເມນູ "ລາຍການອະນຸມັດການສ້ອມແປງ (Approvals)"'
                  : 'ບັນທຶກສະບັບຮ່າງການປະເມີນສຳເລັດແລ້ວ! ທ່ານສາມາດກັບມາແກ້ໄຂ ແລະ ຕື່ມຂໍ້ມູນເພີ່ມເຕີມໄດ້ທຸກເວລາ.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              {successModalType === 'submit' && onNavigateToTab && (
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    onNavigateToTab('approvals');
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition cursor-pointer"
                >
                  ໄປຫາໜ້າອະນຸມັດ (Go to Approvals)
                </button>
              )}
              <button
                onClick={() => setShowSuccessModal(false)}
                className={`flex-1 border text-xs font-bold py-2.5 px-4 rounded-xl transition cursor-pointer ${
                  successModalType === 'submit' && onNavigateToTab
                    ? 'border-slate-250 text-slate-700 bg-white hover:bg-slate-50'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                ປິດໜ້າຕ່າງ (Close)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
