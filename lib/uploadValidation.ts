export const MAX_FILE_MB = 100
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

export function validateFile(file: File): string | null {
  const name = (file.name || "").toLowerCase()
  const isCsv =
    name.endsWith(".csv") ||
    file.type === "text/csv" ||
    file.type === "application/csv"
  if (!isCsv) return "Please choose a CSV file (e.g. data.csv)."
  if (file.size === 0)
    return "This file is empty. Please choose a file with data."
  if (file.size > MAX_FILE_BYTES)
    return `File is too large. Maximum size is ${MAX_FILE_MB} MB. Please choose a smaller file or split your data.`
  return null
}

/** Map raw error messages to user-friendly, actionable copy. */
export function toUserMessage(raw: string): string {
  if (raw.includes("init failed"))
    return "We couldn't start the upload. Please try again."
  if (raw.includes("chunk") && raw.includes("failed"))
    return "Part of the file didn't upload. You can try again."
  if (raw.includes("finalize"))
    return "Upload didn't finish saving. Please try again."
  if (
    raw.includes("fetch") ||
    raw.includes("network") ||
    raw.includes("Failed to fetch")
  )
    return "Connection problem. Check your internet and try again."
  return "Something went wrong. Please try again."
}
