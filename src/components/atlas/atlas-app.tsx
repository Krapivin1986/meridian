import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, Search, X } from "lucide-react";
import { BY_NAME, COUNTRIES, REGIONS, type CountryRow } from "@/data/countries";
import { METRICS, type MetricId } from "@/data/metrics";
import {
  formatUnit,
  formatValue,
  rampGradient,
  rankOf,
  searchCountries,
  shareOfMax,
  STATS,
  versusMedian,
} from "@/lib/atlas";
import { WorldMap, type MapHandle } from "@/components/atlas/world-map";

const GRADIENT = rampGradient();

export function AtlasApp() {
  const [metric, setMetric] = useState<MetricId>("life");
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<MapHandle>(null);
  const stat = STATS[metric];
  const country = selected ? (BY_NAME.get(selected) ?? null) : null;

  function choose(name: string, focus: boolean) {
    setSelected(name);
    if (focus) mapRef.current?.focus(name);
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden bg-paper text-ink">
      <header className="relative z-30 shrink-0 border-b border-line px-4 pt-4 pb-3 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs tracking-widest text-muted uppercase">
              <span className="inline-block size-1.5 rounded-full bg-copper" aria-hidden />
              Атлас мира
            </p>
            <h1 className="font-display text-4xl leading-none font-semibold text-ink">Меридиан</h1>
          </div>
          <CountrySearch onPick={(name) => choose(name, true)} />
        </div>
        <MetricSwitch metric={metric} onChange={setMetric} />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] md:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="relative h-full min-h-0">
          <WorldMap
            ref={mapRef}
            metric={metric}
            selected={selected}
            onSelect={(name) => choose(name, false)}
          />
          <div className="pointer-events-none absolute inset-0 z-10">
            <div className="pointer-events-auto absolute top-3 right-16 left-3 md:top-auto md:right-auto md:bottom-3 md:left-3 md:w-72">
              <Legend metricId={metric} />
            </div>
            <div className="pointer-events-auto absolute top-3 right-3 flex flex-col gap-2 md:top-auto md:bottom-3">
              <ZoomButton label="Приблизить" onClick={() => mapRef.current?.zoomBy(1.6)}>
                <Plus className="size-4" />
              </ZoomButton>
              <ZoomButton label="Отдалить" onClick={() => mapRef.current?.zoomBy(1 / 1.6)}>
                <Minus className="size-4" />
              </ZoomButton>
              <ZoomButton label="Весь мир" onClick={() => mapRef.current?.reset()}>
                <RotateCcw className="size-4" />
              </ZoomButton>
            </div>
            <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 max-h-[46%] overflow-y-auto md:hidden">
              <div className="float-card">
                <Detail
                  compact
                  country={country}
                  metricId={metric}
                  onFocus={() => country && mapRef.current?.focus(country.name)}
                  onClear={() => setSelected(null)}
                  onPick={(name) => choose(name, true)}
                />
              </div>
            </div>
          </div>
        </div>
        <aside className="hidden min-h-0 overflow-y-auto border-l border-line bg-paper md:block">
          <Detail
            country={country}
            metricId={metric}
            onFocus={() => country && mapRef.current?.focus(country.name)}
            onClear={() => setSelected(null)}
            onPick={(name) => choose(name, true)}
          />
        </aside>
      </div>
      <p className="sr-only" aria-live="polite">
        {country
          ? `${country.ru}. ${stat.metric.label}: ${
              country[metric] == null ? "нет данных" : formatValue(stat.metric, country[metric] as number)
            }`
          : "Страна не выбрана"}
      </p>
    </main>
  );
}

