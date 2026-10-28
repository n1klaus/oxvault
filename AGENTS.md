# AGENTS.md — 9Router (`9router-app`)

Local AI routing gateway + Next.js dashboard. One OpenAI-compatible endpoint
(`/v1/*`) routes across 40+ upstream providers with format translation,
combo/account fallback, OAuth + token refresh, quota tracking. Plain JS (ESM),
Next 16, React 19. Full guidance: `CLAUDE.md`; engine rules:
`open-sse/AGENTS.md` (read before touching `open-sse/`); conventions:
`CONVENTIONS.md`; system design: `ARCHITECTURE.md`.

## Commands

```bash
cp .env.example .env
npm install                                   # root first (src/ needs root deps)
PORT=20128 NEXT_PUBLIC_BASE_URL=http://localhost:20128 npm run dev    # dashboard :20128/dashboard, API :20128/v1
npm run build && PORT=20128 HOSTNAME=0.0.0.0 npm run start            # production
npx eslint .                                  # lint (eslint-config-next)
npm run cli:pack                              # CLI package (cli/ has own package.json/version)
cd tests && npm install                       # tests/ is independent ESM package (node_modules + lockfile gitignored)
tests/node_modules/.bin/vitest run           # all tests; never bare `npx vitest` (host cache = wrong major)
tests/node_modules/.bin/vitest run unit/sttCore.test.js   # single file, path relative to tests/
```

- Default dev port **20128** (`next dev` script defaults 20127 — always set PORT).
- No root `npm test`. Committed `tests/package.json` `test` script hardcodes
  Unix `NODE_PATH` workaround — ignore it, use the vitest binary form above.
- `@/*` → `src/*`, `open-sse` (+ `/`) aliased in **both** `jsconfig.json` and
  `tests/vitest.config.js`. New aliases go in both or tests resolve
  differently from the app. Inside `open-sse/` use relative `./…` only
  (self-contained engine); ESM imports name `.js` explicitly. CJS islands
  (never convert): `cli/`, `src/mitm/**`, `src/lib/mcp/stdioSseBridge.js`.
- Commit style: Conventional Commits (`fix(translator): …`). Root and `cli/`
  versioned independently, logged in `CHANGELOG.md`.

## Architecture (one paragraph)

`/v1/*` → `src/app/api/v1/*` (Next rewrite maps `/v1` → `/api/v1`) →
`src/sse/handlers/chat.js` (parse, combo expansion, account loop) →
`open-sse/handlers/chatCore.js` (format detect, translate, dispatch,
retry/refresh, stream) → `open-sse/executors/*` (upstream call;
`default.js` = any OpenAI-compatible provider) → `open-sse/translator/*`
(client ↔ provider, pivots through OpenAI unless exact `source:target`
direct route registered) → SSE back. `src/sse/` = app glue; `open-sse/` =
standalone engine. Cross consciously.
Deep dives: `ARCHITECTURE.md` (generated graph: functional areas, symbols, flows).

## `open-sse/` rules (hard)

- New translator file MUST be imported in `translator/index.js` (self-registers
  via `register()` side effect) or it's dead code.
- `providers/registry/index.js` is **generated** — never hand-edit; regenerate
  with `node scripts/migrate-registry.mjs`. Add provider = copy
  `REGISTRY_TEMPLATE.js` → `registry/{id}.js` → models in
  `config/providerModels.js` → regenerate. Generic providers need no executor.
- No hardcoded models/roles/block strings — `config/` + `translator/schema/`.
  OpenAI bridge is lossy (thinking, non-base64 images, tool ids, `is_error`) —
  prefer direct routes for fragile pairs. Binary/protobuf upstreams (kiro
  EventStream, cursor protobuf, commandcode NDJSON) live in their executor,
  never the translator.
- RTK (`rtk/`) is **fail-open**: never throw, never grow input, skip
  `is_error` results. `custom-server.js` derives client IP from TCP socket,
  trusts forwarding headers from loopback proxy only — preserve.
- SQLite via `src/lib/db/` only (`localDb.js`/`usageDb.js` are compat shims).
  Driver chain: `better-sqlite3` (optional) → `node:sqlite` → `sql.js`
  fallback. DB at `{DATA_DIR}/db/data.sqlite`; usage/logs stay under
  `~/.9router`, don't follow `DATA_DIR`.

