"use client";

import { useEffect, useMemo, useState } from "react";
import data from "@/data/papers.json";
import { fileCount, powershell, shell } from "./downloads";

type Paper = {
  id: string;
  year: number;
  shift: string;
  label: string;
  paper: string;
  key: string | null;
  source: string;
  verified: boolean;
  note: string | null;
};

const papers = data.papers as Paper[];
const ARCHIVE = data.archive;
const STORE = "gateee-solved-v1";

const years = Array.from(new Set(papers.map((p) => p.year))).sort((a, b) => b - a);

export default function Home() {
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "todo" | "done">("all");
  const [getAllOpen, setGetAllOpen] = useState(false);

  useEffect(() => {
    try {
      setSolved(JSON.parse(localStorage.getItem(STORE) || "{}"));
    } catch {
      /* storage blocked: start empty */
    }
  }, []);

  function toggle(id: string) {
    setSolved((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  function saveScript(kind: "ps1" | "sh") {
    const body = kind === "ps1" ? powershell() : shell();
    const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gate-ee-papers.${kind}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setGetAllOpen(false);
  }

  const doneCount = papers.filter((p) => solved[p.id]).length;
  const pct = Math.round((doneCount / papers.length) * 100);

  const grouped = useMemo(() => {
    return years
      .filter((y) => yearFilter === "all" || String(y) === yearFilter)
      .map((y) => ({
        year: y,
        items: papers.filter(
          (p) =>
            p.year === y &&
            (status === "all" || (status === "done" ? solved[p.id] : !solved[p.id]))
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [yearFilter, status, solved]);

  return (
    <main className="wrap">
      <header className="head">
        <h1>GATE EE Papers, 2012–2026</h1>
        <p className="lede">
          Every official Electrical Engineering paper from the last fifteen years, shift by shift, with its
          answer key. Open any PDF straight from the source, or take the whole set offline in one go.
        </p>

        <div className="getall">
          <div className="actions">
            <button
              className="btn ghost getall-btn"
              aria-expanded={getAllOpen}
              onClick={() => setGetAllOpen((v) => !v)}
            >
              Download all papers
            </button>
            <a
              className="btn ghost"
              href="https://github.com/princeraj2572/GATE-PQY"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
          {getAllOpen && (
            <div className="getall-panel">
              <p>
                The exam sites block direct downloads from other pages, so this saves a short script
                instead. Run it once and all {fileCount} PDFs land in <code>papers/</code>, one folder
                per year.
              </p>
              <div className="getall-opts">
                <button className="btn" onClick={() => saveScript("ps1")}>
                  Windows script
                </button>
                <button className="btn" onClick={() => saveScript("sh")}>
                  Mac or Linux script
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <section className="progress" aria-label="Progress">
        <div className="progress-top">
          <span className="progress-count">
            <b>{doneCount}</b> of {papers.length} papers solved
          </span>
          <span className="progress-pct">{pct}%</span>
        </div>
        <div className="ticks" role="img" aria-label={`${doneCount} of ${papers.length} papers solved`}>
          {papers.map((p) => (
            <span key={p.id} className={solved[p.id] ? "tickmark on" : "tickmark"} title={p.label} />
          ))}
        </div>
      </section>

      <section className="controls">
        <label htmlFor="year">
          Year
          <select id="year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Show">
          {(["all", "todo", "done"] as const).map((s) => (
            <button
              key={s}
              className={status === s ? "on" : ""}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s === "all" ? "All" : s === "todo" ? "To do" : "Solved"}
            </button>
          ))}
        </div>
      </section>

      {grouped.length === 0 && (
        <p className="empty">Nothing matches this filter. Tick a paper once you&apos;ve solved it.</p>
      )}

      {grouped.map((g) => {
        const total = papers.filter((p) => p.year === g.year).length;
        return (
          <section key={g.year} className="year">
            <div className="year-head">
              <h2>{g.year}</h2>
              <span className="count">{total === 1 ? "1 paper" : `${total} shifts`}</span>
            </div>
            <div className="grid">
              {g.items.map((p) => (
                <article key={p.id} className={`card ${solved[p.id] ? "done" : ""}`}>
                  <div className="card-top">
                    <h3>{p.label}</h3>
                    <label className="tick">
                      <input
                        type="checkbox"
                        id={`c-${p.id}`}
                        checked={!!solved[p.id]}
                        onChange={() => toggle(p.id)}
                      />
                      Solved
                    </label>
                  </div>
                  <div className="links">
                    <a className="btn" href={p.paper} target="_blank" rel="noopener noreferrer">
                      Question paper
                    </a>
                    {p.key ? (
                      <a className="btn ghost" href={p.key} target="_blank" rel="noopener noreferrer">
                        Answer key
                      </a>
                    ) : (
                      <a className="btn ghost" href={ARCHIVE} target="_blank" rel="noopener noreferrer">
                        Key in archive
                      </a>
                    )}
                  </div>
                  <p className="meta">
                    <span>{p.source}</span>
                    {p.note && <span>{p.note}</span>}
                    {!p.verified && (
                      <span>
                        If the link doesn&apos;t open,{" "}
                        <a href={ARCHIVE} target="_blank" rel="noopener noreferrer">
                          use the archive
                        </a>
                      </span>
                    )}
                  </p>
                </article>
              ))}
            </div>
          </section>
        );
      })}

      <footer>
        <h2 className="foot-h">Sources</h2>
        <ul>
          <li>
            <a href="https://gate2027.iitm.ac.in/download" target="_blank" rel="noopener noreferrer">
              GATE 2027 downloads, IIT Madras
            </a>
          </li>
          <li>
            <a
              href="https://gate.iitkgp.ac.in/old_question_papers.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              Previous papers, IIT Kharagpur
            </a>
          </li>
          <li>
            <a href={ARCHIVE} target="_blank" rel="noopener noreferrer">
              Official archive, 2007–2026
            </a>
          </li>
        </ul>
      </footer>
    </main>
  );
}
