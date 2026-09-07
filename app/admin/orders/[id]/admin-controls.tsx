"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { changeStatus, removeOrder } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { statusLabels } from "@/lib/format";
import type { OrderStatus } from "@/types/order";

const statuses: OrderStatus[] = ["new", "reviewing", "done"];

function StatusButton() {
  const { pending } = useFormStatus();
  return <button className="button primary" disabled={pending} type="submit">{pending ? "更新中…" : "更新"}</button>;
}

export function ChangeStatusForm({ id, status }: { id: string; status: OrderStatus }) {
  return <form className="actions status-form" action={changeStatus}><input name="id" type="hidden" value={id} /><select className="select" defaultValue={status} name="status">{statuses.map((item) => <option key={item} value={item}>{statusLabels[item]}</option>)}</select><StatusButton /><span className="sr-only" aria-live="polite"></span></form>;
}

export function DeleteOrderForm({ id, bandName }: { id: string; bandName: string }) {
  const submitRef = useRef<HTMLButtonElement>(null);
  return <form action={removeOrder}><input name="id" type="hidden" value={id} /><button ref={submitRef} hidden type="submit" /><ConfirmDialog danger title="提出内容を削除しますか？" confirmLabel="削除する" onConfirm={() => submitRef.current?.click()} trigger={<Button variant="danger">この提出を削除</Button>}><p>「{bandName}」の提出内容を削除します。この操作は取り消せません。</p></ConfirmDialog></form>;
}
