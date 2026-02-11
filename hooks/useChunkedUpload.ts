"use client"

import { useCallback, useReducer, useRef } from "react"
import type { UploadInitResponse } from "@/lib/types"
import {
  type UploadState,
  uploadReducer,
} from "@/hooks/uploadReducer"

const DEFAULT_CHUNK_BYTES = 1024 * 1024 // 1MB
const CHUNK_RETRY_ATTEMPTS = 3
const CHUNK_RETRY_DELAY_MS = 1000

export type { UploadState } from "@/hooks/uploadReducer"

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function useChunkedUpload() {
  const [state, dispatch] = useReducer(uploadReducer, { phase: "idle" } as UploadState)
  const abortRef = useRef<AbortController | null>(null)
  const runningRef = useRef(false)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: "RESET" })
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    dispatch({ type: "CANCEL" })
  }, [])

  const start = useCallback(async (file: File) => {
    if (runningRef.current) return
    runningRef.current = true
    const abort = new AbortController()
    abortRef.current = abort
    const signal = abort.signal

    const isAborted = () => signal.aborted

    try {
      const initRes = await fetch("/api/upload/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, size: file.size }),
        signal,
      })
      if (!initRes.ok) throw new Error(`init failed (${initRes.status})`)
      const initJson = (await initRes.json()) as UploadInitResponse
      const sessionId = initJson.sessionId
      localStorage.setItem("lastSessionId", sessionId)

      const chunkSize = DEFAULT_CHUNK_BYTES
      const totalChunks = Math.ceil(file.size / chunkSize)
      dispatch({ type: "START_UPLOAD", sessionId, totalChunks })

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (isAborted()) return

        let lastError: Error | null = null
        for (let attempt = 1; attempt <= CHUNK_RETRY_ATTEMPTS; attempt++) {
          if (isAborted()) return
          try {
            const startByte = chunkIndex * chunkSize
            const endByte = Math.min(startByte + chunkSize, file.size)
            const blob = file.slice(startByte, endByte)
            const buf = await blob.arrayBuffer()

            const chunkRes = await fetch("/api/upload/chunk", {
              method: "POST",
              headers: {
                "content-type": "application/octet-stream",
                "x-session-id": sessionId,
                "x-chunk-index": String(chunkIndex),
                "x-total-chunks": String(totalChunks),
              },
              body: buf,
              signal,
            })
            if (!chunkRes.ok) throw new Error(`chunk ${chunkIndex} failed (${chunkRes.status})`)
            lastError = null
            break
          } catch (e: unknown) {
            lastError = e instanceof Error ? e : new Error(String(e))
            if ((e as { name?: string })?.name === "AbortError") return
            if (attempt < CHUNK_RETRY_ATTEMPTS) await sleep(CHUNK_RETRY_DELAY_MS)
          }
        }

        if (lastError) {
          const message =
            lastError.message ||
            `Part ${chunkIndex + 1} of ${totalChunks} failed after ${CHUNK_RETRY_ATTEMPTS} tries.`
          runningRef.current = false
          if (abortRef.current === abort) abortRef.current = null
          dispatch({ type: "FAIL", message })
          return
        }

        if (isAborted()) return
        dispatch({ type: "CHUNK_OK", uploadedChunkCount: chunkIndex + 1 })
      }

      if (isAborted()) return
      dispatch({ type: "START_FINALIZE" })

      const finRes = await fetch("/api/upload/finalize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
        signal,
      })
      if (!finRes.ok) throw new Error(`finalize failed (${finRes.status})`)

      if (isAborted()) return
      dispatch({ type: "DONE" })
    } catch (e: unknown) {
      if ((e as { name?: string })?.name === "AbortError") return
      const message = e instanceof Error ? e.message : "Upload failed"
      dispatch({ type: "FAIL", message })
    } finally {
      runningRef.current = false
      if (abortRef.current === abort) abortRef.current = null
    }
  }, [])

  const status =
    state.phase === "idle"
      ? "idle"
      : state.phase === "uploading"
        ? "uploading"
        : state.phase === "finalizing"
          ? "finalizing"
          : state.phase === "done"
            ? "done"
            : state.phase === "error"
              ? "error"
              : "canceled"

  const progress =
    state.phase === "uploading"
      ? state.totalChunks > 0
        ? state.uploadedChunkCount / state.totalChunks
        : 0
      : state.phase === "finalizing"
        ? 1
        : 0

  const error = state.phase === "error" ? state.message : null
  const sessionId =
    state.phase === "uploading" || state.phase === "finalizing" || state.phase === "done"
      ? state.sessionId
      : null
  const totalChunks =
    state.phase === "uploading" || state.phase === "finalizing" ? state.totalChunks : 0
  const uploadedChunkCount =
    state.phase === "uploading" ? state.uploadedChunkCount : state.phase === "finalizing" ? state.totalChunks : 0

  return {
    state,
    status,
    progress,
    error,
    start,
    cancel,
    reset,
    sessionId,
    totalChunks,
    uploadedChunkCount,
  }
}
