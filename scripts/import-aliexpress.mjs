#!/usr/bin/env node
/**
 * Scrape an AliExpress product and emit a ComponentDef (or WireDef) JSON.
 *
 * Usage:
 *   node scripts/import-aliexpress.mjs '<aliexpress-product-url>' [--kind=<kind>] [--qty=<n>]
 *
 * Output:
 *   - src/lib/components/custom/<slug>.json    (or src/lib/wires/imported/<slug>.json for wires)
 *   - public/components/<slug>/img-<n>.webp    (downloaded gallery images)
 *   - src/lib/components/custom/<slug>.fixtures/nominal.json (auto-generated nominal test)
 *
 * Notes:
 *   - Requires `playwright-core` + a Chromium binary. Run `npx playwright install chromium`
 *     once. We launch with persistent context at `.playwright-profile/` so login/captcha
 *     state survives across runs.
 *   - This script is intentionally tolerant: AliExpress changes selectors frequently, and
 *     when extraction fails, we still emit a stub JSON the user can refine in the editor.
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = { url: null, kind: null, qty: 1 };
  for (const a of argv) {
    if (a.startsWith('--kind=')) out.kind = a.slice(7);
    else if (a.startsWith('--qty=')) out.qty = Number(a.slice(6)) || 1;
    else if (!out.url && a.startsWith('http')) out.url = a;
  }
  return out;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function inferKindFromTitle(title) {
  const t = title.toLowerCase();
  if (/\b(awg|wire|cable|silicone)\b/.test(t) && /\b\d+m\b/.test(t)) return 'wire';
  if (/\bfuse\b/.test(t)) {
    if (/\bbox|block|holder|panel\b/.test(t)) return 'fuseBlock';
    return 'fuse';
  }
  if (/\bbreaker\b/.test(t)) return 'breaker';
  if (/\bbattery\b/.test(t) && /\b(disconnect|isolator|selector|rotary)\b/.test(t))
    return 'selectorSwitch';
  if (/\b(rocker|switch panel|gang)\b/.test(t)) return 'composite';
  if (/\bharness\b/.test(t)) return 'harness';
  if (/\bswitch\b/.test(t)) return 'switch';
  if (/\b(led|light|pump|horn|stereo|bilge|nav)\b/.test(t)) return 'load';
  if (/\b(usb|charger|dc-?dc)\b/.test(t)) return 'dcdc';
  if (/\b(crimp|lug|splice|terminal|connector)\b/.test(t)) return 'connector';
  if (/\b(heat shrink|tubing)\b/.test(t)) return 'accessory';
  return 'custom';
}

function defaultPortsFor(kind) {
  switch (kind) {
    case 'battery':
      return [
        { id: 'pos', label: '+', rel: { x: 0.85, y: 0.2 }, role: 'source' },
        { id: 'neg', label: '-', rel: { x: 0.15, y: 0.2 }, role: 'sink' },
      ];
    case 'fuse':
    case 'breaker':
    case 'switch':
    case 'connector':
      return [
        { id: 'a', label: 'A', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
        { id: 'b', label: 'B', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
      ];
    case 'load':
      return [
        { id: 'in', label: '+', rel: { x: 0.1, y: 0.5 }, role: 'sink' },
        { id: 'out', label: '-', rel: { x: 0.9, y: 0.5 }, role: 'sink' },
      ];
    case 'selectorSwitch':
      return [
        { id: 'in1', label: 'IN1', rel: { x: 0.1, y: 0.25 }, role: 'passthrough' },
        { id: 'in2', label: 'IN2', rel: { x: 0.1, y: 0.75 }, role: 'passthrough' },
        { id: 'out', label: 'OUT', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
      ];
    case 'dcdc':
      return [
        { id: 'IN+', label: 'IN+', rel: { x: 0.1, y: 0.25 }, role: 'sink' },
        { id: 'IN-', label: 'IN-', rel: { x: 0.1, y: 0.75 }, role: 'sink' },
        { id: 'OUT+', label: 'USB+', rel: { x: 0.9, y: 0.25 }, role: 'source' },
        { id: 'OUT-', label: 'USB-', rel: { x: 0.9, y: 0.75 }, role: 'sink' },
      ];
    default:
      return [
        { id: 'a', label: 'A', rel: { x: 0.1, y: 0.5 }, role: 'passthrough' },
        { id: 'b', label: 'B', rel: { x: 0.9, y: 0.5 }, role: 'passthrough' },
      ];
  }
}

/**
 * Heuristic spec extraction. AliExpress publishes specs as a key/value table.
 * We pass the table through the regex ruleset below to fish out the most
 * useful numeric fields per kind. Anything we don't recognize stays in
 * `specs.raw_<key>` for reference.
 */
