# Eliza A2A Prototype (BNY × Goldman Sachs × AllianzGI)

*Illustrative prototype. Firm names are used to make the scenario concrete; all records are synthetic and no real event is depicted.*

A working simulation of a cross-firm agent-to-agent (A2A) interaction in post-trade operations, inside BNY's Eliza workspace. Goldman Sachs' delivery of 10,000 NVDA was rejected by BNY because AllianzGI, BNY's client, raised the trade from 8,000 overnight but its corrected instruction never reached BNY. Goldman's agent asks BNY's agent why. BNY's Settlement Ops Agent finds that the client's side differs and hands the case to Client Service. Client Service approves an email to the client, and Goldman's agent is told to hold; the client is outside the network, so this part is manual, and it is where time is lost. BNY's agent keeps Goldman informed with a fix time, the client re-instructs, Goldman redelivers, and DTC settles.

Every cross-firm message passes BNY's gateway. Every agent finding cites a source record. Every model call is metered against a hard $0.20-per-case cap.

## Setup

```sh
npm install
cp .env.example .env.local      # DEMO_MODE=replay works with no key
npm run dev                     # http://localhost:3000
```

`npm run dev` first runs `scripts/check-setup.ts`. It stops with a clear message if any `/data` file is missing, or if `DEMO_MODE=live` is set without a key and prices; a missing `.env.local` is only a warning, since every setting has a default (replay, no key). The layout shows the same problems on screen.

### Deploying (Vercel)

No `.env.local` is needed: set any variables in the project's Environment Variables (none are required for replay; `OPENAI_API_KEY` and the two `MODEL_*_USD_PER_1M` prices enable Live and model-answered questions). `next.config.ts` ships `data/` and `runs/*.json` with every server route, since they are read from disk at runtime. The file system is read-only there, so finished live runs aren't saved as recordings. Runs live in server memory: if the host spreads one viewer's requests over several instances, a case can be lost mid-way and the prototype starts a fresh one.

### Modes

| Mode | What happens |
|---|---|
| `replay` (default) | Plays a recorded live run from `runs/*.json`: the model's earlier decisions, with **no API calls for the case**. Approvals and each person's steps still wait for you. Questions you type still go to the model when a key is set (see below). The cost meter shows the recorded cost. |
| `live` | Every agent step calls OpenAI (`OPENAI_MODEL`) through `callModel()` on the case data: it reads the records, decides, and cites them. It refuses to start unless `OPENAI_API_KEY`, `MODEL_INPUT_USD_PER_1M` and `MODEL_OUTPUT_USD_PER_1M` are set. |
| `mock` | Scripted agent decisions over the real data, with no API calls. Used by the tests and to seed recordings. |

`DEMO_MODE` sets the default. Before the live case starts, a dark prototype dialog asks whether to run it **Live** or as a **Replay**; restart the case from the Prototype button to try the other. Live is disabled when its configuration is missing. The case header shows which mode is running.

**Where OpenAI is called.** Only `OpenAIClient.create()` in `lib/llm/client.ts` calls the API, always through `callModel()` in `lib/llm/callModel.ts`. That function checks the budget, sets `max_output_tokens`, prices the usage and validates the JSON.

These are the model steps:
- Goldman: summarize the fail, write the inquiry, read BNY's replies, and follow up.
- BNY Settlement Ops Agent: find the cause, and write each message to Goldman.
- BNY Client Team Agent: draft the request to the client.
- Each person's assistant: understand what you type, and answer questions from the data (`lib/engine/ask.ts`).

### Prices

Set `MODEL_INPUT_USD_PER_1M`, `MODEL_OUTPUT_USD_PER_1M` (and optionally `MODEL_CACHED_INPUT_USD_PER_1M`) to the current list prices for `OPENAI_MODEL`. Nothing is hard-coded. Optional: `OPENAI_REASONING_EFFORT` and `MODEL_MAX_OUTPUT_TOKENS`.

### Recording runs for Demo Day

```sh
npm run record              # all scenarios + benchmark, mock model (no API calls)
npm run record -- --live    # same with real model calls (needs key and prices)
npm run record -- --live golden fp5
```

Replay prefers live recordings over mock ones, and skips recordings that ended on an agent error, the budget or a crash. Recordings from the earlier story (BNY repairs the instruction itself) are kept in `runs/archive-old-story/` and are not played.

