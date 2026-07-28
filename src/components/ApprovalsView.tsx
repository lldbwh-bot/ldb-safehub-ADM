/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from 'react';
import { 
  Search, CheckCircle, Clock, Filter, Hammer, Info, X, Coins, CheckSquare, Download, Eye, ExternalLink, FileText, RefreshCw, Check
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RepairApprovalRecord, UserAccount, RepairLogRecord, RepairTrackingRecord, IncidentRecord, RepairAssessmentRecord } from '../types';
import { cleanString, formatExcelDate, formatLAK, inferAssetBranch, inferAssetUnit, inferAssetSector, findIncidentByPID } from '../dataStore';

interface ApprovalsViewProps {
  approvals: RepairApprovalRecord[];
  repairs?: RepairLogRecord[];
  repairTracking?: RepairTrackingRecord[];
  onGoToTracking?: () => void;
  onCompleteRepair: (approvalPID: string, repairData: {
    repairDate: string;
    result: string;
    testDetails: string;
    cost: number;
  }) => void;
  currentUser: UserAccount;
  onDeleteApprovals?: (pids: string[]) => void;
  onClearAllData?: (type: "inspections" | "incidents" | "approvals" | "repairs" | "all") => void;
  incidents?: IncidentRecord[];
  assessments?: RepairAssessmentRecord[];
  onApproveIncident?: (incidentPID: string, approvalData: {
    operation: string;
    vendor: string;
    approvedBy: string;
    approvalDate?: string;
    approvalDoc?: string;
  }) => void;
  onCancelIncident?: (pid: string, cancelReason: string) => void;
  onUpdateIncident?: (pid: string, updatedFields: Partial<IncidentRecord>) => void;
}

