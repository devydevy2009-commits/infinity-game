Refactor branch validation notes:
- gameplay consolidated in game.js
- index.html loads one gameplay script
- obsolete override layers removed
- CI workflow runs node --check game.js and verifies script consolidation when GitHub Actions is available
