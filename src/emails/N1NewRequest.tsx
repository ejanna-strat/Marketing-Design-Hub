import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N1 — sent to all designers + Riann when a request is submitted.
export function n1Subject(title: string) {
  return `New Design Request: ${title}`;
}

export function N1NewRequest({
  title,
  code,
  requesterName,
  team,
  dateNeeded,
  url,
  status = "new_request",
}: {
  title: string;
  code: string;
  requesterName: string;
  team: string;
  dateNeeded: string;
  url: string;
  status?: string;
}) {
  return (
    <EmailLayout
      preview={`${requesterName} submitted ${code}: ${title}`}
      label="New Design Request"
      status={status}
      details={[
        { label: "Request", value: title },
        { label: "Request ID", value: code },
        { label: "Requested by", value: requesterName },
        { label: "Team", value: team },
        { label: "Date Needed", value: dateNeeded },
      ]}
      button={{ text: "View New Design Request", href: url }}
      footer={FOOTERS.team}
    >
      <Paragraph>A new design request has been submitted and is ready for review.</Paragraph>
    </EmailLayout>
  );
}
