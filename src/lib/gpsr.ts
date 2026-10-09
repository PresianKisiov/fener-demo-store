/**
 * Product safety (GPSR): which fields are still missing before a product may be published.
 */
type SafetyFields = {
  modelNumber: string;
  manufacturerName: string;
  manufacturerAddress: string;
  manufacturerEmail: string;
  manufacturerInEu: boolean;
  euResponsibleName: string;
  euResponsibleAddress: string;
  euResponsibleEmail: string;
  safetyWarnings: string;
};

export function missingSafetyFields(p: SafetyFields): string[] {
  const missing: string[] = [];
  if (!p.modelNumber.trim()) missing.push("модел");
  if (!p.manufacturerName.trim()) missing.push("производител");
  if (!p.manufacturerAddress.trim()) missing.push("адрес на производителя");
  if (!p.manufacturerEmail.trim()) missing.push("имейл на производителя");
  if (!p.manufacturerInEu) {
    if (!p.euResponsibleName.trim()) missing.push("отговорно лице в ЕС");
    if (!p.euResponsibleAddress.trim()) missing.push("адрес на отговорното лице");
    if (!p.euResponsibleEmail.trim()) missing.push("имейл на отговорното лице");
  }
  if (!p.safetyWarnings.trim()) missing.push("предупреждения за безопасност");
  return missing;
}
