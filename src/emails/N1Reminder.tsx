import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// Daily reminder (weekdays 8AM) while a new request still has no designer,
// from the second morning after filing (owner, Oct 22). To Lead Designers,
// "Gets team emails" members and every designer.
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
      <Paragraph>
        Designers: if you can take this on, open the request and click <strong>Take this request</strong>.
      </Paragraph>
    </EmailLayout>
  );
}
