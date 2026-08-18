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
  prompt is not account-gated either, though it is currently paused for everyone
  (see Questionnaire Response, below). August study participants sign in because the
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
  a skip is recorded too. When shown it goes to every visitor, guest or signed-in —
  like Session and Behavior Event, a Questionnaire Response **may belong to a User**
  or be anonymous (see [ADR-0007](docs/adr/0007-questionnaire-for-guests-and-idle-session-expiry.md)).
  The "said" side of the study's core comparison, cross-checked against the same
  Session's Behavior Events (the "did" side). The question set is versioned and
  owned by the research team. Distinct from a Diary Entry (free-text, after the
  fact) and from Behavior Events (observed actions, not self-report).

  **The workspace does not currently ask.** The prompt is paused until the research
  team supplies a real question set — the placeholder single question could not
  deliver the "said" side it exists for
  ([ADR-0023](docs/adr/0023-pause-the-questionnaire-until-it-has-a-question-set.md)).
  The modal, the client session state, and the model and endpoints behind it are all
  still in place and untouched, so no Questionnaire Responses are being collected
  meanwhile — skips included, so the denominator pauses too. Feedback is **not** a
  stand-in for it: see the _Avoid_ line under Feedback.

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
  *Acallam na Senórach: Laud Misc. 610* happen to embed the Work name, but the
  first document titled otherwise would silently leave its Work.
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
  responsive treatment, staged by
  [ADR-0020](docs/adr/0020-toolbar-labels-collapse-in-stages.md)). The book icon
  is what carries the term below 1280px: this is the *first* label the toolbar
  drops, because the toggle's colour and `aria-pressed` already say what it says.
  The word survives in the button's `aria-label` and tooltip at every width. _Avoid_: Book (a physical Manuscript is book-like but
  "Book" is a forbidden UI rename); calling a digitized text a "manuscript".

  ### Tag Filter

  A toolbar control for **following one named entity — a person or a place —
  through every open Document at once**. Its options come from the corpus's own
  **Entity Grouping**, never a hard-coded vocabulary, so no option is ever
  offered that cannot match anything. Selecting one is **single-select**: each
  visible column then highlights and navigates *its own* occurrences of that
  entity (`Find · 1 / 21 · ← →`), independently of every other column. Because
  the four Acallam Documents group their names under the same ids, one selection
  resolves in all of them — which is what makes side-by-side comparison worth
  having.

  A row is a **join of two things**, and neither is a row on its own: the **Name
  Register** says what a group id is called, and each visible column's own
  **Name Index** says how often that column writes it. So each row prints a
  **Headword**, the **`@nymRef` code**, and one count per visible column —
  `Find · F64 · 21 · 10 · 17 · 16`. The code is shown because the Headword is
  ours and the code is the corpus's: researchers cross-check against their own
  `person_name_list.csv` / `place_name_list.csv`, and the code is the only key
  those lists share with the app. It is also what tells two near-identical rows
  apart when a source file has a typo in it (`F64` and `64` are both Find).

  Rows are grouped into **people and places** (from **Kind**), ordered
  **most-referenced first over the visible columns**, and filterable by Headword
  or code — the corpus in hand offers 91 of them, and typing beats scrolling.
  The menu scrolls within its own bounds; the reading panes and the toolbar do
  not move for it. An entity **no visible column names** is not offered at all,
  and a column that names it zero times still keeps its slot in the counts, so
  they line up with what is on screen.

  Two visual tiers, matching the ctrl+F convention exactly as far as it goes:
  the current occurrence is solid, the entity's other occurrences in that column
  are tinted. Names the reader is **not** following are left alone — browser
  find highlights matches, it never dims the rest of the page, and a third tier
  that greyed every other name out was dropped for that reason
  ([ADR-0021](docs/adr/0021-tag-filter-marks-what-is-followed-only.md)). The two
  are violet, deliberately not the search highlight's orange: both features are
  allowed on screen at once and must stay telling apart
  (`client/src/tei/highlight.ts`, `client/src/index.css`). Where two land on the
  **same words** — searching for the very name being followed — which colour
  covers which is fixed by a **priority table**, not by whichever feature the
  reader reached for first: the current search result over the current
  occurrence, over its siblings, over the query source.

  These tiers are the **only** thing that marks a named entity on the page, and
  they mark one entity at a time — every other name reads as plain text. The TEI
  markup lives in the DOM as `data-tei-*` attributes rather than as styling, so
  an entity is unmarked until this control asks for it. The reading pane does
  set the manuscript — in italic, bold and brackets where the printed edition of
  the text does
  ([ADR-0018](docs/adr/0018-reading-pane-reproduces-the-printed-editions-conventions.md),
  superseding [ADR-0016](docs/adr/0016-reading-pane-renders-plain-text.md)) — but
  a name is not one of those conventions, and none of what it sets is a colour,
  so nothing there competes with these tiers.

  Entities are selectable **only from this menu** — named entities in the
  reading pane are not click targets, because the reading pane stays a reading
  pane. A Document the menu knows nothing about contributes no options and gets
  no navigation card; there is no fallback to matching by element name.

  Two silences are kept apart on the navigation card (#164). A Document that
  carries a **Name Index** and never writes the selected entity **keeps its
  card**, reading `none here` with its arrows disabled: the columns are side by
  side to be compared, and *this witness does not name Find* is one of the
  answers a comparison can come back with. A Document with **no `@nymRef` in
  it** — `shakespear.xml` — gets **no card at all**, because it was never asked
  the question: its names are on the page, ungrouped, and "none here" would be
  a claim about the markup dressed up as a claim about the text.

  While a **Work** is chosen in the `Works` opener, the menu is built from that
  Work's open columns only, and its per-column counts narrow with it. The two
  toolbar dropdowns are linked one way: Work → entities, never back.

  It **replaces** the removed three-state Mode switcher (Search / People &
  Places / Personal), which never did anything and read as a confusing "second
  search" next to the real search bar — see
  [ADR-0010](docs/adr/0010-drop-workspace-mode-switcher.md). _Avoid_: Mode,
  second search — the switcher it replaces is gone; "tag type" — the filter is
  over entities the corpus groups, not over TEI element names.

  ### Entity Grouping

  The corpus's claim that several marked-up names are **the same person or
  place**. It is what makes "follow Fionn through every open column" a question
  the app can answer without guessing from spelling, and it is **the corpus's
  claim, not ours** — the app never infers it from the text.

  The current corpus states it with a **group id** in `@nymRef`, on `name` and
  `addName` elements: `<name type="person" nymRef="F64">Find</name>`. The kind
  (person or place) is in `@type`, not in the element name. The ids are written
  **bare** — `nymRef="F64"`, not `nymRef="#F64"` — so they are *not* resolvable
  TEI pointers, and must not be turned into one; they are keys, and that is all
  this corpus asks of them. 670 named entities across the four Acallam
  witnesses — Franciscan A 4, Laud Misc. 610 and Lismore 204 at ll. 2390–2594,
  G 126 at ll. 2390–2458 — fall into 91 groups: 73 person, 17 place, and one
  (`e6`, Ériu) tagged both ways, `type="place"` 113 times and `type="person"`
  once.

  **Nothing in any file says what a group id stands for.** There is no
  `standOff`, no headword, no register in the TEI — `F64` is opaque until
  something outside it supplies a name. That is what the **Name Register**
  (below) is, and it is the only part of this the app authors; the grouping
  itself stays the corpus's claim.

  The ids are **not** applied consistently, and code that joins on them must
  expect that. Eight of the 670 entities carry no `@nymRef` at all — six put the
  id in `@n` instead (`n="F21"`, Feradach), and two in G 126 carry none. One
  entity is grouped under a mistyped id: Lismore 204 writes `nymRef="64"` once
  where it writes `F64` sixteen times. `@type` is unreliable in the same way —
  `e6` is tagged both ways, and one `addName` (`P1`) carries no `@type` while
  the `name` in its group is `type="person"`. These are tagging slips in the
  research files, pinned by `backend/apps/tei/tests/test_parse.py` and
  `test_name_index.py` so that a re-cut corpus that fixes them is noticed.

  **Bad data degrades, it never errors.** There is no lookup table, so there is
  no "not found": an id nobody else uses is simply a group of one. The mistyped
  `nymRef="64"` gets its own menu row. The symptom the reader sees is two
  near-identical rows, and that is the signal to fix the source file — a
  correction table in the app would hide the defect and never be removed. The
  six `n="F21"` names join no group, stay visible in the text and are not
  navigable; `@n` is a different TEI attribute with a real meaning. A name with
  no id at all joins nothing and still renders. Names in `teiHeader` and `note`
  are apparatus, not the manuscript's text, and are left out of the grouping on
  both sides (`SKIP_TAGS`) — so the count a menu row prints is exactly the set
  of spans the highlighter can find.

  An earlier corpus stated the same thing a different way: an **Authority List**
  in `standOff` (`listPerson` / `listPlace`, `<person xml:id="fionn">` with a
  headword and its spelling variants) that every named entity pointed back at
  with `ref="#fionn"`. Those witnesses were superseded in #162 and the reader
  that understood them was deleted with them, but the reading side still
  resolves `@ref`, because the app consumes TEI it did not author.

  `standOff` is **apparatus, not text** whatever it holds: parsed and kept in
  `parsed_json`, but never rendered and never tokenised into the search index
  (#151), so a word occurring only there is not searchable. It stays skipped on
  both sides — `serafin03.xml` files 20 transcription notes in a
  `listAnnotation` there and `serafin07.xml` two more, and those are editorial
  apparatus like `note`, so this is the same call, not an oversight.

  _Avoid_: index, glossary ("index" already means the search index here);
  calling a `@nymRef` value a reference or a pointer — it points at nothing.

  ### Name Register

  The corpus-wide list of the people and places the manuscripts name, one row
  per **Entity Grouping** id (`apps.tei.NameEntity`, `GET /api/tei/names/`). It
  holds the one thing no TEI file in this corpus carries: a **Headword** for a
  group. The grouping is still the corpus's — the register never decides that
  two spellings are one person, it only names a group the corpus already
  declared.

  Built as XML is uploaded, from the parse signal, and **aggregated** from every
  Document's **Name Index** rather than incremented per upload — which is what
  makes a Document re-uploadable without double-counting. The four witnesses in
  hand yield **91 entities: 73 person, 18 place**.

  The group key is the **`@nymRef` value verbatim, case-sensitive, never
  lowercased**. The annotators' own name lists tell people from places by case
  — `A13` is Aed mac Echach Lethdeirg, `a13` is Almu — and 483 codes collide
  that way, so folding case would silently make one entity of a man and a
  hillfort.

  _Avoid_: authority list (that is the superseded `standOff` the corpus itself
  carried), index (that already means the search index here), lookup table —
  there is no "not found" to look up.

  ### Name Index

  One Document's own account of the names it marks up
  (`TEIDocument.name_index`), keyed by group id: how many occurrences, which
  `@type`s they carried, every spelling with its count, and each occurrence's
  anchor. Written at parse time and **replaced wholesale on every re-parse**, so
  a correction to a source file can take back what its previous parse claimed.

  It is what a **Tag Filter** row's per-column counts are read from. The
  Register says what a group is *called*; the Name Index says how often *this
  column* says it, and the menu is the join — made on the frontend, where which
  columns are visible is already known.

  ### Kind

  Whether an Entity Grouping is a **person** or a **place**: the majority
  `@type` over every occurrence in the corpus. `e6` (Ériu) is tagged
  `type="place"` 113 times and `type="person"` once, and it is a place — the
  minority tag is a slip in the research files, not a second identity. Recomputed
  as Documents arrive, so a re-cut corpus that fixes a real mistagging shows up.
  `addName` carries no `@type` at all and follows its group. A group the corpus
  never typed reads as a person; no group in the corpus in hand is untyped
  throughout, so that is a degradation rule, not a claim about the text.

  ### Headword

  The name a **Name Register** entry goes by — what the **Tag Filter** prints,
  e.g. *Find* for the spellings *Find*, *Fionn*, *Ḟinn*, *Finn*.

  It is **derived from the corpus's own spellings, and it is the one part of
  this the app authors** — the grouping is the corpus's claim, the label is a
  best reading of it (see
  [ADR-0017](docs/adr/0017-the-app-names-a-group-the-corpus-only-declares.md)).
  The first Document to introduce a group id sets it, using
  that Document's most frequent surface form (ties broken by first occurrence in
  document order), and it is **never recomputed** — uploading more manuscripts
  later must not rename an entity a researcher has already learned to recognise.
  On the corpus in hand that yields `F64` → *Find*, `e6` → *Érend*, `O2` →
  *Oisīn*, `C6` → *Caílti*.

  A surface form **excludes nested `note` text**: an occurrence reading
  `Trēnmhōr<note><p>Dúch caite</p></note> ūa Baīscne` contributes *Trēnmhōr ūa
  Baīscne*, not the palaeographer's remark. Same manuscript-text/commentary
  boundary `note` already draws for the search index.

  **An admin edit wins forever.** Editing a Headword in admin sets
  `headword_source` to `manual` and no later upload overwrites it. That is also
  where the team's own `person_name_list.csv` / `place_name_list.csv` will land
  if they are ever wired in — a second source for the same field, changing
  nothing else in this model.

  An earlier corpus stated it in the TEI itself: the `type="canonical"` child of
  a `standOff` `person`/`place`. Those witnesses were superseded in #162; the
  reading side still resolves `@ref`, because the app consumes TEI it did not
  author. _Avoid_: lemma, preferred name, canonical name (say Headword).

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

  ### Expansion

  **The letters the editor supplied that the scribe did not write** — the resolved
  part of an abbreviation. Marked `<expan>`, and the reading pane sets it in
  italic, the convention of a printed Irish diplomatic edition
  ([ADR-0018](docs/adr/0018-reading-pane-reproduces-the-printed-editions-conventions.md)).

  This corpus's `<expan>` is **non-standard TEI and the definition follows the
  corpus, not the spec**. Standard TEI makes `<expan>` a *container* holding an
  `<abbr>` + `<ex>` pair — the whole abbreviation, both halves. Here it wraps only
  the supplied letters, inline inside a word: `rīa<expan>n</expan>` is the word
  `rīan`, of which the scribe wrote `rīa`. There is no `abbr`, `ex` or `choice` in
  any of the four manuscripts, so nothing depends on the standard reading, and a
  reader who assumes it will misread 2767 elements as whole words.

  An Expansion never bounds a Word: `tal<expan>am</expan>` is the single word
  `talam` (see **Word (index term)**), and the italic changes how a character is
  drawn, not how many there are, so no search offset moves.
  _Avoid_: abbreviation (that is what an Expansion resolves, and the corpus never
  marks it); "expansion" for a UI panel opening.

  ### Manuscript Locator

  **A pointer into the physical Manuscript** — its folio, page or column:
  `fol.124ra`, `p.36b`. Carried by `<cb>` and by a `<pb>` with an `@edRef`, always
  in `@n`. The reading pane sets it **bold in square brackets** — `[fol.124ra]`.

  The value goes out **verbatim**: `@n` is a page in one manuscript and a folio in
  the next, and several already carry their own prefix, so nothing is added to it
  and nothing is parsed out of it. The brackets are the *editor's mark*, the same
  class as `supplied`'s `⟨⟩` — they wrap the value without reading it.

  A `<pb>` whose next sibling element is a `<cb>` is not shown: the column
  extends the page (`fol.124` → `fol.124ra`), so the column locator already says
  everything the page locator said. It stays in the DOM.
  _Avoid_: page number (it is often neither a page nor a number); anchor (an
  anchor is the app's own id for an element, not the manuscript's own address).

  ### Print-Edition Locator

  **A pointer into Stokes's modern printed edition** — one of its pages, named by
  `<pb xml:id="Stokes_p.69">`. A **different coordinate system** from the
  Manuscript Locator: it addresses a printed book about the text, not the
  handwritten book the text is in. The two are told apart on the page by their
  rendering — the Print-Edition Locator gets a **tinted box and no brackets**.

  Shown **verbatim, underscore and all**. `Stokes_p.69` is not reformatted to
  `p. 69` and the `Stokes_` is not stripped: parsing a locator is what produced
  `p. p.35` (ADR-0016), differing only in which direction it guesses.
  _Avoid_: page break (that is the tag, and it carries either coordinate system);
  edition (a Version is the app's word for one witness of a Work).

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

  Because it is not searchable, the workspace **says so three times, each where it
  is useful** (#175): the `Add Text` tooltip states the limit *before* a file is
  picked; a **`Reading only`** chip sits beside the column title *for as long as
  the column is open* — not searchable is a property of the Document, true from
  the moment it opens and independent of any Search Attempt, so it belongs to the
  header and never to a result card; and *after* a search the column shows **no
  result card at all**. The silence is the same distinction the **Tag Filter**
  keeps (#164): "No search results" is a claim about the file's text, made where
  the truth is that the file was never asked — so the column that was not asked
  gets no answer slot. `isSearchableDocument` (`client/src/store/documentStore.ts`)
  is the single rule both the search and the column read, so the two cannot drift;
  the words themselves live together in
  `client/src/workspace/panels/localDocumentCopy.ts`, so no later change fixes one
  surface and leaves another claiming the opposite.

  The wording never says **"upload"** — a Local Document never reaches a server,
  and calling it an upload would tell visitors the opposite of the best property
  this feature has. For the same reason the onboarding tour offers a visitor's own
  file "to read alongside" the versions, and never as something to search.

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

  ### Tour

  The workspace's **taught** first-run walkthrough: a spotlight ring on one
  control at a time, with a card that names **one action to perform now**. It is
  non-blocking — the page underneath stays fully interactive — and it advances
  because the reader performs that action, not because they press Next
  ([ADR-0022](docs/adr/0022-the-tour-advances-as-the-workspace-changes.md)). Next
  is still there, and always moves forward, so a step nobody wants to perform
  never holds anyone; Back returns as far as the workspace's own answer. Shown
  once on a first visit, re-openable from **Help** forever after.

  The third and most demanding member of the workspace's first-run triad, and the
  three divide the work cleanly:

  - The **Entry Notice** *discloses* (usage is recorded) — one banner, shown to
    everyone, dismissed and gone. It states a fact; nothing is being taught.
  - The **drag-reorder hint** *reveals one affordance* the column strip does not
    advertise (columns can be dragged into a different order). One line, no ring,
    no sequence, and it dismisses itself the moment a drag proves the reader
    already knew — the smallest version of "taught" there is. It appears the
    moment a second column does, which is why the Tour, whose ninth step teaches
    the same thing, keeps it out of the way while it runs and marks it
    acknowledged once that step is passed; a skipped Tour leaves it untouched.
  - The **Tour** *teaches a workflow*: eleven steps that build on one another —
    open two versions of one work, search a passage of one against the other,
    move through what comes back — each waiting on the workspace itself. Names
    and quotations in its copy are **examples, never targets**: every step waits
    on the shape of the action (any work expanded, any two versions ticked, any
    passage selected), because the corpus decides what is listed and in what
    order.

  All three persist their dismissal in `localStorage` and never reach the
  backend, so what a visitor has been shown is a property of the browser, not of
  a User — none of it is study data. _Avoid_: onboarding modal, walkthrough
  wizard, tutorial — a Tour blocks nothing, takes no control of the workspace,
  and teaches by having the reader use the real thing.
