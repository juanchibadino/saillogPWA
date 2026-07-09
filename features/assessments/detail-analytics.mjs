function normalizeComparableText(value) {
  return String(value ?? "").trim().toLowerCase().replace(/\s+/g, " ")
}

function roundScore(value) {
  return Number(value.toFixed(2))
}

function averageNumbers(values) {
  const safeValues = values.filter((value) => typeof value === "number")

  if (safeValues.length === 0) {
    return null
  }

  return roundScore(safeValues.reduce((sum, value) => sum + value, 0) / safeValues.length)
}

function getScaleScore(input) {
  const option = input.scaleOptions.find(
    (scaleOption) => scaleOption.id === input.scaleOptionId,
  )

  if (!option) {
    return null
  }

  const numericLabel = Number.parseFloat(option.label)
  return Number.isFinite(numericLabel) ? numericLabel : option.position
}

function getScaleLabel(input) {
  const option = input.scaleOptions.find(
    (scaleOption) => scaleOption.id === input.scaleOptionId,
  )

  return option?.label ?? "-"
}

function getRunVenueName(run) {
  const venueName = typeof run.venueName === "string" ? run.venueName.trim() : ""

  if (venueName.length > 0) {
    return venueName
  }

  const runName = typeof run.name === "string" ? run.name.trim() : ""

  return runName.length > 0 ? runName : run.id
}

function buildQuestionKey(input) {
  return [
    "category",
    input.category.position,
    normalizeComparableText(input.category.name),
    "mode",
    input.mode ? input.mode.position : 0,
    normalizeComparableText(input.mode?.name ?? "direct"),
    "question",
    input.question.position,
    normalizeComparableText(input.question.prompt),
  ].join(":")
}

function getQuestionEntriesForRun(run) {
  const entries = []

  for (const category of run.categories) {
    for (const question of category.questions) {
      entries.push({
        key: buildQuestionKey({ category, mode: null, question }),
        categoryId: category.id,
        categoryName: category.name,
        categoryPosition: category.position,
        modeId: null,
        modeName: null,
        modePosition: null,
        questionId: question.id,
        prompt: question.prompt,
        position: question.position,
        isRequired: question.isRequired,
      })
    }

    for (const mode of category.modes ?? []) {
      for (const question of mode.questions) {
        entries.push({
          key: buildQuestionKey({ category, mode, question }),
          categoryId: category.id,
          categoryName: category.name,
          categoryPosition: category.position,
          modeId: mode.id,
          modeName: mode.name,
          modePosition: mode.position,
          questionId: question.id,
          prompt: question.prompt,
          position: question.position,
          isRequired: question.isRequired,
        })
      }
    }
  }

  return entries
}

