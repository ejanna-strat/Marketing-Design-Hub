import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N3 — to the assigned designer (+ "Gets team emails" members) on assignment.
export const n3Subject = () => "New Design Request Assigned to You";

export function N3Assigned(p: {
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
      preview={`${p.code} has been assigned to you`}
      label="New Task Assigned"
      status={p.status}
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "Requested by", value: p.requesterName },
        { label: "Requester's Team", value: p.team },
        { label: "Date needed", value: p.dateNeeded },
      ]}
      button={{ text: "View My Pipeline", href: p.url }}
      footer={FOOTERS.design}
    >
      <Paragraph>A new design request is now in the pipeline and has been assigned to you.</Paragraph>
      <Paragraph>Please review the request and respond to acknowledge the task.</Paragraph>
    </EmailLayout>
  );
}
