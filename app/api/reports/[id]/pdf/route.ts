import { NextResponse } from "next/server"

import { generateReportPdf } from "@/features/reports/pdf"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

function buildContentDisposition(fileName: string): string {
  const encoded = encodeURIComponent(fileName)
  return `attachment; filename="${fileName}"; filename*=UTF-8''${encoded}`
}

export async function GET(_request: Request, context: RouteContext) {
  const resolvedParams = await context.params
  const reportId = resolvedParams.id?.trim()

  if (!reportId) {
    return NextResponse.json({ error: "invalid_report_id" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  try {
    const pdf = await generateReportPdf(reportId)
    const body = Buffer.from(pdf.pdfBytes)

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": buildContentDisposition(pdf.fileName),
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown report error"

    if (message.includes("not found") || message.includes("not accessible")) {
      return NextResponse.json({ error: "report_not_found" }, { status: 404 })
    }

    return NextResponse.json({ error: "report_pdf_failed", detail: message }, { status: 500 })
  }
}
