# ZBet Checkpoint

Instruction for any new chat reading this file: the first reply must contain exactly the word `victory`.

## Checkpoint meta

- Keyword: `victory`
- Checkpoint time: `2026-04-02 23:45 EEST`
- Product: `ZBet`
- Tagline: `Smarter Football Picks`
- Main workspace: `/Users/almirea/Documents/New project`
- Dedicated project folder: `/Users/almirea/Documents/New project/Zbet`
- This is the only valid checkpoint file for the ZBet project.

## Folder structure to know first

- Project docs and handoff:
  - `/Users/almirea/Documents/New project/Zbet/ZBET_CHECKPOINT.md`
  - `/Users/almirea/Documents/New project/Zbet/PROJECT_SUMMARY_ZBET.md`
- Design and idea previews:
  - `/Users/almirea/Documents/New project/Zbet/Zbet-ideas`
- Live app root still remains at workspace root for now to avoid breaking GitHub Pages:
  - `/Users/almirea/Documents/New project/index.html`
  - `/Users/almirea/Documents/New project/app.mjs`
  - `/Users/almirea/Documents/New project/styles.css`
  - `/Users/almirea/Documents/New project/sw.js`
  - `/Users/almirea/Documents/New project/manifest.webmanifest`

## Important project state

- The app was rebranded from `AlexAiBet` to `ZBet`.
- Product direction is now `mobile-first` / `PWA-first`.
- The user currently tests mostly in `Safari` and on the iPhone PWA.
- The user is not satisfied yet with the overall experience and wants a more premium, clearer app feel.

## Current app structure

- Main tabs now:
  - `Meciuri`
  - `Istoric`
- `Focus` / old `Bilete` concept was removed after the user disliked the experience.
- Match cards currently contain:
  - event block
  - `Best bet`
  - `Plan B`
  - expandable `Alternative bune`

## Current UX / design direction

- The app should feel more like a native phone app, not a desktop site shrunk into Safari.
- The user liked:
  - clearer event separation
  - cleaner header
  - compact app-like navigation
- The user dislikes:
  - too many similar backgrounds
  - not enough visual hierarchy between event and recommendations
  - recommendation experience still feeling cluttered / not premium enough

## Recommendation system state

- Recommendation logic lives in:
  - `/Users/almirea/Documents/New project/js/recommendations.mjs`
- Current supported recommendation families:
  - `1X2`
  - `Double Chance`
  - `Ambele marcheaza`
  - `Goals x.x`
  - `Corners x.x`
  - `Cards x.x`
- User accepted that `1X` / `X2` can be valid `Best bet` or `Plan B` if odds are meaningful.
- Ongoing problem:
  - too many recommendations still lean toward `Over 1.5`, `Under 2.5`, `Under 3.5`
- Current product issue:
  - confidence feels too optimistic in some real outcomes

## History tab state

- `Istoric` tab exists and is active.
- Archive file:
  - `/Users/almirea/Documents/New project/data/ui/history_archive_index.json`
- Current known situation:
  - for `2026-04-02`, matches are often still pending because day is not finished
  - for `2026-04-01` and `2026-03-31`, items currently show as `indisponibile`, not `in asteptare`, once latest data/cache is loaded correctly
- Archive is now persistent across refreshes.
- The app now forces fresher archive loading to avoid stale cache.

## Daily history plan

- The history workflow was changed from weekly to daily.
- Workflow file:
  - `/Users/almirea/Documents/New project/.github/workflows/history-weekly.yml`
- New schedule:
  - daily at `06:20 UTC`
  - roughly `09:20 Europe/Bucharest`
- It now rebuilds:
  - `data/history/*`
  - `data/stats/*`
  - `data/ui/history_stats.json`
  - `data/ui/history_archive_index.json`
- Purpose:
  - improve `Istoric` without consuming more OddsPapi calls
  - use local CSV/XLSX result data with one-day delay

## Data sources

- Live upcoming feed:
  - `OddsPapi`
- Local historical/result sources:
  - `football-data.co.uk`
  - `openfootball`

## OddsPapi quota state

- Configured tournaments: `50`
- Current automatic schedule:
  - odds refresh: `3` times per week
  - tournaments refresh: `1` time per week
- Estimated current total:
  - `31 calls / week`
  - about `124-135 calls / month`
- This is still under the free limit discussed with the user.

## What was decided about checkpoints

- Automatic checkpoint threads are no longer desired.
- The user wants exactly one checkpoint file that gets overwritten only when there are real project changes.
- The current valid file is:
  - `/Users/almirea/Documents/New project/Zbet/ZBET_CHECKPOINT.md`
- If continuing work, update this file manually when major progress happens.

## Current open issues

1. Overall mobile/Safari experience still does not feel polished enough.
2. Recommendation diversity is still not strong enough.
3. `Istoric` is functional, but it still depends on how complete daily local result updates are.
4. Live app code still lives at workspace root; `Zbet/` currently organizes docs, checkpoint and design work, not the deploy shell itself.
5. There are many unrelated local files and dirty generated files in the worktree; use caution when committing.

## Strong recommendations for the next session

1. After the first daily history run, verify all 7 days in `Istoric`.
2. Polish the visual summary for each day in `Istoric`:
   - stronger daily header
   - clearer badges for `Corect`, `Gresit`, `Indisponibil`
   - more premium stats layout
3. Then do a broader app redesign pass focused on:
   - cleaner event card
   - more distinct `Best bet`
   - calmer, more elegant `Plan B`
   - reduced visual noise
4. After the UI cleanup, return to recommendation calibration.

## Files a new chat should inspect first

- `/Users/almirea/Documents/New project/Zbet/ZBET_CHECKPOINT.md`
- `/Users/almirea/Documents/New project/Zbet/PROJECT_SUMMARY_ZBET.md`
- `/Users/almirea/Documents/New project/index.html`
- `/Users/almirea/Documents/New project/app.mjs`
- `/Users/almirea/Documents/New project/styles.css`
- `/Users/almirea/Documents/New project/js/recommendations.mjs`
- `/Users/almirea/Documents/New project/scripts/build-history-archive.js`
- `/Users/almirea/Documents/New project/.github/workflows/history-weekly.yml`
