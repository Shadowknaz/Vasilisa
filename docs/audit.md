# Technical Audit — Vasilisa PS1 Diorama

**Audit date:** 25 October 2026  
**Scope:** architecture, runtime lifecycle, input and movement, rendering, deterministic world generation, interiors, RAG tooling, tests, documentation, and dependencies.  
**Change policy:** read-only audit. No source, configuration, generated index, or build output was changed. This report replaces the previous `docs/audit.md` in full.

## 1. Executive summary

The main diorama is in good structural condition. The composition root is explicit, runtime state is divided into focused factories, rendering uses a shared atmosphere contract, and world geometry is derived from a validated deterministic plan. TypeScript, all layout checks, the RAG smoke test, the small default RAG evaluation, and the exercised browser render checks pass.

The project is not yet a clean release candidate from a tooling and regression-prevention perspective:

- the locked Vite development chain has high- and moderate-severity advisories;
- filtered RAG retrieval has a confirmed scoring/indexing defect;
- evaluation against the real repository index fails one of three cases;
- application teardown does not fully release scene, overlay, and debug UI resources;
- several important runtime and visual checks report measurements but do not act as automated regression gates.

No critical defect was confirmed in the main isometric/first-person render path during this audit. The highest-priority issues are in development security and RAG correctness, followed by lifecycle completeness and automated coverage.

### Severity overview

| Severity | Count | Areas |
|---|---:|---|
| High | 1 | Vulnerable development dependency chain |
| Medium | 4 | RAG filtering, real-index retrieval quality, teardown, missing regression gates |
| Low | 6 | One-shot input, blocked-motion animation, snapshot validation, type safety, dead API surface, documentation/tooling drift |

## 2. Verification results

| Check | Result | Evidence / notes |
|---|---|---|
| `npm run typecheck` | Pass | TypeScript 5.9.3 from the lockfile; strict checking, unused locals/parameters, no emit. |
| `npm run plan-check` | Pass | 2,197 checks, 0 errors, 58 rules. Hash `2b386684`, seed `108`, generator `2.1.0`; second planner run is identical. |
| `npm run rag-check` | Pass | Two-chunk smoke test; top score `0.427`. |
| `npm run rag:eval` | Pass, limited scope | 3/3 cases pass against three small in-memory documents, not the repository index. |
| `npx --no-install tsx scripts/rag-eval.ts docs/rag-eval.json --index .rag/index.json` | **Fail** | 2/3 cases pass. `overview` lacks required term `диорама`; three citations are returned but are not relevant enough. |
| `npx --no-install knip` | **Fail** | Four unused exports and four unused exported types, all in `src/rag/`. |
| `npm audit --json` | **Fail** | Vite is reported high severity; its nested esbuild is moderate. No critical advisory was reported. |
| Browser frame probe, `?snow=off` | Pass for measured pose | 458×256 buffer; mean `0.031`, p50 `9`, p95 `13`, p99 `30`; within the configured night-luma band. |
| Static-frame diff, 500 ms | Pass for measured pose | 16 changed pixels, reported share `0.0001` (about 0.01%), zero bright changed pixels. |
| Browser `?perf` sample | Informational | 84.5 fps, 596 scene draw calls, 136,260 triangles at 458×256 in the headless environment. This is not a portable hardware benchmark. |
| `npm run build` | Not run | It writes `dist/`, which would violate the read-only constraint. Type checking was run separately; the current production bundle was not regenerated. |

There is no Git repository metadata in the workspace, so `git status` could not be used to audit pre-existing changes.

## 3. Findings

### F-01 — High — Locked Vite development chain has known security advisories

**Evidence**

- `package-lock.json` resolves Vite to `5.4.21` and Vite's nested esbuild to `0.21.5`.
- `npm audit --json` reports Vite as **high** severity and nested esbuild as **moderate** severity.
- Vite advisories include development-server file-serving/path handling and Windows-specific issues. The esbuild advisory concerns cross-origin access to the development server.

**Impact**

The primary exposure is a developer running `npm run dev`, especially if the server is exposed beyond a trusted local interface or a developer visits an untrusted page while it is running. These findings do not by themselves demonstrate a vulnerability in the static production diorama bundle.

**Recommendation**

