/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from 'react';
import { 
  Search, Play, RefreshCw, AlertTriangle, ToggleLeft, ToggleRight, CheckCircle, 
  Hourglass, FileText, Ban, Trash2, SlidersHorizontal, MapPin, Briefcase, 
  CheckCircle2, DollarSign, Image as ImageIcon, Camera, Eye, Plus, Calendar, Clock, ArrowRight,
  TrendingUp, Users, Percent, HelpCircle, X, Download
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { RepairTrackingRecord, UserAccount, RepairLogRecord } from '../types';
import { formatLAK, formatExcelDate, calculateSLAStatus, parseDateSafe, formatDateSafe } from '../dataStore';

interface RepairTrackingViewProps {
  trackingList: RepairTrackingRecord[];
  repairs?: RepairLogRecord[];
  onStartRepair: (pid: string, startDate: string, expectedFinishDate: string) => void;
  onUpdateProgress: (pid: string, progress: number, remark: string, duringPhoto?: string, delayReason?: string) => void;
  onWaitingStatus: (pid: string, status: "ລໍຖ້າອະໄຫຼ່" | "ລໍຖ້າ Vendor", delayReason: string, remark: string) => void;
  onPauseRepair: (pid: string, reason: string) => void;
  onCompleteRepair: (pid: string, actualFinishDate: string, repairResult: string, testResult: string, cost: number, afterPhoto?: string) => void;
  onCloseJob: (pid: string) => void;
  onResumeRepair?: (pid: string) => void;
  currentUser: UserAccount;
  onRefreshData?: () => void;
}

export default function RepairTrackingView({
  trackingList,
  repairs = [],
  onStartRepair,
  onUpdateProgress,
  onWaitingStatus,
  onPauseRepair,
  onCompleteRepair,
  onCloseJob,
  onResumeRepair,
  currentUser,
  onRefreshData
}: RepairTrackingViewProps) {
  const isAdmin = currentUser.status === "Admin";
  const userBranch = currentUser.branch || "";

  // Time Range Filters State
  const [timeRange, setTimeRange] = useState<string>('ALL'); // 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM'
  const [customFromDate, setCustomFromDate] = useState<string>('');
  const [customToDate, setCustomToDate] = useState<string>('');

  // Auto Refresh State
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [secondsToRefresh, setSecondsToRefresh] = useState(10);
  const [lastRefreshedTime, setLastRefreshedTime] = useState(new Date().toLocaleTimeString('la-LA', { hour12: false }));

  // Auto Refresh countdown
  React.useEffect(() => {
    if (!isAutoRefresh) return;
    
    const interval = setInterval(() => {
      setSecondsToRefresh((prev) => prev - 1);
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isAutoRefresh]);

  // Handle auto refresh action when counter hits 0 or less
  React.useEffect(() => {
    if (secondsToRefresh <= 0) {
      if (onRefreshData) {
        onRefreshData();
      }
      setLastRefreshedTime(new Date().toLocaleTimeString('la-LA', { hour12: false }));
      setSecondsToRefresh(10);
    }
  }, [secondsToRefresh, onRefreshData]);

  // Handle manual refresh
  const triggerManualRefresh = () => {
    if (onRefreshData) {
      onRefreshData();
    }
    setLastRefreshedTime(new Date().toLocaleTimeString('la-LA', { hour12: false }));
    setSecondsToRefresh(10);
  };

  // Helper to filter dates
  const isDateInTimeRange = (dateStr: string | number | undefined, range: string) => {
    if (!dateStr) return false;
    const itemDate = parseDateSafe(dateStr);
    const today = new Date();
    
    // Normalize to midnight for accurate comparisons
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const itemMidnight = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
    
    switch (range) {
      case 'TODAY': {
        return itemMidnight.getTime() === todayMidnight.getTime();
      }
      case 'LAST_7_DAYS': {
        const diffTime = todayMidnight.getTime() - itemMidnight.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 7;
      }
      case 'LAST_30_DAYS': {
        const diffTime = todayMidnight.getTime() - itemMidnight.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 30;
      }
      case 'THIS_MONTH': {
        return itemDate.getFullYear() === today.getFullYear() && itemDate.getMonth() === today.getMonth();
      }
      case 'THIS_QUARTER': {
        if (itemDate.getFullYear() !== today.getFullYear()) return false;
        const itemQuarter = Math.floor(itemDate.getMonth() / 3);
        const todayQuarter = Math.floor(today.getMonth() / 3);
        return itemQuarter === todayQuarter;
      }
      case 'THIS_YEAR': {
        return itemDate.getFullYear() === today.getFullYear();
      }
      case 'CUSTOM': {
        if (!customFromDate && !customToDate) return true;
        if (customFromDate) {
          const fromDate = parseDateSafe(customFromDate);
          const fromMidnight = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
          if (itemMidnight.getTime() < fromMidnight.getTime()) return false;
        }
        if (customToDate) {
          const toDate = parseDateSafe(customToDate);
          const toMidnight = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
          if (itemMidnight.getTime() > toMidnight.getTime()) return false;
        }
        return true;
      }
      case 'ALL':
      default:
        return true;
    }
  };

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState(isAdmin ? 'ALL' : userBranch);
  const [systemFilter, setSystemFilter] = useState('ALL');
  const [impactFilter, setImpactFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [slaFilter, setSlaFilter] = useState('ALL');
  const [vendorFilter, setVendorFilter] = useState('ALL');
  const [ownerFilter, setOwnerFilter] = useState('ALL');

  // Modals & Action States
  const [selectedItem, setSelectedItem] = useState<RepairTrackingRecord | null>(null);
  const [activeModal, setActiveModal] = useState<"start" | "progress" | "waiting" | "pause" | "complete" | "view" | "close_confirm" | null>(null);

  // Form fields
  const [inputDate, setInputDate] = useState(new Date().toISOString().split('T')[0]);
  const [inputExpectedDate, setInputExpectedDate] = useState('');
  const [inputProgress, setInputProgress] = useState(50);
  const [inputRemark, setInputRemark] = useState('');
  const [inputDelayReason, setInputDelayReason] = useState('');
  const [inputDuringPhoto, setInputDuringPhoto] = useState('');
  const [inputAfterPhoto, setInputAfterPhoto] = useState('');
  const [inputRepairResult, setInputRepairResult] = useState('');
  const [inputTestResult, setInputTestResult] = useState('');
  const [inputCost, setInputCost] = useState('0');
  const [waitingType, setWaitingType] = useState<"ລໍຖ້າອະໄຫຼ່" | "ລໍຖ້າ Vendor">("ລໍຖ້າອະໄຫຼ່");

  // Filter out closed/completed items from the tracking list entirely
  const activeTrackingList = trackingList.filter(item => item.trackingStatus !== "ປິດງານແລ້ວ");

  // Dynamic lists for filters
  const branches = Array.from(new Set(activeTrackingList.map(item => item["ສາຂา "] || item["ສາຂາ"]))).filter(Boolean);
  const systems = Array.from(new Set(activeTrackingList.map(item => item.ລະບົບທີ່ກວດ))).filter(Boolean);
  const vendors = Array.from(new Set(activeTrackingList.map(item => item.vendor))).filter(Boolean);
  const owners = Array.from(new Set(activeTrackingList.map(item => item.owner))).filter(Boolean);

  // Apply Recalculation of SLA Status on list
  const trackingListWithSLA = activeTrackingList.map(item => {
    const freshSLA = calculateSLAStatus(item.expectedFinishDate, item.trackingStatus);
    return {
      ...item,
      slaStatus: freshSLA
    };
  });

  // Filter List based on User Settings
  const filteredList = trackingListWithSLA.filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const sSystem = item.ລະບົບທີ່ກວດ || "";
    const sImpact = item.ປະເມີນຜົນກະທົບ || "";
    const sStatus = item.trackingStatus || "ລໍຖ້າເລີ່ມສ້ອມ";
    const sSla = item.slaStatus || "ຢູ່ໃນກຳນົດ";
    const sVendor = item.vendor || "";
    const sOwner = item.owner || "";

    const text = (
      (item.ລະຫັດກວດກາ || "") + " " +
      (item.ລາຍການ || "") + " " +
      (item.vendor || "") + " " +
      (item.owner || "") + " " +
      (item.ລາຍລະອຽດປັນຫາທີ່ພົບ || "")
    ).toLowerCase();

    const matchesSearch = text.includes(searchTerm.toLowerCase());
    const matchesBranch = branchFilter === 'ALL' || sBranch === branchFilter;
    const matchesSystem = systemFilter === 'ALL' || sSystem === systemFilter;
    const matchesImpact = impactFilter === 'ALL' || sImpact === impactFilter;
    const matchesStatus = statusFilter === 'ALL' || sStatus === statusFilter;
    const matchesSla = slaFilter === 'ALL' || sSla === slaFilter;
    const matchesVendor = vendorFilter === 'ALL' || sVendor === vendorFilter;
    const matchesOwner = ownerFilter === 'ALL' || sOwner === ownerFilter;

    const itemDateStr = item.ວັນທີ່ອະນຸມັດ || item.ວັນທີ່ກວດ || item.startRepairDate;
    const matchesTime = isDateInTimeRange(itemDateStr, timeRange);

    return matchesSearch && matchesBranch && matchesSystem && matchesImpact && matchesStatus && matchesSla && matchesVendor && matchesOwner && matchesTime;
  });

  // KPI Calculations (on the whole list or branch-filtered list with Time Range Filter)
  const baseKpiList = trackingListWithSLA.filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const matchesBranch = branchFilter === 'ALL' || sBranch === branchFilter;
    const itemDateStr = item.ວັນທີ່ອະນຸມັດ || item.ວັນທີ່ກວດ || item.startRepairDate;
    return matchesBranch && isDateInTimeRange(itemDateStr, timeRange);
  });

  // Filter repairs log for KPIs with Time Range Filter
  const baseRepairs = (repairs || []).filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const matchesBranch = branchFilter === 'ALL' || sBranch === branchFilter;
    const itemDateStr = item.ວັນທີ່ສຳເລັດ || item.ວັນທີ່ສ້ອມແປງ || item.ວັນທີ່ກວດ;
    return matchesBranch && isDateInTimeRange(itemDateStr, timeRange) && item.ສະຖານະ !== "Cancelled";
  });

  // Filter repairs log for Cancelled KPIs with Time Range Filter
  const baseCancelledRepairs = (repairs || []).filter(item => {
    const sBranch = item["ສາຂາ "] || "";
    const matchesBranch = branchFilter === 'ALL' || sBranch === branchFilter;
    const itemDateStr = item.ວັນທີ່ສຳເລັດ || item.ວັນທີ່ສ້ອມແປງ || item.ວັນທີ່ກວດ;
    return matchesBranch && isDateInTimeRange(itemDateStr, timeRange) && item.ສະຖານະ === "Cancelled";
  });

  const kpiClosed = baseRepairs.length;
  const kpiCancelled = baseCancelledRepairs.length;
  const totalApproved = baseKpiList.length + kpiClosed + kpiCancelled;
  const kpiWaitingStart = baseKpiList.filter(item => item.trackingStatus === "ລໍຖ້າເລີ່ມສ້ອມ").length;
  const kpiInProgress = baseKpiList.filter(item => item.trackingStatus === "ກຳລັງດຳເນີນການ").length;
  const kpiWaitingParts = baseKpiList.filter(item => item.trackingStatus === "ລໍຖ້າອະໄຫຼ່").length;
  const kpiWaitingVendor = baseKpiList.filter(item => item.trackingStatus === "ລໍຖ້າ Vendor").length;
  const kpiPaused = baseKpiList.filter(item => item.trackingStatus === "ຢຸດຊົ່ວຄາວ").length;
  const kpiCompleted = baseKpiList.filter(item => item.trackingStatus === "ສ້ອມສຳເລັດ").length;
  const kpiOverdueSLA = baseKpiList.filter(item => item.slaStatus === "ເກີນກຳນົດ" && item.trackingStatus !== "ປິດງານແລ້ວ").length;

  // On-time Completion Rate (percentage of Closed/Completed jobs that aren't Overdue)
  const resolvedActiveJobs = baseKpiList.filter(item => item.trackingStatus === "ສ້ອມສຳເລັດ");
  
  // Calculate overdue for active resolved
  const activeResolvedOnTime = resolvedActiveJobs.filter(item => {
    if (!item.actualFinishDate || !item.expectedFinishDate) return true;
    const act = parseDateSafe(item.actualFinishDate);
    const exp = parseDateSafe(item.expectedFinishDate);
    return act.getTime() <= exp.getTime();
  });

  // Calculate overdue for closed logs
  let closedOverdueCount = 0;
  baseRepairs.forEach(rep => {
    const trackingItem = trackingList.find(t => t.PID === rep.PID);
    if (trackingItem && trackingItem.expectedFinishDate && rep.ວັນທີ່ສຳເລັດ) {
      const act = parseDateSafe(String(rep.ວັນທີ່ສຳເລັດ));
      const exp = parseDateSafe(trackingItem.expectedFinishDate);
      if (act.getTime() > exp.getTime()) {
        closedOverdueCount++;
      }
    }
  });

  const totalResolvedCount = resolvedActiveJobs.length + kpiClosed;
  const onTimeResolvedCount = activeResolvedOnTime.length + (kpiClosed - closedOverdueCount);

  const onTimeCompletionRate = totalResolvedCount > 0 
    ? ((onTimeResolvedCount / totalResolvedCount) * 100).toFixed(0) 
    : "100";

  // Average Repair Days (Active completed jobs + Closed logs)
  let avgRepairDays = "0";
  let totalDaysForAverages = 0;
  let countForAverages = 0;

  const jobsWithTimes = resolvedActiveJobs.filter(item => item.startRepairDate && item.actualFinishDate);
  jobsWithTimes.forEach(item => {
    const sDate = parseDateSafe(item.startRepairDate);
    const fDate = parseDateSafe(item.actualFinishDate);
    const diffTime = fDate.getTime() - sDate.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    totalDaysForAverages += diffDays;
    countForAverages++;
  });

  baseRepairs.forEach(rep => {
    if (rep.ລວມມື້ທີ່ສຳເລັດ !== undefined && Number(rep.ລວມມື້ທີ່ສຳເລັດ) > 0) {
      totalDaysForAverages += Number(rep.ລວມມື້ທີ່ສຳເລັດ);
      countForAverages++;
    }
  });

  if (countForAverages > 0) {
    avgRepairDays = (totalDaysForAverages / countForAverages).toFixed(1);
  }

  // --- Chart 1: Status Distribution
  const statusCounts: { [key: string]: number } = {
    "ລໍຖ້າເລີ່ມສ້ອມ": 0,
    "ກຳລັງດຳເນີນການ": 0,
    "ລໍຖ້າອະໄຫຼ່": 0,
    "ລໍຖ້າ Vendor": 0,
    "ຢຸດຊົ່ວຄາວ": 0,
    "ສ້ອມສຳເລັດ": 0,
    "ປິດງານແລ້ວ": 0,
    "ຍົກເລີກ / Cancelled": 0,
  };
  baseKpiList.forEach(item => {
    const s = item.trackingStatus || "ລໍຖ້າເລີ່ມສ້ອມ";
    if (statusCounts[s] !== undefined) {
      statusCounts[s]++;
    }
  });
  // Add closed repairs count to status distribution
  statusCounts["ປິດງານແລ້ວ"] = kpiClosed;
  statusCounts["ຍົກເລີກ / Cancelled"] = kpiCancelled;

  const statusChartData = Object.keys(statusCounts).map(status => ({
    name: status,
    value: statusCounts[status]
  })).filter(d => d.value > 0);

  // --- Chart 2: Tracking by Branch
  const branchCounts: { [key: string]: { total: number; completed: number; active: number } } = {};
  baseKpiList.forEach(item => {
    const b = item["ສາຂາ "] || "Unknown";
    if (!branchCounts[b]) {
      branchCounts[b] = { total: 0, completed: 0, active: 0 };
    }
    branchCounts[b].total++;
    if (item.trackingStatus === "ສ້ອມສຳເລັດ") {
      branchCounts[b].completed++;
    } else {
      branchCounts[b].active++;
    }
  });

  // Include baseRepairs in branch counts
  baseRepairs.forEach(item => {
    const b = item["ສາຂາ "] || "Unknown";
    if (!branchCounts[b]) {
      branchCounts[b] = { total: 0, completed: 0, active: 0 };
    }
    branchCounts[b].total++;
    branchCounts[b].completed++;
  });

  const branchChartData = Object.keys(branchCounts).map(bName => ({
    branch: bName.replace(/^\d+\.\s*(ສາຂາ\s*)?/, ''),
    'ທັງໝົດ': branchCounts[bName].total,
    'ສຳເລັດແລ້ວ': branchCounts[bName].completed,
    'ກຳລັງດຳເນີນການ': branchCounts[bName].active
  })).slice(0, 10);

  // --- Chart 3: Overdue SLA by Branch
  const overdueBranchCounts: { [key: string]: number } = {};
  baseKpiList.forEach(item => {
    if (item.slaStatus === "ເກີນກຳນົດ" && item.trackingStatus !== "ປິດງານແລ້ວ") {
      const b = item["ສາຂາ "] || "Unknown";
      overdueBranchCounts[b] = (overdueBranchCounts[b] || 0) + 1;
    }
  });
  const overdueChartData = Object.keys(overdueBranchCounts).map(bName => ({
    branch: bName.replace(/^\d+\.\s*(ສາຂາ\s*)?/, ''),
    'ເກີນກຳນົດ': overdueBranchCounts[bName]
  })).slice(0, 10);

  // --- Chart 4: Progress by Vendor
  const vendorProgress: { [key: string]: { total: number; sumProgress: number } } = {};
  baseKpiList.forEach(item => {
    const v = item.vendor || "ບໍ່ລະບຸ";
    if (!vendorProgress[v]) {
      vendorProgress[v] = { total: 0, sumProgress: 0 };
    }
    vendorProgress[v].total++;
    vendorProgress[v].sumProgress += item.progressPercent || 0;
  });
  const vendorChartData = Object.keys(vendorProgress).map(vName => ({
    vendor: vName,
    'ເປີເຊັນສະເລ່ຍ': Math.round(vendorProgress[vName].sumProgress / vendorProgress[vName].total),
    'ຈຳນວນວຽກ': vendorProgress[vName].total
  })).slice(0, 10);

  // --- Chart 5: Monthly Completed Repairs
  const monthlyCompleted: { [key: string]: number } = {};
  
  // From active completed
  baseKpiList.forEach(item => {
    if (item.trackingStatus === "ສ້ອມສຳເລັດ") {
      let mKey = "ບໍ່ລະບຸເດືອນ";
      if (item.actualFinishDate) {
        const dObj = parseDateSafe(item.actualFinishDate);
        mKey = `ເດືອນ ${dObj.getMonth() + 1}/${dObj.getFullYear()}`;
      }
      monthlyCompleted[mKey] = (monthlyCompleted[mKey] || 0) + 1;
    }
  });

  // From closed logs
  baseRepairs.forEach(item => {
    let mKey = "ບໍ່ລະບຸເດືອນ";
    if (item.ວັນທີ່ສຳເລັດ || item.ວັນທີ່ສ້ອມແປງ) {
      const dateStr = String(item.ວັນທີ່ສຳເລັດ || item.ວັນທີ່ສ້ອມແປງ);
      const dObj = parseDateSafe(dateStr);
      mKey = `ເດືອນ ${dObj.getMonth() + 1}/${dObj.getFullYear()}`;
    } else if (item.ເດືອນ && item.ປີ) {
      mKey = `ເດືອນ ${item.ເດືອນ}/${item.ປີ}`;
    }
    monthlyCompleted[mKey] = (monthlyCompleted[mKey] || 0) + 1;
  });

  const monthlyChartData = Object.keys(monthlyCompleted).map(mKey => ({
    month: mKey,
    'ສຳເລັດ': monthlyCompleted[mKey]
  }));

  // Helper for SLA Colors
  const getSlaBadgeColor = (sla: string) => {
    switch (sla) {
      case "ເກີນກຳນົດ":
        return "bg-red-100 text-red-800 border-red-200";
      case "ໃກ້ເກີນກຳນົດ":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "ສຳເລັດແລ້ວ":
        return "bg-emerald-100 text-emerald-850 border-emerald-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  // Helper for Tracking Status display colors
  const getTrackingBadgeColor = (status: string) => {
    switch (status) {
      case "ລໍຖ້າເລີ່ມສ້ອມ":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "ກຳລັງດຳເນີນການ":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "ລໍຖ້າອະໄຫຼ່":
      case "ລໍຖ້າ Vendor":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "ຢຸດຊົ່ວຄາວ":
        return "bg-red-50 text-red-700 border-red-100";
      case "ສ້ອມສຳເລັດ":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "ປິດງານແລ້ວ":
        return "bg-purple-100 text-purple-800 border-purple-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  // Helper for photo upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "during" | "after") => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Str = event.target?.result as string;
        if (type === "during") {
          setInputDuringPhoto(base64Str);
        } else {
          setInputAfterPhoto(base64Str);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // SLA Calculation Helper
  const getSLADays = (impact: string) => {
    if (impact === "ສູງ") return 3;
    if (impact === "ປານກາງ") return 7;
    return 15; // "ຕ່ຳ" or others
  };

  // Export to Excel function
  const handleExportToExcel = () => {
    if (filteredList.length === 0) return;

    const exportData = filteredList.map((item, idx) => {
      return {
        "ລ/ດ (No.)": idx + 1,
        "ລະຫັດ PID (PID)": item.PID,
        "ລະຫັດກວດກາ (Inspection Ref)": item.ລະຫັດກວດກາ,
        "ສາຂາ (Branch)": item["ສາຂາ "] || '',
        "ຝ່າຍ/ໜ່ວຍບໍລິການ (Division/Unit)": item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '',
        "ຂະແໜງ (Sector)": item.ຂະແໜງ || '',
        "ຮູບແບບການກວດ (Inspection Type)": item.ຮູບແບບການກວດ || '',
        "ລະບົບທີ່ກວດ (System Category)": item.ລະບົບທີ່ກວດ || '',
        "ພື້ນທີ່/ຈຸດກວດ ( Area / Point)": item.ໝວດລະບົບກວດ || '',
        "ລະຫັດຊັບສິນ (Asset Code)": item.ລະຫັດຊັບສິນ || 'none',
        "ລາຍການຊັບສິນ (Asset Name)": item.ລາຍການ || '',
        "ພາກສ່ວນຊັບສົມບັດ (Asset Category)": item.ພາກສ່ວນຊັບສົມບັດ || '',
        "ໝວດລາຍການ (Asset Group)": item.ໝວດລາຍການ || '',
        "ສາຂາຂອງຊັບສິນ (Asset Branch)": item.ສາຂາຊັບສິນ || 'none',
        "ຝ່າຍ/ໜ່ວຍບໍລິການຊັບສິນ (Asset Division/Unit)": item.ຝ່າຍຊັບສິນ || 'none',
        "ຂະແໜງຊັບສິນ (Asset Sector)": item.ຂະແໜງຊັບສິນ || 'none',
        "ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)": item.ລາຍລະອຽດປັນຫາທີ່ພົບ || '',
        "ປະເມີນຜົນກະທົບ (Impact Level)": item.ປະເມີນຜົນກະທົບ || '',
        "ວີທີແກ້ໄຂສະເໜີ (Proposed Solution)": item.ວີທີແກ້ໄຂ || '',
        "ວັນທີ່ກວດ (Detected Date)": formatExcelDate(item.ວັນທີ່ກວດ),
        "ເວລາກວດ (Detected Time)": item.ເວລາກວດ || '',
        "ຜູ້ກວດກາ (Reporter)": item.ຊື່ຜູ້ກວດ || item.ຜູ້ກວດກາ || '',
        "ສະຖານະ (Status)": item.ສະຖານະ || '',
        // Additional tracking metadata
        "ວັນທີ່ເລີ່ມສ້ອມ (Start Date)": item.startRepairDate ? item.startRepairDate : '',
        "ວັນທີ່ຄາດວ່າຈະສຳເລັດ (Expected Date)": item.expectedFinishDate ? item.expectedFinishDate : '',
        "ວັນທີ່ສຳເລັດຈິງ (Actual Date)": item.actualFinishDate ? item.actualFinishDate : '',
        "ຄວາມຄືບໜ້າ (Progress)": `${item.progressPercent}%`,
        "ສະຖານະຕິດຕາມ (Tracking Status)": item.trackingStatus || 'ລໍຖ້າເລີ່ມສ້ອມ',
        "ສະຖານະ SLA (SLA Status)": item.slaStatus || 'ຢູ່ໃນກຳນົດ',
        "ຜູ້ຮັບຜິດຊອບ (Owner)": item.owner || '',
        "ຜູ້ສະໜອງ (Vendor)": item.vendor || '',
        "ມູນຄ່າສ້ອມແປງ (Cost LAK)": item.repairCost ? Number(item.repairCost) : 0,
        "ເຫດຜົນລ່າຊ້າ (Delay Reason)": item.delayReason || '',
        "ໝາຍເຫດຄວາມຄືບໜ້າ (Remark)": item.progressRemark || ''
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tracking Repairs");
    XLSX.writeFile(workbook, `ລາຍງານຕິດຕາມການສ້ອມແປງ_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Trigger Modal Workflows
  const openActionModal = (item: RepairTrackingRecord, action: typeof activeModal) => {
    setSelectedItem(item);
    setActiveModal(action);
    
    // Preset default values
    const todayStr = new Date().toISOString().split('T')[0];
    setInputDate(todayStr);
    setInputRemark(item.progressRemark || '');
    setInputDelayReason(item.delayReason || '');
    setInputProgress(item.progressPercent || 0);
    setInputDuringPhoto(item.duringPhoto || '');
    setInputAfterPhoto(item.afterPhoto || '');
    setInputRepairResult(item.repairResult || '');
    setInputTestResult(item.testResult || '');
    setInputCost(item.repairCost ? String(item.repairCost) : '0');

    if (action === "start") {
      const slaDays = getSLADays(item.ປະເມີນຜົນກະທົບ);
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + slaDays);
      setInputExpectedDate(expectedDate.toISOString().split('T')[0]);
    }
  };

  const handleStartSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    onStartRepair(selectedItem.PID, inputDate, inputExpectedDate);
    setActiveModal(null);
    setSelectedItem(null);
  };

  const handleProgressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    onUpdateProgress(selectedItem.PID, inputProgress, inputRemark, inputDuringPhoto, inputDelayReason);
    setActiveModal(null);
    setSelectedItem(null);
  };

  const handleWaitingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    onWaitingStatus(selectedItem.PID, waitingType, inputDelayReason, inputRemark);
    setActiveModal(null);
    setSelectedItem(null);
  };

  const handlePauseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    onPauseRepair(selectedItem.PID, inputDelayReason);
    setActiveModal(null);
    setSelectedItem(null);
  };

  const handleCompleteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const numericCost = Number(inputCost.replace(/[^0-9.-]/g, ""));
    if (isNaN(numericCost) || numericCost < 0) {
      alert("ກະລຸນາປ້ອນມູນຄ່າສ້ອມແປງທີ່ຖືກຕ້ອງ");
      return;
    }
    if (!inputRepairResult.trim()) {
      alert("ກະລຸນາປ້ອນຜົນການສ້ອມແປງ");
      return;
    }
    if (!inputTestResult.trim()) {
      alert("ກະລຸນາປ້ອນຜົນການທົດສອບ");
      return;
    }
    onCompleteRepair(selectedItem.PID, inputDate, inputRepairResult, inputTestResult, numericCost, inputAfterPhoto);
    setActiveModal(null);
    setSelectedItem(null);
  };

  const handleCloseJobSubmit = (pid: string) => {
    const item = trackingListWithSLA.find(it => it.PID === pid);
    if (!item) return;
    if (item.trackingStatus !== "ສ້ອມສຳເລັດ") {
      alert("ຫ້າມປິດງານຈົນກວ່າຈະມີການສ້ອມສຳເລັດ");
      return;
    }
    if (!item.actualFinishDate || !item.repairResult || !item.testResult || item.repairCost === undefined) {
      alert("ກະລຸນາປ້ອນຂໍ້ມູນການສ້ອມແປງໃຫ້ຄົບຖ້ວນກ່ອນປິດງານ");
      return;
    }
    if (window.confirm("ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການບັນທຶກເຂົ້າປະຫວັດສ້ອມແປງ ແລະ ປິດງານນີ້?")) {
      onCloseJob(pid);
    }
  };

  return (
    <div className="space-y-6 select-none" id="repair_tracking_container">
      
      {/* Title & Description */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center">
            <RefreshCw className="h-6 w-6 text-emerald-700 mr-2.5 animate-spin-slow" />
            ຕິດຕາມການສ້ອມແປງ (Repair Tracking Control Room)
          </h2>
          <p className="text-slate-500 text-xs mt-1">
            ໜ້າຈໍຕິດຕາມສະຖານະການສ້ອມແປງຊັບສິນ, ຄວາມຄືບໜ້າ, ການຈັດການ SLA, ຕະຫຼອດຮອດການກວດສອບກ່ອນປິດວຽກ ແລະ ບັນທຶກເຂົ້າປະຫວັດສ້ອມແປງ.
          </p>
        </div>
      </div>

      {/* Real-time Status & Date range selection */}
      <div className="bg-gradient-to-r from-emerald-50/50 to-slate-50 p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left Part: Date range select & custom dates */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
            <Calendar className="h-4 w-4 text-emerald-700" />
            <span>ຊ່ວງເວລາ Dashboard:</span>
          </div>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="py-1.5 px-3 text-xs font-semibold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 shadow-sm"
          >
            <option value="ALL">ທັງໝົດ / All Time</option>
            <option value="TODAY">ມື້ນີ້ / Today</option>
            <option value="LAST_7_DAYS">7 ມື້ຫຼ້າສຸດ / Last 7 Days</option>
            <option value="LAST_30_DAYS">30 ມື້ຫຼ້າສຸດ / Last 30 Days</option>
            <option value="THIS_MONTH">ເດືອນນີ້ / This Month</option>
            <option value="THIS_QUARTER">ໄຕມາດນີ້ / This Quarter</option>
            <option value="THIS_YEAR">ປີນີ້ / This Year</option>
            <option value="CUSTOM">ເລືອກວັນທີເອງ / Custom Dates</option>
          </select>

          {timeRange === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="ຈາກວັນທີ"
              />
              <span className="text-slate-400 text-xs">ຫາ</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="py-1.5 px-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                placeholder="ຫາວັນທີ"
              />
              {(customFromDate || customToDate) && (
                <button
                  onClick={() => { setCustomFromDate(''); setCustomToDate(''); }}
                  className="p-1 rounded-full hover:bg-slate-200 text-slate-400"
                  title="ລ້າງວັນທີ"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Part: Real-time and Auto Refresh indicator */}
        <div className="flex items-center justify-between lg:justify-end gap-4 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200/60">
          {/* Last Refreshed Time */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>ອັບເດດຫຼ້າສຸດ:</span>
            <span className="font-mono font-bold text-slate-700 bg-slate-200/60 px-1.5 py-0.5 rounded text-xs">{lastRefreshedTime}</span>
          </div>

          {/* Auto Refresh Toggle & Trigger */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAutoRefresh(!isAutoRefresh)}
              className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              title={isAutoRefresh ? "ຢຸດການດຶງຂໍ້ມູນອັດຕະໂນມັດ" : "ເປີດການດຶງຂໍ້ມູນອັດຕະໂນມັດ"}
            >
              {isAutoRefresh ? (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] text-emerald-700">Auto-Refresh ({secondsToRefresh}s)</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="text-[11px] text-slate-500">Auto-Refresh OFF</span>
                </span>
              )}
            </button>

            {/* Manual Refresh Button */}
            <button
              onClick={triggerManualRefresh}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/50 hover:border-emerald-200 rounded-xl text-xs font-semibold shadow-sm active:scale-95 transition"
            >
              <RefreshCw className={`h-3 w-3 ${isAutoRefresh ? '' : 'animate-spin'}`} />
              <span>ຣີເຟຣຊ (Refresh)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow transition">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ວຽກອະນຸມັດທັງໝົດ</p>
          <p className="text-2xl font-black text-emerald-800 mt-1">{totalApproved}</p>
        </div>
        
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow transition">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ລໍຖ້າເລີ່ມສ້ອມ</p>
          <p className="text-2xl font-black text-slate-700 mt-1">{kpiWaitingStart}</p>
        </div>

        <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 shadow-sm hover:shadow transition">
          <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">ກຳລັງດຳເນີນການ</p>
          <p className="text-2xl font-black text-blue-700 mt-1">{kpiInProgress}</p>
        </div>

        <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 shadow-sm hover:shadow transition">
          <p className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">ລໍຖ້າອະໄຫຼ່ / ວິນໂດ</p>
          <p className="text-2xl font-black text-orange-700 mt-1">{kpiWaitingParts + kpiWaitingVendor}</p>
        </div>

        <div className="bg-red-50/30 p-4 rounded-2xl border border-red-100 shadow-sm hover:shadow transition">
          <p className="text-[10px] text-red-600 font-bold uppercase tracking-wider">ຢຸດຊົ່ວຄາວ</p>
          <p className="text-2xl font-black text-red-700 mt-1">{kpiPaused}</p>
        </div>

        <div className="bg-red-50/80 p-4 rounded-2xl border border-red-200 shadow-sm hover:shadow transition">
          <p className="text-[10px] text-red-700 font-bold uppercase tracking-wider">ເກີນກຳນົດ SLA</p>
          <p className="text-2xl font-black text-red-600 mt-1">{kpiOverdueSLA}</p>
        </div>

        <div className="bg-emerald-50/40 p-4 rounded-2xl border border-emerald-100 shadow-sm hover:shadow transition col-span-2 md:col-span-1">
          <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">ສ້ອມສຳເລັດ</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{kpiCompleted}</p>
        </div>

        <div className="bg-purple-50/40 p-4 rounded-2xl border border-purple-100 shadow-sm hover:shadow transition col-span-2 md:col-span-1">
          <p className="text-[10px] text-purple-700 font-bold uppercase tracking-wider">ປິດວຽກແລ້ວ</p>
          <p className="text-2xl font-black text-purple-700 mt-1">{kpiClosed}</p>
        </div>

        <div className="bg-rose-50/40 p-4 rounded-2xl border border-rose-100 shadow-sm hover:shadow transition col-span-2 md:col-span-1">
          <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wider">ຍົກເລີກ / Cancelled</p>
          <p className="text-2xl font-black text-rose-700 mt-1">{kpiCancelled}</p>
        </div>

        <div className="bg-amber-50/40 p-4 rounded-2xl border border-amber-100 shadow-sm hover:shadow transition col-span-2 md:col-span-1">
          <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider">On-time Completion</p>
          <p className="text-2xl font-black text-amber-750 mt-1">{onTimeCompletionRate}%</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 shadow-sm hover:shadow transition col-span-2 md:col-span-2">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">ສະເລ່ຍວັນສ້ອມ (ວັນ)</p>
          <p className="text-2xl font-black text-slate-800 mt-1">{avgRepairDays} ວັນ</p>
        </div>
      </div>

      {/* Graphs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Graph 1: Repairs Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center">
            <TrendingUp className="h-4 w-4 mr-2 text-emerald-700" />
            Repair Tracking by Status (ສະຖານະຕິດຕາມ)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={10} tickLine={false} stroke="#94a3b8" />
                <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" name="ຈຳນວນ" radius={[6, 6, 0, 0]}>
                  {statusChartData.map((entry, index) => {
                    const colors: { [key: string]: string } = {
                      "ລໍຖ້າເລີ່ມສ້ອມ": "#64748b",
                      "ກຳລັງດຳເນີນການ": "#3b82f6",
                      "ລໍຖ້າອະໄຫຼ่": "#f97316",
                      "ລໍຖ້າ Vendor": "#ea580c",
                      "ຢຸດຊົ່ວຄາວ": "#ef4444",
                      "ສ້ອມສຳເລັດ": "#10b981",
                      "ປິດງານແລ້ວ": "#8b5cf6",
                      "ຍົກເລີກ / Cancelled": "#f43f5e"
                    };
                    return <Cell key={`cell-${index}`} fill={colors[entry.name] || "#10b981"} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph 2: Tracking by Branch */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center">
            <MapPin className="h-4 w-4 mr-2 text-emerald-700" />
            Repair Tracking by Branch (ຈຳນວນວຽກສ້ອມແປງແຍກຕາມສາຂາ)
          </h3>
          <div className="h-64">
            {branchChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">ບໍ່ມີຂໍ້ມູນສາຂາ</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="branch" fontSize={9} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ກຳລັງດຳເນີນການ" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="ສຳເລັດແລ້ວ" stackId="a" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Graph 3: Overdue SLA by Branch */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2 text-red-600" />
            SLA Overdue by Branch (ວຽກເກີນກຳນົດແຍກຕາມສາຂາ)
          </h3>
          <div className="h-64">
            {overdueChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">ບໍ່ມີວຽກເກີນກຳນົດ SLA</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={overdueChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="branch" fontSize={9} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="ເກີນກຳນົດ" name="ເກີນກຳນົດ (Overdue)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Graph 4: Monthly completed count */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center">
            <CheckCircle className="h-4 w-4 mr-2 text-emerald-700" />
            Monthly Completed Repair (ຈຳນວນວຽກທີ່ສ້ອມແປງສຳເລັດໃນແຕ່ລະເດືອນ)
          </h3>
          <div className="h-64">
            {monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">ບໍ່ມີວຽກສ້ອມແປງທີ່ສຳເລັດໃນລະບົບ</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <Tooltip />
                  <Bar dataKey="ສຳເລັດ" name="ວຽກທີ່ປິດ/ສຳເລັດ" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Graph 5: Progress by Vendor */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm col-span-1 lg:col-span-2">
          <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center">
            <Users className="h-4 w-4 mr-2 text-emerald-700" />
            Progress by Vendor (ເປີເຊັນຄວາມຄືບໜ້າສະເລ່ຍແຍກຕາມ Vendor)
          </h3>
          <div className="h-64">
            {vendorChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">ບໍ່ມີຂໍ້ມູນ Vendor</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={vendorChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="vendor" fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <YAxis fontSize={10} tickLine={false} stroke="#94a3b8" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="ເປີເຊັນສະເລ່ຍ" name="ສະເລ່ຍຄວາມຄືບໜ້າ (%)" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ຈຳນວນວຽກ" name="ຈຳນວນວຽກ (Jobs)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Advanced Timeline / Gantt Chart visualizer of active tracking tasks */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-xs font-bold text-slate-800 mb-4 flex items-center">
          <Calendar className="h-4.5 w-4.5 mr-2 text-emerald-700" />
          Gantt Chart (ຕາຕະລາງແລ່ນວຽກ Start Repair Date ຫາ Expected Finish Date)
        </h3>
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {trackingListWithSLA.filter(item => item.trackingStatus !== "ປິດງານແລ້ວ").length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">ບໍ່ມີວຽກທີ່ກຳລັງຕິດຕາມໃນຕາຕະລາງ Gantt</p>
          ) : (
            trackingListWithSLA.filter(item => item.trackingStatus !== "ປິດງານແລ້ວ").map(item => {
              const startStr = item.startRepairDate || "ລໍຖ້າເລີ່ມ";
              const expStr = item.expectedFinishDate || "ລໍຖ້າກຳນົດ";
              const progress = item.progressPercent || 0;
              const slaStatus = item.slaStatus;
              
              let slaColor = "bg-blue-500";
              if (slaStatus === "ເກີນກຳນົດ") slaColor = "bg-red-500";
              if (slaStatus === "ໃກ້ເກີນກຳນົດ") slaColor = "bg-amber-500";

              return (
                <div key={item.PID} className="border border-slate-100 p-3.5 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                        {item.ລະຫັດກວດກາ}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700 bg-emerald-100/80 text-emerald-900 px-2 py-0.5 rounded">
                        {item.ລາຍການ}
                      </span>
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-medium">
                        {(item["ສາຂາ "] || "").replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium text-slate-500 flex-wrap">
                      <span className="flex items-center"><Play className="h-3.5 w-3.5 text-slate-400 mr-1" /> ເລີ່ມ: {startStr}</span>
                      <span className="flex items-center"><Hourglass className="h-3.5 w-3.5 text-slate-400 mr-1" /> ກຳນົດ: {expStr}</span>
                      <span className="flex items-center font-bold text-slate-700"><Percent className="h-3.5 w-3.5 text-emerald-600 mr-0.5" /> ຄືບໜ້າ: {progress}%</span>
                    </div>
                  </div>
                  
                  {/* Custom horizontal timeline Gantt progress bar */}
                  <div className="w-full md:w-72 flex flex-col justify-center">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1 font-bold font-mono">
                      <span>{startStr}</span>
                      <span>{progress}%</span>
                      <span>{expStr}</span>
                    </div>
                    <div className="w-full bg-slate-200 h-3.5 rounded-full overflow-hidden relative">
                      <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${progress}%` }} />
                      {/* Expected SLA Deadline dot/line */}
                      <div className={`absolute top-0 bottom-0 right-0 w-1.5 ${slaColor}`} title={`Deadline: ${expStr}`} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Filter and Table Control Area */}
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        
        {/* Filter Layout */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="h-4.5 w-4.5 text-emerald-700" />
            <h3 className="font-black text-xs text-slate-800 tracking-tight">ຄັດກອງຂໍ້ມູນ (Tracking Filter Control)</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-mono text-[10px]">ຄົ້ນພົບ {filteredList.length} ລາຍການ</span>
            <button
              onClick={handleExportToExcel}
              disabled={filteredList.length === 0}
              title="ດາວໂຫລດຂໍ້ມູນເປັນ Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              <span>ດາວໂຫລດ Excel</span>
            </button>
          </div>
        </div>

        {/* Input filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Text search */}
          <div className="col-span-1 sm:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ຄົ້ນຫາ ລະຫັດ, ຊັບສິນ, Vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-slate-50"
            />
          </div>

          {/* Branch filter (Admins only) */}
          <div>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={!isAdmin}
              className="py-2 px-3 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">ທຸກສາຂາ</option>
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* System Category Filter */}
          <div>
            <select
              value={systemFilter}
              onChange={(e) => setSystemFilter(e.target.value)}
              className="py-2 px-3 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">ທຸກລະບົບທີ່ກວດ</option>
              {systems.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Impact Level filter */}
          <div>
            <select
              value={impactFilter}
              onChange={(e) => setImpactFilter(e.target.value)}
              className="py-2 px-3 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">ທຸກຜົນກະທົບ</option>
              <option value="ສູງ">ສູງ (High)</option>
              <option value="ປານກາງ">ປານກາງ (Medium)</option>
              <option value="ຕ່ຳ">ຕ່ຳ (Low)</option>
            </select>
          </div>

          {/* Tracking Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">ທຸກສະຖານະ</option>
              <option value="ລໍຖ້າເລີ່ມສ້ອມ">ລໍຖ້າເລີ່ມສ້ອມ</option>
              <option value="ກຳລັງດຳເນີນການ">ກຳລັງດຳເນີນການ</option>
              <option value="ລໍຖ້າອະໄຫຼ່">ລໍຖ້າອະໄຫຼ່</option>
              <option value="ລໍຖ້າ Vendor">ລໍຖ້າ Vendor</option>
              <option value="ຢຸດຊົ່ວຄາວ">ຢຸດຊົ່ວຄາວ</option>
              <option value="ສ້ອມສຳເລັດ">ສ້ອມສຳເລັດ</option>
            </select>
          </div>

          {/* SLA Status Filter */}
          <div>
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="py-2 px-3 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">ທຸກສະຖານະ SLA</option>
              <option value="ເກີນກຳນົດ">ເກີນກຳນົດ (Overdue)</option>
              <option value="ໃກ້ເກີນກຳນົດ">ໃກ້ເກີນກຳນົດ</option>
              <option value="ຢູ່ໃນກຳນົດ">ຢູ່ໃນກຳນົດ</option>
              <option value="ສຳເລັດແລ້ວ">ສຳເລັດແລ້ວ</option>
            </select>
          </div>

          {/* Vendor Filter */}
          <div>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="py-2 px-3 w-full text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="ALL">ທຸກໆ Vendor</option>
              {vendors.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table View of Tracking Records */}
        <div className="overflow-x-auto border border-slate-100 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-55 border-b border-slate-100 text-slate-500 font-bold select-none">
                <th className="p-3 text-[10px] uppercase font-bold text-slate-400 font-mono">ລາຍລະອຽດ/ລະຫັດ</th>
                <th className="p-3">ສາຂາ / ຝ່າຍ</th>
                <th className="p-3">ຊັບສິນ</th>
                <th className="p-3">ຜົນກະທົບ</th>
                <th className="p-3">SLA ທີ່ຕ້ອງສຳເລັດ</th>
                <th className="p-3">ຄວາມຄືບໜ້າ</th>
                <th className="p-3">ສະຖານະຕິດຕາມ</th>
                <th className="p-3">SLA Status</th>
                <th className="p-3 text-right">ຈັດການ / Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 text-xs">
                    ບໍ່ມີລາຍການຕິດຕາມການສ້ອມແປງທີ່ກົງກັບເງື່ອນໄຂຄັດກອງ
                  </td>
                </tr>
              ) : (
                filteredList.map(item => {
                  const isClosed = item.trackingStatus === "ປິດງານແລ້ວ";
                  const isCompleted = item.trackingStatus === "ສ້ອມສຳເລັດ";
                  const isPaused = item.trackingStatus === "ຢຸດຊົ່ວຄາວ";
                  const isWaitingStart = item.trackingStatus === "ລໍຖ້າເລີ່ມສ້ອມ";

                  return (
                    <tr key={item.PID} className="hover:bg-slate-50/50 transition">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{item.ລະຫັດກວດກາ}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.PID}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-700">{(item["ສາຂາ "] || "").replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}</div>
                        <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">{item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{item.ລາຍການ}</div>
                        <div className="text-[10px] text-slate-400 font-medium">ລະຫັດ: {item.ລະຫັດຊັບສິນ || "ບໍ່ມີ"}</div>
                        <div className="text-[10px] text-indigo-600 mt-1 font-bold">
                          {item.ລະບົບທີ່ກວດ || "—"} / {item.ໝວດລະບົບກວດ || "—"}
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.ປະເມີນຜົນກະທົບ === 'ສູງ' 
                            ? 'bg-red-100 text-red-700' 
                            : item.ປະເມີນຜົນກະທົບ === 'ປານກາງ' 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.ປະເມີນຜົນກະທົບ}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600 font-medium">
                        {item.expectedFinishDate ? item.expectedFinishDate : "ລໍຖ້າເລີ່ມສ້ອມ"}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 bg-slate-150 h-2 rounded-full overflow-hidden shrink-0">
                            <div className="bg-emerald-500 h-full transition-all" style={{ width: `${item.progressPercent}%` }} />
                          </div>
                          <span className="font-bold font-mono text-[10px] text-slate-700">{item.progressPercent}%</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block border px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getTrackingBadgeColor(item.trackingStatus)}`}>
                          {item.trackingStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block border px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getSlaBadgeColor(item.slaStatus)}`}>
                          {item.slaStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* View Action */}
                          <button
                            onClick={() => openActionModal(item, "view")}
                            title="ເບິ່ງລາຍລະອຽດ"
                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition cursor-pointer"
                          >
                            <Eye className="h-4.5 w-4.5" />
                          </button>

                          {/* 1. Start Repair Button */}
                          {isWaitingStart && (
                            <button
                              onClick={() => openActionModal(item, "start")}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-1 px-2.5 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <Play className="h-3 w-3 mr-1 shrink-0" />
                              ເລີ່ມສ້ອມ
                            </button>
                          )}

                          {/* 2. Update Progress Button */}
                          {!isClosed && !isCompleted && !isWaitingStart && (
                            <button
                              onClick={() => openActionModal(item, "progress")}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3 mr-1 shrink-0" />
                              ອັບເດດຄືບໜ້າ
                            </button>
                          )}

                          {/* 3. Waiting Parts/Vendor Button */}
                          {!isClosed && !isCompleted && !isWaitingStart && (
                            <button
                              onClick={() => {
                                setWaitingType("ລໍຖ້າອະໄຫຼ່");
                                openActionModal(item, "waiting");
                              }}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-1 px-2 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <Hourglass className="h-3 w-3 mr-1 shrink-0" />
                              ລໍຖ້າ
                            </button>
                          )}

                          {/* 4. Pause Button */}
                          {!isClosed && !isCompleted && !isWaitingStart && !isPaused && (
                            <button
                              onClick={() => openActionModal(item, "pause")}
                              className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-2 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <Ban className="h-3 w-3 mr-1 shrink-0" />
                              ຢຸດຊົ່ວຄາວ
                            </button>
                          )}

                          {/* 5. Complete Repair Button */}
                          {!isClosed && !isCompleted && !isWaitingStart && (
                            <button
                              onClick={() => openActionModal(item, "complete")}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <CheckCircle className="h-3 w-3 mr-1 shrink-0" />
                              ສ້ອມສຳເລັດ
                            </button>
                          )}

                          {/* 5.5 Resume Repair Button */}
                          {(isPaused || item.trackingStatus === "ລໍຖ້າອະໄຫຼ່" || item.trackingStatus === "ລໍຖ້າ Vendor") && onResumeRepair && (
                            <button
                              onClick={() => onResumeRepair(item.PID)}
                              className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-1 px-2.5 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <Play className="h-3 w-3 mr-1 shrink-0" />
                              ເລີ່ມສ້ອມຕໍ່
                            </button>
                          )}

                          {/* 6. Close Job Button */}
                          {isCompleted && (
                            <button
                              onClick={() => openActionModal(item, "close_confirm")}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-2.5 rounded text-[10px] flex items-center shadow-sm cursor-pointer"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1 shrink-0" />
                              ປິດງານ (Close Job)
                            </button>
                          )}
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

      {/* ACTION DIALOG MODALS */}
      {activeModal && selectedItem && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-55 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-800 flex items-center">
                {activeModal === "start" && "ເລີ່ມສ້ອມແປງຊັບສິນ (Start Repair)"}
                {activeModal === "progress" && "ອັບເດດຄວາມຄືບໜ້າ (Update Progress)"}
                {activeModal === "waiting" && "ຕັ້ງສະຖານະລໍຖ້າອະໄຫຼ່ / Vendor (Pending Parts/Contractor)"}
                {activeModal === "pause" && "ຢຸດສ້ອມແປງຊົ່ວຄາວ (Pause Repair)"}
                {activeModal === "complete" && "ສ້ອມແປງສຳເລັດ (Repair Completed)"}
                {activeModal === "view" && "ລາຍລະອຽດການຕິດຕາມ (Tracking Details Preview)"}
                {activeModal === "close_confirm" && "ຢືນຢັນປິດງານ (Confirm Close Job)"}
              </h3>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setSelectedItem(null);
                }}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Record Bio */}
            <div className="bg-slate-50 p-3.5 rounded-xl text-[11px] text-slate-600 space-y-1 border border-slate-150">
              <div className="flex justify-between font-medium">
                <span>ລະຫັດກວດກາ (Ref ID):</span>
                <span className="font-mono font-bold text-slate-900">{selectedItem.ລະຫັດກວດກາ}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>ຊັບສິນ (Asset Name):</span>
                <span className="font-bold text-slate-900">{selectedItem.ລາຍການ}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>ລະຫັດຊັບສິນ (Asset Code):</span>
                <span className="font-mono text-slate-700">{selectedItem.ລະຫັດຊັບສິນ || "ບໍ່ລະບຸ"}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>ຜົນກະທົບ (Impact Level):</span>
                <span className="font-bold text-red-650">{selectedItem.ປະເມີນຜົນກະທົບ}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Vendor:</span>
                <span className="font-bold text-slate-700">{selectedItem.vendor || "ບໍ່ລະບຸ"}</span>
              </div>
            </div>

            {/* Modal Specific Fields Form */}
            
            {/* 1. START REPAIR FORM */}
            {activeModal === "start" && (
              <form onSubmit={handleStartSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ວັນທີ່ເລີ່ມສ້ອມ (Start Date)</label>
                  <input
                    type="date"
                    value={inputDate}
                    onChange={(e) => {
                      setInputDate(e.target.value);
                      // Recalculate Expected Date when start date changes
                      const baseDate = parseDateSafe(e.target.value);
                      const slaDays = getSLADays(selectedItem.ປະເມີນຜົນກະທົບ);
                      baseDate.setDate(baseDate.getDate() + slaDays);
                      setInputExpectedDate(formatDateSafe(baseDate));
                    }}
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ວັນທີ່ຄາດວ່າຈະສຳເລັດ (Expected Finish Date based on SLA)</label>
                  <input
                    type="date"
                    value={inputExpectedDate}
                    onChange={(e) => setInputExpectedDate(e.target.value)}
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                  <p className="text-[10px] text-amber-600 font-medium">
                    SLA ຕາມລະດັບຜົນກະທົບ {selectedItem.ປະເມີນຜົນກະທົບ} ແມ່ນ {getSLADays(selectedItem.ປະເມີນຜົນກະທົບ)} ວັນ.
                  </p>
                </div>
                <button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  ບັນທຶກ ແລະ ເລີ່ມສ້ອມແປງ
                </button>
              </form>
            )}

            {/* 2. UPDATE PROGRESS FORM */}
            {activeModal === "progress" && (
              <form onSubmit={handleProgressSubmit} className="space-y-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>ເປີເຊັນຄວາມຄືບໜ້າ (Progress %)</span>
                    <span className="text-emerald-700 font-mono">{inputProgress}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="99"
                    value={inputProgress}
                    onChange={(e) => setInputProgress(Number(e.target.value))}
                    className="w-full accent-emerald-700"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ໝາຍເຫດຄວາມຄືບໜ້າ (Progress Remark)</label>
                  <textarea
                    rows={2}
                    value={inputRemark}
                    onChange={(e) => setInputRemark(e.target.value)}
                    placeholder="ຂຽນໝາຍເຫດຄວາມຄືບໜ້າການເຮັດວຽກ..."
                    required
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                {/* Delay Reason (optional unless delayed) */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ເຫດຜົນລ່າຊ້າ (Delay Reason - ຖ້າມີ)</label>
                  <input
                    type="text"
                    value={inputDelayReason}
                    onChange={(e) => setInputDelayReason(e.target.value)}
                    placeholder="ເຫດຜົນທີ່ເຮັດໃຫ້ວຽກລ່າຊ້າກວ່າ SLA..."
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                {/* During Photo attachment */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ຮູບພາບລະຫວ່າງສ້ອມແປງ (During Photo)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-600 gap-2 shrink-0">
                      <Camera className="h-4.5 w-4.5 text-slate-500" />
                      ແນບຮູບ
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, "during")}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      {inputDuringPhoto ? (
                        <div className="flex items-center space-x-2">
                          <img src={inputDuringPhoto} alt="During preview" className="h-10 w-10 object-cover rounded border border-slate-200 shrink-0" />
                          <span className="text-[10px] text-emerald-600 font-bold truncate">ແນບຮູບພາບສຳເລັດ</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">ຍັງບໍ່ມີການແນບຮູບພາບ</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  ບັນທຶກອັບເດດຄວາມຄືບໜ້າ
                </button>
              </form>
            )}

            {/* 3. WAITING PARTS/VENDOR FORM */}
            {activeModal === "waiting" && (
              <form onSubmit={handleWaitingSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ເລືອກສະຖານະລໍຖ້າ</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setWaitingType("ລໍຖ້າອະໄຫຼ່")}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                        waitingType === "ລໍຖ້າອະໄຫຼ່" 
                          ? "bg-amber-100 border-amber-400 text-amber-900" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      ລໍຖ້າອະໄຫຼ່ (Pending Parts)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaitingType("ລໍຖ້າ Vendor")}
                      className={`py-2 px-3 text-xs font-bold rounded-xl border text-center transition cursor-pointer ${
                        waitingType === "ລໍຖ້າ Vendor" 
                          ? "bg-orange-100 border-orange-400 text-orange-900" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      ລໍຖ້າ Vendor (Pending Vendor)
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ເຫດຜົນລ່າຊ້າ (Delay Reason / Details)</label>
                  <textarea
                    rows={2}
                    value={inputDelayReason}
                    onChange={(e) => setInputDelayReason(e.target.value)}
                    placeholder="ລະບຸເຫດຜົນ, ລາຍການອະໄຫຼ່ທີ່ລໍຖ້າ ຫຼື ລາຍລະອຽດການລໍຖ້າ Vendor..."
                    required
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ໝາຍເຫດຄວາມຄືບໜ້າ (Progress Remark)</label>
                  <input
                    type="text"
                    value={inputRemark}
                    onChange={(e) => setInputRemark(e.target.value)}
                    placeholder="ໝາຍເຫດເພີ່ມເຕີມ..."
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  ປ່ຽນສະຖານະເປັນ: {waitingType}
                </button>
              </form>
            )}

            {/* 4. PAUSE FORM */}
            {activeModal === "pause" && (
              <form onSubmit={handlePauseSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ເຫດຜົນທີ່ຢຸດສ້ອມແປງຊົ່ວຄາວ (Reason for Pause)</label>
                  <textarea
                    rows={3}
                    value={inputDelayReason}
                    onChange={(e) => setInputDelayReason(e.target.value)}
                    placeholder="ກະລຸນາລະບຸເຫດຜົນທີ່ມີການຢຸດວຽກສ້ອມແປງນີ້ຊົ່ວຄາວ..."
                    required
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  ຢຸດວຽກຊົ່ວຄາວ (Pause Work)
                </button>
              </form>
            )}

            {/* 5. COMPLETE REPAIR FORM */}
            {activeModal === "complete" && (
              <form onSubmit={handleCompleteSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ວັນທີ່ສຳເລັດຈິງ (Actual Finish Date)</label>
                  <input
                    type="date"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ຜົນການສ້ອມແປງ / ແກ້ໄຂ (Repair Result)</label>
                  <textarea
                    rows={2}
                    value={inputRepairResult}
                    onChange={(e) => setInputRepairResult(e.target.value)}
                    placeholder="ອະທິບາຍຜົນການສ້ອມແປງເຊັ່ນ: ປ່ຽນອະໄຫຼ່ໃໝ່, ແກ້ໄຂວົງຈອນສຳເລັດ, etc..."
                    required
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ຜົນການທົດສອບ (Test Result Details)</label>
                  <input
                    type="text"
                    value={inputTestResult}
                    onChange={(e) => setInputTestResult(e.target.value)}
                    placeholder="ຜົນທົດສອບເຊັ່ນ: ທົດສອບການເປີດ-ປິດ ໃຊ້ງານໄດ້ປົກກະຕິ..."
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ມູນຄ່າສ້ອມແປງ (Repair Cost - LAK)</label>
                  <input
                    type="text"
                    value={inputCost}
                    onChange={(e) => setInputCost(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full text-xs py-2 px-3 border border-slate-200 rounded-xl focus:ring-emerald-500 focus:ring-2 font-mono font-bold"
                  />
                </div>

                {/* After Photo attachment */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">ຮູບພາບຫຼັງສ້ອມແປງ (After Photo)</label>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center justify-center border border-dashed border-slate-300 rounded-xl px-4 py-2 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-600 gap-2 shrink-0">
                      <Camera className="h-4.5 w-4.5 text-slate-500" />
                      ແນບຮູບ
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleImageFileChange(e, "after")}
                      />
                    </label>
                    <div className="min-w-0 flex-1">
                      {inputAfterPhoto ? (
                        <div className="flex items-center space-x-2">
                          <img src={inputAfterPhoto} alt="After preview" className="h-10 w-10 object-cover rounded border border-slate-200 shrink-0" />
                          <span className="text-[10px] text-emerald-600 font-bold truncate">ແນບຮູບພາບສຳເລັດ</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400">ຍັງບໍ່ມີການແນບຮູບພາບ</span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 rounded-xl text-xs shadow-sm cursor-pointer"
                >
                  ບັນທຶກ: ສ້ອມແປງສຳເລັດ
                </button>
              </form>
            )}

            {/* 6. PREVIEW / VIEW DETAILS MODAL */}
            {activeModal === "view" && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
                
                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ວັນທີກວດພົບ (Detected)</span>
                    <span className="font-bold text-slate-800">{selectedItem.ວັນທີ່ກວດ} - {selectedItem.ເວລາກວດ}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ວັນທີ່ອະນຸມັດ (Approval)</span>
                    <span className="font-bold text-slate-800">{selectedItem.ວັນທີ່ອະນຸມັດ || "ບໍ່ລະບຸ"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ລະບົບທີ່ກວດ / ພື້ນທີ່/ຈຸດກວດ</span>
                    <span className="font-bold text-slate-800">{selectedItem.ລະບົບທີ່ກວດ} / {selectedItem.ໝວດລະບົບກວດ}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">ຮູບແບບການກວດ (Inspection)</span>
                    <span className="font-bold text-slate-800">{selectedItem.ຮູບແບບການກວດ || "ບໍ່ລະບຸ"}</span>
                  </div>
                </div>

                <div className="border-b border-slate-100 pb-3">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">ລາຍລະອຽດປັນຫາທີ່ພົບ (Issue Details)</span>
                  <p className="font-bold text-slate-800 mt-0.5 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {selectedItem.ລາຍລະອຽດປັນຫາທີ່ພົບ || "ບໍ່ມີ"}
                  </p>
                </div>

                <div className="border-b border-slate-100 pb-3">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">ວິທີແກ້ໄຂສະເໜີ (Proposed Solution)</span>
                  <p className="font-bold text-slate-800 mt-0.5 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {selectedItem.ວີທີແກ້ໄຂ || "ບໍ່ມີ"}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 border-b border-slate-100 pb-3 font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">ວັນເລີ່ມສ້ອມແປງ (Start)</span>
                    <span className="font-bold text-slate-800">{selectedItem.startRepairDate || "ຍັງບໍ່ທັນເລີ່ມ"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-bold font-sans">ວັນຄາດວ່າສຳເລັດ (Expected Finish)</span>
                    <span className="font-bold text-slate-800">{selectedItem.expectedFinishDate || "ຍັງບໍ່ທັນເລີ່ມ"}</span>
                  </div>
                </div>

                {selectedItem.trackingStatus === "ຢຸດຊົ່ວຄາວ" && selectedItem.delayReason && (
                  <div className="bg-red-50 p-3 rounded-xl border border-red-150 text-red-850">
                    <span className="font-bold text-[10px] uppercase block">ເຫດຜົນທີ່ຢຸດສ້ອມແປງ (Pause Reason):</span>
                    <p className="font-bold mt-1">{selectedItem.delayReason}</p>
                  </div>
                )}

                {(selectedItem.trackingStatus === "ລໍຖ້າອະໄຫຼ່" || selectedItem.trackingStatus === "ລໍຖ້າ Vendor") && selectedItem.delayReason && (
                  <div className="bg-amber-50 p-3 rounded-xl border border-amber-150 text-amber-850">
                    <span className="font-bold text-[10px] uppercase block">ເຫດຜົນການລໍຖ້າ (Pending Details):</span>
                    <p className="font-bold mt-1">{selectedItem.delayReason}</p>
                  </div>
                )}

                {selectedItem.progressRemark && (
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                    <span className="font-bold text-slate-500 text-[10px] uppercase block">ໝາຍເຫດຄວາມຄືບໜ້າ (Progress Remark):</span>
                    <p className="font-bold text-slate-700 mt-1">{selectedItem.progressRemark}</p>
                  </div>
                )}

                {/* COMPLETED RECORDS VIEW */}
                {(selectedItem.trackingStatus === "ສ້ອມສຳເລັດ" || selectedItem.trackingStatus === "ປິດງານແລ້ວ") && (
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">ວັນທີ່ສຳເລັດຈິງ</span>
                        <span className="font-mono font-bold text-emerald-800">{selectedItem.actualFinishDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9px] uppercase font-bold">ມູນຄ່າສ້ອມແປງ</span>
                        <span className="font-mono font-bold text-emerald-800">{formatLAK(selectedItem.repairCost || 0)}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">ຜົນການສ້ອມແປງ (Repair Result)</span>
                      <p className="font-bold text-slate-800 leading-relaxed">{selectedItem.repairResult}</p>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold">ຜົນການທົດສອບ (Test Details)</span>
                      <p className="font-bold text-slate-800 leading-relaxed">{selectedItem.testResult}</p>
                    </div>
                  </div>
                )}

                {/* Photos previews Grid */}
                <div className="grid grid-cols-2 gap-3 pt-3">
                  {selectedItem.beforePhoto && (
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">ຮູບກ່ອນສ້ອມ (Before)</span>
                      <img src={selectedItem.beforePhoto} alt="Before" className="h-28 w-full object-cover rounded-xl border border-slate-200" />
                    </div>
                  )}
                  {selectedItem.duringPhoto && (
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">ຮູບລະຫວ່າງສ້ອມ (During)</span>
                      <img src={selectedItem.duringPhoto} alt="During" className="h-28 w-full object-cover rounded-xl border border-slate-200" />
                    </div>
                  )}
                  {selectedItem.afterPhoto && (
                    <div className="space-y-1 col-span-2">
                      <span className="text-slate-400 text-[10px] font-bold uppercase block">ຮູບຫຼັງສ້ອມສຳເລັດ (After)</span>
                      <img src={selectedItem.afterPhoto} alt="After" className="h-44 w-full object-cover rounded-xl border border-slate-200" />
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* 6. CLOSE JOB CONFIRMATION & VERIFICATION FORM */}
            {activeModal === "close_confirm" && (
              <div className="space-y-4">
                {(() => {
                  const hasDate = !!selectedItem.actualFinishDate;
                  const hasRepairResult = !!selectedItem.repairResult && selectedItem.repairResult.trim() !== "";
                  const hasTestResult = !!selectedItem.testResult && selectedItem.testResult.trim() !== "";
                  const hasCost = selectedItem.repairCost !== undefined && selectedItem.repairCost !== null && !isNaN(selectedItem.repairCost);
                  
                  const isMissing = !hasDate || !hasRepairResult || !hasTestResult || !hasCost;

                  if (isMissing) {
                    return (
                      <div className="space-y-4">
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-red-800">
                          <div className="flex items-center gap-2 font-black text-xs uppercase text-red-700">
                            <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                            <span>ຍັງບໍ່ມີຂໍ້ມູນການສ້ອມແປງຄົບຖ້ວນ (Missing Required Info)</span>
                          </div>
                          <p className="text-xs font-semibold">
                            ກະລຸນາປ້ອນຂໍ້ມູນການສ້ອມແປງໃຫ້ຄົບຖ້ວນກ່ອນປິດງານ:
                          </p>
                          <ul className="space-y-1 text-xs pt-1">
                            <li className="flex items-center gap-1.5 font-bold">
                              <span>{hasDate ? "✅" : "❌"}</span>
                              <span className={hasDate ? "text-emerald-700 line-through" : "text-red-700"}>ວັນທີ່ສຳເລັດຈິງ (Actual Finish Date)</span>
                            </li>
                            <li className="flex items-center gap-1.5 font-bold">
                              <span>{hasRepairResult ? "✅" : "❌"}</span>
                              <span className={hasRepairResult ? "text-emerald-700 line-through" : "text-red-700"}>ຜົນການສ້ອມແປງ (Repair Result)</span>
                            </li>
                            <li className="flex items-center gap-1.5 font-bold">
                              <span>{hasTestResult ? "✅" : "❌"}</span>
                              <span className={hasTestResult ? "text-emerald-700 line-through" : "text-red-700"}>ຜົນການທົດສອບ (Test Result)</span>
                            </li>
                            <li className="flex items-center gap-1.5 font-bold">
                              <span>{hasCost ? "✅" : "❌"}</span>
                              <span className={hasCost ? "text-emerald-700 line-through" : "text-red-700"}>ມູນຄ່າສ້ອມແປງ (Repair Cost)</span>
                            </li>
                          </ul>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModal("complete");
                          }}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <RefreshCw className="h-4 w-4" />
                          ກົດປ້ອນຂໍ້ມູນການສ້ອມແປງ (Enter Repair Details)
                        </button>
                      </div>
                    );
                  }

                  // All information is complete, show close job confirmation
                  return (
                    <div className="space-y-4">
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-emerald-800">
                        <div className="flex items-center gap-2 font-black text-xs uppercase text-emerald-700">
                          <CheckCircle className="h-4.5 w-4.5 shrink-0" />
                          <span>ຂໍ້ມູນການສ້ອມແປງຄົບຖ້ວນແລ້ວ (Ready to Close)</span>
                        </div>
                        <p className="text-xs font-semibold">
                          ຂໍ້ມູນຄົບຖ້ວນ ແລະ ພ້ອມສຳລັບການປິດງານ.
                        </p>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-500">ວັນທີ່ສຳເລັດຈິງ:</span>
                          <span className="font-bold font-mono text-slate-800">{selectedItem.actualFinishDate}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-500">ມູນຄ່າສ້ອມແປງ:</span>
                          <span className="font-bold text-slate-800 font-mono">{formatLAK(selectedItem.repairCost || 0)} LAK</span>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-medium">ຜົນການສ້ອມແປງ:</span>
                          <p className="font-bold text-slate-800 bg-white p-2 rounded border border-slate-150 leading-relaxed">{selectedItem.repairResult}</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-slate-500 font-medium">ຜົນການທົດສອບ:</span>
                          <p className="font-bold text-slate-800 bg-white p-2 rounded border border-slate-150 leading-relaxed">{selectedItem.testResult}</p>
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModal(null);
                            setSelectedItem(null);
                          }}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs cursor-pointer border border-slate-200"
                        >
                          ຍົກເລີກ (Cancel)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onCloseJob(selectedItem.PID);
                            setActiveModal(null);
                            setSelectedItem(null);
                          }}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 rounded-xl text-xs shadow-md cursor-pointer"
                        >
                          ຢືນຢັນປິດງານ (Confirm Close)
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
