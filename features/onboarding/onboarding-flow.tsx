"use client"

import * as React from "react"
import { ArrowLeftIcon, CornerDownLeftIcon, LoaderCircleIcon } from "lucide-react"
import { useFormStatus } from "react-dom"

import { completeOnboardingAction } from "@/features/onboarding/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type CoachAnswer = "yes" | "no"
type TeamClass = "49er" | "Laser" | "Nacra"

type OnboardingFlowProps = {
  initialFirstName: string
  initialLastName: string
  errorMessage?: string | null
}

const INITIAL_ONBOARDING_SUBMIT_STATE = {
  error: null,
}

const TEAM_CLASS_OPTIONS: TeamClass[] = ["49er", "Laser", "Nacra"]

const WELCOME_STEP = 0
const FIRST_NAME_STEP = 1
const LAST_NAME_STEP = 2
const GREETING_STEP = 3
const ORGANIZATION_STEP = 4
const TEAM_STEP = 5
const COACH_STEP = 6
const TEAM_CLASS_STEP = 7
const FINAL_STEP = 8

function FinalSubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      disabled={pending}
      className="h-11 w-full rounded-full bg-white text-black hover:bg-white/90"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Creating...
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          Confirm
          <CornerDownLeftIcon className="size-4" />
        </span>
      )}
    </Button>
  )
}

function trimValue(value: string): string {
  return value.trim()
}

