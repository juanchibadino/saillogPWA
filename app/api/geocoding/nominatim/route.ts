import { NextResponse } from "next/server";

type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  country?: string;
};

type NominatimSearchResult = {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
};

type LocationResult = {
  placeId: string;
  displayName: string;
  city: string;
  country: string;
  lat: string;
  lon: string;
};

function normalizeText(value: string | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function extractCity(address: NominatimAddress | undefined): string | null {
  return (
    normalizeText(address?.city) ??
    normalizeText(address?.town) ??
    normalizeText(address?.village) ??
    normalizeText(address?.municipality) ??
    null
  );
}

function normalizeLocation(result: NominatimSearchResult): LocationResult | null {
  const city = extractCity(result.address);
  const country = normalizeText(result.address?.country);

  if (!city || !country) {
    return null;
  }

  return {
    placeId: String(result.place_id),
    displayName: `${city}, ${country}`,
    city,
    country,
    lat: result.lat,
    lon: result.lon,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    limit: "10",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: {
          "User-Agent": "sailog/1.0 (internal operations app)",
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return NextResponse.json({ results: [] });
    }

    const payload = (await response.json()) as NominatimSearchResult[];
    const normalizedResults = payload
      .map(normalizeLocation)
      .filter((result): result is LocationResult => Boolean(result))
      .slice(0, 5);

    return NextResponse.json({ results: normalizedResults });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
