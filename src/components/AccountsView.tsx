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
import { uploadCentralFile } from '../centralDataStore';

interface AccountsViewProps {
  currentUser: UserAccount;
  users: UserAccount[];
  onSaveUsers: (updatedUsers: UserAccount[]) => void | Promise<void>;
  onUpdateCurrentUser: (updatedUser: UserAccount) => void;
  branches: BranchInfo[];
  onSaveBranches: (updatedBranches: BranchInfo[]) => void | Promise<void>;
  checklistItems: ChecklistItem[];
  onSaveChecklistItems: (updatedItems: ChecklistItem[]) => void | Promise<void>;
  sectors: SectorInfo[];
  onSaveSectors: (updatedSectors: SectorInfo[]) => void | Promise<void>;
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
  const [presetSubCategory, setPresetSubCategory] = useState('àº¥àº°àºšàº»àºšà»„àºŸàºŸà»‰àº²');
  const [isCustomSubCategory, setIsCustomSubCategory] = useState(false);
  const [presetSubItem, setPresetSubItem] = useState('');
  const [presetWorkType, setPresetWorkType] = useState('àº›à»ˆàº½àº™àº­àº°à»„àº«àº¼à»ˆ');
  const [presetUnit, setPresetUnit] = useState('àº­àº±àº™');
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
  const [newChecklistFormType, setNewChecklistFormType] = useState('àºªàº²àº‚àº²');
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

  const persistUserList = async (nextUsers: UserAccount[], successMessage: string, rollbackUsers = users) => {
    try {
      await onSaveUsers(nextUsers);
      triggerToast(successMessage);
    } catch (error) {
      console.error('Failed to save user permissions:', error);
      try {
        await onSaveUsers(rollbackUsers);
      } catch (rollbackError) {
        console.error('Failed to rollback user permissions:', rollbackError);
      }
      setSystemAlertMessage('àºšà»à»ˆàºªàº²àº¡àº²àº”àºšàº±àº™àº—àº¶àº/àº¥àº¶àºšàº‚à»à»‰àº¡àº¹àº™àºœàº¹à»‰à»ƒàºŠà»‰à»„àº”à»‰. àºàº°àº¥àº¸àº™àº²àºàº§àº”à»€àºŠàº±àºàºàº²àº™à»€àºŠàº·à»ˆàº­àº¡àº•à»à»ˆ à»àº¥à»‰àº§àº¥àº­àº‡à»ƒà»à»ˆ.');
    }
  };

  const safeAccountText = (value: unknown): string => (
    value === null || value === undefined ? '' : String(value)
  );

  const safeIncludes = (value: unknown, query: string): boolean => (
    safeAccountText(value).toLocaleLowerCase('en-US').includes(query.toLocaleLowerCase('en-US'))
  );

  const safeEquals = (value: unknown, target: unknown): boolean => (
    safeAccountText(value).trim().toLocaleLowerCase('en-US') ===
    safeAccountText(target).trim().toLocaleLowerCase('en-US')
  );

  // Search filter for Users
  const filteredUsers = users.filter(user =>
    safeIncludes(user.username, searchTerm) ||
    safeIncludes(user.branch, searchTerm) ||
    safeIncludes(user.status, searchTerm)
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

  const getStoredPasswordValue = (user: UserAccount) => {
    const passwordValue =
      user.password_raw ||
      (user as UserAccount & { passwordRaw?: string }).passwordRaw ||
      (user as UserAccount & { password?: string }).password ||
      '';

    return String(passwordValue).trim();
  };

  const getVisiblePasswordValue = (user: UserAccount) => (
    getStoredPasswordValue(user) || 'àºšà»à»ˆàº¡àºµàº¥àº°àº«àº±àº”'
  );
  const handleAvatarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErrorText('Please select an image file only.');
      event.target.value = '';
      return;
    }

    try {
      const rawId = username.trim() || `user-avatar-${Date.now()}`;
      const safeUserId = rawId
        .normalize('NFKC')
        .toLocaleLowerCase('en-US')
        .replace(/[^a-z0-9._-]/gi, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || `user-avatar-${Date.now()}`;
      const uploaded = await uploadCentralFile(file, {
        fileName: `${safeUserId}-${file.name}`,
        entityType: 'users',
        entityId: safeUserId,
      });
      setImage(uploaded.url);
      setErrorText('');
    } catch (error) {
      console.error('Failed to upload user avatar to R2:', error);
      setErrorText('Unable to upload the user image to R2. Please sign in to Production and try again.');
      event.target.value = '';
    }
  };

  // Search filter for Branches/Divisions
  const filteredBranches = branches.filter(item =>
    safeIncludes(item["àºªàº²àº‚àº²"], branchSearchTerm) ||
    safeIncludes(item["àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™"], branchSearchTerm)
  );

