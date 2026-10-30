// Deal sizes are whole pesos, shown like ₱1,250,000.
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });

export function formatPeso(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : peso.format(value);
}

// "1,250,000" / "₱ 1250000" → "1250000" (digits only) for the form field.
export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}
