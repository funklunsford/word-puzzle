# Launch plan

Putting Strokes on its own domain and opening it to the public. A checklist: each step says who
does it (**Owner**, or **Claude** in a session in this repo), and ticks when it's done.

**Where things stand (2026-10-14):**
- Every push to `main` is tested and published (`.github/workflows/deploy.yml`).
- A Claude Code routine in Anthropic's cloud adds each day's puzzle (`docs/daily-prompt.md`).
- Link previews and result cards work.
- The word-list and WordNet licence notices ship with the site.
- Ad slots are built in, behind the `ads` flag (`src/ads.ts`).
- The game lives at https://strokes.fun (Cloudflare Pages). The old address, funklunsford.github.io/strokes/, is no longer published to and isn't redirected: no one uses it.

## Decisions first (Owner)

Each with Claude's recommendation.

- [x] **Name and domain:** strokes.fun (bought 2026-10-14).
- [x] **Hosting:** Cloudflare Pages, which is free.
  - It gives unlimited traffic, caching and security headers you control, a preview link for every branch, and free analytics.
  - Staying on GitHub Pages with the domain is less work. But its caching is fixed, and GitHub's terms aren't meant for commercial sites, which matters if ads come.
- [x] **Analytics: Cloudflare Web Analytics.** Cloudflare adds its script to strokes.fun's pages; it sets no cookies, so it needs no consent banner. The security policy allows it (`public/_headers`).
- [ ] **Ads at launch.** Recommended: not yet.
  - AdSense needs your own domain, a privacy policy, Google's consent message for EU and UK players, an `ads.txt` file and a review.
  - The slots are ready, so adding them later is the flag plus the IDs.
- [x] **The Puzzle Playlist moves to strokes.fun**, as strokes.fun/playlist/, so it shares Strokes' browser storage and still sees its "done" mark (`puzzle-done:strokes:{date}`). **Mountweazel stays on github.io**, so the Playlist ticks it like any other game.
- [x] **Existing players' saves: start fresh.** No redirect from the old address, and nothing carried over.
- [ ] **Public or private source.** See Security below.

## 1. Domain and hosting: moving to Cloudflare Pages

1. [ ] **Owner: put strokes.fun on Cloudflare.**
   - A free account at dash.cloudflare.com, with two-factor sign-in.
   - Add a domain, `strokes.fun`, on the Free plan.
   - If it was bought elsewhere, set the registrar's nameservers to the two Cloudflare shows. At the registrar, also turn on auto-renew and the transfer lock, and turn off any parking page.
2. [ ] **Owner: let GitHub publish to Cloudflare.**
   - An API token with Account > Cloudflare Pages > Edit, and the account's ID.
   - Add them as the repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (`gh secret set …`, see README.md).
3. [x] **Claude: publish to Cloudflare too** (`scripts/deploy-cloudflare.sh`, after the GitHub Pages publish). It makes the Pages project "strokes" on its first run, and waits, with a warning, until the secrets exist.
   - The licence notices ship in every build (`public/licenses`).
   - The theme set-up moved from inline to `public/boot.js`, so the security policy allows only the site's own scripts.
   - `public/_headers`:
     - code cached for a year;
     - nosniff, a referrer policy, and no camera, microphone or location;
     - no framing;
     - the content security policy, report-only until checked.
   - The site's address is one setting: `VITE_SITE_URL` in `.env`, used by the link-preview tags and the share text.
4. [x] **Owner: attach the domain.** `strokes.fun` is attached and serving. `www.strokes.fun` is still to add, with a rule sending it to strokes.fun.
5. [ ] **Claude: make strokes.fun the address.**
   - [x] `VITE_SITE_URL` is https://strokes.fun/: link previews, share text and cards, the canonical link, and `robots.txt`.
   - [x] Cloudflare is the only publish. GitHub Pages' `scripts/deploy.sh` and its deploy-key script are gone. Pull requests get preview copies.
   - [x] The content security policy is enforced, after a report-only publish with nothing reported, and a check that no built script builds code from strings.
   - [x] The old GitHub Pages site (`funklunsford/strokes`) is switched off, and its deploy key and `STROKES_DEPLOY_KEY` secret are deleted (owner's call, 2026-10-15).
   - [x] The Playlist at strokes.fun/playlist/: `functions/playlist/[[path]].js` forwards it from its GitHub Pages site, so neither repo's publishing changes. Only `/playlist` paths run the function (`public/_routes.json`). The Playlist's own repo points Strokes, its bookmarklet and its links at strokes.fun.
6. [ ] **Owner, with values from Claude: the domain's security settings** (see Security below).

## 2. Ready for players everywhere

- [x] **Claude: puzzles two days ahead** (2026-10-15). The nightly run used to add today's puzzle just after midnight Eastern, but each player gets theirs at their own midnight.
  - In London the new puzzle came about 5 hours late, in Tokyo about 13, and until then they got yesterday's again.
  - The routine's prompt and the runbook now add days through two days after today (Eastern). The game plays a puzzle only on its own date, so the ones ahead wait unseen (tested), and one failed night does no harm.
- [ ] **Claude: an alert when puzzles run low.** A daily GitHub check that fails, and emails the owner, if tomorrow's puzzle isn't in.
- [ ] **Claude: home-screen install.** A web app manifest and PNG icons (180, 192 and 512 px) from the tab icon.
- [ ] **Claude: a privacy and credits page.**
  - what's stored (only on the player's device);
  - analytics, if any;
  - a contact address;
  - the SCOWL, ENABLE and WordNet credits.