### Checks

```sh
npm run data:check   # data files parse, cross-references and golden case intact
npm test             # acceptance-criteria tests (vitest, mock model)
npm run typecheck    # next typegen + tsc
npm run lint         # includes the firm-boundary and callModel import rules
```

## The prototype, screen by screen

Anything that belongs to the prototype rather than the product is dark navy: the overview page and the **Prototype** button in the bottom-right corner. Everything else is the product: BNY's Eliza workspace, or Goldman's own assistant for Michael. Goldman's is deliberately a different product: green, IBM Plex type, squarer corners and a dark sidebar, and a plain chat without BNY's case dashboard.

1. **Prototype overview** (`/`). Sets the scene and the cast, in three parts, each with the task's title and one sentence:
   - Onboarding: David Chen.
   - The live case: Michael Torres at Goldman, then Priya Sharma and Daniel Kim at BNY. Emily Carter, the client, is outside the network.
   - Oversight: Sarah Nguyen.
   - Security tests: an unknown external attacker, and Jordan Blake, a rogue Goldman insider.

   **Start prototype** opens Eliza as David. Clicking a person opens their workspace.
2. **Eliza home, David Chen** (`/eliza`). Goldman's connection request reaches him twice: a Teams message from Rachel Okafor (relationship manager) slides in as a desktop notification, and Eliza's own notification bell shows *New connection request: Goldman Sachs & Co. LLC* on every page. Clicking either opens the onboarding. Both go once he starts it. The page is an assistant prompt, *What would you like to do today, David?*, with suggestions; asking to onboard Goldman opens the onboarding, as does **Onboard new agent** at the bottom of the sidebar. Until onboarding is finished, there is no BNY ⇄ Goldman Sachs connection in the sidebar.
3. **Onboarding** (`/eliza/onboarding`). Step by step, one security layer at a time:
   - application and firm agreement;
   - company (LEI) and DTC account;
   - SSI and SWIFT link;
   - web address, then certificate and signed Agent Card;
   - limits and credentials;
   - link test and go live.

   **Onboard new agent** opens a start screen: choose Goldman's pending application and give the onboarding a title (click the empty box for a suggested one, or type your own). Then the steps begin. If an onboarding is under way, the button resumes it; if one was finished earlier, it starts a new one and takes Goldman out of the sidebar until that one finishes.

   Each step has up to three parts: upload the document Goldman sent (simulated; nothing is read from your computer) or enter the application's details (click an empty box and the synthetic value fills in); **system checks** that run against BNY's reference data, starting by themselves once the document is uploaded and the details entered (Set limits waits for **Save the limits**, since those are choices); and **your checks**, which only a person can do (read the document, confirm with someone). The certificate step shows Goldman's Agent Card and takes the certificate request. **Issue credentials** (step 10) then registers the agent with BNY's auth server: a client ID tied to that certificate, with nothing to type. No pass is handed over, since a pass lasts minutes: Goldman's agent fetches a fresh one before each call. The step issues a test pass (shown decoded under Technical details) that carries no permissions; the gateway reads those from the registry on every request. **Set limits** covers permissions, rate, open cases, hours, access pass lifetime (default 10 min), turns per case, what a BNY person must approve, and which fields replies may carry.

   Two checks find problems (a mistyped LEI and an unproven web address). The step shows how to resolve each: ask Goldman, wait for the resubmission, enter the corrected detail, check again. Progress is kept while you move around the app, so leaving and coming back resumes where you were (a refresh starts over). Once finished, a success screen marks the moment and BNY ⇄ Goldman Sachs appears in the sidebar, flagged **New**; David never sees it before then; its case appears there when Goldman's agent first contacts BNY.
