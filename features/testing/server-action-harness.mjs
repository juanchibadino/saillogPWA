const SERVER_ACTION_REDIRECT = Symbol("server_action_redirect")

function cloneRow(row) {
  if (!row) {
    return row
  }

  return { ...row }
}

function rowMatchesFilters(row, filters) {
  return filters.every((filter) => row[filter.column] === filter.value)
}

function createRedirectError(path) {
  const error = new Error(`NEXT_REDIRECT: ${path}`)
  error.digest = `NEXT_REDIRECT;replace;${path};307;`
  error.path = path
  error[SERVER_ACTION_REDIRECT] = true
  return error
}

function getRedirectPathFromError(error) {
  if (error?.[SERVER_ACTION_REDIRECT] === true) {
    return error.path
  }

  if (typeof error?.digest !== "string" || !error.digest.startsWith("NEXT_REDIRECT;")) {
    return null
  }

  const [, , path] = error.digest.split(";")
  return path ?? null
}

function normalizeTableRows(tables) {
  const rowsByTable = {}

  for (const [tableName, rows] of Object.entries(tables)) {
    rowsByTable[tableName] = rows.map(cloneRow)
  }

  return rowsByTable
}

class MockSupabaseQuery {
  constructor(input) {
    this.filters = []
    this.limitValue = null
    this.operation = input.operation ?? "select"
    this.rowsByTable = input.rowsByTable
    this.selectErrors = input.selectErrors
    this.tableName = input.tableName
    this.updateErrors = input.updateErrors
    this.updateValues = input.updateValues ?? null
  }

  select() {
    return this
  }

  update(values) {
    return new MockSupabaseQuery({
      operation: "update",
      rowsByTable: this.rowsByTable,
      selectErrors: this.selectErrors,
      tableName: this.tableName,
      updateErrors: this.updateErrors,
      updateValues: values,
    })
  }

  eq(column, value) {
    this.filters.push({ column, value })
    return this
  }

  order() {
    return this
  }

  limit(value) {
    this.limitValue = value
    return this
  }

  maybeSingle() {
    const error = this.selectErrors[this.tableName]

    if (error) {
      return Promise.resolve({ data: null, error })
    }

    const rows = this.getMatchingRows()
    return Promise.resolve({ data: cloneRow(rows[0] ?? null), error: null })
  }

  then(resolve, reject) {
    try {
      Promise.resolve(this.execute()).then(resolve, reject)
    } catch (error) {
      reject(error)
    }
  }

  getMatchingRows() {
    const rows = this.rowsByTable[this.tableName] ?? []
    const matchingRows = rows.filter((row) => rowMatchesFilters(row, this.filters))

    if (typeof this.limitValue === "number") {
      return matchingRows.slice(0, this.limitValue)
    }

    return matchingRows
  }

  execute() {
    if (this.operation !== "update") {
      return { data: this.getMatchingRows().map(cloneRow), error: null }
    }

    const error = this.updateErrors[this.tableName]

    if (error) {
      return { data: null, error }
    }

    for (const row of this.getMatchingRows()) {
      Object.assign(row, this.updateValues)
    }

    return { data: null, error: null }
  }
}

export function createMockSupabaseClient(input) {
  const rowsByTable = normalizeTableRows(input.tables ?? {})
  const selectErrors = input.selectErrors ?? {}
  const updateErrors = input.updateErrors ?? {}

  return {
    rowsByTable,
    from(tableName) {
      return new MockSupabaseQuery({
        rowsByTable,
        selectErrors,
        tableName,
        updateErrors,
      })
    },
  }
}

export function createServerActionHarness(input) {
  const revalidatedPaths = []

  const dependencies = {
    createServerSupabaseClient: async () => {
      if (input.createServerSupabaseClient) {
        return input.createServerSupabaseClient()
      }

      if (!input.supabase) {
        throw new Error("createServerActionHarness requires supabase or createServerSupabaseClient")
      }

      return input.supabase
    },
    redirect: (path) => {
      if (input.redirect) {
        input.redirect(path)
      }

      throw createRedirectError(path)
    },
    requireAuthenticatedAccessContext: async () => {
      if (input.requireAuthenticatedAccessContext) {
        return input.requireAuthenticatedAccessContext()
      }

      return input.accessContext
    },
    revalidatePath: (path) => {
      revalidatedPaths.push(path)

      if (input.revalidatePath) {
        input.revalidatePath(path)
      }
    },
  }

  return {
    dependencies,
    revalidatedPaths,
    async run(action) {
      try {
        await action(dependencies)

        return {
          type: "completed",
          revalidatedPaths,
        }
      } catch (error) {
        const redirectPath = getRedirectPathFromError(error)

        if (redirectPath !== null) {
          return {
            type: "redirect",
            path: redirectPath,
            revalidatedPaths,
          }
        }

        throw error
      }
    },
  }
}

export function formDataFromObject(values) {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    if (value === null || typeof value === "undefined") {
      continue
    }

    formData.set(key, String(value))
  }

  return formData
}
