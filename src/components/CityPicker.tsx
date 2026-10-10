"use client";
/**
 * Type a few letters, pick the city. Works with the keyboard (arrows, Enter, Escape)
 * and on phones, where a long <select> of 200 cities is painful to scroll.
 * The chosen city goes to the server in a hidden field named `name`.
 */
import { useId, useState } from "react";

const norm = (s: string) => s.toLocaleLowerCase("bg").replace(/\s+/g, " ").trim();

export function filterCities(cities: string[], query: string, limit = 8): string[] {
  const q = norm(query);
  if (!q) return [];
  const starts = cities.filter((c) => norm(c).startsWith(q));
  const contains = cities.filter((c) => !norm(c).startsWith(q) && norm(c).includes(q));
  return [...starts, ...contains].slice(0, limit);
}

export function CityPicker({
  id,
  name,
  cities,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  name: string;
  cities: string[];
  value: string;
  onChange: (city: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // When the parent clears the city (another courier chosen), clear the text too.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setQuery(value);
  }

  const matches = filterCities(cities, query);

  function choose(city: string) {
    setQuery(city);
    setOpen(false);
    onChange(city);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (event.key === "Enter" && open && matches[active]) {
      // Enter picks the city instead of sending the whole order form.
      event.preventDefault();
      choose(matches[active]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  function onBlur() {
    setOpen(false);
    // Typed the full name without clicking: accept it if it is a known city.
    const exact = cities.find((c) => norm(c) === norm(query));
    if (exact && exact !== value) choose(exact);
  }

  const showList = open && matches.length > 0;
  const noMatch = open && norm(query).length > 0 && matches.length === 0;

  return (
    <div className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder="Напиши първите букви, например Габ"
        className="field"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
          if (value) onChange("");
        }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
      />
      <input type="hidden" name={name} value={value} />
      {showList && (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-2xl border-[1.5px] border-line bg-white py-1 shadow-lg">
          {matches.map((city, i) => (
            <li
              key={city}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-4 py-2.5 ${i === active ? "bg-mist" : ""}`}
              // mousedown, not click: it fires before the input loses focus and closes the list.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(city);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {city}
            </li>
          ))}
        </ul>
      )}
      {noMatch && <p className="mt-1 text-sm text-ink-soft">Няма офис в населено място с такова име. Пробвай друго или доставка до адрес.</p>}
    </div>
  );
}