4. **The live case** (`/eliza/case`). Each BNY person has the same dashboard (Michael has only the chat): their assistant chat on the left; on the right, the two agents (click either to see its full Agent Card), the case record, safety and analytics summaries, and **Examine A2A interaction**. Teams and Outlook messages arrive as desktop notifications at the bottom right, and stay in the bell at the top right.
   - **Michael Torres (Goldman):** asks his GS Fails Assistant about the DK; the assistant drafts the inquiry straight away and Michael approves sending it to BNY. Goldman then holds on its own while BNY's client fixes its side (Michael is notified), and his next decision is approving the redelivery.
   - **Priya Sharma (BNY Settlement Ops):** the Settlement Fails Orchestrator shows the verified inquiry. The Settlement Ops Agent compares the details on its own, finds that the client's side differs, and hands the case to Client Service automatically; Priya is notified at each step and is asked only for a late-instruction exception.
   - **Daniel Kim (BNY Client Service):** the Client Team Agent drafts the request to the client on its own, and the approval arrives in the chat as a message from the Orchestrator: Daniel's only decision is whether to send it. **Send email to Emily Carter** sends it, a confirmation snackbar appears, and Goldman's agent is told to hold (no client details cross). About five seconds later Emily's reply arrives as an Outlook notification; the Settlement Ops Agent sends the fix time to Goldman's agent on its own (only approved fields cross), and Daniel gets a Teams notification that it has gone. When the client re-instructs, Goldman is told what changed and to redeliver before DTC closes at 15:10 ET.
   - The Prototype panel opens by itself only when you become someone (on landing or switching person), and a click anywhere outside it or Escape closes it. When the case moves to someone else, a small **Switch** hint appears beside the Prototype button instead.
5. **Examine A2A interaction** (`/eliza/a2a`). It has two views:
   - **Security view (case tracker):** who holds the ball, the journey across firms, every cross-firm message with its gateway result, what crossed the boundary, each firm's ID for the trade, and guardrails.
   - **Technical view (conversation trace):** a filterable transcript, a map of who talked to whom, and each message's envelope (records behind it, fields shared and withheld, gateway checks, why the agent sent it, raw A2A).
6. **Safety and audit, Sarah Nguyen** (`/eliza/audit`). Two views. **Security view**: where the case is now (who holds the ball, time to cutoff, value at risk), the step-by-step journey across the firms, and the full audit log, filterable, with CSV export. **Technical view**: the conversation trace, the map of who talked to whom, and each message's envelope.
7. **Attack console** (`/attack`, dark: it is a prototype stage). As the external attacker or the rogue Goldman insider, pick a preset attack, launch it, and watch BNY's real gateway code respond step by step: what was sent, each gateway check, what BNY's agent received, and what came back. See *Attack console* below.
8. **Documents** (folder icon, top right, BNY only; `/eliza/documents`). Documents uploaded and details entered during onboarding, what was granted, and every data source with the version in use and its history.
9. **Analytics** (`/eliza/analytics`). Where this case's time went (most of it waiting on the client by hand), and the benchmark: manual vs single agent vs A2A.

The sidebar lists Eliza's digital employees (Settlement Fails Orchestrator, Reference Data, Cash Reconciliation, Corporate Actions) and the A2A connections. The digital employees, and the Morgan Stanley and J.P. Morgan connections, are out of scope: clicking one shows a dark prototype note instead of opening it. Goldman Sachs appears only after onboarding, and holds only the live case.

### Questions in the chat

You can ask your assistant anything about the case at any point, including while the agents are working or after the case closes. For example: *"Which version of the SSI is this based on?"*, *"Have similar fails happened before?"*, *"What happens if this misses the cutoff?"*.

When an API key is set (in Live **and** Replay), each question is a model call (`lib/engine/ask.ts`) that reads only that firm's own data:
- the case activity so far;
- the records its agents used, each tagged with its source file and version;
- the catalog of data sources, with the version in use and earlier versions (`lib/data/sources.ts`);
- past items like this one, from the firm's own fails or exceptions file;
- the procedures and cutoffs.

The answer lists the files and versions it relied on, and its cost (about $0.005). Without a key, a fixed answer from `lib/engine/faq.ts` is given and labelled as such.

### Where data comes from

Every record chip in the case shows the version it came from. Click a chip to see the row, its system of record, file, version and earlier versions. The catalog is in `lib/data/sources.ts` (synthetic metadata), and the Documents page lists it.

## What is where