Upgrade Vite and its transitive esbuild to a supported patched release, update the lockfile through the normal dependency workflow, and rerun typecheck, production build, browser smoke tests, and `npm audit`. Treat the audit-suggested major upgrade as a compatibility task, not a drop-in change. Until then, keep the development server local and do not expose it to untrusted networks.

### F-02 — Medium — Filtering changes RAG result identity for BM25 cache lookup

**Evidence**

In `src/rag/vectorStore.ts`, `search()` first filters `this.entries` and then uses the **filtered array index** to read `this.cache[index]`:

- filtering occurs around lines 104–105;
- the new `map()` index is introduced at line 106;
- that index is used against the unfiltered cache at line 109.

Once an earlier entry is excluded, subsequent chunks receive another chunk's BM25 term-frequency data.

**Reproduction**

A focused in-memory probe compared a filtered three-document store with an isolated store containing only the two accepted documents:

- filtered ranking: `c:0` then `b:0`;
- equivalent isolated ranking: `b:0` then `c:0`.

The scores also differed substantially. This is an incorrect-result defect, not merely a scoring-tuning difference.

**Impact**

`npm run rag:query -- --type documentation|source` can return incorrectly ranked results. A wrong cache entry can reduce or increase a chunk's BM25 contribution and change top-K membership.

**Recommendation**

Preserve each entry's original index through filtering, or compute scores before applying the chunk filter. Add a regression test where at least one preceding entry is excluded and filtered scores are compared with an isolated equivalent store.

### F-03 — Medium — Real-index RAG evaluation fails while the default quality check stays green

**Evidence**

- `npm run rag:eval` passes 3/3, but `scripts/rag-eval.ts` constructs only three short documents when `--index` is omitted.
- The documented real-index command against `.rag/index.json` fails 2/3.
- The failing `overview` case returns three citations without the required word `диорама`.
- A direct query for `Что представляет собой проект?` ranks walker gait and reference-port excerpts above a useful project overview.

**Impact**

The default green result does not establish retrieval quality on the actual documentation and source corpus. Broad project-level questions can produce excerpts that are technically from the repository but do not answer the question.

**Recommendation**

Make real-index evaluation the required quality gate and keep the small in-memory suite only as a smoke test. Add expected-document/recall assertions rather than relying only on answer-substring checks. Review chunk boundaries, title weighting, broad-query ranking, and near-duplicate chunks. This failure occurs without a metadata filter, so it is independent of F-02.

### F-04 — Medium — Teardown is incomplete and retains resources/UI

**Evidence**

- `src/main.ts` stops the loop and input, disposes several subsystems, and deletes global handles, but does not dispose the world, mech, or player geometry/material trees.
- `src/core/stage.ts` calls only `renderer.dispose()`; this is not a scene-graph disposal traversal.
- `src/core/glow.ts` keeps every registered overlay in a module-level `glowObjects` array with no unregister/reset operation. Old objects therefore remain strongly referenced and are still traversed by later `setGlowVisible()` calls.
- `mountDebugPanel()`, `mountErrorOverlay()`, and `createFrameMeter()` append DOM elements, but the main teardown removes none of them.
- The cleanup path does not explicitly release pointer lock owned by the canvas.

**Impact**

Calling `window.__DIORAMA_CLEANUP__()` in a long-lived page, repeatedly mounting the application, or exercising development disposal can retain JavaScript objects, DOM nodes, and GPU-backed resources. The global glow registry additionally grows across repeated scene construction.

**Recommendation**

Define clear ownership and an idempotent teardown contract. Dispose scene-owned geometries/materials/textures without double-disposing shared assets, unregister glow objects, remove debug/performance/error DOM nodes, release pointer lock when owned, and test repeated mount/cleanup cycles with renderer memory and DOM counts.

### F-05 — Medium — Important acceptance checks are observational, not regression gates

**Evidence**

- There is no unit-test runner, test script, test file set, or CI configuration in the workspace.
- `scripts/frame-stats.mjs` prints luminance and diff measurements but does not fail when they leave the configured acceptance band.
- Its Chrome process is not protected by `try/finally`; failures can leave a browser process behind. A fixed CDP port/profile also makes concurrent runs fragile.
- Layout validation is strong, but it does not exercise keyboard repeat behavior, actual controller displacement, teardown, or render lifecycle.
- The RAG default evaluation uses a toy corpus, and the filtered-search defect is not covered.

