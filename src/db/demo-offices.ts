/**
 * Offices the shop starts with, before the first sync from the courier API.
 *
 * The Econt ones are real offices from Econt's test system (codes checked on
 * 10.10.2026), so a waybill created in Econt's demo mode is accepted right away.
 * The Speedy ones are invented: Speedy gives API access only on request, so
 * Speedy runs in mock mode until you get a test account.
 */
import type { SyncedOffice } from "../server/shipping/types";

type DemoOffice = SyncedOffice & { courier: "econt" | "speedy" };

const WEEK = (from: string, to: string, satFrom = "09:00", satTo = "13:00") => `пон-пет ${from}-${to}, съб ${satFrom}-${satTo}`;

export const DEMO_OFFICES: DemoOffice[] = [
  { courier: "econt", code: "5306", kind: "office", city: "Габрово", postCode: "5300", name: "Габрово", address: "ул. Доктор Заменхоф №3 Под Автогарата", hours: WEEK("08:30", "18:30") },
  { courier: "econt", code: "1127", kind: "office", city: "София", postCode: "1000", name: "София", address: "ул. Резбарска №11", hours: WEEK("06:00", "21:00") },
  { courier: "econt", code: "10068", kind: "office", city: "София", postCode: "1000", name: "София - Коста Москов", address: "кв. Хладилника ул. Филип Кутев №137", hours: WEEK("09:00", "21:00") },
  { courier: "econt", code: "40008", kind: "office", city: "Пловдив", postCode: "4000", name: "Пловдив - Андреана Гърова", address: "Район Южен ул. Кукленско Шосе №11", hours: WEEK("09:00", "18:00") },
  { courier: "econt", code: "9035", kind: "office", city: "Варна", postCode: "9000", name: "Варна", address: "бул. Република №59", hours: WEEK("08:30", "13:05", "08:30", "13:30") },
  { courier: "econt", code: "5007", kind: "office", city: "Велико Търново", postCode: "5000", name: "Велико Търново Бузлуджа", address: "ж.к. Бузлуджа ул. Димитър Благоев №40", hours: WEEK("09:00", "18:00") },
  { courier: "econt", code: "1702", kind: "locker", city: "Русе", postCode: "7000", name: "Еконтомат Русе", address: "бул. Тутракан №8", hours: WEEK("09:00", "23:00") },
  { courier: "speedy", code: "901", kind: "office", city: "Габрово", postCode: "5300", name: "Спиди Габрово (демо)", address: "ул. Демо 9", hours: WEEK("09:00", "18:30") },
  { courier: "speedy", code: "902", kind: "locker", city: "Габрово", postCode: "5300", name: "Спиди автомат Габрово (демо)", address: "ул. Примерна 54", hours: "24/7" },
  { courier: "speedy", code: "903", kind: "office", city: "София", postCode: "1000", name: "Спиди София Младост (демо)", address: "ул. Демо 101", hours: WEEK("09:00", "20:00") },
  { courier: "speedy", code: "904", kind: "office", city: "Пловдив", postCode: "4000", name: "Спиди Пловдив Център (демо)", address: "ул. Демо 4", hours: WEEK("09:00", "19:00") },
  { courier: "speedy", code: "905", kind: "locker", city: "Варна", postCode: "9000", name: "Спиди автомат Варна (демо)", address: "ул. Демо 66", hours: "24/7" },
  { courier: "speedy", code: "906", kind: "office", city: "Велико Търново", postCode: "5000", name: "Спиди В. Търново (демо)", address: "ул. Демо 31", hours: WEEK("09:00", "18:00") },
];
