declare module "d3-geo" {
  export type GeoProjection = {
    fitExtent(
      extent: [[number, number], [number, number]],
      object: unknown,
    ): GeoProjection;
  };
  export type GeoPath = {
    (object: unknown): string | null;
    bounds(object: unknown): [[number, number], [number, number]];
  };
  export function geoNaturalEarth1(): GeoProjection;
  export function geoPath(projection?: GeoProjection): GeoPath;
  export function geoGraticule10(): unknown;
  export function geoArea(object: unknown): number;
}

declare module "d3-selection" {
  export interface Selection<GElement extends Element> {
    call<Args extends unknown[]>(
      fn: (selection: this, ...args: Args) => void,
      ...args: Args
    ): this;
    on(typenames: string, listener: null): this;
    interrupt(): this;
    transition(): TransitionLike;
  }
  export interface TransitionLike {
    duration(ms: number): this;
    call<Args extends unknown[]>(
      fn: (transition: this, ...args: Args) => void,
      ...args: Args
    ): this;
  }
  export function select<GElement extends Element>(element: GElement | null): Selection<GElement>;
}

declare module "d3-zoom" {
  export type ZoomTransform = {
    k: number;
    x: number;
    y: number;
    toString(): string;
    translate(x: number, y: number): ZoomTransform;
    scale(k: number): ZoomTransform;
  };
  export const zoomIdentity: ZoomTransform;
  export interface ZoomBehavior {
    (selection: unknown): void;
    scaleExtent(extent: [number, number]): ZoomBehavior;
    extent(extent: [[number, number], [number, number]]): ZoomBehavior;
    translateExtent(extent: [[number, number], [number, number]]): ZoomBehavior;
    clickDistance(distance: number): ZoomBehavior;
    duration(ms: number): ZoomBehavior;
    on(typenames: string, listener: (event: { transform: ZoomTransform }) => void): ZoomBehavior;
    transform(selection: unknown, transform: ZoomTransform): void;
    scaleBy(selection: unknown, k: number): void;
  }
  export function zoom(): ZoomBehavior;
}

declare module "d3-transition";

declare module "topojson-client" {
  export function feature(
    topology: unknown,
    object: unknown,
  ): {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      id?: string | number;
      properties: { name?: string } | null;
      geometry: { type: string; coordinates: unknown } | null;
    }>;
  };
}

declare module "world-atlas/countries-50m.json" {
  const data: { objects: { countries: unknown } };
  export default data;
}
