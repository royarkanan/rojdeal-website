export const sections=['saved-searches','blocked-users','analytics','subscription','help','ad-privacy'] as const;
export type AccountSectionName=typeof sections[number];
