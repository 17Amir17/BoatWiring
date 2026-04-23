---
name: aliexpress-component
description: |
  Import an AliExpress product as a ComponentDef (or WireDef) for the boat-wiring sim,
  then iteratively verify the on-canvas lookalike matches the product photo by USING THE
  CHROME BROWSER to render it. Use when the user pastes an aliexpress.com product URL or
  asks to "import this AliExpress component" / "make this component look right".
---

# AliExpress component import + visual verification

## 1. Import the product

Run the importer:

```bash
node scripts/import-aliexpress.mjs '<URL>'
```

If Playwright's browser isn't installed, `npx playwright install chromium` then retry.
If the page hits a captcha/login wall, it'll print the URL — open it in a real browser
once to clear cookies (stored in `.playwright-profile/`).

The script:
- downloads the main hero image to `public/components/<slug>/main.<ext>`
- writes `src/lib/components/custom/<slug>.json` with `imageRef` set to that path
- guesses kind, size and a default port layout

## 2. **MANDATORY: visually verify in the browser**

The on-canvas component is a **stylized SVG lookalike** (per `def.kind`) — NOT the photo.
Pin stubs extend OUT of the body to the perimeter. Your job is to make the lookalike's
shape, size, and pin positions correspond to the actual studs / pins / connectors on the
product photo.

Use the chrome MCP. Do NOT skip this step.

```text
1. Make sure the dev server is running (`npm run dev`, port 5174).
2. mcp__claude-in-chrome__tabs_context_mcp     → confirm/create a tab
3. mcp__claude-in-chrome__tabs_create_mcp      → open a fresh tab if needed
4. mcp__claude-in-chrome__navigate
   url = http://localhost:5174/?view=<defId>
5. mcp__claude-in-chrome__javascript_tool
   read pin positions:
     Array.from(document.querySelectorAll('[data-pin-id]')).map(el => ({
       id: el.dataset.pinId,
       leftPct: parseFloat(el.style.left) /
                document.querySelector('.relative[style*="width"]').offsetWidth,
       topPct:  parseFloat(el.style.top) /
                document.querySelector('.relative[style*="width"]').offsetHeight,
     }))
6. Use the Read tool on `public/components/<slug>/main.<ext>` to see the photo.
7. For each pin: does its position correspond to where that stud / spade / wire-stub
   actually sits on the product photo? If not, edit `port.rel.{x,y}` in the JSON.
   - rel.x = 0 → left edge, 1 → right edge
   - rel.y = 0 → top edge,  1 → bottom edge
   - For pins to extend OUTSIDE the body via stubs, they MUST be at rel 0 or 1 on at
     least one axis.
8. Vite HMR auto-refreshes. Wait ~500ms then re-run the javascript_tool query.
9. Loop steps 5–8 until pin positions look right.
10. Final sanity check: open `http://localhost:5174/` and drag the component onto the
    canvas; confirm pins look correct at 1× scale too.
```

## 3. Refine size + body shape

The body is a fixed SVG per-kind (see `src/canvas/lookalike.tsx` — `BatteryBody`,
`FuseAtcBody`, `FuseMrbfBody`, `SwitchBody`, `SelectorBody`, `LoadBody`, `ConnectorBody`,
`BusbarBody`, `FuseBlockBody`, `HarnessBody`, `DcdcBody`, `IndicatorBody`,
`CompositeBody`). You don't need to change the body code — just pick the right `kind` so
the right shape renders, and set `size: { w, h }` to match the product photo's aspect
ratio (target width ~80–220 px).

## 4. Per-kind quick rules

| kind | typical port layout | size hint |
|---|---|---|
| battery | `+` and `-` on TOP edge (rel.y=0) | wider than tall |
| fuse (ATC) | `a` and `b` on BOTTOM edge (rel.y=1) | taller than wide |
| fuse (MRBF) | `a` and `b` on LEFT and RIGHT edges (rel.x=0,1, rel.y=0.5) | wider than tall |
| switch | `in` and `out` on LEFT and RIGHT edges | wider than tall |
| selectorSwitch | studs along left/right edges, dial in middle | square |
| load (LED) | `+` and `-` on BOTTOM edge | square |
| connector (ringLug) | `wire` on LEFT (rel.x=0,y=0.5), `stud` on RIGHT (rel.x=1,y=0.5) | wider than tall |
| connector (buttSplice) | `a` and `b` on LEFT and RIGHT | wider than tall |
| busbar | studs evenly spaced along BOTTOM edge | wide and short |
| fuseBlock | `IN+` and `GND` on opposite corners; `OUT n` evenly along TOP/BOTTOM | square or wide |
| harness | input pins on LEFT, output pins fanned along RIGHT | square |
| dcdc | `IN+/IN-` on LEFT, `OUT+/OUT-` on RIGHT | wider than tall |
| indicator | `+` and `-` on LEFT and RIGHT | wider than tall |
| composite (rocker panel) | power on LEFT, switch outputs across BOTTOM, USB on RIGHT | wide |

## 5. Final report

After verification, report in <120 words:
- final size (w × h)
- 1-line per port: `label → rel — sits on <description>`
- viewer URL you used
- any issues to flag
