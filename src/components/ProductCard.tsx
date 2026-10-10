import Link from "next/link";
import type { Product } from "@/db/schema";
import type { ImageMeta } from "@/server/images";
import { LampArt } from "./LampArt";
import { PriceBlock } from "./PriceBlock";

export function ProductCard({ product, image }: { product: Product; image?: Pick<ImageMeta, "id" | "width" | "height"> }) {
  return (
    <article className="group">
      <Link href={`/produkt/${product.slug}`} className="block rounded-[28px]">
        {image ? (
          <img
            src={`/api/images/${image.id}`}
            alt={product.name}
            width={image.width}
            height={image.height}
            loading="lazy"
            decoding="async"
            className="aspect-square w-full rounded-[28px] bg-mist object-cover transition-transform duration-200 group-hover:-translate-y-1"
          />
        ) : (
          <div className="glow-plate aspect-square rounded-[28px] p-8 transition-transform duration-200 group-hover:-translate-y-1">
            <LampArt kind={product.illustration} className="h-full w-full" />
          </div>
        )}
        <h3 className="mt-4 text-lg font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">
          {product.name}
        </h3>
      </Link>
      <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{product.shortDescription}</p>
      <div className="mt-2">
        <PriceBlock
          priceCents={product.priceCents}
          priorPriceCents={product.priorPriceCents}
          measureUnit={product.measureUnit}
          measureQuantityMilli={product.measureQuantityMilli}
        />
      </div>
    </article>
  );
}
