"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type PlaylistProblem = {
  slug: string;
  title: string;
  topic: string;
  difficulty: string | null;
  available: boolean;
  completed: boolean | null;
};
type Playlist = {
  id: string;
  name: string;
  description: string;
  problems: PlaylistProblem[];
  updatedAt?: string;
};
type PlaylistResponse = {
  authenticated: boolean;
  curated: Playlist[];
  personal: Playlist[];
};
type DraftProblem = { slug: string; title: string; topic: string };
type AvailableProblem = { slug: string; title: string; difficulty: string; topics: string[] };
type ProblemSearchResponse = { items: AvailableProblem[]; totalPages: number; error?: string };
type CompanyPlaylistSummary = { id: string; name: string; description: string; problemCount: number; completedCount: number };
type CompanyPlaylistResponse = { companies: CompanyPlaylistSummary[]; error?: string };

function playlistStats(playlist: Playlist) {
  const completed = playlist.problems.filter((problem) => problem.completed === true).length;
  return { completed, total: playlist.problems.length };
}

function groupByTopic(problems: PlaylistProblem[]) {
  const groups = new Map<string, PlaylistProblem[]>();
  for (const problem of problems) {
    const group = groups.get(problem.topic) ?? [];
    group.push(problem);
    groups.set(problem.topic, group);
  }
  return [...groups.entries()];
}