- [ ] **Claude: the basics.** `robots.txt`, a canonical address and the analytics snippet.
- [ ] **Optional: error reporting** (Sentry's free tier), so crashes on other people's devices show up. Owner makes the account; Claude wires it in.

## 3. Security

Strokes is static files: no server, database, login or personal data, and React escapes all the
text it shows. The risks are around what can change the live site. Every push to `main` goes to
players, and three things can push: the owner, the nightly run, and anyone who gets into the owner's
GitHub account.

**Done (2026-10-14)**
- [x] **`main` can't be rewritten.** A ruleset ("Protect main") blocks force-pushes and deleting the branch. Normal pushes, including the nightly run's, still work.
- [x] **The nightly run has no web tools.** WebFetch and WebSearch are disallowed, so it never reads web pages, where injected instructions usually come from.
- [x] **Only day files go live from the nightly run** (`scripts/check-nightly.sh`, in the deploy workflow).
  - Before publishing, every commit Claude pushed straight to `main` since the last publish may only add `src/daily/days-5/{DATE}.json`.
  - If one did more, nothing is published, then or later, until the owner has looked: revert it or keep it, then publish by hand (Actions > Test and deploy > Run workflow).
  - Commits merged from a pull request aren't checked, since a person merged them.
  - It goes by the commit's author, so it catches mistakes and simple tricks, not a determined forger. The other safeguards back it up.
- [x] **Dev tools updated.**
  - vitest 3.2.7 had two critical advisories and one moderate one, all fixed in 4.1.11. vite-node 6 is now its own dev dependency, so `npm run daily` keeps working.
  - `npm audit` finds nothing. These tools never ship to players, but they run on the owner's machine and in CI.
- [x] **Dependabot alerts on**, plus weekly grouped update pull requests for npm and the Actions (`.github/dependabot.yml`).
- [x] **Actions pinned to commits** (checkout v5.1.0, setup-node v5.0.0), so a moved tag can't change what runs. Dependabot keeps them current.
- [x] The deploy key can write to the old site repo only, and is no longer used (removal is listed in step 5).

**To do**
- [ ] **Claude:** turn on Dependabot's security-fix pull requests (after the vitest update is on `main`, so it doesn't open a duplicate).
- [ ] **Owner: public or private source.** `funklunsford/word-puzzle` is public. That shows the whole puzzle pool (`public/pool-5.json`), the runbook and design notes, and your commit email address. With puzzles made two days ahead, it would also show tomorrow's puzzle. Anyone could copy the game wholesale. Making it private hides all that, with two catches:
  - On a free personal account, rulesets don't apply to private repos, so "Protect main" would stop working (GitHub Pro keeps it).
  - The nightly run's GitHub access must cover private repos.

  Actions minutes are no issue: deploys use a small part of the free allowance.
- [ ] **Owner: email for failed runs.** In GitHub's notification settings, keep email on for failed Actions runs. That's how the nightly check (and the planned low-puzzle alert) reach you.
- [ ] **Owner: two-factor sign-in, ideally passkeys,** on GitHub, the domain registrar, Cloudflare and the Claude account (the nightly run acts through it).
- [ ] **Owner: the domain's settings.**
  - registrar lock and auto-renew (a lapsed domain can be bought by anyone and serve anything to your players);
  - DNSSEC;
  - CAA records naming the certificate authority;
  - HTTPS only.
  - If no email is sent from the domain, SPF and DMARC records set to reject all mail, so no one can send email that claims to be from it.
- [ ] **Claude: security headers**, once hosting is decided. These are:
  - a content security policy allowing only the site's own scripts and the ones chosen (the inline theme script in `index.html` by its hash);
  - no framing by other sites;
  - `nosniff`, a referrer policy;
  - no camera, microphone or location access.
- [ ] **Both: third-party scripts.** Analytics, ads and error reporting can each do anything on the page. Add only what's needed, and list each in the security policy and on the privacy page.
- [ ] **Privacy.** Nothing personal is collected: everything stays in the player's browser. Ads would change that, and need consent in the EU and UK.

Moving off funklunsford.github.io also isolates players' saves. Every site published at that
address shares Strokes' browser storage, so any of them could read or change it.

**Not a worry yet**
- Cheating: future puzzles in the code don't matter without leaderboards or prizes. If those come, results must be checked on a server.
- Floods of traffic: the CDN absorbs those.

## 4. Test before launch

- [ ] **Owner:** play on a real iPhone and an Android phone. The five-letter game hasn't been tried on one yet (DESIGN.md). Check dragging, double-tap to turn, sharing and Add to Home Screen.
- [ ] **Claude:** a speed and accessibility pass. A first visit is about 290 KB compressed: the code is 143 KB, definitions 95 and the maze 42.
- [ ] **Both:** a soft launch, a week with a handful of friends, watching the analytics and feedback.

## 5. Launch, then grow

- [ ] Share the link. The link preview and result cards are ready.
- [ ] Later: ads; offline play; accounts, if players want their streaks on every device.

**Costs:** the domain. Hosting, analytics and error reporting are free at this size, and the
nightly run uses the owner's Claude plan.
