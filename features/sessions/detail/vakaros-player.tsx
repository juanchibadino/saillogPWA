"use client"

import * as React from "react"
import type {
  CircleMarker,
  DivIcon,
  LatLngBounds,
  LatLngExpression,
  LayerGroup,
  Map as LeafletMap,
  Marker,
  Polyline,
} from "leaflet"
import {
  CrosshairIcon,
  Loader2Icon,
  Maximize2Icon,
  MapPinIcon,
  MenuIcon,
  MinusIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  RouteIcon,
  SaveIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Slider } from "@/components/ui/slider"
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

type BuoyMode = "windward" | "leeward" | null
type TrailMode = "line" | "speed"
type PlacedBuoy = {
  id: string
  lat: number
  lon: number
  mode: Exclude<BuoyMode, null>
}
type SavedTrim = {
  id: string
  buoys: PlacedBuoy[]
  createdAt: string
  name: string
  trimEnd: number
  trimStart: number
}

const PLAYBACK_RATES = [1, 2, 4, 10] as const
type PlaybackRate = (typeof PLAYBACK_RATES)[number]
const MIN_TRIM_SPAN = 30
const TRIM_VIEWPORT_PADDING_RATIO = 0.25
const SPEED_COLOR_STOPS = ["#3aa0ff", "#ff3b30"] as const

type LeafletMapWithBoundsCenterZoom = LeafletMap & {
  _getBoundsCenterZoom?: (
    bounds: LatLngBounds,
    options: {
      paddingBottomRight: [number, number]
      paddingTopLeft: [number, number]
    }
  ) => { zoom?: number }
}

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

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

function formatNumber(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : "-"
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampRatio(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function hexToRgb(hex: string): { b: number; g: number; r: number } {
  const normalized = hex.replace("#", "")
  const value = Number.parseInt(normalized.length === 3
    ? normalized.split("").map((part) => `${part}${part}`).join("")
    : normalized, 16)

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  }
}

function rgbToHex(input: { b: number; g: number; r: number }): string {
  const toHex = (value: number) =>
    Math.round(value).toString(16).padStart(2, "0")

  return `#${toHex(input.r)}${toHex(input.g)}${toHex(input.b)}`
}

function interpolate(start: number, end: number, ratio: number): number {
  return start + (end - start) * ratio
}

function gradientColorAt(ratio: number, stops: readonly string[]): string {
  if (stops.length === 0) {
    return "#2563eb"
  }

  if (stops.length === 1) {
    return stops[0]
  }

  const normalizedRatio = clampRatio(ratio)
  const maxStopIndex = stops.length - 1
  const stopIndex = Math.min(maxStopIndex - 1, Math.floor(normalizedRatio * maxStopIndex))
  const localRatio = (normalizedRatio - stopIndex / maxStopIndex) * maxStopIndex
  const start = hexToRgb(stops[stopIndex])
  const end = hexToRgb(stops[stopIndex + 1])

  return rgbToHex({
    r: interpolate(start.r, end.r, localRatio),
    g: interpolate(start.g, end.g, localRatio),
    b: interpolate(start.b, end.b, localRatio),
  })
}

function getSogRange(points: VakarosSeriesPoint[]): { max: number; min: number } | null {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const point of points) {
    if (!Number.isFinite(point.sog_kts)) {
      continue
    }

    min = Math.min(min, Math.max(0, point.sog_kts))
    max = Math.max(max, Math.max(0, point.sog_kts))
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null
  }

  return { min, max }
}

function trimTrackLatLngs(
  trackLatLngs: LatLngExpression[],
  input: {
    maxIndex: number
    trimEnd: number
    trimStart: number
  }
): LatLngExpression[] {
  if (trackLatLngs.length < 2 || input.maxIndex <= 0) {
    return trackLatLngs
  }

  const maxTrackPoint = trackLatLngs.length - 1
  const startRatio = input.trimStart / input.maxIndex
  const endRatio = input.trimEnd / input.maxIndex
  const startPoint = Math.floor(clampRatio(startRatio) * maxTrackPoint)
  const endPoint = Math.max(
    startPoint + 1,
    Math.floor(clampRatio(endRatio) * maxTrackPoint)
  )

  return trackLatLngs.slice(startPoint, Math.min(maxTrackPoint, endPoint) + 1)
}

