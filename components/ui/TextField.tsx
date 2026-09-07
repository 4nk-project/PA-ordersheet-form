"use client";

import { FieldError, Input, Label, Text, TextField as AriaTextField, type InputProps, type TextFieldProps as AriaTextFieldProps } from "react-aria-components";

type Props = AriaTextFieldProps & { label: string; description?: string; error?: string; optional?: boolean; placeholder?: string; inputProps?: InputProps };

export function TextField({ label, description, error, optional, placeholder, inputProps, ...props }: Props) {
  return (
    <AriaTextField className="field" isInvalid={Boolean(error)} {...props}>
      <Label>{label} {optional ? <span className="optional">任意</span> : props.isRequired ? <span className="required">必須</span> : null}</Label>
      {description ? <Text className="field-description" slot="description">{description}</Text> : null}
      <Input className="input" placeholder={placeholder} {...inputProps} />
      <FieldError>{error}</FieldError>
    </AriaTextField>
  );
}
