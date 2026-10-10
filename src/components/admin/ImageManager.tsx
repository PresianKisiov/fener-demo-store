"use client";
/**
 * Upload, order and delete product photos.
 *
 * A phone photo is 3-8 MB. Before uploading, the browser shrinks it to at most
 * 1600 px on the long side and saves it as WebP (about 100-250 KB). The customer's
 * phone then loads a light page, and the database stays small.
 */
import { useRef, useState, useTransition } from "react";
import { deleteProductImageAction, moveProductImageAction, uploadProductImageAction } from "@/app/actions/images";

const MAX_SIDE = 1600;

async function compress(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  // imageOrientation: phone photos store "rotate me" separately; this applies it.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const toBlob = (type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob("image/webp", 0.82);
  // Older Safari cannot make WebP and silently returns PNG: use JPEG there.
  if (!blob || blob.type !== "image/webp") blob = await toBlob("image/jpeg", 0.85);
  if (!blob) throw new Error("Браузърът не успя да обработи снимката.");
  return { blob, width, height };
}

type Image = { id: number; width: number; height: number };

export function ImageManager({ productId, productName, images }: { productId: number; productName: string; images: Image[] }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, startTransition] = useTransition();
  const [message, setMessage] = useState<{ error?: string; info?: string }>({});

  function upload(files: FileList | null) {
    if (!files?.length) return;
    startTransition(async () => {
      const errors: string[] = [];
      let done = 0;
      for (const file of Array.from(files)) {
        try {
          setMessage({ info: `Обработваме ${file.name}...` });
          const { blob, width, height } = await compress(file);
          const data = new FormData();
          data.set("productId", String(productId));
          data.set("width", String(width));
          data.set("height", String(height));
          data.set("file", blob, blob.type === "image/webp" ? "photo.webp" : "photo.jpg");
          const result = await uploadProductImageAction(data);
          if (result.error) errors.push(`${file.name}: ${result.error}`);
          else done++;
        } catch {
          errors.push(`${file.name}: не може да се отвори като снимка. Пробвай JPEG или PNG.`);
        }
      }
      setMessage(errors.length ? { error: errors.join(" ") } : { info: `Качени снимки: ${done}.` });
      if (input.current) input.current.value = "";
    });
  }

  return (
    <section className="adm-card space-y-4 p-5 sm:p-6" aria-labelledby="photos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="photos" className="text-lg font-extrabold">Снимки</h2>
        <label className={`adm-btn cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Качваме..." : "Добави снимки"}
          <input ref={input} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files)} disabled={busy} />
        </label>
      </div>
      <p className="text-sm text-adm-muted">Първата снимка се показва в каталога. Снимките се смаляват в браузъра до 1600 px, преди да се качат.</p>
      {message.error && <p role="alert" className="text-sm font-semibold text-adm-down">{message.error}</p>}
      {message.info && !message.error && <p role="status" className="text-sm text-adm-muted">{message.info}</p>}

      {images.length === 0 ? (
        <p className="rounded-xl bg-adm-bg p-6 text-center text-sm text-adm-muted">Няма снимки. В магазина се показва рисунката.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {images.map((image, i) => (
            <li key={image.id} className="space-y-2">
              <img
                src={`/api/images/${image.id}`}
                alt={`${productName}, снимка ${i + 1}`}
                width={image.width}
                height={image.height}
                className="aspect-square w-full rounded-xl bg-adm-bg object-cover"
              />
              <div className="flex flex-wrap gap-1 text-xs">
                {i === 0 && <span className="rounded-full bg-adm-blue-soft px-2 py-1 font-bold text-adm-blue">Основна</span>}
                {i > 0 && (
                  <form action={moveProductImageAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="direction" value="up" />
                    <button className="adm-btn-ghost px-2 py-1 text-xs" aria-label={`Премести снимка ${i + 1} напред`}>Напред</button>
                  </form>
                )}
                {i < images.length - 1 && (
                  <form action={moveProductImageAction}>
                    <input type="hidden" name="imageId" value={image.id} />
                    <input type="hidden" name="direction" value="down" />
                    <button className="adm-btn-ghost px-2 py-1 text-xs" aria-label={`Премести снимка ${i + 1} назад`}>Назад</button>
                  </form>
                )}
                <form action={deleteProductImageAction}>
                  <input type="hidden" name="imageId" value={image.id} />
                  <button className="adm-btn-ghost px-2 py-1 text-xs text-adm-down" aria-label={`Изтрий снимка ${i + 1}`}>Изтрий</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
