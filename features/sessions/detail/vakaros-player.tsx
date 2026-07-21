"use client"

import * as React from "react"
import type {
  CircleMarker,
  DivIcon,
  LatLngExpression,
  LayerGroup,
  Map as LeafletMap,
  Marker,
  Polyline,
} from "leaflet"
import {
  CrosshairIcon,
  FastForwardIcon,
  Loader2Icon,
  LocateFixedIcon,
  MapPinIcon,
  PauseIcon,
  PlayIcon,
  RouteIcon,
  WavesIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type LeafletModule = typeof import("leaflet")

type VakarosSeriesPoint = {
  cog: number
  hdg_true: number
  heel: number
  lat: number
  lon: number
  sog_kts: number
  timestamp: string
  trim: number
}

type TrackMode = "default" | "sog" | "wake"
type BuoyMode = "windward" | "leeward" | null

function parseNumber(value: string | undefined): number {
  const parsed = Number.parseFloat(value ?? "")

  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function parseSeriesCsv(csvText: string): VakarosSeriesPoint[] {
  const lines = csvText.trim().split(/\r?\n/)

  if (lines.length < 2) {
    return []
  }

  const headers = lines[0].split(",").map((header) => header.trim())
  const indexOf = (header: string) => headers.indexOf(header)
  const timestampIndex = indexOf("timestamp")
  const latitudeIndex = indexOf("latitude")
  const longitudeIndex = indexOf("longitude")
  const sogIndex = indexOf("sog_kts")
  const cogIndex = indexOf("cog")
  const hdgIndex = indexOf("hdg_true")
  const heelIndex = indexOf("heel")
  const trimIndex = indexOf("trim")

  return lines
    .slice(1)
    .map((line) => {
      const columns = line.split(",")
      const lat = parseNumber(columns[latitudeIndex])
      const lon = parseNumber(columns[longitudeIndex])

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null
      }

      return {
        timestamp: columns[timestampIndex] ?? "",
        lat,
        lon,
        sog_kts: parseNumber(columns[sogIndex]),
        cog: parseNumber(columns[cogIndex]),
        hdg_true: parseNumber(columns[hdgIndex]),
        heel: parseNumber(columns[heelIndex]),
        trim: parseNumber(columns[trimIndex]),
      }
    })
    .filter((point): point is VakarosSeriesPoint => point !== null)
}

function extractTrackLatLngs(trackGeojson: unknown): LatLngExpression[] {
  if (
    typeof trackGeojson !== "object" ||
    trackGeojson === null ||
    !("features" in trackGeojson) ||
    !Array.isArray(trackGeojson.features)
  ) {
    return []
  }

  const coordinates = trackGeojson.features.flatMap((feature) => {
    if (
      typeof feature !== "object" ||
      feature === null ||
      !("geometry" in feature) ||
      typeof feature.geometry !== "object" ||
      feature.geometry === null ||
      !("coordinates" in feature.geometry) ||
      !Array.isArray(feature.geometry.coordinates)
    ) {
      return []
    }

    return feature.geometry.coordinates
  })

  return coordinates
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        return null
      }

      const lon = Number(coordinate[0])
      const lat = Number(coordinate[1])

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null
      }

      return [lat, lon] as LatLngExpression
    })
    .filter((coordinate): coordinate is LatLngExpression => coordinate !== null)
}

function formatTimestamp(value: string): string {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value || "-"
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date)
}

