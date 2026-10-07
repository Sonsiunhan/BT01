const AUTH_PATHS = new Set(["/dang-nhap", "/login", "/dang-ky", "/register", "/quen-mat-khau", "/forgot-password"]);

function hasControlChars(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f) return true;
  }
  return false;
}

/**
 * Accept only a same-origin application path. Query/hash are preserved for
 * draft/filter state, while external, protocol-relative and auth-loop targets
 * fall back to a known safe destination.
 */
export function safeReturnTo(value: string | null | undefined, fallback = "/ho-so"): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || hasControlChars(value)) return fallback;
  try {
    const target = new URL(value, window.location.origin);
    if (target.origin !== window.location.origin || target.username || target.password || AUTH_PATHS.has(target.pathname)) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch { return fallback; }
}

export function loginReturnPath(current: { pathname: string; search?: string; hash?: string }): string {
  const target = `${current.pathname}${current.search ?? ""}${current.hash ?? ""}`;
  return `/dang-nhap?returnTo=${encodeURIComponent(safeReturnTo(target, "/"))}`;
}
