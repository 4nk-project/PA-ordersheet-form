"use client";

import { Button, Dialog, DialogTrigger, Heading, Modal, ModalOverlay } from "react-aria-components";

function DialogContent({ title, children, confirmLabel, onConfirm, danger, close }: { title: string; children: React.ReactNode; confirmLabel: string; onConfirm: () => void; danger: boolean; close: () => void }) {
  return <><Heading slot="title">{title}</Heading><div className="dialog-body">{children}</div><div className="actions"><Button className="button secondary" onPress={close}>キャンセル</Button><Button className={`button ${danger ? "danger" : "primary"}`} onPress={() => { onConfirm(); close(); }}>{confirmLabel}</Button></div></>;
}

export function ConfirmDialog({ trigger, title, children, confirmLabel = "続ける", onConfirm, danger = false }: { trigger: React.ReactNode; title: string; children: React.ReactNode; confirmLabel?: string; onConfirm: () => void; danger?: boolean }) {
  return (
    <DialogTrigger>
      {trigger}
      <ModalOverlay className="modal-overlay" isDismissable>
        <Modal className="modal">
          <Dialog className="dialog" role="alertdialog">
            {({ close }) => <DialogContent title={title} confirmLabel={confirmLabel} onConfirm={onConfirm} danger={danger} close={close}>{children}</DialogContent>}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}

export function ControlledConfirmDialog({ isOpen, onOpenChange, title, children, confirmLabel = "続ける", onConfirm, danger = false }: { isOpen: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode; confirmLabel?: string; onConfirm: () => void; danger?: boolean }) {
  return <ModalOverlay className="modal-overlay" isDismissable isOpen={isOpen} onOpenChange={onOpenChange}><Modal className="modal"><Dialog className="dialog" role="alertdialog">{({ close }) => <DialogContent title={title} confirmLabel={confirmLabel} onConfirm={onConfirm} danger={danger} close={close}>{children}</DialogContent>}</Dialog></Modal></ModalOverlay>;
}
