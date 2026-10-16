"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import { CalendarIcon, InfoIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Controller, type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";
import { DynamicQuestion } from "@/components/form/DynamicQuestion";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { links } from "@/config/links";
import { formatDate, todayInManila } from "@/lib/dates";
import {
  buildRequestSchema,
  FINAL_APPROVER,
  type FormQuestion,
  type RequestFormValues,
} from "@/lib/requests/schema";
import { submitRequest } from "./actions";

type Option = { id: string; name: string };

export function NewRequestForm({
  user,
  teams,
  requestTypes,
  questions,
}: {
  user: { name: string; email: string; teamId: string | null };
  teams: Option[];
  requestTypes: Option[];
  questions: FormQuestion[];
}) {
  const today = useMemo(() => todayInManila(), []);
  const [dateOpen, setDateOpen] = useState(false);

  const questionsByType = useMemo(() => {
    const map = new Map<string, FormQuestion[]>();
    for (const q of questions) map.set(q.requestTypeId, [...(map.get(q.requestTypeId) ?? []), q]);
    return map;
  }, [questions]);

  // The rules depend on the chosen type, so build the schema at check time.
  const resolver = useCallback<Resolver<RequestFormValues>>(
    (values, context, options) =>
      zodResolver(buildRequestSchema(questionsByType.get(values.request_type_id) ?? [], today))(
        values,
        context,
        options,
      ) as ReturnType<Resolver<RequestFormValues>>,
    [questionsByType, today],
  );

  const {
    control,
    register,
    handleSubmit,
    watch,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<RequestFormValues>({
    resolver,
    defaultValues: {
      requester_name: user.name,
      title: "",
      team_id: teams.some((t) => t.id === user.teamId) ? user.teamId! : "",
      request_type_id: "",
      date_needed: "",
      final_approver: "myself",
      approver_name: "",
      approver_email: "",
      answers: {},
    },
  });

  const typeId = watch("request_type_id");
  const approver = watch("final_approver");
  const typeQuestions = questionsByType.get(typeId) ?? [];
  const typeName = requestTypes.find((t) => t.id === typeId)?.name;
  const answerErrors = errors.answers as Record<string, { message?: string }> | undefined;

  const onSubmit = handleSubmit(
    async (values) => {
      const result = await submitRequest(values);
      if (result?.error) toast.error(result.error);
    },
    () => {
      toast.error("Please check the highlighted fields.");
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("[aria-invalid=true]")?.scrollIntoView({ behavior: "smooth", block: "center" }),
      );
    },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">New Design Request</h1>
        <p className="text-muted-foreground">Marketing Design Request Form</p>
      </div>

      <div className="space-y-3 rounded-xl border border-brand/20 bg-brand-soft/60 p-5 text-sm leading-relaxed">
        <p className="font-medium">Welcome to the Marketing Team’s Design Request Form!</p>
        <p>
          Please allow us one working day to acknowledge receipt of your request. If you do not receive a response
          within this time, please follow up with Jerome Casupanan via Google Chat or email at{" "}
          <a className="font-medium text-brand underline" href="mailto:jerome.casupanan@stratpoint.com">
            jerome.casupanan@stratpoint.com
          </a>
          .
        </p>
        <p>
          <span className="font-medium">Please note:</span> All requests are subject to review and approval. Submission
          does not mean work has started. Your request will only be considered in progress once you receive
          confirmation from one of our designers.
        </p>
        <p>Thank you!</p>
        <div className="space-y-1 border-t border-brand/20 pt-3">
          <p className="flex gap-2 font-medium">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            Please submit a separate request for each design type.
          </p>
          <p className="flex gap-2 font-medium">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-brand" />
            <span>
              Reminder: Please review our <SlaLink /> to set expectations for request turnaround times.
            </span>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name" htmlFor="requester_name" required error={errors.requester_name?.message}>
              <Input id="requester_name" autoComplete="name" aria-invalid={!!errors.requester_name || undefined} {...register("requester_name")} />
            </Field>
            <Field label="Email" htmlFor="email" required>
              <Input id="email" value={user.email} readOnly disabled />
            </Field>
          </div>

          <Field label="Business Unit" htmlFor="team_id" required error={errors.team_id?.message}>
            <Controller
              control={control}
              name="team_id"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="team_id" className="w-full" aria-invalid={!!errors.team_id || undefined}>
                    <SelectValue placeholder="Select your business unit" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {teams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field
            label="Request Title"
            htmlFor="title"
            required
            help='A short, descriptive title of your request (e.g. "Pitch Deck - GCash", "AICON Event Visual Identity", "Blog Launch: 5 Tips on How to Code")'
            error={errors.title?.message}
          >
            <Input id="title" aria-invalid={!!errors.title || undefined} {...register("title")} />
          </Field>

          <Field
            label="Date Needed"
            htmlFor="date_needed"
            required
            help={
              <>
                Select the date when you need the final design output delivered. For guidance on turnaround times,
                please refer to our <SlaLink />.
              </>
            }
            error={errors.date_needed?.message}
          >
            <Controller
              control={control}
              name="date_needed"
              render={({ field }) => (
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="date_needed"
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal sm:w-64"
                      aria-invalid={!!errors.date_needed || undefined}
                    >
                      <CalendarIcon className="text-muted-foreground" />
                      {field.value ? formatDate(field.value) : <span className="text-muted-foreground">Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value ? parseISO(field.value) : undefined}
                      defaultMonth={field.value ? parseISO(field.value) : parseISO(today)}
                      disabled={{ before: parseISO(today) }}
                      onSelect={(d) => {
                        if (!d) return;
                        field.onChange(format(d, "yyyy-MM-dd"));
                        setDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            />
          </Field>

          <Field label="Final Approver of the Design" htmlFor="final_approver" required error={errors.final_approver?.message}>
            <Controller
              control={control}
              name="final_approver"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="final_approver" className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="myself">{FINAL_APPROVER.myself}</SelectItem>
                    <SelectItem value="other">{FINAL_APPROVER.other}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          {approver === "other" && (
            <div className="grid gap-5 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
              <Field label="Approver Name" htmlFor="approver_name" required error={errors.approver_name?.message}>
                <Input id="approver_name" aria-invalid={!!errors.approver_name || undefined} {...register("approver_name")} />
              </Field>
              <Field label="Approver Email" htmlFor="approver_email" required error={errors.approver_email?.message}>
                <Input
                  id="approver_email"
                  type="email"
                  aria-invalid={!!errors.approver_email || undefined}
                  {...register("approver_email")}
                />
              </Field>
            </div>
          )}

          <Field label="Type of Design Request" htmlFor="request_type_id" required error={errors.request_type_id?.message}>
            <Controller
              control={control}
              name="request_type_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    clearErrors("answers");
                  }}
                >
                  <SelectTrigger id="request_type_id" className="w-full" aria-invalid={!!errors.request_type_id || undefined}>
                    <SelectValue placeholder="Select the type of design request" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    {requestTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
        </CardContent>
      </Card>

      {typeName && (
        <Card>
          <CardHeader>
            <CardTitle>Request Specifications</CardTitle>
            <CardDescription>{typeName}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {typeQuestions.map((q) => (
              <Controller
                key={q.id}
                control={control}
                name={`answers.${q.id}`}
                render={({ field }) => (
                  <DynamicQuestion
                    question={q}
                    value={field.value}
                    onChange={field.onChange}
                    error={answerErrors?.[q.id]?.message}
                  />
                )}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="text-destructive">*</span> Required
        </p>
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? "Submitting…" : "Submit Request"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  help?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
      {children}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// "SLAs", linked to the Marketing Hub service-level agreement page.
function SlaLink() {
  return (
    <a href={links.designSlas} target="_blank" rel="noreferrer" className="font-medium text-brand underline underline-offset-2">
      SLAs
    </a>
  );
}
