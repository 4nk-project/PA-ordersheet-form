"use client";

import { Checkbox, type CheckboxProps } from "react-aria-components";

export function CheckboxField({ children, ...props }: Omit<CheckboxProps, "children"> & { children: React.ReactNode }) {
  return <Checkbox className="checkbox-field" {...props}><span className="checkbox-box" aria-hidden="true">✓</span><span>{children}</span></Checkbox>;
}
