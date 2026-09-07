"use client";

import { Button, FieldError, Label, ListBox, ListBoxItem, Popover, Select, SelectValue, Text, type Key, type SelectProps } from "react-aria-components";

export type SelectOption = { value: string; label: string; description?: string };

export function SelectField({ label, options, description, error, optional, onSelectionChange, ...props }: Omit<SelectProps<object>, "children" | "onSelectionChange"> & { label: string; options: SelectOption[]; description?: string; error?: string; optional?: boolean; onSelectionChange?: (key: Key | null) => void }) {
  return (
    <Select className="field" isInvalid={Boolean(error)} onSelectionChange={onSelectionChange} placeholder="選択してください" {...props}>
      <Label>{label} {optional ? <span className="optional">任意</span> : props.isRequired ? <span className="required">必須</span> : null}</Label>
      {description ? <Text className="field-description" slot="description">{description}</Text> : null}
      <Button className="select-trigger"><SelectValue /><span aria-hidden="true">⌄</span></Button>
      <Popover className="select-popover">
        <ListBox className="select-listbox" items={options}>
          {(item) => <ListBoxItem className="select-option" id={item.value} textValue={item.label}><span>{item.label}</span>{item.description ? <small>{item.description}</small> : null}</ListBoxItem>}
        </ListBox>
      </Popover>
      <FieldError>{error}</FieldError>
    </Select>
  );
}
