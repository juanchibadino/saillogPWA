import assert from "node:assert/strict"
import test from "node:test"

import { buildTeamAssessmentDetailAnalytics } from "./detail-analytics.mjs"

function buildScaleOptions(labels = ["1", "2", "3", "4", "5"]) {
  return labels.map((label, index) => ({
    id: `scale-${label.toLowerCase()}`,
    label,
    position: index + 1,
  }))
}

function buildDirectRun(input) {
  return {
    id: input.id,
    name: input.name ?? input.id,
    venueName: input.venueName ?? null,
    scaleOptions: input.scaleOptions ?? buildScaleOptions(),
    categories: [
      {
        id: `${input.id}-category-racing`,
        name: "RACING",
        position: 1,
        questions: [
          {
            id: `${input.id}-question-race-routine`,
            prompt: "RACE ROUTINE",
            position: 1,
            isRequired: false,
          },
        ],
        modes: [],
      },
    ],
    myAnswers: input.myAnswers ?? [],
    allAnswers: input.allAnswers ?? [],
  }
}

function buildModeRun(input) {
  return {
    id: input.id,
    name: input.name ?? input.id,
    venueName: input.venueName ?? null,
    scaleOptions: buildScaleOptions(),
    categories: [
      {
        id: `${input.id}-category-racing`,
        name: "RACING",
        position: 1,
        questions: [],
        modes: [
          {
            id: `${input.id}-mode-single-trap`,
            name: "SINGLE TRAP",
            position: 1,
            questions: [
              {
                id: `${input.id}-question-start`,
                prompt: "START",
                position: 1,
                isRequired: true,
              },
            ],
          },
        ],
      },
    ],
    myAnswers: input.myAnswers ?? [],
    allAnswers: input.allAnswers ?? [],
  }
}

function buildMixedRun(input) {
  return {
    id: input.id,
    name: input.name ?? input.id,
    venueName: input.venueName ?? null,
    scaleOptions: buildScaleOptions(),
    categories: [
      {
        id: `${input.id}-category-racing`,
        name: "RACING",
        position: 1,
        questions: [],
        modes: [
          {
            id: `${input.id}-mode-upwind`,
            name: "UPWIND",
            position: 1,
            questions: [
              {
                id: `${input.id}-question-trim`,
                prompt: "TRIM",
                position: 1,
                isRequired: true,
              },
              {
                id: `${input.id}-question-pace`,
                prompt: "PACE",
                position: 2,
                isRequired: false,
              },
            ],
          },
          {
            id: `${input.id}-mode-downwind`,
            name: "DOWNWIND",
            position: 2,
            questions: [
              {
                id: `${input.id}-question-exit`,
                prompt: "EXIT",
                position: 1,
                isRequired: false,
              },
            ],
          },
        ],
      },
      {
        id: `${input.id}-category-starting`,
        name: "STARTING",
        position: 2,
        questions: [],
        modes: [
          {
            id: `${input.id}-mode-line`,
            name: "LINE",
            position: 1,
            questions: [
              {
                id: `${input.id}-question-time-distance`,
                prompt: "TIME DISTANCE",
                position: 1,
                isRequired: false,
              },
            ],
          },
        ],
      },
      {
        id: `${input.id}-category-boat-handling`,
        name: "BOAT HANDLING",
        position: 3,
        questions: [
          {
            id: `${input.id}-question-tacks`,
            prompt: "TACKS",
            position: 1,
            isRequired: false,
          },
        ],
        modes: [],
      },
    ],
    myAnswers: input.myAnswers ?? [],
    allAnswers: input.allAnswers ?? [],
  }
}

test("builds direct-category item trends with average and per-crew lines", () => {
  const previousRun = buildDirectRun({
    id: "run-1",
    venueName: "San Isidro Pre",
    allAnswers: [
      {
        questionId: "run-1-question-race-routine",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-5",
      },
      {
        questionId: "run-1-question-race-routine",
        respondentProfileId: "profile-b",
        scaleOptionId: "scale-3",
      },
    ],
  })
  const currentRun = buildDirectRun({
    id: "run-2",
    venueName: "Buenos Aires",
    myAnswers: [
      {
        questionId: "run-2-question-race-routine",
        scaleOptionId: "scale-4",
      },
    ],
    allAnswers: [
      {
        questionId: "run-2-question-race-routine",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-4",
      },
      {
        questionId: "run-2-question-race-routine",
        respondentProfileId: "profile-b",
        scaleOptionId: "scale-2",
      },
    ],
  })

  const analytics = buildTeamAssessmentDetailAnalytics({
    run: currentRun,
    comparisonRuns: [previousRun, currentRun],
    respondentProfiles: [
      { profileId: "profile-a", label: "Alice Crew" },
      { profileId: "profile-b", label: "Bruno Crew" },
    ],
  })

  assert.equal(analytics.items.length, 1)
  assert.deepEqual(
    analytics.items[0].trendPoints.map((point) => point.average),
    [4, 3],
  )
  assert.deepEqual(
    analytics.items[0].trendPoints.map((point) => point.venueName),
    ["San Isidro Pre", "Buenos Aires"],
  )
  assert.deepEqual(
    analytics.items[0].respondentLines.map((line) => line.label),
    ["Alice Crew", "Bruno Crew"],
  )
  assert.equal(analytics.items[0].trendPoints[1].respondentScores["profile-a"], 4)
  assert.equal(analytics.items[0].myAnswer?.scaleLabel, "4")
  assert.deepEqual(
    analytics.items[0].crewAnswers.map((answer) => answer.scaleLabel),
    ["4", "2"],
  )
})

