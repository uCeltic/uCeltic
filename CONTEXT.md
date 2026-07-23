# uCeltic — Domain Context & Glossary

  Canonical terms and their definitions across all layers (UI ↔ frontend ↔ backend).
  When a term's meaning or default changes, update it here first, then align every layer.

  ## Glossary

  ### `window_size_ratio`

  The size of the moving search window, expressed as a multiple of the query's
  word count:

  window = max(1, int(query_word_count * window_size_ratio))

  - `1.0` → window is exactly as long as the query.
  - `> 1.0` → window is longer than the query, leaving **headroom to absorb
    inserted/extra words** (the reason a fuzzy match can span more words than
    were typed).
  - `< 1.0` → window is shorter than the query (partial match, lower recall).

  **Canonical default: `1.3`** (i.e. 130%). **Canonical range: `0.1`–`10.0`**
  (i.e. 10 %–1000 %) — the backend request DTO rejects anything outside it with
  a 400. On the frontend the Match Length slider's own bounds are what keep
  requests inside that range; nothing clamps a ratio downstream of the control.

  Aligned across all layers:

  | Layer | Location | Value |
  | --- | --- | --- |
  | UI control "Match Length" | `client/src/workspace/panels/AdvancedSearchPopover.tsx` | slider
  10–300 %, reset → 130 |
  | Frontend store (initial) | `client/src/store/searchStore.ts` | `matchLength: 130` → ratio
  `1.3` |
  | Frontend API fallback | `client/src/api/search.ts` | `?? 1.3` |
  | Backend request DTO | `backend/apps/search/serializers.py` | `default=1.3`, range `0.1–10.0`
  |
  | Backend service | `backend/apps/search/services/run_search.py` | `window_size_ratio: float =
  1.3` |

  ### Match Length (UI term)

  The user-facing name for `window_size_ratio`, shown as a percentage:
  `ratio = matchLength / 100`. So **100 % means the window equals the query
  length**, and values above 100 % give the fuzzy matcher room for insertions.

  The slider therefore starts at 10 %, not 0 %: positions below that map to a
  ratio the API rejects, and every search made from them failed (issue #120).

  History: see issue #19 — defaults previously disagreed across layers
  (`0.5` / `1.0` / `1.2` / `1.3`), and the backend `1.3` was dead code because
  the client always sent a value. Canonicalised to `1.3` everywhere.

  ### Search Attempt

  One column's search, recorded in full at the moment it is fired: the query,
  its Query Origin (`typed` / `selection`), the excluded source document, and
  the four parameters (Match Length, precision, dissimilarity, top-k). Kept per
  column in `lastAttemptByDocument` so a failed column's **Retry** re-runs *that
  search*, not a fresh one assembled from current state — a selection search's
  query exists nowhere else (ADR-0008), and the search bar and sliders may have
  moved on since the failure (issue #121).
  _Avoid_: request, query — a Search Attempt is neither the HTTP call nor the
  text searched for.

  ### Behavior Event

  A single, semantically meaningful user action, recorded for the behavior-logging
  study — *not* a raw click or scroll. One event maps to one interpretable intent
  (e.g. "ran a search", "changed Match Length", "opened a document"). The closed set
  of event types is the canonical taxonomy; anything not in that set is not logged.
  _Avoid_: log line, click, hit (a search "hit" is a result, not an event).

  ### Session

  The unit a Behavior Event is attributed to: one **continuous sitting**, identified
  by a `session_id` (a uuid generated on app load, or after 6 hours of inactivity
  within a still-open tab — see
  [ADR-0007](docs/adr/0007-questionnaire-for-guests-and-idle-session-expiry.md)).
  A Session lets you rebuild the full sequence of one sitting
  (searched → tweaked a param → gave up), which is what requirement-mining needs. A
  Session **may belong to a User** (signed in) or be anonymous — cross-day "same
  person?" questions are answered through the owning User for the study cohort, and
  stay unanswerable by design for anonymous traffic (see
  [ADR-0004](docs/adr/0004-public-tool-with-optional-accounts.md)).
  _Avoid_: device, participant — no device ids exist, and "participant" is a
  study-protocol role, not a data concept.

  ### User

  A registered account (email + password, activated via an emailed link) belonging
  to one person. **Optional by design**: the workspace is fully usable anonymously;
  signing in adds a profile (display name, password change) and attribution of the
  holder's Sessions, Behavior Events, and Questionnaire Responses — the pre-use
  prompt itself is shown to every visitor regardless of account status (see
  Questionnaire Response, below). August study participants sign in because the
  protocol asks them to, not because
  a wall forces them. Data linked to a User is researcher-only and pseudonymized in
  published analysis. _Avoid_: account, member (same concept as User); calling
  anonymous visitors "users" — say visitor.

  ### Entry Notice

  A single, generic banner shown at the app's entry point, identically to guest
  and signed-in visitors, stating that usage behavior is recorded and used to
  improve the software and support a research project. Dismissal is
  client-side only (no backend record). Distinct from the study's per-account
  consent story ADR-0004 described (linked to your account, researcher-only,
  pseudonymized, deletable, destroyed after thesis) — that specific language is
  **not** part of the Entry Notice; see
  [ADR-0005](docs/adr/0005-generic-entry-notice-not-per-account-consent.md).
  _Avoid_: consent banner, privacy notice — this is a usage disclosure, not the
  ethics-board informed-consent artifact.

  ### Questionnaire Response

  A visitor's self-stated purpose for **one Session** ("what are you trying to do
  this time?"), captured by a short skippable prompt before entering the workspace;
  a skip is recorded too. Shown to every visitor, guest or signed-in — like Session
  and Behavior Event, a Questionnaire Response **may belong to a User** or be
  anonymous (see [ADR-0007](docs/adr/0007-questionnaire-for-guests-and-idle-session-expiry.md)).
  The "said" side of the study's core comparison, cross-checked against the same
  Session's Behavior Events (the "did" side). The question set is versioned and
  owned by the research team. Distinct from a Diary Entry (free-text, after the
  fact) and from Behavior Events (observed actions, not self-report).

  ### Diary Entry

  A free-text problem report / feature wish a team member posts to the shared
  diary thread, separate from the Behavior Event stream. Self-identified by name is
  *optional*. Carries a rough date/time so it can be loosely timestamp-matched
  against the (anonymous) aggregate log — there is no hard key linking a Diary Entry
  to a specific Session.

  ### Work

  A named story (e.g. *Snow White*, *Táin Bó Cúailnge*), independent of the
  language or manuscript it survives in. A Work is a **container of one or more
  Versions**; it holds no text itself. Search **scope** is a Work: searching
  *Snow White* searches across all of its Versions at once, never across an
  unrelated Work. Currently the Work list is **hard-coded** in
  `client/src/workspace/panels/ScopeButton.tsx`; wiring it to actually group its
  Versions is the unfinished feature (not a modelling ambiguity — see below).

  ### Manuscript

  A **physical, non-digitized original source** — the handwritten book a Work
  survives in — surfaced in the app only as **page images** through the IIIF
  panel (`client/src/workspace/panels/IIIFPanel.tsx`, e.g. *Book of Lismore*).
  Deliberately distinct from a Document: a Manuscript is the original artifact,
  a Document is a digitized/transcribed text. The UI label stays the word
  **"Manuscripts"** — it is a client-requirement term and must **not** be
  renamed to "Books"; disambiguation from Documents is done with an **icon**
  next to the label, never by changing the word (see
  [ADR-0011](docs/adr/0011-desktop-only-responsive-scope.md) for the icon-driven
  responsive treatment). _Avoid_: Book (a physical Manuscript is book-like but
  "Book" is a forbidden UI rename); calling a digitized text a "manuscript".

  ### Tag Filter

  A toolbar control that filters by **TEI named-entity tag type** — the closed
  set rendered in `client/src/tei/elements/names.tsx`: `persName`, `placeName`,
  `geogName`, `orgName`, `rs`, `name`. Presented as a multi-select of those
  predefined tag names (same interaction shape as the Work scope picker), so
  it needs **no free-text search box of its own**. It **replaces** the removed
  three-state Mode switcher (Search / People & Places / Personal), which never
  did anything and read as a confusing "second search" next to the real search
  bar — see [ADR-0010](docs/adr/0010-drop-workspace-mode-switcher.md). Its
  functional effect (restrict search vs. restrict on-screen highlighting) is
  **deliberately unwired for now** — the current round ships the control shell
  only. _Avoid_: Mode, second search — the switcher it replaces is gone.

  ### Version (of a Work)

  One rendering of a Work in a particular language or manuscript witness — e.g.
  *Snow White* has an Old Irish, a Middle Irish, and a Modern Irish Version. Each
  Version **is exactly one TEI Document**. "Version" is the domain word; "TEI
  Document" is the same thing named by its storage form.

  ### TEI Document

  A single parsed `.tei`/`.xml` file (`backend/apps/tei`) — the concrete artifact
  behind one Version. Opened by TEI Document id; carries the `word_array` +
  `anchors` that search runs over.

  **Work → Version → TEI Document** is a one-to-many-to-one chain: a Work has many
  Versions, each Version is one TEI Document. Search scope (`selected_work_ids`)
  is keyed on the **Work**; it expands to every TEI Document under that Work's
  Versions. This relationship is *modelled and agreed* — only the wiring in
  `ScopeButton.tsx` (hard-coded list → real Work→Version grouping) remains to
  build.

  ### Built-in Corpus

  The Irish TEI Documents that **ship inside the app** (`backend/tei/`), available
  with zero setup — the app is usable with no file of your own. This is the
  default experience and the research team's own material. Contrast **Local
  Document** (below). _Avoid_: "sample data", "demo files" — the built-in corpus
  is the primary content, not a placeholder.

  ### Local Document

  A file a visitor **opens from their own machine** via the browser, added to the
  workspace client-side — never uploaded, never stored, works with or without a
  User. Today this means `.txt`/`.docx` read as plain text; `.tei` is accepted by
  the file picker but not yet handled, so client-side TEI parsing and search remain
  an aspiration (the fuzzy-search engine currently exists only server-side). The
  contract for a future local TEI file stays **well-formed XML with a TEI root** —
  *not* schema-valid TEI (see "Well-formed vs Valid").

  ### Well-formed vs Valid

  **Well-formed** = syntactically legal XML (tags balanced, one root). **Valid** =
  conforms to a specific TEI schema. The app requires only *well-formed XML with a
  `TEI`/`teiCorpus` root*; it deliberately does **not** validate against a schema.
  Unknown tags fall through to generic rendering (`PassThrough`) and their text
  still enters the search index. Rationale: the app *consumes* TEI, it does not
  *author* it — schema validation is a creation-tool concern (Oxygen, where the
  team and other scholars tag), and a reader has no action to take on an "invalid
  but readable" file. _Avoid_: saying a file is "valid" when you mean "opens and
  renders".