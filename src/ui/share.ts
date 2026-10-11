// Sharing text from a web page: the phone's share sheet when there is one,
// otherwise the clipboard, otherwise a dialog the player can copy from.
import { LINKS } from '../config/links';
import { openDomDialog } from './domDialog';

export type ShareResult = 'shared' | 'copied' | 'shown';

/** The address to put in share text. On itch.io the page address is the game's frame, so set LINKS.gameUrl. */
export function gameUrl(): string {
  return LINKS.gameUrl || `${location.origin}${location.pathname}`;
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
