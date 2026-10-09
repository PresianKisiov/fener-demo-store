import type { Metadata } from "next";
import { TrackForm } from "@/components/TrackForm";

export const metadata: Metadata = { title: "Проследяване на поръчка" };

export default function TrackingPage() {
  return (
    <div className="mx-auto max-w-3xl py-6">
      <h1 className="font-display text-3xl font-medium">Проследяване на поръчка</h1>
      <p className="mt-3 text-ink-soft">Номерът е в имейла с потвърждението. Търсим само по номер и имейл заедно.</p>
      <div className="mt-8">
        <TrackForm />
      </div>
    </div>
  );
}
