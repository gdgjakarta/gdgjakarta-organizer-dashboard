"use client";

import { useMemo, useState } from "react";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import { Globe } from "lucide-react";
import { feature } from "topojson-client";
import countriesAtlas from "world-atlas/countries-110m.json";

import { numericIdToAlpha2 } from "@/lib/analytics/country-codes";
import type { CountryMetricRow } from "@/lib/analytics/types";
import { cn } from "@/lib/utils";

interface WorldChoroplethMapProps {
  countries: CountryMetricRow[];
  primaryMetricLabel: string; // e.g. "Users" or "Visits"
  isExpanded?: boolean;
}

interface CountryFeature {
  id: string;
  name: string;
  pathD: string;
}

const PROJECTION = geoNaturalEarth1().scale(148).translate([400, 205]);
const PATH_GENERATOR = geoPath(PROJECTION);

function buildWorldFeatures(): CountryFeature[] {
  const topology = countriesAtlas as unknown as Parameters<typeof feature>[0] & {
    objects: { countries: Parameters<typeof feature>[1] };
  };
  const geo = feature(topology, topology.objects.countries) as unknown as GeoJSON.FeatureCollection<
    GeoJSON.Geometry,
    { name?: string }
  >;
  const items: CountryFeature[] = [];
  for (const f of geo.features) {
    const id = String(f.id ?? "").padStart(3, "0");
    if (id === "010") continue; // Skip Antarctica for cleaner framing
    const d = PATH_GENERATOR(f);
    if (!d) continue;
    items.push({
      id,
      name: f.properties?.name || numericIdToAlpha2(id) || "Unknown",
      pathD: d,
    });
  }
  return items;
}

const WORLD_FEATURES = buildWorldFeatures();

function getIntensityClass(value: number, max: number): string {
  if (value <= 0 || max <= 0) {
    return "fill-muted/70 hover:fill-muted-foreground/30";
  }
  const ratio = value / max;
  if (ratio >= 0.65) return "fill-indigo-600 dark:fill-indigo-400 hover:fill-indigo-700 dark:hover:fill-indigo-300";
  if (ratio >= 0.3) return "fill-indigo-500 dark:fill-indigo-500 hover:fill-indigo-600 dark:hover:fill-indigo-400";
  if (ratio >= 0.1) return "fill-indigo-400/80 dark:fill-indigo-700 hover:fill-indigo-500";
  return "fill-indigo-200 dark:fill-indigo-900 hover:fill-indigo-300 dark:hover:fill-indigo-800";
}

export function WorldChoroplethMap({ countries, primaryMetricLabel, isExpanded = false }: WorldChoroplethMapProps) {
  const [metricMode, setMetricMode] = useState<"primary" | "pageViews">("primary");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const byNumericId = useMemo(() => {
    const map = new Map<string, CountryMetricRow>();
    for (const c of countries) {
      if (c.numericId) {
        map.set(c.numericId, c);
      }
    }
    return map;
  }, [countries]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const c of countries) {
      const v = metricMode === "primary" ? c.usersOrVisits : c.pageViews;
      if (v > m) m = v;
    }
    return m;
  }, [countries, metricMode]);

  const hoveredCountry = hoveredId ? byNumericId.get(hoveredId) : null;
  const hoveredFeature = hoveredId ? WORLD_FEATURES.find((f) => f.id === hoveredId) : null;
  const topCountries = countries.slice(0, isExpanded ? 6 : 4);

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Globe className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground text-xs">Visitors by Country</span>
        </div>

        <div className="inline-flex items-center rounded-md border bg-background p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setMetricMode("primary")}
            className={cn(
              "rounded-sm px-2 py-0.5 font-medium transition-colors",
              metricMode === "primary" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {primaryMetricLabel}
          </button>
          <button
            type="button"
            onClick={() => setMetricMode("pageViews")}
            className={cn(
              "rounded-sm px-2 py-0.5 font-medium transition-colors",
              metricMode === "pageViews" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            Page Views
          </button>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-md border bg-background/60">
        <svg
          viewBox="0 0 800 390"
          className="h-auto w-full select-none"
          role="img"
          aria-label="World choropleth map of website visitors by country"
          onMouseMove={(e) => {
            const target = e.target as SVGElement | null;
            const id = target?.getAttribute("data-country-id");
            setHoveredId(id ?? null);
          }}
          onMouseLeave={() => setHoveredId(null)}
        >
          <g>
            {WORLD_FEATURES.map((f) => {
              const match = byNumericId.get(f.id);
              let val = 0;
              if (match) {
                val = metricMode === "primary" ? match.usersOrVisits : match.pageViews;
              }
              return (
                <path
                  key={f.id}
                  d={f.pathD}
                  data-country-id={f.id}
                  className={cn("stroke-[0.5] stroke-border/60 transition-colors", getIntensityClass(val, maxVal))}
                />
              );
            })}
          </g>
        </svg>

        {hoveredFeature ? (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md border bg-popover/95 px-2.5 py-1.5 text-popover-foreground text-xs shadow-sm backdrop-blur-xs">
            <div className="font-medium">{hoveredCountry?.name ?? hoveredFeature.name}</div>
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {hoveredCountry
                ? `${(metricMode === "primary" ? hoveredCountry.usersOrVisits : hoveredCountry.pageViews).toLocaleString()} ${metricMode === "primary" ? primaryMetricLabel.toLowerCase() : "views"} (${hoveredCountry.pct}%)`
                : "No recorded traffic"}
            </div>
          </div>
        ) : null}

        {maxVal > 0 ? (
          <div className="pointer-events-none absolute right-2 bottom-2 flex items-center gap-1.5 rounded-md border bg-popover/90 px-2 py-1 text-[10px] text-muted-foreground tabular-nums">
            <span>0</span>
            <div className="h-1.5 w-14 rounded-full bg-gradient-to-r from-indigo-200 via-indigo-400 to-indigo-600 dark:from-indigo-900 dark:via-indigo-600 dark:to-indigo-400" />
            <span>{maxVal.toLocaleString()}</span>
          </div>
        ) : null}
      </div>

      {topCountries.length > 0 ? (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {topCountries.map((c) => {
            const val = metricMode === "primary" ? c.usersOrVisits : c.pageViews;
            return (
              <div
                key={c.code}
                className="flex items-center justify-between rounded-md border bg-background/60 px-2.5 py-1.5 text-xs"
              >
                <span className="truncate font-medium text-foreground">{c.name}</span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {val.toLocaleString()} <span className="text-[10px]">({c.pct}%)</span>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-center text-muted-foreground text-xs">No country breakdown available for this range.</p>
      )}
    </div>
  );
}
