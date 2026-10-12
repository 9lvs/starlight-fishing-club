// Sharing text from a web page: the phone's share sheet when there is one,
// otherwise the clipboard, otherwise a dialog the player can copy from.
import { LINKS } from '../config/links';
import { openDomDialog } from './domDialog';

export type ShareResult = 'shared' | 'copied' | 'shown';

/** The address to put in share text. On itch.io the page address is the game's frame, so set LINKS.gameUrl. */
export function gameUrl(): string {
  return LINKS.gameUrl || `${location.origin}${location.pathname}`;
}

/** A short, non-identifying description of the device for feedback reports. */
export function deviceSummary(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Other';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other';
  const orient = innerWidth >= innerHeight ? 'landscape' : 'portrait';
  return `${os}, ${browser}, ${innerWidth}x${innerHeight} ${orient}`;
}

/** The feedback address, with the version and device filled in on GitHub's form. */
export function feedbackLink(version: string): string | null {
  const url = LINKS.feedbackUrl;
  if (!url) return null;
  if (!/github\.com\/.+\/issues\/new/.test(url)) return url;
  const q = new URLSearchParams({ version, device: deviceSummary() });
  return `${url}${url.includes('?') ? '&' : '?'}${q.toString()}`;
}

export async function shareText(title: string, text: string): Promise<ShareResult> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
  if (nav.share && matchMedia?.('(pointer: coarse)').matches) {
    try {
      await nav.share({ title, text });
      return 'shared';
    } catch {
      // Dismissed or not allowed: fall through to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    openDomDialog({ title, text: 'Copy this and paste it anywhere.', value: text, readOnly: true });
    return 'shown';
  }
}
