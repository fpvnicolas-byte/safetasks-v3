import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Responsive Typography Utilities
export const responsiveText = {
  h1: "text-2xl sm:text-3xl lg:text-4xl",
  h2: "text-xl sm:text-2xl lg:text-3xl", 
  h3: "text-lg sm:text-xl lg:text-2xl",
  body: "text-sm sm:text-base lg:text-lg",
  caption: "text-xs sm:text-sm lg:text-base"
}

// Touch Target Optimization
export const touchTarget = "min-h-[44px] min-w-[44px] p-3"

// Responsive Spacing Utilities
export const responsiveSpacing = {
  padding: "p-3 sm:p-4 lg:p-6",
  margin: "m-2 sm:m-3 lg:m-4",
  gap: "gap-2 sm:gap-3 lg:gap-4"
}
