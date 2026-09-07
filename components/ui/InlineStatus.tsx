export function InlineStatus({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "error" }) {
  return <p className={`inline-status ${tone}`} aria-live="polite">{children}</p>;
}
