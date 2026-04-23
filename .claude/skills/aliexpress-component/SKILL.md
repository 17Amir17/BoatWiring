---
name: aliexpress-component
description: |
  Import an AliExpress product as a ComponentDef (or WireDef) for the boat-wiring sim.
  Use when the user pastes an aliexpress.com product URL or asks to "import this AliExpress
  component" / "add this product to the palette". Scrapes the chosen variant via Playwright,
  downloads images locally, maps specs to the right ComponentKind, and writes a JSON file
  under `src/lib/components/custom/` (or `src/lib/wires/imported/` for cables).
---

# AliExpress component import

When the user gives you an AliExpress product URL (`https://www.aliexpress.com/item/<itemId>.html?...`)
or asks to import a product:

1. Run the importer:

   ```bash
   node scripts/import-aliexpress.mjs '<URL>'
   ```

2. If Playwright's browser isn't installed yet, run:

   ```bash
   npx playwright install chromium
   ```

   then retry.

3. If AliExpress shows a captcha or login wall, the script will print the wall's URL and
   ask the user to clear it manually once. Cookies persist in `.playwright-profile/`.

4. After a successful import:
   - JSON lands at `src/lib/components/custom/<slug>.json` (or `src/lib/wires/imported/<slug>.json`).
   - Images land at `public/components/<slug>/`.
   - A nominal sandbox fixture is auto-generated at
     `src/lib/components/custom/<slug>.fixtures/nominal.json`.
   - Recommend the user open the in-app Component Editor to refine port placement, since the
     scraper guesses defaults.

5. To verify the import worked, run the headless sandbox:

   ```bash
   npm run sandbox -- src/lib/components/custom/<slug>.json src/lib/components/custom/<slug>.fixtures/nominal.json
   ```

The scraper supports these `ComponentKind`s out of the box: `fuse`, `fuseBlock`, `switch`,
`selectorSwitch`, `connector`, `load`, `composite` (rocker panels with USB), `dcdc`, `harness`,
and `wire` (which becomes a `WireDef` instead).

If the user gives you a URL without telling you what kind it is, **don't guess**: run the
importer once to extract the title + spec table, read the printed kind suggestion, and ask the
user to confirm before committing the JSON.