## Tests (baseline gate, not green run)

Vitest excludes `**/.claude/**` (nested worktree copies lack node_modules).
Suite is **not** all-green on checkout (~938 pass / ~64 fail). Judge with
`tests/__baseline__/verify-no-regression.mjs` vs `known-fails.txt` —
regression = failing test NOT in baseline. Expected red: baseline-listed
files, `unit/embeddings.cloud.test.js` (`cloud/` worker dir not in repo),
`unit/xai-oauth-service.test.js` (5s timeout, needs network),
`real/*.real.test.js` + `translator/real/` (live provider creds).
Provider/alias/OAuth snapshot verifiers under `tests/__baseline__/`
(`--snapshot` to regenerate; `ADDED_FIELDS` for intentional refactors —
baseline changes need a reviewer, never edit output to hide failures).

<!-- ══════════════════════════════════════════════════════════════════════════
     TOOLS — one self-contained section per tool.

     Keep every tool in its own `## Tools — <name>` section with a stable
     heading: `dev` and `testing` carry different tool sets, and per-section
     isolation keeps their diffs scoped to the tool that actually changed.
     Do not merge tools into shared prose paragraphs or tables.
     ══════════════════════════════════════════════════════════════════════════ -->

## Tools — index

| Section               | Use for                                       |
| --------------------- | --------------------------------------------- |
| CodeGraph             | Source exploration, symbol source, callers    |
| GitNexus              | Blast radius, change detection, renames       |
| Context7              | Live library/framework documentation          |
| shell + RTK           | Simple commands: `rtk` first, bash fallback   |
| context-mode          | Active: batch, sandbox, file analysis, search |
| Tavily search         | Current facts from the open web               |
| web_search / webfetch | Quick lookups and single-page reads           |

Calls below are direct tool calls. Graph/doc tools may also be reachable as
`xd://mcp__<server>_<tool>` devices depending on the host — same JSON args.

## Tools — CodeGraph

Project is indexed by CodeGraph. Use it for **source code**; `read`/`grep`/`glob`
are for non-code files only (markdown, JSON, configs, lockfiles — Vite/Next
configs are not parsed).

| Task                               | Tool                | Key arg                   |
| ---------------------------------- | ------------------- | ------------------------- |
| "How does X work?" / tracing a bug | `codegraph_explore` | `query`                   |
| Reading a file region              | `codegraph_node`    | `file`, `offset`, `limit` |
| "What calls this?"                 | `codegraph_callers` | `symbol`                  |
| "What is this symbol?"             | `codegraph_search`  | `query`                   |

- `codegraph_node` with `symbol` returns verbatim source (`includeCode: true`)
  plus the caller/callee trail — run it BEFORE editing any symbol you can name.
- Index auto-syncs via file watcher; no manual refresh needed.

## Tools — GitNexus

Call-graph and impact analysis. Secondary to CodeGraph, primary for blast radius.

| Task                         | Tool                      | Key arg                   |
| ---------------------------- | ------------------------- | ------------------------- |
| Blast radius before edits    | `gitnexus_impact`         | `target`, `direction`     |
| Verify changes before commit | `gitnexus_detect_changes` | `scope` (`or base_ref`)   |
| Execution flows by concept   | `gitnexus_query`          | `query`                   |
| Full 360° symbol context     | `gitnexus_context`        | `name`                    |
| Safe symbol rename           | `gitnexus_rename`         | `symbol_name`, `new_name` |

- `risk: UNKNOWN` means unresolved — confirm with a text search before editing.
- Never find-and-replace a rename; use `gitnexus_rename` (dry run first).
- Index lives at `.gitnexus/` — if stale, run `node .gitnexus/run.cjs analyze`
  from the project root.

## Tools — Context7

Live library documentation — preferred over web search for API surfaces of
React, Next.js, Prisma, Express, Tailwind, and 200+ others. Two steps:

1. `context7_search` — resolve a package name to a library ID.
2. `context7_get_docs` — query docs for that ID.

Use when syntax/signatures/migration details may postdate training data. Do not
use it for project-internal code (CodeGraph) or general news (Tavily).

## Tools — shell + RTK (default)

Posture: **`rtk` first, plain bash as fallback.** `rtk` is a token-optimizing
output proxy at `~/.local/bin/rtk` — the same command with compacted output,
not a replacement for the command itself. Run every simple command through it;
when it fails, drop the prefix and run the command as-is.