function mapSpecs(kind, specRows, title) {
  const out = {};
  const rows = specRows.map((r) => [String(r.k).toLowerCase(), String(r.v)]);
  const find = (re) => {
    for (const [k, v] of rows) if (re.test(k)) return v;
    return undefined;
  };
  const findNum = (re) => {
    const v = find(re);
    if (!v) return undefined;
    const m = String(v).match(/[-+]?\d*\.?\d+/);
    return m ? Number(m[0]) : undefined;
  };

  switch (kind) {
    case 'fuse':
      out.ratingA = findNum(/(rated|rating).*current|amperage|amps?/) ??
        Number((title.match(/(\d+)\s*A\b/i) ?? [])[1]) ?? 30;
      out.formFactor = /mrbf/i.test(title) ? 'MRBF' : /atc|ato/i.test(title) ? 'ATC' : 'ATC';
      out.voltageRating = findNum(/voltage/) ?? 32;
      break;
    case 'breaker':
      out.ratingA = findNum(/(rated|rating).*current|amperage/) ?? 30;
      out.voltageRating = findNum(/voltage/) ?? 32;
      break;
    case 'switch':
      out.ratedA = findNum(/contact current|rated current|max(?:imum)? current/) ?? 20;
      out.ratedV = findNum(/(rated|max).*voltage/) ?? 12;
      break;
    case 'load':
      out.wattsOn = findNum(/(wattage|power)/) ?? 6;
      out.vMin = findNum(/min.*voltage/) ?? 10;
      out.vMax = findNum(/(max|operating).*voltage/) ?? 30;
      break;
    case 'fuseBlock':
      out.slots = findNum(/(way|slot)/) ?? 6;
      out.ratedA = findNum(/(per circuit|max(?:imum)? current)/) ?? 30;
      out.formFactor = 'ATC';
      break;
    case 'selectorSwitch':
      out.ratedA = findNum(/continuous|rated current/) ??
        Number((title.match(/(\d+)\s*A/) ?? [])[1]) ?? 200;
      out.peakA = findNum(/peak|surge|crank/) ??
        Number((title.match(/(\d+)\s*A.*?(\d+)\s*A/) ?? [])[2]) ?? 600;
      break;
    case 'dcdc':
      out.vIn = findNum(/input voltage/) ?? 12;
      out.vOut = findNum(/output voltage/) ?? 5;
      out.iLimitA = findNum(/output current|max output/) ?? 2.1;
      out.eff = 0.85;
      break;
    case 'connector':
      out.ratedA = findNum(/rated current|amperage/) ?? 22;
      out.gaugeAWG = findNum(/awg/) ?? 16;
      break;
    case 'wire':
      out.gaugeAWG = findNum(/(?:gauge|awg|conductor.*size)/) ??
        Number((title.match(/(\d+)\s*awg/i) ?? [])[1]) ?? 16;
      out.lengthM = findNum(/length/) ??
        Number((title.match(/(\d+)\s*m\b/i) ?? [])[1]) ?? 5;
      out.color = (find(/colou?r/) ?? '').toLowerCase().split(/[,/]/)[0]?.trim() || 'red';
      break;
    case 'accessory':
      out.note = find(/usage|include/) ?? title;
      break;
    default:
      break;
  }
  // Always carry the raw spec table for the editor to expose.
  for (const [k, v] of rows) out[`raw_${k.replace(/\s+/g, '_')}`] = v;
  return out;
}

