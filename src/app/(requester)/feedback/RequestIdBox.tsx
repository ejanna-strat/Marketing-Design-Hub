"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CODE = /^MDR-\d{2}-\d{4,}$/;

export function RequestIdBox() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        const code = value.trim().toUpperCase();
        if (!CODE.test(code)) {
          setError("Please enter a Request ID like MDR-26-0004.");
          return;
        }
        router.push(`/feedback/${code}`);
      }}
    >
      <div className="flex gap-2">
        <Input
          aria-label="Request ID"
          placeholder="MDR-26-0004"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(undefined);
          }}
          className="max-w-xs font-mono uppercase"
        />
        <Button type="submit">Continue</Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </form>
  );
}
