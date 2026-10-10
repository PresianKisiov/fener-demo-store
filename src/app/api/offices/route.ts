/**
 * GET /api/offices?courier=econt&kind=office&city=Габрово
 * The checkout calls this when the customer picks a city. Public on purpose:
 * office addresses are public information, and the answer is read from our own
 * database, so customers never wait for the courier's API.
 */
import { NextResponse, type NextRequest } from "next/server";
import { listOfficesInCity } from "@/server/couriers";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const courier = p.get("courier") ?? "";
  const kind = p.get("kind") ?? "";
  const city = (p.get("city") ?? "").slice(0, 80);
  if (!["econt", "speedy"].includes(courier) || !["office", "locker"].includes(kind) || !city) {
    return NextResponse.json({ offices: [] }, { status: 400 });
  }
  const offices = await listOfficesInCity(courier, kind, city);
  return NextResponse.json({ offices }, { headers: { "Cache-Control": "public, max-age=300" } });
}
