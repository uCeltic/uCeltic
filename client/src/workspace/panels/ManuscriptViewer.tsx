import { useCallback, useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import type { ManuscriptConfig } from "../manuscripts";


/**
 * One Manuscript's page images, inside its Column (ADR-0025). One book per
 * viewer: there is no switcher — changing book is closing this Column and
 * opening another — so the book is fixed for the viewer's lifetime.
 *
 * The OpenSeadragon instance is created once on mount and re-fitted whenever
 * its box changes, which is what keeps it intact through a drag, a column
 * resize or the strip scrolling sideways.
 */
export default function ManuscriptViewer({
  manuscript,
}: {
  manuscript: ManuscriptConfig;
}) {
  const source = manuscript.source;
  // seeded from the config, so the viewer lands on the book's own opening page
  // rather than page 1
  const [page, setPage] = useState(source.initialPage);
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
  }, [page, canvases, source]);

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="flex items-center justify-end border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1">
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
            aria-label="Previous page"
            title="Previous page"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-gray-300 px-2 py-0.5 text-sm text-gray-700 hover:bg-gray-100
cursor-pointer transition-colors"
          >
            ←
          </button>
          <span className="text-sm text-gray-600">{page}{totalPages > 0 ? ` / ${totalPages}` : ""}</span>
          <button
            type="button"
            aria-label="Next page"
            title="Next page"
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
    </div>
  );
}