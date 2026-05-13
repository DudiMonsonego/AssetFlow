import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind classes without conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a date string to a human-readable format. */
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

/** Formats a currency value. */
export function formatCurrency(
  amount: number | null | undefined,
  currency = "USD"
): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

/** Returns true if a warranty expiry date is within 30 days or already expired. */
export function isWarrantyExpiringSoon(warrantyExpiry: string | null): boolean {
  if (!warrantyExpiry) return false;
  const expiry = new Date(warrantyExpiry);
  const today = new Date();
  const daysUntilExpiry = Math.ceil(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysUntilExpiry <= 30;
}

/** Returns true if a warranty date has already passed. */
export function isWarrantyExpired(warrantyExpiry: string | null): boolean {
  if (!warrantyExpiry) return false;
  return new Date(warrantyExpiry) < new Date();
}