function formatNumber(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : "-"
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getSpeedColor(input: {
  maxSog: number
  minSog: number
  sog: number
}): string {
  const span = input.maxSog - input.minSog
  const ratio = span > 0 ? (input.sog - input.minSog) / span : 0.5
  const clamped = Math.min(1, Math.max(0, ratio))
  const hue = 205 - clamped * 165

  return `hsl(${hue} 85% 52%)`
}

function buildBoatIcon(leaflet: LeafletModule): DivIcon {
  return leaflet.divIcon({
    className: "vakaros-boat-icon",
    html: '<div class="vakaros-boat-marker"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

export function VakarosPlayer(input: {
  className?: string
  fileName: string
  series1HzUrl: string
  trackGeojsonUrl: string
}) {
  const mapElementRef = React.useRef<HTMLDivElement | null>(null)
  const leafletRef = React.useRef<LeafletModule | null>(null)
  const mapRef = React.useRef<LeafletMap | null>(null)
  const trackLayerRef = React.useRef<Polyline | LayerGroup | null>(null)
  const wakeLayerRef = React.useRef<LayerGroup | null>(null)
  const buoyLayerRef = React.useRef<LayerGroup | null>(null)
  const boatMarkerRef = React.useRef<Marker | null>(null)
  const buoyModeRef = React.useRef<BuoyMode>(null)
  const intervalRef = React.useRef<number | null>(null)
  const [series, setSeries] = React.useState<VakarosSeriesPoint[]>([])
  const [trackLatLngs, setTrackLatLngs] = React.useState<LatLngExpression[]>([])
  const [idx, setIdx] = React.useState(0)
  const [trimStart, setTrimStart] = React.useState(0)
  const [trimEnd, setTrimEnd] = React.useState(0)
  const [rate, setRate] = React.useState(1)
  const [trackMode, setTrackMode] = React.useState<TrackMode>("default")
  const [buoyMode, setBuoyMode] = React.useState<BuoyMode>(null)
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const maxIndex = Math.max(0, series.length - 1)
  const safeTrimStart = clampIndex(Math.min(trimStart, trimEnd), 0, maxIndex)
  const safeTrimEnd = clampIndex(Math.max(trimStart, trimEnd), 0, maxIndex)
  const currentPoint = series[clampIndex(idx, safeTrimStart, safeTrimEnd)]

  React.useEffect(() => {
    buoyModeRef.current = buoyMode
  }, [buoyMode])

  React.useEffect(() => {
    let isMounted = true

    async function loadArtifacts() {
      setIsLoading(true)
      setLoadError(null)

      try {
        const [trackResponse, seriesResponse] = await Promise.all([
          fetch(input.trackGeojsonUrl, { cache: "no-store" }),
          fetch(input.series1HzUrl, { cache: "no-store" }),
        ])

        if (!trackResponse.ok || !seriesResponse.ok) {
          throw new Error("Could not load GPS artifacts.")
        }

        const [trackPayload, seriesText] = await Promise.all([
          trackResponse.json() as Promise<unknown>,
          seriesResponse.text(),
        ])
        const nextTrackLatLngs = extractTrackLatLngs(trackPayload)
        const nextSeries = parseSeriesCsv(seriesText)

        if (nextTrackLatLngs.length === 0 || nextSeries.length === 0) {
          throw new Error("This GPS file has no playable track.")
        }

        if (!isMounted) {
          return
        }

        setTrackLatLngs(nextTrackLatLngs)
        setSeries(nextSeries)
        setIdx(0)
        setTrimStart(0)
        setTrimEnd(Math.max(0, nextSeries.length - 1))
      } catch (error) {
        if (!isMounted) {
          return
        }

        setLoadError(error instanceof Error ? error.message : "Could not load GPS file.")
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadArtifacts()

    return () => {
      isMounted = false
    }
  }, [input.series1HzUrl, input.trackGeojsonUrl])

  React.useEffect(() => {
    let isMounted = true

    async function initMap() {
      if (!mapElementRef.current || mapRef.current) {
        return
      }

      const leaflet = await import("leaflet")

      if (!isMounted || !mapElementRef.current || mapRef.current) {
        return
      }

      leafletRef.current = leaflet
      const map = leaflet.map(mapElementRef.current, {
        zoomControl: false,
        attributionControl: true,
      })
      leaflet
        .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(map)
      leaflet.control.zoom({ position: "bottomright" }).addTo(map)
      wakeLayerRef.current = leaflet.layerGroup().addTo(map)
      buoyLayerRef.current = leaflet.layerGroup().addTo(map)
      map.on("click", (event) => {
        const mode = buoyModeRef.current

        if (!mode || !buoyLayerRef.current) {
          return
        }

        const color = mode === "windward" ? "#f97316" : "#0ea5e9"
        const marker: CircleMarker = leaflet.circleMarker(event.latlng, {
          radius: 7,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 2,
        })
        marker.addTo(buoyLayerRef.current)
      })
      mapRef.current = map
    }

    void initMap()

    return () => {
      isMounted = false
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
      }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      leafletRef.current = null
      trackLayerRef.current = null
      wakeLayerRef.current = null
      buoyLayerRef.current = null
      boatMarkerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const leaflet = leafletRef.current
    const map = mapRef.current

    if (!leaflet || !map || trackLatLngs.length === 0 || series.length === 0) {
      return
    }

    if (trackLayerRef.current) {
      map.removeLayer(trackLayerRef.current)
      trackLayerRef.current = null
    }

    if (wakeLayerRef.current) {
      wakeLayerRef.current.clearLayers()
    }

    if (trackMode === "sog") {
      const start = safeTrimStart
      const end = safeTrimEnd
      const visibleSeries = series.slice(start, end + 1)
      const sogs = visibleSeries.map((point) => point.sog_kts).filter(Number.isFinite)
      const minSog = Math.min(...sogs)
      const maxSog = Math.max(...sogs)
      const step = Math.max(1, Math.ceil(visibleSeries.length / 1200))
      const layerGroup = leaflet.layerGroup()

      for (let index = 0; index < visibleSeries.length - step; index += step) {
        const left = visibleSeries[index]
        const right = visibleSeries[index + step]

        leaflet
          .polyline(
            [
              [left.lat, left.lon],
              [right.lat, right.lon],
            ],
            {
              color: getSpeedColor({
                maxSog,
                minSog,
                sog: left.sog_kts,
              }),
              opacity: 0.95,
              weight: 4,
            },
          )
          .addTo(layerGroup)
      }

      layerGroup.addTo(map)
      trackLayerRef.current = layerGroup
    } else {
      const line = leaflet.polyline(trackLatLngs, {
        color: trackMode === "wake" ? "#94a3b8" : "#2563eb",
        opacity: trackMode === "wake" ? 0.35 : 0.9,
        weight: 4,
      })
      line.addTo(map)
      trackLayerRef.current = line
    }

    if (!boatMarkerRef.current) {
      boatMarkerRef.current = leaflet
        .marker([series[0].lat, series[0].lon], {
          icon: buildBoatIcon(leaflet),
          keyboard: false,
        })
        .addTo(map)
    }

    const bounds = leaflet.latLngBounds(trackLatLngs)
    map.fitBounds(bounds.pad(0.12), {
      animate: false,
      padding: [20, 20],
    })
    window.setTimeout(() => map.invalidateSize(), 50)
  }, [safeTrimEnd, safeTrimStart, series, trackLatLngs, trackMode])

  React.useEffect(() => {
    const leaflet = leafletRef.current
    const map = mapRef.current

    if (!leaflet || !map || !currentPoint) {
      return
    }

    if (!boatMarkerRef.current) {
      boatMarkerRef.current = leaflet
        .marker([currentPoint.lat, currentPoint.lon], {
          icon: buildBoatIcon(leaflet),
          keyboard: false,
        })
        .addTo(map)
    } else {
      boatMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lon])
    }

    const markerElement = boatMarkerRef.current.getElement()
    const wrapper = markerElement?.querySelector(".vakaros-boat-marker")
    const heading = Number.isFinite(currentPoint.hdg_true)
      ? currentPoint.hdg_true
      : currentPoint.cog

    if (wrapper instanceof HTMLElement && Number.isFinite(heading)) {
      wrapper.style.transform = `rotate(${heading}deg)`
    }

    if (trackMode === "wake" && wakeLayerRef.current && idx > safeTrimStart) {
      const previousPoint = series[idx - 1]

      if (previousPoint) {
        const wakeSegment = leaflet.polyline(
          [
            [previousPoint.lat, previousPoint.lon],
            [currentPoint.lat, currentPoint.lon],
          ],
          {
            color: "#0ea5e9",
            opacity: 0.95,
            weight: 4,
          },
        )
        wakeSegment.addTo(wakeLayerRef.current)
      }
    }
  }, [currentPoint, idx, safeTrimStart, series, trackMode])

  React.useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!isPlaying || series.length === 0) {
      return
    }

    intervalRef.current = window.setInterval(() => {
      setIdx((currentIndex) => {
        const nextIndex = currentIndex + 1

        if (nextIndex > safeTrimEnd) {
          setIsPlaying(false)
          return safeTrimStart
        }

        return nextIndex
      })
    }, Math.max(40, 1000 / rate))

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isPlaying, rate, safeTrimEnd, safeTrimStart, series.length])

  function handleFitTrack(): void {
    const leaflet = leafletRef.current
    const map = mapRef.current

    if (!leaflet || !map || trackLatLngs.length === 0) {
      return
    }

    map.fitBounds(leaflet.latLngBounds(trackLatLngs).pad(0.12), {
      animate: true,
      padding: [20, 20],
    })
  }

  function handleCenterBoat(): void {
    const map = mapRef.current

    if (!map || !currentPoint) {
      return
    }

    map.panTo([currentPoint.lat, currentPoint.lon], {
      animate: true,
      duration: 0.3,
    })
  }

  function handleTrackModeToggle(): void {
    setTrackMode((currentMode) =>
      currentMode === "default" ? "sog" : currentMode === "sog" ? "wake" : "default",
    )
  }

  function handleTrimStartChange(value: number): void {
    const nextStart = clampIndex(value, 0, maxIndex)
    setTrimStart(nextStart)
    setIdx((currentIndex) => clampIndex(currentIndex, nextStart, safeTrimEnd))
  }

  function handleTrimEndChange(value: number): void {
    const nextEnd = clampIndex(value, 0, maxIndex)
    setTrimEnd(nextEnd)
    setIdx((currentIndex) => clampIndex(currentIndex, safeTrimStart, nextEnd))
  }

  if (isLoading) {
    return (
      <div className={cn("flex h-full min-h-96 items-center justify-center", input.className)}>
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className={cn("flex h-full min-h-96 items-center justify-center", input.className)}>
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          {loadError}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]", input.className)}>
      <div className="relative min-h-0 overflow-hidden rounded-lg border bg-muted">
        <div ref={mapElementRef} className="h-full min-h-96 w-full" />

        <div className="absolute top-2 left-2 z-[500] grid max-w-[calc(100%-1rem)] grid-cols-2 gap-1.5 rounded-lg border bg-background/95 p-2 text-xs shadow-sm backdrop-blur sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Time</p>
            <p className="font-medium">{formatTimestamp(currentPoint?.timestamp ?? "")}</p>
          </div>
          <div>
            <p className="text-muted-foreground">SOG</p>
            <p className="font-medium">{formatNumber(currentPoint?.sog_kts ?? Number.NaN, 2)} kt</p>
          </div>
          <div>
            <p className="text-muted-foreground">COG/HDG</p>
            <p className="font-medium">
              {formatNumber(currentPoint?.cog ?? Number.NaN, 0)} /{" "}
              {formatNumber(currentPoint?.hdg_true ?? Number.NaN, 0)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Heel/Trim</p>
            <p className="font-medium">
              {formatNumber(currentPoint?.heel ?? Number.NaN, 1)} /{" "}
              {formatNumber(currentPoint?.trim ?? Number.NaN, 1)}
            </p>
          </div>
        </div>

        <div className="absolute right-2 top-2 z-[500] flex flex-col gap-1.5">
          <Button type="button" size="icon-sm" variant="secondary" title="Fit track" onClick={handleFitTrack}>
            <RouteIcon className="size-4" />
            <span className="sr-only">Fit track</span>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            title="Center boat"
            onClick={handleCenterBoat}
          >
            <LocateFixedIcon className="size-4" />
            <span className="sr-only">Center boat</span>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={trackMode === "default" ? "secondary" : "default"}
            title="Track mode"
            onClick={handleTrackModeToggle}
          >
            <WavesIcon className="size-4" />
            <span className="sr-only">Track mode</span>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={buoyMode === "windward" ? "default" : "secondary"}
            title="Windward buoy"
            onClick={() => setBuoyMode((currentMode) => (currentMode === "windward" ? null : "windward"))}
          >
            <MapPinIcon className="size-4" />
            <span className="sr-only">Windward buoy</span>
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={buoyMode === "leeward" ? "default" : "secondary"}
            title="Leeward buoy"
            onClick={() => setBuoyMode((currentMode) => (currentMode === "leeward" ? null : "leeward"))}
          >
            <CrosshairIcon className="size-4" />
            <span className="sr-only">Leeward buoy</span>
          </Button>
        </div>
      </div>

      <div className="space-y-3 border-t bg-background p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={() => setIsPlaying((currentValue) => !currentValue)}
          >
            {isPlaying ? <PauseIcon className="size-4" /> : <PlayIcon className="size-4" />}
            <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
          </Button>
          <input
            type="range"
            min={safeTrimStart}
            max={safeTrimEnd}
            value={clampIndex(idx, safeTrimStart, safeTrimEnd)}
            onChange={(event) => setIdx(Number.parseInt(event.currentTarget.value, 10))}
            className="min-w-0 flex-1"
            aria-label="Playback position"
          />
          <span className="w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {clampIndex(idx, safeTrimStart, safeTrimEnd) + 1}/{series.length}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="min-w-0 text-xs text-muted-foreground">
              Start
              <input
                type="range"
                min={0}
                max={maxIndex}
                value={safeTrimStart}
                onChange={(event) => handleTrimStartChange(Number.parseInt(event.currentTarget.value, 10))}
                className="mt-1 w-full"
              />
            </label>
            <label className="min-w-0 text-xs text-muted-foreground">
              End
              <input
                type="range"
                min={0}
                max={maxIndex}
                value={safeTrimEnd}
                onChange={(event) => handleTrimEndChange(Number.parseInt(event.currentTarget.value, 10))}
                className="mt-1 w-full"
              />
            </label>
          </div>

          <div className="flex min-w-0 items-center justify-between gap-2 md:justify-end">
            <div className="flex items-center gap-1 rounded-lg border p-1">
              {[1, 2, 4, 10].map((speed) => (
                <Button
                  key={speed}
                  type="button"
                  variant={rate === speed ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setRate(speed)}
                >
                  {speed}x
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <FastForwardIcon className="size-3.5" />
              {trackMode === "default" ? "Track" : trackMode === "sog" ? "SOG" : "Wake"}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