export default function PlaylistsClient() {
  const [data, setData] = useState<PlaylistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [editing, setEditing] = useState<Playlist | null | "new">(null);
  const [saving, setSaving] = useState(false);
  const [pendingProgress, setPendingProgress] = useState<Set<string>>(new Set());
  const [companies, setCompanies] = useState<CompanyPlaylistSummary[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/playlists", { cache: "no-store" });
      const body = await response.json() as PlaylistResponse | { error?: string };
      if (!response.ok) throw new Error((body as { error?: string }).error || "Could not load playlists.");
      setData(body as PlaylistResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load playlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlaylists(); }, [loadPlaylists]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCompanies() {
      setCompaniesLoading(true);
      setCompaniesError("");
      try {
        const response = await fetch("/api/playlists/companies", { cache: "no-store", signal: controller.signal });
        const body = await response.json() as CompanyPlaylistResponse;
        if (!response.ok) throw new Error(body.error || "Could not load company playlists.");
        setCompanies(body.companies);
      } catch (loadError) {
        if (!controller.signal.aborted) setCompaniesError(loadError instanceof Error ? loadError.message : "Could not load company playlists.");
      } finally {
        if (!controller.signal.aborted) setCompaniesLoading(false);
      }
    }
    void loadCompanies();
    return () => controller.abort();
  }, []);

  const closeOverlays = useCallback(() => {
    setSelected(null);
    setEditing(null);
  }, []);

  useEffect(() => {
    if (!selected && !editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeOverlays();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, editing, closeOverlays]);

  const personal = data?.personal ?? [];
  const curated = data?.curated ?? [];
  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLocaleLowerCase();
    return companies.filter((company) => company.name.toLocaleLowerCase().includes(query));
  }, [companies, companySearch]);
  const companyPageSize = 24;
  const companyPageCount = Math.max(1, Math.ceil(filteredCompanies.length / companyPageSize));
  const visibleCompanies = filteredCompanies.slice((companyPage - 1) * companyPageSize, companyPage * companyPageSize);

  async function toggleCompletion(playlist: Playlist, problem: PlaylistProblem) {
    if (problem.completed === null) return;
    const key = `${playlist.id}:${problem.slug}`;
    const completed = !problem.completed;
    setPendingProgress((current) => new Set(current).add(key));
    setError("");
    const updateProgress = (isCompleted: boolean) => {
      const update = (item: Playlist) => item.id === playlist.id
        ? { ...item, problems: item.problems.map((entry) => entry.slug === problem.slug ? { ...entry, completed: isCompleted } : entry) }
        : item;
      setData((current) => current ? {
        ...current,
        curated: current.curated.map(update),
        personal: current.personal.map(update),
      } : current);
      setSelected((current) => current?.id === playlist.id ? update(current) : current);
      if (playlist.id.startsWith("company:")) {
        const companyId = playlist.id.slice("company:".length);
        const countDelta = isCompleted ? 1 : -1;
        setCompanies((current) => current.map((company) => company.id === companyId
          ? { ...company, completedCount: Math.max(0, Math.min(company.problemCount, company.completedCount + countDelta)) }
          : company));
      }
    };
    updateProgress(completed);
    try {
      const response = await fetch("/api/playlists/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId: playlist.id, problemSlug: problem.slug, completed }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not save checklist progress.");
    } catch (progressError) {
      updateProgress(problem.completed);
      setError(progressError instanceof Error ? progressError.message : "Could not save checklist progress.");
    } finally {
      setPendingProgress((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }

  async function openCompanyPlaylist(company: CompanyPlaylistSummary) {
    const playlistId = `company:${company.id}`;
    setSelected({ id: playlistId, name: company.name, description: company.description, problems: [] });
    setSelectedLoading(true);
    try {
      const response = await fetch(`/api/playlists/companies?companyId=${encodeURIComponent(company.id)}`, { cache: "no-store" });
      const body = await response.json() as { playlist?: Playlist; error?: string };
      if (!response.ok || !body.playlist) throw new Error(body.error || "Could not load this company playlist.");
      setSelected((current) => current?.id === playlistId ? body.playlist! : current);
    } catch (loadError) {
      setSelected((current) => current?.id === playlistId ? null : current);
      setCompaniesError(loadError instanceof Error ? loadError.message : "Could not load this company playlist.");
    } finally {
      setSelectedLoading(false);
    }
  }

  async function deletePlaylist(playlist: Playlist) {
    if (!window.confirm(`Delete “${playlist.name}”? This cannot be undone.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/playlists/${encodeURIComponent(playlist.id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not delete playlist.");
      if (selected?.id === playlist.id) setSelected(null);
      await loadPlaylists();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete playlist.");
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-1 py-5 sm:px-2 sm:py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow">Practice with a plan</p>
          <h1 className="page-title mt-2">Playlists</h1>
          <p className="page-description mt-3">Curated roadmaps and your own collections. Track the problems you want to come back to.</p>
        </div>
        {data?.authenticated && (
          <button type="button" onClick={() => setEditing("new")} className="rounded-lg bg-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400">
            Create playlist
          </button>
        )}
      </header>

      {error && <div role="alert" className="mb-5 rounded-lg border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200">{error}</div>}
      {!data?.authenticated && !loading && <p className="mb-5 text-sm text-white/45">Sign in to create playlists and save checklist progress.</p>}
      {loading && <p className="py-12 text-center text-sm text-white/45">Loading playlists…</p>}
      {!loading && data && (
        <>
          <section aria-labelledby="curated-playlists-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div><h2 id="curated-playlists-title" className="text-xl font-semibold text-white">Curated playlists</h2><p className="mt-1 text-sm text-white/45">Check off problems independently for each playlist, including ones you solve outside YexCode.</p></div>
            </div>
            <div className="surface-grid mx-auto grid w-full max-w-5xl gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {curated.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} authenticated={data.authenticated} onOpen={() => setSelected(playlist)} />)}
            </div>
          </section>

          {data.authenticated && <section aria-labelledby="my-playlists-title" className="mt-10">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div><h2 id="my-playlists-title" className="text-xl font-semibold text-white">Your playlists</h2><p className="mt-1 text-sm text-white/45">Organize problems into collections that fit your goals.</p></div>
            </div>
            {personal.length === 0 ? (
              <button type="button" onClick={() => setEditing("new")} className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 text-center transition hover:border-violet-300/40 hover:bg-white/[0.04]">
                <span className="text-2xl text-violet-300">＋</span><span className="mt-2 text-sm font-medium text-white">Create your first playlist</span><span className="mt-1 text-xs text-white/45">Search for available problems and add them to your list.</span>
              </button>
            ) : <div className="surface-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {personal.map((playlist) => <PlaylistCard key={playlist.id} playlist={playlist} authenticated={data.authenticated} onOpen={() => setSelected(playlist)} onEdit={() => setEditing(playlist)} onDelete={() => void deletePlaylist(playlist)} />)}
            </div>}
          </section>}

          {!data.authenticated && <section className="mt-10">
            <h2 className="text-xl font-semibold text-white">Your playlists</h2>
            <p className="mt-2 text-sm text-white/45">Sign in to create and manage personal playlists.</p>
          </section>}

          <section aria-labelledby="company-playlists-title" className="mt-12 border-t border-white/[0.08] pt-8">
            <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="page-eyebrow mb-2">Interview preparation</p>
                <h2 id="company-playlists-title" className="text-2xl font-semibold tracking-tight text-white">Company playlists</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Practice questions reported for specific companies. Open a list to check off questions and jump to YexCode or LeetCode.</p>
                <a href="https://github.com/snehasishroy/leetcode-companywise-interview-questions" target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs text-violet-200/70 underline decoration-white/20 underline-offset-4 transition hover:text-violet-100">Source data · snapshot from July 12, 2026</a>
              </div>
              <label className="w-full sm:max-w-xs">
                <span className="sr-only">Search companies</span>
                <input type="search" value={companySearch} onChange={(event) => { setCompanySearch(event.target.value); setCompanyPage(1); }} placeholder="Search companies…" className="control-field w-full px-3 py-2.5 text-sm text-white placeholder:text-white/35" />
              </label>
            </div>
            {companiesError && <p role="alert" className="mb-4 rounded-lg border border-rose-300/20 bg-rose-300/[0.06] px-4 py-3 text-sm text-rose-200">{companiesError}</p>}
            {companiesLoading ? <p className="surface-panel rounded-xl px-5 py-10 text-center text-sm text-white/45">Loading company playlists…</p> : visibleCompanies.length === 0 ? <p className="surface-panel rounded-xl px-5 py-10 text-center text-sm text-white/45">No companies match “{companySearch}”.</p> : <div className="surface-grid grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {visibleCompanies.map((company) => <CompanyPlaylistCard key={company.id} company={company} authenticated={data.authenticated} onOpen={() => void openCompanyPlaylist(company)} />)}
            </div>}
            {!companiesLoading && filteredCompanies.length > 0 && <div className="mt-4 flex items-center justify-between gap-3 text-xs text-white/45">
              <span>{filteredCompanies.length} companies · Page {companyPage} of {companyPageCount}</span>
              {companyPageCount > 1 && <div className="flex gap-2">
                <button type="button" disabled={companyPage <= 1} onClick={() => setCompanyPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70 transition hover:bg-white/[0.07] disabled:opacity-35">Previous</button>
                <button type="button" disabled={companyPage >= companyPageCount} onClick={() => setCompanyPage((page) => Math.min(companyPageCount, page + 1))} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-white/70 transition hover:bg-white/[0.07] disabled:opacity-35">Next</button>
              </div>}
            </div>}
          </section>
        </>
      )}

      {selected && <PlaylistSheet playlist={selected} loading={selectedLoading} showTopics={!selected.id.startsWith("company:") && !personal.some((playlist) => playlist.id === selected.id)} pendingProgress={pendingProgress} onClose={() => { setSelected(null); setSelectedLoading(false); }} onToggleCompletion={(problem) => void toggleCompletion(selected, problem)} />}
      {editing && <PlaylistEditor
        playlist={editing === "new" ? null : editing}
        saving={saving}
        onClose={() => setEditing(null)}
        onSave={async (payload) => {
          setSaving(true);
          setError("");
          try {
            const isNew = editing === "new";
            const response = await fetch(isNew ? "/api/playlists" : `/api/playlists/${encodeURIComponent(editing.id)}`, {
              method: isNew ? "POST" : "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || "Could not save playlist.");
            setEditing(null);
            await loadPlaylists();
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Could not save playlist.");
          } finally {
            setSaving(false);
          }
        }}
      />}
    </div>
  );
}

function PlaylistCard({ playlist, authenticated, onOpen, onEdit, onDelete }: {
  playlist: Playlist;
  authenticated: boolean;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const stats = playlistStats(playlist);
  return (
    <article className="surface-panel flex min-h-52 flex-col p-5 transition hover:border-violet-300/25 hover:bg-[#1d1d26]">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left">
        <span className="text-xs font-medium uppercase tracking-wide text-violet-300">{playlist.problems.length} problems</span>
        <span className="mt-2 text-lg font-semibold text-white">{playlist.name}</span>
        <span className="mt-2 line-clamp-3 text-sm leading-6 text-white/50">{playlist.description || "A personal collection of practice problems."}</span>
        <span className="mt-auto flex items-center gap-2 pt-5 text-xs text-white/45">
          {authenticated ? <span>{stats.completed}/{stats.total} completed</span> : <span>Sign in to track progress</span>}
        </span>
      </button>
      {(onEdit || onDelete) && <div className="mt-4 flex gap-2 border-t border-white/10 pt-3">
        {onEdit && <button type="button" onClick={onEdit} className="rounded-md px-2 py-1 text-xs text-white/55 transition hover:bg-white/[0.06] hover:text-white">Edit</button>}
        {onDelete && <button type="button" onClick={onDelete} className="ml-auto rounded-md px-2 py-1 text-xs text-rose-200/65 transition hover:bg-rose-300/[0.08] hover:text-rose-200">Delete</button>}
      </div>}
    </article>
  );
}

function CompanyPlaylistCard({ company, authenticated, onOpen }: {
  company: CompanyPlaylistSummary;
  authenticated: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="surface-panel flex min-h-48 flex-col p-4 transition hover:border-violet-300/25 hover:bg-[#1d1d26]">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200/75">{company.problemCount} questions</span>
        <span className="mt-2 text-lg font-semibold text-white">{company.name}</span>
        <span className="mt-auto pt-5 text-xs text-white/45">{authenticated ? `${company.completedCount}/${company.problemCount} completed` : "Sign in to track progress"}</span>
      </button>
      <div className="mt-3 border-t border-white/[0.08] pt-3 text-xs text-white/35">Company interview set</div>
    </article>
  );
}

function PlaylistSheet({ playlist, loading, showTopics, pendingProgress, onClose, onToggleCompletion }: {
  playlist: Playlist;
  loading: boolean;
  showTopics: boolean;
  pendingProgress: Set<string>;
  onClose: () => void;
  onToggleCompletion: (problem: PlaylistProblem) => void;
}) {
  const stats = playlistStats(playlist);
  const isCompanyPlaylist = playlist.id.startsWith("company:");
  const [companyProblemSearch, setCompanyProblemSearch] = useState("");
  const [companyProblemPage, setCompanyProblemPage] = useState(1);
  const [collapsedTopics, setCollapsedTopics] = useState<Record<string, boolean>>({});
  const filteredCompanyProblems = useMemo(() => {
    const query = companyProblemSearch.trim().toLocaleLowerCase();
    return playlist.problems.filter((problem) => !query || problem.title.toLocaleLowerCase().includes(query) || problem.slug.toLocaleLowerCase().includes(query));
  }, [companyProblemSearch, playlist.problems]);
  const companyProblemPageSize = 50;
  const companyProblemPageCount = Math.max(1, Math.ceil(filteredCompanyProblems.length / companyProblemPageSize));
  const visibleProblems = isCompanyPlaylist
    ? filteredCompanyProblems.slice((companyProblemPage - 1) * companyProblemPageSize, companyProblemPage * companyProblemPageSize)
    : playlist.problems;
  const groups = useMemo(() => showTopics ? groupByTopic(playlist.problems) : [["", visibleProblems] as [string, PlaylistProblem[]]], [playlist.problems, showTopics, visibleProblems]);
  return (
    <div className="fixed inset-0 z-[70] grid items-start overflow-y-auto bg-black/70 p-3 pt-24 backdrop-blur-sm sm:px-5 sm:pb-5 sm:pt-24" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="playlist-sheet-title" className="flex max-h-[calc(100dvh-8rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111116] shadow-2xl shadow-black/50 sm:mx-auto sm:max-w-5xl">
        <header className="flex items-start justify-between gap-5 border-b border-white/10 p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-violet-300">Playlist · {playlist.problems.length} problems</p>
            <h2 id="playlist-sheet-title" className="mt-2 text-2xl font-semibold text-white">{playlist.name}</h2>
            {playlist.description && <p className="mt-2 max-w-2xl text-sm text-white/55">{playlist.description}</p>}
            <p className="mt-3 text-xs text-white/45">{loading ? "Loading questions…" : `${stats.completed} of ${stats.total} completed`}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close playlist" className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/65 hover:bg-white/5">Close</button>
        </header>
        <div className="problem-panel-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {isCompanyPlaylist && !loading && <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label className="min-w-60 flex-1 text-xs text-white/45">Search questions
              <input type="search" value={companyProblemSearch} onChange={(event) => { setCompanyProblemSearch(event.target.value); setCompanyProblemPage(1); }} placeholder="Search by problem title" className="control-field mt-1.5 w-full px-3 py-2.5 text-sm text-white" />
            </label>
            <span className="text-xs text-white/40">{filteredCompanyProblems.length} questions</span>
          </div>}
          {loading ? <p className="py-16 text-center text-sm text-white/45">Loading company questions…</p> : groups.map(([topic, problems], groupIndex) => {
            const isCollapsed = collapsedTopics[topic] ?? false;
            const groupId = `playlist-topic-${groupIndex}`;
            return (
              <section key={topic || "all-problems"} className="mb-7 last:mb-0">
                {showTopics && <h3 className="border-b border-white/10 pb-2 text-sm font-semibold text-white">
                  <button
                    type="button"
                    aria-expanded={!isCollapsed}
                    aria-controls={groupId}
                    onClick={() => setCollapsedTopics((current) => ({ ...current, [topic]: !(current[topic] ?? false) }))}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <svg aria-hidden="true" viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 text-white/55 transition-transform ${isCollapsed ? "-rotate-90" : "rotate-0"}`} fill="none">
                        <path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                      </svg>
                      {topic}
                    </span>
                    <span className="text-xs font-normal text-white/40">{problems.length} {problems.length === 1 ? "problem" : "problems"}</span>
                  </button>
                </h3>}
                <ol id={groupId} hidden={showTopics && isCollapsed} className={`${showTopics ? "mt-3" : ""} space-y-2`}>
                  {problems.map((problem, index) => (
                    <li key={problem.slug} className="grid grid-cols-[2rem_2rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-3">
                      <button
                        type="button"
                        disabled={problem.completed === null || pendingProgress.has(`${playlist.id}:${problem.slug}`)}
                        aria-pressed={problem.completed === true}
                        aria-label={`${problem.completed ? "Unmark" : "Mark"} ${problem.title} as solved${problem.completed === null ? "; sign in to track progress" : ""}`}
                        title={problem.completed === null ? "Sign in to track progress" : problem.completed ? "Mark as not solved" : "Mark as solved"}
                        onClick={() => onToggleCompletion(problem)}
                        className="flex h-7 w-7 items-center justify-center rounded border border-white/20 text-white transition hover:border-emerald-300/60 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-emerald-400 aria-pressed:bg-emerald-400/15 aria-pressed:text-emerald-300"
                      >
                        {problem.completed && <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" /></svg>}
                      </button>
                      <span className="text-right text-xs tabular-nums text-white/35">{(isCompanyPlaylist ? (companyProblemPage - 1) * companyProblemPageSize : 0) + index + 1}.</span>
                      <div className="min-w-0">
                        <Link href={`/problems/${problem.slug}`} className="text-sm font-medium text-sky-200 hover:text-sky-100 hover:underline">{problem.title}</Link>
                        {problem.difficulty && <div className="mt-1 text-[11px] text-white/40">{problem.difficulty}</div>}
                      </div>
                      <a href={`https://leetcode.com/problems/${encodeURIComponent(problem.slug)}/`} target="_blank" rel="noreferrer" aria-label={`Open ${problem.title} on LeetCode`} title="Open on LeetCode" className="rounded p-1 transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-orange-400/70">
                        <Image src="/leetcode.svg" alt="" width={24} height={24} className="h-6 w-6" />
                      </a>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
          {!loading && playlist.problems.length === 0 && <p className="py-12 text-center text-sm text-white/45">This playlist has no problems yet. Edit it to add some.</p>}
          {!loading && playlist.problems.length > 0 && isCompanyPlaylist && filteredCompanyProblems.length === 0 && <p className="py-12 text-center text-sm text-white/45">No questions match that search.</p>}
          {!loading && isCompanyPlaylist && companyProblemPageCount > 1 && <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-white/45"><span>Page {companyProblemPage} of {companyProblemPageCount}</span><div className="flex gap-2"><button type="button" disabled={companyProblemPage <= 1} onClick={() => setCompanyProblemPage((page) => Math.max(1, page - 1))} className="rounded-lg border border-white/10 px-3 py-2 transition hover:bg-white/[0.05] disabled:opacity-35">Previous</button><button type="button" disabled={companyProblemPage >= companyProblemPageCount} onClick={() => setCompanyProblemPage((page) => Math.min(companyProblemPageCount, page + 1))} className="rounded-lg border border-white/10 px-3 py-2 transition hover:bg-white/[0.05] disabled:opacity-35">Next</button></div></div>}
        </div>
      </section>
    </div>
  );
}

function PlaylistEditor({ playlist, saving, onClose, onSave }: {
  playlist: Playlist | null;
  saving: boolean;
  onClose: () => void;
  onSave: (payload: { name: string; description: string; problems: DraftProblem[] }) => void;
}) {
  const [name, setName] = useState(playlist?.name ?? "");
  const [description, setDescription] = useState(playlist?.description ?? "");
  const [problems, setProblems] = useState<DraftProblem[]>(playlist?.problems.map(({ slug, title, topic }) => ({ slug, title, topic })) ?? []);
  const [availableProblems, setAvailableProblems] = useState<AvailableProblem[]>([]);
  const [problemSearch, setProblemSearch] = useState("");
  const [loadingProblems, setLoadingProblems] = useState(true);
  const [problemLoadError, setProblemLoadError] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadAvailableProblems() {
      setLoadingProblems(true);
      setProblemLoadError("");
      try {
        const firstResponse = await fetch("/api/problems?page=1&pageSize=50", { cache: "no-store", signal: controller.signal });
        const firstPage = await firstResponse.json() as ProblemSearchResponse;
        if (!firstResponse.ok) throw new Error(firstPage.error || "Could not load available problems.");
        const pages = await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, async (_, index) => {
          const response = await fetch(`/api/problems?page=${index + 2}&pageSize=50`, { cache: "no-store", signal: controller.signal });
          const body = await response.json() as ProblemSearchResponse;
          if (!response.ok) throw new Error(body.error || "Could not load available problems.");
          return body.items;
        }));
        setAvailableProblems([...firstPage.items, ...pages.flat()]);
      } catch (loadError) {
        if (!controller.signal.aborted) setProblemLoadError(loadError instanceof Error ? loadError.message : "Could not load available problems.");
      } finally {
        if (!controller.signal.aborted) setLoadingProblems(false);
      }
    }
    void loadAvailableProblems();
    return () => controller.abort();
  }, []);

  const filteredProblems = useMemo(() => {
    const query = problemSearch.trim().toLocaleLowerCase();
    return availableProblems.filter((problem) =>
      !problems.some((selectedProblem) => selectedProblem.slug === problem.slug) &&
      (!query || problem.title.toLocaleLowerCase().includes(query) || problem.slug.toLocaleLowerCase().includes(query)),
    ).slice(0, 50);
  }, [availableProblems, problemSearch, problems]);

  function addProblem(problem: AvailableProblem) {
    setProblems((current) => current.length >= 150 || current.some((entry) => entry.slug === problem.slug)
      ? current
      : [...current, { slug: problem.slug, title: problem.title, topic: problem.topics[0] || "Uncategorized" }]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!name.trim()) {
      setFormError("Give your playlist a name.");
      return;
    }
    onSave({ name: name.trim(), description: description.trim(), problems });
  }

  return (
    <div className="fixed inset-0 z-[80] grid items-start overflow-y-auto bg-black/70 p-3 pt-24 backdrop-blur-sm sm:px-5 sm:pb-5 sm:pt-24" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="playlist-editor-title" className="flex max-h-[calc(100dvh-8rem)] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111116] shadow-2xl shadow-black/50 sm:mx-auto sm:max-w-4xl">
        <header className="flex items-center justify-between border-b border-white/10 p-5 sm:px-6">
          <div><p className="text-xs uppercase tracking-wide text-violet-300">Your collection</p><h2 id="playlist-editor-title" className="mt-1 text-xl font-semibold text-white">{playlist ? "Edit playlist" : "Create playlist"}</h2></div>
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/65 hover:bg-white/5 disabled:opacity-40">Close</button>
        </header>
        <div className="problem-panel-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <label className="block text-xs text-white/55">Playlist name
            <input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} required className="mt-1.5 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" placeholder="e.g. Interview prep" />
          </label>
          <label className="block text-xs text-white/55">Description <span className="text-white/30">(optional)</span>
            <textarea maxLength={300} value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="mt-1.5 w-full resize-y rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" placeholder="What are you practicing?" />
          </label>
          <section aria-labelledby="playlist-problems-title">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div><h3 id="playlist-problems-title" className="text-sm font-medium text-white">Problems</h3><p className="mt-1 text-xs text-white/40">Search and select problems available on YexCode. {problems.length}/150 selected.</p></div>
            </div>
            <label className="block text-xs text-white/55">Search problems
              <input value={problemSearch} onChange={(event) => setProblemSearch(event.target.value)} className="mt-1.5 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400/60" placeholder="Search by problem name" />
            </label>
            <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-black/25">
              {loadingProblems ? <p className="p-4 text-xs text-white/45">Loading available problems…</p> : problemLoadError ? <p role="alert" className="p-4 text-xs text-rose-200">{problemLoadError}</p> : filteredProblems.length === 0 ? <p className="p-4 text-xs text-white/45">{problemSearch ? "No matching problems available." : "All matching problems have been selected."}</p> : filteredProblems.map((problem) => (
                <button key={problem.slug} type="button" onClick={() => addProblem(problem)} disabled={problems.length >= 150} className="flex w-full items-center justify-between gap-3 border-b border-white/[0.06] px-3 py-2.5 text-left last:border-b-0 hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-40">
                  <span className="min-w-0"><span className="block truncate text-xs font-medium text-white">{problem.title}</span><span className="mt-0.5 block text-[10px] text-white/40">{problem.difficulty}</span></span>
                  <span className="shrink-0 text-xs text-violet-300">Add</span>
                </button>
              ))}
            </div>
            <ul className="mt-3 space-y-2">
              {problems.map((problem) => <li key={problem.slug} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
                <span className="min-w-0"><span className="block truncate text-xs font-medium text-white">{problem.title}</span></span>
                <button type="button" onClick={() => setProblems((current) => current.filter((entry) => entry.slug !== problem.slug))} aria-label={`Remove ${problem.title}`} className="shrink-0 rounded px-2 py-1 text-xs text-rose-200/70 hover:bg-rose-300/10 hover:text-rose-100">Remove</button>
              </li>)}
            </ul>
            {problems.length === 0 && <p className="mt-3 rounded-lg border border-dashed border-white/10 p-5 text-center text-xs text-white/40">No problems selected yet.</p>}
          </section>
          {formError && <p role="alert" className="text-sm text-rose-200">{formError}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-white/10 p-4 sm:px-6">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-md border border-white/10 px-4 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-40">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50">{saving ? "Saving…" : playlist ? "Save changes" : "Create playlist"}</button>
        </footer>
      </form>
    </div>
  );
}