export function OnboardingFlow({
  initialFirstName,
  initialLastName,
  errorMessage,
}: OnboardingFlowProps) {
  const [step, setStep] = React.useState(WELCOME_STEP)
  const [firstName, setFirstName] = React.useState(initialFirstName)
  const [lastName, setLastName] = React.useState(initialLastName)
  const [organizationName, setOrganizationName] = React.useState("")
  const [teamName, setTeamName] = React.useState("")
  const [coachAnswer, setCoachAnswer] = React.useState<CoachAnswer>("yes")
  const [teamClass, setTeamClass] = React.useState<TeamClass>("49er")
  const [submitState, submitAction, isSubmitting] = React.useActionState(
    completeOnboardingAction,
    INITIAL_ONBOARDING_SUBMIT_STATE,
  )
  const finalFormRef = React.useRef<HTMLFormElement | null>(null)

  const canContinue = React.useMemo(() => {
    if (step === FIRST_NAME_STEP) {
      return trimValue(firstName).length > 0
    }

    if (step === LAST_NAME_STEP) {
      return trimValue(lastName).length > 0
    }

    if (step === ORGANIZATION_STEP) {
      return trimValue(organizationName).length > 0
    }

    if (step === TEAM_STEP) {
      return trimValue(teamName).length > 0
    }

    if (step === COACH_STEP) {
      return coachAnswer === "yes" || coachAnswer === "no"
    }

    if (step === TEAM_CLASS_STEP) {
      return TEAM_CLASS_OPTIONS.includes(teamClass)
    }

    return true
  }, [coachAnswer, firstName, lastName, organizationName, step, teamClass, teamName])

  const canGoBack = step > WELCOME_STEP
  const isFinalStep = step === FINAL_STEP
  const resolvedErrorMessage = submitState.error ?? errorMessage ?? null

  const handleNext = React.useCallback(() => {
    if (!canContinue || isFinalStep) {
      return
    }

    setStep((currentStep) => Math.min(currentStep + 1, FINAL_STEP))
  }, [canContinue, isFinalStep])

  function handleBack(): void {
    if (!canGoBack) {
      return
    }

    setStep((currentStep) => Math.max(currentStep - 1, WELCOME_STEP))
  }

  function handleStepSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault()
    handleNext()
  }

  function handleCoachAnswerSelect(answer: CoachAnswer): void {
    setCoachAnswer(answer)
    setStep(TEAM_CLASS_STEP)
  }

  React.useEffect(() => {
    if (isFinalStep) {
      return
    }

    function handleWindowKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Enter" || event.defaultPrevented || event.isComposing) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return
      }

      const target = event.target
      if (target instanceof HTMLElement && target.tagName === "TEXTAREA") {
        return
      }

      if (step === COACH_STEP) {
        return
      }

      event.preventDefault()
      handleNext()
    }

    window.addEventListener("keydown", handleWindowKeyDown)

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown)
    }
  }, [handleNext, isFinalStep, step])

  React.useEffect(() => {
    if (!isFinalStep) {
      return
    }

    function handleFinalEnterKeyDown(event: KeyboardEvent): void {
      if (event.key !== "Enter" || event.defaultPrevented || event.isComposing) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || isSubmitting) {
        return
      }

      const target = event.target
      if (target instanceof HTMLElement && target.tagName === "TEXTAREA") {
        return
      }

      event.preventDefault()
      finalFormRef.current?.requestSubmit()
    }

    window.addEventListener("keydown", handleFinalEnterKeyDown)

    return () => {
      window.removeEventListener("keydown", handleFinalEnterKeyDown)
    }
  }, [isFinalStep, isSubmitting])

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4 py-8 text-white">
      <section className="w-full max-w-xl rounded-3xl p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.03)] backdrop-blur sm:p-8">
        {resolvedErrorMessage ? (
          <p className="rounded-xl border border-red-300/60 bg-red-500/10 px-4 py-3 text-sm text-red-100">
            {resolvedErrorMessage}
          </p>
        ) : null}

        {!isFinalStep ? (
          <form className="mt-6" onSubmit={handleStepSubmit}>
            <div className="space-y-6">
              {canGoBack ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="h-11 w-11 rounded-full border-white/30 bg-transparent p-0 text-white hover:bg-white/10"
                >
                  <ArrowLeftIcon className="size-4" />
                  <span className="sr-only">Back</span>
                </Button>
              ) : null}

              {step === WELCOME_STEP ? (
                <div className="space-y-3">
                  <h1 className="text-6xl font-semibold tracking-tight">Welcome to Dock Out!</h1>
                  <p className="text-base text-white/80">
                    Let&apos;s set up your team in a few quick steps.
                  </p>
                </div>
              ) : null}

              {step === FIRST_NAME_STEP ? (
                <div className="space-y-4">
                  <h2 className="text-4xl font-semibold tracking-tight">What&apos;s your name</h2>

                  <div className="space-y-2">
                    <Input
                      id="onboarding-first-name"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      placeholder="Juan"
                      className="h-11 border-white/25 bg-black/30 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
              ) : null}

              {step === LAST_NAME_STEP ? (
                <div className="space-y-4">
                  <h2 className="text-4xl font-semibold tracking-tight">What&apos;s your last name</h2>

                  <div className="space-y-2">
                    <Input
                      id="onboarding-last-name"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      placeholder="Badino"
                      className="h-11 border-white/25 bg-black/30 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
              ) : null}

              {step === GREETING_STEP ? (
                <div className="space-y-3">
                  <h2 className="text-6xl font-semibold tracking-tight">
                    Hi, {trimValue(firstName) || "Sailog User"}.
                  </h2>
                  <p className="text-base text-white/80">
                    We&apos;ll set up your first organization and team.
                  </p>
                </div>
              ) : null}

              {step === ORGANIZATION_STEP ? (
                <div className="space-y-4">
                  <h2 className="text-4xl font-semibold tracking-tight">Name your organization.</h2>
                  <div className="space-y-2">
                    <Input
                      id="onboarding-organization-name"
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      placeholder="USA Sailing Program"
                      className="h-11 border-white/25 bg-black/30 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
              ) : null}

              {step === TEAM_STEP ? (
                <div className="space-y-4">
                  <h2 className="text-2xl font-semibold tracking-tight">Name your first Team:</h2>
    
                  <div className="space-y-2">

                    <Input
                      id="onboarding-team-name"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="ARG90"
                      className="h-11 border-white/25 bg-black/30 text-white placeholder:text-white/40"
                    />
                  </div>
                </div>
              ) : null}

              {step === COACH_STEP ? (
                <div className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight">
                    Are you also the team coach?
                  </h2>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => handleCoachAnswerSelect("yes")}
                      className={`h-11 rounded-full border px-6 text-sm font-medium transition ${
                        coachAnswer === "yes"
                          ? "border-white bg-white text-black"
                          : "border-white/30 bg-transparent text-white hover:border-white/60"
                      }`}
                    >
                      Yes
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCoachAnswerSelect("no")}
                      className={`h-11 rounded-full border px-6 text-sm font-medium transition ${
                        coachAnswer === "no"
                          ? "border-white bg-white text-black"
                          : "border-white/30 bg-transparent text-white hover:border-white/60"
                      }`}
                    >
                      No
                    </button>
                  </div>
                </div>
              ) : null}

              {step === TEAM_CLASS_STEP ? (
                <div className="space-y-4">
                  <h2 className="text-3xl font-semibold tracking-tight">Whats your team class</h2>

                  <div className="space-y-2">
                    <select
                      id="onboarding-team-class"
                      value={teamClass}
                      onChange={(event) => setTeamClass(event.target.value as TeamClass)}
                      className="h-11 w-full rounded-lg border border-white/25 bg-black/30 px-3 text-sm text-white outline-none ring-ring/50 focus-visible:ring-[3px]"
                    >
                      {TEAM_CLASS_OPTIONS.map((teamClassOption) => (
                        <option key={teamClassOption} value={teamClassOption} className="text-black">
                          {teamClassOption}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}
            </div>

            {step !== COACH_STEP ? (
              <div className="mt-8">
                <Button
                  type="submit"
                  disabled={!canContinue}
                  className="h-11 rounded-full bg-white px-6 text-black hover:bg-white/90"
                >
                  <span className="inline-flex items-center gap-2">
                    Continue
                    <CornerDownLeftIcon className="size-4" />
                  </span>
                </Button>
              </div>
            ) : null}
          </form>
        ) : (
          <div className="mt-6 space-y-6">
            <form ref={finalFormRef} action={submitAction} className="space-y-5">
              <input type="hidden" name="firstName" value={trimValue(firstName)} />
              <input type="hidden" name="lastName" value={trimValue(lastName)} />
              <input
                type="hidden"
                name="organizationName"
                value={trimValue(organizationName)}
              />
              <input type="hidden" name="teamName" value={trimValue(teamName)} />
              <input type="hidden" name="isCoach" value={coachAnswer} />
              <input type="hidden" name="teamClass" value={teamClass} />

              <div className="space-y-3">
                <h2 className="text-3xl font-semibold tracking-tight">
                  You are all set{" "}
                  <span className="text-white/55">{trimValue(firstName)}</span>{" "}
                  <span className="text-white/55">{trimValue(lastName)}</span>!
                </h2>

                <p className="text-base leading-7 text-white/80">
                  Your organization{" "}
                  <span className="text-white/55">{trimValue(organizationName)}</span> and your{" "}
                  <span className="text-white/55">{teamClass}</span> team{" "}
                  <span className="text-white/55">{trimValue(teamName)}</span> will be created.
                </p>
              </div>

              <FinalSubmitButton />
            </form>
          </div>
        )}
      </section>
    </main>
  )
}
