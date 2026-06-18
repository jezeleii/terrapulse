'use client';

import "mapbox-gl/dist/mapbox-gl.css";

import mapboxgl from "mapbox-gl";
import type { ExpressionSpecification } from "mapbox-gl";
import type { FeatureCollection, GeoJsonProperties, Point } from "geojson";
import { useEffect, useMemo, useRef, useState } from "react";

import type { Project } from "./types";

interface GlobalProjectMapProps {
  projects: Project[];
  variant?: "card" | "embedded";
  metric?: MetricMode;
}

export type MetricMode = "issued" | "retired";

const ISSUED_COLOR_RAMP = ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#3b82f6", "#2563eb"];
const RETIRED_COLOR_RAMP = ["#dcfce7", "#bbf7d0", "#86efac", "#4ade80", "#22c55e", "#16a34a"];
const OUTLINE_COLORS: Record<MetricMode, string> = {
  issued: "#2563eb",
  retired: "#16a34a",
};
const ZOOM_THRESHOLD = 3.8;

const regionCoordinates: Record<string, { lng: number; lat: number }> = {
  Africa: { lng: 18, lat: 0 },
  Asia: { lng: 95, lat: 30 },
  Europe: { lng: 15, lat: 52 },
  "Latin America": { lng: -60, lat: -15 },
  "North America": { lng: -100, lat: 40 },
  Oceania: { lng: 135, lat: -25 },
};

const continentLabelMap: Record<string, string> = {
  Africa: "Africa",
  Asia: "Asia",
  Europe: "Europe",
  "North America": "North America",
  "South America": "Latin America",
  Oceania: "Oceania",
};

