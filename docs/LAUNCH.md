# Launch plan

Everything needed to test, ship, and find players for Starlight Fishing Club v1.
Items marked **(you)** need the owner of the GitHub and itch.io accounts. The rest
is already set up in the repo.

## 1. Test it

### On your computer
```bash
npm ci
npm run check        # typecheck, unit tests, production build
npm run dev          # http://localhost:5173 (and a Network URL for your phone)
```
Add `?debug=1` for the debug panel: add coins, force a rarity, set the time of day,
move the club, max upgrades, reset the Daily Catch. `?debug=styleguide` shows every
sprite, button, and boat tier.

### On real phones (you)
Open the Network URL from `npm run dev` on a phone on the same Wi-Fi. Things only a
real device can tell you:
- Touch feel of the Cast button and the bite window.
- The notch and home bar (nothing important should hide under them).
- Sound: volume, which sounds feel too loud or too frequent.
- Rotate the phone mid-game. Lock it, wait a few minutes, come back (offline catch-up).
- "Add to Home Screen" (iPhone Safari: Share > Add to Home Screen, Android Chrome:
  menu > Install app). It should open full screen with the pixel boat icon.

### Playtest checklist (give this to 5 to 10 friends)
1. First 5 minutes: did you know what to do? When did you buy your first upgrade?
2. First move to Whisper River (about 20 to 25 minutes): did starting over feel worth it?
3. Daily Catch: find today's fish, press Share, paste it to someone. Was it fun?
4. Close the tab for an hour with a helper hired, then come back.
5. What was confusing, what was the best moment, would you come back tomorrow?

The production build (`npm run build && npx vite preview`) is the one to playtest:
it has no debug panel and it works offline once loaded.

## 2. Deploy

### GitHub Pages (free hosting at `https://9lvs.github.io/starlight-fishing-club/`)
The workflow `.github/workflows/deploy.yml` builds, tests, and publishes on every push
to `main`. Status: the repo is public and Pages is on (source: GitHub Actions), so
every push to `main` goes live in about a minute. Watch it under the repo's Actions tab.

- Check the live URL on a phone and desktop. Paste the URL into a Discord or iMessage
  chat to see the link preview card (`public/og-image.png`).
- Players get updates on their second visit after a deploy (the offline cache serves
  the old version once while it fetches the new one).
- `?debug=1` works on the live site too (handy for testing). It only changes the
  player's own save, so it is harmless, but do not link to it publicly.

If you use a different address (custom domain, or itch.io only), update the `og:url`
and `og:image` tags in `index.html` and set `LINKS.gameUrl` in `src/config/links.ts`.

### itch.io (where web game players browse)
1. `npm run package:itch` writes `starlight-fishing-club-itch.zip`.
2. **(you)** itch.io > Create new project. Kind: **HTML**. Upload the zip, tick
   "This file will be played in the browser".
3. Embed: 360 x 640, tick **Mobile friendly** (orientation: default), **Fullscreen
   button**, and **Automatically start on page load** off (so the cover shows).
4. Page: cover image 630 x 500 (crop `public/og-image.png`), 3 to 5 screenshots and a
   GIF (the style guide and debug panel make good shots), tags: `cozy`, `fishing`,
   `idle`, `incremental`, `pixel-art`, `relaxing`, `casual`, `singleplayer`.
   Price: free, or "pay what you want" with a $0 minimum.
5. Set `LINKS.gameUrl` to the itch page URL if itch is the main home, so share text
   points there and not at itch's game frame.

### Before you announce (you)
- [x] Feedback: Settings > Feedback opens a short GitHub form with the version and device
      filled in. Read replies under the repo's Issues tab. For testers without a GitHub
      account, make a Google Form and put its link in `LINKS.feedbackUrl`
      (`src/config/links.ts`).
- [ ] Optional privacy-friendly analytics (GoatCounter or Plausible: no cookies, no
      banner needed). Ask Claude to wire it in once you have an account.
- [ ] Social handles reserved (same name everywhere if you can).
- [ ] Optional custom domain (about $12 a year), pointed at GitHub Pages.

