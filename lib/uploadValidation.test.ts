import { describe, it, expect } from "vitest"
import {
  validateFile,
  toUserMessage,
  MAX_FILE_MB,
} from "./uploadValidation"

function makeFile(overrides: Partial<{ name: string; size: number; type: string }> = {}): File {
  const opts = {
    name: "data.csv",
    size: 1024,
    type: "text/csv",
    ...overrides,
  }
  return new File([new Uint8Array(opts.size)], opts.name, {
    type: opts.type,
  })
}

describe("validateFile", () => {
  it("returns null for valid CSV file", () => {
    expect(validateFile(makeFile())).toBeNull()
    expect(validateFile(makeFile({ name: "export.CSV" }))).toBeNull()
    expect(validateFile(makeFile({ type: "application/csv" }))).toBeNull()
  })

  it("rejects non-CSV extension", () => {
    const msg = validateFile(
      makeFile({ name: "data.txt", type: "text/plain" })
    )
    expect(msg).toBeTruthy()
    expect(msg).toContain("CSV")
  })

  it("rejects empty file", () => {
    const msg = validateFile(makeFile({ size: 0 }))
    expect(msg).toContain("empty")
  })

  it("rejects file over max size", () => {
    const msg = validateFile(
      makeFile({ size: (MAX_FILE_MB + 1) * 1024 * 1024 })
    )
    expect(msg).toContain("too large")
    expect(msg).toContain(String(MAX_FILE_MB))
  })

  it("accepts file at exactly max size", () => {
    expect(
      validateFile(makeFile({ size: MAX_FILE_MB * 1024 * 1024 }))
    ).toBeNull()
  })
})

describe("toUserMessage", () => {
  it("maps init errors", () => {
    expect(toUserMessage("init failed (500)")).toBe(
      "We couldn't start the upload. Please try again."
    )
  })

  it("maps chunk errors", () => {
    expect(toUserMessage("chunk 2 failed (500)")).toBe(
      "Part of the file didn't upload. You can try again."
    )
  })

  it("maps finalize errors", () => {
    expect(toUserMessage("finalize failed (400)")).toBe(
      "Upload didn't finish saving. Please try again."
    )
  })

  it("maps network/fetch errors", () => {
    expect(toUserMessage("Failed to fetch")).toBe(
      "Connection problem. Check your internet and try again."
    )
    expect(toUserMessage("network error")).toBe(
      "Connection problem. Check your internet and try again."
    )
  })

  it("returns generic message for unknown errors", () => {
    expect(toUserMessage("something random")).toBe(
      "Something went wrong. Please try again."
    )
  })
})
