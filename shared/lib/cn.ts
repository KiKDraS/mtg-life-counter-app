import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @description Tailwind class merge utility.
 * Combines `clsx` (conditional class logic) with `tailwind-merge`
 * (conflict resolution for competing Tailwind utilities).
 *
 * @param inputs — class values (strings, objects, arrays) per clsx signature.
 * @returns A single merged class string with Tailwind conflicts resolved.
 *
 * @example
 * cn("px-4 py-2", isActive && "bg-blue-500", "px-6") // → "py-2 bg-blue-500 px-6"
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
