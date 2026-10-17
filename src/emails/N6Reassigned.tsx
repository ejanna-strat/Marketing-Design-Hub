import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N6 — to the requester + the new designer when an admin reassigns the request.
export const n6Subject = (title: string) => `Design Request Reassigned: ${title}`;

export function N6Reassigned(p: { title: string; code: string; designerName: string; status: string; url: string }) {
  return (
    <EmailLayout
      preview={`${p.code} has a new designer`}
      label="Design Request"
      status={p.status}
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "New Designer", value: p.designerName },
      ]}
      button={{ text: "Track Request", href: p.url }}
      footer={FOOTERS.requester}
    >
      <Paragraph>Your design request has been reassigned to a new designer.</Paragraph>
      <Paragraph>You can continue tracking the progress of your request through Track My Requests.</Paragraph>
    </EmailLayout>
  );
}
