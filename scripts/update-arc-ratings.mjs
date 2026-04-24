#!/usr/bin/env node
/**
 * Recomputes each arc's averageRating from TVMaze viewer scores on the
 * original anime episodes in that arc's coverage.anime range (absolute
 * episode numbers, ordered by airdate in TVMaze).
 *
 * Usage: node scripts/update-arc-ratings.mjs
 */
import fs from "fs";
import https from "https";

const DATA_TS = new URL("../src/data/data.ts", import.meta.url);
const CACHE = new URL("../.cache/tvmaze-one-piece-episodes.json", import.meta.url);

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on("error", reject);
  });
}

function expandAnime(text) {
  const m = text.match(/anime:\s*"([^"]+)"/);
  if (!m) return [];
  const parts = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  const nums = new Set();
  for (const p of parts) {
    let mm = p.match(/^(\d+)-(\d+)$/);
    if (mm) {
      const a = +mm[1];
      const b = +mm[2];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let i = lo; i <= hi; i++) nums.add(i);
    } else {
      mm = p.match(/^(\d+)$/);
      if (mm) nums.add(+mm[1]);
    }
  }
  return [...nums].sort((a, b) => a - b);
}

function avgFor(nums, byAbs) {
  let s = 0;
  let c = 0;
  for (const n of nums) {
    const r = byAbs[n - 1];
    if (r != null) {
      s += r;
      c++;
    }
  }
  return c ? Math.round((s / c) * 100) / 100 : null;
}

async function main() {
  fs.mkdirSync(new URL("../.cache/", import.meta.url), { recursive: true });
  let eps;
  try {
    eps = JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    eps = await fetchJson("https://api.tvmaze.com/shows/1505/episodes?specials=1");
    fs.writeFileSync(CACHE, JSON.stringify(eps));
  }

  const reg = eps.filter((e) => e.type === "regular" && e.number != null && e.airstamp);
  reg.sort((a, b) => a.airstamp.localeCompare(b.airstamp));
  const byAbs = reg.map((e) => (e.rating && e.rating.average != null ? e.rating.average : null));

  let text = fs.readFileSync(DATA_TS, "utf8");
  text = text.replace(/\n\s*averageRating: [0-9.]+,/g, "");

  const lines = text.split("\n");
  let currentArcId = null;
  const avByLine = new Map();

  for (let i = 0; i < lines.length; i++) {
    const idm = lines[i].match(/^      id: (\d+),$/);
    if (idm) currentArcId = +idm[1];
    const isCloseMultiline =
      lines[i] === "      }," && /^\s*episodes: \[/.test(lines[i + 1] || "");
    const isSingleCov =
      /^      coverage: \{ anime:/.test(lines[i]) &&
      lines[i].trimEnd().endsWith("},") &&
      /^\s*episodes: \[/.test(lines[i + 1] || "");
    if ((isCloseMultiline || isSingleCov) && currentArcId != null) {
      let block = "";
      if (isSingleCov) block = lines[i];
      else {
        let j = i;
        while (j >= 0 && !lines[j].includes("coverage:")) j--;
        block = lines.slice(j, i + 1).join("\n");
      }
      avByLine.set(i, avgFor(expandAnime(block), byAbs));
    }
  }

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    out.push(lines[i]);
    const av = avByLine.get(i);
    const next = lines[i + 1];
    if (av != null && next && /^\s*episodes: \[/.test(next)) {
      out.push(`      averageRating: ${av},`);
    }
  }

  fs.writeFileSync(DATA_TS, out.join("\n"));
  console.log(`Updated ${avByLine.size} arc averageRating values (TVMaze).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
