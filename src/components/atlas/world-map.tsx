import { geoArea, geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import "d3-transition";
import { feature } from "topojson-client";
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import world from "world-atlas/countries-50m.json";
import { BY_NAME } from "@/data/countries";
import { metricById, type MetricId } from "@/data/metrics";
import { formatUnit, formatValue, rankOf, STATS } from "@/lib/atlas";

const land = feature(world, world.objects.countries);

export type MapCountry = {
  name: string;
  d: string;
  focus: [[number, number], [number, number]];
};

type Prepared = {
  sphere: string;
  grat: string;
  countries: MapCountry[];
  byName: Map<string, MapCountry>;
};

export type MapHandle = {
  focus: (name: string) => void;
  zoomBy: (factor: number) => void;
  reset: () => void;
};

type WorldMapProps = {
  metric: MetricId;
  selected: string | null;
  onSelect: (name: string) => void;
};

function largestPolygon(geometry: { type: string; coordinates: unknown }) {
  if (geometry.type !== "MultiPolygon") return geometry;
  const polygons = geometry.coordinates as number[][][][];
  let best = polygons[0];
  let bestArea = -1;
  for (const coordinates of polygons) {
    const area = geoArea({ type: "Polygon", coordinates });
    if (area > bestArea) {
      bestArea = area;
      best = coordinates;
    }
  }
  return { type: "Polygon", coordinates: best };
}

function motionMs(ms: number): number {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return 0;
  }
  return ms;
}

function focusTransform(
  bounds: [[number, number], [number, number]],
  width: number,
  height: number,
): ZoomTransform {
  const [[x0, y0], [x1, y1]] = bounds;
  const dx = Math.max(x1 - x0, 1);
  const dy = Math.max(y1 - y0, 1);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const k = Math.max(1, Math.min(14, 0.62 / Math.max(dx / width, dy / height)));
  return zoomIdentity.translate(width / 2, height / 2).scale(k).translate(-cx, -cy);
}

function useSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      setSize((prev) => {
        if (prev && Math.abs(prev.w - w) < 2 && Math.abs(prev.h - h) < 2) return prev;
        return { w, h };
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

const Shapes = memo(function Shapes({
  items,
  paint,
  onEnter,
  onPick,
}: {
  items: MapCountry[];
  paint: (name: string) => string | null;
  onEnter: (item: MapCountry, event: ReactPointerEvent<SVGPathElement>) => void;
  onPick: (name: string) => void;
}) {
  return items.map((item) => {
    const fill = paint(item.name);
    return (
      <path
        key={item.name}
        data-name={item.name}
        d={item.d}
        className={fill ? "country" : "country is-empty"}
        style={fill ? { fill } : undefined}
        onPointerEnter={(event) => onEnter(item, event)}
        onClick={() => onPick(item.name)}
      />
    );
  });
});

export const WorldMap = forwardRef<MapHandle, WorldMapProps>(function WorldMap({ metric, selected, onSelect }, ref) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const hotRef = useRef<SVGPathElement>(null);
  const haloRef = useRef<SVGPathElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const valueRef = useRef<HTMLParagraphElement>(null);
  const zoomRef = useRef<ZoomBehavior | null>(null);
  const hoverRef = useRef<string | null>(null);
  const metricRef = useRef(metric);
  const selectedRef = useRef(selected);
  metricRef.current = metric;
  selectedRef.current = selected;

  const size = useSize(frameRef);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const prepared = useMemo<Prepared | null>(() => {
    if (!size || size.w < 20 || size.h < 20) return null;
    const projection = geoNaturalEarth1();
    const path = geoPath(projection);
    const sphere = { type: "Sphere" };
    projection.fitExtent(
      [
        [12, 12],
        [size.w - 12, size.h - 12],
      ],
      sphere,
    );
    const countries: MapCountry[] = [];
    for (const item of land.features) {
      const name = item.properties?.name;
      if (!name || !item.geometry) continue;
      const d = path(item);
      if (!d) continue;
      countries.push({
        name,
        d,
        focus: path.bounds(largestPolygon(item.geometry)),
      });
    }
    return {
      sphere: path(sphere) ?? "",
      grat: path(geoGraticule10()) ?? "",
      countries,
      byName: new Map(countries.map((item) => [item.name, item])),
    };
  }, [size]);

  const preparedRef = useRef(prepared);
  preparedRef.current = prepared;

  const paint = useCallback(
    (name: string) => {
      const row = BY_NAME.get(name);
      if (!row) return null;
      return STATS[metric].colorOf(row[metric]);
    },
    [metric],
  );

  const placeTip = useCallback((clientX: number, clientY: number) => {
    const frame = frameRef.current;
    const tip = tipRef.current;
    if (!frame || !tip) return;
    const rect = frame.getBoundingClientRect();
    const width = tip.offsetWidth || 180;
    const height = tip.offsetHeight || 64;
    let x = clientX - rect.left + 14;
    let y = clientY - rect.top + 16;
    if (x + width > rect.width - 8) x = clientX - rect.left - width - 12;
    if (y + height > rect.height - 8) y = clientY - rect.top - height - 12;
    tip.style.transform = `translate3d(${Math.max(8, x)}px, ${Math.max(8, y)}px, 0)`;
  }, []);

  const writeTip = useCallback((name: string | null) => {
    const tip = tipRef.current;
    const nameEl = nameRef.current;
    const valueEl = valueRef.current;
    if (!tip || !nameEl || !valueEl) return;
    if (!name) {
      tip.dataset.show = "false";
      return;
    }
    const row = BY_NAME.get(name);
    const current = metricById(metricRef.current);
    const stat = STATS[current.id];
    nameEl.textContent = row?.ru ?? name;
    const value = row ? row[current.id] : null;
    if (value == null) {
      valueEl.textContent = "Нет примерных данных";
    } else {
      const rank = rankOf(stat, name);
      const shown = `${current.short} · ${formatValue(current, value)} ${formatUnit(current)}`;
      valueEl.textContent = rank ? `${shown} · ${rank} из ${stat.count}` : shown;
    }
    tip.dataset.show = "true";
  }, []);

  const clearHover = useCallback(() => {
    hoverRef.current = null;
    writeTip(null);
    hotRef.current?.setAttribute("d", "");
    haloRef.current?.setAttribute("d", "");
  }, [writeTip]);

  const onEnter = useCallback(
    (item: MapCountry, event: ReactPointerEvent<SVGPathElement>) => {
      hoverRef.current = item.name;
      if (item.name === selectedRef.current) {
        hotRef.current?.setAttribute("d", "");
        haloRef.current?.setAttribute("d", "");
      } else {
        hotRef.current?.setAttribute("d", item.d);
        haloRef.current?.setAttribute("d", item.d);
      }
      writeTip(item.name);
      placeTip(event.clientX, event.clientY);
    },
    [placeTip, writeTip],
  );

  const onPick = useCallback((name: string) => onSelect(name), [onSelect]);

  useEffect(() => {
    if (hoverRef.current) writeTip(hoverRef.current);
  }, [metric, writeTip]);

  useEffect(() => {
    const svg = svgRef.current;
    const group = groupRef.current;
    if (!svg || !group || !size) return;
    const pad = 0.45;
    const behavior = zoom()
      .scaleExtent([1, 18])
      .extent([
        [0, 0],
        [size.w, size.h],
      ])
      .translateExtent([
        [-size.w * pad, -size.h * pad],
        [size.w * (1 + pad), size.h * (1 + pad)],
      ])
      .clickDistance(5)
      .duration(motionMs(480))
      .on("zoom", (event) => {
        group.setAttribute("transform", event.transform.toString());
      });
    const sel = select(svg);
    sel.call(behavior);
    sel.call(behavior.transform, zoomIdentity);
    zoomRef.current = behavior;
    return () => {
      sel.interrupt();
      sel.on(".zoom", null);
      zoomRef.current = null;
    };
  }, [size]);

  useImperativeHandle(
    ref,
    () => ({
      focus(name: string) {
        const svg = svgRef.current;
        const behavior = zoomRef.current;
        const item = preparedRef.current?.byName.get(name);
        const box = sizeRef.current;
        if (!svg || !behavior || !item || !box) return;
        select(svg)
          .transition()
          .duration(motionMs(680))
          .call(behavior.transform, focusTransform(item.focus, box.w, box.h));
      },
      zoomBy(factor: number) {
        const svg = svgRef.current;
        const behavior = zoomRef.current;
        if (!svg || !behavior) return;
        select(svg).transition().duration(motionMs(420)).call(behavior.scaleBy, factor);
      },
      reset() {
        const svg = svgRef.current;
        const behavior = zoomRef.current;
        if (!svg || !behavior) return;
        select(svg).transition().duration(motionMs(520)).call(behavior.transform, zoomIdentity);
      },
    }),
    [],
  );

  const selectedShape = selected ? prepared?.byName.get(selected) : undefined;

  return (
    <div ref={frameRef} className="absolute inset-0 bg-ocean">
      <svg
        ref={svgRef}
        className="map-svg h-full w-full touch-none"
        role="group"
        aria-label="Карта мира. Перетаскивайте, чтобы сдвинуть, колёсико или щипок — масштаб."
        onPointerMove={(event) => {
          if (hoverRef.current) placeTip(event.clientX, event.clientY);
        }}
        onPointerLeave={clearHover}
      >
        {prepared ? (
          <g ref={groupRef}>
            <path d={prepared.sphere} className="ocean" onPointerEnter={clearHover} />
            <path d={prepared.grat} className="grat" />
            <Shapes items={prepared.countries} paint={paint} onEnter={onEnter} onPick={onPick} />
            <path ref={haloRef} className="halo" />
            <path ref={hotRef} className="hot" />
            {selectedShape ? (
              <>
                <path d={selectedShape.d} className="halo" />
                <path d={selectedShape.d} className="picked" />
              </>
            ) : null}
          </g>
        ) : (
          <g ref={groupRef} />
        )}
      </svg>
      <div ref={tipRef} className="tip" data-show="false" role="tooltip">
        <p ref={nameRef} className="font-display text-lg leading-tight text-ink" />
        <p ref={valueRef} className="mt-0.5 text-sm text-muted tabular-nums" />
      </div>
    </div>
  );
});