export default function ApprovalsView({
  approvals,
  repairs = [],
  repairTracking = [],
  onGoToTracking,
  onCompleteRepair,
  currentUser,
  onDeleteApprovals,
  onClearAllData,
  incidents = [],
  assessments = [],
  onApproveIncident,
  onCancelIncident,
  onUpdateIncident
}: ApprovalsViewProps) {
  // Tabs: 'awaiting_approval' (ລໍຖ້າອະນຸມັດສ້ອມ) & 'pending' (ລໍຖ້າບັນທຶກຜົນສ້ອມແປງ) & 'completed' (ຂໍ້ມູນສ້ອມແປງສຳເລັດ)
  const [activeTab, setActiveTab] = useState<'awaiting_approval' | 'pending' | 'completed'>('awaiting_approval');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(currentUser.status === "Admin" ? 'ALL' : currentUser.branch);

  // Dialog completion
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ fileName: string; fileData: string; rawStr: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  React.useEffect(() => {
    if (!previewDoc) {
      setPreviewUrl('');
      return;
    }

    let url = '';
    if (previewDoc.fileData && previewDoc.fileData.startsWith('data:')) {
      try {
        const mime = previewDoc.fileData.split(';')[0].split(':')[1];
        const base64Data = previewDoc.fileData.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mime });
        url = URL.createObjectURL(blob);
      } catch (e) {
        url = previewDoc.fileData;
      }
    } else {
      const content = previewDoc.rawStr || '';
      const blob = new Blob([content], { type: 'text/plain' });
      url = URL.createObjectURL(blob);
    }

    setPreviewUrl(url);

    return () => {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    };
  }, [previewDoc]);

  const [selectedApproval, setSelectedApproval] = useState<RepairApprovalRecord | null>(null);
  const [repairDate, setRepairDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState('good'); // "good" | "replaced" | "repaired"
  const [testDetails, setTestDetails] = useState('tested and passed');
  const [cost, setCost] = useState('0');

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
      if (onApproveIncident) {
        onApproveIncident(selectedIncident.PID, {
          operation,
          vendor: operation === "ສ້ອມແປງເອງ" ? "ຊ່າງໄອທີ/ຊ່າງເຕັກນິກທະນາຄານ" : vendor.trim(),
          approvedBy,
          approvalDate,
          approvalDoc
        });
      }
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
      } else if (onUpdateIncident) {
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

  const handleSaveRepair = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApproval) return;

    const numericCost = Number(cost.replace(/[^0-9.-]/g, ""));
    if (isNaN(numericCost) || numericCost < 0) {
      alert("ກະລຸນາປ້ອນມູນຄ່າສ້ອມແປງທີ່ຖືກຕ້ອງ");
      return;
    }

    onCompleteRepair(selectedApproval.PID, {
      repairDate,
      result: result.trim(),
      testDetails: testDetails.trim(),
      cost: numericCost
    });

    setIsLogOpen(false);
    setSelectedApproval(null);
    setCost('0');
  };

  // Pre-calculate counts of overall list (ignoring text filters to keep the tab badge counts consistent)
  const awaitingApprovalCount = (incidents || []).filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;
    const sStatus = item.ສະຖານະ;
    const isAssessedStatus = sStatus === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" || sStatus === "No Assessment Required" || sStatus === "ລໍຖ້າການອະນຸມັດ";
    const hasAssessment = assessments.some(asm => asm.incidentId === item.PID);
    const inTracking = (repairTracking || []).some(track => track.PID === item.PID);
    const isApproved = (approvals || []).some(app => app.PID === item.PID);
    return matchesBranch && isAssessedStatus && hasAssessment && !inTracking && !isApproved;
  }).length;

  const awaitingRepairsCount = approvals.filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;
    const isCompleted = item.ສະຖານະ === "ສຳເລັດ" || item.ສະຖານະ === "ສໍາເລັດ";
    return matchesBranch && !isCompleted;
  }).length;

  const completedRepairsCount = approvals.filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;
    const isCompleted = item.ສະຖານະ === "ສຳເລັດ" || item.ສະຖານະ === "ສໍາເລັດ";
    return matchesBranch && isCompleted;
  }).length;

  // Filter incidents waiting for approval
  const awaitingApprovalIncidents = (incidents || []).filter(inc => {
    const sBranch = inc["ສາຂາ "] || inc["ສາຂາ"] || "";
    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;
    const matchesSearch = !searchTerm || 
      (inc.ລະຫັດກວດກາ || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.ລາຍການ || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || "").toLowerCase().includes(searchTerm.toLowerCase());
    const sStatus = inc.ສະຖານະ;
    const isAssessedStatus = sStatus === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" || sStatus === "No Assessment Required" || sStatus === "ລໍຖ້າການອະນຸມັດ";
    const hasAssessment = assessments.some(asm => asm.incidentId === inc.PID);
    const inTracking = (repairTracking || []).some(track => track.PID === inc.PID);
    const isApproved = (approvals || []).some(app => app.PID === inc.PID);
    return matchesBranch && matchesSearch && isAssessedStatus && hasAssessment && !inTracking && !isApproved;
  });

  // Filter approvals table
  const filteredList = approvals.filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const sStatus = item.ສະຖານະ || "ລໍຖ້າສ້ອມແປງ";
    const sAsset = item.ລາຍການ || "";
    const sCode = item.ລະຫັດກວດກາ || "";
    const sVendor = item["vendor ຜູ້ສະໜອງ"] || "";

    const matchesSearch = 
      sCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sVendor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;

    const isCompleted = sStatus === "ສຳເລັດ" || sStatus === "ສໍາເລັດ";
    const matchesTabStatus = activeTab === 'pending' ? !isCompleted : isCompleted;

    return matchesSearch && matchesBranch && matchesTabStatus;
  }).sort((a,b) => {
    const scrapB = String(b.ວັນທີ່ກວດ);
    const scrapA = String(a.ວັນທີ່ກວດ);
    return scrapB.localeCompare(scrapA);
  });

  const renderApprovalDocButton = (docStr?: string) => {
    if (!docStr) return <span className="text-slate-400 text-[10px] italic">ບໍ່ມີເອກະສານ</span>;
    
    let fileName = "document";
    let fileData = "";
    if (docStr.includes('|')) {
      const parts = docStr.split('|');
      fileName = parts[0];
      fileData = parts.slice(1).join('|');
    } else {
      fileName = docStr;
    }

    return (
      <button
        type="button"
        onClick={() => setPreviewDoc({ fileName, fileData, rawStr: docStr })}
        title={`ຄລິກເພື່ອເປີດເບິ່ງ ຫຼື ດາວໂຫລດ: ${fileName}`}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-colors shadow-sm cursor-pointer mx-auto transition bg-opacity-75 hover:bg-opacity-100"
      >
        <span className="text-sm">📄</span>
        <span className="max-w-[120px] truncate">{fileName}</span>
      </button>
    );
  };

  const handleExportExcel = () => {
    const exportData = filteredList.map((app, index) => {
      const repairLog = repairs.find(r => r.PID === app.PID);
      let inspectionType = (app as any).ຮູບແບບການກວດ || "ກວດປະຈຳວັນ";
      if (!(app as any).ຮູບແບບການກວດ && app.ລະຫັດກວດກາ) {
        if (app.ລະຫັດກວດກາ.startsWith("LDB-SAF-M")) {
          inspectionType = "ລາຍງານເຫດການເສຍຫາຍ";
        } else {
          inspectionType = "ກວດປະຈຳວັນ";
        }
      }
      const matchedInc = findIncidentByPID(app.PID);
      const displaySector = matchedInc?.ຂະແໜງ || app.ຂະແໜງ || '';
      const displayAssetBranch = matchedInc?.ສາຂາຊັບສິນ || app.ສາຂາຊັບສິນ || inferAssetBranch(app) || 'none';
      const displayAssetUnit = matchedInc?.ຝ່າຍຊັບສິນ || app.ຝ່າຍຊັບສິນ || inferAssetUnit(app) || 'none';
      const displayAssetSector = matchedInc?.ຂະແໜງຊັບສິນ || app.ຂະແໜງຊັບສິນ || inferAssetSector(app) || 'none';

      return {
        "ລ/ດ (No.)": index + 1,
        "ລະຫັດ PID (PID)": app.PID,
        "ລະຫັດກວດກາ (Inspection Ref)": app.ລະຫັດກວດກາ,
        "ສາຂາ (Branch)": app["ສາຂາ "] || '',
        "ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)": app["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '',
        "ຂະແໜງ (Sector)": displaySector,
        "ຮູບແບບການກວດ (Inspection Type)": inspectionType,
        "ລະບົບທີ່ກວດ (System Category)": app.ລະບົບທີ່ກວດ || '',
        "ພື້ນທີ່/ຈຸດກວດ ( Area / Point)": app.ໝວດລະບົບກວດ || '',
        "ລະຫັດຊັບສິນ (Asset Code)": app.ລະຫັດຊັບສິນ || 'none',
        "ລາຍການຊັບສິນ (Asset Name)": app.ລາຍການ || '',
        "ພາກສ່ວນຊັບສົມບັດ (Asset Category)": app.ພາກສ່ວນຊັບສົມບັດ || '',
        "ໝວດລາຍການ (Asset Group)": app.ໝວດລາຍການ || '',
        "ສາຂາຂອງຊັບສິນ (Asset Branch)": displayAssetBranch || 'none',
        "ຝ່າຍ/ໜ່ວຍບໍລິການຊັບສິນ (Asset Division/Unit)": displayAssetUnit || 'none',
        "ຂະແໜງຊັບສິນ (Asset Sector)": displayAssetSector || 'none',
        "ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)": app.ລາຍລະອຽດປັນຫາທີ່ພົບ || '',
        "ປະເມີນຜົນກະທົບ (Impact Level)": app.ປະເມີນຜົນກະທົບ || '',
        "ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)": app.ວີທີແກ້ໄຂ || '',
        "ວັນທີ່ກວດ (Detected Date)": formatExcelDate(app.ວັນທີ່ກວດ),
        "ເວລາກວດ (Detected Time)": app.ເວລາກວດ || '',
        "ຜູ້ກວດກາ (Reporter)": app.ຜູ້ກວດກາ || app.ຊື່ຜູ້ກວດ || '',
        "ສະຖານະ (Status)": app.ສະຖານະ || 'ລໍຖ້າສ້ອມແປງ',
        // Additional approval metadata
        "ວັນທີ່ອະນຸມັດ (Approval Date)": formatExcelDate(app.ວັນທີ່ອະນຸມັດ),
        "ຜູ້ອະນຸມັດ (Approver Role)": app.ຜູ້ອະນຸມັດ || '—',
        "ວັນທີ່ສ້ອມແປງສຳເລັດ (Repair Date)": repairLog ? (repairLog.ວັນທີ່ສຳເລັດ || repairLog.ວັນທີ່ສ້ອມແປງ || '') : '',
        "ມູນຄ່າສ້ອມແປງ (Cost LAK)": repairLog ? Number(repairLog.ມູນຄ່າສ້ອມແປງ) : 0,
        "ຜົນການແກ້ໄຂ (Result)": repairLog ? repairLog.ຜົນການແກ້ໄຂ : '',
        "ຜົນທົດສອບ (Test Details)": repairLog ? repairLog.ຜົນທົດສອບ : ''
      };
    });

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
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'pending' ? "Pending_Repairs" : "Completed_Repairs");
    XLSX.writeFile(workbook, `ລາຍງານການສ້ອມແປງ_${activeTab === 'pending' ? 'ລໍຖ້າສ້ອມ' : 'ສຳເລັດ'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">ລາຍການອະນຸມັດການສ້ອມແປງ (Repair Approvals Database)</h3>
          <p className="text-xs text-slate-500">
            ບັນທຶກການອະນຸມັດ, ຜູ້ສະໜອງ/ຜູ້ຮັບຈ້າງສ້ອມແປງ ແລະ ການຕິດຕາມຜົນການສ້ອມແປງຕົວຈິງ
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('awaiting_approval')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'awaiting_approval'
              ? 'border-rose-600 bg-rose-50/20 text-rose-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <span className="text-sm">⚖️</span>
          <span>1. ລໍຖ້າອະນຸມັດສ້ອມ</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'awaiting_approval' ? 'bg-rose-100 text-rose-850' : 'bg-slate-100 text-slate-600'
          }`}>
            {awaitingApprovalCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('pending')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'pending'
              ? 'border-indigo-600 bg-indigo-50/20 text-indigo-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <span className="text-sm">🛠️</span>
          <span>2. ລາຍການອະນຸມັດສ້ອມແປງ</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'pending' ? 'bg-indigo-100 text-indigo-850' : 'bg-slate-100 text-slate-600'
          }`}>
            {awaitingRepairsCount}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex-1 md:flex-initial flex items-center justify-center gap-2 py-3 px-6 text-xs font-bold border-b-2 transition-all duration-200 cursor-pointer ${
            activeTab === 'completed'
              ? 'border-emerald-600 bg-emerald-50/20 text-emerald-800 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
          }`}
        >
          <span className="text-sm">✅</span>
          <span>3. ຂໍ້ມູນສ້ອມແປງສຳເລັດ</span>
          <span className={`ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
            activeTab === 'completed' ? 'bg-emerald-100 text-emerald-850' : 'bg-slate-100 text-slate-600'
          }`}>
            {completedRepairsCount}
          </span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-b-xl rounded-t-none border-t-0 border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-semibold">
        <div>
          <label className="block text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ລະຫັດກວດກາ, ຊັບສິນ, ຜູ້ຮັບຈ້າງ..."
              className="w-full border border-slate-300 rounded-lg p-2 pl-8 focus:ring-2 focus:ring-emerald-500 bg-white"
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
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            {currentUser.status === "Admin" && <option value="ALL">ທຸກສາຂາ (ALL)</option>}
            {Array.from(new Set(approvals.map(a => a["ສາຂາ "]))).filter(Boolean).map((br, idx) => (
              <option key={idx} value={br}>{br}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Database View Content */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">
            {activeTab === 'awaiting_approval' 
              ? 'ລາຍການເຫດການທີ່ປະເມີນແລ້ວ ແລະ ລໍຖ້າການອະນຸມັດ (Awaiting Approval)' 
              : activeTab === 'pending' 
                ? 'ລາຍການລໍຖ້າບັນທຶກຜົນສ້ອມແປງ (Awaiting Repair Logging)' 
                : 'ລາຍການສ້ອມແປງທີ່ສຳເລັດແລ້ວ (Completed Repairs)'} 
            ({activeTab === 'awaiting_approval' ? awaitingApprovalIncidents.length : filteredList.length} ບັນທຶກ)
          </span>
          <button
            onClick={handleExportExcel}
            className="bg-[#107c41] hover:bg-[#0e6b38] text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition text-xs cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4 text-white shrink-0" />
            ດາວໂຫຼດ Excel (Export)
          </button>
        </div>

        <div className="overflow-x-auto text-xs">
          {activeTab === 'awaiting_approval' ? (
            /* Awaiting Approval Tab Table */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-[11px]">
                  <th className="p-3 whitespace-nowrap min-w-[110px]">ລະຫັດເຫດການ</th>
                  <th className="p-3 whitespace-nowrap min-w-[140px]">ສາຂາ (Branch)</th>
                  <th className="p-3 whitespace-nowrap min-w-[160px]">ໜ່ວຍບໍລິການ / ຝ່າຍຍ່ອຍ</th>
                  <th className="p-3 whitespace-nowrap min-w-[180px]">ຊັບສິນ & ສະຖານທີ່</th>
                  <th className="p-3 whitespace-nowrap min-w-[320px]">ລາຍການປະເມີນ ແລະ ລະບຽບລາຄາ (Assessments & Cost Rules)</th>
                  <th className="p-3 whitespace-nowrap min-w-[120px] text-right">ລາຄາປະເມີນລວມ</th>
                  <th className="p-3 whitespace-nowrap min-w-[120px]">ສະຖານະ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[185px]">ການຈັດການ (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {awaitingApprovalIncidents.map((inc, idx) => {
                  const asm = assessments.find(a => a.incidentId === inc.PID);
                  const totalEstCost = asm?.subItems.reduce((sum, item) => sum + (item.estimatedTotalCost || 0), 0) || 0;

                  return (
                    <tr key={idx} className="hover:bg-rose-50/5 text-slate-700 transition-colors">
                      <td className="p-3 font-mono font-bold text-rose-750">{inc.ລະຫັດກວດກາ}</td>
                      <td className="p-3 font-semibold text-slate-800">{inc["ສາຂາ "] || inc["ສາຂາ"] || 'None'}</td>
                      <td className="p-3 text-slate-600 font-medium">{inc["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "None"}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{inc.ລາຍການ}</div>
                        <div className="text-[10px] text-slate-450 italic line-clamp-1">{inc.ລາຍລະອຽດປັນຫາທີ່ພົບ}</div>
                        <div className="text-[10px] text-indigo-600 mt-1 font-bold">
                          {inc.ລະບົບທີ່ກວດ || "—"} / {inc.ໝວດລະບົບກວດ || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        {asm?.assessmentStatus === "No Assessment Required" || inc.ສະຖານະ === "No Assessment Required" ? (
                          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-2 text-amber-900 text-[10px] font-medium flex items-center gap-1.5 animate-fadeIn">
                            <span>⚙️</span>
                            <span><strong>ວຽກນ້ອຍ ບໍ່ຕ້ອງການປະເມີນ</strong><br/>(No Assessment Required)</span>
                          </div>
                        ) : (!asm || !asm.subItems || asm.subItems.length === 0) ? (
                          <span className="text-slate-400 italic">ບໍ່ມີຂໍ້ມູນການປະເມີນ</span>
                        ) : (
                          <div className="space-y-1 max-w-[400px]">
                            {asm.subItems.map((sub, sIdx) => (
                              <div key={sIdx} className="text-[10px] bg-slate-50 border border-slate-100 rounded p-1 flex flex-col gap-0.5 animate-fadeIn">
                                <div className="flex justify-between font-bold text-slate-700">
                                  <span>• {sub.repairSubItem} ({sub.workType})</span>
                                  <span className="font-mono text-indigo-700">{formatLAK(sub.estimatedTotalCost || 0)}</span>
                                </div>
                                <div className="text-[9px] text-slate-500 flex flex-wrap gap-x-2">
                                  <span>ອະໄຫຼ່: {sub.sparePart || 'ບໍ່ໃຊ້ອະໄຫຼ່'} ({sub.quantity} {sub.unit})</span>
                                  <span>ແຫຼ່ງອະໄຫຼ່: <span className="text-slate-700 font-semibold">{sub.partSource}</span></span>
                                  <span>ລະບຽບລາຄາ: <span className="text-blue-700 font-semibold">{sub.costRule || 'Market Rate'}</span></span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatLAK(totalEstCost)}
                      </td>
                      <td className="p-3">
                        {inc.ສະຖານະ === "No Assessment Required" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                            ⚙️ ວຽກນ້ອຍ ບໍ່ປະເມີນ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            ⚖️ ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedIncident(inc);
                              setIsApproveOpen(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded shadow-sm text-[10px] cursor-pointer transition flex items-center gap-1 active:scale-95"
                          >
                            <CheckSquare className="h-3 w-3" />
                            ອະນຸມັດສ້ອມ (Approve)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {awaitingApprovalIncidents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400 font-medium">
                      👍 ບໍ່ມີເຫດການທີ່ລໍຖ້າການອະນຸມັດໃນຂະນະນີ້
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : activeTab === 'pending' ? (
            /* Pending Action Tab Table */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="p-3 whitespace-nowrap min-w-[110px]">ລະຫັດອ້າງອີງ</th>
                  <th className="p-3 whitespace-nowrap min-w-[140px]">ສາຂາ (Branch)</th>
                  <th className="p-3 whitespace-nowrap min-w-[180px]">ໜ່ວຍບໍລິການ / ຝ່າຍຍ່ອຍ</th>
                  <th className="p-3 whitespace-nowrap min-w-[140px]">ຂະແໜງ (Sector)</th>
                  <th className="p-3 text-indigo-900 bg-indigo-50/40 whitespace-nowrap min-w-[140px]">ສາຂາຂອງຊັບສິນ</th>
                  <th className="p-3 text-indigo-900 bg-indigo-50/40 whitespace-nowrap min-w-[180px]">ຝ່າຍ/ໜ່ວຍບໍລິການຊັບສິນ</th>
                  <th className="p-3 text-indigo-900 bg-indigo-50/40 whitespace-nowrap min-w-[150px]">ຂະແໜງຂອງຊັບສິນ</th>
                  <th className="p-3 whitespace-nowrap min-w-[200px]">ລາຍການຊັບສິນ</th>
                  <th className="p-3 whitespace-nowrap min-w-[160px]">ຮູບແບບ / ຜູ້ຮັບຈ້າງ</th>
                  <th className="p-3 whitespace-nowrap min-w-[120px]">ວັນທີ່ອະນຸມັດ</th>
                  <th className="p-3 whitespace-nowrap min-w-[150px]">ຜູ້ມີອຳນາດອະນຸມັດ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[120px]">ເອກະສານອ້າງອີງ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[140px]">ສະຖານະ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[50px]">...</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredList.slice(0, 30).map((app, idx) => {
                  const trackingItem = repairTracking.find(t => t.PID === app.PID);
                  const currentTrackingStatus = trackingItem ? trackingItem.trackingStatus : "ລໍຖ້າເລີ່ມສ້ອມ";
                  const currentProgress = trackingItem ? trackingItem.progressPercent || 0 : 0;

                  const matchedInc = findIncidentByPID(app.PID);
                  const displaySector = matchedInc?.ຂະແໜງ || app.ຂະແໜງ || 'None';
                  const displayAssetBranch = matchedInc?.ສາຂາຊັບສິນ || app.ສາຂາຊັບສິນ || inferAssetBranch(app) || 'None';
                  const displayAssetUnit = matchedInc?.ຝ່າຍຊັບສິນ || app.ຝ່າຍຊັບສິນ || inferAssetUnit(app) || 'None';
                  const displayAssetSector = matchedInc?.ຂະແໜງຊັບສິນ || app.ຂະແໜງຊັບສິນ || inferAssetSector(app) || 'None';

                  return (
                    <tr key={idx} className="hover:bg-indigo-50/10 text-slate-700 transition-colors animate-fadeIn">
                      <td className="p-3 font-mono font-bold text-indigo-750">{app.ລະຫັດກວດກາ}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{app["ສາຂາ "] || 'None'}</div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {app["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "None"}
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap">
                          {displaySector}
                        </span>
                      </td>
                      <td className="p-3 bg-indigo-50/10 font-semibold text-slate-700">
                        {displayAssetBranch}
                      </td>
                      <td className="p-3 bg-indigo-50/10 text-slate-700">
                        {displayAssetUnit}
                      </td>
                      <td className="p-3 bg-indigo-50/10 text-slate-700 font-medium">
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap">
                          {displayAssetSector}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{app.ລາຍການ}</div>
                        <div className="text-[10px] text-slate-450 italic line-clamp-1">{app.ລາຍລະອຽດປັນຫາທີ່ພົບ}</div>
                        <div className="text-[10px] text-indigo-600 mt-1 font-bold">
                          {app.ລະບົບທີ່ກວດ || "—"} / {app.ໝວດລະບົບກວດ || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{app.ການດຳເນີນງານ || "ບໍ່ລະບຸ"}</div>
                        <div className="text-[10px] text-indigo-650 font-semibold">{app["vendor ຜູ້ສະໜອງ"] || "ບໍ່ລະບຸຜູ້ຮັບເໝົາ"}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-500">{formatExcelDate(app.ວັນທີ່ອະນຸມັດ || app.ວັນທີ່ກວດ)}</td>
                      <td className="p-3">
                        <div className="font-bold flex items-center text-slate-700">
                           {app.ຜູ້ອະນຸມັດ || "ຫົວໜ້າຝ່າຍ"}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {renderApprovalDocButton(app.ເອກະສານອະນຸມັດ)}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            currentTrackingStatus === "ສ້ອມສຳເລັດ" 
                              ? "bg-teal-50 text-teal-700 border border-teal-150"
                              : currentTrackingStatus === "ກຳລັງດຳເນີນການ"
                              ? "bg-blue-50 text-blue-700 border border-blue-150"
                              : currentTrackingStatus === "ລໍຖ້າອະໄຫຼ່" || currentTrackingStatus === "ລໍຖ້າ Vendor"
                              ? "bg-amber-50 text-amber-700 border border-amber-150 font-bold"
                              : currentTrackingStatus === "ຢຸດຊົ່ວຄາວ"
                              ? "bg-rose-50 text-rose-750 border border-rose-150"
                              : "bg-slate-50 text-slate-700 border border-slate-200"
                          }`}>
                            <Clock className="h-3 w-3 mr-1 shrink-0" />
                            {currentTrackingStatus}
                          </span>
                          {currentProgress > 0 && currentProgress < 100 && (
                            <div className="w-16 bg-slate-100 rounded-full h-1 overflow-hidden">
                              <div className="bg-blue-600 h-1 rounded-full" style={{ width: `${currentProgress}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (onGoToTracking) {
                              onGoToTracking();
                            }
                          }}
                          className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold p-1.5 px-3 rounded-lg text-[10px] shadow-sm flex items-center justify-center mx-auto cursor-pointer transition-all active:scale-95 whitespace-nowrap"
                        >
                          <RefreshCw className="h-3 w-3 mr-1 shrink-0 animate-spin-slow" />
                          ຕິດຕາມການສ້ອມແປງ
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={14} className="text-center py-16 text-slate-400">
                      🎉 ດີເລີດ! ບໍ່ມີລາຍການລໍຖ້າບັນທຶກຜົນການສ້ອມແປງໃນຂະນະນີ້
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            /* Completed Actions Database Table */
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <th className="p-3 whitespace-nowrap min-w-[110px]">ລະຫັດອ້າງອີງ</th>
                  <th className="p-3 whitespace-nowrap min-w-[140px]">ສາຂາ (Branch)</th>
                  <th className="p-3 whitespace-nowrap min-w-[180px]">ໜ່ວຍບໍລິການ / ຝ່າຍຍ່ອຍ</th>
                  <th className="p-3 whitespace-nowrap min-w-[140px]">ຂະແໜງ (Sector)</th>
                  <th className="p-3 text-indigo-900 bg-indigo-50/40 whitespace-nowrap min-w-[140px]">ສາຂາຂອງຊັບສິນ</th>
                  <th className="p-3 text-indigo-900 bg-indigo-50/40 whitespace-nowrap min-w-[180px]">ຝ່າຍ/ໜ່ວຍບໍລິການຊັບສິນ</th>
                  <th className="p-3 text-indigo-900 bg-indigo-50/40 whitespace-nowrap min-w-[150px]">ຂະແໜງຂອງຊັບສິນ</th>
                  <th className="p-3 whitespace-nowrap min-w-[200px]">ລາຍການຊັບສິນ</th>
                  <th className="p-3 whitespace-nowrap min-w-[160px]">ຮູບແບບ / ຜູ້ຮັບຈ້າງ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[160px]">ວັນທີ່ສ້ອມແປງສຳເລັດ</th>
                  <th className="p-3 text-right whitespace-nowrap min-w-[150px]">ມູນຄ່າສ້ອມແປງຕົວຈິງ</th>
                  <th className="p-3 whitespace-nowrap min-w-[200px]">ຜົນການແກ້ໄຂ / ທົດສອບ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[120px]">ເອກະສານອ້າງອີງ</th>
                  <th className="p-3 text-center whitespace-nowrap min-w-[140px]">ສະຖານະ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredList.slice(0, 30).map((app, idx) => {
                  const status = app.ສະຖານະ || "ສຳເລັດ";
                  const repairLog = repairs.find(r => r.PID === app.PID);
                  const matchedInc = findIncidentByPID(app.PID);
                  const displaySector = matchedInc?.ຂະແໜງ || app.ຂະແໜງ || 'None';
                  const displayAssetBranch = matchedInc?.ສາຂາຊັບສິນ || app.ສາຂາຊັບສິນ || inferAssetBranch(app) || 'None';
                  const displayAssetUnit = matchedInc?.ຝ່າຍຊັບສິນ || app.ຝ່າຍຊັບສິນ || inferAssetUnit(app) || 'None';
                  const displayAssetSector = matchedInc?.ຂະແໜງຊັບສິນ || app.ຂະແໜງຊັບສິນ || inferAssetSector(app) || 'None';
                  
                  return (
                    <tr key={idx} className="hover:bg-emerald-50/10 text-slate-700 transition-colors animate-fadeIn">
                      <td className="p-3 font-mono font-bold text-emerald-800">{app.ລະຫັດກວດກາ}</td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{app["ສາຂາ "] || 'None'}</div>
                      </td>
                      <td className="p-3 text-slate-600 font-medium">
                        {app["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "None"}
                      </td>
                      <td className="p-3">
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap">
                          {displaySector}
                        </span>
                      </td>
                      <td className="p-3 bg-indigo-50/10 font-semibold text-slate-700">
                        {displayAssetBranch}
                      </td>
                      <td className="p-3 bg-indigo-50/10 text-slate-700 font-medium">
                        {displayAssetUnit}
                      </td>
                      <td className="p-3 bg-indigo-50/10 text-slate-700 font-medium">
                        <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap">
                          {displayAssetSector}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-800">{app.ລາຍການ}</div>
                        <div className="text-[10px] text-slate-450 italic line-clamp-1">{app.ລາຍລະອຽດປັນຫາທີ່ພົບ}</div>
                        <div className="text-[10px] text-indigo-600 mt-1 font-bold">
                          {app.ລະບົບທີ່ກວດ || "—"} / {app.ໝວດລະບົບກວດ || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{app.ການດຳເນີນງານ || "ບໍ່ລະບຸ"}</div>
                        <div className="text-[10px] text-slate-500">{app["vendor ຜູ້ສະໜອງ"] || "ສ້ອມແປງເອງ"}</div>
                      </td>
                      <td className="p-3 text-center font-mono font-bold text-slate-800">
                        {repairLog ? formatExcelDate(repairLog.ວັນທີ່ສຳເລັດ || repairLog.ວັນທີ່ສ້ອມແປງ) : formatExcelDate(app.ວັນທີ່ອະນຸມັດ)}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-emerald-850 bg-emerald-50/20">
                        {repairLog ? formatLAK(repairLog.ມູນຄ່າສ້ອມແປງ) : "0 LAK"}
                      </td>
                      <td className="p-3">
                        <div>
                          <span className="inline-block bg-teal-100 text-teal-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded mr-1 animate-fadeIn">
                            {repairLog?.ຜົນການແກ້ໄຂ || "Good"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium italic mt-1 line-clamp-2">
                          {repairLog?.ຜົນທົດສອບ || "tested and passed ໃຊ້ງານໄດ້ປົກກະຕິ"}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {renderApprovalDocButton(app.ເອກະສານອະນຸມັດ)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle className="h-3 w-3 mr-1 text-emerald-600 shrink-0" />
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredList.length === 0 && (
                  <tr>
                    <td colSpan={14} className="text-center py-16 text-slate-400">
                      ບໍ່ມີປະຫວັດການສ້ອມແປງສຳເລັດທີ່ກົງກັບເງື່ອນໄຂ
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {filteredList.length > 30 && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-slate-400 text-[10px]">
            ສະແດງສະເພາະ 30 ລາຍການຫຼ້າສຸດ. ກະລຸນາໃຊ້ການຄົ້ນຫາ ແລະ ຕົວຕອງ ເພື່ອຈຳກັດຂອບເຂດຂໍ້ມູນທີ່ຕ້ອງການ
          </div>
        )}
      </div>

      {/* dialog modal to record result of repair */}
      {isLogOpen && selectedApproval && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full flex flex-col animate-scaleUp">
            <div className="bg-indigo-800 text-white p-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="h-5 w-5 text-amber-400" />
                <h4 className="font-bold text-sm">
                  ບັນທຶກຜົນການສ້ອມແປງ: {selectedApproval.ລະຫັດກວດກາ}
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsLogOpen(false);
                  setSelectedApproval(null);
                }}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRepair} className="p-6 space-y-4 text-xs text-slate-700">
              
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 space-y-1">
                <p className="font-bold text-slate-800">
                  ຊັບສິນ: {selectedApproval.ລາຍການ} ({selectedApproval.ລະຫັດຊັບສິນ})
                </p>
                <p className="text-slate-500 text-[11px]">
                  <strong>ບັນຫາທີ່ໄດ້ຮັບແຈ້ງ:</strong> {selectedApproval.ລາຍລະອຽດປັນຫາທີ່ພົບ}
                </p>
                <p className="text-[11px] text-emerald-800 font-semibold">
                  <strong>ຜູ້ຮັບເໝົາ (Vendor):</strong> {selectedApproval["vendor ຜູ້ສະໜອງ"] || 'ສ້ອມແປງເອງ'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-650 mb-1">ວັນທີ່ສ້ອມແປງສຳເລັດ</label>
                  <input
                    type="date"
                    value={repairDate}
                    onChange={(e) => setRepairDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-655 mb-1 font-sans">ຜົນການແກ້ໄຂ / ປ່ຽນຊັບສິນ</label>
                  <select
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="good">good (ດີ/ສ້ອມແປງສໍາເລັດ)</option>
                    <option value="replaced">replaced (ປ່ຽນອຸປະກອນໃຫມ່)</option>
                    <option value="repaired">repaired (ສ້ອມແປງໃຫມ່)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-650 mb-1">ຜົນການລົງທົດສອບ (Testing Details)</label>
                <input
                  type="text"
                  value={testDetails}
                  onChange={(e) => setTestDetails(e.target.value)}
                  placeholder="ຕົວຢ່າງ: tested and passed, excellent, ໃຊ້ງານໄດ້ປົກກະຕິ"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-650 mb-1">ມູນຄ່າສ້ອມແປງຕົວຈິງ (Cost in LAK) *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="ຕົວຢ່າງ: 1,500,000"
                    className="w-full border border-slate-300 rounded-lg p-2.5 pl-3 bg-white font-mono text-emerald-800 text-sm font-bold"
                  />
                  <Coins className="h-4 w-4 text-emerald-700 absolute right-3 top-3.5" />
                </div>
              </div>

              <div className="bg-indigo-50 p-3 rounded-lg text-[10px] text-indigo-800 flex items-start border border-indigo-100">
                <Info className="h-4 w-4 mr-1 text-indigo-700 shrink-0 mt-0.5" />
                <div>
                  <strong>ຂັ້ນຕອນການຈ່າຍເງິນ:</strong> ການບັນທຶກນີ້ ຈະຄິດໄລ່ <strong>"ລວມມື້ທີ່ສຳເລັດ"</strong> ໂດຍອັດຕະໂນມັດ ແລະ ລົງບັນທຶກລົງ <strong>"ທະບຽນການສ້ອມແປງ"</strong> ເພື່ອສະແດງສະຖິຕິການເງິນໃນ Dashboard.
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogOpen(false);
                    setSelectedApproval(null);
                  }}
                  className="px-4 py-2 border rounded-xl hover:bg-slate-50 font-semibold text-slate-500 cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-750 hover:bg-indigo-800 text-white rounded-xl font-bold shadow transition flex items-center cursor-pointer"
                >
                  ບັນທຶກຜົນ ແລະ ປິດງານສ້ອມ
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Document Preview and Download Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs">
                <FileText className="h-5 w-5 text-indigo-450" />
                <div className="text-left">
                  <h4 className="font-bold text-sm text-slate-100 truncate max-w-[350px]">
                    {previewDoc.fileName}
                  </h4>
                  <p className="text-[10px] text-slate-400">ເບິ່ງເອກະສານ ແລະ ດາວໂຫລດ (Reference File View & Download)</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-1.5 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content / Preview Container */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col items-center justify-center min-h-[300px]">
              {previewDoc.fileData ? (
                previewDoc.fileData.startsWith('data:image/') ? (
                  <div className="relative group max-w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                    <img 
                      src={previewUrl || previewDoc.fileData} 
                      alt={previewDoc.fileName} 
                      className="max-h-[50vh] object-contain rounded-lg mx-auto"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                ) : previewDoc.fileData.startsWith('data:application/pdf') ? (
                  <div className="w-full h-[50vh] rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                    <iframe 
                      src={previewUrl} 
                      title={previewDoc.fileName}
                      className="w-full h-full border-0"
                    />
                  </div>
                ) : previewDoc.fileData.startsWith('data:text/') ? (
                  <div className="w-full max-h-[50vh] overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 shadow-inner text-left">
                    <pre className="font-mono text-xs text-indigo-200 whitespace-pre-wrap break-all">
                      {(() => {
                        try {
                          const base64Parts = previewDoc.fileData.split(',');
                          if (base64Parts.length > 1) {
                            return atob(base64Parts[1]);
                          }
                          return "ບໍ່ສາມາດອ່ານເນື້ອໃນໄຟລ໌ໄດ້";
                        } catch (e) {
                          return previewDoc.fileData;
                        }
                      })()}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center p-8 space-y-3 bg-white rounded-2xl border border-slate-150 shadow-sm max-w-sm">
                    <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                      <FileText className="h-8 w-8" />
                    </div>
                    <h5 className="font-bold text-slate-800 text-sm font-sans">ບໍ່ມີຕົວຢ່າງສະແດງໂດຍກົງ</h5>
                    <p className="text-slate-500 text-xs leading-relaxed font-sans">
                      ໄຟລ໌ນີ້ ({previewDoc.fileName.split('.').pop()?.toUpperCase()}) ບໍ່ຮອງຮັບການສະແດງຜ່ານເວັບໂດຍກົງ. ທ່ານສາມາດດາວໂຫລດເພື່ອເປີດເບິ່ງໃນອຸປະກອນຂອງທ່ານໄດ້.
                    </p>
                  </div>
                )
              ) : (
                <div className="text-center p-8 space-y-3 bg-white rounded-2xl border border-slate-150 shadow-sm max-w-sm">
                  <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h5 className="font-bold text-slate-800 text-sm font-sans">ບໍ່ມີໄຟລ໌ຕົວຢ່າງ (No Preview File)</h5>
                  <p className="text-slate-500 text-xs leading-relaxed font-sans">
                    ຂໍ້ມູນຕົວຢ່າງໄຟລ໌ນີ້ມີພຽງແຕ່ຊື່ເອກະສານອ້າງອີງ <strong>"{previewDoc.fileName}"</strong>. ທ່ານສາມາດດາວໂຫລດໄຟລ໌ເອກະສານ ຫຼື ກວດເບິ່ງປະຫວັດການອັບໂຫລດ.
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions / Footer */}
            <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl bg-white hover:bg-slate-100 font-bold text-slate-600 text-xs transition cursor-pointer"
              >
                ປິດ (Close)
              </button>

              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded-xl font-bold text-xs transition flex items-center gap-1.5 cursor-pointer border border-indigo-200"
                >
                  <ExternalLink className="h-4 w-4" />
                  ເປີດໃນແທັບໃໝ່ (Open in Tab)
                </a>
              )}

              {previewUrl && (
                <a
                  href={previewUrl}
                  download={previewDoc.fileName}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-md hover:shadow-lg cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  ດາວໂຫລດ (Download)
                </a>
              )}
            </div>
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
                <h4 className="font-bold text-sm font-sans">
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
                <p className="font-bold text-slate-800 text-xs font-sans">
                  ຊັບສິນ: {selectedIncident.ລາຍການ} ({selectedIncident.ລະຫັດຊັບສິນ})
                </p>
                <p className="text-slate-500 text-[11px] font-sans">
                  <strong>ບັນຫາທີ່ແຈ້ງ:</strong> {selectedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ}
                </p>
                <p className="text-[11px] text-indigo-700 font-sans">
                  <strong>ສາຂາ:</strong> {selectedIncident["ສາຂາ "] || selectedIncident["ສາຂາ"]}
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">ຮູບແບບການດຳເນີນງານ (Execution)</label>
                <div className="grid grid-cols-2 gap-2 mt-1 font-semibold">
                  <button
                    type="button"
                    onClick={() => setOperation('ຈ້າງພາຍນອກ')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center text-xs cursor-pointer ${
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
                    className={`py-2 px-3 rounded-lg border font-semibold text-center text-xs cursor-pointer ${
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
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white text-slate-800"
                    required
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
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 mb-1">ວັນທີ່ອະນຸມັດສ້ອມແປງ (Approval Date) *</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-semibold text-slate-800"
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
                        <span className="truncate max-w-[200px]">{approvalDoc.split('|')[0]}</span>
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
                    className="px-3.5 py-2 border rounded-xl hover:bg-slate-50 font-semibold text-slate-500 text-xs cursor-pointer"
                  >
                    ປິດ
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow transition flex items-center text-xs cursor-pointer"
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

    </div>
  );
}
