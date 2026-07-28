/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, CartesianGrid
} from 'recharts';
import { 
  Building2, AlertTriangle, Hammer, PieChart as ChartIcon, CheckCircle, X, Clock,
  AlertCircle, User, Check, RefreshCw, Shield, Activity, Filter, Award
} from 'lucide-react';
import { InspectionRecord, IncidentRecord, RepairAssessmentRecord, RepairApprovalRecord, RepairLogRecord, RepairTrackingRecord, UserAccount, BranchInfo, PMAsset, PMHistoryRecord } from '../types';
import { formatExcelDate, cleanString, parseDateSafe } from '../dataStore';
import { buildDashboardMetrics, getDashboardRecordBranch, getDashboardRecordDate } from '../dashboardMetrics';
import DashboardOverview from './dashboard/DashboardOverview';
import BranchIntelligence from './dashboard/BranchIntelligence';
import RecentActivity from './dashboard/RecentActivity';

interface DashboardViewProps {
  inspections: InspectionRecord[];
  incidents: IncidentRecord[];
  assessments: RepairAssessmentRecord[];
  approvals: RepairApprovalRecord[];
  repairs: RepairLogRecord[];
  repairTracking: RepairTrackingRecord[];
  users: UserAccount[];
  branches: BranchInfo[];
  pmAssets: PMAsset[];
  pmHistory: PMHistoryRecord[];
  selectedBranch: string;
  onSelectBranch: (branch: string) => void;
  uniqueBranches: string[];
  currentUser: UserAccount | null;
  onApproveIncident: (pid: string, approvalData: {
    operation: string;
    vendor: string;
    approvedBy: string;
  }) => void;
  onRefreshData?: () => void;
}

interface DashboardFilterContext {
  isAdmin: boolean;
  userBranch: string;
  filterBranch: string;
  filterYear: string;
  filterMonth: string;
  filterFromDate: string;
  filterToDate: string;
  filterDept: string;
  filterSec: string;
  filterSystem: string;
  filterImpact: string;
  filterStatus: string;
  filterVendor: string;
  filterOwner: string;
  timeRange: string;
  now?: Date;
}

interface DashboardBranchOptionSources {
  uniqueBranches?: unknown[];
  branches?: unknown[];
  inspections?: unknown[];
  incidents?: unknown[];
  assessments?: unknown[];
  approvals?: unknown[];
  repairTracking?: unknown[];
  repairs?: unknown[];
  pmAssets?: unknown[];
  pmHistory?: unknown[];
}

function normalizedDashboardBranch(value: unknown): string {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getDashboardBranchOptions(sources: DashboardBranchOptionSources): string[] {
  const labels = new Map<string, string>();
  const add = (candidate: unknown) => {
    const branch = typeof candidate === 'string'
      ? candidate.trim().replace(/\s+/g, ' ')
      : getDashboardRecordBranch(candidate).replace(/\s+/g, ' ');
    const key = normalizedDashboardBranch(branch);
    if (key && !labels.has(key)) labels.set(key, branch);
  };

  (sources.uniqueBranches || []).forEach(add);
  for (const collection of [
    sources.branches, sources.inspections, sources.incidents, sources.assessments,
    sources.approvals, sources.repairTracking, sources.repairs, sources.pmAssets,
    sources.pmHistory,
  ]) {
    (collection || []).forEach(add);
  }
  return [...labels.values()].sort((a, b) => a.localeCompare(b));
}

export function dashboardRecordMatchesFilters(
  item: any,
  filters: DashboardFilterContext,
  skipDateFilters = false,
): boolean {
  const itemBranch = normalizedDashboardBranch(getDashboardRecordBranch(item));
  if (!filters.isAdmin) {
    if (itemBranch !== normalizedDashboardBranch(filters.userBranch)) return false;
  } else if (filters.filterBranch !== 'ALL' && itemBranch !== normalizedDashboardBranch(filters.filterBranch)) {
    return false;
  }

  if (!skipDateFilters) {
    const recordDate = getDashboardRecordDate(item);
    if (filters.filterYear !== 'ALL') {
      const year = item.ປີ?.toString() || (recordDate ? recordDate.getFullYear().toString() : '');
      if (!year || year !== filters.filterYear) return false;
    }
    if (filters.filterMonth !== 'ALL') {
      const month = item.ເດືອນ?.toString() || (recordDate ? (recordDate.getMonth() + 1).toString() : '');
      if (!month || month !== filters.filterMonth) return false;
    }

    if (recordDate) {
      const today = filters.now || new Date();
      const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const itemMidnight = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());

      if (filters.timeRange === 'TODAY') {
        if (itemMidnight.getTime() !== todayMidnight.getTime()) return false;
      } else if (filters.timeRange === 'LAST_7_DAYS') {
        const diffDays = (todayMidnight.getTime() - itemMidnight.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 7) return false;
      } else if (filters.timeRange === 'LAST_30_DAYS') {
        const diffDays = (todayMidnight.getTime() - itemMidnight.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays < 0 || diffDays > 30) return false;
      } else if (filters.timeRange === 'THIS_MONTH') {
        if (recordDate.getFullYear() !== today.getFullYear() || recordDate.getMonth() !== today.getMonth()) return false;
      } else if (filters.timeRange === 'THIS_QUARTER') {
        if (recordDate.getFullYear() !== today.getFullYear()) return false;
        if (Math.floor(recordDate.getMonth() / 3) !== Math.floor(today.getMonth() / 3)) return false;
      } else if (filters.timeRange === 'THIS_YEAR') {
        if (recordDate.getFullYear() !== today.getFullYear()) return false;
      } else if (filters.timeRange === 'CUSTOM') {
        if (filters.filterFromDate) {
          const fromMidnight = new Date(parseDateSafe(filters.filterFromDate).setHours(0, 0, 0, 0));
          if (itemMidnight.getTime() < fromMidnight.getTime()) return false;
        }
        if (filters.filterToDate) {
          const toMidnight = new Date(parseDateSafe(filters.filterToDate).setHours(23, 59, 59, 999));
          if (itemMidnight.getTime() > toMidnight.getTime()) return false;
        }
      }
    } else if (filters.timeRange !== 'ALL') {
      return false;
    }
  }

  if (filters.filterDept !== 'ALL' && (item['ຝ່າຍ/ໜ່ວຍບໍລິການ'] || item.ຝ່າຍຊັບສິນ || item.division) !== filters.filterDept) return false;
  if (filters.filterSec !== 'ALL' && (item.ຂະແໜງ || item.ຂະແໜງຊັບສິນ || item.sector) !== filters.filterSec) return false;
  if (filters.filterSystem !== 'ALL' && (item.ລະບົບທີ່ກວດ || item.systemCategory) !== filters.filterSystem) return false;
  if (filters.filterImpact !== 'ALL' && (item.ປະເມີນຜົນກະທົບ || item.impactLevel) !== filters.filterImpact) return false;
  if (filters.filterStatus !== 'ALL' && (item.ສະຖານະ || item.trackingStatus || item.assessmentStatus || item.maintenanceStatus || item.overallResult || item.status) !== filters.filterStatus) return false;
  if (filters.filterVendor !== 'ALL' && (item.vendor || item['vendor ຜູ້ສະໜອງ'] || item.vendorName) !== filters.filterVendor) return false;
  if (filters.filterOwner !== 'ALL' && (item.owner || item.responsiblePerson || item.assessorName || item.inspector) !== filters.filterOwner) return false;

  return true;
}