function getMinimumTrimViewportSpan(input: {
  maxIndex: number
  trimEnd: number
  trimStart: number
}): number {
  if (input.maxIndex <= 0) {
    return 0
  }

  const selectedSpan = Math.max(1, input.trimEnd - input.trimStart)

  return Math.min(
    input.maxIndex,
    Math.max(MIN_TRIM_SPAN, Math.ceil(selectedSpan * (1 + TRIM_VIEWPORT_PADDING_RATIO)))
  )
}

function getTrimViewportContainingRange(input: {
  center: number
  maxIndex: number
  span: number
  trimEnd: number
  trimStart: number
}): { end: number; start: number } {
  if (input.maxIndex <= 0) {
    return { start: 0, end: 0 }
  }

  const trimStart = clampIndex(Math.min(input.trimStart, input.trimEnd), 0, input.maxIndex)
  const trimEnd = clampIndex(Math.max(input.trimStart, input.trimEnd), 0, input.maxIndex)
  const selectedSpan = Math.max(1, trimEnd - trimStart)
  const span = clampIndex(Math.round(Math.max(input.span, selectedSpan)), 1, input.maxIndex)
  const center = clampIndex(input.center, trimStart, trimEnd)
  let start = Math.min(trimStart, center - Math.floor(span / 2))
  let end = start + span

  if (end < trimEnd) {
    end = trimEnd
    start = end - span
  }

  if (start < 0) {
    end -= start
    start = 0
  }

  if (end > input.maxIndex) {
    start -= end - input.maxIndex
    end = input.maxIndex
  }

  return {
    start: clampIndex(start, 0, input.maxIndex),
    end: clampIndex(end, 0, input.maxIndex),
  }
}

