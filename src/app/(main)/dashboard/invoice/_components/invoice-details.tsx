import { Hash } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

import { DatePicker } from "@/components/date-picker";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";

import type { InvoiceFormValues } from "./data";

const dateFields: Array<{
  id: string;
  label: string;
  name: "issuedDate" | "paymentDueDate";
}> = [
  {
    id: "issued-date",
    label: "Issued Date",
    name: "issuedDate",
  },
  {
    id: "payment-due-date",
    label: "Due Date",
    name: "paymentDueDate",
  },
];

export function InvoiceDetails() {
  const { control, register } = useFormContext<InvoiceFormValues>();

  return (
    <section className="flex flex-col gap-3">
      <FieldGroup>
        <Field className="gap-1">
          <FieldLabel className="text-xs" htmlFor="reference-number">
            Reference Number
          </FieldLabel>
          <InputGroup>
            <InputGroupInput id="reference-number" {...register("referenceNumber")} />
            <InputGroupAddon align="inline-end">
              <Hash />
            </InputGroupAddon>
          </InputGroup>
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          {dateFields.map((dateField) => (
            <Controller
              key={dateField.name}
              control={control}
              name={dateField.name}
              render={({ field }) => (
                <Field className="gap-1">
                  <FieldLabel className="text-xs" htmlFor={dateField.id}>
                    {dateField.label}
                  </FieldLabel>
                  <DatePicker id={dateField.id} value={field.value} onChange={field.onChange} />
                </Field>
              )}
            />
          ))}
        </div>
      </FieldGroup>
    </section>
  );
}
