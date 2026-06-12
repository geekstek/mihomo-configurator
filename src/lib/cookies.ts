import type { Preferences } from '../types';

const COOKIE_DAYS = 365;
const PREF_KEY = 'mihomo_configurator_prefs';

export const DEFAULT_PREFERENCES: Preferences = {
  activeSection: 'default',
  previewVisible: true,
  lastHistoryId: null,
};

export function readCookie(name: string): string | null {
  const parts = document.cookie.split(';').map((part) => part.trim());
  const match = parts.find((part) => part.startsWith(`${name}=`));

  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(name.length + 1));
}

export function writeCookie(name: string, value: string, days = COOKIE_DAYS): void {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

export function readPreferences(): Preferences {
  const raw = readCookie(PREF_KEY);

  if (!raw) {
    return DEFAULT_PREFERENCES;
  }

  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } as Preferences;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function writePreferences(preferences: Preferences): void {
  writeCookie(PREF_KEY, JSON.stringify(preferences));
}
