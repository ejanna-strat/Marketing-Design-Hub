import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N10 — to Jerome + the assigned designer, once, 3 days before Date Needed.
export const n10Subject = () => "Design Request Due in 3 Days";

export function N10DueSoon(p: {
  title: string;
  code: string;
  requesterName: string;
  team: string;
  dateNeeded: string;
  status: string;
  url: string;
}) {
  return (
    <EmailLayout
      preview={`${p.code} is due on ${p.dateNeeded}`}
      label="Design Task Check-in"
      status={p.status}
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "Requested by", value: `${p.requesterName} / ${p.team}` },
        { label: "Date needed", value: p.dateNeeded },
      ]}
      button={{ text: "View Request", href: p.url }}
      footer={FOOTERS.reminder}
    >
      <Paragraph>
        Just a friendly reminder that a design task is due in <strong>3 days</strong>.
      </Paragraph>
      <Paragraph>
        Please check the status of the task and ensure it remains on track for completion on or before the due date.
      </Paragraph>
    </EmailLayout>
  );
}
