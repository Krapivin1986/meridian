export const METRICS = [
  {
    id: "life",
    short: "Долголетие",
    label: "Ожидаемая продолжительность жизни",
    hint: "Сколько лет в среднем предстоит прожить человеку, родившемуся сегодня",
    digits: 1,
    scale: "linear",
  },
  {
    id: "income",
    short: "Доход",
    label: "Доход на человека",
    hint: "ВВП по паритету покупательной способности на душу, международные доллары",
    digits: 0,
    scale: "log",
  },
  {
    id: "power",
    short: "Энергия",
    label: "Возобновляемая энергия",
    hint: "Доля электричества из воды, ветра, солнца и других возобновляемых источников — не охват сети",
    digits: 0,
    scale: "linear",
  },
  {
    id: "urban",
    short: "Города",
    label: "Городское население",
    hint: "Доля жителей, которые живут в городах",
    digits: 0,
    scale: "linear",
  },
  {
    id: "net",
    short: "Интернет",
    label: "Доступ в интернет",
    hint: "Доля населения, которое пользуется интернетом",
    digits: 0,
    scale: "linear",
  },
] as const;

export type MetricId = (typeof METRICS)[number]["id"];
export type Metric = (typeof METRICS)[number];

export function metricById(id: MetricId): Metric {
  const found = METRICS.find((item) => item.id === id);
  if (!found) return METRICS[0];
  return found;
}
