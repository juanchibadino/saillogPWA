import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildTeamAssetsHref,
  normalizeRequestedPage,
  normalizeRequestedUuid,
  normalizeRequestedYear,
  resolveTeamAssetTab,
  resolveTeamAssetsListRequest,
} from "./list-route-state.mjs"

const scope = {
  activeOrgId: "11111111-1111-4111-8111-111111111111",
  activeTeamId: "22222222-2222-4222-8222-222222222222",
}

describe("team assets route state", () => {
  it("defaults to images for missing or invalid tab values", () => {
    assert.equal(resolveTeamAssetTab(undefined), "images")
    assert.equal(resolveTeamAssetTab("analytics"), "images")
    assert.equal(resolveTeamAssetTab("files"), "files")
  })

  it("normalizes invalid pagination and year values", () => {
    assert.equal(normalizeRequestedPage(undefined), 1)
    assert.equal(normalizeRequestedPage("0"), 1)
    assert.equal(normalizeRequestedPage("3"), 3)
    assert.equal(normalizeRequestedYear("1999"), undefined)
    assert.equal(normalizeRequestedYear("2026"), 2026)
    assert.equal(normalizeRequestedYear("bad"), undefined)
  })

  it("accepts only uuid-like filter identifiers", () => {
    assert.equal(normalizeRequestedUuid("not-a-uuid"), undefined)
    assert.equal(
      normalizeRequestedUuid("33333333-3333-4333-8333-333333333333"),
      "33333333-3333-4333-8333-333333333333",
    )
  })

  it("resolves a full request with safe fallbacks", () => {
    assert.deepEqual(
      resolveTeamAssetsListRequest({
        tabParam: "files",
        pageParam: "2",
        loadMoreParam: "1",
        venueParam: "33333333-3333-4333-8333-333333333333",
        yearParam: "2026",
        campParam: "bad",
        sessionParam: "44444444-4444-4444-8444-444444444444",
      }),
      {
        requestedTab: "files",
        requestedPage: 2,
        requestedLoadMoreMode: true,
        requestedVenueId: "33333333-3333-4333-8333-333333333333",
        requestedYear: 2026,
        requestedCampId: undefined,
        requestedSessionId: "44444444-4444-4444-8444-444444444444",
      },
    )
  })

  it("builds scoped hrefs and omits default values", () => {
    assert.equal(
      buildTeamAssetsHref({
        scope,
        tab: "images",
      }),
      "/team-assets?org=11111111-1111-4111-8111-111111111111&team=22222222-2222-4222-8222-222222222222",
    )

    assert.equal(
      buildTeamAssetsHref({
        scope,
        tab: "files",
        venueId: "33333333-3333-4333-8333-333333333333",
        year: 2026,
        campId: "44444444-4444-4444-8444-444444444444",
        sessionId: "55555555-5555-4555-8555-555555555555",
        page: 3,
        loadMore: true,
      }),
      "/team-assets?org=11111111-1111-4111-8111-111111111111&team=22222222-2222-4222-8222-222222222222&tab=files&venue=33333333-3333-4333-8333-333333333333&year=2026&camp=44444444-4444-4444-8444-444444444444&session=55555555-5555-4555-8555-555555555555&page=3&loadMore=1",
    )
  })
})