export function GlobalProjectMap({
  projects,
  variant = "card",
  metric: metricProp,
}: GlobalProjectMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const layersReadyRef = useRef(false);
  const countryStateKeysRef = useRef<string[]>([]);
  const countryOverviewRef = useRef<Record<string, { issued: number; retired: number; count: number }>>({});
  const [mapReady, setMapReady] = useState(false);
  const [legendMode, setLegendMode] = useState<"region" | "country">("region");
  const metric = metricProp ?? "issued";
  const mapToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string | undefined;
  const colorRamp = metric === "issued" ? ISSUED_COLOR_RAMP : RETIRED_COLOR_RAMP;
  const metricLabel = metric === "issued" ? "Issued" : "Retired";

  const valuesByRegion = useMemo(() => {
    return projects.reduce((acc, project) => {
      const region = project.region || "Unknown";
      const metricValue = getMetricValue(project, metric);
      acc[region] = (acc[region] ?? 0) + metricValue;
      return acc;
    }, {} as Record<string, number>);
  }, [metric, projects]);

  const valuesByCountry = useMemo(() => {
    return projects.reduce((acc, project) => {
      if (!project.country) {
        return acc;
      }
      const country = project.country.trim();
      if (!country) {
        return acc;
      }
      const metricValue = getMetricValue(project, metric);
      acc[country] = (acc[country] ?? 0) + metricValue;
      return acc;
    }, {} as Record<string, number>);
  }, [metric, projects]);

  const countryOverview = useMemo(() => {
    return projects.reduce((acc, project) => {
      if (!project.country) {
        return acc;
      }
      const country = project.country.trim();
      if (!country) {
        return acc;
      }
      const current = acc[country] ?? { issued: 0, retired: 0, count: 0 };
      current.issued += project.totalIssued;
      current.retired += project.totalRetired;
      current.count += 1;
      acc[country] = current;
      return acc;
    }, {} as Record<string, { issued: number; retired: number; count: number }>);
  }, [projects]);

  const valuesByContinent = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.entries(valuesByRegion).forEach(([region, value]) => {
      const continent = region === "Latin America" ? "South America" : region;
      totals[continent] = (totals[continent] ?? 0) + value;
    });
    return totals;
  }, [valuesByRegion]);

  const regionLegend = useMemo(
    () => buildSequentialLegend(valuesByContinent, colorRamp),
    [valuesByContinent, colorRamp],
  );
  const countryLegend = useMemo(
    () => buildSequentialLegend(valuesByCountry, colorRamp),
    [valuesByCountry, colorRamp],
  );

  useEffect(() => {
    if (!mapContainerRef.current || !mapToken) {
      return;
    }
    if (mapRef.current) {
      return;
    }
    mapboxgl.accessToken = mapToken;
    const labelColor = "#f8fafc";
    const haloColor = "rgba(0,0,0,0.6)";

    mapRef.current = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [0, 20],
      zoom: 1.1,
      attributionControl: false,
      projection: "mercator",
      renderWorldCopies: false,
    });

    const map = mapRef.current;

    const handleZoom = () => {
      setLegendMode(map.getZoom() >= ZOOM_THRESHOLD ? "country" : "region");
      raiseLabelLayers(map);
    };

    map.on("zoom", handleZoom);

    let themeObserver: MutationObserver | null = null;

    map.on("load", () => {
      if (layersReadyRef.current) {
        return;
      }

      const applyThemeBackground = () => {
        const themeBackground = getThemeBackground();
        if (map.getLayer("background")) {
          map.setPaintProperty("background", "background-color", themeBackground);
        }
        applyThemeOcean(map, themeBackground);
      };

      applyThemeBackground();
      if (typeof MutationObserver !== "undefined") {
        themeObserver = new MutationObserver(applyThemeBackground);
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      }

      map.addSource("country-boundaries", {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1",
        promoteId: "name_en",
      });

      map.addSource("region-labels", {
        type: "geojson",
        data: buildRegionLabelGeojson(valuesByContinent),
      });

      map.addLayer({
        id: "region-choropleth",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        maxzoom: ZOOM_THRESHOLD,
        paint: {
          "fill-color": buildRegionColorExpression(valuesByContinent, regionLegend.stops, colorRamp) as unknown as string,
          "fill-opacity": 0.4,
        },
      });

      map.addLayer({
        id: "region-outline",
        type: "line",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        maxzoom: ZOOM_THRESHOLD,
        paint: {
          "line-color": "rgba(255,255,255,0.22)",
          "line-width": 0.6,
          "line-blur": 0.6,
        },
      });

      map.addLayer({
        id: "region-labels",
        type: "symbol",
        source: "region-labels",
        maxzoom: ZOOM_THRESHOLD,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-line-height": 1.2,
          "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
        },
        paint: {
          "text-color": labelColor,
          "text-halo-color": haloColor,
          "text-halo-width": 1,
        },
      });

      map.addLayer({
        id: "country-choropleth",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        minzoom: ZOOM_THRESHOLD,
        paint: {
          "fill-color": buildCountryColorExpression(countryLegend.stops, colorRamp) as unknown as string,
          "fill-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "country-outline",
        type: "line",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        minzoom: ZOOM_THRESHOLD,
        paint: {
          "line-color": OUTLINE_COLORS[metric],
          "line-width": 1.1,
          "line-opacity": 1,
          "line-blur": 0,
        },
      });

      map.addLayer({
        id: "country-labels",
        type: "symbol",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        minzoom: ZOOM_THRESHOLD,
        layout: {
          "text-field": [
            "format",
            ["get", "name_en"],
            { "font-scale": 0.8 },
            "\n",
            {},
            ["number-format", ["coalesce", ["feature-state", "metricValue"], 0], { notation: "compact" }],
            { "font-scale": 0.75 },
          ],
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-font": ["Open Sans Regular", "Arial Unicode MS Regular"],
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "rgba(0,0,0,0.75)",
          "text-halo-width": 1.2,
          "text-halo-blur": 0.6,
          "text-opacity": 1,
        },
      });

      raiseLabelLayers(map);
      if (map.getLayer("place-label")) {
        map.removeLayer("place-label");
      }

      layersReadyRef.current = true;
      setMapReady(true);
      handleZoom();
    });

    return () => {
      map.off("zoom", handleZoom);
      themeObserver?.disconnect();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
      layersReadyRef.current = false;
      setMapReady(false);
    };
  }, [mapToken]);

  useEffect(() => {
    countryOverviewRef.current = countryOverview;
  }, [countryOverview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current || !mapReady) {
      return;
    }

    if (!popupRef.current) {
      popupRef.current = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: "vcm-map-tooltip",
        offset: 12,
      });
    }

    const handleMouseMove = (event: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const feature = event.features?.[0];
      if (!feature) {
        return;
      }
      const name = (feature.properties?.name_en as string | undefined)?.trim();
      if (!name) {
        return;
      }
      const overview = countryOverviewRef.current[name];
      const issued = overview?.issued ?? 0;
      const retired = overview?.retired ?? 0;
      const net = issued - retired;
      const count = overview?.count ?? 0;
      const isDark = document.documentElement.classList.contains("dark");
      const background = isDark ? "rgba(15, 23, 42, 0.92)" : "rgba(255, 255, 255, 0.95)";
      const border = isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(15, 23, 42, 0.15)";
      const text = isDark ? "#f8fafc" : "#0f172a";
      const muted = isDark ? "rgba(226, 232, 240, 0.7)" : "rgba(15, 23, 42, 0.6)";

      const html = `
        <div style="min-width: 180px; padding: 8px 10px; border-radius: 12px; border: 1px solid ${border}; background: ${background}; color: ${text}; font-size: 11px;">
          <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: ${muted}; margin-bottom: 6px;">
            ${name}
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="color: ${muted};">Projects</span>
            <span style="font-variant-numeric: tabular-nums;">${count.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="color: ${muted};">Issued</span>
            <span style="font-variant-numeric: tabular-nums;">${issued.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
            <span style="color: ${muted};">Retired</span>
            <span style="font-variant-numeric: tabular-nums;">${retired.toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; gap: 8px;">
            <span style="color: ${muted};">Net</span>
            <span style="font-variant-numeric: tabular-nums;">${net.toLocaleString()}</span>
          </div>
        </div>
      `;

      popupRef.current?.setLngLat(event.lngLat).setHTML(html).addTo(map);
      map.getCanvas().style.cursor = "pointer";
    };

    const handleMouseLeave = () => {
      popupRef.current?.remove();
      map.getCanvas().style.cursor = "";
    };

    map.on("mousemove", "country-choropleth", handleMouseMove);
    map.on("mouseleave", "country-choropleth", handleMouseLeave);

    return () => {
      map.off("mousemove", "country-choropleth", handleMouseMove);
      map.off("mouseleave", "country-choropleth", handleMouseLeave);
    };
  }, [mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !layersReadyRef.current || !mapReady) {
      return;
    }

    if (map.getSource("region-labels")) {
      (map.getSource("region-labels") as mapboxgl.GeoJSONSource).setData(buildRegionLabelGeojson(valuesByContinent));
    }

    if (map.getLayer("region-choropleth")) {
      map.setPaintProperty(
        "region-choropleth",
        "fill-color",
        buildRegionColorExpression(valuesByContinent, regionLegend.stops, colorRamp),
      );
    }

    if (map.getLayer("country-choropleth")) {
      map.setPaintProperty(
        "country-choropleth",
        "fill-color",
        buildCountryColorExpression(countryLegend.stops, colorRamp),
      );
    }
    if (map.getLayer("country-outline")) {
      map.setPaintProperty("country-outline", "line-color", OUTLINE_COLORS[metric]);
    }
    if (map.getLayer("country-labels")) {
      map.setPaintProperty("country-labels", "text-color", "#ffffff");
    }
    if (map.getLayer("region-labels")) {
      raiseLabelLayers(map);
    }

    const previousKeys = countryStateKeysRef.current;
    previousKeys.forEach((key) => {
      if (!(key in valuesByCountry)) {
        map.removeFeatureState({ source: "country-boundaries", id: key });
      }
    });

    countryStateKeysRef.current = Object.keys(valuesByCountry);
    countryStateKeysRef.current.forEach((country) => {
      map.setFeatureState(
        { source: "country-boundaries", id: country },
        { metricValue: valuesByCountry[country] ?? 0 },
      );
    });
  }, [valuesByContinent, valuesByCountry, countryLegend.stops, colorRamp, mapReady, metric]);

  const content = (
    <>
      <div className="relative w-full border border-[#7ef6e0]/15 overflow-hidden">
        {!mapToken ? (
          <div
            className="flex items-center justify-center text-[11px] text-[#7ef6e0]/40 tracking-wider bg-[#080808]"
            style={{ height: 520 }}
          >
            Set NEXT_PUBLIC_MAPBOX_TOKEN to enable the map.
          </div>
        ) : (
          <div ref={mapContainerRef} className="w-full" style={{ height: 520 }} />
        )}
        {mapToken ? (
          <div
            className="absolute bottom-3 right-3 z-10 border border-[#7ef6e0]/20 bg-[#0a0a0a]/90 px-2.5 py-2 text-[10px] shadow-sm backdrop-blur"
            style={{ minWidth: 120 }}
          >
            <div className="mb-1.5 text-[9px] tracking-[0.2em] text-[#7ef6e0]/40">
              {legendMode === "region" ? `${metricLabel} BY REGION` : `${metricLabel} BY COUNTRY`}
            </div>
            <div className="space-y-1">
              {(legendMode === "region" ? regionLegend.items : countryLegend.items).map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );

  if (variant === "embedded") {
    return content;
  }

  return (
    <div className="border border-[#7ef6e0]/15 bg-[#0c0c0c] p-4">
      <div className="mb-3">
        <p className="text-[9px] text-[#7ef6e0]/40 tracking-[0.2em]">PROJECT LOCATIONS</p>
        <p className="text-sm font-black tracking-[0.1em] text-white mt-0.5">Global distribution of carbon projects</p>
      </div>
      {content}
    </div>
  );
}

function buildSequentialLegend(valuesByKey: Record<string, number>, colorRamp: string[]) {
  const values = Object.values(valuesByKey);
  const stops = buildStops(values);
  const items = stops.map((value, index) => {
    const nextValue = stops[index + 1];
    const label = nextValue ? `${formatCompact(value)} - ${formatCompact(nextValue)}` : `${formatCompact(value)}+`;
    return {
      label,
      color: colorRamp[index] ?? colorRamp[0],
    };
  });
  return { stops, items };
}

function buildStops(values: number[]) {
  const maxValue = Math.max(0, ...values);
  const safeMax = maxValue === 0 ? 1 : maxValue;
  return [
    0,
    safeMax * 0.2,
    safeMax * 0.4,
    safeMax * 0.6,
    safeMax * 0.8,
    safeMax,
  ];
}

function formatCompact(value: number) {
  const sign = value < 0 ? "-" : "";
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}K`;
  }
  return `${sign}${Math.round(absValue)}`;
}

function buildRegionLabelGeojson(
  valuesByContinent: Record<string, number>,
): FeatureCollection<Point, GeoJsonProperties> {
  const features: FeatureCollection<Point, GeoJsonProperties>["features"] = Object.entries(
    continentLabelMap,
  ).map(([continent, label]) => {
    const coords = regionCoordinates[label];
    const value = valuesByContinent[continent] ?? 0;
    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [coords.lng, coords.lat] as [number, number],
      },
      properties: {
        label: `${label}\n${formatCompact(value)}`,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

function buildRegionColorExpression(
  valuesByContinent: Record<string, number>,
  stops: number[],
  colorRamp: string[],
): ExpressionSpecification {
  const continentValueExpression: ExpressionSpecification = ["match", ["get", "continent"]];
  Object.entries(valuesByContinent).forEach(([continent, value]) => {
    continentValueExpression.push(continent, value);
  });
  continentValueExpression.push(0);

  return [
    "interpolate",
    ["linear"],
    continentValueExpression,
    ...buildColorStops(stops, colorRamp),
  ] as ExpressionSpecification;
}

function buildCountryColorExpression(stops: number[], colorRamp: string[]): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["coalesce", ["feature-state", "metricValue"], 0],
    ...buildColorStops(stops, colorRamp),
  ] as ExpressionSpecification;
}

function buildColorStops(stops: number[], colorRamp: string[]) {
  return stops.flatMap((stop, index) => [stop, colorRamp[index] ?? colorRamp[0]]);
}

function getMetricValue(project: Project, metric: MetricMode) {
  if (metric === "issued") {
    return project.totalIssued;
  }
  return project.totalRetired;
}

function raiseLabelLayers(map: mapboxgl.Map) {
  if (map.getLayer("region-labels")) {
    map.moveLayer("region-labels");
  }
  if (map.getLayer("country-labels")) {
    map.moveLayer("country-labels");
  }
}

function getThemeBackground() {
  if (typeof document === "undefined") {
    return "#000000";
  }
  const value = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
  return value || "#000000";
}

function applyThemeOcean(map: mapboxgl.Map, color: string) {
  const layers = map.getStyle().layers ?? [];
  layers.forEach((layer) => {
    const id = layer.id ?? "";
    if (!id) return;
    const isWater = id.includes("water") || id.includes("ocean");
    if (!isWater) return;
    if (layer.type === "fill") {
      map.setPaintProperty(id, "fill-color", color);
    } else if (layer.type === "line") {
      map.setPaintProperty(id, "line-color", color);
    } else if (layer.type === "background") {
      map.setPaintProperty(id, "background-color", color);
    }
  });
}
