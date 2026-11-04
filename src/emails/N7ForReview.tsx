import { Link } from "@react-email/components";
import { theme } from "@/config/theme";
import type { OutputLinkItem } from "@/lib/links";
import { EmailLayout, FOOTERS, OutputLinksValue, Paragraph } from "./Layout";

// N7 — to the requester when the status becomes For requester's review.
export const n7Subject = (title: string) => `Initial Design Output Ready: ${title}`;

// The button opens the (first) output itself (what the requester expects);
// the Request ID links to the request page (owner, Oct 21).
export function N7ForReview(p: {
  title: string;
  code: string;
  designerName: string;
  outputLinks: OutputLinkItem[];
  url: string;
}) {
  return (
    <EmailLayout
      preview={`The initial design output for ${p.title} is ready for review`}
      label="Design Output for Review"
      status="for_review"
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
      <Paragraph>The initial design output for your request is ready for review.</Paragraph>
      <Paragraph>
        Please coordinate with {p.designerName} to review the output and provide any feedback or revisions needed.
      </Paragraph>
    </EmailLayout>
  );
}