```bash
rtk ls open-sse/handlers          # compact listing
rtk tree src/app -L 2            # compact tree
rtk read src/sse/handlers/chat.js --range 1,80   # filtered read
rtk grep "register(" open-sse/translator   # compact grep
rtk rg "translateRequest" -t js  # compact ripgrep
rtk find -name "*.test.js" -type f
rtk git status / rtk git diff / rtk git log --oneline -20
rtk diff                          # only changed lines
rtk json package.json --keys-only # compact JSON views
rtk err npm run build             # errors/warnings only
rtk test tests/node_modules/.bin/vitest run unit/sttCore.test.js   # failures only
rtk log app.log                   # deduped log view
rtk summary <cmd>                 # 2-line heuristic summary
rtk deps                          # dependency overview
```

Pick the cheapest rung that answers the question:

1. **`rtk <cmd>` first** — always try the rtk form for a simple command
   (`git`, `ls`/`tree`, `grep`/`rg`, `find`, `read`, `diff`, `json`, `err`,
   `test`, `log`, `summary`, `deps`).
2. **Plain shell on failure** — if `rtk` errors, is missing, or mangles the
   command (unknown subcommand, flag not passed through, empty output where
   output is expected), re-run the exact same command **without** the prefix.
   The fallback is the answer; do not debug rtk mid-task, do not retry twice.
3. **context-mode** — when the task is not a simple command: multi-command
   research, file analysis, web ingest, or anything that must stay searchable.
   Follow the hierarchy in the next section.

Do not wrap a two-line `git` query in `ctx_execute` — that is rtk's job. Do not
pipe a 5,000-line build log through plain shell either — that is context-mode's.

> Not to be confused with `open-sse/rtk/`, the in-app request token-killer
> described in the `open-sse/` rules below. Same name, unrelated code.

## Tools — context-mode (active)

Active. For anything beyond a simple command, prefer context-mode over raw
reads: the bytes stay in the sandbox and only stdout enters context.
**Program the analysis, do not read it into context** — derive with code,
`console.log()` only the answer.

**Hierarchy — pick the highest tool that fits:**

`ctx_batch_execute` > `ctx_execute` > `ctx_execute_file` > `ctx_search`

| Situation                                | Tool                                              |
| ---------------------------------------- | ------------------------------------------------- |
| Multi-command research (3+ commands)     | `ctx_batch_execute(commands, queries)`            |
| Derive / count / filter / aggregate data | `ctx_execute(language, code)`                     |
| Read a file for analysis                 | `ctx_execute_file(path, language, code)`          |
| Query already-indexed content            | `ctx_search(queries, source?)`                    |
| Fetch a web page                         | `ctx_fetch_and_index(url, source)` → `ctx_search` |
| Store docs/specs for later               | `ctx_index(content, source)`                      |
| Health / counters / cleanup              | `ctx_stats`, `ctx_doctor`, `ctx_purge`            |

`ctx_execute_file` analyzes a file; it cannot write back — actual edits still go
through the `edit`/`write` tools.

Rules:

- Reading to **edit** is fine; reading to **analyze** goes through the sandbox.
- Batch questions: `ctx_search(queries: ["q1", "q2"])` — one call, one throttle slot.
- I/O-bound batches: pass `concurrency: 4-8`. Keep `concurrency: 1` for
  CPU-bound (`npm test`, build, lint) or shared-state commands (ports, lockfiles).
  Cap `gh` calls at 4.
- Write artifacts to files and return path + one-line description, never inline.

## Tools — Tavily search

`tavily_search(query)` — real-time web answers with source URLs. Use it for
current versions, release notes, changelogs, and anything that may have changed
since training. Not for library API syntax (Context7) or project code (CodeGraph).
Pair with `ctx_fetch_and_index` when a result page needs reading at length.

## Tools — web_search / webfetch

`web_search` for URL discovery across the open web; `webfetch` for a single
known page. Prefer `webfetch` → `ctx_fetch_and_index` when the page is large or
you will query it more than once — the raw bytes never enter context.

## Tools — disabled servers

`gh_grep`, `hindsight`, `sequentialthinking`, `playwright` are configured but
**disabled** — do not rely on them. Enable deliberately in `.opencode/opencode.json`
or `.omp/mcp.json` first, and keep both files in sync.
