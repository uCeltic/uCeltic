/**
 * The Manuscripts the toolbar can open, each as a Column of page images
 * (CONTEXT.md → Manuscript, Column; ADR-0025).
 *
 * Hard-coded: the project's fixed three. Declaring them in the database is
 * separate work, as is saying which Version transcribes which of them.
 */

export type ManuscriptSource =
  | {
    kind: "image-api";
    pageTileUrl: (p: number) => string;
    totalPages: number;
    initialPage: number;
  }
  | {
    kind: "manifest";
    manifestUrl: string;
    initialPage: number;
  };

export type ManuscriptId = string;

export interface ManuscriptConfig {
  id: ManuscriptId;
  label: string;
  source: ManuscriptSource;
}

export const MANUSCRIPTS: ManuscriptConfig[] = [
  {
    id: "book-of-lismore",
    label: "Book of Lismore (UCC)",
    source: {
      kind: "image-api",
      pageTileUrl: (p) => {
        const n = String(p).padStart(3, "0");
        return `https://iiif.isos.dias.ie/iiif/2/UCC%2FUCC_TheBookOfLismore%2F${n}.tif`;
      },
      totalPages: 500,
      initialPage: 325,
    },
  },
  {
    id: "ucd-ms-a-4",
    label: "UCD MS A 4",
    source: {
      kind: "image-api",
      pageTileUrl: (p) => {
        const n = String(p).padStart(2, "0");
        return `https://iiif.isos.dias.ie/iiif/2/UCD%2FUCD_MS_A_4%2F${n}.tif`;
      },
      totalPages: 86,
      initialPage: 3,
    },
  },
  {
    id: "bodleian-ms",
    label: "Bodleian MS Laud Misc. 610",
    source: {
      kind: "manifest",
      manifestUrl:
        "https://iiif.bodleian.ox.ac.uk/iiif/manifest/cb909a51-5acd-4fee-95ec-51ff09b87676.json",
      initialPage: 249,
    },
  },
];

export function findManuscript(id: ManuscriptId): ManuscriptConfig | undefined {
  return MANUSCRIPTS.find((m) => m.id === id);
}
