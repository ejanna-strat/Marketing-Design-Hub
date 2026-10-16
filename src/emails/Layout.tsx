import { Body, Button, Container, Head, Hr, Html, Preview, Section, Text } from "@react-email/components";
import { theme } from "@/config/theme";

// Shared layout for every notification (CLAUDE.md §8.2): app name header,
// uppercase label in the brand colour, message, details block, brand-colour
// button, footer.

export const FOOTERS = {
  team: "You're receiving this because you're on the Marketing Brand team.",
  design: "You're receiving this because you're on the Marketing Design team.",
  requester: "You're receiving this because you filed a Design Request with the Marketing team.",
  reminder: "You're receiving this as a friendly reminder about an upcoming due date.",
} as const;

export type Detail = { label: string; value: React.ReactNode };

export function EmailLayout({
  preview,
  label,
  children,
  details,
  closing,
  button,
  footer,
}: {
  preview: string;
  label: string;
  children: React.ReactNode;
  details: Detail[];
  // Text shown after the details block (e.g. "Thank you.").
  closing?: React.ReactNode;
  button: { text: string; href: string };
  footer: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f6f5fa", fontFamily: "Helvetica, Arial, sans-serif", margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" }}>
          <Section style={{ padding: "20px 32px", borderBottom: "1px solid #eeeaf6" }}>
            <Text style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1f1b2d" }}>{theme.appName}</Text>
          </Section>
          <Section style={{ padding: "28px 32px 8px" }}>
            <Text
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: theme.brand,
              }}
            >
              {label}
            </Text>
            {children}
          </Section>
          <Section style={{ padding: "8px 32px" }}>
            <table
              cellPadding={0}
              cellSpacing={0}
              role="presentation"
              style={{ width: "100%", backgroundColor: theme.brandSoft, borderRadius: 8, padding: "12px 16px" }}
            >
              <tbody>
                {details.map((d) => (
                  <tr key={d.label}>
                    <td style={{ padding: "4px 12px 4px 0", fontSize: 13, color: "#6b6780", whiteSpace: "nowrap", verticalAlign: "top" }}>
                      {d.label}
                    </td>
                    <td style={{ padding: "4px 0", fontSize: 13, color: "#1f1b2d", fontWeight: 600 }}>{d.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
          {closing && <Section style={{ padding: "16px 32px 0" }}>{closing}</Section>}
          <Section style={{ padding: "20px 32px 28px" }}>
            <Button
              href={button.href}
              style={{
                backgroundColor: theme.brand,
                color: "#ffffff",
                fontSize: 14,
                fontWeight: 600,
                padding: "12px 20px",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              {button.text}
            </Button>
          </Section>
          <Hr style={{ borderColor: "#eeeaf6", margin: 0 }} />
          <Section style={{ padding: "16px 32px 20px" }}>
            <Text style={{ margin: "0 0 8px", fontSize: 12, color: "#6b6780" }}>{footer}</Text>
            <Text style={{ margin: 0, fontSize: 11, color: "#9a96ab" }}>
              {theme.appName} | {theme.company} · Automated notification | For internal use only
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Paragraph({ children }: { children: React.ReactNode }) {
  return <Text style={{ margin: "0 0 12px", fontSize: 15, lineHeight: "22px", color: "#1f1b2d" }}>{children}</Text>;
}
