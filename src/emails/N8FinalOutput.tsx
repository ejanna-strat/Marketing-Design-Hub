import { Link } from "@react-email/components";
import { theme } from "@/config/theme";
import { EmailLayout, FOOTERS, Paragraph } from "./Layout";

// N8 — sent to the requester when the status becomes Completed, with the
// feedback paragraph and Share Feedback button (§8.2; feedback built Oct 18).
export function n8Subject(title: string) {
  return `Final Design Output Ready: ${title}`;
}

export function N8FinalOutput({
  title,
  code,
  designerName,
  outputUrl,
  buttonUrl,
  feedbackUrl,
}: {
  title: string;
  code: string;
  designerName: string;
  outputUrl: string | null;
  // The final output link, or the request's page when there is no link.
  buttonUrl: string;
  feedbackUrl: string;
}) {
  return (
    <EmailLayout
      preview={`The final design output for ${title} is ready!`}
      label="Final Output Is Ready!"
      status="completed"
      details={[
        { label: "Request", value: title },
        { label: "Request ID", value: code },
        { label: "Designer", value: designerName },
        {
          label: "Link to Final Output",
          value: outputUrl ? (
            <Link href={outputUrl} style={{ color: theme.brandInk }}>
              Open Link ↗
            </Link>
          ) : (
            "—"
          ),
        },
      ]}
      closing={
        <>
          <Paragraph>
            We would also appreciate it if you could spare a few minutes to share your feedback on your experience with
            the Marketing Brand Team. Your feedback will help us improve our process and the outputs we deliver.
          </Paragraph>
          <Paragraph>Thank you.</Paragraph>
        </>
      }
      button={{ text: "View Final Output", href: buttonUrl }}
      secondaryButton={{ text: "Share Feedback", href: feedbackUrl }}
      footer={FOOTERS.requester}
    >
      <Paragraph>The final design output for your request is ready!</Paragraph>
    </EmailLayout>
  );
}
