import { Link } from "@react-email/components";
import { theme } from "@/config/theme";
import { formatRating } from "@/lib/feedback";
import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// To Lead Designers, "Copy on Lead's email" members and the assigned designer
// when a requester shares feedback (owner, Nov 6).
export const n12Subject = (title: string) => `New Feedback Received: ${title}`;

const stars = (n: number) => `${"★".repeat(n)}${"☆".repeat(5 - n)} ${n} / 5`;

export function N12FeedbackReceived(p: {
  title: string;
  code: string;
  requesterName: string;
  team: string;
  designerName: string;
  process: number;
  output: number;
  comments: string | null;
  fromMarketing: boolean;
  url: string;
}) {
  return (
    <EmailLayout
      preview={`${p.requesterName} rated ${p.code} ${formatRating((p.process + p.output) / 2)} ★`}
      label="New Feedback Received"
      status="completed"
      details={[
        { label: "Request", value: p.title },
        {
          label: "Request ID",
          value: (
            <Link href={p.url} style={{ color: theme.brandInk, textDecoration: "underline" }}>
              {p.code}
            </Link>
          ),
        },
        { label: "Requested by", value: p.requesterName },
        { label: "Team", value: p.team },
        { label: "Designer", value: p.designerName },
        { label: "Design Request Process", value: stars(p.process) },
        { label: "Design Output", value: stars(p.output) },
        { label: "Overall", value: `${formatRating((p.process + p.output) / 2)} ★` },
        {
          label: "Comments",
          value: p.comments ? <span style={{ whiteSpace: "pre-wrap" }}>{p.comments}</span> : "No comments",
        },
      ]}
      closing={
        p.fromMarketing ? (
          <Paragraph>From a Marketing team requester, so it isn&apos;t counted in the averages.</Paragraph>
        ) : undefined
      }
      button={{ text: "View Feedback", href: p.url }}
      footer={FOOTERS.design}
    >
      <Paragraph>A requester shared feedback on a completed design request.</Paragraph>
    </EmailLayout>
  );
}