**Impact**

Regressions can survive all default green commands. Browser acceptance depends on a person interpreting output, and long-term lifecycle problems are unlikely to be caught by static checks.

**Recommendation**

Add focused unit tests for RAG indexing/filtering, input edge behavior, collision and controller displacement, and resource cleanup. Make the browser harness assert luma/diff thresholds and return a nonzero exit code on failure. Add reliable process cleanup and isolated ports/profiles. Run typecheck, plan validation, real-index RAG evaluation, unit tests, production build, and browser smoke tests in CI.

### F-06 — Low — One-shot keyboard actions are not edge-triggered

**Evidence**

`src/systems/input.ts` handles action, orbit, overview, and night keys on every `keydown` and never checks `event.repeat`.

**Impact**

Holding `N` or `O` can repeatedly toggle state and produce visible flicker/oscillation. Holding an action key can request another transition after the current transition completes. Repeated `Q`/`R` steps may be intentional, but they are not distinguished from one-shot commands.

**Recommendation**

Ignore repeated keydown events for one-shot actions and toggles. Keep movement keys level-triggered. Add tests for initial press, auto-repeat, keyup, blur, and transition-state handling.

### F-07 — Low — Animation and effects use requested motion rather than actual displacement

**Evidence**

- `src/systems/mechController.ts` advances `walkCycle`, gait, dust, and snow tracks whenever movement input is present, even if both collision-tested position updates fail.
- `src/systems/pilotController.ts` advances gait and `walkCycle` based on input, independently of whether either axis move succeeds.

**Impact**

Against a wall or the mech clearance boundary, characters can animate as if walking and the mech can emit repeated footstep effects/tracks while stationary. This weakens movement feedback and can overwrite the fixed track ring with duplicates from one position.

**Recommendation**

Measure accepted displacement after collision resolution and derive locomotion/effects from it. Preserve deliberate turn-in-place behavior separately if desired. Add a blocked-wall regression test.

### F-08 — Low — RAG snapshots lack freshness and compatibility metadata

**Evidence**

`VectorStoreSnapshot` contains only `dimensions` and `entries`. `RagPipeline.loadSnapshot()` accepts it without schema, source-revision, chunking-configuration, embedding-version, or document-fingerprint validation.

**Impact**

A stale or incompatible `.rag/index.json` can be queried without warning. A malformed snapshot fails later and less clearly. This audit does not claim that snapshot staleness caused F-03; the absence of freshness evidence is itself the problem.

**Recommendation**

Add a snapshot schema version, source/config fingerprint, generator version, creation metadata, and validation on load. Reject incompatible embeddings and report stale source content explicitly.

### F-09 — Low — Central layout parameters bypass strict typing

**Evidence**

`src/world/layout/footprints.ts` declares `ObjectDescriptor.parameters` and its input as `Record<string, any>`. Consumers then cast individual values, including interior descriptors.

**Impact**

The otherwise strict TypeScript configuration cannot detect misspelled, missing, or incompatible object parameters at this important plan/builder boundary.

**Recommendation**

Use a discriminated `ObjectDescriptor` union keyed by `type`, with typed parameter payloads for buildings, trees, decor, interiors, and other object classes. Preserve runtime layout validation as a separate invariant layer.

### F-10 — Low — Dead or unused RAG API surface remains

**Evidence**

`knip` reports:

- unused exports: `chunkDocument`, `STOP_WORDS`, `stemWord`, `DEFAULT_RAG_CONFIG`;
- unused exported types: `IndexedChunk`, `VectorStoreSnapshot`, `AnswerGenerator`, `RagAnswerOptions`.

`RagConfig.bm25Weight` is also declared but never read; the scoring weights are hard-coded in `vectorStore.ts`.

**Impact**

The private application's supported API surface is unclear, and the unused configuration field suggests tuning that has no effect.

**Recommendation**

Triage these symbols deliberately: keep and test intentional public library APIs, make internal symbols non-exported, and remove or implement `bm25Weight`. Do not delete exports mechanically without confirming the intended RAG consumer contract.

