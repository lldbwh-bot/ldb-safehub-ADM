import branchImage from './assets/branches/branch.png';
import cashRoomImage from './assets/branches/cash-room.png';
import headquartersImage from './assets/branches/headquarters.png';

export type BranchMediaKind = 'headquarters' | 'branch' | 'cash-room';

const CASH_ROOM_NAME = '\u0eab\u0ec9\u0ead\u0e87\u0eae\u0eb1\u0e9a\u0ec0\u0e87\u0eb4\u0e99';
const HEADQUARTERS_NAMES = [
  '\u0eaa\u0ecd\u0eb2\u0e99\u0eb1\u0e81\u0e87\u0eb2\u0e99\u0ec3\u0eab\u0e8d\u0ec8',
  '\u0eaa\u0eb3\u0e99\u0eb1\u0e81\u0e87\u0eb2\u0e99\u0ec3\u0eab\u0e8d\u0ec8',
];

function normalizeBranchName(branchName: string): string {
  return branchName.trim().toLowerCase();
}

export function getBranchMediaKind(branchName: string): BranchMediaKind {
  const normalizedName = normalizeBranchName(branchName);

  if (normalizedName.includes(CASH_ROOM_NAME)) return 'cash-room';
  if (HEADQUARTERS_NAMES.some((name) => normalizedName.includes(name))) return 'headquarters';

  return 'branch';
}

export function getBranchImage(branchName: string): string {
  switch (getBranchMediaKind(branchName)) {
    case 'cash-room':
      return cashRoomImage;
    case 'headquarters':
      return headquartersImage;
    default:
      return branchImage;
  }
}
