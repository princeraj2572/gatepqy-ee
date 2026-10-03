// Downloads every GATE EE question paper and answer key into ./papers/<year>/
// Run from the project folder:  npm run download
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import data from "../data/papers.json" with { type: "json" };

const OUT = path.resolve("papers");

// Other file names the IIT Kharagpur archive has used, tried if the main link fails.
function alternates(url) {
  const m = url.match(/^(.*\/)(\d{4})\/ee(\d?)_(\d{4})\.pdf$/);
  if (!m) return [];
  const [, base, y, s] = m;
  if (!s) return [`${base}${y}/EE_${y}.pdf`];
  return [`${base}${y}/ee_${y}_${s}.pdf`, `${base}${y}/ee${s}${y}.pdf`, `${base}${y}/EE${s}_${y}.pdf`];
}

async function exists(f) { try { await access(f); return true; } catch { return false; } }

async function fetchPdf(url) {
  for (const u of [url, ...alternates(url)]) {
    try {
      const res = await fetch(u, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.subarray(0, 4).toString() === "%PDF") return buf;
    } catch { /* try next */ }
  }
  return null;
}

let ok = 0, skipped = 0;
const failed = [];
const seenKeys = new Set();

for (const p of data.papers) {
  const dir = path.join(OUT, String(p.year));
  await mkdir(dir, { recursive: true });
  const jobs = [[p.paper, path.join(dir, `${p.year}-${p.shift}-paper.pdf`), `${p.year} ${p.label} paper`]];
  if (p.key && !seenKeys.has(p.key)) {
    seenKeys.add(p.key);
    jobs.push([p.key, path.join(dir, `${p.year}-${p.shift}-answer-key.pdf`), `${p.year} ${p.label} answer key`]);
  }
  for (const [url, file, name] of jobs) {
    if (await exists(file)) { skipped++; continue; }
    process.stdout.write(`Downloading ${name} ... `);
    const buf = await fetchPdf(url);
    if (buf) { await writeFile(file, buf); ok++; console.log("done"); }
    else { failed.push(name); console.log("FAILED"); }
  }
}

console.log(`\nSaved ${ok} new PDFs to ${OUT}${skipped ? ` (${skipped} already there)` : ""}.`);
if (failed.length) {
  console.log(`\n${failed.length} could not be downloaded:`);
  failed.forEach((f) => console.log("  - " + f));
  console.log(`\nGet these from the official archive (every paper 2007-2026):\n  ${data.archive}`);
}
