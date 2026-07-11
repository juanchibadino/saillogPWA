import { z } from "zod"

const dateInputSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date in YYYY-MM-DD format")
const optionalNotesSchema = z.string().trim().max(4000)
const booleanInputSchema = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0", "on", "off"])])
  .transform((value) => value === true || value === "true" || value === "1" || value === "on")

const calendarEventBaseSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    eventType: z.enum(["meeting", "travel", "logistics", "other"]),
    startDate: dateInputSchema,
    endDate: dateInputSchema,
    notes: optionalNotesSchema,
  })
  .superRefine((value, context) => {
    if (value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be on or after start date",
        path: ["endDate"],
      })
    }
  })

export const createCalendarEventInputSchema = calendarEventBaseSchema

export const updateCalendarEventInputSchema = calendarEventBaseSchema.extend({
  id: z.string().uuid(),
})

export const deleteCalendarEventInputSchema = z.object({
  id: z.string().uuid(),
})

export const calendarPresenceInputSchema = z.object({
  sourceType: z.enum(["camp", "event"]),
  sourceId: z.string().uuid(),
  profileId: z.string().uuid(),
  presenceDate: dateInputSchema,
  isPresent: booleanInputSchema,
})

export const calendarPresenceRangeInputSchema = z.object({
  sourceType: z.enum(["camp", "event"]),
  sourceId: z.string().uuid(),
  profileId: z.string().uuid(),
  isPresent: booleanInputSchema,
})

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventInputSchema>
export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventInputSchema>
export type DeleteCalendarEventInput = z.infer<typeof deleteCalendarEventInputSchema>
export type CalendarPresenceInput = z.infer<typeof calendarPresenceInputSchema>
export type CalendarPresenceRangeInput = z.infer<typeof calendarPresenceRangeInputSchema>
