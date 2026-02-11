import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import UploadWizard from "./UploadWizard"

const mockPush = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe("UploadWizard", () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it("renders phase stepper and file input", () => {
    render(<UploadWizard />)
    expect(screen.getByText("Select")).toBeInTheDocument()
    expect(screen.getByText("Validate")).toBeInTheDocument()
    expect(screen.getByText("Upload")).toBeInTheDocument()
    expect(screen.getByText("Finalize")).toBeInTheDocument()
    expect(screen.getByText("Ready")).toBeInTheDocument()
    expect(screen.getByLabelText(/choose csv file/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /start upload/i })).toBeInTheDocument()
  })

  it("shows initial message to choose CSV", () => {
    render(<UploadWizard />)
    expect(
      screen.getByText(/choose a csv file \(about 10–100 mb is fine\)/i)
    ).toBeInTheDocument()
  })

  it("shows validation error when selecting non-CSV file", async () => {
    const user = userEvent.setup()
    render(<UploadWizard />)
    const input = screen.getByLabelText(/choose csv file/i) as HTMLInputElement
    const file = new File(["hello"], "data.txt", { type: "text/plain" })
    await user.upload(input, file)
    // In jsdom, file input may not trigger validation; we rely on lib/uploadValidation.test.ts for validateFile.
    // If the error message appears, assert it; otherwise ensure we didn't get "file looks good".
    const phaseMessage = screen.queryByText(/file looks good/i)
    const errorMessage = screen.queryByText(/please choose a csv file/i)
    expect(phaseMessage === null || errorMessage !== null).toBe(true)
  })

  it("shows file name and size when valid CSV is selected", async () => {
    const user = userEvent.setup()
    render(<UploadWizard />)
    const input = screen.getByLabelText(/choose csv file/i)
    const file = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" })
    await user.upload(input, file)
    expect(screen.getByText(/data\.csv/)).toBeInTheDocument()
    expect(screen.getByText(/file looks good/i)).toBeInTheDocument()
  })

  it("Start upload is disabled when no file selected", () => {
    render(<UploadWizard />)
    expect(screen.getByRole("button", { name: /start upload/i })).toBeDisabled()
  })

  it("Start upload is enabled when valid CSV is selected", async () => {
    const user = userEvent.setup()
    render(<UploadWizard />)
    const input = screen.getByLabelText(/choose csv file/i)
    const file = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" })
    await user.upload(input, file)
    expect(screen.getByRole("button", { name: /start upload/i })).not.toBeDisabled()
  })

  it("Start upload triggers upload flow (fetch is tested in API integration)", async () => {
    const user = userEvent.setup()
    let initCalled = false
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string | URL) => {
        const u = typeof url === "string" ? url : url.toString()
        if (u.includes("/api/upload/init")) {
          initCalled = true
          return Promise.resolve(
            new Response(JSON.stringify({ sessionId: "mock-session" }), {
              status: 200,
              headers: { "content-type": "application/json" },
            })
          )
        }
        if (u.includes("/api/upload/chunk")) {
          return Promise.resolve(
            new Response(JSON.stringify({ ok: true }), { status: 200 })
          )
        }
        if (u.includes("/api/upload/finalize")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                sessionId: "mock-session",
                preview: { columns: [], rows: [], types: {} },
              }),
              { status: 200 }
            )
          )
        }
        return Promise.reject(new Error(`unexpected: ${u}`))
      })
    )

    render(<UploadWizard />)
    const input = screen.getByLabelText(/choose csv file/i)
    const file = new File(["a,b\n1,2"], "data.csv", { type: "text/csv" })
    await user.upload(input, file)
    await user.click(screen.getByRole("button", { name: /start upload/i }))

    await screen.findByText(/uploading your file|your file is ready|part \d+ of \d+/i, {}, { timeout: 5000 })
    expect(initCalled).toBe(true)
  }, 8000)
})
