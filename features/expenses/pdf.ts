import "server-only"

import type {
  TeamExpenseListItem,
  TeamExpensesReportData,
} from "@/features/expenses/data"
import { formatExpenseDate } from "@/features/expenses/shared"

type ExpensesPdfResult = {
  fileName: string
  pdfBytes: Uint8Array
}

type BrowserPageLike = {
  setContent: (
    html: string,
    options: { waitUntil: string; timeout: number },
  ) => Promise<void>
  waitForTimeout: (timeoutMs: number) => Promise<void>
  pdf: (options: {
    format: string
    printBackground: boolean
    preferCSSPageSize: boolean
  }) => Promise<Uint8Array | Buffer>
}

type BrowserLike = {
  close: () => Promise<void>
  newPage: () => Promise<BrowserPageLike>
}

type PlaywrightLike = {
  chromium: {
    launch: (options: {
      args: string[]
      executablePath?: string
      headless: boolean
    }) => Promise<BrowserLike>
  }
}

type ChromiumServerlessLike = {
  args: string[]
  executablePath: () => Promise<string>
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(value))
}

function formatCompactRateDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date)
}

function formatRoleLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function resolveImageSource(input: {
  baseUrl: string
  source: string | null
}): string | null {
  const source = input.source?.trim()

  if (!source) {
    return null
  }

  try {
    return new URL(source, input.baseUrl).toString()
  } catch {
    return null
  }
}

function buildOrganizationMarkHtml(input: {
  baseUrl: string
  data: TeamExpensesReportData
}): string {
  const logoSource = resolveImageSource({
    baseUrl: input.baseUrl,
    source: input.data.organizationLogoUrl,
  })

  if (logoSource) {
    return `<img class="organization-logo" src="${escapeHtml(logoSource)}" alt="${escapeHtml(input.data.organizationName)} logo" />`
  }

  return `<h1>${escapeHtml(input.data.organizationName)}</h1>`
}

function buildReceiptAnchorId(expenseId: string): string {
  return `receipt-${expenseId.replace(/[^a-zA-Z0-9_-]+/g, "")}`
}

function buildReceiptReference(input: {
  expense: TeamExpenseListItem
  receiptByExpenseId: Map<string, TeamExpensesReportData["receiptReferences"][number]>
}): string {
  const receipt = input.receiptByExpenseId.get(input.expense.id)

  if (!receipt) {
    return "No receipt"
  }

  const anchorId = buildReceiptAnchorId(input.expense.id)

  return `<a href="#${escapeHtml(anchorId)}">${escapeHtml(receipt.label)}</a>`
}

function buildFilterSummary(data: TeamExpensesReportData): string {
  const values = [
    `Year: ${data.selectedYear}`,
    `Crew: ${data.selectedCrewLabel}`,
    data.venueLabel ? `Venue: ${data.venueLabel}` : "Venue: All venues",
    data.campLabel ? `Camp: ${data.campLabel}` : "Camp: All camps",
    data.selectedTypeLabel ? `Type: ${data.selectedTypeLabel}` : "Type: All types",
  ]

  return values.map(escapeHtml).join(" | ")
}

function buildReceiptReferencesHtml(data: TeamExpensesReportData): string {
  if (data.receiptReferences.length === 0) {
    return ""
  }

  const expenseById = new Map(data.expenses.map((expense) => [expense.id, expense]))
  const referencesHtml = data.receiptReferences
    .map((receipt) => {
      const expense = expenseById.get(receipt.expenseId)
      const metaParts = expense
        ? [
            formatExpenseDate(expense.expenseDate),
            expense.vendor,
            expense.amountLabel,
          ].filter((value) => value.length > 0)
        : []
      const metaHtml =
        metaParts.length > 0
          ? `<div class="receipt-meta">${escapeHtml(metaParts.join(" | "))}</div>`
          : ""
      const imageHtml = receipt.dataUrl
        ? `<img class="receipt-image" src="${escapeHtml(receipt.dataUrl)}" alt="${escapeHtml(receipt.label)}" />`
        : `<div class="receipt-placeholder">Receipt image unavailable</div>`

      return `
        <figure id="${escapeHtml(buildReceiptAnchorId(receipt.expenseId))}" class="receipt-card">
          <figcaption>${escapeHtml(receipt.label)}</figcaption>
          ${metaHtml}
          ${imageHtml}
        </figure>
      `
    })
    .join("")

  return `
    <section class="receipt-references">
      <h2>Receipt references</h2>
      <div class="receipt-grid">${referencesHtml}</div>
    </section>
  `
}

