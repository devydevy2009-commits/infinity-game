# INFINITE — itch.io release notes

## Build contents
The final self-contained itch.io package should contain the browser runtime files only:

- index.html
- game.js
- tactical_balance.js
- encounter_system.js
- styles.css
- manifest.webmanifest
- LICENSE.txt

Do not include `.git`, development workflows, PR notes, or temporary files.

## Release identity
INFINITE

Copyright © 2026 Infinity Game. All rights reserved.

## Current status
Phase 1 stable arcade loop. Pattern and boss architecture is prepared but intentionally inactive for Phase 2.
# INFINITE Web build

The game uses a responsive canvas with a tested desktop-safe maximum viewport of **1280 × 720**. For itch.io, use **Click to launch in fullscreen**. If embedding in the page is required, set the iframe to **1280 × 720**; smaller screens remain responsive through the browser viewport.
