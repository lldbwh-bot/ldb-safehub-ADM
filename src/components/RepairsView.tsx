/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Search, Filter, Coins, CheckCircle, Clock, Calendar, User, Hammer, Download, FileText, X, ExternalLink
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { RepairLogRecord, UserAccount, RepairApprovalRecord, RepairTrackingRecord, RepairAssessmentRecord } from '../types';
import { formatExcelDate, formatLAK, cleanString, inferAssetBranch, inferAssetUnit, inferAssetSector, findIncidentByPID } from '../dataStore';
import { LOCATION_FLOOR_LABEL } from '../locationFloorOptions';

interface RepairsViewProps {
  repairs: RepairLogRecord[];
  currentUser: UserAccount;
  onDeleteRepairs?: (pids: string[]) => void;
  onClearAllData?: (type: "inspections" | "incidents" | "approvals" | "repairs" | "all") => void;
  approvals?: RepairApprovalRecord[];
  repairTracking?: RepairTrackingRecord[];
  assessments?: RepairAssessmentRecord[];
}

export default function RepairsView({
  repairs,
  currentUser,
  onDeleteRepairs,
  onClearAllData,
  approvals,
  repairTracking = [],
  assessments = []
}: RepairsViewProps) {
  // Helper to resolve Asset Branch, Division/Unit, and Sector
  const getAssetInfo = (rep: RepairLogRecord) => {
    let assetBranch = rep.ສາຂາຊັບສິນ || "";
    let assetUnit = rep.ຝ່າຍຊັບສິນ || "";
    let assetSector = rep.ຂະແໜງຊັບສິນ || "";

    const matchedInc = findIncidentByPID(rep.PID);
    if (matchedInc) {
      assetBranch = assetBranch || (matchedInc as any).ສາຂາຊັບສິນ || "";
      assetUnit = assetUnit || (matchedInc as any).ຝ່າຍຊັບສິນ || "";
      assetSector = assetSector || (matchedInc as any).ຂະແໜງຊັບສິນ || "";
    }

    if (!assetBranch || !assetUnit || !assetSector) {
      if (approvals) {
        const matched = approvals.find(app => app.PID === rep.PID);
        if (matched) {
          assetBranch = assetBranch || matched.ສາຂາຊັບສິນ || "";
          assetUnit = assetUnit || matched.ຝ່າຍຊັບສິນ || "";
          assetSector = assetSector || matched.ຂະແໜງຊັບສິນ || "";
        }
      }
    }

    assetBranch = assetBranch || inferAssetBranch(rep);
    assetUnit = assetUnit || inferAssetUnit(rep);
    assetSector = assetSector || inferAssetSector(rep);

    return { assetBranch, assetUnit, assetSector };
  };

  const getDisplaySector = (rep: RepairLogRecord) => {
    const matchedInc = findIncidentByPID(rep.PID);
    return matchedInc?.ຂະແໜງ || rep.ຂະແໜງ || "";
  };

  const renderApprovalDocPreview = (docStr?: string) => {
    if (!docStr) return <span className="text-slate-400 italic">ບໍ່ມີເອກະສານ</span>;
    
    let fileName = "document";
    let fileData = "";
    if (docStr.includes('|')) {
      const parts = docStr.split('|');
      fileName = parts[0];
      fileData = parts.slice(1).join('|');
    } else {
      fileName = docStr;
    }

    const isImage = fileData && fileData.startsWith('data:image/');
    const isPdf = fileData && fileData.startsWith('data:application/pdf');

    return (
      <div className="mt-1">
        {isImage ? (
          <div 
            onClick={() => setPreviewDoc({ fileName, fileData, rawStr: docStr })}
            className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:border-indigo-500 transition-all group bg-white shadow-sm flex items-center justify-center"
            title="ຄລິກເພື່ອເບິ່ງຮູບພາບຂະໜາດເຕັມ"
          >
            <img 
              src={fileData} 
              alt={fileName} 
              className="w-full h-full object-cover group-hover:scale-105 transition duration-200" 
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white text-[9px] font-bold">ເບິ່ງຮູບ</span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPreviewDoc({ fileName, fileData, rawStr: docStr })}
            title={`ຄລິກເພື່ອເປີດເບິ່ງ ຫຼື ດາວໂຫລດ: ${fileName}`}
            className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded border border-indigo-100 transition shadow-sm cursor-pointer"
          >
            {isPdf ? <span className="text-red-500 font-bold">PDF</span> : <span>📄</span>}
            <span className="max-w-[100px] truncate">{fileName}</span>
          </button>
        )}
      </div>
    );
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(currentUser.status === "Admin" ? 'ALL' : currentUser.branch);
  const [resultFilter, setResultFilter] = useState('ALL');

  // Preview Document states
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

  // Filter application
  const filteredList = repairs.filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const sAsset = item.ລາຍການ || "";
    const sCode = item.ລະຫັດກວດກາ || "";
    const sVendor = item["vendor ຜູ້ສະໜອງ"] || "";
    const sResult = item.ຜົນການແກ້ໄຂ || "";

    const matchesSearch = 
      sCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sAsset.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sVendor.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesBranch = branchFilter === "ALL" || sBranch === branchFilter;
    
    let matchesResult = true;
    if (resultFilter !== "ALL") {
      matchesResult = sResult.toLowerCase() === resultFilter.toLowerCase();
    }

    return matchesSearch && matchesBranch && matchesResult;
  }).sort((a,b) => {
    const scrapB = String(b.ວັນທີ່ສຳເລັດ || b.ວັນທີ່ກວດ);
    const scrapA = String(a.ວັນທີ່ສຳເລັດ || a.ວັນທີ່ກວດ);
    return scrapB.localeCompare(scrapA);
  });

  // Calculate total money spent on this filtered list
  const totalCost = filteredList.reduce((sum, item) => sum + (Number(item.ມູນຄ່າສ້ອມແປງ) || 0), 0);
  const averageDays = filteredList.length > 0 
    ? (filteredList.reduce((sum, item) => sum + (Number(item.ລວມມື້ທີ່ສຳເລັດ) || 0), 0) / filteredList.length).toFixed(1) 
    : "0.0";

  // Export to Excel function
  const handleExportExcel = () => {
    const sanitizeRow = (rowObj: any) => {
      const clean: any = {};
      for (const key of Object.keys(rowObj)) {
        let val = rowObj[key];
        if (val === null || val === undefined) {
          clean[key] = '';
        } else {
          let strVal = String(val).trim();
          strVal = strVal.replace(/\|/g, ' ');
          
          const lower = strVal.toLowerCase();
          if (lower === 'none' || lower === 'null' || lower === 'undefined' || strVal === '—') {
            clean[key] = '';
          } else {
            if (typeof val === 'number') {
              clean[key] = val;
            } else {
              clean[key] = strVal;
            }
          }
        }
      }
      return clean;
    };

    // prepare the data
    const exportData: any[] = [];
    let rowCounter = 1;

    filteredList.forEach((rep) => {
      const assetInfo = getAssetInfo(rep);
      const incidentItem = findIncidentByPID(rep.PID);
      const assessmentItem = assessments?.find(asm => asm.incidentId === rep.PID);
      const approvalItem = approvals?.find(app => app.PID === rep.PID);
      const trackingItem = repairTracking.find(t => t.PID === rep.PID);

      // Helper to get SLA Status based on original expected date
      const getSlaStatusForLog = (item: RepairLogRecord) => {
        if (item.ສະຖານະ === "Cancelled") {
          return "ຍົກເລີກ";
        }
        if (!trackingItem || !trackingItem.expectedFinishDate) {
          return "ສຳເລັດແລ້ວ";
        }
        const actualStr = String(item.ວັນທີ່ສຳເລັດ || item.ວັນທີ່ສ້ອມແປງ || "");
        const expectedStr = String(trackingItem.expectedFinishDate);
        
        if (actualStr && expectedStr) {
          const actualD = new Date(actualStr);
          const expectedD = new Date(expectedStr);
          expectedD.setHours(23, 59, 59, 999);
          if (!isNaN(actualD.getTime()) && !isNaN(expectedD.getTime())) {
            if (actualD.getTime() > expectedD.getTime()) {
              return "ເກີນກຳນົດ";
            }
          }
        }
        return "ສຳເລັດແລ້ວ";
      };

      const slaStatus = getSlaStatusForLog(rep);

      const totalEstCost = assessmentItem 
        ? (assessmentItem.subItems || []).reduce((sum, s) => sum + (s.estimatedTotalCost || 0), 0) 
        : 0;

      const baseRow = {
        "ລ/ດ (No.)": 0,
        "ລະຫັດ PID (PID)": rep.PID,
        "ລະຫັດກວດກາ (Inspection Ref)": rep.ລະຫັດກວດກາ || incidentItem?.ລະຫັດກວດກາ || '',
        "ຮູບແບບການກວດ (Inspection Type)": rep.ຮູບແບບການກວດ || incidentItem?.ຮູບແບບການກວດ || assessmentItem?.inspectionType || trackingItem?.ຮູບແບບການກວດ || (rep.ລະຫັດກວດກາ?.startsWith("LDB-SAF-M") ? "ລາຍງານເຫດການເສຍຫາຍ" : "ກວດປະຈຳວັນ"),
        "ສາຂາ (Branch)": rep["ສາຂາ "] || incidentItem?.["ສາຂາ "] || incidentItem?.["ສາຂາ"] || '',
        "ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)": rep["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || incidentItem?.["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '',
        "ຂະແໜງ (Sector)": getDisplaySector(rep) || incidentItem?.["ຂະແໜງ"] || '',
        [LOCATION_FLOOR_LABEL]: rep.ສະຖານທີ່_ຫ້ອງ || incidentItem?.ສະຖານທີ່_ຫ້ອງ || assessmentItem?.roomOrLocation || '—',
        "ລະບົບທີ່ກວດ (System Category)": rep.ລະບົບທີ່ກວດ || incidentItem?.ລະບົບທີ່ກວດ || assessmentItem?.systemCategory || trackingItem?.ລະບົບທີ່ກວດ || '',
        "ພື້ນທີ່/ຈຸດກວດ (Area / Point)": rep.ໝວດລະບົບກວດ || incidentItem?.ໝວດລະບົບກວດ || assessmentItem?.subsystemCategory || trackingItem?.ໝວດລະບົບກວດ || '',
        "ລະຫັດຊັບສິນ (Asset Code)": rep.ລະຫັດຊັບສິນ || incidentItem?.ລະຫັດຊັບສິນ || assessmentItem?.assetCode || '',
        "ລາຍການຊັບສິນ (Asset Name)": rep.ລາຍການ || incidentItem?.ລາຍການ || assessmentItem?.assetName || '',
        "ພາກສ່ວນຊັບສົມບັດ (Asset Category)": rep.ພາກສ່ວນຊັບສົມບັດ || incidentItem?.ພາກສ່ວນຊັບສົມບັດ || '',
        "ໝວດລາຍການ (Asset Group)": rep.ໝວດລາຍການ || incidentItem?.ໝວດລາຍການ || assessmentItem?.itemType || '',
        "ສາຂາຂອງຊັບສິນ (Asset Branch)": (assetInfo.assetBranch && assetInfo.assetBranch !== 'none') ? assetInfo.assetBranch : '',
        "ຝ່າຍ/ໜ່ວຍບໍລິການຊັບສິນ (Asset Division/Unit)": (assetInfo.assetUnit && assetInfo.assetUnit !== 'none') ? assetInfo.assetUnit : '',
        "ຂະແໜງຊັບສິນ (Asset Sector)": (assetInfo.assetSector && assetInfo.assetSector !== 'none') ? assetInfo.assetSector : '',
        "ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)": rep.ລາຍລະອຽດປັນຫາທີ່ພົບ || incidentItem?.ລາຍລະອຽດປັນຫາທີ່ພົບ || '',
        "ປະເມີນຜົນກະທົບ (Impact Level)": rep.ປະເມີນຜົນກະທົບ || incidentItem?.ປະເມີນຜົນກະທົບ || assessmentItem?.impactLevel || trackingItem?.ປະເມີນຜົນກະທົບ || '',
        "ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)": rep.ວີທີແກ້ໄຂ || incidentItem?.ວີທີແກ້ໄຂ || assessmentItem?.proposedSolution || trackingItem?.ວີທີແກ້ໄຂ || '',
        "ວັນທີ່ກວດ (Detected Date)": rep.ວັນທີ່ກວດ || incidentItem?.ວັນທີ່ກວດ || '',
        "ເວລາກວດ (Detected Time)": rep.ເວລາກວດ || incidentItem?.ເວລາກວດ || trackingItem?.ເວລາກວດ || '',
        "ຜູ້ກວດກາ (Reporter)": rep.ຜູ້ກວດກາ || rep.ຊື່ຜູ້ກວດ || incidentItem?.ຊື່ຜູ້ກວດ || incidentItem?.ຜູ້ກວດກາ || '',
        
        // Assessment Section
        "ລະຫັດປະເມີນ (Assessment ID)": assessmentItem?.assessmentId || assessmentItem?.PID || '',
        "ຜູ້ປະເມີນ (Assessor Name)": assessmentItem?.assessorName || '',
        "ປະເພດຜູ້ປະເມີນ (Assessor Type)": assessmentItem?.assessorType || '',
        "ບໍລິສັດຜູ້ປະເມີນ (Assessor Vendor)": assessmentItem?.vendorName || '',
        "ວັນທີປະເມີນ (Assessment Date)": assessmentItem?.assessmentDate || '',
        "ໝາຍເຫດການປະເມີນ (Assessment Remark)": assessmentItem?.assessmentRemark || '',
        "ສະຖານະປະເມີນ (Assessment Status)": assessmentItem?.assessmentStatus || '',
        "ມູນຄ່າປະເມີນລວມ (Total Estimated Cost)": totalEstCost,
        "ລາຍການສ້ອມຍ່ອຍ (Repair Subitems)": "",

        // Approval Section
        "ຜູ້ອະນຸມັດ (Approved By)": approvalItem?.ຜູ້ອະນຸມັດ || '',
        "ວັນທີອະນຸມັດ (Approval Date)": approvalItem?.ວັນທີ່ອະນຸມັດ || '',
        "ເອກະສານອ້າງອີງອະນຸມັດ (Approval Document)": approvalItem?.ເອກະສານອະນຸມັດ 
          ? (approvalItem.ເອກະສານອະນຸມັດ.length > 200 || approvalItem.ເອກະສານອະນຸມັດ.startsWith("data:") ? "ມີເອກະສານອະນຸມັດ (Has Document)" : approvalItem.ເອກະສານອະນຸມັດ) 
          : '',
        "ຜູ້ສະໜອງທີ່ໄດ້ຮັບອະນຸມັດ (Approved Vendor)": approvalItem?.["vendor ຜູ້ສະໜອງ"] || '',
        "ການດຳເນີນງານອະນຸມັດ (Approval Operation)": approvalItem?.ການດຳເນີນງານ || '',

        // Tracking Section
        "ວັນທີ່ເລີ່ມສ້ອມ (Start Repair Date)": trackingItem?.startRepairDate || '',
        "ວັນທີ່ຄາດວ່າຈະສຳເລັດ (Expected Finish Date)": trackingItem?.expectedFinishDate || '',
        "ຄວາມຄືບໜ້າ (Progress)": trackingItem?.progressPercent !== undefined ? `${trackingItem.progressPercent}%` : "100%",
        "ສະຖານະຕິດຕາມ (Tracking Status)": trackingItem?.trackingStatus || "ປິດງານແລ້ວ",
        "ຜູ້ຮັບຜິດຊອບຕິດຕາມ (Tracking Owner)": trackingItem?.owner || '',
        "ໝາຍເຫດຕິດຕາມ (Tracking Remark)": trackingItem?.delayReason || trackingItem?.progressRemark || '',

        // Closing Section
        "ວັນທີ່ສຳເລັດຈິງ (Actual Finish Date)": rep.ວັນທີ່ສຳເລັດ || rep.ວັນທີ່ສ້ອມແປງ || '',
        "ມູນຄ່າສ້ອມແປງຈິງ (Actual Cost LAK)": Number(rep.ມູນຄ່າສ້ອມແປງ) || 0,
        "ຜົນການແກ້ໄຂ (Result)": rep.ຜົນການແກ້ໄຂ || '',
        "ຜົນທົດສອບ (Test Outcome)": rep.ຜົນທົດສອບ || '',
        "ລວມມື້ສ້ອມ (Total Days)": Number(rep.ລວມມື້ທີ່ສຳເລັດ) || 0,
        "ສະຖານະ (Status)": rep.ສະຖານະ || "ສຳເລັດ",
        "ສະຖານະ SLA (SLA Status)": slaStatus,

        // Subitem Columns placeholder
        "Subitem No": "",
        "Repair Subitem Name": "",
        "Repair Type": "",
        "Quantity": "",
        "Unit": "",
        "Subitem Cost": "",
        "Case Total Estimated Cost": totalEstCost
      };

      const subItems = assessmentItem?.subItems || [];
      if (subItems.length > 0) {
        subItems.forEach((sub, subIdx) => {
          const subName = sub.repairSubItem || '';
          const subType = sub.workType || '';
          const subQty = (sub.quantity !== undefined && sub.quantity !== null) ? sub.quantity : '';
          const subUnit = sub.unit || '';
          const subCost = (sub.estimatedTotalCost !== undefined && sub.estimatedTotalCost !== null) ? sub.estimatedTotalCost : 0;
          
          const formattedSubItem = subName
            ? `${subName} (${subType} - ${subQty} ${subUnit}: ${subCost} LAK)`
            : '';

          exportData.push(sanitizeRow({
            ...baseRow,
            "ລ/ດ (No.)": rowCounter++,
            "ລາຍການສ້ອມຍ່ອຍ (Repair Subitems)": formattedSubItem,
            "Subitem No": subIdx + 1,
            "Repair Subitem Name": subName,
            "Repair Type": subType,
            "Quantity": subQty,
            "Unit": subUnit,
            "Subitem Cost": subCost,
            "Case Total Estimated Cost": totalEstCost
          }));
        });
      } else {
        exportData.push(sanitizeRow({
          ...baseRow,
          "ລ/ດ (No.)": rowCounter++,
          "ລາຍການສ້ອມຍ່ອຍ (Repair Subitems)": "",
          "Subitem No": "",
          "Repair Subitem Name": "",
          "Repair Type": "",
          "Quantity": "",
          "Unit": "",
          "Subitem Cost": "",
          "Case Total Estimated Cost": totalEstCost
        }));
      }
    });

    // Create Worksheet
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Repairs History");
    XLSX.writeFile(workbook, `ລາຍງານປະຫວັດການສ້ອມແປງ_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* Title & Overall metric */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-800">ທະບຽນປະຫວັດການສ້ອມແປງ (Maintenance & Repair Archive)</h3>
          <p className="text-xs text-slate-500">
            ປະຫວັດການສ້ອມແປງທັງໝົດ, ການແກ້ໄຂບັນຫາ, ລາຍຈ່າຍຕົວຈິງ ແລະ ໄລຍະເວລາສ້ອມແປງ
          </p>
        </div>
        
        {/* Dynamic spend indicators */}
        <div className="flex space-x-3 text-xs">
          <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center space-x-2.5">
            <Coins className="h-5 w-5 text-emerald-800 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">ງົບສ້ອມແປງໃນຂອບເຂດນີ້</p>
              <h4 className="font-bold text-sm text-emerald-900 font-display">{formatLAK(totalCost)}</h4>
            </div>
          </div>

          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center space-x-2.5">
            <Clock className="h-5 w-5 text-indigo-800 shrink-0" />
            <div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase">ສະເລ່ຍມື້ສ້ອມແປງ</p>
              <h4 className="font-bold text-sm text-indigo-900 font-display">{averageDays} ວັນ</h4>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Form */}
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
        <div>
          <label className="block text-slate-500 mb-1">ຄົ້ນຫາ</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ລະຫັດກວດກາ, ຊັບສິນ, ຜູ້ສະໜອງ..."
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
            {Array.from(new Set(repairs.map(r => r["ສາຂາ "]))).filter(Boolean).map((br, idx) => (
              <option key={idx} value={br}>{br}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-500 mb-1">ຜົນການແກ້ໄຂ / ສະພາບ</label>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:ring-2 focus:ring-emerald-500"
          >
            <option value="ALL">ທຸກສະພາບ</option>
            <option value="good">good (ດີ/ໃຊ້ໄດ້)</option>
            <option value="replaced">replaced (ປ່ຽນໃຫມ່)</option>
            <option value="repaired">repaired (ສ້ອມແປງແລ້ວ)</option>
          </select>
        </div>
      </div>

      {/* Repairs Table */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden animate-fadeIn">
        <div className="p-4 border-b border-slate-50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">
            ປະຫວັດສຳເລັດ ({filteredList.length} ລາຍການ)
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
          <table className="min-w-[2200px] text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <th className="p-3 w-32 text-[10px] uppercase font-bold text-slate-400 font-mono">ລະຫັດອ້າງອີງ / PID</th>
                <th className="p-3 w-56">ສາຂາ / ຝ່າຍ / ຂະແໜງ</th>
                <th className="p-3 w-64">ຊັບສິນ & ໝວດໝູ່</th>
                <th className="p-3 w-72">ບັນຫາທີ່ພົບ / ຜູ້ກວດ</th>
                <th className="p-3 w-72">ການປະເມີນ (Assessment)</th>
                <th className="p-3 w-64">ການອະນຸມັດ (Approval)</th>
                <th className="p-3 w-64">ການຕິດຕາມ (Tracking)</th>
                <th className="p-3 w-64">ຜົນສ້ອມແປງຈິງ & ວັນທີ</th>
                <th className="p-3 w-48 text-right">ມູນຄ່າຈິງ & ຜູ້ສະໜອງ</th>
                <th className="p-3 w-44 text-center">ສະຖານະ & SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredList.slice(0, 50).map((rep, idx) => {
                const incidentItem = findIncidentByPID(rep.PID);
                const assessmentItem = assessments?.find(asm => asm.incidentId === rep.PID);
                const approvalItem = approvals?.find(app => app.PID === rep.PID);
                const trackingItem = repairTracking.find(t => t.PID === rep.PID);

                const totalEstCost = assessmentItem 
                  ? (assessmentItem.subItems || []).reduce((sum, s) => sum + (s.estimatedTotalCost || 0), 0) 
                  : 0;

                // Helper to get SLA Status based on original expected date
                const getSlaStatusForLog = (item: RepairLogRecord) => {
                  if (item.ສະຖານະ === "Cancelled") {
                    return "ຍົກເລີກ";
                  }
                  if (!trackingItem || !trackingItem.expectedFinishDate) {
                    return "ສຳເລັດແລ້ວ";
                  }
                  const actualStr = String(item.ວັນທີ່ສຳເລັດ || item.ວັນທີ່ສ້ອມແປງ || "");
                  const expectedStr = String(trackingItem.expectedFinishDate);
                  
                  if (actualStr && expectedStr) {
                    const actualD = new Date(actualStr);
                    const expectedD = new Date(expectedStr);
                    expectedD.setHours(23, 59, 59, 999);
                    if (!isNaN(actualD.getTime()) && !isNaN(expectedD.getTime())) {
                      if (actualD.getTime() > expectedD.getTime()) {
                        return "ເກີນກຳນົດ";
                      }
                    }
                  }
                  return "ສຳເລັດແລ້ວ";
                };

                const getSlaBadgeColor = (sla: string) => {
                  switch (sla) {
                    case "ເກີນກຳນົດ":
                      return "bg-red-100 text-red-800 border-red-200";
                    case "ໃກ້ເກີນກຳນົດ":
                      return "bg-amber-100 text-amber-800 border-amber-200";
                    case "ສຳເລັດແລ້ວ":
                      return "bg-emerald-100 text-emerald-850 border-emerald-200";
                    case "ຍົກເລີກ":
                      return "bg-slate-100 text-slate-500 border-slate-200";
                    default:
                      return "bg-blue-100 text-blue-800 border-blue-200";
                  }
                };

                const slaStatus = getSlaStatusForLog(rep);

                return (
                  <tr key={idx} className="hover:bg-slate-50 text-slate-700 transition align-top">
                    {/* 1. Ref ID / PID */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 break-words">{rep.ລະຫັດກວດກາ || incidentItem?.ລະຫັດກວດກາ}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5 break-all">PID: {rep.PID}</div>
                      <div className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1 py-0.5 rounded mt-1 inline-block">
                        {rep.ຮູບແບບການກວດ || incidentItem?.ຮູບແບບການກວດ || (rep.ລະຫັດກວດກາ?.startsWith("LDB-SAF-M") ? "ລາຍງານເຫດການເສຍຫາຍ" : "ກວດປະຈຳວັນ")}
                      </div>
                    </td>

                    {/* 2. Branch / Department / Sector */}
                    <td className="p-3">
                      <div className="font-bold text-slate-800 break-words">{(rep["ສາຂາ "] || incidentItem?.["ສາຂາ "] || "").replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-semibold break-words">
                        📁 {rep["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || incidentItem?.["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "—"}
                      </div>
                      <div className="text-[9px] text-indigo-600 mt-1 font-bold break-words">
                        Sector: {getDisplaySector(rep) || incidentItem?.["ຂະແໜງ"] || "—"}
                      </div>
                      {(rep.ສະຖານທີ່_ຫ້ອງ || incidentItem?.ສະຖານທີ່_ຫ້ອງ) && (
                        <div className="text-[9px] text-emerald-700 mt-0.5 font-medium break-words">
                          🚪 {rep.ສະຖານທີ່_ຫ້ອງ || incidentItem?.ສະຖານທີ່_ຫ້ອງ}
                        </div>
                      )}
                    </td>

                    {/* 3. Asset & Categories */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 break-words">{rep.ລາຍການ}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">ລະຫັດ: {rep.ລະຫັດຊັບສິນ || "—"}</div>
                      <div className="text-[9px] text-indigo-700 mt-1 font-bold break-words">
                        {rep.ລະບົບທີ່ກວດ || incidentItem?.ລະບົບທີ່ກວດ || "—"}
                      </div>
                      <div className="text-[9px] text-slate-450 font-medium break-words">
                        {rep.ໝວດລະບົບກວດ || incidentItem?.ໝວດລະບົບກວດ || "—"}
                      </div>
                      {(rep.ພາກສ່ວນຊັບສົມບັດ || rep.ໝວດລາຍການ) && (
                        <div className="text-[9px] text-slate-400 mt-1 border-t border-slate-100 pt-0.5 break-words">
                          Cat: {rep.ພາກສ່ວນຊັບສົມບັດ || "—"} | Grp: {rep.ໝວດລາຍການ || "—"}
                        </div>
                      )}
                    </td>

                    {/* 4. Issue & Reporter */}
                    <td className="p-3">
                      <div className="text-[11px] font-medium text-slate-700 break-words line-clamp-3" title={rep.ລາຍລະອຽດປັນຫາທີ່ພົບ || incidentItem?.ລາຍລະອຽດປັນຫາທີ່ພົບ}>
                        {rep.ລາຍລະອຽດປັນຫາທີ່ພົບ || incidentItem?.ລາຍລະອຽດປັນຫາທີ່ພົບ || "—"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          rep.ປະເມີນຜົນກະທົບ === 'ສູງ' 
                            ? 'bg-red-50 text-red-700 border border-red-100' 
                            : rep.ປະເມີນຜົນກະທົບ === 'ປານກາງ' 
                              ? 'bg-amber-50 text-amber-850 border border-amber-100' 
                              : 'bg-slate-50 text-slate-600 border border-slate-150'
                        }`}>
                          ຜົນກະທົບ: {rep.ປະເມີນຜົນກະທົບ || "—"}
                        </span>
                      </div>
                      <div className="text-[9px] text-slate-450 mt-1 font-semibold break-words">
                        📅 ວັນກວດ: {rep.ວັນທີ່ກວດ || incidentItem?.ວັນທີ່ກວດ || "—"} {rep.ເວລາກວດ || incidentItem?.ເວລາກວດ}
                      </div>
                      <div className="text-[9px] text-slate-500 font-medium break-words">
                        👤 ໂດຍ: {rep.ຜູ້ກວດກາ || rep.ຊື່ຜູ້ກວດ || incidentItem?.ຊື່ຜູ້ກວດ || "—"}
                      </div>
                    </td>

                    {/* 5. Assessment Details */}
                    <td className="p-3 bg-slate-50/30">
                      {assessmentItem ? (
                        <div className="space-y-1">
                          <p className="font-bold text-slate-800 text-[10px] break-words">👤 {assessmentItem.assessorName}</p>
                          <p className="text-[9px] text-slate-500 font-medium">{assessmentItem.assessorType} {assessmentItem.vendorName ? `(${assessmentItem.vendorName})` : ''}</p>
                          <div className="text-[10px] text-indigo-850 font-bold font-mono">
                            ປະເມີນ: {formatLAK(totalEstCost)}
                          </div>
                          {assessmentItem.subItems && assessmentItem.subItems.length > 0 && (
                            <div className="text-[9px] text-slate-450 max-h-[60px] overflow-y-auto border-t border-slate-150/55 pt-1 space-y-0.5">
                              {assessmentItem.subItems.map((sub, sIdx) => (
                                <div key={sIdx} className="truncate" title={`${sub.repairSubItem} - ${sub.workType}`}>
                                  • {sub.repairSubItem} ({sub.workType})
                                </div>
                              ))}
                            </div>
                          )}
                          <p className="text-[9px] text-slate-450 italic truncate" title={assessmentItem.assessmentRemark}>
                            {assessmentItem.assessmentRemark ? `💬 ${assessmentItem.assessmentRemark}` : ''}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">ບໍ່ຕ້ອງມີການປະເມີນ / ບໍ່ພົບ</span>
                      )}
                    </td>

                    {/* 6. Approval details */}
                    <td className="p-3">
                      {approvalItem ? (
                        <div className="space-y-1 text-[10px]">
                          <p className="font-bold text-slate-800 break-words">👤 {approvalItem.ຜູ້ອະນຸມັດ}</p>
                          <p className="text-[9px] text-slate-500 font-medium">📅 {approvalItem.ວັນທີ່ອະນຸມັດ}</p>
                          <div className="text-[9px] text-indigo-700 font-sans break-all">
                            <span className="font-semibold block text-[8px] text-slate-400 uppercase tracking-wider mb-0.5">ເອກະສານ (Doc):</span>
                            {renderApprovalDocPreview(approvalItem.ເອກະສານອະນຸມັດ)}
                          </div>
                          <p className="text-[9px] text-slate-500 font-bold break-words mt-1">Vendor: {approvalItem["vendor ຜູ້ສະໜອງ"] || "—"}</p>
                          <p className="text-[9px] text-emerald-800 font-semibold break-words">ຜົນອະນຸມັດ: {approvalItem.ການດຳເນີນງານ || "—"}</p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">ບໍ່ພົບຂໍ້ມູນອະນຸມັດ</span>
                      )}
                    </td>

                    {/* 7. Tracking details */}
                    <td className="p-3 bg-slate-50/30">
                      {trackingItem ? (
                        <div className="space-y-1 text-[10px]">
                          <p className="text-[9px] text-slate-500 font-semibold">📅 ເລີ່ມສ້ອມ: {trackingItem.startRepairDate || "—"}</p>
                          <p className="text-[9px] text-rose-600 font-semibold">📅 ຄາດສຳເລັດ: {trackingItem.expectedFinishDate || "—"}</p>
                          <p className="text-[9px] text-slate-500 font-bold truncate">👤 ຜູ້ຮັບຜິດຊອບ: {trackingItem.owner || "—"}</p>
                          <p className="text-[9px] text-slate-450 break-words italic">
                            {trackingItem.delayReason || trackingItem.progressRemark ? `💬 ${trackingItem.delayReason || trackingItem.progressRemark}` : ''}
                          </p>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">ບໍ່ພົບຂໍ້ມູນຕິດຕາມ</span>
                      )}
                    </td>

                    {/* 8. Actual Finish Date & Result */}
                    <td className="p-3">
                      <div className="font-bold text-slate-900 font-mono text-[11px]">{rep.ວັນທີ່ສຳເລັດ || rep.ວັນທີ່ສ້ອມແປງ}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-bold">ລວມມື້ສ້ອມ: {rep.ລວມມື້ທີ່ສຳເລັດ || 0} ວັນ</div>
                      <div className="text-[10px] text-emerald-800 mt-1 font-semibold break-words">
                        ຜົນ: {rep.ຜົນການແກ້ໄຂ || "—"}
                      </div>
                      {rep.ຜົນທົດສອບ && (
                        <div className="text-[9px] text-indigo-700 break-words italic">
                          Test: {rep.ຜົນທົດສອບ}
                        </div>
                      )}
                    </td>

                    {/* 9. Cost & Vendor */}
                    <td className="p-3 text-right">
                      <div className="font-bold text-emerald-800 font-mono text-[12px]">{formatLAK(rep.ມູນຄ່າສ້ອມແປງ)}</div>
                      <div className="text-[10px] text-slate-500 mt-1 break-words">ໂດຍ: {rep["vendor ຜູ້ສະໜອງ"] || "—"}</div>
                    </td>

                    {/* 10. Status & SLA */}
                    <td className="p-3 text-center">
                      <div className="space-y-1.5">
                        {rep.ສະຖານະ === "Cancelled" ? (
                          <span className="inline-block border px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-800 border-rose-200">
                            ຍົກເລີກ / Cancelled
                          </span>
                        ) : (
                          <span className="inline-block border px-2 py-0.5 rounded-full text-[9px] font-bold bg-purple-100 text-purple-800 border-purple-200">
                            ປິດງານແລ້ວ
                          </span>
                        )}
                        <span className={`block border px-2 py-0.5 rounded-full text-[9px] font-bold mx-auto w-fit ${getSlaBadgeColor(slaStatus)}`}>
                          {slaStatus}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredList.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-12 text-slate-400">
                    ບໍ່ມີປະຫວັດການສ້ອມແປງທີ່ກົງກັບຕົວຕອງ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {filteredList.length > 50 && (
          <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-slate-400 text-[10px]">
            ສະແດງສະເພາະ 50 ປະຫວັດຫຼ້າສຸດ. ໃຊ້ປຸ່ມຄົ້ນຫາ ແລະ ຕົວຕອງ ເພື່ອຊອກຫາຂໍ້ມູນເພີ່ມເຕີມ
          </div>
        )}
      </div>

      {/* Document Preview and Download Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-2xl w-full flex flex-col overflow-hidden max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs">
                <FileText className="h-5 w-5 text-indigo-400" />
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

    </div>
  );
}
