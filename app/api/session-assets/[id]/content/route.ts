import { NextResponse } from "next/server"

import { createServerSupabaseClient } from "@/lib/supabase/server"

type RouteContext = {
  params: Promise<{ id: string }>
}

const ASSET_CONTENT_SIGNED_URL_SECONDS = 5 * 60

export async function GET(_request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const assetId = resolvedParams.id?.trim()

  if (!assetId) {
    return new NextResponse(null, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return new NextResponse(null, { status: 401 })
  }

  const { data: assetRow, error: assetError } = await supabase
    .from("session_assets")
    .select("bucket,storage_path")
    .eq("id", assetId)
    .maybeSingle()

  if (assetError || !assetRow) {
    return new NextResponse(null, { status: 404 })
  }

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(assetRow.bucket)
    .createSignedUrl(assetRow.storage_path, ASSET_CONTENT_SIGNED_URL_SECONDS)

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return new NextResponse(null, { status: 502 })
  }

  return NextResponse.redirect(signedUrlData.signedUrl, {
    status: 307,
    headers: {
      "Cache-Control": "private, no-store",
    },
  })
}
