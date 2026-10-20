"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { type AnswerValue, type FormQuestion, isOtherAnswer, OTHER_PREFIX, otherText } from "@/lib/requests/schema";

const OTHER_CHOICE = "__other__";

// Renders one request-specification question from the form_questions table.
// Every field type goes through here, so new questions need no code.
export function DynamicQuestion({
  question: q,
  value,
  onChange,
  error,
}: {
  question: FormQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  error?: string;
}) {
  const id = `q-${q.id}`;
  const describedBy = [q.helpText && `${id}-help`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  const isGroup = q.fieldType === "single_select" || q.fieldType === "multi_select";

  return (
    <div className="space-y-2" role={isGroup ? "group" : undefined} aria-labelledby={isGroup ? `${id}-label` : undefined}>
      <Label id={`${id}-label`} htmlFor={isGroup ? undefined : id} className="leading-snug">
        {q.label}
        {q.required && <span className="text-destructive" aria-hidden> *</span>}
        {q.fieldType === "multi_select" && (
          <span className="font-normal text-muted-foreground"> (select all that apply)</span>
        )}
      </Label>
      {q.helpText && (
        <p id={`${id}-help`} className="text-sm text-muted-foreground">
          {q.helpText}
        </p>
      )}
      <Field id={id} question={q} value={value} onChange={onChange} invalid={!!error} describedBy={describedBy} />
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  id,
  question: q,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  id: string;
  question: FormQuestion;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const aria = { "aria-invalid": invalid || undefined, "aria-describedby": describedBy };
  const text = typeof value === "string" ? value : "";

  switch (q.fieldType) {
    case "long_text":
      return <Textarea id={id} rows={3} value={text} onChange={(e) => onChange(e.target.value)} {...aria} />;
    case "date":
      return <Input id={id} type="date" className="w-fit" value={text} onChange={(e) => onChange(e.target.value)} {...aria} />;
    case "single_select": {
      const other = isOtherAnswer(text);
      return (
        <RadioGroup
          value={other ? OTHER_CHOICE : text}
          onValueChange={(v) => onChange(v === OTHER_CHOICE ? OTHER_PREFIX : v)}
          className="gap-2.5"
          {...aria}
        >
          {q.options.map((option, i) => (
            <div key={option} className="flex items-start gap-2.5">
              <RadioGroupItem id={`${id}-${i}`} value={option} className="mt-0.5" />
              <Label htmlFor={`${id}-${i}`} className="font-normal leading-snug">
                {option}
              </Label>
            </div>
          ))}
          {q.allowOther && (
            <OtherOption
              id={`${id}-other`}
              control={<RadioGroupItem id={`${id}-other`} value={OTHER_CHOICE} className="mt-2" />}
              checked={other}
              text={other ? otherText(text) : ""}
              onText={(t) => onChange(OTHER_PREFIX + t)}
            />
          )}
        </RadioGroup>
      );
    }
    case "multi_select": {
      const selected = Array.isArray(value) ? value : [];
      const otherItem = selected.find(isOtherAnswer);
      const toggle = (item: string, on: boolean) =>
        onChange(on ? [...selected, item] : selected.filter((s) => s !== item));
      return (
        <div className="space-y-2.5" {...aria}>
          {q.options.map((option, i) => (
            <div key={option} className="flex items-start gap-2.5">
              <Checkbox
                id={`${id}-${i}`}
                checked={selected.includes(option)}
                onCheckedChange={(on) => toggle(option, on === true)}
                className="mt-0.5"
              />
              <Label htmlFor={`${id}-${i}`} className="font-normal leading-snug">
                {option}
              </Label>
            </div>
          ))}
          {q.allowOther && (
            <OtherOption
              id={`${id}-other`}
              control={
                <Checkbox
                  id={`${id}-other`}
                  checked={otherItem !== undefined}
                  onCheckedChange={(on) =>
                    onChange(on === true ? [...selected, OTHER_PREFIX] : selected.filter((s) => !isOtherAnswer(s)))
                  }
                  className="mt-2"
                />
              }
              checked={otherItem !== undefined}
              text={otherItem ? otherText(otherItem) : ""}
              onText={(t) => onChange([...selected.filter((s) => !isOtherAnswer(s)), OTHER_PREFIX + t])}
            />
          )}
        </div>
      );
    }
    default:
      return <Input id={id} autoComplete="off" value={text} onChange={(e) => onChange(e.target.value)} {...aria} />;
  }
}

function OtherOption({
  id,
  control,
  checked,
  text,
  onText,
}: {
  id: string;
  control: React.ReactNode;
  checked: boolean;
  text: string;
  onText: (text: string) => void;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {control}
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Label htmlFor={id} className="font-normal">
          Other:
        </Label>
        <Input
          aria-label="Other, please specify"
          className="h-8 max-w-sm flex-1"
          value={text}
          disabled={!checked}
          onChange={(e) => onText(e.target.value)}
          placeholder={checked ? "Please specify" : ""}
        />
      </div>
    </div>
  );
}
