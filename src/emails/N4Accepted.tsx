import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N4 — to the requester (+ "Gets team emails" members) when the designer accepts.
export const n4Subject = (title: string) => `Design Request Accepted: ${title}`;

export function N4Accepted(p: { title: string; code: string; designerName: string; url: string }) {
  return (
    <EmailLayout
      preview={`${p.designerName} accepted your design request`}
      label="Design Request Accepted"
      status="designer_assigned"
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
      ]}
      button={{ text: "Track Request", href: p.url }}
      footer={FOOTERS.requester}
    >
      <Paragraph>Your design request has been accepted and assigned to {p.designerName}.</Paragraph>
      <Paragraph>We will notify you once the designer starts working on your request.</Paragraph>
      <Paragraph>You can track the progress of your request through Track My Requests.</Paragraph>
    </EmailLayout>
  );
}
