/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  getSavedInspections, 
  saveInspections, 
  getSavedIncidents, 
  saveIncidents, 
  getSavedApprovals, 
  saveApprovals, 
  getSavedRepairs, 
  saveRepairs,
  getSavedUsers,
  saveUsers,
  getSavedBranches,
  saveBranches,
  getSavedChecklistItems,
  saveChecklistItems,
  getSavedSectors,
  saveSectors,
  cleanString,
  addDeletedPIDs,
  clearDeletedPIDs,
  getSavedRepairTracking,
  saveRepairTracking,
  getSavedAssessments,
  saveAssessments,
  getSavedPMAssets,
  getSavedPMHistory
} from './dataStore';
import {
  clearApiToken,
  getApiToken,
  getCentralCurrentUser,
  isCentralApiAvailable,
  logoutCentral,
} from './apiClient';
import {
  pullCentralData,
} from './centralDataStore';

import { 
  UserAccount, 
  InspectionRecord, 
  IncidentRecord, 
  RepairApprovalRecord, 
  RepairLogRecord,
  BranchInfo,
  ChecklistItem,
  SectorInfo,
  RepairTrackingRecord,
  RepairAssessmentRecord,
  PMAsset,
  PMHistoryRecord
} from './types';
import {
  planCascadeDelete,
  type CascadeDeleteCollections,
  type CascadeDeleteImpact,
  type CascadeDeleteSource,
} from './cascadeDelete';
import { resolveIncidentCaseReference } from './incidentCaseReference';

// Page Views
import LoginView from './components/LoginView';
import DashboardView from './components/DashboardView';
import InspectionsView from './components/InspectionsView';
import IncidentsView from './components/IncidentsView';
import PreventiveMaintenanceView from './components/PreventiveMaintenanceView';
import ApprovalsView from './components/ApprovalsView';
import RepairsView from './components/RepairsView';
import AccountsView from './components/AccountsView';
import RepairTrackingView from './components/RepairTrackingView';
import RepairAssessmentView from './components/RepairAssessmentView';

// Icons
import { 
  LayoutDashboard, CheckSquare, ShieldAlert, Hammer, Clock, 
  LogOut, ShieldCheck, Landmark, MapPin, Activity, HelpCircle,
  Users, Key, RefreshCw, ClipboardCheck, Type, FileText,
  ChevronDown, Menu, X, MoreHorizontal, Settings
} from 'lucide-react';

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

const getCleanedIncidents = (rawIncidents: IncidentRecord[], currentAssessments: RepairAssessmentRecord[]) => {
  return rawIncidents.map(inc => {
    const sStatus = inc.ສະຖານະ;
    const isAwaitingApproval = sStatus === "ປະເມີນແລ້ວ / ລໍຖ້າອະນຸມັດ" || sStatus === "ລໍຖ້າການອະນຸມັດ";
    if (isAwaitingApproval) {
      const asm = currentAssessments.find(a => a.incidentId === inc.PID);
      const hasDetails = asm && ((asm.subItems && asm.subItems.length > 0) || asm.assessmentStatus === "No Assessment Required");
      if (!hasDetails) {
        return { ...inc, ສະຖານະ: "ລໍຖ້າປະເມີນລາຍການສ້ອມ" };
      }
    }
    return inc;
  });
};

