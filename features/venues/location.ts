export type VenueLocation = {
  city: string
  country: string
}

export function formatVenueLocation(location: VenueLocation): string {
  return `${location.city}, ${location.country}`
}
