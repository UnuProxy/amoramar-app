const BACKOFFICE_PREFIXES = [
  '/dashboard',
  '/employee',
  '/client',
  '/login',
  '/change-password',
  '/check-role',
];

export const isBackofficePath = (pathname?: string | null): boolean => {
  if (!pathname) return false;
  return BACKOFFICE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
};

export const isWebsitePath = (pathname?: string | null): boolean => {
  return !isBackofficePath(pathname);
};
