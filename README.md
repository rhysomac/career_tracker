# African Salford FC26 website

A standalone, phone-friendly website based on the Google Sheet, with a locally editable squad sandbox. Spreadsheet access stays read-only. The existing R Shiny app is unchanged.

## Preview locally on Windows

From this folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1
```

Open <http://localhost:8080>. Stop the server with Ctrl+C. To use a different port, add `-Port 8081`.

## Put it on your phone

Upload this folder's website files to a static web host, such as GitHub Pages. No build step, package installation, database, API key or R server is needed. Open the hosted HTTPS address on your phone; you can also add it to your home screen. The local preview address is only accessible on the computer running it, not on your phone.

The site is not deployed automatically. You can publish it at no cost with GitHub Pages: create a **public** GitHub repository, upload the complete contents of this folder (including `data/` and `sandbox/`), then open **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save. GitHub will provide a free `https://<username>.github.io/<repository>/` address that works on your phone. No paid domain or hosting plan is needed. Hosting does not require uploading a copy of the workbook: the site reads the already link-readable Google Sheet directly from each visitor's browser. Since the sheet is link-readable, people with the site can also access its data.

## Features and data

- Squad season and player-group selectors for active players, players on loan, departed players, youth academy players, and **All** (the default). Includes Start and all available columns via **Show all columns**; squad number is excluded.
- Squad defaults to status (active, on loan, departed, current youth academy), primary position, OVR, potential and DOB. Youth graduates sort by their actual status, not their academy history. Players and timelines default to club number; career totals sort descending. Tables can be sorted in either direction using raw values. Age sorts ascending; missing values stay last.
- Positions sort in the club's GK, RB, CB, LB, CDM, RM, CM, LM, CAM, RW, ST, LW order.
- Player profiles use the player name and portrait as the identity-card heading, with the current status badge directly below the name and no duplicate page heading or Bio label. Club number, total Years active, Generated Yes/No and Right/Left foot labels use a compact two-column identity grid. Honours sits underneath it in the left sidebar; stats, the career-only chart and then Movements flow independently on the right. Seasonal Movements follows Value and includes only events dated 1 July through 30 June of the selected season; Career shows all recorded movements below the stats timeline. Spell durations and total Years active are unchanged by this date filter. Movements does not wait for the sidebar's height. The layout stacks on mobile.
- The Period selector offers Career and recorded seasons, controlling stats and honours together. Performance is headed **Career stats** or the selected season, such as **2025-26**. Seasonal **Attributes** combines positions and displays Skill moves and Weak foot as accessible star symbols. Ratings, potential, growth, value/wage changes and average match rating retain spreadsheet colours. Weeks injured is in the selected season's stats; finances are in Value. Only Career shows the statistic-selectable season-by-season chart, with exact values below and gaps for missing data.
- Career honours put total titles before Team of the Season selections. Seasonal honours show Team of the Season Yes/No and the titles won that season, without per-trophy counts, from Titles_Timeline.
- One timeline page with a dropdown for ratings, match rating, appearances, goals, assists, clean sheets, goals/assists per game, clean-sheet percentage, wage, position and market value. The match-rating-factor timeline is not shown. Colour dots indicate status only for seasons when a player is at the club.
- Season players without a Cl # are retained in tables. Unique names link historical youth records to their later senior Players entry. Current academy players who have never joined the senior squad have no profile links or pages; current and former squad members retain profiles.
- Players, Youth academy graduates, Career stats, Honours and Team stats tables. Youth tab labels are YA graduates in the navigation and Youth academy graduates on the page.
- Team of the Season displayed on a pitch with a season dropdown, linked player names, player portraits and the shirt numbers from that season. Selections use the numeric club IDs in TotS, not the accompanying name-based display table. Seasons with no recorded selections show empty positions instead of reusing a previous season's XI.
- A Salford-inspired white and charcoal theme with red navigation, section and chart accents. Alternating rows and conditional stat colours remain separate from the site theme.
- Salford logo and club-number player photos, with `000.png` as the default portrait when an individual photo is not present.
- Horizontally scrollable tables and a pinned player-name column on small screens.

