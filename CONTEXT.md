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

  **Canonical default: `1.3`** (i.e. 130%). Aligned across all layers:

  | Layer | Location | Value |
  | --- | --- | --- |
  | UI control "Match Length" | `client/src/workspace/panels/AdvancedSearchPopover.tsx` | slider
  0–300 %, reset → 130 |
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

  History: see issue #19 — defaults previously disagreed across layers
  (`0.5` / `1.0` / `1.2` / `1.3`), and the backend `1.3` was dead code because
  the client always sent a value. Canonicalised to `1.3` everywhere.