## 3. What v1 adds for launch
- **Daily Catch.** One fish a day for everyone at Willow Pond (3x coins). Your first five
  catches of the day make a luck score, and Share copies it (or opens the phone's share sheet):
  ```
  Starlight Fishing Club 🎣 First Five · 2026-10-12
  ⬜🟩🎣⬜🟪  Luck 11/25
  A lucky day!
  https://9lvs.github.io/starlight-fishing-club/
  ```
  No streaks: missing a day costs nothing.
- **Installable and offline.** Web app manifest, pixel icons, a service worker. Players
  can add it to their home screen and play without a connection.
- **Link previews.** Title, description, and a 1200 x 630 image for Discord, iMessage,
  Reddit, X, and Bluesky.
- **Tell a friend** and **Feedback** buttons in Settings.

## 4. After launch: ideas, roughly in order
1. **Spanish (and other) translations.** All UI text through one strings file. Cozy
   and daily games travel well, and Spanish opens Latin America and Spain.
2. **Catch photo card.** A pixel image of your legendary catch on your boat, made for
   sharing on Instagram and TikTok.
3. **Achievements and a collection log** ("all night fish", "every water").
4. **Seasonal content packs** (autumn fish, a winter ice lake), just JSON.
5. **Crew visible on the water**, and an aquarium for kept fish.
6. **Real art and music.** Commission a pixel artist for the boat, fisher, and fish,
   and a musician for a soft loop. Credits go in Settings.
7. **Daily Catch board.** The fewest casts today, if a tiny backend is ever added.
8. **Mobile stores.** Wrap the same build with Capacitor for iOS and Android once the
   web version proves people come back. Costs: Apple $99 a year, Google $25 once.
   The save already sits behind a storage interface, and safe areas and fullscreen
   already work.

Money, only once people love it: keep the web game free. Options that fit the calm
pillar: itch.io pay what you want, a one-time "Supporter's Pennant" cosmetic, or a
paid ad-free mobile app. Avoid energy timers, loot boxes, and forced ads.

## 5. Who it is for
- **Cozy gamers** (Stardew Valley, Animal Crossing, Unpacking, Dredge's calm moments).
  Fishing is already their favorite side activity.
- **Idle and incremental fans** who love numbers going up and a prestige loop
  (r/incremental_games).
- **Daily puzzle players** (Wordle, Connections, Krillion): a 3 to 5 minute ritual with
  a share at the end. The Daily Catch is for them.
- **Second screen and break time players**: students and office workers who want
  something soothing in a tab that keeps going while they work.
- **Pixel art fans** who share gifs.

Pitch in one line: *a calm pixel fishing game you can play in a browser tab, with a new
Daily Catch every day.*

## 6. How other web games spread, and what to copy

**Wordle (2021).** Josh Wardle made it for his partner. It had about 90 daily players
on November 1, 2021. The spoiler-free grid of colored squares that players posted on
social media drove the jump to around 300,000 by early January, and The New York Times
bought it on January 31, 2022 for a reported low seven figures.
Copy: one shared daily challenge, the same for everyone, a share that makes people
curious without spoiling it, no account or app or ads, and a tiny session.

**Krillion Infinite.** A free daily word game in the browser: everyone gets the same
seven prompts a day, a session is about four minutes, and rarer answers score more.
I could not find details on how it was marketed. Copy: the Wordle formula plus a twist
that rewards rarity, which is exactly what a rare-fish game is about.

**Universal Paperclips (2017).** Frank Lantz announced the free web idle game on
Twitter on October 9, 2017. Its site kept going down from the traffic, Wired reported
about 450,000 players in the first 11 days, Reddit picked it up, and it later sold as a
paid mobile app. Copy: launch free on the web, give people something to talk about,
then port to mobile once it is proven.

**Common threads** (also true of Cookie Clicker, A Dark Room, and 2048, which all
started as free browser games): instant play from a link, a hook you can describe in
one sentence, people sharing their own result rather than an ad, and the creator
showing up personally in the communities where it spreads.

## 7. Where to post, and what
- **itch.io:** the page itself, a devlog per update, and the itch tags above. New
  releases get a short window on itch's "new and popular" lists.
- **Reddit** (read each subreddit's self-promotion rules first, and post as a person,
  not a brand): r/incremental_games (idle mechanics, honest feedback), r/CozyGamers,
  r/WebGames, r/playmygame, r/IndieGaming, r/pixelart (a gif of the day cycle).
- **TikTok, Instagram Reels, YouTube Shorts:** 10 to 20 second vertical clips. The
  calm dusk to night dissolve, a legendary catch with sparkles, the boat upgrading from
  dinghy to schooner, a cozy "play with me" over lo-fi. Post the day's Daily Catch.
- **Bluesky and X:** #screenshotsaturday, #pixelart, #indiedev, #cozygames, plus
  the Daily Catch grid every day.
- **Hacker News "Show HN":** the technical story (a whole-screen pixel game in
  TypeScript and Phaser, data-driven content, a simulation-tuned economy).
- **Cozy game creators and newsletters:** a short email with the link, a gif, and one
  sentence on why their audience would like it. Small creators answer more often.
- **Web game portals later** (CrazyGames, Poki): big audiences, but they usually want
  their own SDK and sometimes ads or exclusivity. Read their terms before submitting.

## 8. A simple two-week launch
- **Week before:** playtest with friends, fix what confuses them, finish the itch page,
  record 3 short clips, write the Reddit and Show HN posts.
- **Launch day (Tuesday to Thursday morning, US time):** make the site live, post on
  itch, Reddit (one or two subreddits a day, not all at once), Bluesky, X, and TikTok.
  Share your own Daily Catch.
- **Days 2 to 7:** answer every comment, ship small fixes (a "v1.0.1" devlog shows the
  game is alive), post a daily Daily Catch and a clip every other day.
- **Week 2:** Show HN and creator outreach with the best clip, and pick the next
  feature from what players asked for.

What to watch: players per day, how many come back the next day and the next week,
Daily Catch shares, and the first move to Whisper River (if people stop before it,
the first run is too long).
