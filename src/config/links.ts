// Public links and the version shown to players and in feedback reports.

/** Keep in step with package.json "version" (a test checks). */
export const GAME_VERSION = '0.2.0';

export const LINKS = {
  /** The game's public address, used in share text. Empty: use the page's own address. */
  gameUrl: '',
  /**
   * Where the Feedback button goes. The GitHub form gets the game version and device
   * filled in. A Google Form or any other page works too (nothing is added to it).
   * Empty hides the button.
   */
  feedbackUrl: 'https://github.com/9lvs/starlight-fishing-club/issues/new?template=feedback.yml',
} as const;
