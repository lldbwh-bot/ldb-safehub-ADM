import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, UserPlus, Trash2, Edit2, Shield, Check, X, 
  MapPin, ShieldAlert, Key, Lock, Save, CheckSquare,
  Building, Search, PlusCircle, AlertCircle, RotateCcw, Wrench,
  Eye, EyeOff, Download, UserCircle, Image as ImageIcon
} from 'lucide-react';
import { UserAccount, BranchInfo, ChecklistItem, SectorInfo, RepairPreset } from '../types';
import { CHECKLIST_ITEMS, getSavedRepairPresets, saveRepairPresets, DEFAULT_REPAIR_PRESETS } from '../dataStore';

interface AccountsViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  onSaveUsers: (updatedUsers: UserAccount[]) => void;
  onUpdateCurrentUser: (updatedUser: UserAccount) => void;
  branches: BranchInfo[];
  onSaveBranches: (updatedBranches: BranchInfo[]) => void;
  checklistItems: ChecklistItem[];
  onSaveChecklistItems: (updatedItems: ChecklistItem[]) => void;
  sectors: SectorInfo[];
  onSaveSectors: (updatedSectors: SectorInfo[]) => void;
}

export default function AccountsView({ 
  currentUser, 
  users, 
  onSaveUsers,
  onUpdateCurrentUser,
  branches,
  onSaveBranches,
  checklistItems,
  onSaveChecklistItems,
  sectors,
  onSaveSectors
}: AccountsViewProps) {
  // Navigation sub-tab: 'users' | 'branches' | 'checklist' | 'sectors' | 'repairPresets'
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'branches' | 'checklist' | 'sectors' | 'repairPresets'>('users');

  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [branchSearchTerm, setBranchSearchTerm] = useState('');
  const [checklistSearchTerm, setChecklistSearchTerm] = useState('');
  const [sectorSearchTerm, setSectorSearchTerm] = useState('');
  const [presetsSearchTerm, setPresetsSearchTerm] = useState('');

  // Repair Presets states
  const [repairPresets, setRepairPresets] = useState<RepairPreset[]>(() => getSavedRepairPresets());
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetSparePart, setPresetSparePart] = useState('');
  const [presetSubCategory, setPresetSubCategory] = useState('ລະບົບໄຟຟ້າ');
  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);
  const [presetSubItem, setPresetSubItem] = useState('');
  const [presetWorkType, setPresetWorkType] = useState('ປ່ຽນອະໄຫຼ່');
  const [presetUnit, setPresetUnit] = useState('ອັນ');
  const [presetPrice, setPresetPrice] = useState<number>(0);
  const [presetError, setPresetError] = useState('');

  // Sector state fields
  const [newSectorInput, setNewSectorInput] = useState('');
  const [sectorErrorText, setSectorErrorText] = useState('');
  const [deleteSectorConfirm, setDeleteSectorConfirm] = useState<SectorInfo | null>(null);

  // Checklist Item states
  const [newChecklistSystem, setNewChecklistSystem] = useState('');
  const [newChecklistCategory, setNewChecklistCategory] = useState('');
  const [newChecklistInspection, setNewChecklistInspection] = useState('');
  const [newChecklistFormType, setNewChecklistFormType] = useState('ສາຂາ');
  const [checklistFormTypeFilter, setChecklistFormTypeFilter] = useState('ALL');
  const [checklistErrorText, setChecklistErrorText] = useState('');
  const [isCustomSystem, setIsCustomSystem] = useState(false);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [deleteChecklistItemConfirm, setDeleteChecklistItemConfirm] = useState<ChecklistItem | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [editingChecklistItem, setEditingChecklistItem] = useState<ChecklistItem | null>(null);
  
  // User Form modal states
  const [isOpen, setIsOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null); // null means adding a new user
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [image, setImage] = useState('');
  const [status, setStatus] = useState('User'); // 'Admin' | 'User'
  const [branch, setBranch] = useState(currentUser.branch);
  const [allowedTabs, setAllowedTabs] = useState<string[]>([
    'dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs'
  ]);
  
  // New Branch/Division fields
  const [newBranchInput, setNewBranchInput] = useState('');
  const [newDivisionInput, setNewDivisionInput] = useState('');
  const [branchErrorText, setBranchErrorText] = useState('');

  // UI helpers
  const [errorText, setErrorText] = useState('');

  // Custom non-blocking confirmations/messages
  const [deleteUserConfirm, setDeleteUserConfirm] = useState<UserAccount | null>(null);
  const [deleteBranchConfirm, setDeleteBranchConfirm] = useState<BranchInfo | null>(null);
  const [visiblePasswordUsers, setVisiblePasswordUsers] = useState<Record<string, boolean>>({});
  const [viewingUser, setViewingUser] = useState<UserAccount | null>(null);
  const [systemAlertMessage, setSystemAlertMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Search filter for Users
  const filteredUsers = users.filter(user => 
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.branch.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportUsersExcel = () => {
    const rows = filteredUsers.map((user, index) => ({
      'No.': index + 1,
      'Username': user.username || '',
      'Role': user.status || '',
      'Branch': user.branch || '',
      'Visible Tabs': (user.allowedTabs || []).join(', '),
      'Has User Image': user.image ? 'Yes' : 'No',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, `LDB_SafeHub_Users_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const togglePasswordVisibility = (targetUsername: string) => {
    setVisiblePasswordUsers(prev => ({
      ...prev,
      [targetUsername]: !prev[targetUsername],
    }));
  };

  // Search filter for Branches/Divisions
  const filteredBranches = branches.filter(item => 
    item.ສາຂາ.toLowerCase().includes(branchSearchTerm.toLowerCase()) ||
    (item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || "").toLowerCase().includes(branchSearchTerm.toLowerCase())
  );

  // Search filter for Checklist items
  const filteredChecklistItems = checklistItems.filter((item: any) => {
    const matchesSearch = item.ລະບົບທີ່ກວດ.toLowerCase().includes(checklistSearchTerm.toLowerCase()) ||
      item.ໝວດລະບົບກວດ.toLowerCase().includes(checklistSearchTerm.toLowerCase()) ||
      item.ລາຍການກວດ.toLowerCase().includes(checklistSearchTerm.toLowerCase());
    const matchesFormType = checklistFormTypeFilter === 'ALL' || 
      (item.Form_Type && item.Form_Type.trim() === checklistFormTypeFilter.trim());
    return matchesSearch && matchesFormType;
  });
  
  // Cleaned up dummy block
  //
    //
    //
    //
    // Cleaned up end block

  const uniqueBranches = Array.from(new Set(branches.map(b => b.ສາຂາ))).sort();

  // Define full list of functional tabs
  const AVAILABLE_TABS = [
    { id: 'dashboard', label: 'ແຜງຄວບຄຸມ (Dashboard Monitor)' },
    { id: 'pm', label: 'ການບຳລຸງຮັກສາ (Preventive Maintenance)' },
    { id: 'inspections', label: 'ການກວດກາອາຄານ (Inspections)' },
    { id: 'incidents', label: 'ທະບຽນເຫດການ & ຄວາມສ່ຽງ (Incidents)' },
    { id: 'approvals', label: 'ລາຍການອະນຸມັດສ້ອມແປງ (Repair Approvals)' },
    { id: 'tracking', label: 'ຕິດຕາມການສ້ອມແປງ (Repair Tracking)' },
    { id: 'repairs', label: 'ປະຫວັດການສ້ອມແປງ (Repair Logs)' },
    { id: 'accounts', label: 'ຈັດການສິດຜູ້ໃຊ້ (User Permissions)' }
  ];

  const toggleTabPermission = (tabId: string) => {
    if (allowedTabs.includes(tabId)) {
      if (editingIndex !== null && users[editingIndex].username === currentUser.username && tabId === 'accounts') {
        setSystemAlertMessage("ທ່ານບໍ່ສາມາດປິດສິດທິໃນການເຂົ້າເຖິງ ໜ້າຈັດການສິດຜູ້ໃຊ້ ຂອງຕົວທ່ານເອງໄດ້!");
        return;
      }
      setAllowedTabs(allowedTabs.filter(id => id !== tabId));
    } else {
      setAllowedTabs([...allowedTabs, tabId]);
    }
  };

  const handleOpenAdd = () => {
    setEditingIndex(null);
    setUsername('');
    setPassword('');
    setImage('');
    setStatus('User');
    setBranch(uniqueBranches[0] || currentUser.branch);
    setAllowedTabs(['dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs']);
    setErrorText('');
    setIsOpen(true);
  };

  const handleOpenEdit = (user: UserAccount, globalIndex: number) => {
    setEditingIndex(globalIndex);
    setUsername(user.username);
    setPassword('');
    setImage(user.image || '');
    setStatus(user.status);
    setBranch(user.branch || uniqueBranches[0] || currentUser.branch);
    setAllowedTabs(user.allowedTabs || (user.status === 'Admin' 
      ? ['dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs', 'accounts']
      : ['dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs']));
    setErrorText('');
    setIsOpen(true);
  };

  const handleDeleteUser = (userToDelete: UserAccount) => {
    if (userToDelete.username === currentUser.username) {
      setSystemAlertMessage("ທ່ານບໍ່ສາມາດລົບ ບັນຊີທີ່ກຳລັງໃຊ້ງານຢູ່ (Your Own Account) ໄດ້!");
      return;
    }
    setDeleteUserConfirm(userToDelete);
  };

  const executeDeleteUser = () => {
    if (!deleteUserConfirm) return;
    const remainingUsers = users.filter(u => u.username !== deleteUserConfirm.username);
    onSaveUsers(remainingUsers);
    setDeleteUserConfirm(null);
    triggerToast(`ລົບຂໍ້ມູນຜູ້ໃຊ້ "${deleteUserConfirm.username}" ສຳເລັດ!`);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (!username.trim() || !branch || (editingIndex === null && !password.trim())) {
      setErrorText('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ');
      return;
    }

    if (allowedTabs.length === 0) {
      setErrorText('ກະລຸນາເລືອກຢ່າງໜ້ອຍ 1 ຟັງຊັນທີ່ສາມາດເຂົ້າເຖິງໄດ້');
      return;
    }

    const cleanedUsername = username.trim();
    const updatedUserObj: UserAccount = {
      username: cleanedUsername,
      password_raw:
        password.trim() ||
        (editingIndex !== null ? users[editingIndex].password_raw || '' : ''),
      status,
      branch,
      image: image.trim(),
      allowedTabs
    };

    let updatedList = [...users];

    if (editingIndex === null) {
      const exists = users.some(u => u.username.toLowerCase() === cleanedUsername.toLowerCase());
      if (exists) {
        setErrorText(`ຊື່ຜູ້ໃຊ້ "${cleanedUsername}" ມີໃນລະບົບແລ້ວ! ກະລຸນາປ້ອນຊື່ອື່ນ`);
        return;
      }
      updatedList = [updatedUserObj, ...updatedList];
    } else {
      const previousUser = users[editingIndex];
      const existsInOthers = users.some((u, idx) => 
        idx !== editingIndex && u.username.toLowerCase() === cleanedUsername.toLowerCase()
      );
      if (existsInOthers) {
        setErrorText(`ຊື່ຜູ້ໃຊ້ "${cleanedUsername}" ມີໃນລະບົບແລ້ວ!`);
        return;
      }

      updatedList[editingIndex] = updatedUserObj;

      if (previousUser.username === currentUser.username) {
        onUpdateCurrentUser(updatedUserObj);
      }
    }

    onSaveUsers(updatedList);
    setIsOpen(false);
  };

  // Add Branch / Division logic
  const handleAddBranch = (e: React.FormEvent) => {
    e.preventDefault();
    setBranchErrorText('');

    const formattedBranch = newBranchInput.trim();
    const formattedDivision = newDivisionInput.trim();

    if (!formattedBranch || !formattedDivision) {
      setBranchErrorText('ກະລຸນາກວດສອບ: ຕ້ອງປ້ອນຂໍ້ມູນທັງ ຊື່ສາຂາ ແລະ ຝ່າຍ/ໜ່ວຍບໍລິການ');
      return;
    }

    // Check duplicate
    const isDuplicate = branches.some(
      b => b.ສາຂາ === formattedBranch && b["ຝ່າຍ/ໜ່ວຍບໍລິການ"] === formattedDivision
    );

    if (isDuplicate) {
      setBranchErrorText('ຂໍ້ມູນສາຂາ ແລະ ຝ່າຍ/ໜ່ວຍບໍລິການ ນີ້ມີກຳນົດຢູ່ແລ້ວ!');
      return;
    }

    const nextId = branches.reduce((max, cur) => cur.ລຳດັບ > max ? cur.ລຳດັບ : max, 0) + 1;
    
    const newBranchObj: BranchInfo = {
      "ລຳດັບ": nextId,
      "ສາຂາ": formattedBranch,
      "ຝ່າຍ/ໜ່ວຍບໍລິການ": formattedDivision
    };

    const updatedBranches = [newBranchObj, ...branches];
    onSaveBranches(updatedBranches);

    // Reset division input, keep branch input for easier continuous department adding
    setNewDivisionInput('');
    setBranchErrorText('');
    
    // Quick transient notification
    triggerToast(`ເພີ່ມຂໍ້ມູນ "${formattedBranch}" - "${formattedDivision}" ສຳເລັດ!`);
  };

  // Delete Branch / Division row
  const handleDeleteBranch = (itemToDelete: BranchInfo) => {
    setDeleteBranchConfirm(itemToDelete);
  };

  const executeDeleteBranch = () => {
    if (!deleteBranchConfirm) return;
    const remainingBranches = branches.filter(
      item => !(item.ສາຂາ === deleteBranchConfirm.ສາຂາ && item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] === deleteBranchConfirm["ຝ່າຍ/ໜ່ວຍບໍລິການ"])
    );

    onSaveBranches(remainingBranches);
    setDeleteBranchConfirm(null);
    triggerToast("ລົບຂໍ້ມູນສາຂາ/ໜ່ວຍງານສຳເລັດ!");
  };

  // Sector management logic
  const handleAddSector = (e: React.FormEvent) => {
    e.preventDefault();
    setSectorErrorText('');

    const formattedSector = newSectorInput.trim();

    if (!formattedSector) {
      setSectorErrorText('ກະລຸນາປ້ອນຊື່ຂະແໜງ');
      return;
    }

    // Check duplicate
    const isDuplicate = sectors.some(
      s => s.ຂະແໜງ.toLowerCase() === formattedSector.toLowerCase()
    );

    if (isDuplicate) {
      setSectorErrorText('ຂໍ້ມູນຂະແໜງນີ້ມີ ກຳນົດຢູ່ແລ້ວ!');
      return;
    }

    const newSectorObj: SectorInfo = {
      ຂະແໜງ: formattedSector
    };

    const updatedSectors = [newSectorObj, ...sectors];
    onSaveSectors(updatedSectors);

    setNewSectorInput('');
    setSectorErrorText('');
    triggerToast(`ເພີ່ມຂໍ້ມູນຂະແໜງ "${formattedSector}" ສຳເລັດ!`);
  };

  const handleDeleteSector = (itemToDelete: SectorInfo) => {
    setDeleteSectorConfirm(itemToDelete);
  };

  const executeDeleteSector = () => {
    if (!deleteSectorConfirm) return;
    const remainingSectors = sectors.filter(
      item => item.ຂະແໜງ !== deleteSectorConfirm.ຂະແໜງ
    );

    onSaveSectors(remainingSectors);
    setDeleteSectorConfirm(null);
    triggerToast("ລົບຂໍ້ມູນຂະແໜງສຳເລັດ!");
  };

  // Checklist Item management handlers
  const handleEditChecklistItemClick = (item: ChecklistItem) => {
    setEditingChecklistItem(item);
    setNewChecklistSystem(item.ລະບົບທີ່ກວດ);
    setNewChecklistCategory(item.ໝວດລະບົບກວດ);
    setNewChecklistInspection(item.ລາຍການກວດ);
    setNewChecklistFormType(item.Form_Type || 'ສາຂາ');
    setChecklistErrorText('');

    const standardSystems = Array.from(new Set(checklistItems.map(i => i.ລະບົບທີ່ກວດ)));
    const standardCategories = Array.from(new Set(checklistItems.map(i => i.ໝວດລະບົບກວດ)));

    setIsCustomSystem(!standardSystems.includes(item.ລະບົບທີ່ກວດ));
    setIsCustomCategory(!standardCategories.includes(item.ໝວດລະບົບກວດ));
  };

  const handleCancelEditChecklistItem = () => {
    setEditingChecklistItem(null);
    setNewChecklistSystem('');
    setNewChecklistCategory('');
    setNewChecklistInspection('');
    setNewChecklistFormType('ສາຂາ');
    setIsCustomSystem(false);
    setIsCustomCategory(false);
    setChecklistErrorText('');
  };

  const handleAddChecklistItem = (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistErrorText('');

    const sys = isCustomSystem ? newChecklistSystem.trim() : newChecklistSystem;
    const cat = isCustomCategory ? newChecklistCategory.trim() : newChecklistCategory;
    const itemDetail = newChecklistInspection.trim();

    if (!sys) {
      setChecklistErrorText('ກະລຸນາເລືອກ ຫຼື ປ້ອນ ລະບົບທີ່ກວດ (System Category)');
      return;
    }
    if (!cat) {
      setChecklistErrorText('ກະລຸນາເລືອກ ຫຼື ປ້ອນ ພື້ນທີ່/ຈຸດກວດ ( Area / Point)');
      return;
    }
    if (!itemDetail) {
      setChecklistErrorText('ກະລຸນາປ້ອນ ລາຍການກວດກາ (Inspection Item)');
      return;
    }

    // Check duplicate within the same form type
    const isDuplicate = checklistItems.some(
      item => 
        item !== editingChecklistItem &&
        item.ລະບົບທີ່ກວດ.trim().toLowerCase() === sys.toLowerCase() &&
        item.ໝວດລະບົບກວດ.trim().toLowerCase() === cat.toLowerCase() &&
        item.ລາຍການກວດ.trim().toLowerCase() === itemDetail.toLowerCase() &&
        (item.Form_Type || 'ສາຂາ').trim().toLowerCase() === newChecklistFormType.trim().toLowerCase()
    );

    if (isDuplicate) {
      setChecklistErrorText('ລາຍການກວດການີ້ມີຢູ່ໃນຟອມນີ້ແລ້ວ!');
      return;
    }

    if (editingChecklistItem) {
      const updatedList = checklistItems.map(item => {
        if (item === editingChecklistItem) {
          return {
            ...item,
            ລະບົບທີ່ກວດ: sys,
            ໝວດລະບົບກວດ: cat,
            ລາຍການກວດ: itemDetail,
            Form_Type: newChecklistFormType,
          };
        }
        return item;
      });
      onSaveChecklistItems(updatedList);
      setEditingChecklistItem(null);
      setNewChecklistInspection('');
      setIsCustomSystem(false);
      setIsCustomCategory(false);
      triggerToast(`ແກ້ໄຂລາຍການກວດກາ "${itemDetail}" ສຳເລັດ!`);
    } else {
      const newItem: ChecklistItem = {
        ລະບົບທີ່ກວດ: sys,
        ໝວດລະບົບກວດ: cat,
        ລາຍການກວດ: itemDetail,
        Form_Type: newChecklistFormType,
      };

      onSaveChecklistItems([newItem, ...checklistItems]);
      
      // reset form fields
      setNewChecklistInspection('');
      setIsCustomSystem(false);
      setIsCustomCategory(false);
      triggerToast(`ເພີ່ມລາຍການກວດກາ "${itemDetail}" ສຳເລັດ!`);
    }
  };

  const handleDeleteChecklistItem = (item: ChecklistItem) => {
    setDeleteChecklistItemConfirm(item);
  };

  const executeDeleteChecklistItem = () => {
    if (!deleteChecklistItemConfirm) return;
    const remaining = checklistItems.filter(
      item => !(
        item.ລະບົບທີ່ກວດ === deleteChecklistItemConfirm.ລະບົບທີ່ກວດ &&
        item.ໝວດລະບົບກວດ === deleteChecklistItemConfirm.ໝວດລະບົບກວດ &&
        item.ລາຍການກວດ === deleteChecklistItemConfirm.ລາຍການກວດ
      )
    );
    onSaveChecklistItems(remaining);
    setDeleteChecklistItemConfirm(null);
    triggerToast('ລົບລາຍການກວດກາກຳນົດສຳເລັດ!');
  };

  const handleResetChecklistToDefault = () => {
    setShowResetConfirm(true);
  };

  const executeResetChecklist = () => {
    onSaveChecklistItems(CHECKLIST_ITEMS);
    setShowResetConfirm(false);
    triggerToast('ຣີເຊັດລາຍການກວດກາທັງໝົດເປັນຄ່າເລີ່ມຕົ້ນສຳເລັດ!');
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetSparePart.trim() || !presetSubItem.trim() || !presetUnit.trim()) {
      setPresetError('ກະລຸນາປ້ອນຂໍ້ມູນໃຫ້ຄົບຖ້ວນ');
      return;
    }
    
    const duplicate = repairPresets.find(p => 
      p.id !== editingPresetId &&
      p.sparePart.trim().toLowerCase() === presetSparePart.trim().toLowerCase() &&
      p.repairSubCategory === presetSubCategory &&
      p.repairSubItem.trim().toLowerCase() === presetSubItem.trim().toLowerCase()
    );
    
    if (duplicate) {
      setPresetError('ມີຂໍ້ມູນ Mapping ຂອງອະໄຫຼ່ ແລະ ລາຍການສ້ອມນີ້ໃນໝວດນີ້ຢູ່ແລ້ວ (ຫ້າມສ້າງ Master Data ຊ້ຳ)');
      return;
    }
    
    let updated: RepairPreset[];
    if (editingPresetId) {
      updated = repairPresets.map(p => {
        if (p.id === editingPresetId) {
          return {
            ...p,
            sparePart: presetSparePart.trim(),
            repairSubCategory: presetSubCategory,
            repairSubItem: presetSubItem.trim(),
            workType: presetWorkType,
            unit: presetUnit.trim(),
            estimatedUnitCost: Number(presetPrice) || 0
          };
        }
        return p;
      });
      triggerToast('ແກ້ໄຂແຜນຜັງ Mapping ສຳເລັດ!');
    } else {
      const newPreset: RepairPreset = {
        id: 'p_' + Date.now(),
        sparePart: presetSparePart.trim(),
        repairSubCategory: presetSubCategory,
        repairSubItem: presetSubItem.trim(),
        workType: presetWorkType,
        unit: presetUnit.trim(),
        estimatedUnitCost: Number(presetPrice) || 0
      };
      updated = [newPreset, ...repairPresets];
      triggerToast('ເພີ່ມແຜນຜັງ Mapping ໃໝ່ສຳເລັດ!');
    }
    
    setRepairPresets(updated);
    saveRepairPresets(updated);
    
    // reset form
    setEditingPresetId(null);
    setPresetSparePart('');
    setPresetSubItem('');
    setPresetUnit('ອັນ');
    setPresetPrice(0);
    setPresetError('');
    setIsCustomSubCategory(false);
    setPresetSubCategory('ລະບົບໄຟຟ້າ');
  };

  const handleEditPresetClick = (p: RepairPreset) => {
    setEditingPresetId(p.id);
    setPresetSparePart(p.sparePart);
    setPresetSubCategory(p.repairSubCategory);
    setPresetSubItem(p.repairSubItem);
    setPresetWorkType(p.workType);
    setPresetUnit(p.unit);
    setPresetPrice(p.estimatedUnitCost || 0);
    setPresetError('');
    
    const standardCategories = [
      "ລະບົບໄຟຟ້າ",
      "ລະບົບນໍ้าປະປາ & ສຸຂະພັນ",
      "ລະບົບເຄື່ອງປັບອາກາດ",
      "ລະບົບເຄືອຂ່າຍ & IT",
      "ລະບົບປ້ອງກັນອັກຄີໄພ",
      "ລະບົບໂຄງສ້າງ ແລະ ອາຄານ",
      "ຊັບສິນ",
      "ອື່ນໆ"
    ];
    setIsCustomSubCategory(!standardCategories.includes(p.repairSubCategory));
  };

  const handleDeletePresetClick = (id: string) => {
    if (!window.confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລົບແຜນຜັງ Mapping ນີ້?')) return;
    const updated = repairPresets.filter(p => p.id !== id);
    setRepairPresets(updated);
    saveRepairPresets(updated);
    triggerToast('ລົບແຜນຜັງ Mapping ສຳເລັດ!');
  };

  const handleResetPresetsToDefault = () => {
    if (window.confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການຣີເຊັດແຜນຜັງ Mapping ທັງໝົດເປັນຄ່າເລີ່ມຕົ້ນ?')) {
      setRepairPresets(DEFAULT_REPAIR_PRESETS);
      saveRepairPresets(DEFAULT_REPAIR_PRESETS);
      triggerToast('ຣີເຊັດແຜນຜັງ Mapping ເປັນຄ່າເລີ່ມຕົ້ນສຳເລັດ!');
    }
  };

  const uniqueSubCategories = Array.from(new Set([
    "ລະບົບໄຟຟ້າ",
    "ລະບົບນໍ້າປະປາ & ສຸຂະພັນ",
    "ລະບົບເຄື່ອງປັບອາກາດ",
    "ລະບົບເຄືອຂ່າຍ & IT",
    "ລະບົບປ້ອງກັນອັກຄີໄພ",
    "ລະບົບໂຄງສ້າງ ແລະ ອາຄານ",
    "ຊັບສິນ",
    "ອື່ນໆ",
    ...repairPresets.map(p => p.repairSubCategory).filter(Boolean)
  ]));

  return (
    <div className="space-y-6" id="accounts-management-container">
      {/* Top action header info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-800" />
            ຈັດການລະບົບ & ຂໍ້ມູນພື້ນຖານ (System Administration)
          </h2>
          <p className="text-xs text-slate-500 mt-1 animate-fade-in">
            ຈັດການບັນຊີຜູ້ໃຊ້, ກຳນົດສິດການເຂົ້າເຖິງແຕ່ລະໜ້າວຽກ, ແລະ ຕັ້ງຄ່າຂໍ້ມູນ ສາຂາ / ຝ່າຍ / ໜ່ວຍບໍລິການ ຂອງທະນາຄານ
          </p>
        </div>

        {activeSubTab === 'users' ? (
          <button
            onClick={handleOpenAdd}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            ເພີ່ມຜູ້ໃຊ້ໃໝ່ (Create Account)
          </button>
        ) : activeSubTab === 'checklist' ? (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold">
            <CheckSquare className="h-4 w-4 text-emerald-800" />
            ຈັດການລາຍການກວດກາ & ລະບົບ
          </div>
        ) : activeSubTab === 'sectors' ? (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold">
            <MapPin className="h-4 w-4 text-emerald-850" />
            ຈັດການຂໍ້ມູນຂະແໜງ (Sectors)
          </div>
        ) : (
          <div className="bg-amber-100 border border-amber-200 text-amber-950 text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold">
            <Building className="h-4 w-4 text-emerald-800" />
            ສິດທິສະເພາະ ຜູ້ດູແລລະບົບ (Admin Authorized)
          </div>
        )}
      </div>

      {/* Sub Tabs Selection */}
      <div
        id="accounts-subtab-navigation"
        className="flex flex-col gap-1 rounded-xl border border-cyan-300/20 bg-[#071426] p-1 shadow-[0_14px_35px_rgba(2,8,23,0.24)] sm:flex-row"
      >
        <button
          onClick={() => setActiveSubTab('users')}
          className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'users'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <Users className="h-4 w-4" />
          ຈັດການບັນຊີຜູ້ໃຊ້ ({users.length} ບັນຊີ)
        </button>
        <button
          onClick={() => setActiveSubTab('branches')}
          className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'branches'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <Building className="h-4 w-4" />
          ຈັດການ ສາຂา & ຝ່າຍ/ໜ່ວຍງານ ({branches.length} ລາຍການ)
        </button>
        <button
          onClick={() => setActiveSubTab('checklist')}
          className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'checklist'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <CheckSquare className="h-4 w-4" />
          ຈັດການ ລາຍການກວດກາ & ລະບົບ ({checklistItems.length} ລາຍການ)
        </button>
        <button
          onClick={() => setActiveSubTab('sectors')}
          className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'sectors'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <MapPin className="h-4 w-4" />
          ຈັດການ ຂະແໜງ (Sectors) ({sectors.length} ລາຍການ)
        </button>
        <button
          onClick={() => setActiveSubTab('repairPresets')}
          className={`flex-1 sm:flex-initial px-6 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
            activeSubTab === 'repairPresets'
              ? 'border-b-2 border-cyan-300 !text-cyan-200 bg-cyan-300/10 font-black shadow-[inset_0_0_22px_rgba(34,211,238,0.06)]'
              : '!text-slate-400 hover:!text-white hover:bg-white/5'
          }`}
        >
          <Wrench className="h-4 w-4" />
          ຈັດການແຜນຜັງ Mapping ({repairPresets.length} ລາຍການ)
        </button>
      </div>

      {/* TAB 1: USER ACCOUNTS AND ROLES */}
      {activeSubTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden animate-fade-in">
          {/* Top Controls Filter */}
          <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:max-w-md">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="ຄົ້ນຫາຊື່ຜູ້ໃຊ້, ສາຂາ, ບົດບາດ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-350 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={handleExportUsersExcel}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition cursor-pointer"
                title="Download filtered user list as Excel"
              >
                <Download className="h-3.5 w-3.5" />
                Export Users
              </button>
              <div className="text-[11px] text-slate-500 font-mono">
                ສະແດງທັງໝົດ: <strong className="text-slate-800 font-bold">{filteredUsers.length}</strong> ບັນຊີ
              </div>
            </div>
          </div>

          {/* Directory List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-250 uppercase tracking-wider">
                  <th className="p-4 text-center w-12">ລຳດັບ</th>
                  <th className="p-4">ຊື່ຜູ້ໃຊ້ບັນຊີ (Username)</th>
                  <th className="p-4">ລະຫັດຜ່ານ (Password)</th>
                  <th className="p-4">ບົດບາດ (Role)</th>
                  <th className="p-4">ສາຂາສັງກັດ (Branch)</th>
                  <th className="p-4">ຟັງຊັນທີ່ໄດ້ສິດເຂົ້າເຖິງ (Visible Tabs)</th>
                  <th className="p-4 text-center w-28">ຈັດການ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user, idx) => {
                  const userIndexInMain = users.findIndex(u => u.username === user.username);
                  const isSelf = user.username === currentUser.username;
                  const canSeePassword = Boolean(visiblePasswordUsers[user.username]);
                  const permissionsList = user.allowedTabs || (user.status === 'Admin' 
                    ? ['dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs', 'accounts']
                    : ['dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs']);

                  return (
                    <tr key={user.username} className={`hover:bg-slate-50/60 transition ${isSelf ? 'bg-amber-50/40' : ''}`}>
                      <td className="p-4 text-center font-mono font-bold text-slate-450">
                        {idx + 1}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2.5">
                          {user.image ? (
                            <img
                              src={user.image}
                              alt={`${user.username} avatar`}
                              className="h-8 w-8 rounded-full object-cover border border-cyan-300/60 bg-slate-100"
                            />
                          ) : (
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                              user.status === 'Admin' ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-slate-100 text-slate-800'
                            }`}>
                              {(user.username?.[0] || 'U').toUpperCase()}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 flex items-center gap-1">
                              {user.username}
                              {isSelf && (
                                <span className="text-[8.5px] bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider">
                                  ບັນຊີທ່ານ
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1 font-mono text-[11px]">
                          <span className="bg-slate-100 px-2 py-1 rounded border border-slate-200 text-slate-800 min-w-[72px] inline-block">
                            {canSeePassword ? (user.password_raw || '—') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.username)}
                            className="p-1 rounded-lg text-slate-500 hover:text-cyan-700 hover:bg-cyan-50 transition cursor-pointer"
                            aria-label={canSeePassword ? `Hide password for ${user.username}` : `Show password for ${user.username}`}
                            title={canSeePassword ? 'ເຊື່ອງລະຫັດຜ່ານ' : 'ສະແດງລະຫັດຜ່ານ'}
                          >
                            {canSeePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          user.status === 'Admin' 
                            ? 'bg-rose-100 text-rose-700 border border-rose-200' 
                            : 'bg-indigo-100 text-indigo-750 border border-indigo-200'
                        }`}>
                          <Shield className="h-3 w-3 shrink-0" />
                          {user.status === 'Admin' ? 'Admin (ຜູ້ດູແລ)' : 'Branch User'}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        🏢 {user.branch}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1 max-w-sm">
                          {permissionsList.map(tabId => {
                            const findTab = AVAILABLE_TABS.find(t => t.id === tabId);
                            const cleanLabel = findTab ? findTab.label.split(' ')[0] : tabId;
                            return (
                              <span 
                                key={tabId} 
                                className={`text-[9.5px] px-1.5 py-0.5 rounded-md font-medium border ${
                                  tabId === 'accounts' 
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 font-bold' 
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                }`}
                              >
                                ✅ {cleanLabel}
                              </span>
                            );
                          })}
                          {permissionsList.length === 0 && (
                            <span className="text-red-500 font-bold text-[9.5px]">
                              ⚠️ ບໍ່ມີສິດເຂົ້າເຖິງໃດໆ
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingUser(user)}
                            className="p-1 px-2 border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 text-slate-650 hover:text-cyan-800 font-bold rounded-lg cursor-pointer transition flex items-center gap-1"
                            title="ເບິ່ງລາຍລະອຽດ User"
                          >
                            <UserCircle className="h-3.5 w-3.5" />
                            <span className="text-[10px]">ເບິ່ງ</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(user, userIndexInMain)}
                            className="p-1 px-2 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-650 hover:text-emerald-800 font-bold rounded-lg cursor-pointer transition flex items-center gap-1"
                            title="ແກ້ໄຂສິດຜູ້ໃຊ້"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">ແກ້ໄຂ</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isSelf}
                            className={`p-1 px-2 border rounded-lg transition flex items-center gap-1 ${
                              isSelf 
                                ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50' 
                                : 'border-slate-200 text-slate-550 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                            }`}
                            title={isSelf ? "ທ່ານບໍ່ສາມາດລົບຕົວເອງໄດ້" : "ລົບຜູ້ໃຊ້"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">ລົບ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400">
                      <ShieldAlert className="h-8 w-8 mx-auto text-slate-300 mb-2 animate-bounce" />
                      ບໍ່ພົບຂໍ້ມູນບັນຊີຜູ້ໃຊ້ທີ່ຄົ້ນຫາ!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MANAGE BRANCHES & DIVISIONS */}
      {activeSubTab === 'branches' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Section: Add New Branch/Division Form Wrapper */}
          <div className="bg-white rounded-2xl p-6 border border-slate-150 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              <PlusCircle className="h-4.5 w-4.5 text-emerald-850" />
              ເພີ່ມຂໍ້ມູນ ສາຂາ ແລະ ຝ່າຍ/ໜ່ວຍບໍລິການໃໝ່ (Add New Branch & division)
            </h3>

            {branchErrorText && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-855 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {branchErrorText}
              </div>
            )}

            <form onSubmit={handleAddBranch} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. ຊື່ສາຂາ (Branch Name) *
                </label>
                <input
                  type="text"
                  placeholder="ຕົວຢ່າງ: 00.ສໍານັກງານໃຫຍ່, 05.ສາຂາຈຳປາສັກ"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                {uniqueBranches.length > 0 && (
                  <div className="mt-2 bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/70">
                    <span className="block text-[10px] font-bold text-emerald-850 mb-1">
                      💡 ໃຊ້ສາຂາເກົ່າທີ່ມີໃນລະບົບ (Or use existing branch):
                    </span>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          setNewBranchInput(e.target.value);
                        }
                      }}
                      value={uniqueBranches.includes(newBranchInput) ? newBranchInput : ""}
                      className="w-full border border-slate-200 rounded-lg p-1.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium cursor-pointer"
                    >
                      <option value="">-- ເລືອກສາຂາເກົ່າ --</option>
                      {uniqueBranches.map(br => (
                        <option key={br} value={br}>{br}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. ຝ່າຍ / ໜ່ວຍບໍລິການ (Division/Unit Name) *
                </label>
                <input
                  type="text"
                  placeholder="ຕົວຢ່າງ: ຝ່າຍບໍລິຫານອາຄານ, ໜ່ວຍບໍລິການປາກເຊ, ..."
                  value={newDivisionInput}
                  onChange={(e) => setNewDivisionInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="lg:mt-6">
                <button
                  type="submit"
                  className="w-full bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow cursor-pointer transition flex items-center justify-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  ເພີ່ມຂໍ້ມູນ (Add row)
                </button>
              </div>
            </form>
          </div>

          {/* Section: Branches Table and Search */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Top Filter Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="ຄົ້ນຫາຊື່ສາຂາ, ຝ່າຍ..."
                  value={branchSearchTerm}
                  onChange={(e) => setBranchSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-mono shrink-0">
                ລວມທັງໝົດ: <strong className="text-slate-800 font-bold">{filteredBranches.length}</strong> ລາຍການ
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-250 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">ລຳດັບ</th>
                    <th className="p-4">ຊື່ສາຂາ (Branch Name)</th>
                    <th className="p-4">ຝ່າຍ / ໜ່ວຍບໍລິການ (Division/Department)</th>
                    <th className="p-4 text-center w-28">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredBranches.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-900 flex items-center gap-1.5">
                        <Building className="h-4 w-4 text-emerald-800 shrink-0" />
                        {item.ສາຂາ}
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        📁 {item["ຝ່າຍ/ໜ່ວຍບໍລິການ"] || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteBranch(item)}
                          className="p-1 px-3 border border-slate-200 text-slate-550 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-250 rounded-lg cursor-pointer transition flex items-center justify-center gap-1 mx-auto"
                          title="ລຶບລາຍການສາຂາ/ຝ່າຍ"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="text-[10px]">ລຶບ</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        <MapPin className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        ບໍ່ພົບຂໍ້ມູນສາຂາ ຫຼື ຝ່າຍບໍລິການ ທີ່ຄົ້ນຫາ!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: MANAGE CHECKLIST ITEMS & SYSTEM CATEGORIES */}
      {activeSubTab === 'checklist' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section: Add New Checklist Item Form Wrapper */}
          <div className="bg-white rounded-2xl p-6 border border-slate-150 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4">
              {editingChecklistItem ? (
                <>
                  <Edit2 className="h-4.5 w-4.5 text-emerald-850 animate-pulse" />
                  <span>ແກ້ໄຂລາຍການກວດກາ (Edit Checklist Item)</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4.5 w-4.5 text-emerald-850" />
                  <span>ເພີ່ມລາຍການກວດກາ ແລະ ພື້ນທີ່/ຈຸດກວດ ໃໝ່ (Add New Checklist & Area/Point)</span>
                </>
              )}
            </h3>

            {checklistErrorText && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-850 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {checklistErrorText}
              </div>
            )}

            <form onSubmit={handleAddChecklistItem} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* System Category Select/Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    1. ລະບົບທີ່ກວດ (System Category) *
                  </label>
                  {!isCustomSystem ? (
                    <select
                      value={newChecklistSystem}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomSystem(true);
                          setNewChecklistSystem('');
                        } else {
                          setNewChecklistSystem(val);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                    >
                      <option value="">-- ເລືອກລະບົບທີ່ກວດ --</option>
                      {Array.from(new Set(checklistItems.map(item => item.ລະບົບທີ່ກວດ))).sort().map((sys, idx) => (
                        <option key={idx} value={sys}>{sys}</option>
                      ))}
                      <option value="__custom__" className="text-emerald-750 font-bold">+ ປ້ອນລະບົບໃໝ່ (Enter Custom System)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="...ປ້ອນຊື່ລະບົບໃໝ່"
                        value={newChecklistSystem}
                        onChange={(e) => setNewChecklistSystem(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSystem(false);
                          setNewChecklistSystem('');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 rounded-xl px-3 text-xs shrink-0 font-bold"
                      >
                        ເລືອກຈາກລາຍການ
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub category Select/Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    2. ພື້ນທີ່/ຈຸດກວດ ( Area / Point) *
                  </label>
                  {!isCustomCategory ? (
                    <select
                      value={newChecklistCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomCategory(true);
                          setNewChecklistCategory('');
                        } else {
                          setNewChecklistCategory(val);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                    >
                      <option value="">-- ເລືອກ ພື້ນທີ່/ຈຸດກວດ --</option>
                      {Array.from(
                        new Set(
                          checklistItems
                            .filter(item => !newChecklistSystem || item.ລະບົບທີ່ກວດ === newChecklistSystem)
                            .map(item => item.ໝວດລະບົບກວດ)
                        )
                      ).sort().map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__" className="text-emerald-750 font-bold">+ ປ້ອນ ພື້ນທີ່/ຈຸດກວດ ໃໝ່ (Enter Custom Area/Point)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="...ປ້ອນຊື່ ພື້ນທີ່/ຈຸດກວດ"
                        value={newChecklistCategory}
                        onChange={(e) => setNewChecklistCategory(e.target.value)}
                        className="flex-1 border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomCategory(false);
                          setNewChecklistCategory('');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 rounded-xl px-3 text-xs shrink-0 font-bold"
                      >
                        ເລືອກຈາກລາຍການ
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    3. ປະເພດຟອມ (Form Type) *
                  </label>
                  <select
                    value={newChecklistFormType}
                    onChange={(e) => setNewChecklistFormType(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="ສຳນັກງານໃຫຍ່">ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>
                    <option value="ສາຂາ">ຟອມ ສາຂາ (Branch)</option>
                    <option value="ໜ່ວຍບໍລິການ">ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>
                    <option value="ຫ້ອງຮັບເງິນ">ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>
                  </select>
                </div>
              </div>

              {/* Inspection Item Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  4. ລາຍການກວດກາ (Inspection Item Description) *
                </label>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                  <input
                    type="text"
                    required
                    placeholder="ຕົວຢ່າງ: ກວດເຊັກການເຮັດວຽກຂອງກ້ອງປົກກະຕິ, ກວດກາຄວາມສະອາດຂອງພື້ນ..."
                    value={newChecklistInspection}
                    onChange={(e) => setNewChecklistInspection(e.target.value)}
                    className="flex-1 border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                  {editingChecklistItem ? (
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="submit"
                        className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow cursor-pointer transition flex items-center justify-center gap-1.5"
                      >
                        <Save className="h-4 w-4" />
                        ບັນທຶກການແກ້ໄຂ (Save Changes)
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditChecklistItem}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer transition flex items-center justify-center gap-1"
                      >
                        <X className="h-4 w-4" />
                        ຍົກເລີກ (Cancel)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow cursor-pointer transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Save className="h-4 w-4" />
                      ເພີ່ມຂໍ້ມູນລາຍການກວດ (Add item)
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* Section: Checklist Table and Search */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Top Filter Controls */}
            <div className="p-4 bg-slate-50 border-b border-slate-150 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:max-w-2xl">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    placeholder="ຄົ້ນຫາ ລະບົບ, ພື້ນທີ່/ຈຸດກວດ ຫຼື ລາຍການ...."
                    value={checklistSearchTerm}
                    onChange={(e) => setChecklistSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                
                {/* Form Type Filter */}
                <select
                  value={checklistFormTypeFilter}
                  onChange={(e) => setChecklistFormTypeFilter(e.target.value)}
                  className="border border-slate-300 rounded-xl p-2 px-3 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer font-bold font-sans"
                >
                  <option value="ALL">ທຸກໆປະເພດຟອມ (All Forms)</option>
                  <option value="ສຳນັກງານໃຫຍ່">🏢 ຟອມ ສຳນັກງານໃຫຍ່ (HQ)</option>
                  <option value="ສາຂາ">🏛️ ຟອມ ສາຂາ (Branch)</option>
                  <option value="ໜ່ວຍບໍລິການ">🏪 ຟອມ ໜ່ວຍບໍລິການ (Service Unit)</option>
                  <option value="ຫ້ອງຮັບເງິນ">💰 ຟອມ ຫ້ອງຮັບເງິນ (Cash Office)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
                <div className="text-[11px] text-slate-500 font-mono">
                  ລວມທັງໝົດ: <strong className="text-slate-800 font-bold">{filteredChecklistItems.length}</strong> ລາຍການ
                </div>
                
                <button
                  type="button"
                  onClick={handleResetChecklistToDefault}
                  className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold py-1.5 px-3 rounded-xl cursor-pointer transition flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                  ຣີເຊັດຄ່າເລີ່ມຕົ້ນ (Reset)
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-250 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">ລຳດັບ</th>
                    <th className="p-4 w-1/5">ລະບົບທີ່ກວດ (System Category)</th>
                    <th className="p-4 w-1/5">ພື້ນທີ່/ຈຸດກວດ ( Area / Point)</th>
                    <th className="p-4 w-44 text-center">ປະເພດຟອມ (Form Type)</th>
                    <th className="p-4 w-1/3">ລາຍການກວດກາ (Inspection Item)</th>
                    <th className="p-4 text-center w-28">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredChecklistItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-900 truncate" title={item.ລະບົບທີ່ກວດ}>
                        🛡️ {item.ລະບົບທີ່ກວດ}
                      </td>
                      <td className="p-4 font-semibold text-slate-700 truncate" title={item.ໝວດລະບົບກວດ}>
                        📦 {item.ໝວດລະບົບກວດ}
                      </td>
                      <td className="p-4 text-center">
                        {item.Form_Type === "ສຳນັກງານໃຫຍ່" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            🏢 ສຳນັກງານໃຫຍ່
                          </span>
                        ) : item.Form_Type === "ສາຂາ" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            🏛️ ສາຂາ
                          </span>
                        ) : item.Form_Type === "ໜ່ວຍບໍລິການ" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            🏪 ໜ່ວຍບໍລິການ
                          </span>
                        ) : item.Form_Type === "ຫ້ອງຮັບເງິນ" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            💰 ຫ້ອງຮັບເງິນ
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-650 border border-slate-200">
                            🏛️ {item.Form_Type || "ສາຂາ"}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-650 font-medium break-words">
                        {item.ລາຍການກວດ}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditChecklistItemClick(item)}
                            className={`p-1 px-2.5 border rounded-lg cursor-pointer transition flex items-center justify-center gap-1 ${
                              editingChecklistItem === item
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'border-slate-200 text-slate-550 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-250'
                            }`}
                            title="ແກ້ໄຂລາຍການກວດກາ"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">ແກ້ໄຂ</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(item)}
                            className="p-1 px-2.5 border border-slate-200 text-slate-550 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-250 rounded-lg cursor-pointer transition flex items-center justify-center gap-1"
                            title="ລຶບລາຍການກວດກາ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">ລຶບ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredChecklistItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <CheckSquare className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        ບໍ່ພົບຂໍ້ມູນລາຍການກວດກາ ທີ່ຄົ້ນຫາ!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: MANAGE SECTORS */}
      {activeSubTab === 'sectors' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section: Add New Sector Form Wrapper */}
          <div className="bg-white rounded-2xl p-6 border border-slate-150 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 font-sans">
              <PlusCircle className="h-4.5 w-4.5 text-emerald-850" />
              ເພີ່ມຂໍ້ມູນຂະແໜງໃໝ່ (Add New Sector)
            </h3>

            {sectorErrorText && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-850 text-xs font-semibold flex items-center gap-2 font-sans">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {sectorErrorText}
              </div>
            )}

            <form onSubmit={handleAddSector} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                  ຊື່ຂະແໜງ (Sector Name) *
                </label>
                <input
                  type="text"
                  placeholder="ຕົວຢ່າງ: ຂະແໜງກວດກາໄອທີ, ຂະແໜງບໍລິຫານ..."
                  value={newSectorInput}
                  onChange={(e) => setNewSectorInput(e.target.value)}
                  className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium font-sans"
                />
              </div>

              <div className="lg:col-span-1">
                <button
                  type="submit"
                  className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2.8 px-4 rounded-xl shadow-md hover:shadow-lg cursor-pointer transition flex items-center justify-center gap-1.5 h-[38px] leading-none font-sans"
                >
                  <PlusCircle className="h-4 w-4" />
                  ເພີ່ມຂໍ້ມູນຂະແໜງ (Add Sector)
                </button>
              </div>
            </form>
          </div>

          {/* Section: Sectors List Table and Search */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="ຄົ້ນຫາ ຂະແໜງ (Search Sectors)..."
                  value={sectorSearchTerm}
                  onChange={(e) => setSectorSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-350 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-sans"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-medium font-mono">
                ລວມທັງໝົດ: <strong className="text-slate-800 font-bold">{sectors.filter(s => s.ຂະແໜງ !== "none" && s.ຂະແໜງ.toLowerCase().includes(sectorSearchTerm.toLowerCase())).length}</strong> ລາຍການ
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs text-slate-755 font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-150 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">ລຳດັບ</th>
                    <th className="p-4">ຂະແໜງ (Sector Name)</th>
                    <th className="p-4 text-center w-28">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {sectors
                    .filter(s => s.ຂະແໜງ !== "none" && s.ຂະແໜງ.toLowerCase().includes(sectorSearchTerm.toLowerCase()))
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-4 text-slate-800 font-medium">✨ {item.ຂະແໜງ}</td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSector(item)}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto border border-transparent hover:border-rose-100 cursor-pointer"
                            title="ລຶບຂະແໜງ"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            ລຶບ
                          </button>
                        </td>
                      </tr>
                    ))}

                  {sectors.filter(s => s.ຂະແໜງ !== "none" && s.ຂະແໜງ.toLowerCase().includes(sectorSearchTerm.toLowerCase())).length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-slate-400">
                        <MapPin className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        ບໍ່ພົບຂໍ້ມູນຂະແໜງທີ່ຄົ້ນຫາ!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: MANAGE REPAIR PRESETS MAPPING */}
      {activeSubTab === 'repairPresets' && (
        <div className="space-y-6 animate-fade-in" id="repair-presets-tab-wrapper">
          {/* Section: Add/Edit Preset Mapping Form */}
          <div className="bg-white rounded-2xl p-6 border border-slate-150 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-4 font-sans">
              <PlusCircle className="h-4.5 w-4.5 text-emerald-850" />
              {editingPresetId ? 'ແກ້ໄຂແຜນຜັງ Mapping (Edit Mapping)' : 'ເພີ່ມແຜນຜັງ Mapping ໃໝ່ (Add New Mapping)'}
            </h3>

            {presetError && (
              <div className="mb-4 p-3 bg-rose-50 border-l-4 border-rose-500 rounded text-rose-850 text-xs font-semibold flex items-center gap-2 font-sans">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {presetError}
              </div>
            )}

            <form onSubmit={handleSavePreset} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Spare Part/Service */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    ອະໄຫຼ່/ຄ່າບໍລິການ (Spare Part / Service) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ຕົວຢ່າງ: ດອກໄຟ LED 18W, ບໍລິການລ້າງແອ..."
                    value={presetSparePart}
                    onChange={(e) => setPresetSparePart(e.target.value)}
                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  />
                </div>

                {/* Subcategory */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    ໝວດຍ່ອຍລາຍການສ້ອມ (Subcategory) *
                  </label>
                  {!isCustomSubCategory ? (
                    <select
                      value={presetSubCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__custom__') {
                          setIsCustomSubCategory(true);
                          setPresetSubCategory('');
                        } else {
                          setPresetSubCategory(val);
                        }
                      }}
                      className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans cursor-pointer"
                    >
                      {uniqueSubCategories.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__" className="text-emerald-700 font-bold">+ ປ້ອນໝວດຍ່ອຍໃໝ່ (Custom Subcategory)...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="...ປ້ອນຊື່ໝວດຍ່ອຍໃໝ່"
                        value={presetSubCategory}
                        onChange={(e) => setPresetSubCategory(e.target.value)}
                        className="flex-1 border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSubCategory(false);
                          setPresetSubCategory('ລະບົບໄຟຟ້າ');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl px-3 text-xs shrink-0 font-bold font-sans transition-colors"
                      >
                        ເລືອກຈາກລາຍການ
                      </button>
                    </div>
                  )}
                </div>

                {/* Repair Sub Item */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    ລາຍການສ້ອມຍ່ອຍ (Repair Sub-item) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ຕົວຢ່າງ: ຫຼອດໄຟເສຍ, ແອເຢັນບໍ່ພໍ..."
                    value={presetSubItem}
                    onChange={(e) => setPresetSubItem(e.target.value)}
                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    ຫົວໜ່ວຍ (Unit) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ຕົວຢ່າງ: ອັນ, ເຄື່ອງ, ດອກ, ຄັ້ງ, ຖັງ..."
                    value={presetUnit}
                    onChange={(e) => setPresetUnit(e.target.value)}
                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 justify-end">
                {editingPresetId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPresetId(null);
                      setPresetSparePart('');
                      setPresetSubItem('');
                      setPresetUnit('ອັນ');
                      setPresetPrice(0);
                      setPresetError('');
                    }}
                    className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition flex items-center gap-1.5 h-[38px]"
                  >
                    <X className="h-4 w-4" />
                    ຍົກເລີກ (Cancel)
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-6 rounded-xl shadow-md hover:shadow-lg cursor-pointer transition flex items-center gap-1.5 h-[38px]"
                >
                  <Save className="h-4 w-4" />
                  {editingPresetId ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມແຜນຜັງ Mapping'}
                </button>
              </div>
            </form>
          </div>

          {/* Section: Presets List Table and Search */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative w-full sm:max-w-md">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </span>
                <input
                  type="text"
                  placeholder="ຄົ້ນຫາ ອະໄຫຼ່, ໝວດຍ່ອຍ, ລາຍການສ້ອມ..."
                  value={presetsSearchTerm}
                  onChange={(e) => setPresetsSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-350 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-sans"
                />
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={handleResetPresetsToDefault}
                  className="border border-slate-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold text-xs py-2 px-4 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm font-sans"
                >
                  <RotateCcw className="h-4 w-4" />
                  ຣີເຊັດເປັນຄ່າເລີ່ມຕົ້ນ (Reset to Default)
                </button>
                <div className="text-[11px] text-slate-500 font-medium font-mono">
                  ລວມທັງໝົດ: <strong className="text-slate-800 font-bold">
                    {repairPresets.filter(p => 
                      p.sparePart.toLowerCase().includes(presetsSearchTerm.toLowerCase()) ||
                      p.repairSubCategory.toLowerCase().includes(presetsSearchTerm.toLowerCase()) ||
                      p.repairSubItem.toLowerCase().includes(presetsSearchTerm.toLowerCase())
                    ).length}
                  </strong> ລາຍການ
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs text-slate-755 font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-150 uppercase tracking-wider">
                    <th className="p-4 text-center w-12 font-sans">ລຳດັບ</th>
                    <th className="p-4 font-sans">ອະໄຫຼ່/ຄ່າບໍລິການ</th>
                    <th className="p-4 font-sans">ໝວດຍ່ອຍ</th>
                    <th className="p-4 font-sans">ລາຍການສ້ອມຍ່ອຍ</th>
                    <th className="p-4 font-sans">ຫົວໜ່ວຍ</th>
                    <th className="p-4 text-center w-36 font-sans">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {repairPresets
                    .filter(p => 
                      p.sparePart.toLowerCase().includes(presetsSearchTerm.toLowerCase()) ||
                      p.repairSubCategory.toLowerCase().includes(presetsSearchTerm.toLowerCase()) ||
                      p.repairSubItem.toLowerCase().includes(presetsSearchTerm.toLowerCase())
                    )
                    .map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition font-sans">
                        <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-4 text-slate-950 font-bold">{item.sparePart}</td>
                        <td className="p-4">
                          <span className="px-2 py-1 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-900 border border-emerald-100">
                            {item.repairSubCategory}
                          </span>
                        </td>
                        <td className="p-4 text-slate-700 font-medium">{item.repairSubItem}</td>
                        <td className="p-4 text-slate-600">{item.unit}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              type="button"
                              onClick={() => handleEditPresetClick(item)}
                              className="text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-transparent hover:border-emerald-100 cursor-pointer"
                              title="ແກ້ໄຂ Mapping"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              ແກ້ໄຂ
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePresetClick(item.id)}
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-transparent hover:border-rose-100 cursor-pointer"
                              title="ລຶບ Mapping"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              ລຶບ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {repairPresets.filter(p => 
                    p.sparePart.toLowerCase().includes(presetsSearchTerm.toLowerCase()) ||
                    p.repairSubCategory.toLowerCase().includes(presetsSearchTerm.toLowerCase()) ||
                    p.repairSubItem.toLowerCase().includes(presetsSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <Wrench className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        ບໍ່ພົບຂໍ້ມູນແຜນຜັງ Mapping ທີ່ຄົ້ນຫາ!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Modal Dialog for Adding / Editing Users */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-800 transform scale-100 transition animate-scale-up">
            
            {/* Header */}
            <div className="bg-slate-100 p-5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-emerald-850" />
                <h3 className="font-bold text-slate-900 text-sm">
                  {editingIndex === null ? 'ເພີ່ມບັນຊີຜູ້ໃຊ້ໃໝ່' : `ແກ້ໄຂສິດ ແລະ ຂໍ້ມູນ "${username}"`}
                </h3>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-200 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave}>
              {/* Error area */}
              {errorText && (
                <div className="mx-6 mt-4 p-3 bg-rose-50 border-l-4 border-rose-500 text-rose-750 text-xs font-semibold rounded">
                  ⚠️ {errorText}
                </div>
              )}

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ຊື່ຜູ້ໃຊ້ເຂົ້າລະບົບ (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                    disabled={editingIndex !== null} // cannot change username once established for simplicity
                    placeholder="ຕົວຢ່າງ: phone, ldb-staff-12"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {editingIndex !== null && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      * ຊື່ຜູ້ໃຊ້ຢືນຢັນແລ້ວ ບໍ່ສາມາດປ່ຽນແປງໄດ້
                    </span>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ລະຫັດຜ່ານ (Password) *
                  </label>
                  <input
                    type="password"
                    required={editingIndex === null}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="ປ້ອນລະຫັດຜ່ານບັນຊີ"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800"
                  />
                </div>

                {/* Optional User Image */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    ຮູບ User (Optional Avatar URL)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center overflow-hidden shrink-0">
                      {image ? (
                        <img src={image} alt="User preview" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                    <input
                      type="url"
                      value={image}
                      onChange={(e) => setImage(e.target.value)}
                      placeholder="https://... (ບໍ່ບັງຄັບ)"
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800"
                    />
                  </div>
                </div>

                {/* Role Switch & Branch selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ບົດບາດ / ລະດັບສິດ (Status/Role) *
                    </label>
                    <select
                      value={status}
                      onChange={(e) => {
                        const newStatus = e.target.value;
                        setStatus(newStatus);
                        // If switching to Admin, grant all tabs as default
                        if (newStatus === 'Admin') {
                          setAllowedTabs(['dashboard', 'pm', 'inspections', 'incidents', 'approvals', 'tracking', 'repairs', 'accounts']);
                        }
                      }}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="User">Branch User (ພະນັກງານສາຂາ)</option>
                      <option value="Admin">Admin (ຜູ້ດູແລລະບົບທົ່ວໄປ)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      ສາຂາສັງກັດ (Branch) *
                    </label>
                    <select
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {uniqueBranches.map(br => (
                        <option key={br} value={br}>{br}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Checkbox Permission Modules List */}
                <div className="pt-2 border-t border-slate-200">
                  <span className="block text-xs font-bold text-slate-700 mb-2">
                    🔑 ກຳນົດສິດການເຂົ້າເຖິງ ໜ້າ/ຟັງຊັນ (Module Tab Visibility):
                  </span>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2.5">
                    {AVAILABLE_TABS.map(tab => {
                      const isChecked = allowedTabs.includes(tab.id);
                      return (
                        <label 
                          key={tab.id}
                          className="flex items-start space-x-2.5 p-2 rounded-lg hover:bg-white transition cursor-pointer select-none border border-transparent hover:border-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleTabPermission(tab.id)}
                            className="mt-0.5 rounded border-slate-300 text-emerald-800 focus:ring-emerald-500 cursor-pointer h-4 w-4 shrink-0"
                          />
                          <div>
                            <span className="text-xs font-bold text-slate-800 block">
                              {tab.label}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Action buttons footer */}
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
                >
                  ຍົກເລີກ (Cancel)
                </button>
                <button
                  type="submit"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  ບັນທຶກ (Save Account)
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* CUSTOM DIALOGS & NOTIFICATION TOASTS OVERLAYS       */}
      {/* ---------------------------------------------------- */}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-900 border border-emerald-700/50 shadow-2xl text-white text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2.5 animate-slide-in">
          <Check className="h-4 w-4 text-emerald-300 stroke-[3px]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* System Alert Modal (replaces native alert()) */}
      {systemAlertMessage && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 p-6 space-y-4 animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <AlertCircle className="h-6 w-6 stroke-[2.5px]" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                ແຈ້ງເຕືອນລະບົບ (System Notification)
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                {systemAlertMessage}
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => setSystemAlertMessage(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-6 rounded-xl cursor-pointer transition shadow-xs"
              >
                ຕົກລົງ (OK)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details View Modal */}
      {viewingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 animate-scale-up">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-cyan-300" />
                <h3 className="font-bold text-sm">ລາຍລະອຽດ User (User View)</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingUser(null)}
                className="text-slate-300 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                {viewingUser.image ? (
                  <img
                    src={viewingUser.image}
                    alt={`${viewingUser.username} avatar`}
                    className="h-16 w-16 rounded-full object-cover border border-cyan-300 shadow-sm"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-slate-100 border border-slate-250 flex items-center justify-center text-xl font-black text-slate-700">
                    {(viewingUser.username?.[0] || 'U').toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-lg font-black text-slate-950">{viewingUser.username}</p>
                  <p className="text-xs text-slate-500">{viewingUser.status === 'Admin' ? 'Admin' : 'Branch User'} · {viewingUser.branch || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold text-slate-500 mb-1">Password</p>
                  <p className="font-mono text-slate-900">••••••••</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold text-slate-500 mb-1">User Image</p>
                  <p className="font-semibold text-slate-900">{viewingUser.image ? 'Configured' : 'Not configured'}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="font-bold text-slate-500 mb-2 text-xs">Visible Tabs</p>
                <div className="flex flex-wrap gap-1.5">
                  {(viewingUser.allowedTabs || []).map(tabId => {
                    const findTab = AVAILABLE_TABS.find(t => t.id === tabId);
                    return (
                      <span key={tabId} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 font-bold">
                        ✅ {findTab ? findTab.label : tabId}
                      </span>
                    );
                  })}
                  {(!viewingUser.allowedTabs || viewingUser.allowedTabs.length === 0) && (
                    <span className="text-[10px] text-slate-500">No custom tab permissions</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingUser(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2 px-5 rounded-xl cursor-pointer transition shadow-xs"
                >
                  ປິດ (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteUserConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 p-6 space-y-4 animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                ຢືນຢັນການລຶບຜູ້ໃຊ້?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                ທ່ານຕ້ອງການລຶບບັນຊີຜູ້ໃຊ້ <strong className="text-slate-900 font-bold">"{deleteUserConfirm.username}"</strong> ແທ້ຫຼີບໍ່? ການດຳເນີນການນີ້ບໍ່ສາມາດຍົກເລີກໄດ້.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteUserConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteUser}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                ຍືນຢັນລຶບ (Confirm Delete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Branch/Division Confirmation Modal */}
      {deleteBranchConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 p-6 space-y-4 animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Building className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                ຢືນຢັນການລຶບ ສາຂາ / ຝ່າຍ?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                ທ່ານຕ້ອງການລຶບຂໍ້ມູນ ສາຂາ: <strong className="text-slate-900 font-bold">"{deleteBranchConfirm.ສາຂາ}"</strong> <br/>
                ຝ່າຍ/ໜ່ວຍງານ: <strong className="text-slate-900 font-bold">"{deleteBranchConfirm["ຝ່າຍ/ໜ່ວຍບໍລິການ"]}"</strong> ຫຼີບໍ່?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteBranchConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteBranch}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                ຍືນຢັນລຶບ (Confirm Delete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Checklist Item Confirmation Modal */}
      {deleteChecklistItemConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 p-6 space-y-4 animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                ຢືນຢັນການລຶບລາຍການກວດກາ?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed text-left">
                • <strong>ລະບົບ:</strong> {deleteChecklistItemConfirm.ລະບົບທີ່ກວດ} <br/>
                • <strong>ໝວດລະບົບບໍລິການ:</strong> {deleteChecklistItemConfirm.ໝວດລະບົບກວດ} <br/>
                • <strong>ລາຍການກວດກາ:</strong> {deleteChecklistItemConfirm.ລາຍການກວດ}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteChecklistItemConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteChecklistItem}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                ຍືນຢັນລຶບ (Confirm Delete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Sector Confirmation Modal */}
      {deleteSectorConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 p-6 space-y-4 animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                <MapPin className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                ຢືນຢັນການລຶບຂະແໜງ?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed text-center font-sans">
                ທ່ານຕ້ອງການລຶບຂໍ້ມູນ ຂະແໜງ: <strong className="text-slate-900 font-bold">"{deleteSectorConfirm.ຂະແໜງ}"</strong> ແທ້ຫຼີບໍ່?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setDeleteSectorConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteSector}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                ຍືນຢັນລຶບ (Confirm Delete)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Checklist Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-100 overflow-hidden text-slate-850 p-6 space-y-4 animate-scale-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                <RotateCcw className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                ຢືນຢັນການຣີເຊັດລາຍການກວດກາ?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed text-center font-sans">
                ທ່ານຕ້ອງການຣີເຊັດລາຍການກວດກາທັງໝົດກັບໄປເປັນຄ່າເລີ່ມຕົ້ນລະບົບຫຼີບໍ່? ຂໍ້ມູນທີ່ທ່ານເພີ່ມໃໝ່ທັງໝົດຈະຖືກລຶບອອກ.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                ຍົກເລີກ (Cancel)
              </button>
              <button
                type="button"
                onClick={executeResetChecklist}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                ຍືນຢັນຣີເຊັດ (Confirm Reset)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
