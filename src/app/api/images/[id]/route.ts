/**
 * GET /api/images/12: the bytes of product photo 12.
 * A photo never changes under the same id (a new upload gets a new id), so the
 * browser and the CDN may keep it for a year without asking again.
 * Photos of hidden (draft) products are shown only to a logged-in admin, and never cached.
 */
import { getCurrentAdmin } from "@/server/auth";
import { imageData } from "@/server/images";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Not found", { status: 404 });
  const image = await imageData(id);
  if (!image) return new Response("Not found", { status: 404 });
  if (!image.published && !(await getCurrentAdmin())) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": image.published ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
