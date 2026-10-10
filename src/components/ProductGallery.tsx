"use client";
/** Big photo plus thumbnails. Without photos the product's drawing is shown instead. */
import { useState } from "react";
import { LampArt } from "./LampArt";

type Image = { id: number; width: number; height: number };

export function ProductGallery({ name, illustration, images }: { name: string; illustration: string; images: Image[] }) {
  const [current, setCurrent] = useState(0);
  if (images.length === 0) {
    return (
      <div className="glow-plate aspect-square rounded-[36px] p-10">
        <LampArt kind={illustration} className="h-full w-full" title={`Рисунка: ${name}`} />
      </div>
    );
  }
  const main = images[Math.min(current, images.length - 1)];
  return (
    <div>
      <img
        src={`/api/images/${main.id}`}
        alt={`${name}, снимка ${current + 1} от ${images.length}`}
        width={main.width}
        height={main.height}
        fetchPriority="high"
        className="aspect-square w-full rounded-[36px] bg-mist object-cover"
      />
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((image, i) => (
            <li key={image.id}>
              <button
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Покажи снимка ${i + 1}`}
                aria-current={i === current}
                className={`block size-16 overflow-hidden rounded-xl border-2 ${i === current ? "border-night" : "border-transparent"}`}
              >
                <img src={`/api/images/${image.id}`} alt="" width={64} height={64} loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
