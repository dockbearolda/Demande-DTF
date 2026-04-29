export function formatPhoneNumber(input: string): string {
  const cleaned = input.replace(/\D/g, "");

  if (cleaned.startsWith("590")) {
    // Already has +590
    if (cleaned.length <= 3) return `+${cleaned}`;
    if (cleaned.length <= 6) return `+${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
  }

  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)} ${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)}`;
}

export function generateReference(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  // Take 6 chars from the first segment of a UUID (hex, high entropy).
  // Fallback to Math.random for environments without crypto.randomUUID
  // (older Safari, non-secure contexts in dev tools).
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).substring(2);
  const random = uuid.slice(0, 6).toUpperCase();
  return `CMD-${timestamp}-${random}`;
}
