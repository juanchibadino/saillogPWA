#!/usr/bin/env node

import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const REPO_ROOT = path.resolve(__dirname, "..")

const TRACE_REQUIREMENTS = [
  {
    route: "/api/team-expenses/report/pdf",
    tracePath: ".next/server/app/api/team-expenses/report/pdf/route.js.nft.json",
  },
  {
    route: "/api/reports/[id]/pdf",
    tracePath: ".next/server/app/api/reports/[id]/pdf/route.js.nft.json",
  },
]

const REQUIRED_TRACE_PATHS = [
  "node_modules/playwright/index.js",
  "node_modules/playwright-core/index.js",
  "node_modules/@sparticuz/chromium/build/esm/index.mjs",
  "node_modules/@sparticuz/chromium/bin/al2023.tar.br",
  "node_modules/@sparticuz/chromium/bin/chromium.br",
  "node_modules/@sparticuz/chromium/bin/fonts.tar.br",
  "node_modules/@sparticuz/chromium/bin/swiftshader.tar.br",
]

function hasTracePath(files, expectedPath) {
  return files.some((filePath) => filePath.endsWith(expectedPath))
}

async function readTrace(tracePath) {
  const absolutePath = path.join(REPO_ROOT, tracePath)

  try {
    return JSON.parse(await readFile(absolutePath, "utf8"))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    throw new Error(`Could not read ${tracePath}. Run npm run build first. ${message}`)
  }
}

const failures = []

for (const requirement of TRACE_REQUIREMENTS) {
  const trace = await readTrace(requirement.tracePath)
  const files = Array.isArray(trace.files) ? trace.files : []

  for (const expectedPath of REQUIRED_TRACE_PATHS) {
    if (!hasTracePath(files, expectedPath)) {
      failures.push(`${requirement.route} is missing ${expectedPath} in ${requirement.tracePath}`)
    }
  }
}

if (failures.length > 0) {
  throw new Error(`PDF renderer trace verification failed:\n${failures.join("\n")}`)
}

console.log("PDF renderer trace verification passed.")
