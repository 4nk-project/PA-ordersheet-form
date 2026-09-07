"use client";

import { Button, FieldError, Group, Input, Label, NumberField as AriaNumberField, type NumberFieldProps } from "react-aria-components";

export function NumberField({ label, error, optional, ...props }: NumberFieldProps & { label: string; error?: string; optional?: boolean }) {
  return (
    <AriaNumberField className="field" isInvalid={Boolean(error)} {...props}>
      <Label>{label} {optional ? <span className="optional">任意</span> : null}</Label>
      <Group className="number-group"><Button slot="decrement" aria-label="1減らす">−</Button><Input className="input" /><Button slot="increment" aria-label="1増やす">＋</Button></Group>
      <FieldError>{error}</FieldError>
    </AriaNumberField>
  );
}
