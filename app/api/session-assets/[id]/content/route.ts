import { NextResponse } from "next/server"

import {
  logSessionDetailTiming,
  startSessionDetailTiming,
} from "@/features/sessions/detail-timing"
import { createServerSupabaseClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

const ASSET_CONTENT_SIGNED_URL_SECONDS = 5 * 60

export async function GET(_request: Request, context: RouteContext) {
  const startedAt = startSessionDetailTiming()
  const resolvedParams = await context.params
  const assetId = resolvedParams.id?.trim()
  const logAssetTiming = (input: {
    error?: string
    outcome: string
    sessionId?: string | null
    status: "success" | "error"
    statusCode: number
  }) => {
    logSessionDetailTiming({
      route: "/api/session-assets/[id]/content",
      phase: "asset_content_signed_url",
      startedAt,
      sessionId: input.sessionId,
      activeTeamId: null,
      status: input.status,
      error: input.error,
      metadata: {
        assetId: assetId ?? null,
        outcome: input.outcome,
        statusCode: input.statusCode,
      },
    })
  }

  if (!assetId) {
    logAssetTiming({
      outcome: "missing_asset_id",
      status: "error",
      statusCode: 400,
    })
    return new NextResponse(null, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    logAssetTiming({
      outcome: "unauthenticated",
      status: "error",
      statusCode: 401,
    })
    return new NextResponse(null, { status: 401 })
  }

  const { data: assetRow, error: assetError } = await supabase
    .from("session_assets")
    .select("session_id,bucket,storage_path")
    .eq("id", assetId)
    .maybeSingle()

  if (assetError || !assetRow) {
    logAssetTiming({
      outcome: assetError ? "asset_query_error" : "asset_not_found",
      status: "error",
      statusCode: 404,
      error: assetError?.message,
    })
    return new NextResponse(null, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(assetRow.bucket)
    .createSignedUrl(assetRow.storage_path, ASSET_CONTENT_SIGNED_URL_SECONDS)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    logAssetTiming({
      outcome: "signed_url_failed",
      sessionId: assetRow.session_id,
      status: "error",
      statusCode: 502,
      error: signedUrlError?.message,
    })
    return new NextResponse(null, { status: 502 })
  }

  logAssetTiming({
    outcome: "redirected",
    sessionId: assetRow.session_id,
    status: "success",
    statusCode: 307,
  })

  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
