import { Body, Button, Container, Head, Hr, Html, Img, Preview, Section, Text } from "@react-email/components";
import { theme } from "@/config/theme";
import { statusEmailColors, statusLabel } from "@/lib/statuses";

// Shared layout for every notification (CLAUDE.md §8.2, refreshed Oct 18):
// logo + app name as the title, uppercase label, centred message, the
// request's status as a coloured tag, details table, button(s), footer.

export const FOOTERS = {
  team: "You're receiving this because you're on the Marketing Brand team.",
  design: "You're receiving this because you're on the Marketing Design team.",
  requester: "You're receiving this because you filed a Design Request with the Marketing team.",
  reminder: "You're receiving this as a friendly reminder about an upcoming due date.",
} as const;

// The logo is served from the project's public "brand" storage folder, so
// email programs can load it (the app itself may sit behind a login). The
// ?v= tag changes whenever the logo does, because email programs (Gmail)
// keep their own copy of an image per address (new #3b94e4 logo, Oct 22).
export function logoUrl() {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/brand/logo.png?v=3b94e4`;
}

const FONT = "Inter, 'Segoe UI', Helvetica, Arial, sans-serif";

export type Detail = { label: string; value: React.ReactNode };
export type EmailButton = { text: string; href: string };

export function EmailLayout({
  preview,
  label,
  children,
  status,
  details,
  closing,
  button,
  secondaryButton,
  footer,
}: {
  preview: string;
  label: string;
  children: React.ReactNode;
  // The request's status, shown as a coloured tag before the details.
  status?: string;
  details: Detail[];
  // Text shown after the details block (e.g. "Thank you.").
  closing?: React.ReactNode;
  button: EmailButton;
  secondaryButton?: EmailButton;
  footer: string;
}) {
  const tag = status ? statusEmailColors(status) : null;
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f3f6fb", fontFamily: FONT, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 14, overflow: "hidden" }}>
          <Section style={{ padding: "28px 32px 20px", borderBottom: "1px solid #e6ecf5", textAlign: "center" }}>
            <Img src={logoUrl()} width="56" height="56" alt="" style={{ margin: "0 auto 10px", borderRadius: 12 }} />
            <Text style={{ margin: 0, fontSize: 24, lineHeight: "30px", fontWeight: 700, color: theme.brandInk, fontFamily: FONT }}>
              {theme.appName}
            </Text>
          </Section>
          <Section style={{ padding: "28px 32px 8px", textAlign: "center" }}>
            <Text
              style={{
                margin: "0 0 14px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: theme.brandInk,
              }}
            >
              {label}
            </Text>
            {children}
            {tag && (
              <Text style={{ margin: "4px 0 6px", fontSize: 13, color: "#55627a" }}>
                Status:{" "}
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: tag.bg,
                    color: tag.text,
                    fontWeight: 600,
                    fontSize: 13,
                    padding: "3px 12px",
                    borderRadius: 999,
                  }}
                >
                  {statusLabel(status!)}
                </span>
              </Text>
            )}
          </Section>
          <Section style={{ padding: "8px 32px" }}>
            <table
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              style={{ width: "100%", backgroundColor: theme.brandSoft, borderRadius: 8, padding: "12px 16px", textAlign: "left" }}
            >
              <tbody>
                {details.map((d) => (
                  <tr key={d.label}>
                    <td style={{ padding: "4px 12px 4px 0", fontSize: 13, color: "#55627a", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {d.label}
                    </td>
                    <td style={{ padding: "4px 0", fontSize: 13, color: "#152033", fontWeight: 600 }}>{d.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          {closing && <Section style={{ padding: "16px 32px 0", textAlign: "center" }}>{closing}</Section>}
          <Section style={{ padding: "20px 32px 28px", textAlign: "center" }}>
            <Button href={button.href} style={buttonStyle(true)}>
              {button.text}
            </Button>
            {secondaryButton && (
              <>
                {" "}
                <Button href={secondaryButton.href} style={{ ...buttonStyle(false), marginLeft: 8 }}>
                  {secondaryButton.text}
                </Button>
              </>
            )}
          </Section>
          <Hr style={{ borderColor: "#e6ecf5", margin: 0 }} />
          <Section style={{ padding: "16px 32px 22px", textAlign: "center" }}>
            <Text style={{ margin: "0 0 8px", fontSize: 12, color: "#55627a" }}>{footer}</Text>
            <Text style={{ margin: 0, fontSize: 11, color: "#8a96ab" }}>
              {theme.appName} | {theme.company} · Automated notification | For internal use only
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

function buttonStyle(primary: boolean): React.CSSProperties {
  return {
    backgroundColor: primary ? theme.brand : "#ffffff",
    color: primary ? "#ffffff" : theme.brandInk,
    border: `2px solid ${theme.brand}`,
    fontSize: 14,
    fontWeight: 600,
    padding: "10px 20px",
    borderRadius: 8,
    textDecoration: "none",
    display: "inline-block",
  };
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ margin: "0 0 12px", fontSize: 15, lineHeight: "23px", color: "#152033", textAlign: "center" }}>{children}</Text>
  );
}
