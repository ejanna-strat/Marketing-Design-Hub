import { z } from "zod";
import type { Enums, Json, Tables } from "@/lib/supabase/database.types";

// Shared by the New Design Request form (browser) and the submit action
// (server), so both check exactly the same rules. The database checks them a
// third time inside submit_request().

export type FormQuestion = {
  id: string;
  requestTypeId: string;
  label: string;
  helpText: string | null;
  fieldType: Enums<"field_type">;
  options: string[];
  allowOther: boolean;
  required: boolean;
  isOutputNeeded: boolean;
};

export const QUESTION_COLUMNS =
  "id, request_type_id, label, help_text, field_type, options, allow_other, required, is_output_needed, sort_order";

export function toFormQuestion(
  row: Pick<
    Tables<"form_questions">,
    "id" | "request_type_id" | "label" | "help_text" | "field_type" | "options" | "allow_other" | "required" | "is_output_needed"
  >,
): FormQuestion {
  return {
    id: row.id,
    requestTypeId: row.request_type_id ?? "",
    label: row.label,
    helpText: row.help_text,
    fieldType: row.field_type,
    options: Array.isArray(row.options) ? row.options.filter((o): o is string => typeof o === "string") : [],
    allowOther: row.allow_other,
    required: row.required,
    isOutputNeeded: row.is_output_needed,
  };
}

// A typed "Other" answer is saved as "Other: <text>".
export const OTHER_PREFIX = "Other: ";
export const isOtherAnswer = (value: string) => value.startsWith("Other:");
// The typed text after "Other:", untrimmed so the input keeps spaces as typed.
export const otherText = (value: string) =>
  value.startsWith(OTHER_PREFIX) ? value.slice(OTHER_PREFIX.length) : value.slice("Other:".length);

export type AnswerValue = string | string[];

export const FINAL_APPROVER = {
  myself: "Myself (same as the requester)",
  other: "Other",
} as const;

const MAX_TEXT = 5000;

// keepDate: a Date Needed that is allowed even if it's now in the past (the
// request's current date, when the requester edits it).
export function buildRequestSchema(questions: FormQuestion[], today: string, keepDate?: string) {
  return z
    .object({
      requester_name: z.string().trim().min(1, "Please enter your name.").max(200),
      title: z.string().trim().min(1, "Please enter a request title.").max(200, "Please keep the title under 200 characters."),
      team_id: z.string().min(1, "Please choose your business unit."),
      request_type_id: z.string().min(1, "Please choose a type of design request."),
      date_needed: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Please choose the date needed.")
        .refine((d) => d >= today || d === keepDate, "The date needed cannot be in the past."),
      final_approver: z.enum(["myself", "other"], { error: "Please choose the final approver of the design." }),
      approver_name: z.string().trim().max(200),
      approver_email: z.string().trim().max(200),
      is_deal: z.enum(["yes", "no"], { error: "Please choose Yes or No." }),
      deal_name: z.string().trim().max(200),
      deal_size: z.string().trim().max(20),
      answers: answersRecord,
    })
    .superRefine((v, ctx) => {
      if (v.final_approver === "other") {
        if (!v.approver_name) {
          ctx.addIssue({ code: "custom", path: ["approver_name"], message: "Please enter the approver's name." });
        }
        if (!z.email().safeParse(v.approver_email).success) {
          ctx.addIssue({ code: "custom", path: ["approver_email"], message: "Please enter a valid email address." });
        }
      }

      if (v.is_deal === "yes") {
        if (!v.deal_name) {
          ctx.addIssue({ code: "custom", path: ["deal_name"], message: "Please enter the deal name." });
        }
        if (!/^\d{1,15}$/.test(v.deal_size)) {
          ctx.addIssue({ code: "custom", path: ["deal_size"], message: "Please enter the deal size in whole pesos." });
        }
      }
      checkAnswers(v.answers, questions, ctx);
    });
}

const answersRecord = z.record(z.string(), z.union([z.string(), z.array(z.string())]).optional());

// The specification answers on their own (staff editing a request's specs).
export function buildAnswersSchema(questions: FormQuestion[]) {
  return z.object({ answers: answersRecord }).superRefine((v, ctx) => checkAnswers(v.answers, questions, ctx));
}

export type AnswersFormValues = z.input<ReturnType<typeof buildAnswersSchema>>;

// The rules every answer must pass; errors go on ["answers", questionId].
function checkAnswers(answers: Record<string, AnswerValue | undefined>, questions: FormQuestion[], ctx: z.RefinementCtx) {
  for (const q of questions) {
    const path = ["answers", q.id];
    const items = answerItems(answers[q.id]);
    if (items.length === 0) {
      if (q.required) ctx.addIssue({ code: "custom", path, message: "This question is required." });
      continue;
    }
    for (const item of items) {
      if (item.length > MAX_TEXT) {
        ctx.addIssue({ code: "custom", path, message: `Please keep this under ${MAX_TEXT} characters.` });
      } else if (isOtherAnswer(item)) {
        if (!q.allowOther) ctx.addIssue({ code: "custom", path, message: "Please choose one of the options." });
        else if (!otherText(item).trim()) ctx.addIssue({ code: "custom", path, message: "Please type your answer for Other." });
      } else if ((q.fieldType === "single_select" || q.fieldType === "multi_select") && !q.options.includes(item)) {
        ctx.addIssue({ code: "custom", path, message: "Please choose one of the options." });
      }
    }
  }
}

export type RequestFormValues = z.input<ReturnType<typeof buildRequestSchema>>;

// Non-empty, trimmed answer items ("" and [] count as not answered).
function answerItems(value: AnswerValue | undefined): string[] {
  const list = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return list.map((s) => s.trim()).filter(Boolean);
}

function cleanItem(item: string) {
  return isOtherAnswer(item) ? `${OTHER_PREFIX}${otherText(item).trim()}` : item;
}

// The payload submit_request() expects. Only answers to the chosen type's
// questions are sent, so switching types midway doesn't leave stray answers.
export function toSubmitPayload(values: RequestFormValues, questions: FormQuestion[]): Json {
  const answers = toAnswersPayload(values.answers, questions);
  return {
    requester_name: values.requester_name.trim(),
    title: values.title.trim(),
    team_id: values.team_id,
    request_type_id: values.request_type_id,
    date_needed: values.date_needed,
    final_approver: values.final_approver,
    approver_name: values.approver_name.trim(),
    approver_email: values.approver_email.trim(),
    is_deal: values.is_deal === "yes",
    deal_name: values.is_deal === "yes" ? values.deal_name.trim() : "",
    deal_size: values.is_deal === "yes" ? values.deal_size.trim() : "",
    answers,
  };
}

// Cleaned answers for the chosen type's questions only.
export function toAnswersPayload(
  values: Record<string, AnswerValue | undefined>,
  questions: FormQuestion[],
): Record<string, string | string[]> {
  const answers: Record<string, string | string[]> = {};
  for (const q of questions) {
    const items = answerItems(values[q.id]).map(cleanItem);
    if (items.length === 0) continue;
    answers[q.id] = q.fieldType === "multi_select" ? items : items[0]!;
  }
  return answers;
}