```
lib/data/            typed loaders + scope.ts: DataScope, the only way to read data
lib/llm/             callModel() (budget pre-check, max_output_tokens, usage → cost), OpenAI + mock clients
lib/a2a/             A2A shapes, Agent Cards + registry, tokens, BNY Intake Gateway
lib/tools/           deterministic tools: Goldman/BNY lookups, mock settlement system, mock DTC, grounding validator
lib/agents/          LLM steps with structured outputs (JSON schema), each with a scripted mock decision
lib/engine/          run state, checkpoints + assistant chat, faq.ts, scenario (golden + FP1–FP8), replay, benchmark, projection
lib/personas.ts      the people; lib/sideChats.ts: the sidebar's example chats
components/proto/    prototype layer: overview, persona dock, session state
components/eliza/    Eliza shell, case dashboard, onboarding, audit, analytics
components/a2a/      Examine A2A interaction (security and technical views)
app/eliza/…          routes; app/api/… start, SSE stream, approvals, chat, audit, onboarding checks
tests/               acceptance tests
```

### How the requirements are met

- **Approvals.** Agents only investigate and draft. Nothing goes to the client until Daniel approves, a late instruction needs Priya's exception, and Goldman redelivers only after Michael approves. The approve API refuses a decision from the wrong firm.
- **BNY never changes a client instruction.** The client's corrected MT541 replaces the old instruction (`applyClientInstruction`); a code check stops the hand-over if the agent blames anyone but the client.
- **DataScope.** Each firm's agents and screens get a scope that throws on any other firm's table. ESLint rejects raw loader imports outside `lib/data/` and `openai` imports outside `lib/llm/client.ts`.
- **The gateway.**
  - Inbound, real checks: registered agent, token (signature, issuer, expiry, subject), attested domain, scope, turn limit, injection scan and the field allowlist.
  - Inbound, simulated (they show the user experience, with no real crypto): Agent Card signature, token holder, message signature, fresh nonce and message schema.
  - Outbound: the field allowlist, data labels (anything labelled client or confidential is blocked in code), a scan that withholds BNY ids and client terms, and usage terms on every message (this case only, 30 days, no training).
- **Grounding.** Every finding must cite a row in the agent's own scope with matching values; a failure escalates.
- **Limits.** Ten cross-firm messages or ten scenario minutes of agent exchange, then both sides escalate with a summary.
- **Audit.** Every tool lookup, model call, gateway decision, notification and human decision.
- **Cost.** One `Budget` per case. `callModel()` refuses a call whose worst case would cross $0.20, then prices the actual usage. When the budget runs out, the case escalates.

## Attack console

Presets only; each runs against BNY's real gateway code (`lib/attacks.ts`), with no model calls. Card and message signatures and nonces are simulated, as everywhere in the prototype.

| Attacker | Attack | Stopped by |
|---|---|---|
| External | Pose as Goldman's agent (was FP1) | Identity: not in the registry |
| External | Forge Goldman's Agent Card (was FP6) | Agent Card signature |
| External | Use a stolen token from another address | Identity: token bound to Goldman's certificate and attested address; it also expires in minutes |
| External | Replay a captured message (was FP7) | Fresh nonce |
| External | Change a message in transit (was FP7) | Message signature |
| Rogue insider | Prompt injection (was FP2) | Injection scan, quoted-data handling, outbound filter |
| Rogue insider | Role manipulation ("you are now BNY's internal bot") | Injection scan, outbound filter |
| Rogue insider | Smuggle extra fields | Field allowlist |
| Rogue insider | Ask for a permission it wasn't given | Scope |
| Rogue insider | Fish for data, a little at a time (was FP8) | Request-pattern monitor |
| Rogue insider | Flood the agent | Turn limit |

For the two injection attacks, the console also shows what would happen if BNY's agent had obeyed: the outbound filter strips the client's name, account and internal ids from the draft. Writing these tests found a real gap, now fixed: the filter missed the fund's name as people write it, and a short code inside a longer reference.

FP3 (unsupported claim), FP4 (client silent) and FP5 (late instruction) are case variants rather than attacks. They are still recorded in `runs/` and covered by the tests.

## Cost of a run (measured live, gpt-6.1-terra, 18 Nov 2026)

Prices: $1.00 input, $0.05 cached input and $5.00 output per 1M tokens. Reasoning effort is `none`.