function MetricSwitch({ metric, onChange }: { metric: MetricId; onChange: (id: MetricId) => void }) {
  const name = useId();
  return (
    <fieldset className="mt-3">
      <legend className="sr-only">Показатель карты</legend>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {METRICS.map((item) => (
          <label
            key={item.id}
            className="chip inline-flex h-11 shrink-0 items-center rounded-full border border-line bg-chip px-4 text-sm font-medium transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            <input
              className="sr-only"
              type="radio"
              name={name}
              checked={metric === item.id}
              onChange={() => onChange(item.id)}
            />
            {item.short}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Legend({ metricId }: { metricId: MetricId }) {
  const stat = STATS[metricId];
  return (
    <div className="float-card px-3 py-2.5">
      <p className="text-sm leading-snug text-ink">{stat.metric.label}</p>
      <p className="mt-0.5 hidden text-xs leading-snug text-muted md:block">{stat.metric.hint}</p>
      <div className="mt-2 h-2 rounded-full" style={{ background: GRADIENT }} />
      <div className="mt-1 flex justify-between text-xs text-muted tabular-nums">
        <span>{formatValue(stat.metric, stat.min, "short")}</span>
        <span>{formatValue(stat.metric, stat.mid, "short")}</span>
        <span>{formatValue(stat.metric, stat.max, "short")}</span>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm border border-line bg-land" />
          нет данных
        </span>
        <span>{stat.metric.scale === "log" ? "лог. шкала" : `${stat.count} стран`}</span>
      </div>
    </div>
  );
}

function ZoomButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-11 items-center justify-center rounded-full border border-line bg-chip text-ink shadow-none transition-transform duration-150 ease-out active:scale-[0.96]"
    >
      {children}
    </button>
  );
}

function CountrySearch({ onPick }: { onPick: (name: string) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const results = useMemo(() => searchCountries(query), [query]);

  useEffect(() => setHi(0), [query]);

  useEffect(() => {
    function onPointer(event: PointerEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  function commit(row: CountryRow) {
    onPick(row.name);
    setQuery(row.ru);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative w-full sm:w-72">
      <label className="sr-only" htmlFor="country-search">
        Найти страну
      </label>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <input
        id="country-search"
        value={query}
        placeholder="Найти страну"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-11 w-full rounded-full border border-line bg-chip pr-4 pl-10 text-sm text-ink outline-none placeholder:text-muted focus-visible:border-copper"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!results.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setHi((index) => (index + 1) % results.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHi((index) => (index - 1 + results.length) % results.length);
          } else if (event.key === "Enter") {
            event.preventDefault();
            commit(results[hi] ?? results[0]);
          }
        }}
      />
      {open && results.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="float-card absolute top-12 right-0 left-0 z-40 max-h-80 overflow-auto"
        >
          {results.map((row, index) => (
            <li key={row.name} role="option" aria-selected={index === hi}>
              <button
                type="button"
                className={`flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left text-sm ${
                  index === hi ? "bg-paper-2" : "bg-chip"
                }`}
                onMouseEnter={() => setHi(index)}
                onClick={() => commit(row)}
              >
                <span>{row.ru}</span>
                <span className="text-xs text-muted">{REGIONS[row.region]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Detail({
  country,
  metricId,
  onFocus,
  onClear,
  onPick,
  compact = false,
}: {
  country: CountryRow | null;
  metricId: MetricId;
  onFocus: () => void;
  onClear: () => void;
  onPick: (name: string) => void;
  compact?: boolean;
}) {
  const stat = STATS[metricId];
  if (!country) {
    return (
      <div className="sheet-in p-4 md:p-5">
        <p className="text-xs tracking-widest text-muted uppercase">Страна</p>
        <h2 className="mt-1 font-display text-3xl leading-tight">Выберите страну</h2>
        <p className="mt-2 text-sm text-muted">
          Нажмите на карту или найдите название. Карту можно двигать и масштабировать.
        </p>
        {compact ? (
          <p className="mt-3 text-sm text-muted tabular-nums">
            Медиана {formatValue(stat.metric, stat.median, "short")} {formatUnit(stat.metric)}
          </p>
        ) : (
          <ExtremeList statId={metricId} onPick={onPick} />
        )}
        {compact ? null : <Footnote />}
      </div>
    );
  }

  const value = country[metricId];
  const rank = rankOf(stat, country.name);

  return (
    <div className="sheet-in p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs tracking-widest text-muted uppercase">{REGIONS[country.region]}</p>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex size-11 items-center justify-center rounded-full text-muted transition-transform duration-150 ease-out active:scale-[0.96]"
          aria-label="Сбросить выбор"
        >
          <X className="size-4" />
        </button>
      </div>
      <h2 className="font-display text-3xl leading-tight">{country.ru}</h2>
      <p className="mt-4 text-xs tracking-widest text-muted uppercase">{stat.metric.short}</p>
      {value == null ? (
        <p className="mt-1 font-display text-3xl">Нет данных</p>
      ) : (
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-5xl tabular-nums">{formatValue(stat.metric, value)}</span>
          <span className="text-lg text-muted">{formatUnit(stat.metric)}</span>
        </p>
      )}
      {value != null && rank != null ? (
        <p className="mt-1 text-sm text-muted tabular-nums">
          {rank} из {stat.count} · {versusMedian(stat.metric, value, stat.median)}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onFocus}
          className="h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper transition-transform duration-150 ease-out active:scale-[0.96]"
        >
          На карте
        </button>
      </div>
      <h3 className="mt-6 text-xs tracking-widest text-muted uppercase">Все показатели</h3>
      <ul className="mt-2 space-y-3">
        {METRICS.map((item) => {
          const current = country[item.id];
          const itemStat = STATS[item.id];
          const active = item.id === metricId;
          return (
            <li key={item.id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={active ? "font-medium text-ink" : "text-muted"}>{item.label}</span>
                <span className="tabular-nums">
                  {current == null ? "—" : `${formatValue(item, current)} ${formatUnit(item)}`}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-2">
                <div
                  className={`h-full rounded-full ${active ? "bg-copper" : "bg-ink/35"}`}
                  style={{ width: `${shareOfMax(itemStat, current)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-muted">Длина полосы — доля от максимума в выборке, не сравнение разных шкал между собой.</p>
      <Footnote />
    </div>
  );
}

function ExtremeList({ statId, onPick }: { statId: MetricId; onPick: (name: string) => void }) {
  const stat = STATS[statId];
  const high = stat.ranked.slice(0, 3);
  const low = stat.ranked.slice(-3).reverse();
  return (
    <div className="mt-5 grid gap-4">
      <ExtremeGroup title="Выше всех" rows={high} metricId={statId} onPick={onPick} />
      <ExtremeGroup title="Ниже всех" rows={low} metricId={statId} onPick={onPick} />
      <p className="text-sm text-muted tabular-nums">
        Медиана {formatValue(stat.metric, stat.median, "short")} {formatUnit(stat.metric)} · {stat.count} из{" "}
        {COUNTRIES.length}
      </p>
    </div>
  );
}

function ExtremeGroup({
  title,
  rows,
  metricId,
  onPick,
}: {
  title: string;
  rows: CountryRow[];
  metricId: MetricId;
  onPick: (name: string) => void;
}) {
  const metric = STATS[metricId].metric;
  return (
    <div>
      <p className="text-xs tracking-widest text-muted uppercase">{title}</p>
      <ul className="mt-1">
        {rows.map((row) => {
          const value = row[metricId];
          return (
            <li key={row.name}>
              <button
                type="button"
                onClick={() => onPick(row.name)}
                className="flex h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-sm transition-transform duration-150 ease-out hover:bg-paper-2 active:scale-[0.96]"
              >
                <span>{row.ru}</span>
                <span className="text-muted tabular-nums">
                  {value == null ? "—" : formatValue(metric, value, "short")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Footnote() {
  return (
    <p className="mt-5 text-xs leading-relaxed text-muted">
      Примерные цифры для демонстрации, около 2023 года. Это не официальная статистика и не повод для решений.
    </p>
  );
}