function buildBoatIcon(leaflet: LeafletModule): DivIcon {
  return leaflet.divIcon({
    className: "vakaros-boat-icon",
    html: '<div class="vakaros-boat-marker"></div>',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function createLocalId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function copyBuoys(buoys: PlacedBuoy[]): PlacedBuoy[] {
  return buoys.map((buoy) => ({ ...buoy }))
}

function formatTrimRange(input: {
  trimEnd: number
  trimStart: number
}): string {
  return `${input.trimStart + 1}-${input.trimEnd + 1}`
}

function getSliderPointValue(value: number | readonly number[], fallback: number): number {
  const nextValue = Array.isArray(value) ? value[0] : value

  return Number.isFinite(nextValue) ? Math.round(nextValue) : fallback
}

function getSliderRangeValue(
  value: number | readonly number[],
  fallback: readonly [number, number]
): [number, number] {
  if (!Array.isArray(value)) {
    return [fallback[0], fallback[1]]
  }

  const nextStart = Number.isFinite(value[0]) ? Math.round(value[0]) : fallback[0]
  const nextEnd = Number.isFinite(value[1]) ? Math.round(value[1]) : fallback[1]

  return [nextStart, nextEnd]
}

function lockMapToBounds(map: LeafletMap, bounds: LatLngBounds): void {
  if (!bounds.isValid()) {
    return
  }

  const paddedBounds = bounds.pad(0.1)
  map.options.maxBoundsViscosity = 1
  map.setMaxBounds(paddedBounds)

  const calc = (map as LeafletMapWithBoundsCenterZoom)._getBoundsCenterZoom?.(paddedBounds, {
    paddingTopLeft: [24, 24],
    paddingBottomRight: [24, 24],
  })
  const zoom = calc?.zoom

  if (typeof zoom === "number" && Number.isFinite(zoom)) {
    map.setMinZoom(zoom)
  }
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
  const buoyLayerRef = React.useRef<LayerGroup | null>(null)
  const boatMarkerRef = React.useRef<Marker | null>(null)
  const buoyModeRef = React.useRef<BuoyMode>(null)
  const intervalRef = React.useRef<number | null>(null)
  const [series, setSeries] = React.useState<VakarosSeriesPoint[]>([])
  const [trackLatLngs, setTrackLatLngs] = React.useState<LatLngExpression[]>([])
  const [buoys, setBuoys] = React.useState<PlacedBuoy[]>([])
  const [savedTrims, setSavedTrims] = React.useState<SavedTrim[]>([])
  const [idx, setIdx] = React.useState(0)
  const [trimStart, setTrimStart] = React.useState(0)
  const [trimEnd, setTrimEnd] = React.useState(0)
  const [trimViewportStart, setTrimViewportStart] = React.useState(0)
  const [trimViewportEnd, setTrimViewportEnd] = React.useState(0)
  const [rate, setRate] = React.useState<PlaybackRate>(1)
  const [buoyMode, setBuoyMode] = React.useState<BuoyMode>(null)
  const [trailMode, setTrailMode] = React.useState<TrailMode>("line")
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isMapReady, setIsMapReady] = React.useState(false)
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const maxIndex = Math.max(0, series.length - 1)
  const safeTrimStart = clampIndex(Math.min(trimStart, trimEnd), 0, maxIndex)
  const safeTrimEnd = clampIndex(Math.max(trimStart, trimEnd), 0, maxIndex)
  const safeTrimViewportStart = clampIndex(
    Math.min(trimViewportStart, trimViewportEnd, safeTrimStart),
    0,
    maxIndex
  )
  const safeTrimViewportEnd = clampIndex(
    Math.max(trimViewportStart, trimViewportEnd, safeTrimEnd),
    0,
    maxIndex
  )
  const selectedTrimSpan = safeTrimEnd - safeTrimStart
  const trimViewportSpan = safeTrimViewportEnd - safeTrimViewportStart
  const minimumTrimViewportSpan = getMinimumTrimViewportSpan({
    maxIndex,
    trimEnd: safeTrimEnd,
    trimStart: safeTrimStart,
  })
  const canTrimZoomIn =
    maxIndex > 0 &&
    selectedTrimSpan < maxIndex &&
    trimViewportSpan > minimumTrimViewportSpan
  const canTrimZoomOut =
    maxIndex > 0 && (safeTrimViewportStart > 0 || safeTrimViewportEnd < maxIndex)
  const visibleTrackLatLngs = React.useMemo(
    () =>
      trimTrackLatLngs(trackLatLngs, {
        maxIndex,
        trimEnd: safeTrimEnd,
        trimStart: safeTrimStart,
      }),
    [maxIndex, safeTrimEnd, safeTrimStart, trackLatLngs]
  )
  const visibleSeries = React.useMemo(
    () => series.slice(safeTrimStart, safeTrimEnd + 1),
    [safeTrimEnd, safeTrimStart, series]
  )
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
        setBuoys([])
        setSavedTrims([])
        setBuoyMode(null)
        setIsPlaying(false)
        setIdx(0)
        setTrimStart(0)
        setTrimEnd(Math.max(0, nextSeries.length - 1))
        setTrimViewportStart(0)
        setTrimViewportEnd(Math.max(0, nextSeries.length - 1))
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

    if (isLoading || loadError) {
      setIsMapReady(false)
    }

    async function initMap() {
      if (isLoading || loadError) {
        return
      }

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
      leaflet.control.zoom({ position: "topright" }).addTo(map)
      buoyLayerRef.current = leaflet.layerGroup().addTo(map)
      map.on("click", (event) => {
        const mode = buoyModeRef.current

        if (!mode) {
          return
        }

        setBuoys((currentBuoys) => [
          ...currentBuoys,
          {
            id: createLocalId("buoy"),
            lat: event.latlng.lat,
            lon: event.latlng.lng,
            mode,
          },
        ])
      })
      mapRef.current = map
      setIsMapReady(true)
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
      buoyLayerRef.current = null
      boatMarkerRef.current = null
    }
  }, [isLoading, loadError])

  React.useEffect(() => {
    const leaflet = leafletRef.current
    const map = mapRef.current

    if (
      !isMapReady ||
      !leaflet ||
      !map ||
      trackLatLngs.length < 2 ||
      visibleTrackLatLngs.length < 2 ||
      series.length === 0
    ) {
      return
    }

    if (trackLayerRef.current) {
      map.removeLayer(trackLayerRef.current)
      trackLayerRef.current = null
    }

    let nextTrackLayer: LayerGroup | Polyline

    if (trailMode === "speed") {
      const speedLayer = leaflet.layerGroup()
      const speedRange = getSogRange(visibleSeries)
      const span = speedRange ? speedRange.max - speedRange.min : 0
      const segmentStep = Math.max(1, Math.ceil(visibleTrackLatLngs.length / 1200))

      for (let pointIndex = 0; pointIndex < visibleTrackLatLngs.length - 1; pointIndex += segmentStep) {
        const nextPointIndex = Math.min(visibleTrackLatLngs.length - 1, pointIndex + segmentStep)
        const trackRatio = pointIndex / Math.max(1, visibleTrackLatLngs.length - 2)
        const seriesIndex = clampIndex(
          Math.round(trackRatio * Math.max(0, visibleSeries.length - 1)),
          0,
          Math.max(0, visibleSeries.length - 1)
        )
        const speed = visibleSeries[seriesIndex]?.sog_kts ?? Number.NaN
        const speedRatio =
          speedRange && span > 0 && Number.isFinite(speed)
            ? (Math.max(0, speed) - speedRange.min) / span
            : 0.5

        leaflet
          .polyline([visibleTrackLatLngs[pointIndex], visibleTrackLatLngs[nextPointIndex]], {
            color: gradientColorAt(speedRatio, SPEED_COLOR_STOPS),
            opacity: 0.92,
            weight: 4,
          })
          .addTo(speedLayer)
      }

      nextTrackLayer = speedLayer
    } else {
      nextTrackLayer = leaflet.polyline(visibleTrackLatLngs, {
        color: "#2563eb",
        opacity: 0.9,
        weight: 4,
      })
    }

    nextTrackLayer.addTo(map)
    trackLayerRef.current = nextTrackLayer

    if (!boatMarkerRef.current) {
      boatMarkerRef.current = leaflet
        .marker([series[0].lat, series[0].lon], {
          icon: buildBoatIcon(leaflet),
          keyboard: false,
        })
        .addTo(map)
    }

    const bounds = leaflet.latLngBounds(visibleTrackLatLngs)
    map.fitBounds(bounds.pad(0.12), {
      animate: false,
      padding: [20, 20],
    })
    lockMapToBounds(map, leaflet.latLngBounds(trackLatLngs))
    window.setTimeout(() => map.invalidateSize(), 50)
  }, [isMapReady, series, trackLatLngs, trailMode, visibleSeries, visibleTrackLatLngs])

  React.useEffect(() => {
    const leaflet = leafletRef.current
    const map = mapRef.current

    if (!isMapReady || !leaflet || !map || !currentPoint) {
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
  }, [currentPoint, isMapReady])

  React.useEffect(() => {
    const leaflet = leafletRef.current
    const buoyLayer = buoyLayerRef.current

    if (!isMapReady || !leaflet || !buoyLayer) {
      return
    }

    buoyLayer.clearLayers()

    const leewardBuoyLatLngs: LatLngExpression[] = []

    for (const buoy of buoys) {
      const color = buoy.mode === "windward" ? "#f97316" : "#0ea5e9"
      const marker: CircleMarker = leaflet.circleMarker([buoy.lat, buoy.lon], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.95,
        weight: 2,
      })

      marker.addTo(buoyLayer)

      if (buoy.mode === "leeward") {
        leewardBuoyLatLngs.push([buoy.lat, buoy.lon])
      }
    }

    const latestLeewardPair = leewardBuoyLatLngs.slice(-2)

    if (latestLeewardPair.length === 2) {
      leaflet
        .polyline(latestLeewardPair, {
          color: "#0ea5e9",
          dashArray: "8 6",
          opacity: 0.95,
          weight: 3,
        })
        .addTo(buoyLayer)
    }
  }, [buoys, isMapReady])

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

    if (!leaflet || !map || visibleTrackLatLngs.length < 2) {
      return
    }

    const bounds = leaflet.latLngBounds(visibleTrackLatLngs)
    map.fitBounds(bounds.pad(0.12), {
      animate: true,
      padding: [20, 20],
    })
    if (trackLatLngs.length >= 2) {
      lockMapToBounds(map, leaflet.latLngBounds(trackLatLngs))
    }
  }

  function applyTrimWindow(input: {
    trimEnd: number
    trimStart: number
  }): void {
    const nextStart = clampIndex(Math.min(input.trimStart, input.trimEnd), 0, maxIndex)
    const nextEnd = clampIndex(Math.max(input.trimStart, input.trimEnd), 0, maxIndex)

    setTrimStart(nextStart)
    setTrimEnd(nextEnd)
    setIdx((currentIndex) => clampIndex(currentIndex, nextStart, nextEnd))
  }

  function setTrimViewportForRange(input: {
    trimEnd: number
    trimStart: number
  }): void {
    const nextTrimStart = clampIndex(Math.min(input.trimStart, input.trimEnd), 0, maxIndex)
    const nextTrimEnd = clampIndex(Math.max(input.trimStart, input.trimEnd), 0, maxIndex)
    const currentStart = clampIndex(Math.min(trimViewportStart, trimViewportEnd), 0, maxIndex)
    const currentEnd = clampIndex(Math.max(trimViewportStart, trimViewportEnd), 0, maxIndex)

    if (currentStart <= nextTrimStart && currentEnd >= nextTrimEnd) {
      return
    }

    const currentSpan = Math.max(
      currentEnd - currentStart,
      getMinimumTrimViewportSpan({
        maxIndex,
        trimEnd: nextTrimEnd,
        trimStart: nextTrimStart,
      })
    )
    const nextViewport = getTrimViewportContainingRange({
      center: Math.round((nextTrimStart + nextTrimEnd) / 2),
      maxIndex,
      span: currentSpan,
      trimEnd: nextTrimEnd,
      trimStart: nextTrimStart,
    })

    setTrimViewportStart(nextViewport.start)
    setTrimViewportEnd(nextViewport.end)
  }

  function handleTrimZoom(direction: "in" | "out"): void {
    if (maxIndex <= 0) {
      return
    }

    if (direction === "in" && !canTrimZoomIn) {
      return
    }

    if (direction === "out" && !canTrimZoomOut) {
      return
    }

    const currentSpan = Math.max(1, trimViewportSpan)
    const nextSpan =
      direction === "in"
        ? Math.max(minimumTrimViewportSpan, Math.round(currentSpan * 0.5))
        : Math.min(maxIndex, Math.round(currentSpan * 2))

    if (nextSpan === currentSpan) {
      return
    }

    const nextViewport = getTrimViewportContainingRange({
      center: Math.round((safeTrimStart + safeTrimEnd) / 2),
      maxIndex,
      span: nextSpan,
      trimEnd: safeTrimEnd,
      trimStart: safeTrimStart,
    })

    setTrimViewportStart(nextViewport.start)
    setTrimViewportEnd(nextViewport.end)
  }

  function handleSaveTrim(): void {
    const savedTrim: SavedTrim = {
      id: createLocalId("trim"),
      buoys: copyBuoys(buoys),
      createdAt: new Date().toISOString(),
      name: `Trim ${savedTrims.length + 1}`,
      trimEnd: safeTrimEnd,
      trimStart: safeTrimStart,
    }

    setSavedTrims((currentSavedTrims) => [savedTrim, ...currentSavedTrims])
    toast.success("Trim saved.")
  }

  function handleApplySavedTrim(savedTrim: SavedTrim): void {
    applyTrimWindow({
      trimEnd: savedTrim.trimEnd,
      trimStart: savedTrim.trimStart,
    })
    setTrimViewportForRange({
      trimEnd: savedTrim.trimEnd,
      trimStart: savedTrim.trimStart,
    })
    setBuoys(copyBuoys(savedTrim.buoys))
    setBuoyMode(null)
    toast.success(`${savedTrim.name} loaded.`)
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
    <div className={cn("grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden rounded-lg bg-black", input.className)}>
      <div className="vakaros-player-map relative min-h-0 overflow-hidden rounded-lg border bg-muted">
        <div ref={mapElementRef} className="h-full min-h-96 w-full" />

        <div className="absolute left-3 top-3 z-[500] flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="vakaros-map-button h-11 w-11"
                  title="Trims"
                />
              }
            >
              <MenuIcon className="size-5" />
              <span className="sr-only">Trims</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="bottom" className="w-56">
              <DropdownMenuLabel>Trims</DropdownMenuLabel>
              {savedTrims.length === 0 ? (
                <DropdownMenuItem disabled>No saved trims</DropdownMenuItem>
              ) : (
                savedTrims.map((savedTrim) => (
                  <DropdownMenuItem key={savedTrim.id} onClick={() => handleApplySavedTrim(savedTrim)}>
                    <span className="min-w-0 flex-1 truncate">{savedTrim.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTrimRange(savedTrim)}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuItem onClick={handleFitTrack}>Fit trail</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="vakaros-map-button h-11 w-11"
            title="Save trim"
            onClick={handleSaveTrim}
          >
            <SaveIcon className="size-5" />
            <span className="sr-only">Save trim</span>
          </Button>
        </div>

        <div className="vakaros-data-overlay pointer-events-none absolute left-4 bottom-20 z-[500] grid max-w-[calc(100%-7rem)] grid-cols-1 gap-1.5 text-xs sm:bottom-5 sm:grid-cols-4 sm:gap-4">
          <div>
            <p className="text-[0.6rem] font-medium uppercase leading-tight">SOG (kn)</p>
            <p className="text-[0.95rem] font-semibold leading-tight tabular-nums sm:text-base">
              {formatNumber(currentPoint?.sog_kts ?? Number.NaN, 2)}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] font-medium uppercase leading-tight">COG/HDG (deg)</p>
            <p className="text-[0.95rem] font-semibold leading-tight tabular-nums sm:text-base">
              {formatNumber(currentPoint?.cog ?? Number.NaN, 0)} /{" "}
              {formatNumber(currentPoint?.hdg_true ?? Number.NaN, 0)}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] font-medium uppercase leading-tight">Heel / Trim</p>
            <p className="text-[0.95rem] font-semibold leading-tight tabular-nums sm:text-base">
              {formatNumber(currentPoint?.heel ?? Number.NaN, 1)} /{" "}
              {formatNumber(currentPoint?.trim ?? Number.NaN, 1)}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] font-medium uppercase leading-tight">Date & Time</p>
            <p className="text-[0.95rem] font-semibold leading-tight tabular-nums sm:text-base">
              {formatTimestamp(currentPoint?.timestamp ?? "")}
            </p>
          </div>
        </div>

        <div className="absolute left-3 bottom-3 z-[1500] flex min-w-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="vakaros-map-button h-11 w-11"
            title="Fit trimmed trail"
            onClick={handleFitTrack}
          >
            <Maximize2Icon className="size-4" />
            <span className="sr-only">Fit trimmed trail</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="secondary"
                  size="default"
                  className="vakaros-map-button h-11 min-w-16 px-3"
                  title="Playback speed"
                />
              }
            >
              {rate}x
              <span className="sr-only">Playback speed</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-28">
              {PLAYBACK_RATES.map((speed) => (
                <DropdownMenuItem key={speed} onClick={() => setRate(speed)}>
                  {speed}x
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant={buoyMode ? "default" : "secondary"}
                  size="icon"
                  className={cn("h-11 w-11", !buoyMode && "vakaros-map-button")}
                  title="Add buoy"
                />
              }
            >
              <PlusIcon className="size-5" />
              <span className="sr-only">Add buoy</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-44">
              <DropdownMenuItem
                onClick={() =>
                  setBuoyMode((currentMode) => (currentMode === "windward" ? null : "windward"))
                }
              >
                <MapPinIcon className="size-4 text-orange-500" />
                Windward
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  setBuoyMode((currentMode) => (currentMode === "leeward" ? null : "leeward"))
                }
              >
                <CrosshairIcon className="size-4 text-sky-500" />
                Leeward
              </DropdownMenuItem>
              <DropdownMenuItem disabled={buoys.length === 0} onClick={() => setBuoys([])}>
                Clear buoys
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant={trailMode === "speed" ? "default" : "secondary"}
            size="icon"
            className={cn("h-11 w-11", trailMode === "line" && "vakaros-map-button")}
            title={trailMode === "speed" ? "Speed trail" : "Trail line"}
            onClick={() => setTrailMode((currentMode) => (currentMode === "speed" ? "line" : "speed"))}
          >
            <RouteIcon className="size-5" />
            <span className="sr-only">
              {trailMode === "speed" ? "Speed trail" : "Trail line"}
            </span>
          </Button>
        </div>

        <Button
          type="button"
          size="icon"
          className="absolute right-4 bottom-4 z-[1500] h-16 w-16 rounded-full shadow-xl sm:h-18 sm:w-18"
          onClick={() => setIsPlaying((currentValue) => !currentValue)}
        >
          {isPlaying ? <PauseIcon className="size-6" /> : <PlayIcon className="ml-1 size-7" />}
          <span className="sr-only">{isPlaying ? "Pause" : "Play"}</span>
        </Button>
      </div>

      <div className="space-y-10 border-t border-white/10 bg-black p-4 text-white">
        <div className="mt-2 flex min-w-0 items-center">
          <Slider
            min={safeTrimStart}
            max={safeTrimEnd}
            step={1}
            value={[clampIndex(idx, safeTrimStart, safeTrimEnd)]}
            onValueChange={(value) => {
              setIdx(getSliderPointValue(value, clampIndex(idx, safeTrimStart, safeTrimEnd)))
            }}
            className="vakaros-playback-slider min-w-0 flex-1"
            aria-label="Trail position"
          />
        </div>

        <div className="grid gap-3">
          <Slider
            min={safeTrimViewportStart}
            max={safeTrimViewportEnd}
            step={1}
            minStepsBetweenValues={1}
            thumbCollisionBehavior="none"
            value={[safeTrimStart, safeTrimEnd]}
            onValueChange={(value) => {
              const [nextStart, nextEnd] = getSliderRangeValue(value, [safeTrimStart, safeTrimEnd])

              applyTrimWindow({
                trimEnd: nextEnd,
                trimStart: nextStart,
              })
            }}
            className="vakaros-trim-range-slider min-w-0"
            aria-label="Trim trail"
          />

          <div className="mt-3 grid w-full grid-cols-2 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="vakaros-control-button h-11 w-full"
              title="Trim zoom out"
              disabled={!canTrimZoomOut}
              onClick={() => handleTrimZoom("out")}
            >
              <MinusIcon className="size-5" />
              <span className="sr-only">Trim zoom out</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="vakaros-control-button h-11 w-full"
              title="Trim zoom in"
              disabled={!canTrimZoomIn}
              onClick={() => handleTrimZoom("in")}
            >
              <PlusIcon className="size-5" />
              <span className="sr-only">Trim zoom in</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
