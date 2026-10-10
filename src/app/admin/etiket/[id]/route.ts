/**
 * GET /admin/etiket/123: the printable label of shipment 123.
 * Econt gives a ready PDF link, so we redirect to it. Speedy (and the mock courier)
 * make the label on request, so we fetch it here and pass it to the browser.
 * The courier password never reaches the browser: only this server talks to the courier.
 */
import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/server/auth";
import { CourierError } from "@/server/shipping";
import { labelFor } from "@/server/shipping/service";

const text = (body: string, status: number) => new NextResponse(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getCurrentAdmin())) return text("Влез в админ панела.", 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return text("Няма такъв етикет.", 404);
  try {
    const label = await labelFor(id);
    if (!label) return text("Няма такъв етикет.", 404);
    if ("redirect" in label) return NextResponse.redirect(label.redirect!);
    return new NextResponse(label.file.body, {
      headers: {
        "Content-Type": label.file.contentType,
        "Content-Disposition": `inline; filename="etiket-${label.trackingNumber}.${label.file.contentType.includes("pdf") ? "pdf" : "html"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof CourierError) return text(error.message, 502);
    throw error;
  }
}
