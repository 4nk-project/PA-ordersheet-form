"use client";

import { useRef } from "react";
import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";

export function ConfirmSubmitButton({ label = "削除", title, description }: { label?: string; title: string; description: string }) {
  const submitRef = useRef<HTMLButtonElement>(null);
  return <><button ref={submitRef} hidden type="submit" /><ConfirmDialog danger title={title} confirmLabel={label} onConfirm={() => submitRef.current?.click()} trigger={<Button variant="danger" className="small-button">{label}</Button>}><p>{description}</p></ConfirmDialog></>;
}
