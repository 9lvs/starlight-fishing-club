# Hosting, sign in, and cloud saves

The game is a static site on Cloudflare (Workers with static assets,
`wrangler.jsonc`) at https://starlight-fishing-club.sofcb2004.workers.dev. Sign in and cloud saves use
Supabase. Playing without an account always works: the save on the device
comes first, and the cloud keeps a copy (`src/features/cloud`).

## How it works

- **Sign in:** Google, or a link sent by email (no passwords). Supabase's PKCE
  flow; the session is kept in the browser.
- **Sync:** on sign in, every 2 minutes while playing, when the tab is hidden,
  and on Save now. The rules are in `src/features/cloud/sync.ts`: a new device
  takes the cloud save, whichever side changed since they last agreed wins, and
  when both changed the player picks. The copy that loses is kept on the device
  (`starlight-fishing-club/backup-device` or `backup-cloud` in local storage).
- **Security:**
  - Row level security: a signed-in player can read and write only their own
    row (`supabase/migrations/001_cloud_saves.sql`). The anon key in
    `src/config/cloud.ts` is public by design. Never put the service_role key in the game.
  - The database refuses saves over 256 KB and caps the summary size.
  - A downloaded save goes through the same checksum, schema, and migration
    checks as Import before it replaces anything.
  - `public/_headers` sets a strict Content-Security-Policy (only the game's own
    files, and network calls only to the Supabase project), plus nosniff, HSTS,
    and a referrer policy.
  - Settings > Account can delete the cloud save or the whole account
    (`delete_my_account()`, which only ever deletes the caller).
- **itch.io and other frames:** Google will not sign in inside a frame, so the
  Account panel points players to the game's own site there.

## Setup checklist (owner)

### 1. Supabase database
1. Dashboard > SQL Editor > New query. Paste all of
   `supabase/migrations/001_cloud_saves.sql` and Run. It is safe to run again.
2. Table Editor > `saves`: it should show "RLS enabled" with 4 policies.

### 2. Cloudflare (done)
1. Workers & Pages > Create > Import a repository > `9lvs/starlight-fishing-club`.
2. Build command `npm run build`, deploy command `npx wrangler deploy`, preview
   builds on, Cloudflare Access off, build variable `NODE_VERSION` = `22`.
   `wrangler.jsonc` points it at `dist/`.
3. Other branches get preview addresses such as
   `https://main-5zwqb9-starlight-fishing-club.sofcb2004.workers.dev`, handy for
   testing sign in before it ships.

### 3. Supabase sign-in addresses
Authentication > URL Configuration:
- **Site URL:** `https://starlight-fishing-club.sofcb2004.workers.dev` (later the custom domain).
- **Redirect URLs:** add each place the game runs:
  - `https://starlight-fishing-club.sofcb2004.workers.dev/**`
  - `https://*-starlight-fishing-club.sofcb2004.workers.dev/**` (preview builds)
  - `http://localhost:5173/**` (development)
  - the custom domain, once there is one.

### 4. Google sign in
1. [Google Cloud console](https://console.cloud.google.com/): create a project
   ("Starlight Fishing Club").
2. APIs & Services > OAuth consent screen (Google Auth Platform): External, app
   name, support email, app logo optional. Add the privacy page
   (`https://starlight-fishing-club.sofcb2004.workers.dev/privacy.html`). Under authorized
   domains add `sofcb2004.workers.dev` and `kkfxlklaqcoixykicvwo.supabase.co`.
   Scopes: only email, profile, openid. Publish the app (Testing mode only lets
   listed test users sign in).
3. Credentials > Create credentials > OAuth client ID > Web application.
   - Authorized JavaScript origins: `https://starlight-fishing-club.sofcb2004.workers.dev` (and the custom domain later).
   - Authorized redirect URI: `https://kkfxlklaqcoixykicvwo.supabase.co/auth/v1/callback`
4. Copy the Client ID and Client Secret into Supabase: Authentication >
   Sign In / Providers > Google > enable, paste both, save. The secret stays in
   Supabase only.

### 5. Email links
Authentication > Sign In / Providers > Email: enabled. The free plan sends a
few emails an hour from Supabase's address, which is fine for testing and a
small launch. For more, add your own email sender (SMTP) under
Authentication > Emails later. The email template's wording can be changed there too.

### Notes
- Free Supabase projects pause after about a week with no visits. Playing
  continues; sign in works again once the project wakes (Dashboard > Restore).
- When the address changes (custom domain), update the Redirect URLs, the Google
  origins, `og:url` and `og:image` in `index.html`, and `LINKS.gameUrl`.
