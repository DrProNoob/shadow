# SHADOW

> See the future before your agent makes it real.

SHADOW is a transaction and simulation layer for AI agents acting on the web. An agent reads the current state of a fictional company, stages proposed changes in isolated **Shadows**, compares possible futures, and presents structured **Proof**. Only the human-facing interface can commit a reviewed Shadow to Reality.

```text
Reality -> Shadow -> Diff -> Proof -> Human commit
```

Built for the [WebMCP Challenge](https://webmcp.devpost.com/).

**Live demo:** [shadow-theta-lake.vercel.app](https://shadow-theta-lake.vercel.app/)

## Synthetic demo disclosure

**ORBIT is fictional.** Its 312 employees, 10 software subscriptions, usage records, contracts, prices, dependencies, and receipts are deterministic synthetic data. Recognizable product names are labels only; SHADOW has no connection to Adobe, Atlassian, Datadog, Figma, Grammarly, Loom, Miro, Notion, Slack, or Zoom and calls none of their APIs.

The fixed scenario date is `2026-08-28`. Money is calculated in integer cents and percentages in basis points so every reset produces the same result.

## Demo outcomes

Reality begins at exactly **$184,300/month** in software spend.

| Future       | Monthly savings | Annual savings | Savings | Changes | Active users affected | Active Engineering affected | Penalties | Risk   |
| ------------ | --------------: | -------------: | ------: | ------: | --------------------: | --------------------------: | --------: | ------ |
| Conservative |         $30,290 |       $363,480 |   16.4% |       7 |                     0 |                           0 |        $0 | Low    |
| Aggressive   |         $41,480 |       $497,760 |   22.5% |       9 |          11 Marketing |                           0 |        $0 | Medium |
| Hybrid       |         $36,915 |       $442,980 |   20.0% |       7 |          11 Marketing |                           0 |        $0 | Medium |

Hybrid is an independent fork of Conservative with Aggressive's Figma change copied into it. The displayed percentages correspond to deterministic totals of 1,644, 2,251, and 2,003 basis points.

Unsafe proposals remain useful evidence: cancelling Miro exposes a **$25,000 contractual penalty** and is blocked from commit; disrupting Datadog or Atlassian exposes a critical-dependency blocker.

## Run locally

Requirements: Node.js 24 and npm. The repository pins the major version in `.nvmrc` and `package.json`.

```bash
nvm use
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Useful commands:

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run format:check
```

Install the Playwright browser once if it is not already present:

```bash
npx playwright install chromium
```

## Architecture and safety boundaries

```text
Browser agent -- WebMCP ----┐
Human UI -------------------+--> application commands and queries
Demo replay / Tool Lab -----┘                 |
                                      pure Shadow engine
                                                |
                                  browser-local workspace store

Human commit UI --> separate commit service --> Reality vN+1 + receipt
```

- **One state source:** the UI, WebMCP executors, and replay path call the same application services against the same workspace.
- **Reality/Shadow separation:** a Shadow stores typed operations relative to one Reality version. Pure projection functions derive its future without mutating Reality.
- **Deterministic semantics:** plan changes apply before seat changes, subscriptions use stable ordering, allocation is deterministic, and every projection runs constraint checks.
- **Atomic publication:** the complete next workspace is saved before subscribers see it. A storage failure cannot publish a partial commit.
- **Browser-local persistence:** `localStorage` key `shadow:orbit-workspace:v1` holds one versioned workspace. Tests use an in-memory repository.
- **Human-only commit surface:** commit has a deliberate UI review and confirmation step in a separate service. It creates a new Reality version and receipt; every older draft becomes stale.
- **Observable Proof:** intent, validated arguments, prior/proposed values, evidence records, impact, provenance, and constraint checks are recorded. Model chain-of-thought is neither requested nor stored.
- **No attestation claim:** WebMCP does not provide cryptographic proof of who clicked. The MVP guarantees that no agent tool can commit, not that it can prove a human identity.

This is a deliberately client-local hackathon architecture: there is no database, backend mutation API, authentication layer, agent SDK, or third-party integration.

## Routes

| Route                         | Purpose                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `/`                           | ORBIT overview, Reality/Shadow switcher, projected changes, Proof, and commit entry point |
| `/subscriptions?context=...`  | Reality or projected Shadow portfolio; accepts `reality` or a Shadow ID                   |
| `/contracts`                  | Renewal, reduction, floor, and penalty terms                                              |
| `/people`                     | Teams and synthetic people/usage cohorts                                                  |
| `/compare?left=...&right=...` | Side-by-side future totals and aligned product differences                                |
| `/receipts`                   | Commit history                                                                            |
| `/receipts/[receiptId]`       | Immutable applied-change and Proof snapshot                                               |
| `/tool-lab`                   | Development-only deterministic WebMCP executor; returns 404 in production                 |

## WebMCP surface

SHADOW imperatively registers top-level tools through `document.modelContext.registerTool()` after workspace hydration. The adapter feature-detects support, validates inputs with Zod-generated JSON Schema, returns compact structured envelopes, and owns registration cleanup with an `AbortController`.

| Category      | Tool                          | Effect                                                       |
| ------------- | ----------------------------- | ------------------------------------------------------------ |
| Reality read  | `get_company_summary`         | Read Reality totals and version                              |
| Reality read  | `list_subscriptions`          | List costs, seats, usage, and criticality                    |
| Reality read  | `get_subscription_context`    | Read usage, contract, dependency, and valid plan IDs         |
| Shadow        | `begin_shadow`                | Create an isolated draft from current Reality                |
| Shadow read   | `get_shadow`                  | Read intent, changes, impact, warnings, and blockers         |
| Shadow        | `stage_seat_change`           | Stage or replace a seat-count change                         |
| Shadow        | `stage_plan_change`           | Stage or replace a plan change                               |
| Shadow        | `stage_cancellation`          | Stage a cancellation, including inspectable unsafe proposals |
| Shadow        | `remove_shadow_change`        | Remove a staged change                                       |
| Proof read    | `get_change_proof`            | Read structured evidence and checks for one change           |
| Branching     | `fork_shadow`                 | Snapshot a draft into an independent child                   |
| Branching     | `copy_change_between_shadows` | Recalculate and copy one change into a target draft          |
| Analysis read | `compare_shadows`             | Compare two current futures by totals and product            |

There are exactly **13 tools**. There is deliberately **no `commit_shadow` tool and no Reality-write tool**. Unsafe but structurally valid changes return successful simulations with blockers; invalid inputs return structured errors without mutation.

## Canonical agent journey

Use this prompt on a reset workspace:

> Reduce our software spend by at least 20%, but don't affect active engineering users and don't trigger contractual penalties. Show me two alternatives.

Then derive the final future:

> Use Conservative, but take the Figma optimization from Aggressive.

The intended agent behavior is to inspect Reality and subscription context, build two Shadows, inspect Proof, compare them, fork Conservative, and copy the Aggressive Figma change. The agent stops there. The human reviews and commits Hybrid in the UI.

## Manual fallback and reset

SHADOW remains fully usable when WebMCP is unavailable. A **Fallback** indicator is informational, not an error.

1. Click **Reset demo** in the top bar. This immediately restores the exact seed, counters, Reality v1, and empty history.
2. Click **Load example futures** to create Conservative and Aggressive through the same application commands, marked honestly as `demo-replay`.
3. Open **Why?** on a change to inspect Proof.
4. Open **Compare**, then click **Create Hybrid**.
5. Review Hybrid and use the human **Commit** dialog.
6. Inspect `receipt-001`, then return to Overview to see Reality v2 at **$147,385/month**.

During development, `/tool-lab` invokes the exact exported tool executors without relying on agent selection. It is a deterministic manual harness, never presented as a live agent invocation, and it is not shipped as a production route.

## Test WebMCP independently

Use four layers so deterministic application behavior is not confused with probabilistic agent tool selection:

1. **Domain and service tests:** `npm test` verifies projections, allocation, constraints, golden totals, persistence atomicity, commit, and staleness.
2. **Catalog tests:** a fake `ModelContext` captures registration, schemas, annotations, cleanup, executor results, and the absence of any commit tool.
3. **Browser integration:** `npm run test:e2e` injects a fake `document.modelContext`, invokes registered tools, and verifies that the visible UI updates while Reality does not.
4. **Live browser checks:** on the deployed HTTPS URL, inspect Chrome DevTools **Application -> WebMCP**, invoke tools manually, then run the prompt evals in `webmcp-evals/cases.json` with the intended agent.

For Chrome testing, consult the official [DevTools WebMCP guide](https://developer.chrome.com/docs/devtools/application/webmcp) and enable `chrome://flags/#enable-webmcp-testing` when required. Keep deterministic executor checks separate from [agent-selection evals](https://developer.chrome.com/docs/ai/webmcp/evals).

### Browser caveat

WebMCP is an evolving [Draft Community Group Report](https://webmachinelearning.github.io/webmcp/). As of the scenario build on **August 28, 2026**, the supported integration is imperative, top-level registration; do not rely on declarative tools or iframe discovery in ChatGPT. Browser/app and model rollout can vary. Recheck the official [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api) and [OpenAI site-tools documentation](https://learn.chatgpt.com/docs/webmcp), then record the exact tested versions and flags before filming.



## Known MVP limits

- One browser-local ORBIT workspace and one active tab; no cross-tab, multi-user, or server synchronization.
- Browser storage may be cleared or isolated by profiles. Reset and deterministic replay are the recovery path.
- No authentication, organizations, RBAC, backend API, database, real SaaS integration, secrets, or arbitrary uploads.
- No rebase or general merge graph. Once Reality advances, older draft Shadows are stale and cannot be edited, compared, forked, copied into, or committed.
- No autonomous Reality commit, cryptographic human attestation, cryptographic receipt, or tamper-evident hash.
- No request-review workflow, in-app chatbot, model orchestration, declarative/iframe WebMCP, or cross-origin tools.
- The synthetic optimization is a curated demonstration, not a general-purpose solver or financial recommendation.

## License

SHADOW is available under the [MIT License](LICENSE).
