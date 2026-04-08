import test from "node:test";
import assert from "node:assert/strict";
import { updateJobStageSchema } from "@/lib/jobs/stages";

test("updateJobStageSchema accepts nullable minutes and valid statuses", () => {
  const parsed = updateJobStageSchema.safeParse({
    status: "done",
    estimatedMinutes: null,
    actualMinutes: 45,
  });

  assert.equal(parsed.success, true);
});

test("updateJobStageSchema rejects invalid status and negative minutes", () => {
  const parsed = updateJobStageSchema.safeParse({
    status: "closed",
    estimatedMinutes: -1,
  });

  assert.equal(parsed.success, false);
});