test("matches mode-category questions across historical run snapshots", () => {
  const previousRun = buildModeRun({
    id: "run-1",
    allAnswers: [
      {
        questionId: "run-1-question-start",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-5",
      },
    ],
  })
  const currentRun = buildModeRun({
    id: "run-2",
    allAnswers: [
      {
        questionId: "run-2-question-start",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-4",
      },
    ],
  })

  const analytics = buildTeamAssessmentDetailAnalytics({
    run: currentRun,
    comparisonRuns: [previousRun, currentRun],
    respondentProfiles: [{ profileId: "profile-a", label: "Alice Crew" }],
  })

  assert.equal(analytics.items[0].categoryName, "RACING")
  assert.equal(analytics.items[0].modeName, "SINGLE TRAP")
  assert.deepEqual(
    analytics.items[0].trendPoints.map((point) => point.average),
    [5, 4],
  )
})

test("keeps missing historical answers as chart gaps", () => {
  const previousRun = buildDirectRun({ id: "run-1" })
  const currentRun = buildDirectRun({
    id: "run-2",
    allAnswers: [
      {
        questionId: "run-2-question-race-routine",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-5",
      },
    ],
  })

  const analytics = buildTeamAssessmentDetailAnalytics({
    run: currentRun,
    comparisonRuns: [previousRun, currentRun],
    respondentProfiles: [{ profileId: "profile-a", label: "Alice Crew" }],
  })

  assert.equal(analytics.items[0].trendPoints[0].average, null)
  assert.equal(analytics.items[0].trendPoints[0].respondentScores["profile-a"], null)
  assert.equal(analytics.items[0].trendPoints[1].average, 5)
})

test("falls back to scale option position when labels are not numeric", () => {
  const scaleOptions = buildScaleOptions(["Low", "High"])
  const currentRun = buildDirectRun({
    id: "run-1",
    scaleOptions,
    allAnswers: [
      {
        questionId: "run-1-question-race-routine",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-high",
      },
    ],
  })

  const analytics = buildTeamAssessmentDetailAnalytics({
    run: currentRun,
    comparisonRuns: [currentRun],
    respondentProfiles: [{ profileId: "profile-a", label: "Alice Crew" }],
  })

  assert.equal(analytics.items[0].average, 2)
  assert.equal(analytics.items[0].crewAnswers[0].scaleLabel, "High")
})

test("keeps only items answered in the current run", () => {
  const previousRun = buildMixedRun({
    id: "run-1",
    allAnswers: [
      {
        questionId: "run-1-question-pace",
        respondentProfileId: "profile-b",
        scaleOptionId: "scale-5",
      },
      {
        questionId: "run-1-question-time-distance",
        respondentProfileId: "profile-c",
        scaleOptionId: "scale-3",
      },
      {
        questionId: "run-1-question-tacks",
        respondentProfileId: "profile-c",
        scaleOptionId: "scale-2",
      },
    ],
  })
  const currentRun = buildMixedRun({
    id: "run-2",
    allAnswers: [
      {
        questionId: "run-2-question-trim",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-4",
      },
    ],
  })

  const analytics = buildTeamAssessmentDetailAnalytics({
    run: currentRun,
    comparisonRuns: [previousRun, currentRun],
    respondentProfiles: [
      { profileId: "profile-a", label: "Alice Crew" },
      { profileId: "profile-b", label: "Bruno Crew" },
      { profileId: "profile-c", label: "Carla Crew" },
    ],
  })

  assert.deepEqual(
    analytics.items.map((item) => item.prompt),
    ["TRIM"],
  )
  assert.deepEqual(
    analytics.items.map((item) => item.categoryName),
    ["RACING"],
  )
  assert.deepEqual(
    analytics.items.map((item) => item.modeName),
    ["UPWIND"],
  )
  assert.equal(
    analytics.items.some((item) => item.modeName === "DOWNWIND"),
    false,
  )
  assert.equal(
    analytics.items.some((item) => item.categoryName === "STARTING"),
    false,
  )
  assert.equal(
    analytics.items.some((item) => item.categoryName === "BOAT HANDLING"),
    false,
  )
})

test("does not surface historical-only answers when current run has no answers", () => {
  const previousRun = buildDirectRun({
    id: "run-1",
    allAnswers: [
      {
        questionId: "run-1-question-race-routine",
        respondentProfileId: "profile-a",
        scaleOptionId: "scale-5",
      },
    ],
  })
  const currentRun = buildDirectRun({ id: "run-2" })

  const analytics = buildTeamAssessmentDetailAnalytics({
    run: currentRun,
    comparisonRuns: [previousRun, currentRun],
    respondentProfiles: [{ profileId: "profile-a", label: "Alice Crew" }],
  })

  assert.equal(analytics.items.length, 0)
})
