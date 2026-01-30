import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-background/70 px-3 py-2 text-base shadow-sm transition-[color,box-shadow,transform] outline-none focus-visible:ring-[3px] focus-visible:shadow-md disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
