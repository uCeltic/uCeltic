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
  moved on since the failure (issue #121, and
  [ADR-0012](docs/adr/0012-retry-replays-the-recorded-search-attempt.md)).
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
  Versions**; it holds no text itself.

  A Work is what the workspace **opens documents by**: the toolbar's `Works`
  control (`client/src/workspace/panels/WorkPicker.tsx`) lists the Works the
  database declares, and expanding one offers its Versions to open — several at
  once, or all of them. A Work is **not** a search scope; search runs over the
  columns that are open ([ADR-0015](docs/adr/0015-search-scope-is-the-open-documents.md)).
  Choosing one does one thing beyond opening: it narrows the **Tag Filter** to
  that Work's entries. The link runs one way — choosing an entity never changes
  the Work.

  The relationship is held in the database (`apps.tei.Work`, and a nullable FK
  on `TEIDocument`), **never parsed out of a document title**: titles like
  *Laud Misc. 610 — Acallam na Senórach, ll. 2400–3106* happen to embed the Work
  name, but the first document titled otherwise would silently leave its Work.
  An admin assigns the Work when uploading. A Document with **no** Work is
  normal (the corpus's non-Acallam samples — `shakespear.xml`, `let695.xml`,
  `serafin*.xml`) and stays openable, under its own branch labelled
  *Unassigned*; a Work with no Documents is not shown, because
  the menu is grouped from the document catalogue and so cannot express one.
  _Avoid_: Work as a search filter — that was the hard-coded `All Works`
  control, removed with #152.

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

  A toolbar control for **following one named entity — a person or a place —
  through every open Document at once**. Its options are the entries of the
  open Documents' own **Authority Lists**, never a hard-coded vocabulary, so no
  option is ever offered that cannot match anything. Selecting one is
  **single-select**: each visible column then highlights and navigates *its own*
  occurrences of that entity (`Find mac Cumaill · 1 / 12 · ← →`), independently
  of every other column. Because the three Acallam Documents share one set of
  `xml:id`s, one selection resolves in all of them — which is what makes
  side-by-side comparison worth having.

  Three visual tiers, matching the ctrl+F convention: the current occurrence is
  solid, the entity's other occurrences in that column are tinted, and every
  other named entity greys out. They are violet, deliberately not the search
  highlight's orange: both features are allowed on screen at once and must stay
  telling apart (`client/src/tei/highlight.ts`, `client/src/index.css`).

  These tiers are the **only** thing that marks a named entity on the page. The
  reading pane renders the document as plain text and the TEI markup lives in
  the DOM as `data-tei-*` attributes rather than as styling — see
  [ADR-0016](docs/adr/0016-reading-pane-renders-plain-text.md) — so an entity is
  unmarked until this control asks for it.

  Entities are selectable **only from this menu** — named entities in the
  reading pane are not click targets, because the reading pane stays a reading
  pane. A Document with no Authority List contributes no options and gets no
  navigation card; there is no fallback to matching by element name.

  While a **Work** is chosen in the `Works` opener, the menu is built from that
  Work's open columns only, and its per-column counts narrow with it. The two
  toolbar dropdowns are linked one way: Work → entities, never back.

  It **replaces** the removed three-state Mode switcher (Search / People &
  Places / Personal), which never did anything and read as a confusing "second
  search" next to the real search bar — see
  [ADR-0010](docs/adr/0010-drop-workspace-mode-switcher.md). _Avoid_: Mode,
  second search — the switcher it replaces is gone; "tag type" — the filter is
  over entities the corpus declares, not over TEI element names.

  ### Authority List

  A Document's own register of the people and places it names, carried in
  `standOff` as `listPerson` / `listPlace` (`<person xml:id="fionn">`). Each
  entry gives one **Headword** and its spelling variants, and every named entity
  in the body points back at an entry with `ref="#fionn"`. It is **apparatus,
  not text**: it is parsed and kept in `parsed_json`, but never rendered and
  never tokenised into the search index (#151) — so a spelling that occurs only
  in the list is not searchable, and `persName` counts exclude it (Franciscan
  A 4 has 486 `persName` elements, 353 of them in `<text>`).

  Read by `client/src/tei/authority.ts`. Two traps it absorbs, both a
  consequence of how `parse.py` projects the XML: `xml:id` arrives as plain
  `id`, and a body reference keeps its leading `#`.

  `standOff` is skipped wholesale, so anything else a Document keeps there is
  hidden and unindexed too — `serafin03/07.xml` file their transcription notes
  in a `listAnnotation` there, and those left the screen with #151. They are
  editorial apparatus like `note`, so this is the same call, not an oversight. _Avoid_: index, glossary —
  it is a name authority in the TEI sense, and "index" already means the search
  index here.

  ### Headword

  The canonical form of an Authority List entry — the `type="canonical"` child
  of a `person`/`place`, e.g. *Find mac Cumaill* for the variants *Find*,
  *Finn*, *Ḟinn*, *Fhionn*. It is what the Tag Filter shows the reader, and the
  grouping it implies ("these four spellings are one man") is **the corpus's
  claim, not ours** — the app never infers it from the text. Which child is
  canonical is stated by the attribute and must not be inferred from position.
  _Avoid_: lemma, preferred name, canonical name (say Headword).

  ### Version (of a Work)

  One rendering of a Work in a particular language or manuscript witness — e.g.
  *Snow White* has an Old Irish, a Middle Irish, and a Modern Irish Version. Each
  Version **is exactly one TEI Document**. "Version" is the domain word; "TEI
  Document" is the same thing named by its storage form.

  ### TEI Document

  A single parsed `.tei`/`.xml` file (`backend/apps/tei`) — the concrete artifact
  behind one Version. Opened by TEI Document id; carries the `word_array` +
  `anchors` that search runs over.

  `xml_file` is the **source of truth** for the original document; `parsed_json`
  (with `word_array` and `anchors`) is a **projection** of it built for rendering
  and search, not a round-trippable serialisation — it strips namespaces, drops
  comments and processing instructions, and never sees the XML prolog. Anything
  the projection omits is still recoverable from `xml_file`.

  ### Word (index term)

  A word is decided by the **character stream**, not by the markup: an element
  boundary is not a word boundary, so `tal<expan>am</expan>` is the single word
  `talam` spanning two anchors. **A word maps to a list of anchors** —
  `word_array[i].a` names only the one it starts in — and the one edge it may
  never span is that of a subtree excluded from the index (`teiHeader`, `note`),
  because manuscript text and the editor's English commentary are not one
  sentence.

  **Work → Version → TEI Document** is a one-to-many-to-one chain: a Work has many
  Versions, each Version is one TEI Document. It is stored as one nullable FK
  (`TEIDocument.work`) — the Version has no row of its own, being the same thing
  as the TEI Document under a domain name. The `Works` menu reads that FK back
  off the catalogue to group it. `scope_changed` still records which Work the
  reader chose, now as a single database id; it names what they are reading, not
  what is searched.

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
  but readable" file.

  This cuts both ways. XML comments and processing instructions are well-formed,
  so a file carrying them must parse — files exported from Oxygen routinely
  contain both. The parser **ignores** them: they are dropped from `parsed_json`
  rather than kept, so backend and frontend allocate anchor ids over the same
  node set. Text following a comment is still indexed. A **declared** entity is
  resolved into ordinary text before the parser ever sees it; an **undeclared**
  one is not well-formed, so the file is rejected outright — that is the contract
  working, not a bug.

  _Avoid_: saying a file is "valid" when you mean "opens and renders".

  ### Error Report

  A recorded **failure that broke the experience**, captured so a developer can
  reproduce it — *not* a user action. Deliberately a **separate concept from a
  Behavior Event**: a Behavior Event is something the visitor *did* (a closed
  taxonomy of intents, ADR-0003); an Error Report is something that happened *to*
  them. Folding it into that taxonomy would pollute the study cohort's action
  timeline and break the closed-set invariant, so the two are separate tables that
  line up only through a shared `session_id` (a best-effort join key).

  Recorded from **both sides, backend-primary**
  ([ADR-0013](docs/adr/0013-error-reports-backend-primary-scrubbed.md)): the
  backend records every unhandled **5xx** with its traceback (the reproducible
  core — a 500 the client only ever sees as `search failed: 500`); the frontend
  records only failures it **could not handle specifically** — the generic
  "Search failed" / "Something went wrong" fallback branches, `window.onerror`,
  unhandled rejections, a white-screen error boundary. Expected outcomes the UI
  already shows gracefully (a 400 "email taken", a 401, a 429) are **not** errors
  and are not recorded.

  Each report names its **kind** — which capture point produced it, a small closed
  set that starts at `backend_5xx` and grows one entry per capture point added.
  Deliberately *not* called a type: `event_type` is the study taxonomy a Behavior
  Event is drawn from, and the two must not read as the same idea.

  Carries enough request context to reproduce — the search query and its
  parameters, the path, the status — but **scrubs secrets (passwords) and stores
  no email**: identity rides on the `user` FK, pseudonymised like every other
  study model (#69). Scrubbing drops secret- and email-named keys from the stored
  body and query string, and redacts any address that reaches the free-text
  `summary`/`traceback` inside an exception message. _Avoid_: log line, exception, crash — an Error Report is the
  recorded, reproducible artifact, not the raw stack trace or the instant it
  threw; and it is the deliberate opposite of a Behavior Event (a failure, not an
  intent).

  ### Feedback

  A **message a visitor deliberately sends the team** from the workspace's
  always-available floating button — a bug report, a feature request, or a
  general remark (`category`: `bug` / `feature` / `other`). Free-text prose a
  human reads and triages, kept in its own `Feedback` table and viewed in admin
  ([ADR-0014](docs/adr/0014-user-feedback-dedicated-store.md)).

  The third and distinct member of a triad with the two capture concepts above:
  a **Behavior Event** is something the visitor *did* (a closed-taxonomy intent,
  ADR-0003); an **Error Report** is a failure that happened *to* them (ADR-0013);
  a Feedback is a message they *chose to write*. It is stored apart from both —
  its prose must never enter the closed study taxonomy — and lines up with them
  only through a shared `session_id`. A successful submission still emits one
  `feedback_submitted` Behavior Event carrying **only** `{ category }`, so the
  study timeline records that feedback happened without ingesting its content.

  Carries an optional `contact` (so an anonymous submitter can be replied to) and
  a `context` snapshot (open documents, scope, viewport, URL) that makes a bug
  report reproducible. _Avoid_: bug report (only one of its categories), review,
  survey, questionnaire (the questionnaire is a prompted purpose question, ADR-0007;
  Feedback is visitor-initiated).