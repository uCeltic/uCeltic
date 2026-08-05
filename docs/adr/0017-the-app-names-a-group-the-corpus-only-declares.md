# ADR-0017 — The app names a group the corpus only declares

- Status: accepted
- Date: 2026-08-05
- Issue: #163 (follows #162)

## Context

The workspace's whole premise is following one person or place across four
manuscript columns at once. That is only answerable because the corpus states
which spellings are the same entity — the four witnesses write *Find*, *Fionn*,
*Find* and *Finn*, and all four carry `nymRef="F64"`.

Until #162 the corpus stated it *and* named it: each witness carried a `standOff`
authority list, and a `type="canonical"` child gave every group a headword. The
app read both out of the file and invented nothing. CONTEXT.md recorded that as
a principle — "the grouping is **the corpus's claim, not ours** — the app never
infers it from the text."

The re-cut witnesses carry the grouping and nothing else: 670 named entities,
91 bare `@nymRef` ids, and no file that says what one stands for. `F64` is
opaque. The Tag Filter has been empty since, because an id with no name is not
an option a reader can be offered.

## Decision

**The app derives a Headword, and says so.** A group's name is read out of the
corpus's own spellings — the most frequent surface form in the first document to
introduce the code — and stored in a register (`NameEntity`) outside the TEI.

The principle is narrowed rather than dropped: **the grouping stays the corpus's
claim; the label becomes ours.** Nothing here decides that two spellings are one
person. It only puts a name on a group the corpus already declared.

Three properties keep the derivation honest:

- **It is not authority.** The `@nymRef` code is printed beside the headword in
  every menu row, so a researcher can always see what the app is actually
  grouping on, and cross-check it against their own name lists.
- **It is overridable, permanently.** An admin edit sets
  `headword_source = manual` and no upload overwrites it. The team's own
  `person_name_list.csv` / `place_name_list.csv` will land in the same field.
- **It never moves on its own.** A headword is fixed by the first document to
  introduce a code and is never recomputed, so uploading a fifth manuscript
  cannot rename an entity a researcher has learned to recognise.

## Alternatives

**Leave the menu empty until the team supplies a name list.** The honest state,
and the state #162 shipped — but it makes the four-column layout unusable for
its own purpose for as long as that takes, and the corpus's spellings are a
better first guess than nothing. The register is the same shape either way; a
CSV import becomes a second source for one field.

**Print the raw code (`F64 · 21 · 10 · 17 · 16`).** Derives nothing, and is
unreadable: a reader cannot tell F64 from F46 or F55, and the point of the menu
is recognising a person.

**Ask the annotators to add a `standOff` back.** Right answer, wrong timescale —
and the app consumes TEI it did not author. If a later re-cut supplies one, this
register keeps working and the derived headwords are the ones it replaces.

## Consequences

- CONTEXT.md's **Headword** entry no longer describes a TEI construct. Its
  "never infers it from the text" line now applies to **Entity Grouping** only,
  and the new **Name Register** entry states where the label comes from.
- A derived headword can be wrong — a group whose most frequent spelling is an
  inflected form gets an inflected label. That is visible, cheap to fix in
  admin, and does not affect what a selection matches, which is the code.
- The register is a second thing to keep in step with the corpus. It is
  aggregated from the documents' own `name_index` on every parse rather than
  incremented, so re-uploading a corrected file takes back what its previous
  parse claimed; `reparse_tei` is the deploy step that rebuilds it.
