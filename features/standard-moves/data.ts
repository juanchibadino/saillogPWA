import "server-only"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database"

type TeamStandardMoveRow = Pick<
  Database["public"]["Tables"]["team_standard_moves"]["Row"],
  "id" | "team_id" | "name" | "description" | "is_active" | "created_at" | "updated_at"
>

type SessionStandardMoveRow = Pick<
  Database["public"]["Tables"]["session_standard_moves"]["Row"],
  "team_standard_move_id"
>

const TEAM_STANDARD_MOVE_SELECT_COLUMNS =
  "id,team_id,name,description,is_active,created_at,updated_at"
const SESSION_STANDARD_MOVE_SELECT_COLUMNS = "team_standard_move_id"

export type TeamStandardMoveListItem = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  usageCount: number
  updatedAt: string
}

export type TeamStandardMovesPageData = {
  moves: TeamStandardMoveListItem[]
  activeCount: number
  archivedCount: number
}

export async function getTeamStandardMovesPageData(input: {
  activeTeamId: string
}): Promise<TeamStandardMovesPageData> {
  const supabase = await createServerSupabaseClient()
  const { data: standardMoveRows, error: standardMovesError } = await supabase
    .from("team_standard_moves")
    .select(TEAM_STANDARD_MOVE_SELECT_COLUMNS)
    .eq("team_id", input.activeTeamId)
    .order("updated_at", { ascending: false })

  if (standardMovesError) {
    throw new Error(`Could not load team standard moves: ${standardMovesError.message}`)
  }

  const standardMoves = (standardMoveRows ?? []) as TeamStandardMoveRow[]
  const standardMoveIds = standardMoves.map((standardMove) => standardMove.id)
  let sessionStandardMoves: SessionStandardMoveRow[] = []

  if (standardMoveIds.length > 0) {
    const { data: sessionStandardMoveRows, error: sessionStandardMovesError } = await supabase
      .from("session_standard_moves")
      .select(SESSION_STANDARD_MOVE_SELECT_COLUMNS)
      .in("team_standard_move_id", standardMoveIds)

    if (sessionStandardMovesError) {
      throw new Error(
        `Could not load session standard move usage: ${sessionStandardMovesError.message}`,
      )
    }

    sessionStandardMoves = (sessionStandardMoveRows ?? []) as SessionStandardMoveRow[]
  }

  const usageCountByMoveId = new Map<string, number>()

  for (const sessionStandardMove of sessionStandardMoves) {
    const currentCount = usageCountByMoveId.get(sessionStandardMove.team_standard_move_id) ?? 0
    usageCountByMoveId.set(sessionStandardMove.team_standard_move_id, currentCount + 1)
  }

  const mappedMoves: TeamStandardMoveListItem[] = standardMoves.map((standardMove) => ({
    id: standardMove.id,
    name: standardMove.name,
    description: standardMove.description,
    isActive: standardMove.is_active,
    usageCount: usageCountByMoveId.get(standardMove.id) ?? 0,
    updatedAt: standardMove.updated_at,
  }))

  return {
    moves: mappedMoves,
    activeCount: mappedMoves.filter((standardMove) => standardMove.isActive).length,
    archivedCount: mappedMoves.filter((standardMove) => !standardMove.isActive).length,
  }
}
