"use client";

import { Label, ProgressBar } from "react-aria-components";

export function ProgressIndicator({ step, total, label }: { step: number; total: number; label: string }) {
  return <ProgressBar className="progress" value={step} minValue={1} maxValue={total}><div className="progress-label"><Label>{label}</Label><span>{step} / {total}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${(step / total) * 100}%` }} /></div></ProgressBar>;
}
