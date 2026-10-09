import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-medium">Тази страница не съществува</h1>
      <p className="mt-3 text-ink-soft">Може адресът да е сгрешен или продуктът вече да не се предлага.</p>
      <Link href="/katalog" className="btn-primary mt-8">Към лампите</Link>
    </div>
  );
}
