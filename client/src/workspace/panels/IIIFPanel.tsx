import { useCallback, useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";


type ManuscriptSource =
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

interface ManuscriptConfig {
  id: string;
  label: string;
  source: ManuscriptSource;
}

// hardcoded: only displays these three manuscripts
const MANUSCRIPTS: ManuscriptConfig[] = [
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


export default function IIIFPanel() {
  const [selectedId, setSelectedId] = useState(MANUSCRIPTS[0].id);
  // derived from the config, like the <select>'s onChange, so the first render
  // lands on the default manuscript's own opening page rather than page 1
  const [page, setPage] = useState(MANUSCRIPTS[0].source.initialPage);
  const [canvases, setCanvases] = useState<string[]>([]); // manifest mode: image service URLs
  const viewerRef = useRef<HTMLDivElement>(null);
  const osdRef = useRef<OpenSeadragon.Viewer | null>(null);

  const syncViewerSize = useCallback((resetZoom = false) => {
    const viewer = osdRef.current;
    if (!viewer || !viewer.isOpen()) return;

    viewer.forceResize();
    viewer.viewport.applyConstraints(true);

    if (resetZoom) {
      viewer.viewport.goHome(true);
    }
  }, []);

  const manuscript = MANUSCRIPTS.find((m) => m.id === selectedId)!;
  const source = manuscript.source;
  const totalPages = source.kind === "image-api" ? source.totalPages : canvases.length;

  // init OSD once
  useEffect(() => {
    if (!viewerRef.current) return;
    osdRef.current = OpenSeadragon({
      element: viewerRef.current,
      prefixUrl: "https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/",
      showNavigationControl: false,
      gestureSettingsMouse: { clickToZoom: false },
    });

    const viewer = osdRef.current;
    const handleOpen = () => {
      requestAnimationFrame(() => syncViewerSize(true));
    };
    viewer.addHandler("open", handleOpen);

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => syncViewerSize(false));
    });
    resizeObserver.observe(viewerRef.current);

    return () => {
      resizeObserver.disconnect();
      viewer.removeHandler("open", handleOpen);
      viewer.destroy();
      osdRef.current = null;
    };
  }, [syncViewerSize]);


  // when a manifest-backed manuscript is selected, load its canvas image URLs
  useEffect(() => {
    if (source.kind === "image-api") return;
    let cancelled = false;
    fetch(source.manifestUrl)
      .then((r) => r.json())
      .then((manifest) => {
        if (cancelled) return;
        // support IIIF v2 and v3
        const context: string = manifest["@context"] ?? "";
        if (context.includes("presentation/3")) {
          const urls: string[] = manifest.items.map(
            (canvas: { items: { items: { body: { service: { id: string }[] } }[] }[] }) =>
              canvas.items[0].items[0].body.service[0].id
          );
          setCanvases(urls);
        } else {
          const urls: string[] = manifest.sequences[0].canvases.map(
            (canvas: { images: { resource: { service: { "@id": string } } }[] }) =>
              canvas.images[0].resource.service["@id"]
          );
          setCanvases(urls);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  // open OSD tile when page or canvases change
  useEffect(() => {
    if (!osdRef.current) return;
    if (source.kind === "image-api") {
      osdRef.current.open({
        tileSource: `${source.pageTileUrl(page)}/info.json`,
      });
    } else if (canvases.length > 0 && canvases[page - 1]) {
      osdRef.current.open({ tileSource: `${canvases[page - 1]}/info.json` });
    }
  }, [page, canvases, selectedId, source]);

  return (
    <aside className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <select
          value={selectedId}
          onChange={(e) => {
            const next = MANUSCRIPTS.find((m) => m.id === e.target.value)!;
            setSelectedId(next.id);
            setPage(next.source.initialPage);
            setCanvases([]);
          }}
          className="min-w-0 flex-1 truncate rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-700
 cursor-pointer"
        >
          {MANUSCRIPTS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>

        <div className="ml-2 flex items-center gap-1">
          <button
            type="button"
            onClick={() => osdRef.current?.viewport.zoomBy(1.5)}
            className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 hover:bg-gray-100
cursor-pointer transition-colors"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => osdRef.current?.viewport.zoomBy(0.67)}
            className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 hover:bg-gray-100
cursor-pointer transition-colors"
            title="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => osdRef.current?.viewport.goHome()}
            className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 hover:bg-gray-100
cursor-pointer transition-colors"
            title="Reset zoom"
          >
            ⊡
          </button>
          <div className="mx-1 h-4 w-px bg-gray-300" />
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 hover:bg-gray-100
cursor-pointer transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-gray-600">{page}{totalPages > 0 ? ` / ${totalPages}` : ""}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages || p, p + 1))}
            className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 hover:bg-gray-100
cursor-pointer transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div ref={viewerRef} className="min-h-0 flex-1" />

      <div className="border-t border-gray-100 px-4 py-1.5 text-xs text-gray-400">
        Scroll to zoom · Drag to pan · Pinch on touchscreen
      </div>
    </aside>
  );
}