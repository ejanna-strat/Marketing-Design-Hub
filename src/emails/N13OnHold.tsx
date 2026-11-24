import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N13 — On hold for 30 days, then every 30 days (owner, Nov 24): to the
// request's designers and the Lead Designers, never the requester.
export const n13Subject = (title: string) => `On Hold for 30+ Days: ${title}`;

export function N13OnHold(p: {
  title: string;
  code: string;
  requesterName: string;
  team: string;
  days: number;
  since: string;
  before: string | null;
  designers: string;
  url: string;
}) {
  return (
    <EmailLayout
      preview={`${p.code} has been on hold for ${p.days} days`}
      label="On Hold Check-in"
      status="on_hold"
      details={[
        { label: "Request", value: p.title },
        { label: "Request ID", value: p.code },
        { label: "Requested by", value: `${p.requesterName} / ${p.team}` },
        { label: "Designer", value: p.designers },
        { label: "On hold since", value: `${p.since} (${p.days} days)` },
        ...(p.before ? [{ label: "Status before On hold", value: p.before }] : []),
      ]}
      button={{ text: "Review On Hold Request", href: p.url }}
      footer={FOOTERS.design}
    >
      <Paragraph>
        This design request has been <strong>on hold for {p.days} days</strong>.
      </Paragraph>
      <Paragraph>
        Please open the request and choose what happens next: <strong>keep it on hold</strong>, <strong>resume</strong>{" "}
        it, or <strong>cancel</strong> it if it&apos;s no longer needed.
      </Paragraph>
    </EmailLayout>
  );
}
