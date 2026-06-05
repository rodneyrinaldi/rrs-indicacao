"use client";

import { useState } from "react";
import { formatPhone } from "@/lib/phone";

type PhoneInputProps = Omit<React.ComponentPropsWithoutRef<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  defaultValue?: string;
};

export function PhoneInput({ defaultValue = "", ...props }: PhoneInputProps) {
  const [value, setValue] = useState(() => formatPhone(defaultValue));

  return (
    <input
      {...props}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      value={value}
      onChange={(event) => setValue(formatPhone(event.target.value))}
    />
  );
}