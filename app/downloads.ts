// Builds a runnable download script for every paper and key in data/papers.json.
// The PDFs sit on origins that send no CORS headers, so the browser can't fetch
// them itself — it hands the user a script that curl/Invoke-WebRequest can run.
import data from "@/data/papers.json";

type Paper = {
  year: number;
  shift: string;
  label: string;
  paper: string;
  key: string | null;
};

export type Job = { dir: string; name: string; url: string };

/** Same folder layout and file names as `npm run download`. */
export function buildJobs(): Job[] {
  const out: Job[] = [];
  const seenKeys = new Set<string>();
  for (const p of data.papers as Paper[]) {
    const dir = `papers/${p.year}`;
    out.push({ dir, name: `${p.year}-${p.shift}-paper.pdf`, url: p.paper });
    if (p.key && !seenKeys.has(p.key)) {
      seenKeys.add(p.key);
      out.push({ dir, name: `${p.year}-${p.shift}-answer-key.pdf`, url: p.key });
    }
  }
  return out;
}

export const fileCount = buildJobs().length;

const header = (comment: string) =>
  `${comment} GATE EE question papers and answer keys, 2012-2026.\n` +
  `${comment} ${fileCount} PDFs into papers/<year>/. Already-downloaded files are skipped.\n` +
  `${comment} Anything that fails is listed at the end; get those from the official archive:\n` +
  `${comment} ${data.archive}\n`;

export function powershell(): string {
  const rows = buildJobs()
    .map((j) => `  @{D='${j.dir.replace(/\//g, "\\")}';N='${j.name}';U='${j.url}'}`)
    .join("\n");
  return `${header("#")}# Run:  powershell -ExecutionPolicy Bypass -File gate-ee-papers.ps1

$files = @(
${rows}
)

$done = 0; $skip = 0; $fail = @()
foreach ($f in $files) {
  New-Item -ItemType Directory -Force -Path $f.D | Out-Null
  $out = Join-Path $f.D $f.N
  if (Test-Path $out) { $skip++; continue }
  Write-Host ("  " + $f.N)
  try {
    Invoke-WebRequest -Uri $f.U -OutFile $out -UserAgent 'Mozilla/5.0' -MaximumRedirection 5 -TimeoutSec 300 -ErrorAction Stop
    $done++
  } catch {
    if (Test-Path $out) { Remove-Item $out -Force }
    $fail += $f.N
  }
}

Get-ChildItem -Path 'papers' -Directory -ErrorAction SilentlyContinue |
  Where-Object { -not (Get-ChildItem $_.FullName -File) } |
  Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host ("Saved $done PDFs to papers\\" + $(if ($skip) { " ($skip already there)" } else { "" }))
if ($fail.Count) {
  Write-Host ""
  Write-Host ("$($fail.Count) could not be downloaded:")
  $fail | ForEach-Object { Write-Host ("  - " + $_) }
  Write-Host ""
  Write-Host "Get these from the official archive:"
  Write-Host "  ${data.archive}"
}
`;
}

export function shell(): string {
  const rows = buildJobs()
    .map((j) => `get '${j.dir}' '${j.name}' '${j.url}'`)
    .join("\n");
  return `#!/usr/bin/env bash
${header("#")}# Run:  bash gate-ee-papers.sh

set -u
done_n=0; skip_n=0; fail=()

get() {
  mkdir -p "$1"
  if [ -f "$1/$2" ]; then skip_n=$((skip_n+1)); return; fi
  echo "  $2"
  if curl -fsSL --retry 1 --connect-timeout 10 --max-time 300 -A 'Mozilla/5.0' -o "$1/$2" "$3"; then
    done_n=$((done_n+1))
  else
    rm -f "$1/$2"
    fail+=("$2")
  fi
}

${rows}

find papers -type d -empty -delete 2>/dev/null

echo
if [ "$skip_n" -gt 0 ]; then
  echo "Saved $done_n PDFs to papers/ ($skip_n already there)"
else
  echo "Saved $done_n PDFs to papers/"
fi
if [ "\${#fail[@]}" -gt 0 ]; then
  echo
  echo "\${#fail[@]} could not be downloaded:"
  for f in "\${fail[@]}"; do echo "  - $f"; done
  echo
  echo "Get these from the official archive:"
  echo "  ${data.archive}"
fi
`;
}
