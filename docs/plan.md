# YexCode Plan

## Product direction

YexCode is a LeetCode-like coding practice platform. Users browse a problem, write a solution, run visible examples, submit against the complete suite, and review useful results.

YexCode owns the web app, problem content, accounts, and progress. YexJudge owns validation, queueing, compilation, sandboxing, execution, and verdict generation. Keep the repositories separate; change YexJudge only when a measured API or execution requirement cannot be handled in YexCode.

## Product rules

The problem list shows problem name, difficulty, and the logged-in user's progress. It supports title search and Solved, Attempted, and Unattempted filters, but intentionally does not expose topic filters. Topics are optional, multi-valued hints revealed only on the problem page; revealing them never reveals hidden tests. Do not restore category-based navigation.

A problem is solved only after Submit passes the complete test suite. Run never marks a problem solved. A profile lists each problem once: any accepted submission makes it **Solved**; otherwise, any Submit attempt makes it **Attempted**.

## Implemented foundation

The core practice flow is implemented: versioned problem content, examples-only Run, complete-suite Submit, asynchronous judge polling, request validation, device-local editor drafts, accounts, submissions, history, and profile progress. Problem data migration and seeding commands are available. YexJudge supports C, C++, and Python stdin/stdout execution plus C++ and Python Function/Class Mode. YexCode problem Run/Submit supports C++ and Python Function/Class Mode; the standalone stdin/stdout workspace supports C, C++, and Python.

For the implemented schema, judge flow, draft behavior, and setup, see [Problem data and YexJudge integration](integration.md) and [Local setup](setup.md). The `/workspace` page supports custom caller-provided tests without running hidden tests or affecting submission progress.

## Request flow

The browser calls YexCode and never knows the YexJudge host. It does not provide authoritative Submit test cases.

- **Problem page:** loads the statement, visible examples, topics, companies, hints, templates, and execution metadata from YexCode; Python starter code is generated from function or class metadata when a Python template is absent.
- **Run:** sends `{ slug, language, sourceCode }`; YexCode loads visible examples and sends only those to YexJudge.
- **Submit:** sends `{ slug, language, sourceCode }`; YexCode loads visible and hidden tests server-side, resolves the authenticated user, persists the attempt, and sends the complete suite to YexJudge.
- **Workspace runs:** accept caller-provided stdin/stdout test cases only; they do not load problem data, create Submit records, or affect progress.

## Active roadmap

### Feature 1 — Language and editor experience (complete)

The problem editor and server request flow support C++ and Python Function and Class Mode; each problem's stored contract selects its mode automatically, with separate device-local drafts and language-specific editor highlighting. The standalone stdin/stdout workspace supports C, C++, and Python. Device-local drafts, clear-draft control, and custom stdin/stdout runs are implemented.

### Feature 2 — Playlists (complete)

Renamed **For You** to **Playlists**. The page provides three curated sets—Blind 75, Blind 150, and Top 30 Interview Problems—plus company-wise interview lists generated from the `leetcode-companywise-interview-questions` CSV snapshot. It supports creating, editing, and deleting personal playlists with a searchable picker of available problems. Curated lists are grouped by topic; personal and company lists are flat. Users manually check problems off independently in each playlist, with progress saved per user. Problem titles link to YexCode and the LeetCode icon links to the matching LeetCode problem.

### Feature 3 — UI overhaul (complete)

Applied a consistent dark visual system, shared surface and control styles, clearer navigation and active-page states, and responsive layouts across the non-hero experience: problem discovery and details, coding workspace, playlists, profile, and authentication. The landing hero remains unchanged for Feature 4.

### Feature 4 — Production-ready hero page

Build a polished production landing page that clearly communicates YexCode's value, guides new visitors to sign up or start practicing, and works well across screen sizes.

## Production readiness

- [ ] **Production-safe problem fixtures:** Before deployment, move reference solutions out of production artifacts, remove stored reference solutions from the production database, and verify production imports cannot restore them. The `NODE_ENV=production` script guard is a safeguard, not a replacement for cleanup.

## Ongoing problem quality

The hidden-case coverage audit for all existing problems is complete. Continue reviewing hidden-case coverage whenever a problem is added or edited; automated shape validation is not proof of test quality. The YCProblems `/add-problem` workflow requires this review.

Implementation details for the completed judge contract, problem authoring workflow, and discovery features are in [feature implementation notes](feature-implementation-notes.md). Discussions/editorials, analytics, and leaderboards/contests are future possibilities, not scheduled roadmap work.

## Remaining acceptance criteria

1. If editorial/discussion features are pursued, enforce content review, ownership, and abuse controls before publication.

## Decisions to make later

- Whether hidden failed inputs should always be shown verbatim or redacted for selected problem types.
- Whether problem content should live only in Atlas or also be versioned in Git and imported; fixtures are currently versioned in Git and seeded into MongoDB.
- What social, ranking, and recommendation features are wanted beyond the practice loop.
