import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// A summary tile: a title, a big number with an optional share ("· 40%"),
// and small lines underneath (e.g. the deal size).
export function SummaryBox({
  title,
  value,
  rate,
  lines = [],
}: {
  title: string;
  value: React.ReactNode;
  rate?: string;
  lines?: React.ReactNode[];
}) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">
          {value}
          {rate && <span className="text-base font-medium text-muted-foreground"> · {rate}</span>}
        </CardTitle>
      </CardHeader>
      {lines.length > 0 && (
        <CardContent className="space-y-0.5">
          {lines.map((l, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              {l}
            </p>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

export const shareOf = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "—");