Data loads on opening and when **Refresh data** is pressed. Loading requires internet access and the sheet's existing “anyone with the link” read permission. Errors are displayed explicitly; if a refresh fails, the previous complete dataset stays visible with a warning. No edits are written back.

Seasons are discovered from populated season columns in Ratings_Timeline. To add a season, create its tab using the exact `27/28` naming pattern and populate its matching rating timeline column. Google falls back to the default tab if an unknown tab name is requested, so keep tab names consistent. Keep the existing tab headers and unique Cl # IDs for player links.

Titles_Timeline uses the sheet's two-row headings: competition names above each group of season columns, followed by Name/Nat and season labels. Players are matched by the club ID in the first column; positive season entries mean a title was won, while blanks, dashes and zero mean no title. Group totals are ignored. Repeated season headings hidden by sheet formulas are resolved from the corresponding positions in the first competition group.

Season labels throughout the site display as **2025-26**, while spreadsheet tab names and internal season keys remain **25/26**. Compact player honours use the trophy images in `data/titles/` instead of bullets; the honours table also includes these images in competition headings. Career honours retain trophy counts and list every recorded winning season per competition, including all 15 seasons for a trophy won each year. Missing winning-season data is explicitly labelled rather than inferred from the count.

Career and seasonal honours cards align with the identity card in the sidebar, with compact rows. Career Team of the Season selections also list the recorded selection seasons, matched by player ID from TotS, with space to wrap all 15 seasons on a phone. An empty selection history is not inferred from the aggregate count; positive counts without recorded seasons are explicitly labelled.

Movements combines joining and departure records from Start (including its Join Type column) and every loaded season, matched by club number (or an unambiguous player name for historical rows). Repeated records are merged. Each row shows movement, date, club from/to, age, formatted fee, transfer type and Years active. Loan types display in full, such as **1-year loan** and **6-month loan**. Departures show `-` for Years active. Loan returns are added using the club's calendar: summer six-month loans return on 1 January; winter six-month loans and year-long loans return on 1 July. Recorded returns take precedence; future returns are not counted, and a permanent departure cancels a pending return. Return ages are calculated from DOB when available; other missing details remain `-`. The table has no routine explanatory footer; incomplete-data warnings are still displayed.

The site recalculates **Years active** consistently for the Players tab and player identity cards, summing active spells and excluding time on loan. Each joining/return row in Movements shows the duration of that spell. Ongoing spells end at the current **in-game date in Settings!A5**, not the computer's date. Durations use elapsed days divided by 365.25 and display one decimal; sorting uses the unrounded total. Missing joining dates, unrecognised loan durations or conflicting spells show an unavailable total and an explicit warning instead of retaining the old sheet total. These website calculations do not edit the spreadsheet or the R app.

Otherwise tables use Google's formatted cell text for display and raw cell values for sorting; spreadsheet formulas are not recalculated. Skill moves and Weak foot also use stars in tables, retaining numeric sorting. Blank cells show a dash, and timeline columns for future seasons are retained.

Conditional colours reproduce the workbook's rating thresholds (50 / 70 / 95), match-rating thresholds (4 / 7 / 10), player Years Active scale, team-stat W% scale and signed goal difference/transfer profit, and honours' green total-count scale/green won-competition text. Honours competitions are grouped as continental competitions, league titles, domestic cups, and one-off cups. Profile statistics colour ratings, potential, growth and average match ratings; profile honours are unformatted. Table colours override alternating row backgrounds; scales use the complete loaded table, so searching or sorting does not change the colours. Rules are implemented in `formatting.js`; the Google data endpoint does not return formatting, so changing the workbook's rules requires updating these definitions.

## Squad sandbox

Open **Sandbox** (the last navigation item) to plan up to three separate **4-2-3-1 wide** XIs. It always uses the most recent populated season, regardless of the season selected on other pages. Active squad players and players on loan, including youth graduates with club numbers, are included; youth academy players without club numbers and departed players are excluded. OVR and potential match the sheet's displayed ratings, including rounded formula results.

- Club players are read-only and labelled **Club squad · Active/On loan**. Use **Refresh data** to get their latest details; the sandbox never changes the spreadsheet.
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
