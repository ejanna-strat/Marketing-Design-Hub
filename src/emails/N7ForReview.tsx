import { Link } from "@react-email/components";
import { theme } from "@/config/theme";
import type { OutputLinkItem } from "@/lib/links";
import { REVIEW_STATUSES } from "@/lib/statuses";
import { EmailLayout, FOOTERS, OutputLinksValue, Paragraph } from "./Layout";

// N7 — to the requester at each review round (owner, Nov 26): the 1st draft
// (the old "For requester's review"), V2 and V3. V3 is the last round.
export type ReviewStage = 1 | 2 | 3;

const COPY: Record<ReviewStage, { subject: string; label: string; output: string }> = {
  1: {
    subject: "Initial Design Output Ready",
    label: "Design Output for Review",
    output: "initial design output (1st draft)",
  },
  2: {
    subject: "Revised Design Output Ready (V2)",
    label: "Revised Output for Review",
    output: "revised design output (V2)",
  },
  3: {
    subject: "Revised Design Output Ready (V3)",
    label: "Revised Output for Review",
    output: "revised design output (V3)",
  },
};

export const n7Subject = (title: string, stage: ReviewStage = 1) => `${COPY[stage].subject}: ${title}`;

// The button opens the (first) output itself (what the requester expects);
// the Request ID links to the request page (owner, Oct 21).
export function N7ForReview(p: {
  title: string;
  code: string;
  designerName: string;
  outputLinks: OutputLinkItem[];
  url: string;
  stage?: ReviewStage;
}) {
  const stage = p.stage ?? 1;
  const copy = COPY[stage];
  return (
    <EmailLayout
      preview={`The ${copy.output} for ${p.title} is ready for review`}
      label={copy.label}
      status={REVIEW_STATUSES[stage - 1]}
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
        { label: "Designer", value: p.designerName },
        {
          label: p.outputLinks.length > 1 ? "Links to Output" : "Link to Output",
          value: <OutputLinksValue links={p.outputLinks} />,
        },
      ]}
      closing={<Paragraph>Thank you.</Paragraph>}
      button={{ text: "View Request Output", href: p.outputLinks[0]?.url ?? p.url }}
      footer={FOOTERS.requester}
    >
      <Paragraph>The {copy.output} for your request is ready for review.</Paragraph>
      <Paragraph>
        Please coordinate with {p.designerName} to review the output and provide any feedback or revisions needed.
      </Paragraph>
      {stage === 3 && (
        <Paragraph>This is the last review round, so please send all remaining changes in this round.</Paragraph>
      )}
    </EmailLayout>
  );
}