### F-11 — Low — Documentation and diagnostic comments have drifted from the code

**Evidence**

- `README.md` links to `EXPANSION_REPORT.md`, `TZ_DIORAMA_EXPANSION.md`, and `DIORAMA_GENERATION_PRINCIPLES.md`; none exists in `docs/`.
- The README still mentions a mech `SpotLight`, while `src/mech/mechSearchlight.ts` explicitly says it was removed in favor of the shared shader emitter model.
- The README mentions maps of lit windows, while the current facade/decay model uses dead, non-emissive sash states.
- `src/core/shaders/lighting.ts` still describes a ten-lamp budget without the later interior lamps.
- `src/world/layout/createLayout.ts` contains two mojibake fragments: `В§` and `вЂ”`.

**Impact**

Broken links and contradictory rendering documentation make onboarding and future audits less reliable. They also contaminate the documentation corpus used by RAG.

**Recommendation**

Repair or remove dead links, synchronize rendering/decay descriptions with current ownership, update lamp-budget comments, and normalize text encoding. Add a simple Markdown link check.

## 4. Positive technical observations

1. **Clear composition and module boundaries.** `src/main.ts` wires stage, world, rigs, state, input, simulation, and rendering explicitly. The planner, builders, controllers, and render passes have understandable responsibilities.
2. **Strong deterministic plan validation.** The plan is validated before geometry creation, determinism is checked by canonical serialization, and the resulting layout is deeply frozen. The 2,197-check run is substantial and passes.
3. **Consistent atmosphere ownership.** Surface and snow shaders share uniform holders and shader chunks for fog, sky light, practical lamps, and PS1 snapping. The separate sky pass avoids the background-clear conflict.
4. **Thoughtful render-pipeline construction.** The low-resolution target, GPU grade, nearest-neighbor display, and separate first-person viewmodel pass are cohesive and avoid per-frame CPU post-processing.
5. **Allocation-conscious hot paths.** Camera vectors are reused, dust uses a fixed pool, geometry is merged in many builders, and snow tracks use instancing.
6. **Useful diagnostics.** Layout, performance, night exposure, fog, lights, weather, post-process, and vertex-snap switches make visual defects easier to isolate.
7. **No runtime service dependency found in the diorama path.** The main browser application uses local generated assets and Three.js; no secrets or application HTTP/API calls were found in `src/`.

## 5. Performance notes

The sampled default isometric frame reported **596 draw calls** and **136,260 triangles** at a small 458×256 framebuffer. The measured headless run was smooth, so these numbers are not presented as a demonstrated performance failure. They are a baseline worth tracking on low-end/mobile GPUs because draw-call overhead can dominate even when pixel and triangle counts are modest.

Recommended practice is to record draw calls, triangles, frame-time p50/p95, and renderer memory over repeatable camera poses. Treat the existing `?perf` numbers as diagnostics, not cross-machine acceptance thresholds.

## 6. Recommended remediation order

1. **P0 — Development security:** patch Vite/esbuild and verify the development and production workflows.
2. **P1 — Retrieval correctness:** fix filtered BM25 cache indexing; add its regression test; require real-index RAG evaluation and investigate the failing overview case.
3. **P1 — Lifecycle correctness:** complete idempotent scene/UI/glow/pointer-lock teardown and test repeated mount/cleanup cycles.
4. **P2 — Regression enforcement:** turn browser measurements into assertions, add unit/CI coverage, and harden the browser harness process lifecycle.
5. **P2 — Runtime polish:** edge-trigger one-shot keys and derive gait/effects from actual displacement.
6. **P3 — Maintainability:** add snapshot compatibility metadata, typed layout parameter unions, deliberate Knip cleanup, and documentation/link maintenance.

## 7. Audit limitations

- Only the default isometric pose was measured in this run; the complete orbit/overview/first-person/interior visual matrix was not rerun.
- No long-session memory profile, mobile device test, multi-GPU comparison, or adversarial browser security test was performed.
- The production bundle was not rebuilt because doing so would modify `dist/` under the read-only constraint.
- Dependency advisory status is time-sensitive and reflects the audit database response on the audit date.
- The workspace has no Git metadata, so repository history, ignored-file status, and pre-existing working-tree changes could not be assessed.