function nominalFixtureFor(kind, specs) {
  switch (kind) {
    case 'fuse':
    case 'breaker':
      return {
        drive: [
          { portId: 'a', source: { kind: 'voltage', v: 12.6, rIntOhm: 0.02 } },
          { portId: 'b', source: { kind: 'load', watts: 12 } },
        ],
        expect: {
          voltages: { a: { min: 12.4, max: 12.7 }, b: { min: 12.0, max: 12.7 } },
        },
      };
    case 'switch':
      return {
        drive: [
          { portId: 'a', source: { kind: 'voltage', v: 12 } },
          { portId: 'b', source: { kind: 'load', watts: 6 } },
        ],
        state: { on: true },
        expect: { voltages: { b: { min: 11.5, max: 12.5 } } },
      };
    case 'selectorSwitch':
      return {
        drive: [
          { portId: 'in1', source: { kind: 'voltage', v: 12 } },
          { portId: 'in2', source: { kind: 'voltage', v: 13.5 } },
          { portId: 'out', source: { kind: 'load', watts: 6 } },
        ],
        state: { selectedPosition: 1 },
        expect: { voltages: { out: { min: 11.5, max: 12.5 } } },
      };
    case 'load':
      return {
        drive: [
          { portId: 'in', source: { kind: 'voltage', v: 12.6 } },
          { portId: 'out', source: { kind: 'ground' } },
        ],
        state: { on: true },
        expect: { voltages: { in: { min: 12.4, max: 12.7 } } },
      };
    case 'dcdc':
      return {
        drive: [
          { portId: 'IN+', source: { kind: 'voltage', v: 12.6 } },
          { portId: 'IN-', source: { kind: 'ground' } },
          { portId: 'OUT+', source: { kind: 'load', watts: (specs.vOut ?? 5) * 1.5 } },
          { portId: 'OUT-', source: { kind: 'ground' } },
        ],
        expect: {
          voltages: {
            'OUT+': { min: (specs.vOut ?? 5) * 0.85, max: (specs.vOut ?? 5) * 1.05 },
          },
        },
      };
    default:
      return { drive: [] };
  }
}

async function downloadImage(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, buf);
}

