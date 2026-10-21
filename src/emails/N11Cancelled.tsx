import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// To the assigned designer when the requester cancels the request (owner,
// Oct 21). Not sent when no designer was assigned yet.
export const n11Subject = (title: string) => `Design Request Cancelled: ${title}`;

export function N11Cancelled(p: { title: string; code: string; requesterName: string; reason: string; url: string }) {
  return (
    <EmailLayout
      preview={`${p.code} was cancelled by the requester`}
      label="Design Request Cancelled"
      status="cancelled"
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "Requested by", value: p.requesterName },
        { label: "Reason for cancellation", value: p.reason },
      ]}
      button={{ text: "View Request", href: p.url }}
      footer={FOOTERS.design}
    >
      <Paragraph>The requester has cancelled this design request. No further work is needed.</Paragraph>
    </EmailLayout>
  );
}
