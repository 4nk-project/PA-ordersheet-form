"use client";

import { FieldError, Label, Text, TextArea, TextField, type TextFieldProps } from "react-aria-components";

export function TextAreaField({ label, description, error, optional = true, placeholder, ...props }: TextFieldProps & { label: string; description?: string; error?: string; optional?: boolean; placeholder?: string }) {
  return (
    <TextField className="field" isInvalid={Boolean(error)} {...props}>
      <Label>{label} {optional ? <span className="optional">任意</span> : null}</Label>
      {description ? <Text className="field-description" slot="description">{description}</Text> : null}
      <TextArea className="textarea" placeholder={placeholder} />
      <FieldError>{error}</FieldError>
    </TextField>
  );
}
