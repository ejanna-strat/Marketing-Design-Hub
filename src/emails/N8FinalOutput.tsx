import { Link } from "@react-email/components";
import { theme } from "@/config/theme";
import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N8 — sent to the requester when the status becomes Completed.
// MVP version: only "View Final Output"; the feedback paragraph and the
// Share Feedback button arrive in Phase 3.
export function n8Subject(title: string) {
  return `Final Design Output Ready: ${title}`;
}

export function N8FinalOutput({
  title,
  code,
  designerName,
  outputUrl,
  buttonUrl,
}: {
  title: string;
  code: string;
  designerName: string;
  outputUrl: string | null;
  // The final output link, or the request's page when there is no link.
  buttonUrl: string;
}) {
  return (
    <EmailLayout
      preview={`The final design output for ${title} is ready!`}
      label="Final Output Is Ready!"
      details={[
        { label: "Request", value: title },
        { label: "Request ID", value: code },
        { label: "Designer", value: designerName },
        {
          label: "Link to Final Output",
          value: outputUrl ? (
            <Link href={outputUrl} style={{ color: theme.brand }}>
              Open Link ↗
            </Link>
          ) : (
            "—"
          ),
        },
      ]}
      closing={<Paragraph>Thank you.</Paragraph>}
      button={{ text: "View Final Output", href: buttonUrl }}
      footer={FOOTERS.requester}
    >
      <Paragraph>The final design output for your request is ready!</Paragraph>
    </EmailLayout>
  );
}
