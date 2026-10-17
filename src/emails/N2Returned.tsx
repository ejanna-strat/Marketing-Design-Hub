import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N2 — to the requester when a reviewer returns the request.
export const n2Subject = (title: string) => `Design Request Returned: ${title}`;

export function N2Returned(p: { title: string; code: string; reason: string; reviewerName: string; url: string }) {
  return (
    <EmailLayout
      preview={`Your design request ${p.code} was returned`}
      label="Design Request Returned"
      status="rejected"
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "Reason for return", value: p.reason },
      ]}
      closing={
        <>
          <Paragraph>
            Please review the comments and provide the requested information or updates before submitting a new request.
          </Paragraph>
          <Paragraph>For any questions or clarifications, you may reach out to {p.reviewerName}.</Paragraph>
        </>
      }
      button={{ text: "File a New Design Request", href: p.url }}
      footer={FOOTERS.requester}
    >
      <Paragraph>Your design request has been returned because additional information or clarification is needed.</Paragraph>
    </EmailLayout>
  );
}
