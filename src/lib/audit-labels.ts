/**
 * The audit log stores short English codes ("waybill EC123 cancelled"), because code reads
 * some of them back (for example "meta purchase: ok" stops a second send to Meta).
 * The order history in the admin shows them in Bulgarian through this function.
 */
const COURIER: Record<string, string> = { econt: "Еконт", speedy: "Спиди" };
const MODE: Record<string, string> = { mock: "симулация", demo: "тестова система", live: "реален акаунт" };

export function auditLabel(action: string): string {
  let m = /^waybill (\S+) \((\w+), (\w+)\)$/.exec(action);
  if (m) return `Товарителница ${m[1]} (${COURIER[m[2]] ?? m[2]}, ${MODE[m[3]] ?? m[3]})`;
  m = /^waybill (\S+) cancelled$/.exec(action);
  if (m) return `Анулирана товарителница ${m[1]}`;
  m = /^meta purchase: (.*)$/.exec(action);
  if (m) return m[1].startsWith("ok") ? "Покупката е отчетена към Meta" : `Meta не прие покупката: ${m[1]}`;
  m = /^amount_mismatch: expected (\d+), got (\d+)$/.exec(action);
  if (m) return `Плащане с грешна сума (очаквани ${m[1]} цента, получени ${m[2]})`;
  return action;
}
