# African Salford FC26 website

A standalone, phone-friendly website based on the Google Sheet, with a locally editable Squad Builder. Spreadsheet access stays read-only. The existing R Shiny app is unchanged.

## Preview locally on Windows

From this folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Open <http://localhost:8080>. Stop the server with Ctrl+C. To use a different port, add `-Port 8081`.

## Put it on your phone

The website repository is [rhysomac/career_tracker](https://github.com/rhysomac/career_tracker). Its GitHub repository page is not the website itself. No build step, package installation, database, API key or R server is needed.

### Enable GitHub Pages

1. Sign in to GitHub as the repository owner and open [Settings → Pages](https://github.com/rhysomac/career_tracker/settings/pages).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
3. Select the **main** branch and **/ (root)** folder, then click **Save**. The website files are already at the repository root; do not select a `docs` folder or upload an enclosing `african_salford_site` folder.
4. Open the repository's [Actions tab](https://github.com/rhysomac/career_tracker/actions) and wait for the Pages deployment to finish successfully. This can take a few minutes. Settings → Pages will also show the published address.
5. Open **<https://rhysomac.github.io/career_tracker/>** on your phone.

GitHub Pages is free for public repositories. Uploading files alone does not enable Pages; the settings above must be saved first. Once enabled, commits to `main` trigger deployment of updated website files. No paid domain or hosting plan is needed.

### Add a home-screen shortcut

- **iPhone/iPad:** open the website in Safari, tap **Share**, then **Add to Home Screen**.
- **Android:** open the website in Chrome, open the three-dot menu, then choose **Add to Home screen** (the wording may vary).

Your computer does not need to be running, and your phone does not need to use the same Wi-Fi. Internet access is required to load the Google Sheet; a home-screen shortcut does not add offline support. The local preview address (`localhost`) refers to the device opening it, so it is not the address to use on your phone.

The site reads the already link-readable Google Sheet directly from each visitor's browser; you do not need to upload a workbook. Sheet edits appear when opening the site or pressing **Refresh Data**, without uploading the website again. Since the sheet is link-readable, people with the site can also access its data. Squad Builder XIs and created players stay in the browser where you saved them and do not sync between your computer and phone.

### Updating the hosted files and troubleshooting

- To publish local website changes, upload the changed files to `main` using **Add file → Upload files** on GitHub (or commit and push from a Git checkout). Preserve the folder structure, including `data/` and `sandbox/`, and include this README when updating the instructions. Local edits are not automatically copied to GitHub.
- **404 at the website address:** confirm Pages uses `main` and `/ (root)`, check that the latest Pages deployment succeeded, and use the exact address above, including `/career_tracker/`. An initial deployment may take a few minutes.
- **Settings → Pages is unavailable:** make sure you are signed in with an account that has administrator access to this repository.
- **The page opens but data fails to load:** check your internet connection and the sheet's existing **Anyone with the link → Viewer** permission, then press **Refresh data**. Do not make the sheet publicly editable.
- **Missing pictures or a blank Squad Builder:** check that the complete `data/` and `sandbox/` folders were uploaded and that filenames retain their exact capitalization.

## Features and data

- Squad has a season selector (including Start) and **Player source** checkboxes for Active squad, On loan, Departed and Youth academy. Active squad and On loan are checked by default; sources can be combined or all unchecked. Selections persist while navigating and changing seasons. The fixed squad columns exclude club number and movement details; there is no Show all columns control. The seasonal `Pl #` field displays as **Sq#** with a Squad number tooltip; internal club IDs still power player links and sorting.
- Squad defaults to status (active, on loan, departed, current youth academy), primary position, OVR, potential and DOB. Youth graduates sort by their actual status, not their academy history. Players and timelines default to club number; career totals sort descending. Tables can be sorted in either direction using raw values. Age sorts ascending; missing values stay last.
- Positions sort in the club's GK, RB, CB, LB, CDM, RM, CM, LM, CAM, RW, ST, LW order.
- Player profiles show a grey club number (such as **#34**) above the preferred name, alongside the portrait and status, with the nationality flag anchored at the top right of the identity header. Flag images come from FlagCDN so they also render on Windows; requests contain only the country code and no referrer. If unavailable, the original flag text remains with an explicit tooltip. The two-column bio reads left-to-right: Full Name, Age, DOB, Birthplace, Height, Weight, Body Type, Foot, Years Active, Generated. Height and Weight retain cm/kg in their values; Foot uses Right/Left and Generated uses Yes/No. Honours sits underneath in the left sidebar; stats, the career-only chart and then Movements flow independently on the right. Seasonal Movements follows Value and includes only events dated 1 July through 30 June of the selected season; Career shows all recorded movements below the stats timeline. Spell durations and total Years Active are unchanged by this date filter. The layout stacks on mobile.
- The Period selector offers Career and recorded seasons, controlling stats and honours together. Performance is headed **Career Stats** or the selected season, such as **2025-26**. Seasonal **Attributes** uses four columns and two rows on desktop (two columns on phones) in row-major order: Positions, Age at Season End (`AN`), Skill Moves, Weak Foot, Overall Rating, Potential, Growth. Skill Moves and Weak Foot use accessible star symbols. Ratings, potential, growth, value/wage changes and average match rating retain spreadsheet colours. Weeks Injured is in the selected season's stats; finances are in Value. Only Career shows the statistic-selectable season-by-season chart, with exact values below and gaps for missing data. Headings, field labels and controls use traditional title case, retaining minor words such as "of the", "in" and "at" in lowercase. The bio club number aligns vertically with the top-right flag; name and status sit directly beneath it without extra top padding.
- Stats timeline plots have a solid border around the plotting area. Overall rating and Potential use whole-number y-axis ticks; Average match rating uses one decimal place. Other metrics retain their existing axis formatting.
- Career honours put total titles before Team of the Season selections. Seasonal honours show Team of the Season Yes/No and the titles won that season, without per-trophy counts, from Titles_Timeline.
- One timeline page with a dropdown for ratings, match rating, appearances, goals, assists, clean sheets, goals/assists per game, clean-sheet percentage, position and market value. Wage and match-rating-factor timelines are not shown. A Status column shows current status; colour dots retain each season's historical status only when a player is at the club.
- Goals/assists per game and clean-sheet percentage timelines match their Goals, Assists and Clean Sheets counterparts' complete season-column layout, including Nationality and Age, with blank future seasons and no extra Start column. Their final **Max** column shows the highest recorded seasonal rate, not the career average. They preserve the sheet's formatted decimals and percentages while sorting and colouring by raw numbers. Salford City's aggregate Honours row uses the club badge and bold text rather than a player portrait.
- Season players without a Cl # are retained in tables but never linked to a profile by name. Historical youth graduates use only the explicit numeric club numbers in their season rows for portraits, profile links, stats and movements; duplicate names cannot attach unrelated records. Squad Age uses the season's `Age` column (including youth ages), falling back to `AN` only if no Age column exists. Historical academy rows with a youth ID but no squad number, join date or departure date retain Youth Academy status even after their future club number is entered. Rows without a club number use the default portrait. Derived timelines never merge unidentified namesakes across rows or seasons.
- Navigation order is Squad, Players, YA Graduates, Timelines, Player Stats, Club Stats, Honours, Season Awards, then Squad Builder. Existing hash addresses remain compatible; the builder uses `#builder`. Players and YA Graduates display Age, Right/Left foot, Yes/No generation values (where present), and Years Active.
- Player Stats (`#career`) displays career totals beside a Stats Leaderboard dropdown for AP, GL, AS, CS, MR, GL/G, AS/G and CS%. Both section titles and table-header rows align on desktop; the sections stack with their own headings on mobile. Rankings, ties, values and top-ten selections come directly from the eight side tables in Players_Stats, not a recalculation; keep their Name/Pos headings and rank/name/position/value blocks.
- Club Stats (`#team`) reads only club results, trophies and finances from Team_Stats, excluding player awards. All headings and cells are centred. Trophy results of **Winner** and league finishes of **1** display only the relevant trophy icon, with accessible winner text, instead of the source value or green shading. League trophies use the row's Division and appear only after a win; unwon competitions and column headings have no trophy icons. Raw values remain available for sorting and searching. Honours uses abbreviated competition headings and compact spacing, with league competitions before European competitions in both the table and profile honours. Both tables separate trophy categories with neutral solid lines rather than category colours.
- Season Awards (`#tots`) reads the renamed Season_Awards sheet. Its View dropdown offers Timeline or an individual season. Timeline places Captain and all other awards before the eleven positions, with separate **Season Awards** and **Team of the Season** grouped headings, in a horizontally scrollable table with a pinned season column, mini portraits and wrapped joint winners. Individual seasons use the available desktop width for the pitch on the left, with spaced player cards, and award cards on the right, including Captain, Player of the Season, Young Player of the Season, Top Scorer, Top Assists and Most Clean Sheets with names, portraits and recorded counts. The layout stacks on mobile. ToTS and the first three Other selections use the numeric club IDs in the right-hand block; scorer/assist/CS names resolve against Players. Empty seasons never reuse a previous XI.
- A Salford-inspired white and charcoal theme with red navigation, section and chart accents. Alternating rows and conditional stat colours remain separate from the site theme.
- Salford logo and club-number player photos, including mini headshots beside player names in every table, with `000.png` as the default portrait when an individual photo is not present.
- Horizontally scrollable tables and a pinned player-name column on small screens.

Data loads on opening and when **Refresh data** is pressed. Loading requires internet access and the sheet's existing “anyone with the link” read permission. Errors are displayed explicitly; if a refresh fails, the previous complete dataset stays visible with a warning. No edits are written back.

Seasons are discovered from populated season columns in Ratings_Timeline. To add a season, create its tab using the exact `27/28` naming pattern and populate its matching rating timeline column. Google falls back to the default tab if an unknown tab name is requested, so keep tab names consistent. Keep the existing tab headers and unique Cl # IDs for player links.

Titles_Timeline uses the sheet's two-row headings: competition names above each group of season columns, followed by Name/Nat and season labels. Players are matched by the club ID in the first column; positive season entries mean a title was won, while blanks, dashes and zero mean no title. Group totals are ignored. Repeated season headings hidden by sheet formulas are resolved from the corresponding positions in the first competition group.

Season labels throughout the site display as **2025-26**, while spreadsheet tab names and internal season keys remain **25/26**. Compact player honours use the trophy images in `data/titles/` instead of bullets; the honours table also includes these images in competition headings. Career honours retain trophy counts and list every recorded winning season per competition, including all 15 seasons for a trophy won each year. Missing winning-season data is explicitly labelled rather than inferred from the count.

Career and seasonal honours cards align with the identity card in the sidebar, with compact rows. Career Team of the Season selections also list the recorded selection seasons, matched by player ID from Season_Awards, with space to wrap all 15 seasons on a phone. An empty selection history is not inferred from the aggregate count; positive counts without recorded seasons are explicitly labelled.

Movements combines joining and departure records from Start (including its Join Type column) and every loaded season, matched strictly by club number, never by name. Repeated records are merged. Each row shows movement, date, club from/to, age, formatted fee, transfer type and Years Active. Loan types display in full, such as **1-year loan** and **6-month loan**. Departures show `-` for Years Active. Loan returns are added using the club's calendar: summer six-month loans return on 1 January; winter six-month loans and year-long loans return on 1 July. Recorded returns take precedence; future returns are not counted, and a permanent departure cancels a pending return. Return ages are calculated from DOB when available; other missing details remain `-`. The table has no routine explanatory footer; incomplete-data warnings are still displayed.

The site recalculates **Years active** consistently for the Players tab and player identity cards, summing active spells and excluding time on loan. Each joining/return row in Movements shows the duration of that spell. Ongoing spells end at the current **in-game date in Settings!A5**, not the computer's date. Durations use elapsed days divided by 365.25 and display one decimal; sorting uses the unrounded total. Missing joining dates, unrecognised loan durations or conflicting spells show an unavailable total and an explicit warning instead of retaining the old sheet total. These website calculations do not edit the spreadsheet or the R app.

Otherwise tables use Google's formatted cell text for display and raw cell values for sorting; spreadsheet formulas are not recalculated. Skill moves and Weak foot also use stars in tables, retaining numeric sorting. Blank cells show a dash, and timeline columns for future seasons are retained.

Conditional colours reproduce the workbook's rating thresholds (50 / 70 / 95), match-rating thresholds (4 / 7 / 10), player Years Active scale, club-stat W% scale and signed goal difference/transfer profit. Every Honours competition count uses the same per-column white-to-green background scale as TotS and Titles, excluding club aggregates; numbers no longer use green text. Neutral solid separators distinguish continental competitions, league titles, domestic cups and one-off cups, including Super Cup and Community Shield (`C. Shield`). Profile statistics colour ratings, potential, growth and average match ratings; profile honours are unformatted. Scales use the complete loaded table, so searching or sorting does not change the colours. Rules are implemented in `formatting.js`; the Google data endpoint does not return formatting, so changing the workbook's rules requires updating these definitions.

## Squad Builder

Open **Squad Builder** (the last navigation item) to plan up to three separate **4-2-3-1 wide** XIs. It always uses the most recent populated season, regardless of the season selected on other pages. Active squad players and players on loan, including youth graduates with club numbers, are included; youth academy and departed players are excluded. OVR and potential match the sheet's displayed ratings, including rounded formula results. The embedded view omits duplicate branding, the tactics-board introduction, the scouting eyebrow and the fan-tool footer.

- Club players are read-only and labelled **Club Squad · Active/On Loan**. Use **Refresh Data** to get their latest details; the builder never changes the spreadsheet.
- Use the 1st/2nd/3rd XI selector to switch boards. Players assigned to any XI are removed from the shared pool and cannot be selected on another board. The × button returns a player to the pool.
- Add or edit created players with **Add player**. Select from the full country list to show a flag; created players can be edited or deleted. Search by name, filter by position, and use the independent Active squad, On loan and Created players checkboxes (all selected by default). Sort by OVR, potential, age, name or primary position.
- Drag a player from the pool to the board, or drag a board player to another position. On touch screens, use the pool player's `::` handle to drag without interfering with list scrolling; board players can be dragged directly. Dropping onto an occupied board position swaps the two players. Selecting a player and then selecting a position also works without dragging.
- Pool and pitch cards display nationality flag, age, positions and player image. Club-player ages use **Age Now** from the Players tab, matched by club number, for cards, age sorting and average age; missing current ages stay unknown rather than falling back to seasonal ages. Created players use their entered age. Ratings show OVR/POT together with the same conditional rating colours. Created players without their own image use `000.png`.
- The XIs and created players save locally in this browser. Navigating away, refreshing data or advancing to a new latest season preserves assignments by club identity. Players no longer in the eligible squad are removed from all XIs with a notice; their replacements are not chosen automatically. Local data is not synced between devices.

The embedded board is self-contained in `sandbox/`, isolated from the site's table/pitch styling. Keep that folder when hosting the site. Both parent and board verify the sender and origin before exchanging squad data. No additional packages or server endpoints are required.

## Player photos

Player images are loaded from `data/players/` by **Cl #**, not by shirt number. For example, Cl # 1 uses `data/players/001.png`. Uppercase `.PNG` files are also supported. Add new portraits in the same format. When a player's image is missing, `data/players/000.png` is displayed.

## Checks

Open `tests.html` through the local preview server to run dependency-free data and squad-adapter tests, `profile-tests.html` for fixture-backed profile layout, formatting, honours and chart tests, `sandbox/tests.html` for formation, validation, persistence and migration model tests, and `sandbox/drag-tests.html` for mouse/touch drag event regressions. Live integration and responsive layout should also be checked in a browser after changing the Google Sheet's structure.
