import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// Daily reminder (weekdays 8AM) while a new request has waited 24 hours or
// more without a designer (owner, Oct 22). Same recipients as the
// new-request email.
export const n1ReminderSubject = (title: string) => `Reminder: New Design Request Waiting: ${title}`;

export function N1Reminder(p: {
  title: string;
  code: string;
  requesterName: string;
  team: string;
  dateNeeded: string;
  waitingSince: string;
  days: number;
  url: string;
}) {
  return (
    <EmailLayout
      preview={`${p.code} has been waiting for a designer for ${p.days} day${p.days === 1 ? "" : "s"}`}
      label="New Request Reminder"
      status="new_request"
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "Requested by", value: p.requesterName },
        { label: "Team", value: p.team },
        { label: "Date Needed", value: p.dateNeeded },
        { label: "Waiting since", value: p.waitingSince },
      ]}
      button={{ text: "View New Design Request", href: p.url }}
      footer={FOOTERS.team}
    >
      <Paragraph>
        This design request has been waiting for a designer for{" "}
        <strong>
          {p.days} day{p.days === 1 ? "" : "s"}
        </strong>
        .
      </Paragraph>
      <Paragraph>Please review it and assign a designer, or return it to the requester.</Paragraph>
    </EmailLayout>
  );
}