export default function App() {
  // Session State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    if (isCentralApiAvailable() && !getApiToken()) {
      localStorage.removeItem("ldb_current_user");
      return null;
    }
    const stored = localStorage.getItem("ldb_current_user");
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab ] = useState<"dashboard" | "inspections" | "pm" | "incidents" | "assessment" | "approvals" | "tracking" | "repairs" | "accounts" >("dashboard");
  const [pmKey, setPmKey] = useState(0);

  // Nav Dropdowns and Mobile Menu States
  const [activeDropdown, setActiveDropdown] = useState<"repairs" | "settings" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Databases States
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentRecord[]>([]);
  const [assessments, setAssessments] = useState<RepairAssessmentRecord[]>([]);
  const [approvals, setApprovals] = useState<RepairApprovalRecord[]>([]);
  const [repairTracking, setRepairTracking] = useState<RepairTrackingRecord[]>([]);
  const [repairs, setRepairs] = useState<RepairLogRecord[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [pmAssets, setPmAssets] = useState<PMAsset[]>([]);
  const [pmHistory, setPmHistory] = useState<PMHistoryRecord[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [sectors, setSectors] = useState<SectorInfo[]>([]);

  // Filter branches state (Dashboard only)
  const [selectedBranch, setSelectedBranch] = useState('ALL');

  // Automatic edit routing state
  const [autoEditInspectionCode, setAutoEditInspectionCode] = useState<string | null>(null);
  const [preSelectedIncidentPID, setPreSelectedIncidentPID] = useState<string | null>(null);

  // UI Scale control state (small, medium, large, xlarge)
  const [uiScale, setUiScale] = useState<"small" | "medium" | "large" | "xlarge">(() => {
    return (localStorage.getItem("ldb_ui_scale") as "small" | "medium" | "large" | "xlarge") || "medium";
  });

  useEffect(() => {
    localStorage.setItem("ldb_ui_scale", uiScale);
    const root = document.documentElement;
    if (uiScale === "small") {
      root.style.fontSize = "13px";
    } else if (uiScale === "large") {
      root.style.fontSize = "15px";
    } else if (uiScale === "xlarge") {
      root.style.fontSize = "16.5px";
    } else {
      root.style.fontSize = "14px"; // Default, beautifully proportioned baseline
    }
  }, [uiScale]);

  // Load from merged datastore on first mount or when user changes
  useEffect(() => {
    // 1. Fetch current session if exists
    const hydrateUserSession = (u: UserAccount | null) => {
      if (!u) {
        setCurrentUser(null);
        return;
      }
      let userMigrated = false;
      if (u.allowedTabs) {
        if (!u.allowedTabs.includes("tracking")) {
          userMigrated = true;
          const idx = u.allowedTabs.indexOf("repairs");
          const newTabs = [...u.allowedTabs];
          if (idx !== -1) {
            newTabs.splice(idx, 0, "tracking");
          } else {
            newTabs.push("tracking");
          }
          u.allowedTabs = newTabs;
        }
        if (!u.allowedTabs.includes("pm")) {
          userMigrated = true;
          const idx = u.allowedTabs.indexOf("inspections");
          const newTabs = [...u.allowedTabs];
          if (idx !== -1) {
            newTabs.splice(idx, 0, "pm");
          } else {
            const idxInc = u.allowedTabs.indexOf("incidents");
            if (idxInc !== -1) {
              newTabs.splice(idxInc, 0, "pm");
            } else {
              newTabs.push("pm");
            }
          }
          u.allowedTabs = newTabs;
        }
        if (!u.allowedTabs.includes("assessment")) {
          userMigrated = true;
          const idxInc = u.allowedTabs.indexOf("incidents");
          const newTabs = [...u.allowedTabs];
          if (idxInc !== -1) {
            newTabs.splice(idxInc + 1, 0, "assessment");
          } else {
            newTabs.push("assessment");
          }
          u.allowedTabs = newTabs;
        }
        
        // Ensure correct ordering where pm is placed before inspections
        const idxPm = u.allowedTabs.indexOf("pm");
        const idxIns = u.allowedTabs.indexOf("inspections");
        if (idxPm !== -1 && idxIns !== -1 && idxPm > idxIns) {
          userMigrated = true;
          const sortedTabs = [...u.allowedTabs];
          sortedTabs.splice(idxPm, 1);
          const newIdxIns = sortedTabs.indexOf("inspections");
          sortedTabs.splice(newIdxIns, 0, "pm");
          u.allowedTabs = sortedTabs;
        }
        if (userMigrated) {
          localStorage.setItem("ldb_current_user", JSON.stringify(u));
        }
      }
      setCurrentUser(u);
      if (u.status !== "Admin") {
        setSelectedBranch(u.branch || "");
      }
    };

    if (isCentralApiAvailable()) {
      if (!getApiToken()) {
        localStorage.removeItem("ldb_current_user");
        setCurrentUser(null);
      } else {
        void getCentralCurrentUser()
          .then((u) => {
            localStorage.setItem("ldb_current_user", JSON.stringify(u));
            hydrateUserSession(u);
          })
          .catch((error) => {
            console.error("Central session restore failed", error);
            localStorage.removeItem("ldb_current_user");
            clearApiToken();
            setCurrentUser(null);
          });
      }
    } else {
      const storedUser = localStorage.getItem("ldb_current_user");
      if (storedUser) {
      try {
        const u = JSON.parse(storedUser);
        hydrateUserSession(u);
      } catch (e) {
        console.error("Failed to parse user session", e);
      }
      }
    }

    // 2. Hydrate database lists with smart localStorage merge
    const loadedAssessments = getSavedAssessments();
    const loadedIncidents = getSavedIncidents();
    const cleanedIncidents = getCleanedIncidents(loadedIncidents, loadedAssessments);

    setInspections(getSavedInspections());
    setIncidents(cleanedIncidents);
    setAssessments(loadedAssessments);
    setApprovals(getSavedApprovals());
    setRepairTracking(getSavedRepairTracking());
    setRepairs(getSavedRepairs());
    setUsers(getSavedUsers());
    setBranches(getSavedBranches());
    setPmAssets(getSavedPMAssets());
    setPmHistory(getSavedPMHistory());
    setChecklistItems(getSavedChecklistItems());
    setSectors(getSavedSectors());

    if (JSON.stringify(loadedIncidents) !== JSON.stringify(cleanedIncidents)) {
      saveIncidents(cleanedIncidents);
    }
  }, []);

  // Auto refresh from the central D1 API, then hydrate the existing UI store.
  useEffect(() => {
    const refresh = async () => {
      try {
        await pullCentralData();
      } catch (error) {
        console.error("Central data refresh failed", error);
      }
      const currentAsm = getSavedAssessments();
      const rawInc = getSavedIncidents();
      const cleanedInc = getCleanedIncidents(rawInc, currentAsm);

      setInspections(getSavedInspections());
      setIncidents(cleanedInc);
      setAssessments(currentAsm);
      setApprovals(getSavedApprovals());
      setRepairTracking(getSavedRepairTracking());
      setRepairs(getSavedRepairs());
      setPmAssets(getSavedPMAssets());
      setPmHistory(getSavedPMHistory());
      setChecklistItems(getSavedChecklistItems());
      setSectors(getSavedSectors());
      setUsers(getSavedUsers());

      if (JSON.stringify(rawInc) !== JSON.stringify(cleanedInc)) {
        saveIncidents(cleanedInc);
      }
    };
    if (getApiToken()) void refresh();
    const interval = setInterval(() => void refresh(), 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefreshData = () => {
    const currentAsm = getSavedAssessments();
    const rawInc = getSavedIncidents();
    const cleanedInc = getCleanedIncidents(rawInc, currentAsm);

    setInspections(getSavedInspections());
    setIncidents(cleanedInc);
    setAssessments(currentAsm);
    setApprovals(getSavedApprovals());
    setRepairTracking(getSavedRepairTracking());
    setRepairs(getSavedRepairs());
    setPmAssets(getSavedPMAssets());
    setPmHistory(getSavedPMHistory());
    setChecklistItems(getSavedChecklistItems());
    setSectors(getSavedSectors());
    setUsers(getSavedUsers());

    if (JSON.stringify(rawInc) !== JSON.stringify(cleanedInc)) {
      saveIncidents(cleanedInc);
    }
  };

  const handleLoginSuccess = async (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem("ldb_current_user", JSON.stringify(user));
    setSelectedBranch(user.status !== "Admin" ? user.branch : "ALL");

    if (isCentralApiAvailable()) {
      try {
        await pullCentralData();
      } catch (error) {
        console.error("Initial D1-to-browser refresh failed", error);
      }
    }

    const freshUsers = getSavedUsers();
    const resolvedUser =
      freshUsers.find(u => u.username === user.username) || user;
    setUsers(freshUsers);
    setCurrentUser(resolvedUser);
    localStorage.setItem("ldb_current_user", JSON.stringify(resolvedUser));
    handleRefreshData();
  };

  const handleSaveUsers = (updatedUsers: UserAccount[]) => {
    setUsers(updatedUsers);
    saveUsers(updatedUsers);
  };

  const handleSaveBranches = (updatedBranches: BranchInfo[]) => {
    setBranches(updatedBranches);
    saveBranches(updatedBranches);
  };

  const handleSaveChecklistItems = (updatedItems: ChecklistItem[]) => {
    setChecklistItems(updatedItems);
    saveChecklistItems(updatedItems);
  };

  const handleSaveSectors = (updatedSectors: SectorInfo[]) => {
    setSectors(updatedSectors);
    saveSectors(updatedSectors);
  };

  const handleUpdateCurrentUser = (updatedUser: UserAccount) => {
    setCurrentUser(updatedUser);
    localStorage.setItem("ldb_current_user", JSON.stringify(updatedUser));
  };

  const handleLogout = () => {
    void logoutCentral();
    setCurrentUser(null);
    localStorage.removeItem("ldb_current_user");
    setActiveTab("dashboard");
  };

  // 1. Triggered on adding a safety inspection
  const handleAddInspection = (
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
  ) => {
    const updatedInsps = [newInsp as InspectionRecord, ...inspections];
    setInspections(updatedInsps);
    saveInspections(updatedInsps);

    // If inspection status was abnormal, automatically generate linked incident log too
    if (newIncident) {
      const incident: IncidentRecord = {
        PID: newInsp.PID,
        ລະຫັດກວດກາ: newInsp.ລະຫັດກວດກາ,
        ຮູບແບບການກວດ: newInsp.ຮູບແບບການກວດ,
        ລະບົບທີ່ກວດ: newInsp.ລະບົບທີ່ກວດ,
        ໝວດລະບົບກວດ: newInsp.ໝວດລະບົບກວດ,
        ລາຍການກວດ: newInsp.ລາຍການກວດ,
        ລະຫັດຊັບສິນ: newIncident.assetCode,
        ພາກສ່ວນຊັບສົມບັດ: newIncident.assetCategory,
        ໝວດລາຍການ: newIncident.assetGroup,
        ລາຍການ: newIncident.assetName,
        ລາຍລະອຽດປັນຫາທີ່ພົບ: newIncident.problem,
        ປະເມີນຜົນກະທົບ: newIncident.impact,
        ວີທີແກ້ໄຂ: newIncident.solution,
        ວັນທີ່ກວດ: newInsp.ວັນທີ່ກວດ,
        ເວລາກວດ: newInsp.ເວລາກວດ,
        ຜູ້ກວດກາ: newInsp.ຜູ້ກວດກາ,
        ຊື່ຜູ້ກວດ: newInsp.ຊື່ຜູ້ກວດ,
        "ສາຂາ ": newInsp["ສາຂາ "],
        "ຝ່າຍ/ໜ່ວຍບໍລິການ": newInsp["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
        ຂະແໜງ: newInsp.ຂະແໜງ,
        ຊັ້ນອາຄານ: newInsp.ຊັ້ນອາຄານ,
        ເດືອນ: newInsp.ເດືອນ,
        ປີ: newInsp.ປີ,
        order: 1,
        ຮັບອໍເດີ: 1,
        ຈຳນວນຄົງຄ້າງ: 1,
        ສະຖານະ: "ລໍຖ້າປະເມີນລາຍການສ້ອມ"
      };

      const updatedIncidents = [incident, ...incidents];
      setIncidents(updatedIncidents);
      saveIncidents(updatedIncidents);
    }
  };

  // 1.1 Update existing safety inspection records
  const handleUpdateInspection = (pid: string, updatedFields: Partial<InspectionRecord>, updatedLinkedIncidents?: Omit<IncidentRecord, "ລ/ດ">[]) => {
    const originalRecord = inspections.find(item => item.PID === pid);
    const updated = inspections.map(item => {
      if (item.PID === pid) {
        return { ...item, ...updatedFields };
      }
      return item;
    });
    setInspections(updated);
    saveInspections(updated);

    // Update associated incidents:
    let nextIncidents = [...incidents];
    if (updatedLinkedIncidents && originalRecord) {
      // Filter out original incidents that belong to this inspection code
      nextIncidents = nextIncidents.filter(inc => inc.ລະຫັດກວດກາ !== originalRecord.ລະຫັດກວດກາ);
      // Add the edited / updated ones to the list
      nextIncidents = [...(updatedLinkedIncidents as IncidentRecord[]), ...nextIncidents];
    } else {
      // Normal sync of fields if no updatedLinkedIncidents is passed
      nextIncidents = nextIncidents.map(inc => {
        if (originalRecord && inc.ລະຫັດກວດກາ === originalRecord.ລະຫັດກວດກາ) {
          return {
            ...inc,
            "ສາຂາ ": updatedFields["ສາຂາ "] !== undefined ? updatedFields["ສາຂາ "] : inc["ສາຂາ "],
            "ຝ່າຍ/ໜ່ວຍບໍລິການ": updatedFields["ຝ່າຍ/ໜ່ວຍບໍລິການ"] !== undefined ? updatedFields["ຝ່າຍ/ໜ່ວຍບໍລິການ"] : inc["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
            ຂະແໜງ: updatedFields.ຂະແໜງ !== undefined ? updatedFields.ຂະແໜງ : inc.ຂະແໜງ,
            ວັນທີ່ກວດ: updatedFields.ວັນທີ່ກວດ !== undefined ? updatedFields.ວັນທີ່ກວດ : inc.ວັນທີ່ກວດ,
            ເວລາກວດ: updatedFields.ເວລາກວດ !== undefined ? updatedFields.ເວລາກວດ : inc.ເວລາກວດ,
            ຊື່ຜູ້ກວດ: updatedFields.ຊື່ຜູ້ກວດ !== undefined ? updatedFields.ຊື່ຜູ້ກວດ : inc.ຊື່ຜູ້ກວດ,
            ຜູ້ກວດກາ: updatedFields.ຜູ້ກວດກາ !== undefined ? updatedFields.ຜູ້ກວດກາ : inc.ຜູ້ກວດກາ,
            ລະບົບທີ່ກວດ: updatedFields.ລະບົບທີ່ກວດ !== undefined ? updatedFields.ລະບົບທີ່ກວດ : inc.ລະບົບທີ່ກວດ,
            ໝວດລະບົບກວດ: updatedFields.ໝວດລະບົບກວດ !== undefined ? updatedFields.ໝວດລະບົບກວດ : inc.ໝວດລະບົບກວດ,
            ຮູບແບບການກວດ: updatedFields.ຮູບແບບການກວດ !== undefined ? updatedFields.ຮູບແບບການກວດ : inc.ຮູບແບບການກວດ,
            ຊັ້ນອາຄານ: updatedFields.ຊັ້ນອາຄານ !== undefined ? updatedFields.ຊັ້ນອາຄານ : inc.ຊັ້ນອາຄານ,
            ເດືອນ: updatedFields.ເດືອນ !== undefined ? updatedFields.ເດືອນ : inc.ເດືອນ,
            ປີ: updatedFields.ປີ !== undefined ? updatedFields.ປີ : inc.ປີ
          };
        }
        return inc;
      });
    }
    setIncidents(nextIncidents);
    saveIncidents(nextIncidents);
  };

  // 1.2 Handlers for Repair Assessment
  const handleAddAssessment = (newAsm: RepairAssessmentRecord) => {
    const updated = [newAsm, ...assessments];
    setAssessments(updated);
    saveAssessments(updated);
  };

  const handleUpdateAssessment = (pid: string, updatedAsm: Partial<RepairAssessmentRecord>) => {
    const updated = assessments.map(item => {
      if (item.PID === pid) {
        return { ...item, ...updatedAsm };
      }
      return item;
    });
    setAssessments(updated);
    saveAssessments(updated);
  };

  const handleUpdateIncidentStatus = (pid: string, newStatus: string) => {
    const updated = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: newStatus };
      }
      return item;
    });
    setIncidents(updated);
    saveIncidents(updated);
  };

  // 3. Manager Repair Approval
  const handleApproveIncident = (pid: string, approvalData: {
    operation: string;
    vendor: string;
    approvedBy: string;
    approvalDate?: string;
    approvalDoc?: string;
  }) => {
    try {
      // A. Set status in Incidents to "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ"
      const updatedIncidents = incidents.map(item => {
        if (item.PID === pid) {
          return { ...item, ສະຖານະ: "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ" };
        }
        return item;
      });
      setIncidents(updatedIncidents);
      saveIncidents(updatedIncidents);

      // B. Create a matching record in the Repair Approvals list
      const linkedIncident = incidents.find(item => item.PID === pid);
      if (linkedIncident) {
        const caseReference = resolveIncidentCaseReference(
          linkedIncident,
          inspections,
          checklistItems,
        );
        const today = new Date();
        const selectedDate = approvalData.approvalDate || today.toISOString().split('T')[0];
        const parsedDate = new Date(selectedDate);
        const newApproval: RepairApprovalRecord = {
          PID: pid,
          ລະຫັດກວດກາ: linkedIncident.ລະຫັດກວດກາ || "",
          ລະບົບທີ່ກວດ: caseReference.systemCategory,
          ໝວດລະບົບກວດ: caseReference.areaPoint,
          ລາຍການກວດ: linkedIncident.ລາຍການກວດ || "",
          ລະຫັດຊັບສິນ: linkedIncident.ລະຫັດຊັບສິນ || "",
          ພາກສ່ວນຊັບສົມບັດ: linkedIncident.ພາກສ່ວນຊັບສົມບັດ || "",
          ໝວດລາຍການ: linkedIncident.ໝວດລາຍການ || "",
          ລາຍການ: linkedIncident.ລາຍການ || "",
          ລາຍລະອຽດປັນຫາທີ່ພົບ: linkedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ || "",
          ປະເມີນຜົນກະທົບ: linkedIncident.ປະເມີນຜົນກະທົບ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ວີທີແກ້ໄຂ: linkedIncident.ວີທີແກ້ໄຂ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ວັນທີ່ກວດ: linkedIncident.ວັນທີ່ກວດ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ເວລາກວດ: linkedIncident.ເວລາກວດ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ຜູ້ກວດກາ: linkedIncident.ຜູ້ກວດກາ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ຊື່ຜູ້ກວດ: linkedIncident.ຊື່ຜູ້ກວດ || "",
          "ສາຂາ ": caseReference.branch,
          "ຝ່າຍ/ໜ່ວຍບໍລິການ": caseReference.division,
          ຂະແໜງ: caseReference.sector,
          ສາຂາຊັບສິນ: (linkedIncident as any).ສາຂາຊັບສິນ || "",
          ຝ່າຍຊັບສິນ: (linkedIncident as any).ຝ່າຍຊັບສິນ || "",
          ຂະແໜງຊັບສິນ: (linkedIncident as any).ຂະແໜງຊັບສິນ || "",
          ຊັ້ນອາຄານ: caseReference.floor,
          ການດຳເນີນງານ: approvalData.operation || "",
          "vendor ຜູ້ສະໜອງ": approvalData.vendor || "",
          ວັນທີ່ອະນຸມັດ: selectedDate,
          ...isNaN(parsedDate.getFullYear()) ? { ປີ: today.getFullYear() } : { ປີ: parsedDate.getFullYear() },
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ເດືອນ: isNaN(parsedDate.getMonth()) ? today.getMonth() + 1 : parsedDate.getMonth() + 1,
          ຜູ້ອະນຸມັດ: approvalData.approvedBy || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ເອກະສານອະນຸມັດ: approvalData.approvalDoc || "",
          order: 1,
          "ຮັບອໍເດີ": 0,
          ຈຳນວນຄົງຄ້າງ: 1,
          ສະຖານະ: "ລໍຖ້າສ້ອມແປງ"
        };

        // Rule 7 Upsert Approvals
        const existsApprovalIdx = approvals.findIndex(app => app.PID === pid);
        let updatedApprovals;
        if (existsApprovalIdx !== -1) {
          updatedApprovals = [...approvals];
          updatedApprovals[existsApprovalIdx] = {
            ...updatedApprovals[existsApprovalIdx],
            ...newApproval,
            ສະຖານະ: updatedApprovals[existsApprovalIdx].ສະຖານະ || "ລໍຖ້າສ້ອມແປງ"
          };
        } else {
          updatedApprovals = [newApproval, ...approvals];
        }
        setApprovals(updatedApprovals);
        saveApprovals(updatedApprovals);

        // C. Create matching RepairTrackingRecord automatically
        const newTracking: RepairTrackingRecord = {
          PID: pid,
          ລະຫັດກວດກາ: linkedIncident.ລະຫັດກວດກາ || "",
          "ສາຂາ ": caseReference.branch,
          "ຝ່າຍ/ໜ່ວຍບໍລິການ": caseReference.division,
          ຂະແໜງ: caseReference.sector,
          ຮູບແບບການກວດ: caseReference.inspectionType || "ກວດກາອາຄານ",
          ລະບົບທີ່ກວດ: caseReference.systemCategory,
          ໝວດລະບົບກວດ: caseReference.areaPoint,
          ລະຫັດຊັບສິນ: linkedIncident.ລະຫັດຊັບສິນ || "",
          ລາຍການ: linkedIncident.ລາຍການ || "",
          ພາກສ່ວນຊັບສົມບັດ: linkedIncident.ພາກສ່ວນຊັບສົມບັດ || "",
          ໝວດລາຍການ: linkedIncident.ໝວດລາຍການ || "",
          ສາຂາຊັບສິນ: (linkedIncident as any).ສາຂາຊັບສິນ || "",
          ຝ່າຍຊັບສິນ: (linkedIncident as any).ຝ່າຍຊັບສິນ || "",
          ຂະແໜງຊັບສິນ: (linkedIncident as any).ຂະແໜງຊັບສິນ || "",
          ລາຍລະອຽດປັນຫາທີ່ພົບ: linkedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ປະເມີນຜົນກະທົບ: linkedIncident.ປະເມີນຜົນກະທົບ || "ຕ່ຳ",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ວີທີແກ້ໄຂ: linkedIncident.ວີທີແກ້ໄຂ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ວັນທີ່ກວດ: linkedIncident.ວັນທີ່ກວດ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ເວລາກວດ: linkedIncident.ເວລາກວດ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ຜູ້ກວດກາ: linkedIncident.ຜູ້ກວດກາ || "",
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          ຊື່ຜູ້ກວດ: linkedIncident.ຊື່ຜູ້ກວດ || "",
          ສະຖານະ: "ອະນຸມັດແລ້ວ / ລໍຖ້າເລີ່ມສ້ອມ",
          // tracking workflow specific:
          ວັນທີ່ອະນຸມັດ: selectedDate,
          ຜູ້ອະນຸມັດ: approvalData.approvedBy || "",
          owner: "ພະນັກງານ ທພລ",
          vendor: approvalData.vendor || "ບໍລິສັດ ຮັບເໝົາ",
          execution: approvalData.operation || "ຈ້າງພາຍນອກ",
          startRepairDate: "",
          expectedFinishDate: "",
          actualFinishDate: "",
          progressPercent: 0,
          trackingStatus: "ລໍຖ້າເລີ່ມສ້ອມ",
          slaStatus: "ຢູ່ໃນກຳນົດ"
        };

        // Rule 8 Upsert Tracking
        const existsTrackingIdx = repairTracking.findIndex(track => track.PID === pid || track.incidentId === pid);
        let updatedTracking;
        if (existsTrackingIdx !== -1) {
          updatedTracking = [...repairTracking];
          const currentProgress = updatedTracking[existsTrackingIdx].progressPercent;
          const currentTrackingStatus = updatedTracking[existsTrackingIdx].trackingStatus;
          const currentStartRepairDate = updatedTracking[existsTrackingIdx].startRepairDate;
          const currentExpectedFinishDate = updatedTracking[existsTrackingIdx].expectedFinishDate;
          const currentActualFinishDate = updatedTracking[existsTrackingIdx].actualFinishDate;
          const currentSlaStatus = updatedTracking[existsTrackingIdx].slaStatus;

          updatedTracking[existsTrackingIdx] = {
            ...updatedTracking[existsTrackingIdx],
            ...newTracking,
            progressPercent: currentProgress !== undefined ? currentProgress : newTracking.progressPercent,
            trackingStatus: currentTrackingStatus || newTracking.trackingStatus,
            startRepairDate: currentStartRepairDate || newTracking.startRepairDate,
            expectedFinishDate: currentExpectedFinishDate || newTracking.expectedFinishDate,
            actualFinishDate: currentActualFinishDate || newTracking.actualFinishDate,
            slaStatus: currentSlaStatus || newTracking.slaStatus,
            ສະຖານະ: currentTrackingStatus ? `ຢູ່ລະຫວ່າງສ້ອມ (${currentTrackingStatus})` : newTracking.ສະຖານະ
          };
        } else {
          updatedTracking = [newTracking, ...repairTracking];
        }
        setRepairTracking(updatedTracking);
        saveRepairTracking(updatedTracking);
      }
    } catch (err) {
      console.error("Critical error in handleApproveIncident:", err);
    }
  };

  // 3.1 Cancel Repair / Do not approve repair logic
  const handleCancelIncident = (pid: string, cancelReason: string) => {
    try {
      // A. Set status in Incidents to "Cancelled"
      const updatedIncidents = incidents.map(item => {
        if (item.PID === pid) {
          return { ...item, ສະຖານະ: "Cancelled" };
        }
        return item;
      });
      setIncidents(updatedIncidents);
      saveIncidents(updatedIncidents);

      // B. Create a matching record in the Repair Log as Cancelled
      const linkedIncident = incidents.find(item => item.PID === pid);
      if (linkedIncident) {
        const caseReference = resolveIncidentCaseReference(
          linkedIncident,
          inspections,
          checklistItems,
        );
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        
        const newRepairLog: RepairLogRecord = {
          PID: pid,
          ລະຫັດກວດກາ: linkedIncident.ລະຫັດກວດກາ || "",
          ລະບົບທີ່ກວດ: caseReference.systemCategory,
          ໝວດລະບົບກວດ: caseReference.areaPoint,
          ລາຍການກວດ: linkedIncident.ລາຍການກວດ || "ກວດສອບຊັບສິນ",
          ລະຫັດຊັບສິນ: linkedIncident.ລະຫັດຊັບສິນ || "none",
          ພາກສ່ວນຊັບສົມບັດ: linkedIncident.ພາກສ່ວນຊັບສົມບັດ || "",
          ໝວດລາຍການ: linkedIncident.ໝວດລາຍການ || "",
          ລາຍການ: linkedIncident.ລາຍການ || "",
          ລາຍລະອຽດປັນຫາທີ່ພົບ: linkedIncident.ລາຍລະອຽດປັນຫາທີ່ພົບ || "",
          ປະເມີນຜົນກະທົບ: linkedIncident.ປະເມີນຜົນກະທົບ || "",
          ວີທີແກ້ໄຂ: linkedIncident.ວີທີແກ້ໄຂ || "",
          ວັນທີ່ກວດ: linkedIncident.ວັນທີ່ກວດ || "",
          ເວລາກວດ: linkedIncident.ເວລາກວດ || "",
          ຜູ້ກວດກາ: linkedIncident.ຜູ້ກວດກາ || "",
          ຊື່ຜູ້ກວດ: linkedIncident.ຊື່ຜູ້ກວດ || "",
          "ສາຂາ ": caseReference.branch,
          "ຝ່າຍ/ໜ່ວຍບໍລິການ": caseReference.division,
          ຂະແໜງ: caseReference.sector,
          ສາຂາຊັບສິນ: (linkedIncident as any).ສາຂາຊັບສິນ || "",
          ຝ່າຍຊັບສິນ: (linkedIncident as any).ຝ່າຍຊັບສິນ || "",
          ຂະແໜງຊັບສິນ: (linkedIncident as any).ຂະແໜງຊັບສິນ || "",
          ຊັ້ນອາຄານ: caseReference.floor,
          ການດຳເນີນການ: "ບໍ່ອະນຸມັດສ້ອມ",
          "vendor ຜູ້ສະໜອງ": "—",
          ວັນທີ່ສ້ອມແປງ: today.toISOString().split('T')[0],
          ຜົນການແກ້ໄຂ: `ຍົກເລີກ/ບໍ່ອະນຸມັດ (Cancelled): ${cancelReason}`,
          ຜົນທົດສອບ: "ບໍ່ໄດ້ດຳເນີນການ",
          ມູນຄ່າສ້ອມແປງ: 0,
          ວັນທີ່ສຳເລັດ: today.toISOString().split('T')[0],
          ລວມມື້ທີ່ສຳເລັດ: 0,
          ເດືອນ: currentMonth,
          ປີ: currentYear,
          order: 1,
          ສະຖານະ: "Cancelled"
        };

        const updatedRepairs = [newRepairLog, ...repairs];
        setRepairs(updatedRepairs);
        saveRepairs(updatedRepairs);
      }
    } catch (err) {
      console.error("Critical error in handleCancelIncident:", err);
    }
  };



  // 4. Record Repair Completed / Log Outcome
  const handleCompleteRepair = (pid: string, repairData: {
    repairDate: string;
    result: string;
    testDetails: string;
    cost: number;
  }) => {
    // A. Update Approval record to Completed
    const updatedApprovals = approvals.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: "ສຳເລັດ" };
      }
      return item;
    });
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    // B. Close Incident record to Completed
    const updatedIncidents = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: "ສຳເລັດ" };
      }
      return item;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);

    // C. Add to Repairs Log / Spends Archive list
    const approvalItem = approvals.find(item => item.PID === pid) || approvals.find(item => item.PID === pid);
    if (approvalItem) {
      const today = new Date();
      
      // Calculate repair days
      const reportDateStr = cleanString(approvalItem.ວັນທີ່ກວດ);
      let diffDays = 4; // default offset
      if (reportDateStr.includes("-") || reportDateStr.includes("/")) {
        const repD = new Date(reportDateStr);
        const compD = new Date(repairData.repairDate);
        if (!isNaN(repD.getTime()) && !isNaN(compD.getTime())) {
          const diffTime = compD.getTime() - repD.getTime();
          diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        }
      }

      const newRepairLog: RepairLogRecord = {
        PID: pid,
        ລະຫັດກວດກາ: approvalItem.ລະຫັດກວດກາ,
        ລະບົບທີ່ກວດ: approvalItem.ລະບົບທີ່ກວດ,
        ໝວດລະບົບກວດ: approvalItem.ໝວດລະບົບກວດ,
        ລາຍການກວດ: approvalItem.ລາຍການກວດ,
        ລະຫັດຊັບສິນ: approvalItem.ລະຫັດຊັບສິນ,
        ພາກສ່ວນຊັບສົມບັດ: approvalItem.ພາກສ່ວນຊັບສົມບັດ,
        ໝວດລາຍການ: approvalItem.ໝວດລາຍການ,
        ລາຍການ: approvalItem.ລາຍການ,
        ລາຍລະອຽດປັນຫາທີ່ພົບ: approvalItem.ລາຍລະອຽດປັນຫາທີ່ພົບ,
        ປະເມີນຜົນກະທົບ: approvalItem.ປະເມີນຜົນກະທົບ,
        ວີທີແກ້ໄຂ: approvalItem.ວີທີແກ້ໄຂ,
        ວັນທີ່ກວດ: approvalItem.ວັນທີ່ກວດ,
        ເວລາກວດ: approvalItem.ເວລາກວດ,
        ຜູ້ກວດກາ: approvalItem.ຜູ້ກວດກາ,
        ຊື່ຜູ້ກວດ: approvalItem.ຊື່ຜູ້ກວດ,
        "ສາຂາ ": approvalItem["ສາຂາ "],
        "ຝ່າຍ/ໜ່ວຍບໍລິການ": approvalItem["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
        ຂະແໜງ: approvalItem.ຂະແໜງ,
        ສາຂາຊັບສິນ: approvalItem.ສາຂາຊັບສິນ,
        ຝ່າຍຊັບສິນ: approvalItem.ຝ່າຍຊັບສິນ,
        ຂະແໜງຊັບສິນ: approvalItem.ຂະແໜງຊັບສິນ,
        ຊັ້ນອາຄານ: approvalItem.ຊັ້ນອາຄານ,
        ການດຳເນີນການ: approvalItem.ການດຳເນີນງານ,
        "vendor ຜູ້ສະໜອງ": approvalItem["vendor ຜູ້ສະໜອງ"],
        ວັນທີ່ສ້ອມແປງ: repairData.repairDate,
        ຜົນການແກ້ໄຂ: repairData.result,
        ຜົນທົດສອບ: repairData.testDetails,
        ມູນຄ່າສ້ອມແປງ: repairData.cost,
        ວັນທີ່ສຳເລັດ: repairData.repairDate,
        ລວມມື້ທີ່ສຳເລັດ: diffDays,
        ເດືອນ: today.getMonth() + 1,
        ປີ: today.getFullYear(),
        order: 1,
        ສະຖານະ: "ສຳເລັດ"
      };

      const updatedRepairs = [newRepairLog, ...repairs];
      setRepairs(updatedRepairs);
      saveRepairs(updatedRepairs);
    }
  };

  // --- REPAIR TRACKING WORKFLOW EVENT HANDLERS ---
  const handleStartRepair = (pid: string, startDate: string, expectedFinishDate: string) => {
    const updatedTracking = repairTracking.map(item => {
      if (item.PID === pid) {
        return {
          ...item,
          startRepairDate: startDate,
          expectedFinishDate: expectedFinishDate,
          trackingStatus: "ກຳລັງດຳເນີນການ",
          progressPercent: 10,
          slaStatus: "ຢູ່ໃນກຳນົດ"
        };
      }
      return item;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);

    const updatedIncidents = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: "ກຳລັງສ້ອມແປງ" };
      }
      return item;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);
  };

  const handleUpdateProgress = (pid: string, progress: number, remark: string, duringPhoto?: string, delayReason?: string) => {
    const updatedTracking = repairTracking.map(item => {
      if (item.PID === pid) {
        const nextStatus = progress < 100 ? "ກຳລັງດຳເນີນການ" : item.trackingStatus;
        return {
          ...item,
          progressPercent: progress,
          progressRemark: remark,
          ...(duringPhoto ? { duringPhoto } : {}),
          ...(delayReason !== undefined ? { delayReason } : {}),
          trackingStatus: nextStatus
        };
      }
      return item;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);
  };

  const handleWaitingStatus = (pid: string, status: "ລໍຖ້າອະໄຫຼ່" | "ລໍຖ້າ Vendor", delayReason: string, remark: string) => {
    const updatedTracking = repairTracking.map(item => {
      if (item.PID === pid) {
        return {
          ...item,
          trackingStatus: status,
          delayReason,
          progressRemark: remark
        };
      }
      return item;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);

    const updatedIncidents = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: status };
      }
      return item;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);
  };

  const handlePauseRepair = (pid: string, reason: string) => {
    const updatedTracking = repairTracking.map(item => {
      if (item.PID === pid) {
        return {
          ...item,
          trackingStatus: "ຢຸດຊົ່ວຄາວ",
          delayReason: reason
        };
      }
      return item;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);

    const updatedIncidents = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: "ຢຸດຊົ່ວຄາວ" };
      }
      return item;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);
  };

  const handleResumeRepair = (pid: string) => {
    const updatedTracking = repairTracking.map(item => {
      if (item.PID === pid) {
        return {
          ...item,
          trackingStatus: "ກຳລັງດຳເນີນການ"
        };
      }
      return item;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);

    const updatedIncidents = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: "ກຳລັງສ້ອມແປງ" };
      }
      return item;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);
  };

  const handleCompleteRepairTracking = (pid: string, actualFinishDate: string, repairResult: string, testResult: string, cost: number, afterPhoto?: string) => {
    const updatedTracking = repairTracking.map(item => {
      if (item.PID === pid) {
        return {
          ...item,
          trackingStatus: "ສ້ອມສຳເລັດ",
          progressPercent: 100,
          actualFinishDate,
          repairResult,
          testResult,
          repairCost: cost,
          ...(afterPhoto ? { afterPhoto } : {}),
          slaStatus: "ສຳເລັດແລ້ວ"
        };
      }
      return item;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);

    const updatedIncidents = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ສະຖານະ: "ສ້ອມສຳເລັດ (ລໍຖ້າປິດງານ)" };
      }
      return item;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);
  };

  const handleCloseJob = (pid: string) => {
    const item = repairTracking.find(it => it.PID === pid);
    if (!item) return;

    const updatedTracking = repairTracking.map(it => {
      if (it.PID === pid) {
        return {
          ...it,
          trackingStatus: "ປິດງານແລ້ວ",
          closedAt: new Date().toISOString().split('T')[0]
        };
      }
      return it;
    });
    setRepairTracking(updatedTracking);
    saveRepairTracking(updatedTracking);

    const updatedApprovals = approvals.map(app => {
      if (app.PID === pid) {
        return { ...app, ສະຖານະ: "ສຳເລັດ" };
      }
      return app;
    });
    setApprovals(updatedApprovals);
    saveApprovals(updatedApprovals);

    const updatedIncidents = incidents.map(inc => {
      if (inc.PID === pid) {
        return { ...inc, ສະຖານະ: "ສຳເລັດ" };
      }
      return inc;
    });
    setIncidents(updatedIncidents);
    saveIncidents(updatedIncidents);

    const reportDateStr = cleanString(item.ວັນທີ່ກວດ);
    let diffDays = 4;
    if (reportDateStr.includes("-") || reportDateStr.includes("/")) {
      const repD = new Date(reportDateStr);
      const compD = new Date(item.actualFinishDate || new Date().toISOString().split('T')[0]);
      if (!isNaN(repD.getTime()) && !isNaN(compD.getTime())) {
        const diffTime = compD.getTime() - repD.getTime();
        diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      }
    }

    const newRepairLog: RepairLogRecord = {
      PID: item.PID,
      ລະຫັດກວດກາ: item.ລະຫັດກວດກາ,
      ລະບົບທີ່ກວດ: item.ລະບົບທີ່ກວດ,
      ໝວດລະບົບກວດ: item.ໝວດລະບົບກວດ,
      ລາຍການກວດ: item.ລາຍການກວດ || "ກວດສອບຊັບສິນ",
      ລະຫັດຊັບສິນ: item.ລະຫັດຊັບສິນ,
      ພາກສ່ວນຊັບສົມບັດ: item.ພາກສ່ວນຊັບສົມບັດ || "",
      ໝວດລາຍການ: item.ໝວດລາຍການ || "",
      ລາຍການ: item.ລາຍການ,
      ລາຍລະອຽດປັນຫາທີ່ພົບ: item.ລາຍລະອຽດປັນຫາທີ່ພົບ,
      ປະເມີນຜົນກະທົບ: item.ປະເມີນຜົນກະທົບ,
      ວີທີແກ້ໄຂ: item.ວີທີແກ້ໄຂ,
      ວັນທີ່ກວດ: item.ວັນທີ່ກວດ,
      ເວລາກວດ: item.ເວລາກວດ,
      ຜູ້ກວດກາ: item.ຜູ້ກວດກາ,
      ຊື່ຜູ້ກວດ: item.ຊື່ຜູ້ກວດ || "",
      "ສາຂາ ": item["ສາຂາ "],
      "ຝ່າຍ/ໜ່ວຍບໍລິການ": item["ຝ່າຍ/ໜ່ວຍບໍລິການ"],
      ຂະແໜງ: item.ຂະແໜງ,
      ສາຂາຊັບສິນ: item.ສາຂາຊັບສິນ,
      ຝ່າຍຊັບສິນ: item.ຝ່າຍຊັບສິນ,
      ຂະແໜງຊັບສິນ: item.ຂະແໜງຊັບສິນ || "",
      ຊັ້ນອາຄານ: 1,
      ການດຳເນີນການ: item.execution || "ຈ້າງພາຍນອກ",
      "vendor ຜູ້ສະໜອງ": item.vendor || "ບໍລິສັດ ຮັບເໝົາ",
      ວັນທີ່ສ້ອມແປງ: item.actualFinishDate || new Date().toISOString().split('T')[0],
      ຜົນການແກ້ໄຂ: item.repairResult || "ສ້ອມແປງສຳເລັດ",
      ຜົນທົດສອບ: item.testResult || "ຜ່ານການທົດສອບ",
      ຮູບພາຍຫຼັງການແກ້ໄຂ: item.afterPhoto || "",
      ມູນຄ່າສ້ອມແປງ: item.repairCost || 0,
      ວັນທີ່ສຳເລັດ: item.actualFinishDate || new Date().toISOString().split('T')[0],
      ລວມມື້ທີ່ສຳເລັດ: diffDays,
      ເດືອນ: new Date().getMonth() + 1,
      ປີ: new Date().getFullYear(),
      order: 1,
      ສະຖານະ: "ສຳເລັດ"
    };

    const updatedRepairs = [newRepairLog, ...repairs];
    setRepairs(updatedRepairs);
    saveRepairs(updatedRepairs);
  };

  const getCascadeCollections = (): CascadeDeleteCollections => ({
    inspections,
    incidents,
    assessments,
    approvals,
    repairTracking,
    repairs,
  });

  const getDeleteImpact = (
    source: CascadeDeleteSource,
    pids: string[],
  ): CascadeDeleteImpact => planCascadeDelete(getCascadeCollections(), source, pids).impact;

  const executeCascadeDelete = (source: CascadeDeleteSource, pids: string[]) => {
    const plan = planCascadeDelete(getCascadeCollections(), source, pids);
    if (plan.impact.totalRecords === 0) return;

    addDeletedPIDs(plan.deletedPids);

    saveInspections(plan.remaining.inspections);
    saveIncidents(plan.remaining.incidents);
    saveAssessments(plan.remaining.assessments);
    saveApprovals(plan.remaining.approvals);
    saveRepairTracking(plan.remaining.repairTracking);
    saveRepairs(plan.remaining.repairs);

    setInspections(plan.remaining.inspections);
    setIncidents(plan.remaining.incidents);
    setAssessments(plan.remaining.assessments);
    setApprovals(plan.remaining.approvals);
    setRepairTracking(plan.remaining.repairTracking);
    setRepairs(plan.remaining.repairs);
  };

  const handleDeleteInspections = (pids: string[]) =>
    executeCascadeDelete('inspection', pids);

  const handleAddIncident = (newInc: Omit<IncidentRecord, "ລ/ດ"> | Omit<IncidentRecord, "ລ/ດ">[]) => {
    let updated: IncidentRecord[];
    if (Array.isArray(newInc)) {
      updated = [...(newInc as IncidentRecord[]), ...incidents];
    } else {
      updated = [newInc as IncidentRecord, ...incidents];
    }
    setIncidents(updated);
    saveIncidents(updated);
  };

  const handleUpdateIncident = (pid: string, updatedFields: Partial<IncidentRecord>) => {
    const updated = incidents.map(item => {
      if (item.PID === pid) {
        return { ...item, ...updatedFields };
      }
      return item;
    });
    setIncidents(updated);
    saveIncidents(updated);
  };

  const handleDeleteIncidents = (pids: string[]) =>
    executeCascadeDelete('incident', pids);

  const handleDeleteApprovals = (pids: string[]) => {
    addDeletedPIDs(pids);
    const deletedApprovalsList = approvals.filter(item => pids.includes(item.PID));
    const deletedCodes = deletedApprovalsList.map(item => item.ລະຫັດກວດກາ).filter(Boolean);

    const updated = approvals.filter(item => !pids.includes(item.PID));
    setApprovals(updated);
    saveApprovals(updated);

    const shouldDelete = (item: any) => {
      if (!item) return false;
      if (pids.includes(item.PID)) return true;
      if (pids.some(pid => item.PID && (item.PID === pid || item.PID.startsWith(`${pid}-`)))) return true;
      if (item.ລະຫັດກວດກາ && deletedCodes.includes(item.ລະຫັດກວດກາ)) return true;
      return false;
    };

    // Cascade delete any corresponding Maintenance Archives records
    const updatedRepairs = repairs.filter(item => !shouldDelete(item));
    setRepairs(updatedRepairs);
    saveRepairs(updatedRepairs);
  };

  const handleDeleteRepairs = (pids: string[]) => {
    addDeletedPIDs(pids);
    const updated = repairs.filter(item => !pids.includes(item.PID));
    setRepairs(updated);
    saveRepairs(updated);
  };

  const handleClearAllData = (type: "all" | "inspections" | "incidents" | "approvals" | "repairs") => {
    if (type === "all") {
      const allPids = [
        ...inspections.map(i => i.PID),
        ...incidents.map(i => i.PID),
        ...assessments.map(i => i.PID),
        ...approvals.map(i => i.PID),
        ...repairTracking.map(i => i.PID),
        ...repairs.map(i => i.PID)
      ];
      addDeletedPIDs(allPids);
      setInspections([]);
      saveInspections([]);
      setIncidents([]);
      saveIncidents([]);
      setAssessments([]);
      saveAssessments([]);
      setApprovals([]);
      saveApprovals([]);
      setRepairTracking([]);
      saveRepairTracking([]);
      setRepairs([]);
      saveRepairs([]);

      // Reset Preventive Maintenance history and assets to 100% clean/default states
      localStorage.setItem("ldb_base_data_cleared", "true");
      localStorage.removeItem("ldb_pm_assets");
      localStorage.removeItem("ldb_pm_history");
      setPmKey(prev => prev + 1);

      // Reset deleted PIDs tracker for a completely clean slate
      clearDeletedPIDs();
    } else if (type === "inspections") {
      const pids = inspections.map(i => i.PID);
      addDeletedPIDs(pids);
      const deletedCodes = inspections.map(item => item.ລະຫັດກວດກາ).filter(Boolean);

      setInspections([]);
      saveInspections([]);

      const shouldDelete = (item: any) => {
        if (!item) return false;
        if (pids.includes(item.PID)) return true;
        if (pids.some(pid => item.PID && (item.PID === pid || item.PID.startsWith(`${pid}-`)))) return true;
        if (item.ລະຫັດກວດກາ && deletedCodes.includes(item.ລະຫັດກວດກາ)) return true;
        if (item.incidentId && pids.includes(item.incidentId)) return true;
        if (item.inspectionId && deletedCodes.includes(item.inspectionId)) return true;
        return false;
      };

      // Cascade delete any corresponding Incident Register, Repair Assessments, Repair Approvals, Repair Tracking, and Maintenance Archives records
      const updatedIncidents = incidents.filter(item => !shouldDelete(item));
      setIncidents(updatedIncidents);
      saveIncidents(updatedIncidents);

      const updatedAssessments = assessments.filter(item => !shouldDelete(item));
      setAssessments(updatedAssessments);
      saveAssessments(updatedAssessments);

      const updatedApprovals = approvals.filter(item => !shouldDelete(item));
      setApprovals(updatedApprovals);
      saveApprovals(updatedApprovals);

      const updatedTracking = repairTracking.filter(item => !shouldDelete(item));
      setRepairTracking(updatedTracking);
      saveRepairTracking(updatedTracking);

      const updatedRepairs = repairs.filter(item => !shouldDelete(item));
      setRepairs(updatedRepairs);
      saveRepairs(updatedRepairs);
    } else if (type === "incidents") {
      const pids = incidents.map(i => i.PID);
      addDeletedPIDs(pids);
      const deletedCodes = incidents.map(item => item.ລະຫັດກວດກາ).filter(Boolean);

      setIncidents([]);
      saveIncidents([]);

      const shouldDelete = (item: any) => {
        if (!item) return false;
        if (pids.includes(item.PID)) return true;
        if (pids.some(pid => item.PID && (item.PID === pid || item.PID.startsWith(`${pid}-`)))) return true;
        if (item.ລະຫັດກວດກາ && deletedCodes.includes(item.ລະຫັດກວດກາ)) return true;
        if (item.incidentId && pids.includes(item.incidentId)) return true;
        if (item.inspectionId && deletedCodes.includes(item.inspectionId)) return true;
        return false;
      };

      // Cascade delete any corresponding Repair Assessments, Repair Approvals, Repair Tracking, and Maintenance Archives records
      const updatedAssessments = assessments.filter(item => !shouldDelete(item));
      setAssessments(updatedAssessments);
      saveAssessments(updatedAssessments);

      const updatedApprovals = approvals.filter(item => !shouldDelete(item));
      setApprovals(updatedApprovals);
      saveApprovals(updatedApprovals);

      const updatedTracking = repairTracking.filter(item => !shouldDelete(item));
      setRepairTracking(updatedTracking);
      saveRepairTracking(updatedTracking);

      const updatedRepairs = repairs.filter(item => !shouldDelete(item));
      setRepairs(updatedRepairs);
      saveRepairs(updatedRepairs);
    } else if (type === "approvals") {
      const pids = approvals.map(i => i.PID);
      addDeletedPIDs(pids);
      const deletedCodes = approvals.map(item => item.ລະຫັດກວດກາ).filter(Boolean);

      setApprovals([]);
      saveApprovals([]);

      const shouldDelete = (item: any) => {
        if (!item) return false;
        if (pids.includes(item.PID)) return true;
        if (pids.some(pid => item.PID && (item.PID === pid || item.PID.startsWith(`${pid}-`)))) return true;
        if (item.ລະຫັດກວດກາ && deletedCodes.includes(item.ລະຫັດກວດກາ)) return true;
        if (item.incidentId && pids.includes(item.incidentId)) return true;
        if (item.inspectionId && deletedCodes.includes(item.inspectionId)) return true;
        return false;
      };

      // Cascade delete any corresponding Repair Assessments, Repair Tracking, and Maintenance Archives records
      const updatedAssessments = assessments.filter(item => !shouldDelete(item));
      setAssessments(updatedAssessments);
      saveAssessments(updatedAssessments);

      const updatedTracking = repairTracking.filter(item => !shouldDelete(item));
      setRepairTracking(updatedTracking);
      saveRepairTracking(updatedTracking);

      const updatedRepairs = repairs.filter(item => !shouldDelete(item));
      setRepairs(updatedRepairs);
      saveRepairs(updatedRepairs);
    } else if (type === "repairs") {
      const pids = repairs.map(i => i.PID);
      addDeletedPIDs(pids);
      setRepairs([]);
      saveRepairs([]);

      // Cascade delete corresponding Repair Tracking records
      const updatedTracking = repairTracking.filter(item => !pids.includes(item.PID));
      setRepairTracking(updatedTracking);
      saveRepairTracking(updatedTracking);
    }
  };

  // Apply secure row-level filters based on user status and branch selection
  const isAdmin = currentUser?.status === "Admin";
  const userBranch = currentUser?.branch || "";

  const filteredInspections = isAdmin 
    ? inspections 
    : inspections.filter(item => String(item["ສາຂາ "] || "").trim() === userBranch.trim());

  const filteredIncidents = isAdmin 
    ? incidents 
    : incidents.filter(item => String(item["ສາຂາ "] || "").trim() === userBranch.trim());

  const filteredAssessments = isAdmin 
    ? assessments 
    : assessments.filter(item => String(item.branch || "").trim() === userBranch.trim());

  const filteredApprovals = isAdmin 
    ? approvals 
    : approvals.filter(item => String(item["ສາຂາ "] || "").trim() === userBranch.trim());

  const filteredRepairs = isAdmin 
    ? repairs 
    : repairs.filter(item => String(item["ສາຂາ "] || "").trim() === userBranch.trim());

  const filteredTracking = isAdmin 
    ? repairTracking 
    : repairTracking.filter(item => String(item["ສາຂາ "] || "").trim() === userBranch.trim());

  // Get unique branches for Dashboard filter dropdown selection (only allowed for Admin)
  const uniqueBranches: string[] = Array.from(new Set(inspections.map(item => String(item["ສາຂາ "] || "")))).filter(Boolean).sort() as string[];

  const isTabAllowed = (tabId: string) => {
    if (!currentUser) return false;
    if (Array.isArray(currentUser.allowedTabs) && currentUser.allowedTabs.length > 0) {
      return currentUser.allowedTabs.includes(tabId);
    }
    if (currentUser.status === "Admin") {
      return true;
    }
    return tabId !== "accounts";
  };

  const hasAllowedRepairs = isTabAllowed("assessment") || isTabAllowed("approvals") || isTabAllowed("tracking") || isTabAllowed("repairs");
  const isRepairTabActive = ["assessment", "approvals", "tracking", "repairs"].includes(activeTab);

  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="safehub-app-theme min-h-screen bg-ldb-brand flex flex-col font-sans text-slate-100">
      <header className="sticky top-0 w-full bg-[#0a1120]/95 backdrop-blur-md text-slate-100 border-b border-blue-900/40 z-40 select-none shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Brand Logo & Title */}
            <div 
              onClick={() => { setActiveTab("dashboard"); setActiveDropdown(null); }}
              className="flex items-center space-x-3 cursor-pointer group"
            >
              <div className="h-9.5 w-9.5 rounded-xl bg-[#0e1426] border-2 border-[#C5A059]/80 text-[#C5A059] flex items-center justify-center font-bold shadow-md transition group-hover:scale-105">
                <Landmark className="h-4.5 w-4.5" />
              </div>
              <div>
                <h1 className="font-display font-black text-sm tracking-wide text-white">LDB SafeHub</h1>
              </div>
            </div>

            {/* Center: Desktop Menu Selections */}
            <nav className="hidden lg:flex items-center space-x-1">
              {isTabAllowed("dashboard") && (
                <button
                  onClick={() => { setActiveTab("dashboard"); setActiveDropdown(null); }}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "dashboard" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14] font-black shadow-md" 
                      : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                  }`}
                >
                  <LayoutDashboard className="h-4 w-4 shrink-0" />
                  <span>ແຜງຄວບຄຸມ (Dashboard)</span>
                </button>
              )}

              {isTabAllowed("pm") && (
                <button
                  onClick={() => { setActiveTab("pm"); setActiveDropdown(null); }}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "pm" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14] font-black shadow-md" 
                      : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                  }`}
                >
                  <ClipboardCheck className="h-4 w-4 shrink-0" />
                  <span>ການບຳລຸງຮັກສາ (PM)</span>
                </button>
              )}

              {isTabAllowed("inspections") && (
                <button
                  onClick={() => { setActiveTab("inspections"); setActiveDropdown(null); }}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "inspections" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14] font-black shadow-md" 
                      : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                  }`}
                >
                  <CheckSquare className="h-4 w-4 shrink-0" />
                  <span>ການກວດກາ (Inspections)</span>
                </button>
              )}

              {isTabAllowed("incidents") && (
                <button
                  onClick={() => { setActiveTab("incidents"); setActiveDropdown(null); }}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "incidents" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14] font-black shadow-md" 
                      : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                  }`}
                >
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>ບັນທຶກເຫດການ (Incidents)</span>
                </button>
              )}

              {/* Grouped Repair Work Dropdown */}
              {hasAllowedRepairs && (
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(activeDropdown === "repairs" ? null : "repairs");
                    }}
                    className={`nav-dropdown-btn px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                      isRepairTabActive
                        ? "bg-[#C5A059]/15 text-[#C5A059] border border-[#C5A059]/35"
                        : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                    }`}
                  >
                    <Hammer className="h-4 w-4 shrink-0" />
                    <span>ງານສ້ອມແປງ (Repairs)</span>
                    <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${activeDropdown === "repairs" ? "rotate-180" : ""}`} />
                  </button>

                  {activeDropdown === "repairs" && (
                    <div className="nav-dropdown-menu absolute left-0 mt-2 w-64 bg-[#0a1120] border border-blue-900/40 rounded-xl shadow-2xl p-2 space-y-1 z-50 animate-fadeIn">
                      <div className="px-3 py-1.5 text-[10px] text-[#C5A059] font-bold uppercase tracking-wider border-b border-blue-950/50 mb-1">
                        ການຈັດການງານສ້ອມແປງ
                      </div>
                      {isTabAllowed("assessment") && (
                        <button
                          onClick={() => { setActiveTab("assessment"); setActiveDropdown(null); }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2.5 transition cursor-pointer ${
                            activeTab === "assessment"
                              ? "bg-[#C5A059] text-[#050a14]"
                              : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                          }`}
                        >
                          <FileText className="h-4 w-4 shrink-0" />
                          <span>ປະເມີນລາຍການສ້ອມ (Assessment)</span>
                        </button>
                      )}
                      {isTabAllowed("approvals") && (
                        <button
                          onClick={() => { setActiveTab("approvals"); setActiveDropdown(null); }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2.5 transition cursor-pointer ${
                            activeTab === "approvals"
                              ? "bg-[#C5A059] text-[#050a14]"
                              : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                          }`}
                        >
                          <Hammer className="h-4 w-4 shrink-0" />
                          <span>ອະນຸມັດການສ້ອມ (Approvals)</span>
                        </button>
                      )}
                      {isTabAllowed("tracking") && (
                        <button
                          onClick={() => { setActiveTab("tracking"); setActiveDropdown(null); }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2.5 transition cursor-pointer ${
                            activeTab === "tracking"
                              ? "bg-[#C5A059] text-[#050a14]"
                              : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                          }`}
                        >
                          <RefreshCw className="h-4 w-4 shrink-0" />
                          <span>ຕິດຕາມສະຖານະການສ້ອມ (Tracking)</span>
                        </button>
                      )}
                      {isTabAllowed("repairs") && (
                        <button
                          onClick={() => { setActiveTab("repairs"); setActiveDropdown(null); }}
                          className={`w-full text-left px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-2.5 transition cursor-pointer ${
                            activeTab === "repairs"
                              ? "bg-[#C5A059] text-[#050a14]"
                              : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                          }`}
                        >
                          <Clock className="h-4 w-4 shrink-0" />
                          <span>ປະຫວັດການສ້ອມ (Logs History)</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isTabAllowed("accounts") && (
                <button
                  onClick={() => { setActiveTab("accounts"); setActiveDropdown(null); }}
                  className={`px-3 py-2 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "accounts" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14] font-black shadow-md" 
                      : "text-slate-300 hover:bg-[#111c30] hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span>ສິດທິຜູ້ໃຊ້ (Permissions)</span>
                </button>
              )}
            </nav>

            {/* Right: User Profile & Settings Trigger */}
            <div className="hidden lg:flex items-center space-x-3">
              {/* User Session card */}
              <div className="flex items-center space-x-2.5 bg-[#111c30]/50 border border-blue-900/30 px-3 py-1.5 rounded-xl select-none">
                <div className="bg-[#C5A059] text-[#050a14] font-black h-7 w-7 rounded-full flex items-center justify-center text-[10px] shadow-md">
                  {(currentUser.username?.[0] || 'U').toUpperCase()}
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[10px] font-bold text-slate-100 truncate max-w-[120px] leading-tight flex items-center">
                    <ShieldCheck className="h-3 w-3 text-[#C5A059] mr-0.5 shrink-0" />
                    {currentUser.username}
                  </p>
                  <p className="text-[8px] text-slate-300 font-medium truncate max-w-[120px] leading-none mt-0.5">
                    {(currentUser.branch || '').replace(/^\d+\.\s*(ສາຂາ\s*)?/, '')}
                  </p>
                </div>
              </div>

              {/* Settings Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(activeDropdown === "settings" ? null : "settings");
                  }}
                  className="nav-dropdown-btn h-9 w-9 rounded-xl border border-blue-900/40 hover:bg-[#111c30] text-slate-300 hover:text-white transition cursor-pointer flex items-center justify-center shadow-sm"
                  title="ຕັ້ງຄ່າ ແລະ ລະບົບ"
                >
                  <Settings className="h-4.5 w-4.5" />
                </button>

                {activeDropdown === "settings" && (
                  <div className="nav-dropdown-menu absolute right-0 mt-2 w-64 bg-[#0a1120] border border-blue-900/40 rounded-2xl shadow-2xl p-4.5 space-y-4.5 z-50 animate-fadeIn">
                    {/* Zoom / Scale */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-[#C5A059] uppercase tracking-wider flex items-center gap-1.5">
                        <Type className="h-3.5 w-3.5" />
                        ຂະໜາດໜ້າຕ່າງ & ຕົວໜັງສື
                      </span>
                      <div className="grid grid-cols-4 gap-1 bg-[#070d1a] p-1 rounded-lg border border-blue-950">
                        {(["small", "medium", "large", "xlarge"] as const).map((scale) => {
                          const labels = { small: "ນ້ອຍ", medium: "ພໍດີ", large: "ໃຫຍ່", xlarge: "ໃຫຍ່ສຸດ" };
                          return (
                            <button
                              key={scale}
                              onClick={() => setUiScale(scale)}
                              className={`py-1 text-[9px] font-extrabold rounded-md transition cursor-pointer text-center ${
                                uiScale === scale
                                  ? "bg-[#C5A059] text-[#050a14] font-black"
                                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                              }`}
                            >
                              {labels[scale]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-blue-950/80" />

                    {/* Metadata */}
                    <div className="text-[9.5px] text-slate-400 font-mono space-y-1">
                      <p className="truncate">ບົດບາດ: {currentUser.status}</p>
                      <p className="truncate">ສາຂາ: {currentUser.branch}</p>
                      <p>Server Container: v2026.1</p>
                    </div>

                    {/* Log Out */}
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center justify-center py-2 px-3 rounded-xl border border-red-900/40 text-[11px] font-bold text-white bg-red-950/20 hover:bg-red-950 hover:border-red-800 transition cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5 mr-1.5" />
                      ອອກຈາກລະບົບ (Log Out)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile View: Actions & Hamburger Trigger */}
            <div className="flex lg:hidden items-center space-x-2.5">
              {/* Profile initial on mobile */}
              <div className="bg-[#C5A059] text-[#050a14] font-black h-7.5 w-7.5 rounded-full flex items-center justify-center text-[10px] shadow-sm select-none">
                {(currentUser.username?.[0] || 'U').toUpperCase()}
              </div>
              
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl border border-blue-900/40 text-slate-300 hover:bg-[#111c30] hover:text-white transition cursor-pointer"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Expandable Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#070d1a] border-t border-blue-950 px-4 py-4 space-y-4 animate-fadeIn">
            <div className="flex flex-col space-y-1.5">
              {isTabAllowed("dashboard") && (
                <button
                  onClick={() => { setActiveTab("dashboard"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === "dashboard" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14]" 
                      : "text-slate-300 hover:bg-[#111c30]"
                  }`}
                >
                  <LayoutDashboard className="h-4.5 w-4.5 mr-3 shrink-0" />
                  ແຜງຄວບຄຸມ (Dashboard Monitor)
                </button>
              )}

              {isTabAllowed("pm") && (
                <button
                  onClick={() => { setActiveTab("pm"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === "pm" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14]" 
                      : "text-slate-300 hover:bg-[#111c30]"
                  }`}
                >
                  <ClipboardCheck className="h-4.5 w-4.5 mr-3 shrink-0" />
                  ການບຳລຸງຮັກສາ (Preventive Maintenance)
                </button>
              )}

              {isTabAllowed("inspections") && (
                <button
                  onClick={() => { setActiveTab("inspections"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === "inspections" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14]" 
                      : "text-slate-300 hover:bg-[#111c30]"
                  }`}
                >
                  <CheckSquare className="h-4.5 w-4.5 mr-3 shrink-0" />
                  ການກວດກາອາຄານ (Inspections List)
                </button>
              )}

              {isTabAllowed("incidents") && (
                <button
                  onClick={() => { setActiveTab("incidents"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === "incidents" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14]" 
                      : "text-slate-300 hover:bg-[#111c30]"
                  }`}
                >
                  <ShieldAlert className="h-4.5 w-4.5 mr-3 shrink-0" />
                  ບັນທຶກເຫດການ ແລະ ຄວາມສ່ຽງ (Incidents)
                </button>
              )}

              {/* Grouped Repair Category for Mobile */}
              {hasAllowedRepairs && (
                <div className="pt-2 border-t border-blue-950/50 mt-1">
                  <p className="text-[9px] text-[#C5A059] font-bold uppercase tracking-wider px-4 mb-1.5">ງານສ້ອມແປງ (Repairs)</p>
                  
                  {isTabAllowed("assessment") && (
                    <button
                      onClick={() => { setActiveTab("assessment"); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer pl-6 ${
                        activeTab === "assessment" 
                          ? "bg-[#C5A059]/20 text-[#C5A059]" 
                          : "text-slate-300 hover:bg-[#111c30]"
                      }`}
                    >
                      <FileText className="h-4 w-4 mr-2.5 shrink-0" />
                      ປະເມີນລາຍການສ້ອມ (Assessment)
                    </button>
                  )}

                  {isTabAllowed("approvals") && (
                    <button
                      onClick={() => { setActiveTab("approvals"); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer pl-6 ${
                        activeTab === "approvals" 
                          ? "bg-[#C5A059]/20 text-[#C5A059]" 
                          : "text-slate-300 hover:bg-[#111c30]"
                      }`}
                    >
                      <Hammer className="h-4 w-4 mr-2.5 shrink-0" />
                      ລາຍການອະນຸມັດການສ້ອມ (Approvals)
                    </button>
                  )}

                  {isTabAllowed("tracking") && (
                    <button
                      onClick={() => { setActiveTab("tracking"); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer pl-6 ${
                        activeTab === "tracking" 
                          ? "bg-[#C5A059]/20 text-[#C5A059]" 
                          : "text-slate-300 hover:bg-[#111c30]"
                      }`}
                    >
                      <RefreshCw className="h-4 w-4 mr-2.5 shrink-0" />
                      ຕິດຕາມສະຖານະການສ້ອມ (Tracking)
                    </button>
                  )}

                  {isTabAllowed("repairs") && (
                    <button
                      onClick={() => { setActiveTab("repairs"); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer pl-6 ${
                        activeTab === "repairs" 
                          ? "bg-[#C5A059]/20 text-[#C5A059]" 
                          : "text-slate-300 hover:bg-[#111c30]"
                      }`}
                    >
                      <Clock className="h-4 w-4 mr-2.5 shrink-0" />
                      ປະຫວັດການສ້ອມແປງ (Logs History)
                    </button>
                  )}
                </div>
              )}

              {isTabAllowed("accounts") && (
                <button
                  onClick={() => { setActiveTab("accounts"); setMobileMenuOpen(false); }}
                  className={`w-full flex items-center px-4 py-2 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activeTab === "accounts" 
                      ? "bg-gradient-to-r from-[#C5A059] to-[#b38f4d] text-[#050a14]" 
                      : "text-slate-300 hover:bg-[#111c30]"
                  }`}
                >
                  <Users className="h-4.5 w-4.5 mr-3 shrink-0" />
                  ຄຸ້ມຄອງສິດທິຜູ້ໃຊ້ (Permissions)
                </button>
              )}
            </div>

            {/* Mobile Footer Area */}
            <div className="border-t border-blue-950 pt-4 space-y-3.5">
              {/* Zoom Controls */}
              <div className="space-y-1.5 px-4">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Type className="h-3.5 w-3.5 text-[#C5A059]" />
                  ຂະໜາດໜ້າຕ່າງ & ຕົວໜັງສື
                </span>
                <div className="grid grid-cols-4 gap-1 bg-[#070d1a] p-1 rounded-lg border border-blue-950">
                  {(["small", "medium", "large", "xlarge"] as const).map((scale) => {
                    const labels = { small: "ນ້ອຍ", medium: "ພໍດີ", large: "ໃຫຍ່", xlarge: "ໃຫຍ່ສຸດ" };
                    return (
                      <button
                        key={scale}
                        onClick={() => setUiScale(scale)}
                        className={`py-1 text-[9px] font-extrabold rounded-md transition cursor-pointer text-center ${
                          uiScale === scale
                            ? "bg-[#C5A059] text-[#050a14]"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {labels[scale]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* User Identity & Logout */}
              <div className="px-4 flex items-center justify-between">
                <div className="text-[10.5px] text-slate-400 font-mono leading-relaxed">
                  <p>ຜູ້ໃຊ້: {currentUser.username}</p>
                  <p>ບົດບາດ: {currentUser.status}</p>
                </div>
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="flex items-center justify-center py-2 px-3 rounded-xl border border-red-900/40 text-xs font-bold text-white bg-red-950/20 hover:bg-red-950 hover:border-red-800 transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4 mr-1.5" />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Panel Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 md:p-8 space-y-6">
        
        {/* Render pages depending on current active tab selection */}
        {activeTab === "dashboard" && (
          <DashboardView 
            inspections={filteredInspections} 
            incidents={filteredIncidents} 
            assessments={filteredAssessments}
            approvals={filteredApprovals}
            repairs={filteredRepairs}
            repairTracking={filteredTracking}
            users={isAdmin ? users : users.filter(item => String(item.branch || "").trim() === userBranch.trim())}
            branches={isAdmin ? branches : branches.filter(item => String(item.ສາຂາ || "").trim() === userBranch.trim())}
            pmAssets={isAdmin ? pmAssets : pmAssets.filter(item => String(item.branch || "").trim() === userBranch.trim())}
            pmHistory={isAdmin ? pmHistory : pmHistory.filter(item => String(item.branch || "").trim() === userBranch.trim())}
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            uniqueBranches={uniqueBranches}
            currentUser={currentUser}
            onApproveIncident={handleApproveIncident}
            onRefreshData={handleRefreshData}
          />
        )}

        {activeTab === "inspections" && (
          <InspectionsView 
            inspections={filteredInspections} 
            onAddInspection={handleAddInspection} 
            onUpdateInspection={handleUpdateInspection}
            currentUser={currentUser}
            incidents={filteredIncidents}
            onAddIncident={handleAddIncident}
            checklistItems={checklistItems}
            onDeleteInspections={handleDeleteInspections}
            getDeleteImpact={(pids) => getDeleteImpact('inspection', pids)}
            onClearAllData={handleClearAllData}
            sectors={sectors}
            autoEditInspectionCode={autoEditInspectionCode}
            onClearAutoEdit={() => setAutoEditInspectionCode(null)}
          />
        )}

        {activeTab === "pm" && (
          <PreventiveMaintenanceView 
            key={pmKey}
            currentUser={currentUser}
            incidents={filteredIncidents}
            onAddIncident={handleAddIncident}
          />
        )}

        {activeTab === "incidents" && (
          <IncidentsView 
            incidents={filteredIncidents} 
            onAddIncident={handleAddIncident}
            onUpdateIncident={handleUpdateIncident}
            onApproveIncident={handleApproveIncident}
            onCancelIncident={handleCancelIncident}
            currentUser={currentUser}
            inspections={inspections}
            onDeleteIncidents={handleDeleteIncidents}
            getDeleteImpact={(pids) => getDeleteImpact('incident', pids)}
            onClearAllData={handleClearAllData}
            sectors={sectors}
            onNavigateToEditInspection={(inspectionCode) => {
              setAutoEditInspectionCode(inspectionCode);
              setActiveTab("inspections");
            }}
            onNavigateToAssessment={(pid) => {
              setPreSelectedIncidentPID(pid || null);
              setActiveTab("assessment");
            }}
            assessments={filteredAssessments}
          />
        )}

        {activeTab === "assessment" && (
          <RepairAssessmentView 
            incidents={filteredIncidents}
            assessments={filteredAssessments}
            onAddAssessment={handleAddAssessment}
            onUpdateAssessment={handleUpdateAssessment}
            onUpdateIncidentStatus={handleUpdateIncidentStatus}
            currentUser={currentUser}
            initialIncidentId={preSelectedIncidentPID}
            onClearInitialIncidentId={() => setPreSelectedIncidentPID(null)}
            onNavigateToTab={setActiveTab}
          />
        )}

        {activeTab === "approvals" && (
          <ApprovalsView 
            approvals={filteredApprovals}
            repairs={filteredRepairs}
            repairTracking={repairTracking}
            onGoToTracking={() => setActiveTab("tracking")}
            onCompleteRepair={handleCompleteRepair}
            currentUser={currentUser}
            onDeleteApprovals={handleDeleteApprovals}
            onClearAllData={handleClearAllData}
            incidents={incidents}
            assessments={assessments}
            onApproveIncident={handleApproveIncident}
            onCancelIncident={handleCancelIncident}
            onUpdateIncident={handleUpdateIncident}
          />
        )}

        {activeTab === "tracking" && (
          <RepairTrackingView 
            trackingList={filteredTracking}
            repairs={filteredRepairs}
            onStartRepair={handleStartRepair}
            onUpdateProgress={handleUpdateProgress}
            onWaitingStatus={handleWaitingStatus}
            onPauseRepair={handlePauseRepair}
            onCompleteRepair={handleCompleteRepairTracking}
            onCloseJob={handleCloseJob}
            onResumeRepair={handleResumeRepair}
            currentUser={currentUser}
            onRefreshData={handleRefreshData}
          />
        )}

         {activeTab === "repairs" && (
          <RepairsView 
            repairs={filteredRepairs}
            currentUser={currentUser}
            onDeleteRepairs={handleDeleteRepairs}
            onClearAllData={handleClearAllData}
            approvals={approvals}
            repairTracking={repairTracking}
            assessments={assessments}
          />
        )}

        {activeTab === "accounts" && isTabAllowed("accounts") && (
          <AccountsView 
            currentUser={currentUser}
            users={users}
            onSaveUsers={handleSaveUsers}
            onUpdateCurrentUser={handleUpdateCurrentUser}
            branches={branches}
            onSaveBranches={handleSaveBranches}
            checklistItems={checklistItems}
            onSaveChecklistItems={handleSaveChecklistItems}
            sectors={sectors}
            onSaveSectors={handleSaveSectors}
          />
        )}

      </main>
      
    </div>
  );
}