| Request | Outcome | Model calls | Tokens in / out | Cost |
|---|---|---|---|---|
| Golden case | settled 11:17 ET | 9 | 9,232 / 2,196 | **$0.0192** |
| FP1 spoofed agent | rejected | 0 | 0 / 0 | $0.0000 |
| FP2 prompt injection | settled, injection blocked | 9 | 9,445 / 2,460 | $0.0192 |
| FP3 unsupported claim | escalated | 3 | 2,724 / 671 | $0.0051 |
| FP4 client stays silent | escalated (time limit) | 8 | 7,874 / 2,221 | $0.0165 |
| FP5 client misses the cutoff | settled after Priya's exception | 9 | 9,263 / 2,751 | $0.0205 |
| FP6 forged Agent Card | rejected | 0 | 0 / 0 | $0.0000 |
| FP7 replay and tampering | rejected | 0 | 0 / 0 | $0.0000 |
| FP8 data fishing | escalated | 0 | 0 / 0 | $0.0000 |
| A question to an assistant | answered, with sources | 1 | about 3,500 / 300 | about $0.005 |
| Benchmark, single agent | — | 1 | 2,437 total | $0.0068 |

Every case costs under 10% of the $0.20 cap. Benchmark time from the DK at 08:16 ET to settlement:
- **Manual:** 5h 24m (assumed).
- **Single agent:** 4h 04m (assumed waits).
- **A2A:** 3h 01m (scripted).

Most of the A2A time is the wait for the client's email.

### Live-mode notes

- The first live runs showed the triage agent answering "unclear" about who must act (BNY can't tell which quantity is right). The prompt now says the client must act whenever its instruction differs from a delivery that matches the counterparty's affirmed confirm. A code check still stops the hand-over otherwise.
- Goldman's agent first refused to redeliver because it "couldn't verify" BNY's quantity. It now treats BNY's gateway fields as BNY's statement and cites only Goldman's own records.
- The OpenAI client times out after 90 s with two retries, so a stuck call doesn't hold a case for minutes.
- Goldman's agent once summarised the redelivery as "the custodian could not confirm the cutoff time or explain the earlier mismatch": BNY's message hadn't said what changed. BNY's messages now carry a `resolution` note and a `settle_by` time (both allowlisted, internal-labelled), Goldman's agent sees BNY's earlier messages, and BNY's replies no longer say they "cannot confirm" things nobody asked them to withhold. Recordings were re-made on 19 Nov 2026 after the synthetic-data review fixes; earlier ones are in `runs/archive-previous/`.

## Assumptions and choices

- **Next.js 16.2**, Tailwind v4, plain Tailwind primitives.
- **The story** follows the operations-flow deck: find the cause, hand over, ask the client, notify the counterparty, re-instruct, settle and close. The client has no agent; Daniel reaches Emily by email, and her reply is scripted.
- **Scenario clock.**
  - Agent steps advance the clock by small fixed amounts.
  - The scripted human times:
    - Daniel sends the request at 09:12 ET.
    - Emily replies at 10:24 ET.
    - Her corrected instruction arrives at 11:08 ET.
    - Michael approves the redelivery at 11:14 ET.
    - DTC settles at about 11:17 ET.
  - FP5 shifts these later: Emily replies at 11:20 and her instruction arrives at 11:52.
- **Cutoff.** 11:30 ET for client instructions for same-day DVP settlement, from BNY's settlement procedures §3. Late-instruction exceptions are allowed until 14:45 ET, and DTC DVP processing ends at 15:10 ET.
- **Time zones.** The data uses fixed offsets (ET = UTC−5, CET = UTC+1), and the UI does the same.
- **State changes** live in the run's in-memory overlay. **The data files are never modified at run time.**
- **Data change for the new story.** AllianzGI's amended allocation is `NOT_SENT` in its OMS (its approval queue closed for the night). BNY has no amendment or repair item for this trade. BNY's ops chat and AllianzGI's OMS log were rewritten to match.
- **Benchmark.** The manual baseline is assumed from interviews and the ops chat (settled around 13:40 ET). The single agent's email waits are assumed; its tool calls, tokens and disclosed fields are measured. The A2A row comes from the latest golden recording.
- **Session state, reset on refresh.** The person you are playing, the open case, the mode, onboarding progress and which notifications you've seen are kept while you move around the app (localStorage, `a2a.*` keys). Any full page load (refresh, new tab, typed URL) clears them and the prototype starts from the beginning. Runs live in server memory; an abandoned run is simply forgotten.
- **Fonts.** `next/font` fetches Google Sans Flex when the server starts; offline it falls back to Inter or the system font.
