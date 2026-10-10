/**
 * Picks the adapter for a courier from the environment settings (see config.ts).
 * This is the only place that knows which courier runs in which mode.
 */
import type { CourierId } from "../../lib/settings";
import { courierMode } from "./config";
import { econtAdapter } from "./econt";
import { mockAdapter } from "./mock";
import { speedyAdapter } from "./speedy";
import type { CourierAdapter, CourierMode } from "./types";

export function getCourier(courier: CourierId): CourierAdapter {
  const mode = courierMode(courier);
  if (mode === "mock") return mockAdapter(courier);
  if (courier === "econt") return econtAdapter(mode);
  return speedyAdapter();
}

export const MODE_LABEL: Record<CourierMode, string> = {
  mock: "Симулация",
  demo: "Тестова система",
  live: "Реален акаунт",
};

export const MODE_NOTE: Record<CourierMode, string> = {
  mock: "Няма връзка с куриера. Номерата и статусите се измислят от магазина. Пратката се „взема“ 2 минути след товарителницата и се „доставя“ след още 2, както при истински куриер статусът зависи от времето, а не от броя проверки.",
  demo: "Истински заявки към тестовата система на куриера: истински номер на товарителница и PDF етикет, но куриер няма да дойде и статусът няма да се мени.",
  live: "Истински пратки. Товарителницата се таксува и куриерът ще дойде.",
};

export { CourierError } from "./types";
export type { CourierAdapter, CourierMode, ShipmentState } from "./types";