  // Search filter for Checklist items
  const filteredChecklistItems = checklistItems.filter((item: any) => {
    const matchesSearch = safeIncludes(item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"], checklistSearchTerm) ||
      safeIncludes(item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"], checklistSearchTerm) ||
      safeIncludes(item["àº¥àº²àºàºàº²àº™àºàº§àº”"], checklistSearchTerm);
    const matchesFormType = checklistFormTypeFilter === 'ALL' || 
      (item.Form_Type && item.Form_Type.trim() === checklistFormTypeFilter.trim());
    return matchesSearch && matchesFormType;
  });

  const filteredSectors = sectors.filter(s =>
    safeAccountText(s["àº‚àº°à»à»œàº‡"]) !== "none" &&
    safeIncludes(s["àº‚àº°à»à»œàº‡"], sectorSearchTerm)
  );

  const filteredRepairPresets = repairPresets.filter(p =>
    safeIncludes(p.sparePart, presetsSearchTerm) ||
    safeIncludes(p.repairSubCategory, presetsSearchTerm) ||
    safeIncludes(p.repairSubItem, presetsSearchTerm)
  );
  
  // Cleaned up dummy block
  //
    //
    //
    //
    // Cleaned up end block

  const uniqueBranches = Array.from(new Set(branches.map(b => b["àºªàº²àº‚àº²"]))).sort();

  // Define full list of functional tabs
  const AVAILABLE_TABS = [
    { id: 'dashboard', label: 'à»àºœàº‡àº„àº§àºšàº„àº¸àº¡ (Dashboard Monitor)' },
    { id: 'pm', label: 'àºàº²àº™àºšàº³àº¥àº¸àº‡àº®àº±àºàºªàº² (Preventive Maintenance)' },
    { id: 'inspections', label: 'àºàº²àº™àºàº§àº”àºàº²àº­àº²àº„àº²àº™ (Inspections)' },
    { id: 'incidents', label: 'àº—àº°àºšàº½àº™à»€àº«àº”àºàº²àº™ & àº„àº§àº²àº¡àºªà»ˆàº½àº‡ (Incidents)' },
    { id: 'approvals', label: 'àº¥àº²àºàºàº²àº™àº­àº°àº™àº¸àº¡àº±àº”àºªà»‰àº­àº¡à»àº›àº‡ (Repair Approvals)' },
    { id: 'tracking', label: 'àº•àº´àº”àº•àº²àº¡àºàº²àº™àºªà»‰àº­àº¡à»àº›àº‡ (Repair Tracking)' },
    { id: 'repairs', label: 'àº›àº°àº«àº§àº±àº”àºàº²àº™àºªà»‰àº­àº¡à»àº›àº‡ (Repair Logs)' },
    { id: 'accounts', label: 'àºˆàº±àº”àºàº²àº™àºªàº´àº”àºœàº¹à»‰à»ƒàºŠà»‰ (User Permissions)' }
  ];

  const toggleTabPermission = (tabId: string) => {
    if (allowedTabs.includes(tabId)) {
      if (editingIndex !== null && users[editingIndex].username === currentUser.username && tabId === 'accounts') {
        setSystemAlertMessage("àº—à»ˆàº²àº™àºšà»à»ˆàºªàº²àº¡àº²àº”àº›àº´àº”àºªàº´àº”àº—àº´à»ƒàº™àºàº²àº™à»€àº‚àº»à»‰àº²à»€àº–àº´àº‡ à»œà»‰àº²àºˆàº±àº”àºàº²àº™àºªàº´àº”àºœàº¹à»‰à»ƒàºŠà»‰ àº‚àº­àº‡àº•àº»àº§àº—à»ˆàº²àº™à»€àº­àº‡à»„àº”à»‰!");
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
      setSystemAlertMessage("àº—à»ˆàº²àº™àºšà»à»ˆàºªàº²àº¡àº²àº”àº¥àº»àºš àºšàº±àº™àºŠàºµàº—àºµà»ˆàºàº³àº¥àº±àº‡à»ƒàºŠà»‰àº‡àº²àº™àº¢àº¹à»ˆ (Your Own Account) à»„àº”à»‰!");
      return;
    }
    setDeleteUserConfirm(userToDelete);
  };

  const executeDeleteUser = async () => {
    if (!deleteUserConfirm) return;
    const targetUser = deleteUserConfirm;
    const previousUsers = users;
    const remainingUsers = users.filter(u => u.username !== targetUser.username);
    setDeleteUserConfirm(null);
    await persistUserList(remainingUsers, `àº¥àº»àºšàº‚à»à»‰àº¡àº¹àº™àºœàº¹à»‰à»ƒàºŠà»‰ "${targetUser.username}" àºªàº³à»€àº¥àº±àº”!`, previousUsers);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');

    if (!username.trim() || !branch || (editingIndex === null && !password.trim())) {
      setErrorText('àºàº°àº¥àº¸àº™àº²àº›à»‰àº­àº™àº‚à»à»‰àº¡àº¹àº™à»ƒàº«à»‰àº„àº»àºšàº–à»‰àº§àº™');
      return;
    }

    if (allowedTabs.length === 0) {
      setErrorText('àºàº°àº¥àº¸àº™àº²à»€àº¥àº·àº­àºàº¢à»ˆàº²àº‡à»œà»‰àº­àº 1 àºŸàº±àº‡àºŠàº±àº™àº—àºµà»ˆàºªàº²àº¡àº²àº”à»€àº‚àº»à»‰àº²à»€àº–àº´àº‡à»„àº”à»‰');
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
      const exists = users.some(u => safeEquals(u.username, cleanedUsername));
      if (exists) {
        setErrorText(`àºŠàº·à»ˆàºœàº¹à»‰à»ƒàºŠà»‰ "${cleanedUsername}" àº¡àºµà»ƒàº™àº¥àº°àºšàº»àºšà»àº¥à»‰àº§! àºàº°àº¥àº¸àº™àº²àº›à»‰àº­àº™àºŠàº·à»ˆàº­àº·à»ˆàº™`);
        return;
      }
      updatedList = [updatedUserObj, ...updatedList];
    } else {
      const previousUser = users[editingIndex];
      const existsInOthers = users.some((u, idx) => 
        idx !== editingIndex && safeEquals(u.username, cleanedUsername)
      );
      if (existsInOthers) {
        setErrorText(`àºŠàº·à»ˆàºœàº¹à»‰à»ƒàºŠà»‰ "${cleanedUsername}" àº¡àºµà»ƒàº™àº¥àº°àºšàº»àºšà»àº¥à»‰àº§!`);
        return;
      }

      updatedList[editingIndex] = updatedUserObj;

      if (previousUser.username === currentUser.username) {
        onUpdateCurrentUser(updatedUserObj);
      }
    }

    setIsOpen(false);
    await persistUserList(updatedList, `àºšàº±àº™àº—àº¶àºàºšàº±àº™àºŠàºµàºœàº¹à»‰à»ƒàºŠà»‰ "${cleanedUsername}" àºªàº³à»€àº¥àº±àº”!`, users);
  };

  // Add Branch / Division logic
  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    setBranchErrorText('');

    const formattedBranch = newBranchInput.trim();
    const formattedDivision = newDivisionInput.trim();

    if (!formattedBranch || !formattedDivision) {
      setBranchErrorText('àºàº°àº¥àº¸àº™àº²àºàº§àº”àºªàº­àºš: àº•à»‰àº­àº‡àº›à»‰àº­àº™àº‚à»à»‰àº¡àº¹àº™àº—àº±àº‡ àºŠàº·à»ˆàºªàº²àº‚àº² à»àº¥àº° àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™');
      return;
    }

    // Check duplicate
    const isDuplicate = branches.some(
      b => b["àºªàº²àº‚àº²"] === formattedBranch && b["àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™"] === formattedDivision
    );

    if (isDuplicate) {
      setBranchErrorText('àº‚à»à»‰àº¡àº¹àº™àºªàº²àº‚àº² à»àº¥àº° àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™ àº™àºµà»‰àº¡àºµàºàº³àº™àº»àº”àº¢àº¹à»ˆà»àº¥à»‰àº§!');
      return;
    }

    const nextId = branches.reduce((max, cur) => cur["àº¥àº³àº”àº±àºš"] > max ? cur["àº¥àº³àº”àº±àºš"] : max, 0) + 1;
    
    const newBranchObj: BranchInfo = {
      "àº¥àº³àº”àº±àºš": nextId,
      "àºªàº²àº‚àº²": formattedBranch,
      "àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™": formattedDivision
    };

    const updatedBranches = [newBranchObj, ...branches];
    await onSaveBranches(updatedBranches);

    // Reset division input, keep branch input for easier continuous department adding
    setNewDivisionInput('');
    setBranchErrorText('');
    
    // Quick transient notification
    triggerToast(`à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™ "${formattedBranch}" - "${formattedDivision}" àºªàº³à»€àº¥àº±àº”!`);
  };

  // Delete Branch / Division row
  const handleDeleteBranch = (itemToDelete: BranchInfo) => {
    setDeleteBranchConfirm(itemToDelete);
  };

  const executeDeleteBranch = async () => {
    if (!deleteBranchConfirm) return;
    const targetBranch = deleteBranchConfirm;
    const previousBranches = branches;
    const remainingBranches = branches.filter(
      item => !(item["àºªàº²àº‚àº²"] === targetBranch["àºªàº²àº‚àº²"] && item["àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™"] === targetBranch["àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™"])
    );

    setDeleteBranchConfirm(null);
    try {
      await onSaveBranches(remainingBranches);
      triggerToast("àº¥àº»àºšàº‚à»à»‰àº¡àº¹àº™àºªàº²àº‚àº²/à»œà»ˆàº§àºàº‡àº²àº™àºªàº³à»€àº¥àº±àº”!");
    } catch (error) {
      console.error('Failed to delete branch/division:', error);
      await onSaveBranches(previousBranches);
      setSystemAlertMessage('àºšà»à»ˆàºªàº²àº¡àº²àº”àº¥àº¶àºšàº‚à»à»‰àº¡àº¹àº™àºªàº²àº‚àº²/à»œà»ˆàº§àºàº‡àº²àº™à»„àº”à»‰. àºàº°àº¥àº¸àº™àº²àº¥àº­àº‡à»ƒà»à»ˆ.');
    }
  };

  // Sector management logic
  const handleAddSector = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectorErrorText('');

    const formattedSector = newSectorInput.trim();

    if (!formattedSector) {
      setSectorErrorText('àºàº°àº¥àº¸àº™àº²àº›à»‰àº­àº™àºŠàº·à»ˆàº‚àº°à»à»œàº‡');
      return;
    }

    // Check duplicate
    const isDuplicate = sectors.some(
      s => safeEquals(s["àº‚àº°à»à»œàº‡"], formattedSector)
    );

    if (isDuplicate) {
      setSectorErrorText('àº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡àº™àºµà»‰àº¡àºµ àºàº³àº™àº»àº”àº¢àº¹à»ˆà»àº¥à»‰àº§!');
      return;
    }

    const newSectorObj: SectorInfo = {
      "àº‚àº°à»à»œàº‡": formattedSector
    };

    const updatedSectors = [newSectorObj, ...sectors];
    await onSaveSectors(updatedSectors);

    setNewSectorInput('');
    setSectorErrorText('');
    triggerToast(`à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡ "${formattedSector}" àºªàº³à»€àº¥àº±àº”!`);
  };

  const handleDeleteSector = (itemToDelete: SectorInfo) => {
    setDeleteSectorConfirm(itemToDelete);
  };

  const executeDeleteSector = async () => {
    if (!deleteSectorConfirm) return;
    const targetSector = deleteSectorConfirm;
    const previousSectors = sectors;
    const remainingSectors = sectors.filter(
      item => item["àº‚àº°à»à»œàº‡"] !== targetSector["àº‚àº°à»à»œàº‡"]
    );

    setDeleteSectorConfirm(null);
    try {
      await onSaveSectors(remainingSectors);
      triggerToast("àº¥àº»àºšàº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡àºªàº³à»€àº¥àº±àº”!");
    } catch (error) {
      console.error('Failed to delete sector:', error);
      await onSaveSectors(previousSectors);
      setSystemAlertMessage('àºšà»à»ˆàºªàº²àº¡àº²àº”àº¥àº¶àºšàº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡à»„àº”à»‰. àºàº°àº¥àº¸àº™àº²àº¥àº­àº‡à»ƒà»à»ˆ.');
    }
  };

  // Checklist Item management handlers
  const handleEditChecklistItemClick = (item: ChecklistItem) => {
    setEditingChecklistItem(item);
    setNewChecklistSystem(item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"]);
    setNewChecklistCategory(item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"]);
    setNewChecklistInspection(item["àº¥àº²àºàºàº²àº™àºàº§àº”"]);
    setNewChecklistFormType(item.Form_Type || 'àºªàº²àº‚àº²');
    setChecklistErrorText('');

    const standardSystems = Array.from(new Set(checklistItems.map(i => i["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"])));
    const standardCategories = Array.from(new Set(checklistItems.map(i => i["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"])));

    setIsCustomSystem(!standardSystems.includes(item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"]));
    setIsCustomCategory(!standardCategories.includes(item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"]));
  };

  const handleCancelEditChecklistItem = () => {
    setEditingChecklistItem(null);
    setNewChecklistSystem('');
    setNewChecklistCategory('');
    setNewChecklistInspection('');
    setNewChecklistFormType('àºªàº²àº‚àº²');
    setIsCustomSystem(false);
    setIsCustomCategory(false);
    setChecklistErrorText('');
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecklistErrorText('');

    const sys = isCustomSystem ? newChecklistSystem.trim() : newChecklistSystem;
    const cat = isCustomCategory ? newChecklistCategory.trim() : newChecklistCategory;
    const itemDetail = newChecklistInspection.trim();

    if (!sys) {
      setChecklistErrorText('àºàº°àº¥àº¸àº™àº²à»€àº¥àº·àº­àº àº«àº¼àº· àº›à»‰àº­àº™ àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº” (System Category)');
      return;
    }
    if (!cat) {
      setChecklistErrorText('àºàº°àº¥àº¸àº™àº²à»€àº¥àº·àº­àº àº«àº¼àº· àº›à»‰àº­àº™ àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” ( Area / Point)');
      return;
    }
    if (!itemDetail) {
      setChecklistErrorText('àºàº°àº¥àº¸àº™àº²àº›à»‰àº­àº™ àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² (Inspection Item)');
      return;
    }

    // Check duplicate within the same form type
    const isDuplicate = checklistItems.some(
      item => 
        item !== editingChecklistItem &&
        safeEquals(item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"], sys) &&
        safeEquals(item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"], cat) &&
        safeEquals(item["àº¥àº²àºàºàº²àº™àºàº§àº”"], itemDetail) &&
        safeEquals(item.Form_Type || 'àºªàº²àº‚àº²', newChecklistFormType)
    );

    if (isDuplicate) {
      setChecklistErrorText('àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²àº™àºµà»‰àº¡àºµàº¢àº¹à»ˆà»ƒàº™àºŸàº­àº¡àº™àºµà»‰à»àº¥à»‰àº§!');
      return;
    }

    if (editingChecklistItem) {
      const updatedList = checklistItems.map(item => {
        if (item === editingChecklistItem) {
          return {
            ...item,
            "àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”": sys,
            "à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”": cat,
            "àº¥àº²àºàºàº²àº™àºàº§àº”": itemDetail,
            Form_Type: newChecklistFormType,
          };
        }
        return item;
      });
      await onSaveChecklistItems(updatedList);
      setEditingChecklistItem(null);
      setNewChecklistInspection('');
      setIsCustomSystem(false);
      setIsCustomCategory(false);
      triggerToast(`à»àºà»‰à»„àº‚àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² "${itemDetail}" àºªàº³à»€àº¥àº±àº”!`);
    } else {
      const newItem: ChecklistItem = {
        "àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”": sys,
        "à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”": cat,
        "àº¥àº²àºàºàº²àº™àºàº§àº”": itemDetail,
        Form_Type: newChecklistFormType,
      };

      await onSaveChecklistItems([newItem, ...checklistItems]);
      
      // reset form fields
      setNewChecklistInspection('');
      setIsCustomSystem(false);
      setIsCustomCategory(false);
      triggerToast(`à»€àºžàºµà»ˆàº¡àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² "${itemDetail}" àºªàº³à»€àº¥àº±àº”!`);
    }
  };

  const handleDeleteChecklistItem = (item: ChecklistItem) => {
    setDeleteChecklistItemConfirm(item);
  };

  const executeDeleteChecklistItem = async () => {
    if (!deleteChecklistItemConfirm) return;
    const targetChecklistItem = deleteChecklistItemConfirm;
    const previousChecklistItems = checklistItems;
    const remaining = checklistItems.filter(
      item => !(
        item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"] === targetChecklistItem["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"] &&
        item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"] === targetChecklistItem["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"] &&
        item["àº¥àº²àºàºàº²àº™àºàº§àº”"] === targetChecklistItem["àº¥àº²àºàºàº²àº™àºàº§àº”"]
      )
    );
    setDeleteChecklistItemConfirm(null);
    try {
      await onSaveChecklistItems(remaining);
      triggerToast('àº¥àº»àºšàº¥àº²àºàºàº²àº™àºàº§àº”àºàº²àºàº³àº™àº»àº”àºªàº³à»€àº¥àº±àº”!');
    } catch (error) {
      console.error('Failed to delete checklist item:', error);
      await onSaveChecklistItems(previousChecklistItems);
      setSystemAlertMessage('àºšà»à»ˆàºªàº²àº¡àº²àº”àº¥àº¶àºšàº¥àº²àºàºàº²àº™àºàº§àº”àºàº²à»„àº”à»‰. àºàº°àº¥àº¸àº™àº²àº¥àº­àº‡à»ƒà»à»ˆ.');
    }
  };

  const handleResetChecklistToDefault = () => {
    setShowResetConfirm(true);
  };

  const executeResetChecklist = async () => {
    const previousChecklistItems = checklistItems;
    setShowResetConfirm(false);
    try {
      await onSaveChecklistItems(CHECKLIST_ITEMS);
      triggerToast('àº£àºµà»€àºŠàº±àº”àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²àº—àº±àº‡à»àº»àº”à»€àº›àº±àº™àº„à»ˆàº²à»€àº¥àºµà»ˆàº¡àº•àº»à»‰àº™àºªàº³à»€àº¥àº±àº”!');
    } catch (error) {
      console.error('Failed to reset checklist items:', error);
      await onSaveChecklistItems(previousChecklistItems);
      setSystemAlertMessage('àºšà»à»ˆàºªàº²àº¡àº²àº”àº£àºµà»€àºŠàº±àº”àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²à»„àº”à»‰. àºàº°àº¥àº¸àº™àº²àº¥àº­àº‡à»ƒà»à»ˆ.');
    }
  };

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetSparePart.trim() || !presetSubItem.trim() || !presetUnit.trim()) {
      setPresetError('àºàº°àº¥àº¸àº™àº²àº›à»‰àº­àº™àº‚à»à»‰àº¡àº¹àº™à»ƒàº«à»‰àº„àº»àºšàº–à»‰àº§àº™');
      return;
    }
    
    const duplicate = repairPresets.find(p => 
      p.id !== editingPresetId &&
      safeEquals(p.sparePart, presetSparePart) &&
      safeEquals(p.repairSubCategory, presetSubCategory) &&
      safeEquals(p.repairSubItem, presetSubItem)
    );
    
    if (duplicate) {
      setPresetError('àº¡àºµàº‚à»à»‰àº¡àº¹àº™ Mapping àº‚àº­àº‡àº­àº°à»„àº«àº¼à»ˆ à»àº¥àº° àº¥àº²àºàºàº²àº™àºªà»‰àº­àº¡àº™àºµà»‰à»ƒàº™à»àº§àº”àº™àºµà»‰àº¢àº¹à»ˆà»àº¥à»‰àº§ (àº«à»‰àº²àº¡àºªà»‰àº²àº‡ Master Data àºŠà»‰àº³)');
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
      triggerToast('à»àºà»‰à»„àº‚à»àºœàº™àºœàº±àº‡ Mapping àºªàº³à»€àº¥àº±àº”!');
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
      triggerToast('à»€àºžàºµà»ˆàº¡à»àºœàº™àºœàº±àº‡ Mapping à»ƒà»à»ˆàºªàº³à»€àº¥àº±àº”!');
    }
    
    setRepairPresets(updated);
    saveRepairPresets(updated);
    
    // reset form
    setEditingPresetId(null);
    setPresetSparePart('');
    setPresetSubItem('');
    setPresetUnit('àº­àº±àº™');
    setPresetPrice(0);
    setPresetError('');
    setIsCustomSubCategory(false);
    setPresetSubCategory('àº¥àº°àºšàº»àºšà»„àºŸàºŸà»‰àº²');
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
      "àº¥àº°àºšàº»àºšà»„àºŸàºŸà»‰àº²",
      "àº¥àº°àºšàº»àºšàº™à»à¹‰à¸²àº›àº°àº›àº² & àºªàº¸àº‚àº°àºžàº±àº™",
      "àº¥àº°àºšàº»àºšà»€àº„àº·à»ˆàº­àº‡àº›àº±àºšàº­àº²àºàº²àº”",
      "àº¥àº°àºšàº»àºšà»€àº„àº·àº­àº‚à»ˆàº²àº & IT",
      "àº¥àº°àºšàº»àºšàº›à»‰àº­àº‡àºàº±àº™àº­àº±àºàº„àºµà»„àºž",
      "àº¥àº°àºšàº»àºšà»‚àº„àº‡àºªà»‰àº²àº‡ à»àº¥àº° àº­àº²àº„àº²àº™",
      "àºŠàº±àºšàºªàº´àº™",
      "àº­àº·à»ˆàº™à»†"
    ];
    setIsCustomSubCategory(!standardCategories.includes(p.repairSubCategory));
  };

  const handleDeletePresetClick = (id: string) => {
    if (!window.confirm('àº—à»ˆàº²àº™à»àº™à»ˆà»ƒàºˆàºšà»à»ˆàº§à»ˆàº²àº•à»‰àº­àº‡àºàº²àº™àº¥àº»àºšà»àºœàº™àºœàº±àº‡ Mapping àº™àºµà»‰?')) return;
    const updated = repairPresets.filter(p => p.id !== id);
    setRepairPresets(updated);
    saveRepairPresets(updated);
    triggerToast('àº¥àº»àºšà»àºœàº™àºœàº±àº‡ Mapping àºªàº³à»€àº¥àº±àº”!');
  };

  const handleResetPresetsToDefault = () => {
    if (window.confirm('àº—à»ˆàº²àº™à»àº™à»ˆà»ƒàºˆàºšà»à»ˆàº§à»ˆàº²àº•à»‰àº­àº‡àºàº²àº™àº£àºµà»€àºŠàº±àº”à»àºœàº™àºœàº±àº‡ Mapping àº—àº±àº‡à»àº»àº”à»€àº›àº±àº™àº„à»ˆàº²à»€àº¥àºµà»ˆàº¡àº•àº»à»‰àº™?')) {
      setRepairPresets(DEFAULT_REPAIR_PRESETS);
      saveRepairPresets(DEFAULT_REPAIR_PRESETS);
      triggerToast('àº£àºµà»€àºŠàº±àº”à»àºœàº™àºœàº±àº‡ Mapping à»€àº›àº±àº™àº„à»ˆàº²à»€àº¥àºµà»ˆàº¡àº•àº»à»‰àº™àºªàº³à»€àº¥àº±àº”!');
    }
  };

  const uniqueSubCategories = Array.from(new Set([
    "àº¥àº°àºšàº»àºšà»„àºŸàºŸà»‰àº²",
    "àº¥àº°àºšàº»àºšàº™à»à»‰àº²àº›àº°àº›àº² & àºªàº¸àº‚àº°àºžàº±àº™",
    "àº¥àº°àºšàº»àºšà»€àº„àº·à»ˆàº­àº‡àº›àº±àºšàº­àº²àºàº²àº”",
    "àº¥àº°àºšàº»àºšà»€àº„àº·àº­àº‚à»ˆàº²àº & IT",
    "àº¥àº°àºšàº»àºšàº›à»‰àº­àº‡àºàº±àº™àº­àº±àºàº„àºµà»„àºž",
    "àº¥àº°àºšàº»àºšà»‚àº„àº‡àºªà»‰àº²àº‡ à»àº¥àº° àº­àº²àº„àº²àº™",
    "àºŠàº±àºšàºªàº´àº™",
    "àº­àº·à»ˆàº™à»†",
    ...repairPresets.map(p => p.repairSubCategory).filter(Boolean)
  ]));

  return (
    <div className="space-y-6" id="accounts-management-container">
      {/* Top action header info */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-emerald-800" />
            àºˆàº±àº”àºàº²àº™àº¥àº°àºšàº»àºš & àº‚à»à»‰àº¡àº¹àº™àºžàº·à»‰àº™àº–àº²àº™ (System Administration)
          </h2>
          <p className="text-xs text-slate-500 mt-1 animate-fade-in">
            àºˆàº±àº”àºàº²àº™àºšàº±àº™àºŠàºµàºœàº¹à»‰à»ƒàºŠà»‰, àºàº³àº™àº»àº”àºªàº´àº”àºàº²àº™à»€àº‚àº»à»‰àº²à»€àº–àº´àº‡à»àº•à»ˆàº¥àº°à»œà»‰àº²àº§àº½àº, à»àº¥àº° àº•àº±à»‰àº‡àº„à»ˆàº²àº‚à»à»‰àº¡àº¹àº™ àºªàº²àº‚àº² / àºà»ˆàº²àº / à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™ àº‚àº­àº‡àº—àº°àº™àº²àº„àº²àº™
          </p>
        </div>

        {activeSubTab === 'users' ? (
          <button
            onClick={handleOpenAdd}
            className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-md cursor-pointer transition flex items-center gap-1.5"
          >
            <UserPlus className="h-4 w-4" />
            à»€àºžàºµà»ˆàº¡àºœàº¹à»‰à»ƒàºŠà»‰à»ƒà»à»ˆ (Create Account)
          </button>
        ) : activeSubTab === 'checklist' ? (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold">
            <CheckSquare className="h-4 w-4 text-emerald-800" />
            àºˆàº±àº”àºàº²àº™àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² & àº¥àº°àºšàº»àºš
          </div>
        ) : activeSubTab === 'sectors' ? (
          <div className="bg-emerald-50 border border-emerald-100 text-emerald-950 text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold">
            <MapPin className="h-4 w-4 text-emerald-850" />
            àºˆàº±àº”àºàº²àº™àº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡ (Sectors)
          </div>
        ) : (
          <div className="bg-amber-100 border border-amber-200 text-amber-950 text-[11px] px-3.5 py-2 rounded-xl flex items-center gap-1.5 font-bold">
            <Building className="h-4 w-4 text-emerald-800" />
            àºªàº´àº”àº—àº´àºªàº°à»€àºžàº²àº° àºœàº¹à»‰àº”àº¹à»àº¥àº¥àº°àºšàº»àºš (Admin Authorized)
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
          àºˆàº±àº”àºàº²àº™àºšàº±àº™àºŠàºµàºœàº¹à»‰à»ƒàºŠà»‰ ({users.length} àºšàº±àº™àºŠàºµ)
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
          àºˆàº±àº”àºàº²àº™ àºªàº²àº‚à¸² & àºà»ˆàº²àº/à»œà»ˆàº§àºàº‡àº²àº™ ({branches.length} àº¥àº²àºàºàº²àº™)
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
          àºˆàº±àº”àºàº²àº™ àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² & àº¥àº°àºšàº»àºš ({checklistItems.length} àº¥àº²àºàºàº²àº™)
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
          àºˆàº±àº”àºàº²àº™ àº‚àº°à»à»œàº‡ (Sectors) ({sectors.length} àº¥àº²àºàºàº²àº™)
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
          àºˆàº±àº”àºàº²àº™à»àºœàº™àºœàº±àº‡ Mapping ({repairPresets.length} àº¥àº²àºàºàº²àº™)
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
                placeholder="àº„àº»à»‰àº™àº«àº²àºŠàº·à»ˆàºœàº¹à»‰à»ƒàºŠà»‰, àºªàº²àº‚àº², àºšàº»àº”àºšàº²àº”..."
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
                "àºªàº°à»àº”àº‡àº—àº±àº‡à»àº»àº”": <strong className="text-slate-800 font-bold">{filteredUsers.length}</strong> àºšàº±àº™àºŠàºµ
              </div>
            </div>
          </div>

          {/* Directory List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-250 uppercase tracking-wider">
                  <th className="p-4 text-center w-12">àº¥àº³àº”àº±àºš</th>
                  <th className="p-4">àºŠàº·à»ˆàºœàº¹à»‰à»ƒàºŠà»‰àºšàº±àº™àºŠàºµ (Username)</th>
                  <th className="p-4">àº¥àº°àº«àº±àº”àºœà»ˆàº²àº™ (Password)</th>
                  <th className="p-4">àºšàº»àº”àºšàº²àº” (Role)</th>
                  <th className="p-4">àºªàº²àº‚àº²àºªàº±àº‡àºàº±àº” (Branch)</th>
                  <th className="p-4">àºŸàº±àº‡àºŠàº±àº™àº—àºµà»ˆà»„àº”à»‰àºªàº´àº”à»€àº‚àº»à»‰àº²à»€àº–àº´àº‡ (Visible Tabs)</th>
                  <th className="p-4 text-center w-28">àºˆàº±àº”àºàº²àº™</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((user, idx) => {
                  const userIndexInMain = users.findIndex(u => u.username === user.username);
                  const isSelf = user.username === currentUser.username;
                  const canSeePassword = Boolean(visiblePasswordUsers[user.username]);
                  const passwordToggleLabel = canSeePassword ? 'ປິດ' : 'ເບິ່ງ';
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
                                  àºšàº±àº™àºŠàºµàº—à»ˆàº²àº™
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className={`px-2 py-1 rounded border min-w-[82px] inline-block ${
                            canSeePassword
                              ? 'bg-amber-100 border-amber-300 text-amber-950'
                              : 'bg-slate-950 border-cyan-900/70 text-slate-100'
                          }`}>
                            {canSeePassword ? getVisiblePasswordValue(user) : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(user.username)}
                            className={`inline-flex min-w-[64px] items-center justify-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-bold transition cursor-pointer ${
                              canSeePassword
                                ? 'border-amber-300 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30'
                                : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20'
                            }`}
                            aria-label={canSeePassword ? `Hide password for ${user.username}` : `Show password for ${user.username}`}
                            title={canSeePassword ? 'à»€àºŠàº·à»ˆàº­àº‡àº¥àº°àº«àº±àº”àºœà»ˆàº²àº™' : 'àºªàº°à»àº”àº‡àº¥àº°àº«àº±àº”àºœà»ˆàº²àº™'}
                          >
                            {canSeePassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            <span>{passwordToggleLabel}</span>
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
                          {user.status === 'Admin' ? 'Admin (àºœàº¹à»‰àº”àº¹à»àº¥)' : 'Branch User'}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        ðŸ¢ {user.branch}
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
                                âœ… {cleanLabel}
                              </span>
                            );
                          })}
                          {permissionsList.length === 0 && (
                            <span className="text-red-500 font-bold text-[9.5px]">
                              âš ï¸ àºšà»à»ˆàº¡àºµàºªàº´àº”à»€àº‚àº»à»‰àº²à»€àº–àº´àº‡à»ƒàº”à»†
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setViewingUser(user)}
                            className="p-1 px-2 border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 text-slate-650 hover:text-cyan-800 font-bold rounded-lg cursor-pointer transition flex items-center gap-1"
                            title="à»€àºšàº´à»ˆàº‡àº¥àº²àºàº¥àº°àº­àº½àº” User"
                          >
                            <UserCircle className="h-3.5 w-3.5" />
                            <span className="text-[10px]">à»€àºšàº´à»ˆàº‡</span>
                          </button>
                          <button
                            onClick={() => handleOpenEdit(user, userIndexInMain)}
                            className="p-1 px-2 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-650 hover:text-emerald-800 font-bold rounded-lg cursor-pointer transition flex items-center gap-1"
                            title="à»àºà»‰à»„àº‚àºªàº´àº”àºœàº¹à»‰à»ƒàºŠà»‰"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">à»àºà»‰à»„àº‚</span>
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={isSelf}
                            className={`p-1 px-2 border rounded-lg transition flex items-center gap-1 ${
                              isSelf 
                                ? 'border-slate-100 text-slate-300 cursor-not-allowed bg-slate-50' 
                                : 'border-slate-200 text-slate-550 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 cursor-pointer'
                            }`}
                            title={isSelf ? "àº—à»ˆàº²àº™àºšà»à»ˆàºªàº²àº¡àº²àº”àº¥àº»àºšàº•àº»àº§à»€àº­àº‡à»„àº”à»‰" : "àº¥àº»àºšàºœàº¹à»‰à»ƒàºŠà»‰"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">àº¥àº»àºš</span>
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
                      àºšà»à»ˆàºžàº»àºšàº‚à»à»‰àº¡àº¹àº™àºšàº±àº™àºŠàºµàºœàº¹à»‰à»ƒàºŠà»‰àº—àºµà»ˆàº„àº»à»‰àº™àº«àº²!
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
              à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™ àºªàº²àº‚àº² à»àº¥àº° àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™à»ƒà»à»ˆ (Add New Branch & division)
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
                  1. àºŠàº·à»ˆàºªàº²àº‚àº² (Branch Name) *
                </label>
                <input
                  type="text"
                  placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: 00.àºªà»àº²àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ, 05.àºªàº²àº‚àº²àºˆàº³àº›àº²àºªàº±àº"
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                {uniqueBranches.length > 0 && (
                  <div className="mt-2 bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/70">
                    <span className="block text-[10px] font-bold text-emerald-850 mb-1">
                      ðŸ’¡ à»ƒàºŠà»‰àºªàº²àº‚àº²à»€àºàº»à»ˆàº²àº—àºµà»ˆàº¡àºµà»ƒàº™àº¥àº°àºšàº»àºš (Or use existing branch):
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
                      <option value="">-- à»€àº¥àº·àº­àºàºªàº²àº‚àº²à»€àºàº»à»ˆàº² --</option>
                      {uniqueBranches.map(br => (
                        <option key={br} value={br}>{br}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  2. àºà»ˆàº²àº / à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™ (Division/Unit Name) *
                </label>
                <input
                  type="text"
                  placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: àºà»ˆàº²àºàºšà»àº¥àº´àº«àº²àº™àº­àº²àº„àº²àº™, à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™àº›àº²àºà»€àºŠ, ..."
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
                  à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™ (Add row)
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
                  placeholder="àº„àº»à»‰àº™àº«àº²àºŠàº·à»ˆàºªàº²àº‚àº², àºà»ˆàº²àº..."
                  value={branchSearchTerm}
                  onChange={(e) => setBranchSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-mono shrink-0">
                "àº¥àº§àº¡àº—àº±àº‡à»àº»àº”": <strong className="text-slate-800 font-bold">{filteredBranches.length}</strong> àº¥àº²àºàºàº²àº™
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-250 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">àº¥àº³àº”àº±àºš</th>
                    <th className="p-4">àºŠàº·à»ˆàºªàº²àº‚àº² (Branch Name)</th>
                    <th className="p-4">àºà»ˆàº²àº / à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™ (Division/Department)</th>
                    <th className="p-4 text-center w-28">àºˆàº±àº”àºàº²àº™</th>
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
                        {item["àºªàº²àº‚àº²"]}
                      </td>
                      <td className="p-4 font-semibold text-slate-700">
                        ðŸ“ {item["àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™"] || '-'}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleDeleteBranch(item)}
                          className="p-1 px-3 border border-slate-200 text-slate-550 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-250 rounded-lg cursor-pointer transition flex items-center justify-center gap-1 mx-auto"
                          title="àº¥àº¶àºšàº¥àº²àºàºàº²àº™àºªàº²àº‚àº²/àºà»ˆàº²àº"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="text-[10px]">àº¥àº¶àºš</span>
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredBranches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-slate-400">
                        <MapPin className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        àºšà»à»ˆàºžàº»àºšàº‚à»à»‰àº¡àº¹àº™àºªàº²àº‚àº² àº«àº¼àº· àºà»ˆàº²àºàºšà»àº¥àº´àºàº²àº™ àº—àºµà»ˆàº„àº»à»‰àº™àº«àº²!
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
                  <span>à»àºà»‰à»„àº‚àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² (Edit Checklist Item)</span>
                </>
              ) : (
                <>
                  <PlusCircle className="h-4.5 w-4.5 text-emerald-850" />
                  <span>à»€àºžàºµà»ˆàº¡àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² à»àº¥àº° àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” à»ƒà»à»ˆ (Add New Checklist & Area/Point)</span>
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
                    1. àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº” (System Category) *
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
                      <option value="">-- à»€àº¥àº·àº­àºàº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº” --</option>
                      {Array.from(new Set(checklistItems.map(item => item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"]))).sort().map((sys, idx) => (
                        <option key={idx} value={sys}>{sys}</option>
                      ))}
                      <option value="__custom__" className="text-emerald-750 font-bold">+ àº›à»‰àº­àº™àº¥àº°àºšàº»àºšà»ƒà»à»ˆ (Enter Custom System)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="...àº›à»‰àº­àº™àºŠàº·à»ˆàº¥àº°àºšàº»àºšà»ƒà»à»ˆ"
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
                        à»€àº¥àº·àº­àºàºˆàº²àºàº¥àº²àºàºàº²àº™
                      </button>
                    </div>
                  )}
                </div>

                {/* Sub category Select/Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    2. àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” ( Area / Point) *
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
                      <option value="">-- à»€àº¥àº·àº­àº àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” --</option>
                      {Array.from(
                        new Set(
                          checklistItems
                            .filter(item => !newChecklistSystem || item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"] === newChecklistSystem)
                            .map(item => item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"])
                        )
                      ).sort().map((cat, idx) => (
                        <option key={idx} value={cat}>{cat}</option>
                      ))}
                      <option value="__custom__" className="text-emerald-750 font-bold">+ àº›à»‰àº­àº™ àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” à»ƒà»à»ˆ (Enter Custom Area/Point)</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="...àº›à»‰àº­àº™àºŠàº·à»ˆ àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº”"
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
                        à»€àº¥àº·àº­àºàºˆàº²àºàº¥àº²àºàºàº²àº™
                      </button>
                    </div>
                  )}
                </div>

                {/* Form Type Selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    3. àº›àº°à»€àºžàº”àºŸàº­àº¡ (Form Type) *
                  </label>
                  <select
                    value={newChecklistFormType}
                    onChange={(e) => setNewChecklistFormType(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 cursor-pointer font-medium"
                  >
                    <option value="àºªàº³àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ">àºŸàº­àº¡ àºªàº³àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ (HQ)</option>
                    <option value="àºªàº²àº‚àº²">àºŸàº­àº¡ àºªàº²àº‚àº² (Branch)</option>
                    <option value="à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™">àºŸàº­àº¡ à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™ (Service Unit)</option>
                    <option value="àº«à»‰àº­àº‡àº®àº±àºšà»€àº‡àº´àº™">àºŸàº­àº¡ àº«à»‰àº­àº‡àº®àº±àºšà»€àº‡àº´àº™ (Cash Office)</option>
                  </select>
                </div>
              </div>

              {/* Inspection Item Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  4. àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² (Inspection Item Description) *
                </label>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch">
                  <input
                    type="text"
                    required
                    placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: àºàº§àº”à»€àºŠàº±àºàºàº²àº™à»€àº®àº±àº”àº§àº½àºàº‚àº­àº‡àºà»‰àº­àº‡àº›àº»àºàºàº°àº•àº´, àºàº§àº”àºàº²àº„àº§àº²àº¡àºªàº°àº­àº²àº”àº‚àº­àº‡àºžàº·à»‰àº™..."
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
                        àºšàº±àº™àº—àº¶àºàºàº²àº™à»àºà»‰à»„àº‚ (Save Changes)
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditChecklistItem}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-600 text-xs font-bold py-2.5 px-5 rounded-xl cursor-pointer transition flex items-center justify-center gap-1"
                      >
                        <X className="h-4 w-4" />
                        àºàº»àºà»€àº¥àºµàº (Cancel)
                      </button>
                    </div>
                  ) : (
                    <button
                      type="submit"
                      className="bg-emerald-800 hover:bg-emerald-950 text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow cursor-pointer transition flex items-center justify-center gap-1.5 shrink-0"
                    >
                      <Save className="h-4 w-4" />
                      à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™àº¥àº²àºàºàº²àº™àºàº§àº” (Add item)
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
                    placeholder="àº„àº»à»‰àº™àº«àº² àº¥àº°àºšàº»àºš, àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” àº«àº¼àº· àº¥àº²àºàºàº²àº™...."
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
                  <option value="ALL">àº—àº¸àºà»†àº›àº°à»€àºžàº”àºŸàº­àº¡ (All Forms)</option>
                  <option value="àºªàº³àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ">ðŸ¢ àºŸàº­àº¡ àºªàº³àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ (HQ)</option>
                  <option value="àºªàº²àº‚àº²">ðŸ›ï¸ àºŸàº­àº¡ àºªàº²àº‚àº² (Branch)</option>
                  <option value="à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™">ðŸª àºŸàº­àº¡ à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™ (Service Unit)</option>
                  <option value="àº«à»‰àº­àº‡àº®àº±àºšà»€àº‡àº´àº™">ðŸ’° àºŸàº­àº¡ àº«à»‰àº­àº‡àº®àº±àºšà»€àº‡àº´àº™ (Cash Office)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 shrink-0 w-full lg:w-auto justify-between lg:justify-end">
                <div className="text-[11px] text-slate-500 font-mono">
                  "àº¥àº§àº¡àº—àº±àº‡à»àº»àº”": <strong className="text-slate-800 font-bold">{filteredChecklistItems.length}</strong> àº¥àº²àºàºàº²àº™
                </div>
                
                <button
                  type="button"
                  onClick={handleResetChecklistToDefault}
                  className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-[11px] font-bold py-1.5 px-3 rounded-xl cursor-pointer transition flex items-center gap-1.5 shrink-0 shadow-xs"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                  àº£àºµà»€àºŠàº±àº”àº„à»ˆàº²à»€àº¥àºµà»ˆàº¡àº•àº»à»‰àº™ (Reset)
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-100 text-[11px] font-bold text-slate-600 border-b border-slate-250 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">àº¥àº³àº”àº±àºš</th>
                    <th className="p-4 w-1/5">àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº” (System Category)</th>
                    <th className="p-4 w-1/5">àºžàº·à»‰àº™àº—àºµà»ˆ/àºˆàº¸àº”àºàº§àº” ( Area / Point)</th>
                    <th className="p-4 w-44 text-center">àº›àº°à»€àºžàº”àºŸàº­àº¡ (Form Type)</th>
                    <th className="p-4 w-1/3">àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² (Inspection Item)</th>
                    <th className="p-4 text-center w-28">àºˆàº±àº”àºàº²àº™</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredChecklistItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition">
                      <td className="p-4 text-center font-mono text-slate-400 font-bold">
                        {idx + 1}
                      </td>
                      <td className="p-4 font-bold text-slate-900 truncate" title={item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"]}>
                        ðŸ›¡ï¸ {item["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"]}
                      </td>
                      <td className="p-4 font-semibold text-slate-700 truncate" title={item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"]}>
                        ðŸ“¦ {item["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"]}
                      </td>
                      <td className="p-4 text-center">
                        {item.Form_Type === "àºªàº³àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                            ðŸ¢ àºªàº³àº™àº±àºàº‡àº²àº™à»ƒàº«àºà»ˆ
                          </span>
                        ) : item.Form_Type === "àºªàº²àº‚àº²" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            ðŸ›ï¸ àºªàº²àº‚àº²
                          </span>
                        ) : item.Form_Type === "à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                            ðŸª à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™
                          </span>
                        ) : item.Form_Type === "àº«à»‰àº­àº‡àº®àº±àºšà»€àº‡àº´àº™" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            ðŸ’° àº«à»‰àº­àº‡àº®àº±àºšà»€àº‡àº´àº™
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-50 text-slate-650 border border-slate-200">
                            ðŸ›ï¸ {item.Form_Type || "àºªàº²àº‚àº²"}
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-slate-650 font-medium break-words">
                        {item["àº¥àº²àºàºàº²àº™àºàº§àº”"]}
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
                            title="à»àºà»‰à»„àº‚àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">à»àºà»‰à»„àº‚</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(item)}
                            className="p-1 px-2.5 border border-slate-200 text-slate-550 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-250 rounded-lg cursor-pointer transition flex items-center justify-center gap-1"
                            title="àº¥àº¶àºšàº¥àº²àºàºàº²àº™àºàº§àº”àºàº²"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="text-[10px]">àº¥àº¶àºš</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredChecklistItems.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <CheckSquare className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        àºšà»à»ˆàºžàº»àºšàº‚à»à»‰àº¡àº¹àº™àº¥àº²àºàºàº²àº™àºàº§àº”àºàº² àº—àºµà»ˆàº„àº»à»‰àº™àº«àº²!
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
              à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡à»ƒà»à»ˆ (Add New Sector)
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
                  àºŠàº·à»ˆàº‚àº°à»à»œàº‡ (Sector Name) *
                </label>
                <input
                  type="text"
                  placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: àº‚àº°à»à»œàº‡àºàº§àº”àºàº²à»„àº­àº—àºµ, àº‚àº°à»à»œàº‡àºšà»àº¥àº´àº«àº²àº™..."
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
                  à»€àºžàºµà»ˆàº¡àº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡ (Add Sector)
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
                  placeholder="àº„àº»à»‰àº™àº«àº² àº‚àº°à»à»œàº‡ (Search Sectors)..."
                  value={sectorSearchTerm}
                  onChange={(e) => setSectorSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-slate-350 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-sans"
                />
              </div>
              <div className="text-[11px] text-slate-500 font-medium font-mono">
                "àº¥àº§àº¡àº—àº±àº‡à»àº»àº”": <strong className="text-slate-800 font-bold">{filteredSectors.length}</strong> àº¥àº²àºàºàº²àº™
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs text-slate-755 font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-150 uppercase tracking-wider">
                    <th className="p-4 text-center w-16">àº¥àº³àº”àº±àºš</th>
                    <th className="p-4">àº‚àº°à»à»œàº‡ (Sector Name)</th>
                    <th className="p-4 text-center w-28">àºˆàº±àº”àºàº²àº™</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredSectors
                    .map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 text-center font-mono text-slate-400">{idx + 1}</td>
                        <td className="p-4 text-slate-800 font-medium">âœ¨ {item["àº‚àº°à»à»œàº‡"]}</td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteSector(item)}
                            className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 mx-auto border border-transparent hover:border-rose-100 cursor-pointer"
                            title="àº¥àº¶àºšàº‚àº°à»à»œàº‡"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            àº¥àº¶àºš
                          </button>
                        </td>
                      </tr>
                    ))}

                  {filteredSectors.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-12 text-slate-400">
                        <MapPin className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        àºšà»à»ˆàºžàº»àºšàº‚à»à»‰àº¡àº¹àº™àº‚àº°à»à»œàº‡àº—àºµà»ˆàº„àº»à»‰àº™àº«àº²!
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
              {editingPresetId ? 'à»àºà»‰à»„àº‚à»àºœàº™àºœàº±àº‡ Mapping (Edit Mapping)' : 'à»€àºžàºµà»ˆàº¡à»àºœàº™àºœàº±àº‡ Mapping à»ƒà»à»ˆ (Add New Mapping)'}
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
                    àº­àº°à»„àº«àº¼à»ˆ/àº„à»ˆàº²àºšà»àº¥àº´àºàº²àº™ (Spare Part / Service) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: àº”àº­àºà»„àºŸ LED 18W, àºšà»àº¥àº´àºàº²àº™àº¥à»‰àº²àº‡à»àº­..."
                    value={presetSparePart}
                    onChange={(e) => setPresetSparePart(e.target.value)}
                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  />
                </div>

                {/* Subcategory */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    à»àº§àº”àºà»ˆàº­àºàº¥àº²àºàºàº²àº™àºªà»‰àº­àº¡ (Subcategory) *
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
                      <option value="__custom__" className="text-emerald-700 font-bold">+ àº›à»‰àº­àº™à»àº§àº”àºà»ˆàº­àºà»ƒà»à»ˆ (Custom Subcategory)...</option>
                    </select>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="...àº›à»‰àº­àº™àºŠàº·à»ˆà»àº§àº”àºà»ˆàº­àºà»ƒà»à»ˆ"
                        value={presetSubCategory}
                        onChange={(e) => setPresetSubCategory(e.target.value)}
                        className="flex-1 border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomSubCategory(false);
                          setPresetSubCategory('àº¥àº°àºšàº»àºšà»„àºŸàºŸà»‰àº²');
                        }}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-xl px-3 text-xs shrink-0 font-bold font-sans transition-colors"
                      >
                        à»€àº¥àº·àº­àºàºˆàº²àºàº¥àº²àºàºàº²àº™
                      </button>
                    </div>
                  )}
                </div>

                {/* Repair Sub Item */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    àº¥àº²àºàºàº²àº™àºªà»‰àº­àº¡àºà»ˆàº­àº (Repair Sub-item) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: àº«àº¼àº­àº”à»„àºŸà»€àºªàº, à»àº­à»€àº¢àº±àº™àºšà»à»ˆàºžà»..."
                    value={presetSubItem}
                    onChange={(e) => setPresetSubItem(e.target.value)}
                    className="w-full border border-slate-350 rounded-xl p-2.5 text-xs bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 font-sans">
                    àº«àº»àº§à»œà»ˆàº§àº (Unit) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: àº­àº±àº™, à»€àº„àº·à»ˆàº­àº‡, àº”àº­àº, àº„àº±à»‰àº‡, àº–àº±àº‡..."
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
                      setPresetUnit('àº­àº±àº™');
                      setPresetPrice(0);
                      setPresetError('');
                    }}
                    className="border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition flex items-center gap-1.5 h-[38px]"
                  >
                    <X className="h-4 w-4" />
                    àºàº»àºà»€àº¥àºµàº (Cancel)
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-6 rounded-xl shadow-md hover:shadow-lg cursor-pointer transition flex items-center gap-1.5 h-[38px]"
                >
                  <Save className="h-4 w-4" />
                  {editingPresetId ? 'àºšàº±àº™àº—àº¶àºàºàº²àº™à»àºà»‰à»„àº‚' : 'à»€àºžàºµà»ˆàº¡à»àºœàº™àºœàº±àº‡ Mapping'}
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
                  placeholder="àº„àº»à»‰àº™àº«àº² àº­àº°à»„àº«àº¼à»ˆ, à»àº§àº”àºà»ˆàº­àº, àº¥àº²àºàºàº²àº™àºªà»‰àº­àº¡..."
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
                  àº£àºµà»€àºŠàº±àº”à»€àº›àº±àº™àº„à»ˆàº²à»€àº¥àºµà»ˆàº¡àº•àº»à»‰àº™ (Reset to Default)
                </button>
                <div className="text-[11px] text-slate-500 font-medium font-mono">
                  "àº¥àº§àº¡àº—àº±àº‡à»àº»àº”": <strong className="text-slate-800 font-bold">
                    {filteredRepairPresets.length}
                  </strong> àº¥àº²àºàºàº²àº™
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="w-full text-left text-xs text-slate-755 font-sans">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold text-slate-600 border-b border-slate-150 uppercase tracking-wider">
                    <th className="p-4 text-center w-12 font-sans">àº¥àº³àº”àº±àºš</th>
                    <th className="p-4 font-sans">àº­àº°à»„àº«àº¼à»ˆ/àº„à»ˆàº²àºšà»àº¥àº´àºàº²àº™</th>
                    <th className="p-4 font-sans">à»àº§àº”àºà»ˆàº­àº</th>
                    <th className="p-4 font-sans">àº¥àº²àºàºàº²àº™àºªà»‰àº­àº¡àºà»ˆàº­àº</th>
                    <th className="p-4 font-sans">àº«àº»àº§à»œà»ˆàº§àº</th>
                    <th className="p-4 text-center w-36 font-sans">àºˆàº±àº”àºàº²àº™</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredRepairPresets
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
                              title="à»àºà»‰à»„àº‚ Mapping"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              à»àºà»‰à»„àº‚
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePresetClick(item.id)}
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-transparent hover:border-rose-100 cursor-pointer"
                              title="àº¥àº¶àºš Mapping"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              àº¥àº¶àºš
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                  {filteredRepairPresets.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400">
                        <Wrench className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        àºšà»à»ˆàºžàº»àºšàº‚à»à»‰àº¡àº¹àº™à»àºœàº™àºœàº±àº‡ Mapping àº—àºµà»ˆàº„àº»à»‰àº™àº«àº²!
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
                  {editingIndex === null ? 'à»€àºžàºµà»ˆàº¡àºšàº±àº™àºŠàºµàºœàº¹à»‰à»ƒàºŠà»‰à»ƒà»à»ˆ' : `à»àºà»‰à»„àº‚àºªàº´àº” à»àº¥àº° àº‚à»à»‰àº¡àº¹àº™ "${username}"`}
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
                  âš ï¸ {errorText}
                </div>
              )}

              {/* Body */}
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Username Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    àºŠàº·à»ˆàºœàº¹à»‰à»ƒàºŠà»‰à»€àº‚àº»à»‰àº²àº¥àº°àºšàº»àºš (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                    disabled={editingIndex !== null} // cannot change username once established for simplicity
                    placeholder="àº•àº»àº§àº¢à»ˆàº²àº‡: phone, ldb-staff-12"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  {editingIndex !== null && (
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      * àºŠàº·à»ˆàºœàº¹à»‰à»ƒàºŠà»‰àº¢àº·àº™àº¢àº±àº™à»àº¥à»‰àº§ àºšà»à»ˆàºªàº²àº¡àº²àº”àº›à»ˆàº½àº™à»àº›àº‡à»„àº”à»‰
                    </span>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    àº¥àº°àº«àº±àº”àºœà»ˆàº²àº™ (Password) *
                  </label>
                  <input
                    type="password"
                    required={editingIndex === null}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="àº›à»‰àº­àº™àº¥àº°àº«àº±àº”àºœà»ˆàº²àº™àºšàº±àº™àºŠàºµ"
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800"
                  />
                </div>

                {/* Optional User Image */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    àº®àº¹àºš User (Optional Avatar URL)
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
                      placeholder="https://... (àºšà»à»ˆàºšàº±àº‡àº„àº±àºš)"
                      className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white text-slate-800"
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileSelect}
                    className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:text-xs file:font-bold file:text-emerald-750 hover:file:bg-emerald-100"
                  />
                </div>

                {/* Role Switch & Branch selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      àºšàº»àº”àºšàº²àº” / àº¥àº°àº”àº±àºšàºªàº´àº” (Status/Role) *
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
                      <option value="User">Branch User (àºžàº°àº™àº±àºàº‡àº²àº™àºªàº²àº‚àº²)</option>
                      <option value="Admin">Admin (àºœàº¹à»‰àº”àº¹à»àº¥àº¥àº°àºšàº»àºšàº—àº»à»ˆàº§à»„àº›)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      àºªàº²àº‚àº²àºªàº±àº‡àºàº±àº” (Branch) *
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
                    ðŸ”‘ àºàº³àº™àº»àº”àºªàº´àº”àºàº²àº™à»€àº‚àº»à»‰àº²à»€àº–àº´àº‡ à»œà»‰àº²/àºŸàº±àº‡àºŠàº±àº™ (Module Tab Visibility):
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
                  àºàº»àºà»€àº¥àºµàº (Cancel)
                </button>
                <button
                  type="submit"
                  className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow flex items-center gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  àºšàº±àº™àº—àº¶àº (Save Account)
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
                à»àºˆà»‰àº‡à»€àº•àº·àº­àº™àº¥àº°àºšàº»àºš (System Notification)
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
                àº•àº»àºàº¥àº»àº‡ (OK)
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
                <h3 className="font-bold text-sm">àº¥àº²àºàº¥àº°àº­àº½àº” User (User View)</h3>
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
                  <p className="text-xs text-slate-500">{viewingUser.status === 'Admin' ? 'Admin' : 'Branch User'} Â· {viewingUser.branch || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold text-slate-500 mb-1">Password</p>
                  <p className="font-mono text-slate-900">â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢</p>
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
                        âœ… {findTab ? findTab.label : tabId}
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
                  àº›àº´àº” (Close)
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
                àº¢àº·àº™àº¢àº±àº™àºàº²àº™àº¥àº¶àºšàºœàº¹à»‰à»ƒàºŠà»‰?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                àº—à»ˆàº²àº™àº•à»‰àº­àº‡àºàº²àº™àº¥àº¶àºšàºšàº±àº™àºŠàºµàºœàº¹à»‰à»ƒàºŠà»‰ <strong className="text-slate-900 font-bold">"{deleteUserConfirm.username}"</strong> à»àº—à»‰àº«àº¼àºµàºšà»à»ˆ? àºàº²àº™àº”àº³à»€àº™àºµàº™àºàº²àº™àº™àºµà»‰àºšà»à»ˆàºªàº²àº¡àº²àº”àºàº»àºà»€àº¥àºµàºà»„àº”à»‰.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteUserConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                àºàº»àºà»€àº¥àºµàº (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteUser}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                àºàº·àº™àº¢àº±àº™àº¥àº¶àºš (Confirm Delete)
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
                àº¢àº·àº™àº¢àº±àº™àºàº²àº™àº¥àº¶àºš àºªàº²àº‚àº² / àºà»ˆàº²àº?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed">
                àº—à»ˆàº²àº™àº•à»‰àº­àº‡àºàº²àº™àº¥àº¶àºšàº‚à»à»‰àº¡àº¹àº™ àºªàº²àº‚àº²: <strong className="text-slate-900 font-bold">"{deleteBranchConfirm["àºªàº²àº‚àº²"]}"</strong> <br/>
                "àºà»ˆàº²àº/à»œà»ˆàº§àºàº‡àº²àº™": <strong className="text-slate-900 font-bold">"{deleteBranchConfirm["àºà»ˆàº²àº/à»œà»ˆàº§àºàºšà»àº¥àº´àºàº²àº™"]}"</strong> àº«àº¼àºµàºšà»à»ˆ?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteBranchConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                àºàº»àºà»€àº¥àºµàº (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteBranch}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                àºàº·àº™àº¢àº±àº™àº¥àº¶àºš (Confirm Delete)
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
                àº¢àº·àº™àº¢àº±àº™àºàº²àº™àº¥àº¶àºšàº¥àº²àºàºàº²àº™àºàº§àº”àºàº²?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed text-left">
                â€¢ <strong>àº¥àº°àºšàº»àºš:</strong> {deleteChecklistItemConfirm["àº¥àº°àºšàº»àºšàº—àºµà»ˆàºàº§àº”"]} <br/>
                â€¢ <strong>à»àº§àº”àº¥àº°àºšàº»àºšàºšà»àº¥àº´àºàº²àº™:</strong> {deleteChecklistItemConfirm["à»àº§àº”àº¥àº°àºšàº»àºšàºàº§àº”"]} <br/>
                â€¢ <strong>àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²:</strong> {deleteChecklistItemConfirm["àº¥àº²àºàºàº²àº™àºàº§àº”"]}
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteChecklistItemConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                àºàº»àºà»€àº¥àºµàº (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteChecklistItem}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                àºàº·àº™àº¢àº±àº™àº¥àº¶àºš (Confirm Delete)
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
                àº¢àº·àº™àº¢àº±àº™àºàº²àº™àº¥àº¶àºšàº‚àº°à»à»œàº‡?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed text-center font-sans">
                àº—à»ˆàº²àº™àº•à»‰àº­àº‡àºàº²àº™àº¥àº¶àºšàº‚à»à»‰àº¡àº¹àº™ àº‚àº°à»à»œàº‡: <strong className="text-slate-900 font-bold">"{deleteSectorConfirm["àº‚àº°à»à»œàº‡"]}"</strong> à»àº—à»‰àº«àº¼àºµàºšà»à»ˆ?
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setDeleteSectorConfirm(null)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                àºàº»àºà»€àº¥àºµàº (Cancel)
              </button>
              <button
                type="button"
                onClick={executeDeleteSector}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                àºàº·àº™àº¢àº±àº™àº¥àº¶àºš (Confirm Delete)
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
                àº¢àº·àº™àº¢àº±àº™àºàº²àº™àº£àºµà»€àºŠàº±àº”àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²?
              </h3>
              <p className="text-xs text-slate-550 leading-relaxed text-center font-sans">
                àº—à»ˆàº²àº™àº•à»‰àº­àº‡àºàº²àº™àº£àºµà»€àºŠàº±àº”àº¥àº²àºàºàº²àº™àºàº§àº”àºàº²àº—àº±àº‡à»àº»àº”àºàº±àºšà»„àº›à»€àº›àº±àº™àº„à»ˆàº²à»€àº¥àºµà»ˆàº¡àº•àº»à»‰àº™àº¥àº°àºšàº»àºšàº«àº¼àºµàºšà»à»ˆ? àº‚à»à»‰àº¡àº¹àº™àº—àºµà»ˆàº—à»ˆàº²àº™à»€àºžàºµà»ˆàº¡à»ƒà»à»ˆàº—àº±àº‡à»àº»àº”àºˆàº°àº–àº·àºàº¥àº¶àºšàº­àº­àº.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2 font-sans">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow-xs"
              >
                àºàº»àºà»€àº¥àºµàº (Cancel)
              </button>
              <button
                type="button"
                onClick={executeResetChecklist}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-xl cursor-pointer transition shadow"
              >
                àºàº·àº™àº¢àº±àº™àº£àºµà»€àºŠàº±àº” (Confirm Reset)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
