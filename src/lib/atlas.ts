import { BY_NAME, COUNTRIES, type CountryRow } from "@/data/countries";
import { METRICS, type Metric, type MetricId } from "@/data/metrics";

const RAMP: Array<[number, number, number]> = [
  [246, 232, 214],
  [236, 196, 154],
  [217, 142, 96],
  [180, 83, 42],
  [122, 48, 24],
  [62, 28, 16],
];

export type MetricStat = {
  metric: Metric;
  min: number;
  max: number;
  mid: number;
  median: number;
  count: number;
  ranked: CountryRow[];
  colorOf: (value: number | null) => string | null;
};

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function colorAt(t: number): string {
  const x = clamp01(t) * (RAMP.length - 1);
  const index = Math.min(RAMP.length - 2, Math.floor(x));
  const frac = x - index;
  const from = RAMP[index];
  const to = RAMP[index + 1];
  const channels = from.map((channel, i) => Math.round(channel + (to[i] - channel) * frac));
  return `rgb(${channels[0]} ${channels[1]} ${channels[2]})`;
}

export function rampGradient(): string {
  const stops = RAMP.map((channels, index) => {
    const t = index / (RAMP.length - 1);
    return `rgb(${channels[0]} ${channels[1]} ${channels[2]}) ${Math.round(t * 100)}%`;
  });
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function formatNumber(value: number, digits = 0): string {
  const sign = value < 0 ? "−" : "";
  const [intPart, frac] = Math.abs(value).toFixed(digits).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return digits > 0 ? `${sign}${grouped},${frac}` : `${sign}${grouped}`;
}

export function formatValue(metric: Metric, value: number, mode: "full" | "short" = "full"): string {
  if (metric.id === "income") {
    if (mode === "short" && value >= 1000) {
      const thousands = value / 1000;
      const digits = thousands >= 100 ? 0 : 1;
      return `${formatNumber(thousands, digits)}\u00a0тыс.\u00a0$`;
    }
    return `${formatNumber(value, 0)}\u00a0$`;
  }
  if (metric.id === "life") return formatNumber(value, 1);
  return formatNumber(value, 0);
}

export function formatUnit(metric: Metric): string {
  if (metric.id === "income") return "$";
  if (metric.id === "life") return "лет";
  return "%";
}

export function versusMedian(metric: Metric, value: number, median: number): string {
  const delta = value - median;
  const epsilon = metric.digits > 0 ? 0.05 : 0.5;
  if (Math.abs(delta) < epsilon) return "около медианы";
  const word = delta > 0 ? "выше" : "ниже";
  const amount = formatNumber(Math.abs(delta), metric.digits);
  if (metric.id === "power" || metric.id === "urban" || metric.id === "net") {
    return `на ${amount}\u00a0п.п. ${word} медианы`;
  }
  if (metric.id === "income") return `на ${amount}\u00a0$ ${word} медианы`;
  return `на ${amount} ${word} медианы`;
}

function medianOf(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function scaleT(value: number, stat: { min: number; max: number; metric: Metric }): number {
  if (stat.max === stat.min) return 0.5;
  if (stat.metric.scale === "log") {
    const safe = Math.max(value, stat.min);
    return (Math.log(safe) - Math.log(stat.min)) / (Math.log(stat.max) - Math.log(stat.min));
  }
  return (value - stat.min) / (stat.max - stat.min);
}

function buildStat(metric: Metric): MetricStat {
  const ranked = COUNTRIES.filter((row) => row[metric.id] != null).sort(
    (a, b) => (b[metric.id] ?? 0) - (a[metric.id] ?? 0),
  );
  const values = ranked.map((row) => row[metric.id] as number);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const mid =
    metric.scale === "log" ? Math.exp((Math.log(Math.max(min, 1e-6)) + Math.log(Math.max(max, 1e-6))) / 2) : (min + max) / 2;
  const median = values.length ? medianOf(values) : 0;
  const draft = { metric, min, max };
  return {
    metric,
    min,
    max,
    mid,
    median,
    count: values.length,
    ranked,
    colorOf(value) {
      if (value == null || !Number.isFinite(value)) return null;
      if (metric.scale === "log" && value <= 0) return colorAt(0);
      return colorAt(clamp01(scaleT(value, draft)));
    },
  };
}

export const STATS: Record<MetricId, MetricStat> = Object.fromEntries(
  METRICS.map((metric) => [metric.id, buildStat(metric)]),
) as Record<MetricId, MetricStat>;

export function rankOf(stat: MetricStat, name: string): number | null {
  const index = stat.ranked.findIndex((row) => row.name === name);
  return index === -1 ? null : index + 1;
}

export function shareOfMax(stat: MetricStat, value: number | null): number {
  if (value == null || stat.max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / stat.max) * 100));
}

export function searchCountries(query: string): CountryRow[] {
  const needle = query.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");
  if (!needle) return [];
  const scored = COUNTRIES.map((row) => {
    const ru = row.ru.toLocaleLowerCase("ru").replaceAll("ё", "е");
    const en = row.name.toLocaleLowerCase("en");
    let score = 0;
    if (ru.startsWith(needle)) score = 4;
    else if (en.startsWith(needle)) score = 3;
    else if (ru.includes(needle)) score = 2;
    else if (en.includes(needle)) score = 1;
    return { row, score };
  })
    .filter((item) => item.score > 0 && BY_NAME.has(item.row.name))
    .sort((a, b) => b.score - a.score || a.row.ru.localeCompare(b.row.ru, "ru"));
  return scored.slice(0, 8).map((item) => item.row);
}
