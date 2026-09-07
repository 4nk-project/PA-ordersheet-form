"use client";

import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";

export function Button({ className = "", variant = "primary", ...props }: AriaButtonProps & { variant?: "primary" | "secondary" | "danger" | "text" }) {
  return <AriaButton className={`button ${variant} ${className}`.trim()} {...props} />;
}
