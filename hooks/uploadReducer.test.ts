import { describe, it, expect } from "vitest"
import { uploadReducer, type UploadState, type UploadAction } from "./uploadReducer"

const idle: UploadState = { phase: "idle" }

describe("uploadReducer", () => {
  it("START_UPLOAD transitions idle -> uploading with sessionId and totalChunks", () => {
    const next = uploadReducer(idle, {
      type: "START_UPLOAD",
      sessionId: "s1",
      totalChunks: 5,
    })
    expect(next).toEqual({
      phase: "uploading",
      sessionId: "s1",
      totalChunks: 5,
      uploadedChunkCount: 0,
    })
  })

  it("CHUNK_OK only applies when phase is uploading and updates count", () => {
    const uploading: UploadState = {
      phase: "uploading",
      sessionId: "s1",
      totalChunks: 3,
      uploadedChunkCount: 1,
    }
    const next = uploadReducer(uploading, {
      type: "CHUNK_OK",
      uploadedChunkCount: 2,
    })
    expect(next.phase).toBe("uploading")
    expect((next as { uploadedChunkCount: number }).uploadedChunkCount).toBe(2)
  })

  it("CHUNK_OK is no-op when not in uploading", () => {
    const next = uploadReducer(idle, {
      type: "CHUNK_OK",
      uploadedChunkCount: 1,
    })
    expect(next).toEqual(idle)
  })

  it("START_FINALIZE transitions uploading -> finalizing", () => {
    const uploading: UploadState = {
      phase: "uploading",
      sessionId: "s1",
      totalChunks: 2,
      uploadedChunkCount: 2,
    }
    const next = uploadReducer(uploading, { type: "START_FINALIZE" })
    expect(next).toEqual({
      phase: "finalizing",
      sessionId: "s1",
      totalChunks: 2,
    })
  })

  it("START_FINALIZE is no-op when not uploading", () => {
    expect(uploadReducer(idle, { type: "START_FINALIZE" })).toEqual(idle)
  })

  it("DONE transitions finalizing -> done", () => {
    const finalizing: UploadState = {
      phase: "finalizing",
      sessionId: "s1",
      totalChunks: 2,
    }
    const next = uploadReducer(finalizing, { type: "DONE" })
    expect(next).toEqual({ phase: "done", sessionId: "s1" })
  })

  it("DONE is no-op when not finalizing", () => {
    expect(uploadReducer(idle, { type: "DONE" })).toEqual(idle)
  })

  it("FAIL transitions any state -> error with message", () => {
    expect(
      uploadReducer(idle, { type: "FAIL", message: "network error" })
    ).toEqual({ phase: "error", message: "network error" })
    const uploading: UploadState = {
      phase: "uploading",
      sessionId: "s1",
      totalChunks: 1,
      uploadedChunkCount: 0,
    }
    expect(
      uploadReducer(uploading, { type: "FAIL", message: "chunk failed" })
    ).toEqual({ phase: "error", message: "chunk failed" })
  })

  it("CANCEL transitions to canceled", () => {
    expect(uploadReducer(idle, { type: "CANCEL" })).toEqual({
      phase: "canceled",
    })
  })

  it("RESET transitions any state -> idle", () => {
    expect(
      uploadReducer(
        { phase: "error", message: "x" },
        { type: "RESET" }
      )
    ).toEqual(idle)
    expect(
      uploadReducer({ phase: "done", sessionId: "s1" }, { type: "RESET" })
    ).toEqual(idle)
  })
})
