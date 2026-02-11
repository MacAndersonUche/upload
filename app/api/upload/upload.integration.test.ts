/**
 * @vitest-environment node
 * Integration tests for upload API: init -> chunk -> finalize (and GET preview).
 * Uses a temp dir via UPLOAD_DATA_DIR so we don't touch real .data.
 */
import path from "path"
import fs from "fs"
import { describe, it, expect, beforeAll, afterAll } from "vitest"

const tmpDir = path.join(process.cwd(), ".tmp-upload-test")
const dataDir = path.join(tmpDir, ".data")

let initPost: (req: Request) => Promise<Response>
let chunkPost: (req: Request) => Promise<Response>
let finalizePost: (req: Request) => Promise<Response>
let finalizeGet: (req: Request) => Promise<Response>

beforeAll(async () => {
  process.env.UPLOAD_DATA_DIR = dataDir
  fs.mkdirSync(dataDir, { recursive: true })

  const init = await import("./init/route")
  const chunk = await import("./chunk/route")
  const finalize = await import("./finalize/route")
  initPost = init.POST
  chunkPost = chunk.POST
  finalizePost = finalize.POST
  finalizeGet = finalize.GET
})

afterAll(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true })
  } catch {
    // ignore
  }
  delete process.env.UPLOAD_DATA_DIR
})

describe("upload API integration", () => {
  it("init returns a sessionId", async () => {
    const res = await initPost(
      new Request("http://localhost/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: "test.csv", size: 100 }),
      })
    )
    expect(res.status).toBe(200)
    const json = (await res.json()) as { sessionId: string }
    expect(json.sessionId).toBeDefined()
    expect(typeof json.sessionId).toBe("string")
  })

  it("chunk rejects missing headers", async () => {
    const res = await chunkPost(
      new Request("http://localhost/api/upload/chunk", {
        method: "POST",
        body: new ArrayBuffer(0),
      })
    )
    expect(res.status).toBe(400)
  })

  it("full flow: init -> chunk(s) -> finalize -> GET preview", async () => {
    const initRes = await initPost(
      new Request("http://localhost/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: "sample.csv", size: 50 }),
      })
    )
    expect(initRes.status).toBe(200)
    const { sessionId } = (await initRes.json()) as { sessionId: string }

    const csvContent = "name,age\nAlice,30\nBob,25"
    const buf = Buffer.from(csvContent, "utf8")

    const chunkRes = await chunkPost(
      new Request("http://localhost/api/upload/chunk", {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "x-session-id": sessionId,
          "x-chunk-index": "0",
          "x-total-chunks": "1",
        },
        body: buf,
      })
    )
    expect(chunkRes.status).toBe(200)

    const finRes = await finalizePost(
      new Request("http://localhost/api/upload/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      })
    )
    expect(finRes.status).toBe(200)
    const finJson = (await finRes.json()) as {
      sessionId: string
      preview: { columns: string[]; rows: Record<string, string>[]; types: Record<string, string> }
    }
    expect(finJson.sessionId).toBe(sessionId)
    expect(finJson.preview.columns).toEqual(["name", "age"])
    expect(finJson.preview.rows).toHaveLength(2)
    expect(finJson.preview.rows[0]).toEqual({ name: "Alice", age: "30" })
    expect(finJson.preview.rows[1]).toEqual({ name: "Bob", age: "25" })

    const getRes = await finalizeGet(
      new Request(`http://localhost/api/upload/finalize?sessionId=${encodeURIComponent(sessionId)}`, {
        method: "GET",
      })
    )
    expect(getRes.status).toBe(200)
    const getJson = (await getRes.json()) as { sessionId: string; preview: unknown }
    expect(getJson.sessionId).toBe(sessionId)
    expect(getJson.preview).toBeDefined()
  })

  it("finalize POST without sessionId returns 400", async () => {
    const res = await finalizePost(
      new Request("http://localhost/api/upload/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      })
    )
    expect(res.status).toBe(400)
  })

  it("finalize GET without sessionId returns 400", async () => {
    const res = await finalizeGet(
      new Request("http://localhost/api/upload/finalize", { method: "GET" })
    )
    expect(res.status).toBe(400)
  })
})
