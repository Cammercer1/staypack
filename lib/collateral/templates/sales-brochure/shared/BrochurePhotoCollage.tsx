const GAP = "gap-[3px]";

/** Single image frame that fills its grid/flex cell. */
function Frame({ src, className = "" }: { src: string; className?: string }) {
  return (
    <div className={`min-h-0 h-full overflow-hidden bg-neutral-200 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

/**
 * Full-height photo collage that adapts its layout to the number of images
 * supplied (1–6). Designed to fill a `flex-1` / `h-full` region edge-to-edge.
 */
export function BrochurePhotoCollage({
  photos,
  className = "",
}: {
  photos: string[];
  className?: string;
}) {
  const imgs = photos.filter(Boolean).slice(0, 6);
  if (!imgs.length) return null;

  if (imgs.length === 1) {
    return (
      <div className={`h-full ${className}`}>
        <Frame src={imgs[0]} />
      </div>
    );
  }

  if (imgs.length === 2) {
    return (
      <div className={`grid h-full grid-rows-2 ${GAP} ${className}`}>
        <Frame src={imgs[0]} />
        <Frame src={imgs[1]} />
      </div>
    );
  }

  if (imgs.length === 3) {
    return (
      <div className={`flex h-full flex-col ${GAP} ${className}`}>
        <div className="min-h-0 flex-[1.5]">
          <Frame src={imgs[0]} />
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-2 ${GAP}`}>
          <Frame src={imgs[1]} />
          <Frame src={imgs[2]} />
        </div>
      </div>
    );
  }

  if (imgs.length === 4) {
    return (
      <div className={`flex h-full flex-col ${GAP} ${className}`}>
        <div className="min-h-0 flex-[1.45]">
          <Frame src={imgs[0]} />
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-3 ${GAP}`}>
          <Frame src={imgs[1]} />
          <Frame src={imgs[2]} />
          <Frame src={imgs[3]} />
        </div>
      </div>
    );
  }

  if (imgs.length === 5) {
    return (
      <div className={`flex h-full flex-col ${GAP} ${className}`}>
        <div className={`grid min-h-0 flex-[1.3] grid-cols-2 ${GAP}`}>
          <Frame src={imgs[0]} />
          <Frame src={imgs[1]} />
        </div>
        <div className={`grid min-h-0 flex-1 grid-cols-3 ${GAP}`}>
          <Frame src={imgs[2]} />
          <Frame src={imgs[3]} />
          <Frame src={imgs[4]} />
        </div>
      </div>
    );
  }

  // 6 — gallery wall: 2×2 feature with two stacked frames, then a row of three.
  const [feature, b, c, d, e, f] = imgs;
  return (
    <div className={`flex h-full flex-col ${GAP} ${className}`}>
      <div className={`grid min-h-0 flex-[1.6] grid-cols-3 grid-rows-2 ${GAP}`}>
        <Frame src={feature} className="col-span-2 row-span-2" />
        <Frame src={b} />
        <Frame src={c} />
      </div>
      <div className={`grid min-h-0 flex-1 grid-cols-3 ${GAP}`}>
        <Frame src={d} />
        <Frame src={e} />
        <Frame src={f} />
      </div>
    </div>
  );
}