export function buildExpensesReportPdfHtml(input: {
  baseUrl: string
  data: TeamExpensesReportData
}): string {
  const totalLabel =
    input.data.selectedVisibilityScope === "team" && input.data.metrics.teamTotalLabel
      ? input.data.metrics.teamTotalLabel
      : input.data.metrics.myTotalLabel
  const venueContextLabel = input.data.venueLabel ?? "All venues"
  const campContextLabel = input.data.campLabel
    ? `<div class="subtitle">Camp Date ${escapeHtml(input.data.campLabel)}</div>`
    : ""
  const receiptByExpenseId = new Map(
    input.data.receiptReferences.map((receipt) => [receipt.expenseId, receipt]),
  )
  const rowsHtml =
    input.data.expenses.length === 0
      ? `<tr><td colspan="9" class="empty">No expenses found for this report.</td></tr>`
      : input.data.expenses
          .map(
            (expense) => `
              <tr>
                <td>${escapeHtml(formatExpenseDate(expense.expenseDate))}</td>
                <td>${escapeHtml(expense.vendor)}</td>
                <td>${escapeHtml(expense.venueName)}${expense.campName ? `<br><span>${escapeHtml(expense.campName)}</span>` : ""}</td>
                <td>${escapeHtml(expense.description ?? "")}</td>
                <td>${escapeHtml(expense.amountLabel)}</td>
                <td><span class="rate-value">${escapeHtml(String(expense.exchangeRate))}</span><span class="rate-date">${escapeHtml(formatCompactRateDate(expense.exchangeRateDate))}</span></td>
                <td>${escapeHtml(expense.convertedAmountLabel)}</td>
                <td>${escapeHtml(expense.ownerName)}</td>
                <td>${buildReceiptReference({
                  expense,
                  receiptByExpenseId,
                })}</td>
              </tr>
            `,
          )
          .join("")

  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Dockout Expenses Report</title>
        <style>
          @page { size: A4; margin: 22mm 16mm; }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            color: #111827;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            font-size: 11px;
            line-height: 1.45;
          }
          header {
            border-bottom: 2px solid #111827;
            padding-bottom: 14px;
          }
          .organization-mark {
            min-height: 42px;
          }
          .organization-logo {
            display: block;
            max-height: 54px;
            max-width: 210px;
            object-fit: contain;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            letter-spacing: 0;
          }
          .subtitle {
            margin-top: 4px;
            color: #4b5563;
            font-size: 12px;
          }
          .summary {
            display: grid;
            grid-template-columns: 1.3fr 0.9fr;
            gap: 10px;
            margin-top: 16px;
          }
          .box {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 10px;
          }
          .label {
            color: #6b7280;
            font-size: 9px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .value {
            margin-top: 2px;
            font-size: 14px;
            font-weight: 700;
          }
          .filters {
            margin: 14px 0 10px;
            color: #4b5563;
            font-size: 10px;
          }
          table {
            border-collapse: collapse;
            width: 100%;
          }
          th {
            border-bottom: 1px solid #9ca3af;
            color: #374151;
            font-size: 9px;
            padding: 7px 5px;
            text-align: left;
            text-transform: uppercase;
          }
          td {
            border-bottom: 1px solid #e5e7eb;
            padding: 7px 5px;
            vertical-align: top;
          }
          td span {
            color: #6b7280;
            font-size: 9px;
          }
          .rate-value,
          .rate-date {
            display: block;
          }
          .rate-value {
            color: #111827;
            font-size: 11px;
          }
          .rate-date {
            color: #6b7280;
            font-size: 7.5px;
            line-height: 1.2;
            margin-top: 2px;
            white-space: nowrap;
          }
          a {
            color: #0f766e;
            text-decoration: none;
          }
          .empty {
            color: #6b7280;
            padding: 18px 5px;
            text-align: center;
          }
          .receipt-references {
            margin-top: 18px;
            page-break-before: auto;
          }
          .receipt-references h2 {
            border-bottom: 1px solid #d1d5db;
            font-size: 13px;
            margin: 0 0 10px;
            padding-bottom: 6px;
          }
          .receipt-grid {
            display: grid;
            gap: 12px;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .receipt-card {
            break-inside: avoid;
            margin: 0;
            page-break-inside: avoid;
          }
          .receipt-card figcaption {
            font-size: 11px;
            font-weight: 700;
          }
          .receipt-meta {
            color: #6b7280;
            font-size: 8px;
            margin: 2px 0 6px;
          }
          .receipt-image {
            border: 1px solid #d1d5db;
            border-radius: 6px;
            display: block;
            max-height: 260px;
            max-width: 100%;
            object-fit: contain;
            width: 100%;
          }
          .receipt-placeholder {
            align-items: center;
            border: 1px dashed #d1d5db;
            border-radius: 6px;
            color: #6b7280;
            display: flex;
            font-size: 9px;
            height: 120px;
            justify-content: center;
          }
          footer {
            margin-top: 18px;
            color: #6b7280;
            font-size: 9px;
          }
        </style>
      </head>
      <body>
        <header>
          <div class="organization-mark">${buildOrganizationMarkHtml(input)}</div>
          <div class="subtitle">${escapeHtml(input.data.teamName)} / ${escapeHtml(formatRoleLabel(input.data.exportedByRole))}</div>
          <div class="subtitle">${escapeHtml(venueContextLabel)}</div>
          ${campContextLabel}
          <div class="subtitle">Generated ${escapeHtml(formatGeneratedAt(input.data.generatedAt))}</div>
        </header>

        <section class="summary">
          <div class="box">
            <div class="label">Exported by</div>
            <div class="value">${escapeHtml(input.data.exportedByName)}</div>
            <div class="subtitle">${escapeHtml(formatRoleLabel(input.data.exportedByRole))}</div>
          </div>
          <div class="box">
            <div class="label">Total</div>
            <div class="value">${escapeHtml(totalLabel)}</div>
          </div>
        </section>

        <div class="filters">${buildFilterSummary(input.data)}</div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Venue / Camp</th>
              <th>Description</th>
              <th>Local</th>
              <th>Rate</th>
              <th>Converted</th>
              <th>Member</th>
              <th>Invoice</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        ${buildReceiptReferencesHtml(input.data)}

        <footer>
          Currency conversion uses the stored exchange-rate snapshot on each expense.
        </footer>
      </body>
    </html>`
}

async function dynamicImport<T = unknown>(moduleName: string): Promise<T> {
  const importer = new Function("name", "return import(name)") as (
    name: string,
  ) => Promise<unknown>

  return importer(moduleName) as Promise<T>
}

function toUint8Array(value: Uint8Array | Buffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value)
}

function formatPdfRendererError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)

  return message.replace(/\s+/g, " ").slice(0, 700)
}

async function renderPdfWithPlaywrightPackage(html: string): Promise<Uint8Array> {
  const playwright = await dynamicImport<PlaywrightLike>("playwright")
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 })
    await page.waitForTimeout(250)

    return toUint8Array(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      }),
    )
  } finally {
    await browser.close()
  }
}

async function renderPdfWithPlaywrightCore(html: string): Promise<Uint8Array> {
  const chromiumModule = await dynamicImport<{
    default?: ChromiumServerlessLike
  } & Partial<ChromiumServerlessLike>>("@sparticuz/chromium")
  const playwrightCore = await dynamicImport<PlaywrightLike>("playwright-core")
  const chromium: ChromiumServerlessLike =
    chromiumModule.default ??
    ({
      args: chromiumModule.args ?? [],
      executablePath:
        chromiumModule.executablePath ??
        (async () => {
          throw new Error("Missing Chromium executablePath")
        }),
    } satisfies ChromiumServerlessLike)
  const executablePath = await chromium.executablePath()
  const browser = await playwrightCore.chromium.launch({
    executablePath,
    headless: true,
    args: chromium.args,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: "load", timeout: 45_000 })
    await page.waitForTimeout(250)

    return toUint8Array(
      await page.pdf({
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
      }),
    )
  } finally {
    await browser.close()
  }
}

async function renderHtmlToPdfBytes(html: string): Promise<Uint8Array> {
  let playwrightPackageError: unknown = null

  try {
    return await renderPdfWithPlaywrightPackage(html)
  } catch (error) {
    playwrightPackageError = error
    // Fallback to the serverless Chromium stack.
  }

  try {
    return await renderPdfWithPlaywrightCore(html)
  } catch (serverlessChromiumError) {
    console.error("Expenses PDF renderer failed", {
      playwrightPackageError,
      serverlessChromiumError,
    })

    throw new Error(
      [
        "Could not initialize Chromium PDF renderer.",
        `Playwright package: ${formatPdfRendererError(playwrightPackageError)}.`,
        `Serverless Chromium: ${formatPdfRendererError(serverlessChromiumError)}.`,
      ].join(" "),
    )
  }
}

export async function generateTeamExpensesPdf(input: {
  baseUrl: string
  data: TeamExpensesReportData
}): Promise<ExpensesPdfResult> {
  const html = buildExpensesReportPdfHtml(input)
  const pdfBytes = await renderHtmlToPdfBytes(html)
  const scopeSlug = input.data.selectedVisibilityScope
  const teamSlug = sanitizeFileName(input.data.teamName.toLowerCase())
  const fileBase =
    teamSlug.length > 0
      ? `dockout_expenses_${teamSlug}_${scopeSlug}_${input.data.selectedYear}`
      : `dockout_expenses_${scopeSlug}_${input.data.selectedYear}`

  return {
    fileName: `${fileBase}.pdf`,
    pdfBytes,
  }
}