function buildRespondentLabel(profileId, profileById) {
  const profile = profileById.get(profileId)

  if (!profile) {
    return `Crew ${profileId.slice(0, 8)}`
  }

  const explicitLabel = typeof profile.label === "string" ? profile.label.trim() : ""

  if (explicitLabel.length > 0) {
    return explicitLabel
  }

  const name = [profile.firstName, profile.lastName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .join(" ")

  if (name.length > 0) {
    return name
  }

  const email = typeof profile.email === "string" ? profile.email.trim() : ""

  return email.length > 0 ? email : `Crew ${profileId.slice(0, 8)}`
}

function getProfileId(profile) {
  return profile.profileId ?? profile.id
}

function buildRespondents(input) {
  const answeredProfileIds = [
    ...new Set(
      input.comparisonRuns.flatMap((run) =>
        run.allAnswers.map((answer) => answer.respondentProfileId),
      ),
    ),
  ]
  const profileById = new Map(
    input.respondentProfiles
      .map((profile) => [getProfileId(profile), profile])
      .filter(([profileId]) => typeof profileId === "string" && profileId.length > 0),
  )

  return answeredProfileIds
    .map((profileId) => ({
      profileId,
      label: buildRespondentLabel(profileId, profileById),
    }))
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((respondent, index) => ({
      ...respondent,
      dataKey: `respondent${index + 1}`,
    }))
}

function getScoresForQuestion(input) {
  return input.run.allAnswers
    .filter((answer) => answer.questionId === input.questionId)
    .map((answer) => ({
      profileId: answer.respondentProfileId,
      score: getScaleScore({
        scaleOptions: input.run.scaleOptions,
        scaleOptionId: answer.scaleOptionId,
      }),
      scaleLabel: getScaleLabel({
        scaleOptions: input.run.scaleOptions,
        scaleOptionId: answer.scaleOptionId,
      }),
    }))
    .filter((answer) => answer.score !== null)
}

function buildTrendPoint(input) {
  const matchedEntry = input.questionEntryByKey.get(input.item.key)

  if (!matchedEntry) {
    return {
      runId: input.run.id,
      runName: input.run.name,
      venueName: getRunVenueName(input.run),
      label: `#${input.index + 1}`,
      isCurrent: input.run.id === input.currentRunId,
      average: null,
      respondentScores: {},
    }
  }

  const scores = getScoresForQuestion({
    run: input.run,
    questionId: matchedEntry.questionId,
  })
  const respondentScores = {}

  for (const respondent of input.respondents) {
    const respondentAnswer = scores.find(
      (answer) => answer.profileId === respondent.profileId,
    )
    respondentScores[respondent.profileId] = respondentAnswer?.score ?? null
  }

  return {
    runId: input.run.id,
    runName: input.run.name,
    venueName: getRunVenueName(input.run),
    label: `#${input.index + 1}`,
    isCurrent: input.run.id === input.currentRunId,
    average: averageNumbers(scores.map((answer) => answer.score)),
    respondentScores,
  }
}

function buildCurrentAnswerSummary(input) {
  const scores = getScoresForQuestion({
    run: input.run,
    questionId: input.item.questionId,
  })
  const crewAnswers = scores
    .map((answer) => {
      const respondent = input.respondents.find(
        (candidate) => candidate.profileId === answer.profileId,
      )

      return {
        profileId: answer.profileId,
        label: respondent?.label ?? `Crew ${answer.profileId.slice(0, 8)}`,
        scaleLabel: answer.scaleLabel,
        score: answer.score,
      }
    })
    .sort((left, right) => left.label.localeCompare(right.label))

  const myAnswer = input.run.myAnswers.find(
    (answer) => answer.questionId === input.item.questionId,
  )

  return {
    average: averageNumbers(scores.map((answer) => answer.score)),
    answerCount: scores.length,
    myAnswer: myAnswer
      ? {
          scaleOptionId: myAnswer.scaleOptionId,
          scaleLabel: getScaleLabel({
            scaleOptions: input.run.scaleOptions,
            scaleOptionId: myAnswer.scaleOptionId,
          }),
          score: getScaleScore({
            scaleOptions: input.run.scaleOptions,
            scaleOptionId: myAnswer.scaleOptionId,
          }),
        }
      : null,
    crewAnswers,
  }
}

export function buildTeamAssessmentDetailAnalytics(input) {
  const respondents = buildRespondents(input)
  const runQuestionEntriesByRunId = new Map(
    input.comparisonRuns.map((run) => [
      run.id,
      new Map(getQuestionEntriesForRun(run).map((entry) => [entry.key, entry])),
    ]),
  )
  const items = getQuestionEntriesForRun(input.run).map((item) => {
    const trendPoints = input.comparisonRuns.map((run, index) =>
      buildTrendPoint({
        item,
        run,
        index,
        currentRunId: input.run.id,
        respondents,
        questionEntryByKey: runQuestionEntriesByRunId.get(run.id) ?? new Map(),
      }),
    )
    const respondentLines = respondents.filter((respondent) =>
      trendPoints.some(
        (point) => typeof point.respondentScores[respondent.profileId] === "number",
      ),
    )
    const summary = buildCurrentAnswerSummary({
      item,
      run: input.run,
      respondents,
    })

    return {
      questionId: item.questionId,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryPosition: item.categoryPosition,
      modeId: item.modeId,
      modeName: item.modeName,
      modePosition: item.modePosition,
      prompt: item.prompt,
      position: item.position,
      isRequired: item.isRequired,
      average: summary.average,
      answerCount: summary.answerCount,
      myAnswer: summary.myAnswer,
      crewAnswers: summary.crewAnswers,
      respondentLines,
      trendPoints,
    }
  })

  return {
    respondentSummaries: respondents,
    items,
  }
}