async function scrape(url) {
  let chromium;
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('playwright-core not installed. Run: npm i -D playwright-core && npx playwright install chromium');
    process.exit(2);
  }

  const userDataDir = resolve(ROOT, '.playwright-profile');
  await mkdir(userDataDir, { recursive: true });

  const ctx = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1280, height: 800 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Detect captcha / login walls.
  const url2 = page.url();
  if (/login|verify|captcha|punish/i.test(url2)) {
    await ctx.close();
    throw new Error(
      `Bot wall encountered (${url2}). Open it once in a real browser to clear, then retry.`,
    );
  }

  await page.waitForTimeout(1500);

  const data = await page.evaluate(() => {
    const pickText = (sel) => document.querySelector(sel)?.textContent?.trim() ?? '';
    const title =
      pickText('[data-pl="product-title"]') ||
      pickText('h1') ||
      document.title;
    const price =
      pickText('[class*="price--currentPriceText"]') ||
      pickText('[class*="price"]');
    const seller =
      pickText('[class*="store-name"]') ||
      pickText('[class*="seller"]');
    // Spec table: rows of <dt>/<dd> or <div class="key"><div class="val">.
    const specRows = [];
    document.querySelectorAll('[class*="specification--prop"]').forEach((row) => {
      const k = row.querySelector('[class*="title"]')?.textContent?.trim();
      const v = row.querySelector('[class*="desc"]')?.textContent?.trim();
      if (k) specRows.push({ k, v: v ?? '' });
    });
    if (specRows.length === 0) {
      document.querySelectorAll('table tr').forEach((tr) => {
        const tds = tr.querySelectorAll('td,th');
        if (tds.length >= 2) {
          specRows.push({ k: tds[0].textContent?.trim() ?? '', v: tds[1].textContent?.trim() ?? '' });
        }
      });
    }
    // Gallery images.
    const imgs = new Set();
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      if (!/alicdn|aliexpress/i.test(src)) return;
      // Filter out tiny thumbnails (.jpg_50x50.webp etc.)
      if (/_(\d{2,4})x\d{2,4}\.(?:jpg|webp|png)/i.test(src)) {
        const cleaned = src.replace(/_(?:\d{2,4})x\d{2,4}\.(jpg|webp|png).*/i, '.$1');
        imgs.add(cleaned);
      } else {
        imgs.add(src);
      }
    });
    return { title, price, seller, specRows, images: [...imgs].slice(0, 5) };
  });

  await ctx.close();
  return { url, ...data };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error("Usage: node scripts/import-aliexpress.mjs '<URL>' [--kind=<kind>] [--qty=<n>]");
    process.exit(2);
  }

  console.log(`Scraping ${args.url} ...`);
  let scraped;
  try {
    scraped = await scrape(args.url);
  } catch (e) {
    console.error('Scrape failed:', e.message);
    process.exit(2);
  }

  const { title, seller, price, specRows, images } = scraped;
  if (!title) {
    console.error('Could not extract a product title — selector may be stale. Aborting.');
    process.exit(2);
  }

  const kind = args.kind || inferKindFromTitle(title);
  const slug = slugify(title);
  const isWire = kind === 'wire';

  // Download images.
  const imgDir = resolve(ROOT, 'public', 'components', slug);
  const localImagePaths = [];
  for (let i = 0; i < images.length; i++) {
    const ext = (images[i].match(/\.(jpg|webp|png)/i) ?? [, 'webp'])[1];
    const dest = resolve(imgDir, `img-${i}.${ext}`);
    try {
      await downloadImage(images[i], dest);
      localImagePaths.push(`/components/${slug}/img-${i}.${ext}`);
    } catch (e) {
      console.warn(`  skipped image ${i}: ${e.message}`);
    }
  }

  const specs = mapSpecs(kind, specRows, title);
  const sourceRef = {
    platform: 'aliexpress',
    url: args.url,
    sellerTitle: title,
    seller,
    priceUSD: price ? Number(price.replace(/[^0-9.]/g, '')) || undefined : undefined,
    images: localImagePaths,
    fetchedAt: new Date().toISOString(),
  };

  let json;
  let outPath;
  if (isWire) {
    json = {
      id: `wire-${slug}`,
      name: title,
      gaugeAWG: specs.gaugeAWG ?? 16,
      maxAmps: 22,
      insulationColor: specs.color ?? 'red',
      source: sourceRef,
    };
    outPath = resolve(ROOT, 'src', 'lib', 'wires', 'imported', `${slug}.json`);
  } else {
    json = {
      id: slug,
      kind,
      name: title,
      imageRef: localImagePaths[0],
      size: { w: 80, h: 60 },
      ports: defaultPortsFor(kind),
      specs,
      source: sourceRef,
      qtyOwned: args.qty,
    };
    outPath = resolve(ROOT, 'src', 'lib', 'components', 'custom', `${slug}.json`);
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(json, null, 2));
  console.log(`✓ wrote ${outPath}`);
  console.log(`  kind:  ${isWire ? 'wire' : kind}`);
  console.log(`  title: ${title}`);
  console.log(`  ${localImagePaths.length} image(s) under public/components/${slug}/`);

  if (!isWire) {
    const fixDir = resolve(
      ROOT,
      'src',
      'lib',
      'components',
      'custom',
      `${slug}.fixtures`,
    );
    const fixPath = resolve(fixDir, 'nominal.json');
    await mkdir(fixDir, { recursive: true });
    if (!existsSync(fixPath)) {
      await writeFile(fixPath, JSON.stringify(nominalFixtureFor(kind, specs), null, 2));
      console.log(`✓ wrote nominal fixture ${fixPath}`);
    }
  }

  console.log('\nNext: open the in-app Component Editor to fine-tune ports.');
  console.log(`Verify in headless sandbox:`);
  if (!isWire) {
    console.log(`  npm run sandbox -- '${outPath}' '${outPath.replace('.json', '.fixtures/nominal.json')}'`);
  }
}

await main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