export default function DashboardView({
  inspections = [],
  incidents = [],
  assessments = [],
  approvals = [],
  repairs = [],
  repairTracking = [],
  users = [],
  branches = [],
  pmAssets = [],
  pmHistory = [],
  selectedBranch,
  onSelectBranch,
  uniqueBranches = [],
  currentUser,
  onApproveIncident,
  onRefreshData
}: DashboardViewProps) {

  const getResolvedInspectionType = (inc: IncidentRecord) => {
    const matchedInsp = (inspections || []).find(
      ins => ins.ລະຫັດກວດກາ && inc.ລະຫັດກວດກາ && 
      String(ins.ລະຫັດກວດກາ).trim().toLowerCase() === String(inc.ລະຫັດກວດກາ).trim().toLowerCase()
    );

    const isInspectionRef = inc.ລະຫັດກວດກາ && !String(inc.ລະຫັດກວດກາ).toUpperCase().startsWith("INC-");

    if (isInspectionRef) {
      if (matchedInsp) {
        return matchedInsp.ຮູບແບບການກວດ || (matchedInsp as any).ຮູບແບບການກວດ || (matchedInsp as any).ฮູບແບບການກວດ || "ກວດປະຈໍາວັນ";
      }
      const rawType = inc.ຮູບແບບການກວດ || "";
      return (rawType && rawType !== "none" && rawType !== "ວຽກຈາກການແຈ້ງເຫດ" && rawType !== "ການແຈ້ງເຫດດ່ວນ") ? rawType : "ກວດປະຈໍາວັນ";
    } else {
      const rawType = inc.ຮູບແບບການກວດ || "";
      return (rawType && rawType !== "none" && rawType !== "ວຽກຈາກການແຈ້ງເຫດ") ? rawType : "ການແຈ້ງເຫດດ່ວນ";
    }
  };

  // Current subtab: 'analytics' | 'approvals' | 'preventive'
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'approvals' | 'preventive'>('analytics');

  // Multi-Filter Slicer State
  const [filterYear, setFilterYear] = useState<string>('ALL');
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterFromDate, setFilterFromDate] = useState<string>('');
  const [filterToDate, setFilterToDate] = useState<string>('');
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [filterDept, setFilterDept] = useState<string>('ALL');
  const [filterSec, setFilterSec] = useState<string>('ALL');
  const [filterSystem, setFilterSystem] = useState<string>('ALL');
  const [filterImpact, setFilterImpact] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterVendor, setFilterVendor] = useState<string>('ALL');
  const [filterOwner, setFilterOwner] = useState<string>('ALL');

  // Quick Time Range Selector
  const [timeRange, setTimeRange] = useState<string>('ALL'); // 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'THIS_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM'

  // Auto Refresh countdown (30s)
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [secondsToRefresh, setSecondsToRefresh] = useState(30);
  const [lastRefreshedTime, setLastRefreshedTime] = useState(new Date().toLocaleTimeString('la-LA', { hour12: false }));

  // Approval Modal States
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null);
  const [operation, setOperation] = useState('ຈ້າງພາຍນອກ');
  const [vendor, setVendor] = useState('');
  const [approvedBy, setApprovedBy] = useState(currentUser?.username || '');

  const isAdmin = currentUser?.status === "Admin";
  const userBranch = currentUser?.branch || "";

  const dashboardBranchOptions = useMemo(() => getDashboardBranchOptions({
    uniqueBranches,
    branches,
    inspections,
    incidents,
    assessments,
    approvals,
    repairTracking,
    repairs,
    pmAssets,
    pmHistory,
  }), [
    uniqueBranches, branches, inspections, incidents, assessments, approvals,
    repairTracking, repairs, pmAssets, pmHistory,
  ]);

  // Dynamic values collections for drop downs
  const uniqueYears = Array.from(new Set([
    ...inspections.map(item => item.ປີ?.toString()),
    ...repairs.map(item => item.ປີ?.toString())
  ].filter(Boolean))).sort();

  const uniqueDepts = Array.from(new Set([
    ...inspections.map(item => item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]),
    ...incidents.map(item => item["ຝ່າຍ/ໜ່ວຍບໍລິການ"]),
    ...repairTracking.map(item => item["ຝ່າຍ/ໜ່ວຍບໍລິການ"])
  ].filter(Boolean))).sort();

  const uniqueSecs = Array.from(new Set([
    ...inspections.map(item => item.ຂະແໜງ),
    ...incidents.map(item => item.ຂະແໜງ),
    ...repairTracking.map(item => item.ຂະແໜງ)
  ].filter(Boolean))).sort();

  const uniqueSystems = Array.from(new Set([
    ...inspections.map(item => item.ລະບົບທີ່ກວດ),
    ...incidents.map(item => item.ລະບົບທີ່ກວດ),
    ...repairTracking.map(item => item.ລະບົບທີ່ກວດ)
  ].filter(Boolean))).sort();

  const uniqueVendors = Array.from(new Set([
    ...approvals.map(item => item["vendor ຜູ້ສະໜອງ"]),
    ...repairTracking.map(item => item.vendor),
    ...repairs.map(item => item["vendor ຜູ້ສະໜອງ"])
  ].filter(Boolean))).sort();

  const uniqueOwners = Array.from(new Set(repairTracking.map(item => item.owner).filter(Boolean))).sort();

  // Helper: Get Date from record
  const getRecordDate = (item: any): Date | null => {
    return getDashboardRecordDate(item);
  };

  // Helper: check SLA status
  const computeSLAInfo = (item: RepairTrackingRecord) => {
    const isClosed = item.trackingStatus === "ປິດງານແລ້ວ" || item.ສະຖານະ === "Closed" || item.trackingStatus === "ສ້ອມສຳເລັດ";
    const impact = item.ປະເມີນຜົນກະທົບ || "ຕ່ຳ";
    let slaDays = 15;
    if (impact === "ສູງ") slaDays = 3;
    else if (impact === "ປານກາງ") slaDays = 7;

    const startStr = item.startRepairDate || item.ວັນທີ່ອະນຸມັດ || item.ວັນທີ່ກວດ;
    if (!startStr) return { status: "ຢູ່ໃນກຳນົດ", overdue: false };

    const startDate = parseDateSafe(startStr);
    const expected = item.expectedFinishDate 
      ? parseDateSafe(item.expectedFinishDate) 
      : new Date(startDate.getTime() + slaDays * 24 * 60 * 60 * 1000);

    const actual = item.actualFinishDate ? parseDateSafe(item.actualFinishDate) : null;
    const now = new Date();

    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expectedMidnight = new Date(expected.getFullYear(), expected.getMonth(), expected.getDate());

    if (isClosed) {
      if (actual) {
        const actualMidnight = new Date(actual.getFullYear(), actual.getMonth(), actual.getDate());
        return actualMidnight.getTime() <= expectedMidnight.getTime() 
          ? { status: "ສຳເລັດທັນກຳນົດ", overdue: false } 
          : { status: "ສຳເລັດເກີນກຳນົດ", overdue: true };
      }
      return { status: "ສຳເລັດທັນກຳນົດ", overdue: false };
    } else {
      const diffTime = expectedMidnight.getTime() - nowMidnight.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 0) return { status: "ເກີນ SLA", overdue: true, daysLeft: diffDays };
      if (diffDays <= 1) return { status: "ໃກ້ເກີນ SLA", overdue: false, daysLeft: diffDays };
      return { status: "ຢູ່ໃນກຳນົດ", overdue: false, daysLeft: diffDays };
    }
  };

  // Filter Match Checker
  const matchRecord = (item: any, skipDateFilters = false) => dashboardRecordMatchesFilters(item, {
    isAdmin,
    userBranch,
    filterBranch,
    filterYear,
    filterMonth,
    filterFromDate,
    filterToDate,
    filterDept,
    filterSec,
    filterSystem,
    filterImpact,
    filterStatus,
    filterVendor,
    filterOwner,
    timeRange,
  }, skipDateFilters);

  // Filtered Datasets
  const {
    fInspections,
    fIncidents,
    fAssessments,
    fApprovals,
    fTracking,
    fRepairs,
    fUsers,
    fBranches,
    fPmAssets,
    fPmHistory,
  } = useMemo(() => ({
    fInspections: inspections.filter(item => matchRecord(item)),
    fIncidents: incidents.filter(item => matchRecord(item)),
    fAssessments: assessments.filter(item => matchRecord(item)),
    fApprovals: approvals.filter(item => matchRecord(item)),
    fTracking: repairTracking.filter(item => matchRecord(item)),
    fRepairs: repairs.filter(item => matchRecord(item)),
    fUsers: users.filter(item => matchRecord(item)),
    fBranches: branches.filter(item => matchRecord(item, true)),
    fPmAssets: pmAssets.filter(item => matchRecord(item)),
    fPmHistory: pmHistory.filter(item => matchRecord(item)),
  }), [
    inspections, incidents, assessments, approvals, repairTracking, repairs, users, branches, pmAssets, pmHistory,
    isAdmin, userBranch, filterYear, filterMonth, filterFromDate, filterToDate, filterBranch, filterDept,
    filterSec, filterSystem, filterImpact, filterStatus, filterVendor, filterOwner, timeRange,
  ]);

  const metrics = useMemo(() => buildDashboardMetrics({
    inspections: fInspections,
    incidents: fIncidents,
    assessments: fAssessments,
    approvals: fApprovals,
    repairTracking: fTracking,
    repairs: fRepairs,
    users: fUsers,
    branches: fBranches,
    pmAssets: fPmAssets,
    pmHistory: fPmHistory,
  }), [fInspections, fIncidents, fAssessments, fApprovals, fTracking, fRepairs, fUsers, fBranches, fPmAssets, fPmHistory]);

  // Auto Refresh Countdown timer
  useEffect(() => {
    if (!isAutoRefresh) return;
    const timer = setInterval(() => {
      setSecondsToRefresh(prev => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isAutoRefresh]);

  // Handle auto-refresh execution when timer hits 0 safely outside of render phase
  useEffect(() => {
    if (secondsToRefresh === 0) {
      if (onRefreshData) onRefreshData();
      setLastRefreshedTime(new Date().toLocaleTimeString('la-LA', { hour12: false }));
      setSecondsToRefresh(30);
    }
  }, [secondsToRefresh, onRefreshData]);

  const triggerManualRefresh = () => {
    if (onRefreshData) onRefreshData();
    setLastRefreshedTime(new Date().toLocaleTimeString('la-LA', { hour12: false }));
    setSecondsToRefresh(30);
  };

  const monthNames = ["ມັງກອນ", "ກຸມພາ", "ມີນາ", "ເມສາ", "ພຶດສະພາ", "ມິຖຸນາ", "ກໍລະກົດ", "ສິງຫາ", "ກັນຍາ", "ຕຸລາ", "ພະຈິກ", "ທັນວາ"];

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      "ລະຫັດກວດກາ", "ລະຫັດເຫດການ", "ລະຫັດຕິດຕາມສ້ອມ", "ສາຂາ", "ລະບົບທີ່ກວດ", "ຊື່ຊັບສິນ",
      "ລາຍລະອຽດບັນຫາ", "ລະດັບຜົນກະທົບ", "ສະຖານະອະນຸມັດ", "ສະຖານະຕິດຕາມສ້ອມ", "SLA Status",
      "ວັນທີ່ອະນຸມັດ", "ວັນທີ່ເລີ່ມສ້ອມ", "ວັນທີ່ຄາດວ່າຈະສຳເລັດ", "ວັນທີ່ສຳເລັດຈິງ", "Progress %",
      "Owner", "Vendor", "ເຫດຜົນລ່າຊ້າ", "ຄ່າສ້ອມແປງ"
    ];
    const rows = fTracking.map(item => {
      const sla = computeSLAInfo(item);
      return [
        item.ລະຫັດກວດກາ || '',
        item.PID || '',
        item.PID || '',
        item["ສາຂາ "] || '',
        item.ລະບົບທີ່ກວດ || '',
        item.ລາຍການ || '',
        item.ລາຍລະອຽດປັນຫາທີ່ພົບ || '',
        item.ປະເມີນຜົນກະທົບ || '',
        item.ສະຖານະ || 'ອະນຸມັດແລ້ວ',
        item.trackingStatus || '',
        sla.status,
        item.ວັນທີ່ອະນຸມັດ || '',
        item.startRepairDate || '',
        item.expectedFinishDate || '',
        item.actualFinishDate || '',
        `${item.progressPercent}%`,
        item.owner || '',
        item.vendor || '',
        item.delayReason || '',
        item.repairCost || 0
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LDB_SafeHub_Executive_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Approval Process Flow Lists
  const sortedIncidents = [...fIncidents].sort((a, b) => {
    return cleanString(b.ວັນທີ່ກວດ || "").localeCompare(cleanString(a.ວັນທີ່ກວດ || ""));
  });
  const pendingIncidents = sortedIncidents.filter(i => i.ສະຖານະ === "ລໍຖ້າການອະນຸມັດ" || i.ສະຖານະ === "ລໍຖ້າອະນຸມັດ" || !i.ສະຖານະ);
  const approvedIncidents = sortedIncidents.filter(i => i.ສະຖານະ === "ລໍຖ້າສ້ອມແປງ" || i.ສະຖານະ === "ອະນຸມັດແລ້ວ" || i.ສະຖານະ === "ສຳເລັດ" || i.ສະຖານະ === "ສໍາເລັດ");

  const handleSaveApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident) return;
    onApproveIncident(selectedIncident.PID, {
      operation,
      vendor: operation === "ຈ້າງພາຍນອກ" ? vendor : "ສ້ອມແປງເອງໂດຍພະນັກງານ",
      approvedBy
    });
    setIsApproveOpen(false);
    setSelectedIncident(null);
    setVendor("");
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-850 p-6 rounded-2xl shadow-xl border border-emerald-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Award className="h-6 w-6 text-amber-400" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">ແຜງຄວບຄຸມຄະນະກວດກາ ແລະ ສ້ອມແປງອາຄານ</h1>
          </div>
          <p className="text-xs text-emerald-100/80 mt-1 font-medium">LDB SafeHub Executive Dashboard — ການກວດກາ, ວຽກຄົງຄ້າງ, SLA, ແລະ ງົບປະມານສ້ອມແປງ</p>
        </div>

        {/* Real-time Status */}
        <div className="flex flex-wrap items-center gap-3 bg-emerald-950/40 p-3 rounded-xl border border-emerald-800 text-xs">
          <div className="flex items-center gap-1.5 font-medium">
            <Clock className="h-4 w-4 text-emerald-300" />
            <span>ອັບເດດຫຼ້າສຸດ:</span>
            <span className="font-mono bg-emerald-900 px-2 py-0.5 rounded font-bold text-amber-400">{lastRefreshedTime}</span>
          </div>

          <button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            className="flex items-center gap-1.5 hover:text-amber-400 transition"
          >
            <span className={`h-2.5 w-2.5 rounded-full ${isAutoRefresh ? 'bg-amber-400 animate-pulse' : 'bg-slate-500'}`} />
            <span>Auto-Refresh: {isAutoRefresh ? `${secondsToRefresh}s` : 'OFF'}</span>
          </button>

          <button
            onClick={triggerManualRefresh}
            className="p-1.5 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-white transition active:scale-95"
            title="ຣີເຟຣຊຂໍ້ມູນ (Refresh)"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Top-level Multi-Filter Slicer Board */}
      <div
        id="dashboard-slicer-filters"
        className="space-y-4 rounded-2xl border border-cyan-300/20 bg-[#04101f] p-5 text-slate-100 shadow-[0_26px_80px_rgba(2,8,23,0.32)]"
      >
        <div className="flex items-center gap-2 border-b border-cyan-300/15 pb-2 text-xs font-bold text-white">
          <Filter className="h-4 w-4 text-cyan-300" />
          <span>ຕົວປັບແຕ່ງຂໍ້ມູນ (Dashboard Slicer Filters)</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          
          {/* Branch filter (Admins can select, users locked) */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ສາຂາ</label>
            {isAdmin ? (
              <select
                value={filterBranch}
                onChange={(e) => { setFilterBranch(e.target.value); onSelectBranch(e.target.value); }}
                className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
              >
                <option value="ALL">ທັງໝົດ / ALL Branches</option>
                {dashboardBranchOptions.map(br => (
                  <option key={br} value={br}>{br}</option>
                ))}
              </select>
            ) : (
              <div className="dashboard-slicer-control rounded-lg border border-cyan-300/15 bg-[#08182b] p-2 text-xs font-bold text-slate-100">{userBranch}</div>
            )}
          </div>

          {/* Year */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ປີ</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທຸກໆປີ</option>
              {uniqueYears.map((yr, idx) => (
                <option key={idx} value={yr}>{yr}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ເດືອນ</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທຸກໆເດືອນ</option>
              {monthNames.map((name, idx) => (
                <option key={idx} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>

          {/* Quick Time Range */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ຊ່ວງເວລາໄວ</label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ຕະຫຼອດ / All Time</option>
              <option value="TODAY">ມື້ນີ້ / Today</option>
              <option value="LAST_7_DAYS">7 ມື້ຫຼ້າສຸດ / Last 7 Days</option>
              <option value="LAST_30_DAYS">30 ມື້ຫຼ້າສຸດ / Last 30 Days</option>
              <option value="THIS_MONTH">ເດືອນນີ້ / This Month</option>
              <option value="THIS_QUARTER">ໄຕມາດນີ້ / This Quarter</option>
              <option value="THIS_YEAR">ປີນີ້ / This Year</option>
              <option value="CUSTOM">ກຳນົດວັນທີເອງ...</option>
            </select>
          </div>

          {/* Custom Date Range Picker */}
          {timeRange === 'CUSTOM' && (
            <>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">ຈາກວັນທີ</label>
                <input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-slate-400">ຫາວັນທີ</label>
                <input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
                />
              </div>
            </>
          )}

          {/* Department */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ຝ່າຍ/ໜ່ວຍບໍລິການ</label>
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທັງໝົດ</option>
              {uniqueDepts.map((d, idx) => (
                <option key={idx} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Section */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ຂະແໜງ</label>
            <select
              value={filterSec}
              onChange={(e) => setFilterSec(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທັງໝົດ</option>
              {uniqueSecs.map((s, idx) => (
                <option key={idx} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* System */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ລະບົບທີ່ກວດ (System Category)</label>
            <select
              value={filterSystem}
              onChange={(e) => setFilterSystem(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທຸກລະບົບ</option>
              {uniqueSystems.map((sys, idx) => (
                <option key={idx} value={sys}>{sys}</option>
              ))}
            </select>
          </div>

          {/* Impact level */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ລະດັບຜົນກະທົບ</label>
            <select
              value={filterImpact}
              onChange={(e) => setFilterImpact(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທຸກລະດັບ</option>
              <option value="ສູງ">🔴 ສູງ (High)</option>
              <option value="ປານກາງ">🟡 ປານກາງ (Medium)</option>
              <option value="ຕ່ຳ">🔵 ຕ່ຳ (Low)</option>
            </select>
          </div>

          {/* Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">ສະຖານະ</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທັງໝົດ</option>
              <option value="ລໍຖ້າເລີ່ມສ້ອມ">ລໍຖ້າເລີ່ມສ້ອມ</option>
              <option value="ກຳລັງດຳເນີນການ">ກຳລັງດຳເນີນການ</option>
              <option value="ລໍຖ້າອະໄຫຼ່">ລໍຖ້າອະໄຫຼ່</option>
              <option value="ລໍຖ້າ Vendor">ລໍຖ້າ Vendor</option>
              <option value="ຢຸດຊົ່ວຄາວ">ຢຸດຊົ່ວຄາວ</option>
              <option value="ສ້ອມສຳເລັດ">ສ້ອມສຳເລັດ</option>
              <option value="ປິດງານແລ້ວ">ປິດງານແລ້ວ</option>
            </select>
          </div>

          {/* Vendor */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Vendor</label>
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທຸກ Vendor</option>
              {uniqueVendors.map((v, idx) => (
                <option key={idx} value={v}>{v}</option>
              ))}
            </select>
          </div>

          {/* Owner */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase text-slate-400">Owner ຜູ້ຕິດຕາມ</label>
            <select
              value={filterOwner}
              onChange={(e) => setFilterOwner(e.target.value)}
              className="dashboard-slicer-control w-full rounded-lg border border-cyan-300/15 bg-[#08182b] p-1.5 text-xs font-semibold text-slate-100 focus:border-cyan-300/40 focus:outline-none focus:ring-2 focus:ring-cyan-300/40"
            >
              <option value="ALL">ທັງໝົດ</option>
              {uniqueOwners.map((o, idx) => (
                <option key={idx} value={o}>{o}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* 3. Inline Tab switches for Executive Analytics vs. Approval Workflow */}
      <div id="dashboard-subtab-navigation" className="flex flex-col gap-2 rounded-xl border border-cyan-300/20 bg-[#071426] p-1 shadow-[0_14px_35px_rgba(2,8,23,0.24)] sm:flex-row">
        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`pb-3 pt-3 px-6 text-sm font-bold transition flex items-center gap-1.5 cursor-pointer rounded-t-lg ${
            activeSubTab === 'analytics'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <ChartIcon className="h-4.5 w-4.5" />
          <span>ແຜງວິເຄາະ & ຄວາມສ່ຽງ (Analytics & Risk Insights)</span>
        </button>
        <button
          onClick={() => setActiveSubTab('approvals')}
          className={`pb-3 pt-3 px-6 text-sm font-bold transition flex items-center gap-1.5 cursor-pointer rounded-t-lg ${
            activeSubTab === 'approvals'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <Hammer className="h-4.5 w-4.5" />
          <span>ຂັ້ນຕອນການອະນຸມັດສ້ອມແປງ (Approval Workflows)</span>
          {pendingIncidents.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-bounce">
              {pendingIncidents.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveSubTab('preventive')}
          className={`pb-3 pt-3 px-6 text-sm font-bold transition flex items-center gap-1.5 cursor-pointer rounded-t-lg ${
            activeSubTab === 'preventive'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <Shield className="h-4.5 w-4.5" />
          <span>ແຜນບຳລຸງຮັກສາປ້ອງກັນ (Preventive Maintenance Dashboard)</span>
        </button>
      </div>

      {activeSubTab === 'analytics' ? (
        <>
          <DashboardOverview
            metrics={metrics}
            lastRefreshedTime={lastRefreshedTime}
            secondsToRefresh={secondsToRefresh}
            isAutoRefresh={isAutoRefresh}
            onRefresh={triggerManualRefresh}
            onExport={handleExportCSV}
          />
          <BranchIntelligence branches={metrics.branchPerformance} />
          <RecentActivity items={metrics.recentActivity} />
        </>
      ) : activeSubTab === 'approvals' ? (
        /* Preservation of the exact Old Workflow (ခွင့်ပြုချက်/Approval Process 2-Column Grid) */
        <div id="approval-workflow-wrapper" className="space-y-4 rounded-2xl border border-cyan-300/20 bg-[#04101f] p-5 text-slate-100 shadow-[0_26px_80px_rgba(2,8,23,0.36)]">
          <div className="border-b border-cyan-300/15 pb-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-white">
              <Hammer className="h-4.5 w-4.5 text-cyan-300" />
              <span>ຂັ້ນຕອນການອະນຸມັດສ້ອມແປງ (Repair Approval Workflow Grid)</span>
            </h3>
            <p className="mt-1 text-[11px] text-slate-400">
              ແຍກທະບຽນເຫດການເປັນ 2 ຟາກ: ຟາກລໍຖ້າອະນຸມັດ (ຊ້າຍ) ແລະ ຟາກທີ່ອະນຸມັດສ້ອມແປງແລ້ວ (ຂວາ). ທ່ານສາມາດກົດອະນຸມັດສ້ອມໄດ້ທັນທີຈາກໜ້ານີ້!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Column 1: Awaiting Repair Approval */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-rose-300/20 bg-rose-400/10 p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-200">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0"></span>
                  🔴 ຟາກທີ 1: ລໍຖ້າອະນຸມັດສ້ອມ ({pendingIncidents.length} ລາຍການ)
                </span>
                <span className="rounded-full border border-rose-300/20 bg-rose-400/10 px-2 py-0.5 text-[10px] font-bold text-rose-200">Awaiting</span>
              </div>

              <div className="space-y-3 max-h-[35rem] overflow-y-auto pr-1">
                {pendingIncidents.length > 0 ? (
                  pendingIncidents.map((inc, idx) => {
                    const isHigh = inc.ປະເມີນຜົນກະທົບ === "ສູງ";
                    const isMedium = inc.ປະເມີນຜົນກະທົບ === "ປານກາງ";
                    const accentBorderColor = isHigh ? "border-l-red-500" : isMedium ? "border-l-amber-500" : "border-l-blue-500";
                    const impactBadgeBg = isHigh ? "border-rose-300/20 bg-rose-400/10 text-rose-200" : isMedium ? "border-amber-300/20 bg-amber-400/10 text-amber-200" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-200";
                    return (
                      <div 
                        key={idx} 
                        className={`relative space-y-3.5 rounded-xl border border-cyan-300/15 border-l-4 bg-[#08182b]/90 p-4 shadow-lg transition-all duration-200 hover:border-cyan-300/30 hover:shadow-cyan-500/5 ${accentBorderColor}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded border border-cyan-300/15 bg-slate-950/35 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-100">
                            {inc.ລະຫັດກວດກາ || 'INT-REPORT'}
                          </span>
                          
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${impactBadgeBg}`}>
                            {isHigh ? "🔴 ສູງ (High Impact)" : isMedium ? "🟡 ປານກາງ (Medium)" : "🔵 ຕ່ຳ (Low)"}
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <p className="text-sm font-bold tracking-tight text-white">
                            {inc.ໝວດລາຍການ || 'ໝວດສັບສິນ'}: {inc.ລາຍການ || 'ບໍ່ມີຊື່'}
                          </p>
                          <div className="grid grid-cols-1 gap-1 rounded-xl border border-cyan-300/10 bg-slate-950/25 p-2.5 text-[10px] text-slate-300">
                            <p><strong className="font-bold text-slate-200">ຮູບແບບການກວດ:</strong> <span className="font-medium text-white">{getResolvedInspectionType(inc)}</span></p>
                            <p><strong className="font-bold text-slate-200">ລະບົບທີ່ກວດ:</strong> <span className="font-medium text-white">{inc.ລະບົບທີ່ກວດ || "—"}</span></p>
                            <p><strong className="font-bold text-slate-200">ໝວດລະບົບກວດ:</strong> <span className="font-medium text-white">{inc.ໝວດລະບົບກວດ || "—"}</span></p>
                          </div>
                          <p className="rounded-xl border border-cyan-300/10 bg-slate-950/20 p-2.5 text-[11.5px] leading-relaxed text-slate-300">
                            <strong className="font-bold text-white">ລາຍລະອຽດບັນຫາທີ່ພົບ:</strong> {inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || 'ບໍ່ໄດ້ລະບຸບັນຫາ'}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold pt-1">
                            <span className="flex items-center gap-1 rounded-md border border-cyan-300/15 bg-cyan-300/5 px-2 py-0.5 text-slate-300">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-cyan-300" /> {inc["ສາຂາ "]}
                            </span>
                            <span className="rounded-md border border-cyan-300/15 bg-cyan-300/5 px-2 py-0.5 text-slate-300">
                              📅 {formatExcelDate(inc.ວັນທີ່ກວດ)}
                            </span>
                          </div>
                        </div>

                        <div className="border-t border-cyan-300/10 pt-2.5">
                          <button
                            onClick={() => {
                              setSelectedIncident(inc);
                              setIsApproveOpen(true);
                            }}
                            className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-xl border border-cyan-300/25 bg-cyan-400/15 px-3 py-2.5 text-xs font-bold text-cyan-100 shadow-sm transition hover:bg-cyan-400/25 active:scale-98"
                          >
                            <Check className="h-4 w-4 text-amber-300 shrink-0" />
                            <span>ອະນຸມັດສ້ອມແປງ (Approve Repair)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-cyan-300/20 bg-slate-950/25 py-16 text-center text-xs font-medium text-slate-400">
                    ✨ ດີເລີດ! ບໍ່ມີລາຍການຄົງຄ້າງທີ່ລໍຖ້າການອະນຸມັດໃນສາຂານີ້
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Approved Reparation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  🟢 ຟາກທີ 2: ຂໍ້ມູນອະນຸມັດແລ້ວ ({approvedIncidents.length} ລາຍການ)
                </span>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">Approved</span>
              </div>

              <div className="space-y-3 max-h-[35rem] overflow-y-auto pr-1">
                {approvedIncidents.length > 0 ? (
                  approvedIncidents.map((inc, idx) => {
                    const status = inc.ສະຖານະ || "ອະນຸມັດແລ້ວ";
                    const isHigh = inc.ປະເມີນຜົນກະທົບ === "ສູງ";
                    const isMedium = inc.ປະເມີນຜົນກະທົບ === "ປານກາງ";
                    const impactBadgeBg = isHigh ? "border-rose-300/20 bg-rose-400/10 text-rose-200" : isMedium ? "border-amber-300/20 bg-amber-400/10 text-amber-200" : "border-cyan-300/20 bg-cyan-400/10 text-cyan-200";
                    return (
                      <div 
                        key={idx} 
                        className="relative space-y-3.5 overflow-hidden rounded-xl border border-cyan-300/15 border-l-4 border-l-emerald-500 bg-[#08182b]/90 p-4 shadow-lg transition-all duration-200 hover:border-emerald-300/40 hover:shadow-emerald-500/5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="rounded border border-cyan-300/15 bg-slate-950/35 px-2 py-0.5 font-mono text-[9px] font-bold text-cyan-100">
                            {inc.ລະຫັດກວດກາ || 'INT-REPORT'}
                          </span>
                          
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center border px-1.5 py-0.5 rounded-full text-[9px] font-bold ${impactBadgeBg}`}>
                              {isHigh ? "🔴 ສູງ" : isMedium ? "🟡 ກາງ" : "🔵 ຕ່ຳ"}
                            </span>

                            <span className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-200 shadow-sm">
                              ✓ {status}
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2 text-xs">
                          <p className="text-sm font-bold tracking-tight text-white">
                            {inc.ໝວດລາຍການ || 'ໝວດສັບສິນ'}: {inc.ລາຍການ || 'ບໍ່ມີຊື່'}
                          </p>
                          <p className="rounded-xl border border-cyan-300/10 bg-slate-950/20 p-2.5 text-[11.5px] leading-relaxed text-slate-300">
                            <strong className="font-bold text-white">ລາຍລະອຽດບັນຫາທີ່ພົບ:</strong> {inc.ລາຍລະອຽດປັນຫາທີ່ພົບ || 'ບໍ່ໄດ້ລະບຸບັນຫາ'}
                          </p>
                        </div>

                        {/* Display approval/repair detail info */}
                        {(() => {
                          const matchedApproval = approvals.find(ap => ap.PID === inc.PID);
                          if (matchedApproval) {
                            return (
                              <div className="space-y-1.5 rounded-xl border border-emerald-300/15 bg-emerald-400/5 p-3 text-[10.5px] text-slate-300 shadow-sm">
                                <p className="flex items-center gap-1 border-b border-emerald-300/10 pb-1 font-bold text-emerald-200">
                                  <Hammer className="h-3.5 w-3.5 text-amber-500 shrink-0" /> 
                                  <span>ລາຍລະອຽດການອະນຸມັດສ້ອມແປງ:</span>
                                </p>
                                <div className="grid grid-cols-1 gap-1 font-medium">
                                  <p>• <span className="text-slate-400">ຮູບແບບ:</span> <span className="rounded border border-cyan-300/10 bg-slate-950/25 px-1.5 py-0.5 font-bold text-white">{matchedApproval.ການດຳເນີນງານ}</span></p>
                                  <p>• <span className="text-slate-400">ຜູ້ສະໜອງ/ຊ່າງ:</span> <span className="rounded border border-cyan-300/15 bg-cyan-300/5 px-1.5 py-0.5 font-bold text-cyan-100">{matchedApproval["vendor ຜູ້ສະໜອງ"] || 'ບໍ່ລະບຸ'}</span></p>
                                  <p>• <span className="text-slate-400">ວັນທີອະນຸມັດ:</span> <span className="font-bold text-white">{matchedApproval.ວັນທີ່ອະນຸມັດ}</span></p>
                                  <p>• <span className="text-slate-400">ຜູ້ອະນຸມັດ:</span> <span className="font-bold text-white">{matchedApproval.ຜູ້ອະນຸມັດ}</span></p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-cyan-300/20 bg-slate-950/25 py-16 text-center text-xs text-slate-400">
                    ບໍ່ມີລາຍການທີ່ໄດ້ຮັບການອະນຸມັດເທື່ອ
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* Preventive Maintenance Executive Dashboard Subtab */
        (() => {
          // Dashboard filters and Branch User RLS were already applied upstream.
          const filteredPMAssets = fPmAssets;
          const filteredPMHistory = fPmHistory;

          // Stats
          const totalPMAssets = filteredPMAssets.length;
          const normalPM = filteredPMAssets.filter(a => a.maintenanceStatus === 'ປົກກະຕິ').length;
          const nearDuePM = filteredPMAssets.filter(a => a.maintenanceStatus === 'ໃກ້ຮອດກຳນົດ').length;
          const duePM = filteredPMAssets.filter(a => a.maintenanceStatus === 'ຮອດກຳນົດ').length;
          const overduePM = filteredPMAssets.filter(a => a.maintenanceStatus === 'ເກີນກຳນົດ').length;

          const completionRate = filteredPMHistory.length > 0 
            ? Math.round((filteredPMHistory.filter(h => h.overallResult === 'ປົກກະຕິ').length / filteredPMHistory.length) * 100) 
            : 100;

          // Recharts Data for Status Breakdown
          const pmStatusChartData = [
            { name: 'ປົກກະຕິ (Normal)', value: normalPM, color: '#10B981' },
            { name: 'ໃກ້ຮອດກຳນົດ (Near Due)', value: nearDuePM, color: '#F59E0B' },
            { name: 'ຮອດກຳນົດ (Due)', value: duePM, color: '#EF4444' },
            { name: 'ເກີນກຳນົດ (Overdue)', value: overduePM, color: '#7F1D1D' },
          ].filter(item => item.value > 0);

          // Recharts Data for Systems
          const pmSystemMap: { [key: string]: { normal: number, warning: number } } = {};
          filteredPMAssets.forEach(asset => {
            const sys = asset.systemCategory || 'ອື່ນໆ';
            if (!pmSystemMap[sys]) {
              pmSystemMap[sys] = { normal: 0, warning: 0 };
            }
            if (asset.maintenanceStatus === 'ປົກກະຕິ' || asset.maintenanceStatus === 'ໃກ້ຮອດກຳນົດ') {
              pmSystemMap[sys].normal += 1;
            } else {
              pmSystemMap[sys].warning += 1;
            }
          });
          const pmSystemChartData = Object.keys(pmSystemMap).map(sys => ({
            name: sys,
            'ປົກກະຕິ': pmSystemMap[sys].normal,
            'ຮອດກຳນົດ_ເກີນກຳນົດ': pmSystemMap[sys].warning,
          }));

          // Actionable Alerts / Urgent attention list
          const urgentPMAssets = filteredPMAssets.filter(a => a.maintenanceStatus === 'ເກີນກຳນົດ' || a.maintenanceStatus === 'ຮອດກຳນົດ');

          return (
            <div className="animate-fadeIn space-y-6 rounded-2xl border border-cyan-300/20 bg-[#04101f] p-3 text-slate-100 shadow-[0_26px_80px_rgba(2,8,23,0.36)] sm:p-5" id="pm-dashboard-wrapper">
              {/* Introduction & Overview banner */}
              <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-cyan-300/20 bg-gradient-to-r from-[#071426] via-[#0a1d32] to-[#101b2b] p-6 text-white shadow-[0_18px_45px_rgba(2,8,23,0.28)] md:flex-row md:items-center">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <Shield className="h-5.5 w-5.5 animate-pulse text-cyan-300" />
                    <span>ລະບົບວິເຄາະການບຳລຸງຮັກສາປ້ອງກັນ (LDB PM Executive Dashboard)</span>
                  </h3>
                  <p className="max-w-2xl text-xs leading-relaxed text-slate-300">
                    ຕິດຕາມສະຖານະການບຳລຸງຮັກສາອຸປະກອນ ແລະ ລະບົບອາຄານຂອງທະນາຄານພັດທະນາລາວ (LDB) ເພື່ອປ້ອງກັນຄວາມເສຍຫາຍກ່ອນເກີດເຫດ. ກວດສອບອັດຕາຄວາມພ້ອມໃຊ້ງານ ແລະ ລາຍການເກີນກຳນົດ.
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 text-right text-xs">
                  <span className="block text-[10px] text-cyan-200">ອັດຕາການກວດຜ່ານ</span>
                  <span className="text-lg font-black text-emerald-400">{completionRate}% Pass</span>
                </div>
              </div>

              {/* KPI Scorecard Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="pm-kpi-grid">
                <div className="flex items-center gap-4 rounded-2xl border border-cyan-300/15 bg-[#08182b]/90 p-5 shadow-lg transition hover:border-cyan-300/35">
                  <div className="rounded-xl bg-cyan-300/10 p-3">
                    <Building2 className="h-6 w-6 text-cyan-300" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">ຊັບສິນ PM ທັງໝົດ</span>
                    <span className="text-xl font-extrabold text-white">{totalPMAssets} <span className="text-xs font-normal text-slate-500">ລາຍການ</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-emerald-300/15 bg-[#08182b]/90 p-5 shadow-lg transition hover:border-emerald-300/35">
                  <div className="rounded-xl bg-emerald-300/10 p-3">
                    <CheckCircle className="h-6 w-6 text-emerald-300" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">ສະຖານະ ປົກກະຕິ / ໃກ້ຮອດ</span>
                    <span className="text-xl font-extrabold text-white">
                      {normalPM + nearDuePM} <span className="text-xs font-normal text-slate-500">({totalPMAssets > 0 ? Math.round(((normalPM + nearDuePM) / totalPMAssets) * 100) : 100}%)</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-amber-300/15 bg-[#08182b]/90 p-5 shadow-lg transition hover:border-amber-300/35">
                  <div className="rounded-xl bg-amber-300/10 p-3">
                    <Clock className="h-6 w-6 text-amber-300" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">ຮອດກຳນົດບຳລຸງຮັກສາ</span>
                    <span className="text-xl font-extrabold text-amber-200">{duePM} <span className="text-xs font-normal text-slate-500">ລາຍການ</span></span>
                  </div>
                </div>

                <div className="flex items-center gap-4 rounded-2xl border border-rose-300/15 bg-[#08182b]/90 p-5 shadow-lg transition hover:border-rose-300/35">
                  <div className="rounded-xl bg-rose-300/10 p-3">
                    <AlertTriangle className="h-6 w-6 animate-bounce text-rose-300" />
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider block">ເກີນກຳນົດບຳລຸງຮັກສາ (Overdue)</span>
                    <span className={`text-xl font-extrabold ${overduePM > 0 ? 'animate-pulse text-rose-300' : 'text-white'}`}>{overduePM} <span className="text-xs font-normal text-slate-500">ລາຍການ</span></span>
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* 1. Status breakdown pie-like chart or bar chart */}
                <div className="space-y-4 rounded-2xl border border-cyan-300/15 bg-[#08182b]/90 p-5 shadow-lg">
                  <div className="border-b border-cyan-300/10 pb-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <ChartIcon className="h-4 w-4 text-cyan-300" />
                      <span>ອັດຕາສ່ວນສະຖານະ PM (Status Breakdown)</span>
                    </h4>
                  </div>
                  <div className="h-56 flex items-center justify-center relative">
                    {totalPMAssets > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pmStatusChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pmStatusChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`${value} ລາຍການ`, 'ຈຳນວນ']} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <span className="text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນ</span>
                    )}
                  </div>
                  {/* Legend of the PieChart */}
                  <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded bg-[#10B981] shrink-0" />
                      <span>ປົກກະຕິ ({normalPM})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded bg-[#F59E0B] shrink-0" />
                      <span>ໃກ້ຮອດ ({nearDuePM})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded bg-[#EF4444] shrink-0" />
                      <span>ຮອດກຳນົດ ({duePM})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded bg-[#7F1D1D] shrink-0" />
                      <span>ເກີນກຳນົດ ({overduePM})</span>
                    </div>
                  </div>
                </div>

                {/* 2. System distribution bar chart */}
                <div className="space-y-4 rounded-2xl border border-cyan-300/15 bg-[#08182b]/90 p-5 shadow-lg lg:col-span-2">
                  <div className="border-b border-cyan-300/10 pb-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Activity className="h-4 w-4 text-emerald-300" />
                      <span>ການບຳລຸງຮັກສາແຍກຕາມໝວດລະບົບ (PM Distribution by System)</span>
                    </h4>
                  </div>
                  <div className="h-64">
                    {pmSystemChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={pmSystemChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.14)" />
                          <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                          <YAxis stroke="#94a3b8" fontSize={10} allowDecimals={false} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                          <Bar name="ປົກກະຕິ" dataKey="ປົກກະຕິ" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar name="ຮອດກຳນົດ / ເກີນກຳນົດ" dataKey="ຮອດກຳນົດ_ເກີນກຳນົດ" fill="#EF4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">ບໍ່ມີຂໍ້ມູນລະບົບ</div>
                    )}
                  </div>
                </div>

              </div>

              {/* Urgent Attention / Action items */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                
                {/* Urgent PM Items List (Left 2 cols) */}
                <div className="space-y-4 rounded-2xl border border-cyan-300/15 bg-[#08182b]/90 p-5 shadow-lg xl:col-span-2">
                  <div className="flex items-center justify-between border-b border-cyan-300/10 pb-3">
                    <div>
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <AlertCircle className="h-4.5 w-4.5 animate-pulse text-rose-300" />
                        <span>ລາຍການທີ່ຕ້ອງເລັ່ງບຳລຸງຮັກສາ ({urgentPMAssets.length})</span>
                      </h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">ສະແດງສະເພາະອຸປະກອນທີ່ຮອດກຳນົດ ແລະ ເກີນກຳນົດບຳລຸງຮັກສາໃນຂະນະນີ້</p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-cyan-300/10 bg-slate-950/25 font-bold text-slate-400">
                          <th className="p-2.5">ລະຫັດ / ຊື່ຊັບສິນ</th>
                          <th className="p-2.5">ສາຂາ</th>
                          <th className="p-2.5">ລະບົບ</th>
                          <th className="p-2.5">ຮອບວຽນ</th>
                          <th className="p-2.5">ວັນທີຕ້ອງກວດ</th>
                          <th className="p-2.5 text-center">ສະຖານະ</th>
                          <th className="p-2.5">ຜູ້ຮັບຜິດຊອບ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-cyan-300/10">
                        {urgentPMAssets.length > 0 ? (
                          urgentPMAssets.map((asset, index) => {
                            const isOverdue = asset.maintenanceStatus === "ເກີນກຳນົດ";
                            return (
                              <tr key={index} className="transition hover:bg-cyan-300/5">
                                <td className="p-2.5">
                                  <div className="font-bold text-white">{asset.assetName}</div>
                                  <div className="text-[10px] font-mono text-slate-400">{asset.assetCode}</div>
                                </td>
                                <td className="p-2.5 font-medium text-slate-300">{asset.branch}</td>
                                <td className="p-2.5">
                                  <span className="rounded border border-cyan-300/10 bg-cyan-300/5 px-2 py-0.5 text-[10px] font-semibold text-cyan-200">
                                    {asset.systemCategory}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-400">{asset.maintenanceCycle}</td>
                                <td className="p-2.5 font-bold text-slate-200">{asset.nextMaintenanceDate}</td>
                                <td className="p-2.5 text-center">
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                    isOverdue ? 'bg-rose-400/10 text-rose-200 ring-1 ring-rose-300/30' : 'bg-amber-400/10 text-amber-200 ring-1 ring-amber-300/30'
                                  }`}>
                                    {asset.maintenanceStatus}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-300">{asset.responsiblePerson || 'ບໍ່ລະບຸ'}</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={7} className="text-center py-10 text-slate-400 text-xs font-semibold">
                              🎉 ດີຫຼາຍ! ບໍ່ມີລາຍການເກີນກຳນົດ ຫຼື ຕ້ອງການບຳລຸງຮັກສາຮີບດ່ວນໃນຂະນະນີ້
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Recent Completed Timeline (Right 1 col) */}
                <div className="space-y-4 rounded-2xl border border-cyan-300/15 bg-[#08182b]/90 p-5 shadow-lg">
                  <div className="border-b border-cyan-300/10 pb-3">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Award className="h-4.5 w-4.5 text-emerald-300" />
                      <span>ປະຫວັດການບຳລຸງຮັກສາຫຼ້າສຸດ</span>
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">ລາຍການທີ່ໄດ້ຮັບການກວດບຳລຸງຮັກສາແລ້ວ</p>
                  </div>

                  <div className="space-y-3 max-h-[22rem] overflow-y-auto pr-1">
                    {filteredPMHistory.length > 0 ? (
                      filteredPMHistory.slice(0, 10).map((record, index) => {
                        const isNormal = record.overallResult === "ປົກກະຕິ";
                        return (
                          <div key={index} className="space-y-1 rounded-xl border border-cyan-300/10 bg-slate-950/25 p-3 transition hover:bg-cyan-300/5">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-bold text-slate-300">{record.inspectionDate}</span>
                              <span className={`px-2 py-0.5 rounded font-black text-[9px] ${
                                isNormal ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'
                              }`}>
                                {record.overallResult}
                              </span>
                            </div>
                            <p className="text-xs font-bold leading-tight text-white">{record.assetName}</p>
                            <div className="flex items-center justify-between text-[9px] text-slate-400 font-medium">
                              <span>ສາຂາ: {record.branch}</span>
                              <span>ຜູ້ກວດ: {record.inspector}</span>
                            </div>
                            {record.issueDetails && (
                              <p className="mt-1 rounded border border-rose-300/15 bg-rose-400/5 p-1.5 text-[10px] text-rose-200">
                                <strong>ບັນຫາ:</strong> {record.issueDetails}
                              </p>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-16 text-slate-400 text-xs">
                        ບໍ່ມີປະຫວັດການກວດກາເທື່ອ
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()
      )}

      {/* dialog repair approval modal form */}
      {isApproveOpen && selectedIncident && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full flex flex-col overflow-hidden">
            <div className="bg-emerald-850 text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Hammer className="h-5 w-5 text-amber-400" />
                <h4 className="font-bold text-sm">ອະນຸມັດການສ້ອມແປງ: {selectedIncident.ລະຫັດກວດກາ || 'INT'}</h4>
              </div>
              <button onClick={() => { setIsApproveOpen(false); setSelectedIncident(null); }} className="text-white/85 hover:text-white hover:bg-white/10 rounded-full p-1">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveApproval} className="p-6 space-y-4 text-xs text-slate-700">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                <p className="font-bold text-slate-800 text-xs">ຊັບສິນ: {selectedIncident.ລາຍການ} ({selectedIncident.ລະຫັດຊັບສິນ})</p>
                <p className="text-slate-500 text-[11px]"><strong>ບັນຫາທີ່ແຈ້ງ:</strong> {selectedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ}</p>
                <p className="text-[11px] text-indigo-750 font-bold"><strong>ສາຂາ:</strong> {selectedIncident["ສາຂາ "]}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-650 mb-1">ຮູບແບບການດຳເນີນງານ</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setOperation('ຈ້າງພາຍນອກ')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center text-[11px] ${
                      operation === 'ຈ້າງພາຍນອກ' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-850 ring-2 ring-emerald-600/10 font-bold' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    ຈ້າງພາຍນອກ (Vendor)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperation('ສ້ອມແປງເອງ')}
                    className={`py-2 px-3 rounded-lg border font-semibold text-center text-[11px] ${
                      operation === 'ສ້ອມແປງເອງ' 
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-850 ring-2 ring-emerald-600/10 font-bold' 
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    ສ້ອມແປງເອງ (Internal)
                  </button>
                </div>
              </div>

              {operation === "ຈ້າງພາຍນອກ" && (
                <div>
                  <label className="block font-bold text-slate-650 mb-1">ຊື່ຜູ້ສະໜອງ / ຜູ້ຮັບຈ້າງ *</label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="ຕົວຢ່າງ: ບໍລິສັດ ຊີເນັດ, ຮ້ານໄອທີ ວຽງຈັນ..."
                    className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-650 mb-1">ຜູ້ອະນຸມັດ (Approval Signature)</label>
                <input
                  type="text"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  placeholder="ຊື່ ຫຼື ຕຳແໜ່ງຜູ້ອະນຸມັດ"
                  className="w-full border border-slate-300 rounded-lg p-2.5 bg-white font-medium focus:ring-2 focus:ring-emerald-500 outline-none"
                  required
                />
              </div>

              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsApproveOpen(false); setSelectedIncident(null); }}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg font-bold"
                >
                  ຍົກເລີກ
                </button>
                <button type="submit" className="px-4 py-2 bg-emerald-850 hover:bg-emerald-900 text-white rounded-lg font-bold">
                  ຢືນຢັນການອະນຸມັດ (Confirm)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
