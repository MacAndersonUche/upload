import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import DataPreviewTable from "./DataPreviewTable"

// Mock next/navigation's useSearchParams
const mockSearchParams = new URLSearchParams()
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}))

beforeEach(() => {
  // Reset to empty search params before each test
  for (const key of [...mockSearchParams.keys()]) {
    mockSearchParams.delete(key)
  }
})

describe("DataPreviewTable", () => {
  it("shows message when no sessionId in URL", () => {
    render(<DataPreviewTable />)
    expect(
      screen.getByText(/no file to preview/i)
    ).toBeInTheDocument()
  })

  it("fetches and displays preview when sessionId is present", async () => {
    mockSearchParams.set("sessionId", "test-session")

    global.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            sessionId: "test-session",
            preview: {
              columns: ["name", "age"],
              rows: [
                { name: "Alice", age: "30" },
                { name: "Bob", age: "25" },
              ],
              types: { name: "string", age: "number" },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      )
    ) as typeof fetch

    render(<DataPreviewTable />)
    expect(screen.getByText(/loading your data/i)).toBeInTheDocument()

    const summaries = await screen.findAllByText(
      (_, el) => {
        const text = el?.textContent ?? ""
        return text.startsWith("Your file has") && text.includes("2 row") && text.includes("2 column")
      },
      { timeout: 2000 }
    )
    expect(summaries.length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("name").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("age").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })
})
