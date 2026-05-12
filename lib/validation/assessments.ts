import { z } from "zod";

export const assessmentScaleOptionInputSchema = z.object({
  label: z.string().trim().min(1).max(60),
});

export const assessmentQuestionInputSchema = z.object({
  prompt: z.string().trim().min(1).max(240),
  isRequired: z.coerce.boolean().default(false),
});

export const assessmentModeInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  questions: z.array(assessmentQuestionInputSchema).min(1),
});

const assessmentCategoryWithQuestionsInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  questions: z.array(assessmentQuestionInputSchema).min(1),
  modes: z.undefined().optional(),
});

const assessmentCategoryWithModesInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  questions: z.undefined().optional(),
  modes: z.array(assessmentModeInputSchema).min(1),
});

export const assessmentCategoryInputSchema = z.union([
  assessmentCategoryWithQuestionsInputSchema,
  assessmentCategoryWithModesInputSchema,
]);

export const assessmentDefinitionInputSchema = z.object({
  scaleOptions: z.array(assessmentScaleOptionInputSchema).min(1),
  categories: z.array(assessmentCategoryInputSchema).min(1),
});

export const upsertAssessmentTemplateInputSchema = z.object({
  templateId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  teamId: z.string().uuid(),
  definition: assessmentDefinitionInputSchema,
});

export const upsertAssessmentRunInputSchema = z.object({
  runId: z.undefined().optional(),
  teamId: z.string().uuid(),
  teamVenueId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  campIds: z.array(z.string().uuid()).min(1),
  definition: assessmentDefinitionInputSchema,
});

export const assessmentRunLifecycleInputSchema = z.object({
  runId: z.string().uuid(),
  teamId: z.string().uuid(),
  teamVenueId: z.string().uuid(),
});

export const assessmentAnswerPayloadEntrySchema = z.object({
  questionId: z.string().uuid(),
  scaleOptionId: z.string().uuid().nullable(),
});

export const submitAssessmentAnswersInputSchema = z.object({
  runId: z.string().uuid(),
  teamId: z.string().uuid(),
  teamVenueId: z.string().uuid(),
  answers: z.array(assessmentAnswerPayloadEntrySchema),
});

export type AssessmentDefinitionInput = z.infer<
  typeof assessmentDefinitionInputSchema
>;
export type UpsertAssessmentTemplateInput = z.infer<
  typeof upsertAssessmentTemplateInputSchema
>;
export type UpsertAssessmentRunInput = z.infer<typeof upsertAssessmentRunInputSchema>;
export type AssessmentRunLifecycleInput = z.infer<
  typeof assessmentRunLifecycleInputSchema
>;
export type SubmitAssessmentAnswersInput = z.infer<
  typeof submitAssessmentAnswersInputSchema
>;
