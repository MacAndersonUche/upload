"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { useChunkedUpload } from "@/hooks/useChunkedUpload"

const PHASES = ["Select", "Validate", "Upload", "Finalize", "Ready"] as const
const MAX_FILE_MB = 100
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024

function formatBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let x = n
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024
    i++
  }
  return `${x.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function validateFile(file: File): string | null {
  const name = (file.name || "").toLowerCase()
  const isCsv = name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/csv"
  if (!isCsv) return "Please choose a CSV file (e.g. data.csv)."
  if (file.size === 0) return "This file is empty. Please choose a file with data."
  if (file.size > MAX_FILE_BYTES) return `File is too large. Maximum size is ${MAX_FILE_MB} MB. Please choose a smaller file or split your data.`
  return null
}

/** Map raw error messages to user-friendly, actionable copy. */
function toUserMessage(raw: string): string {
  if (raw.includes("init failed")) return "We couldn't start the upload. Please try again."
  if (raw.includes("chunk") && raw.includes("failed")) return "Part of the file didn't upload. You can try again."
  if (raw.includes("finalize")) return "Upload didn't finish saving. Please try again."
  if (raw.includes("fetch") || raw.includes("network") || raw.includes("Failed to fetch")) return "Connection problem. Check your internet and try again."
  return "Something went wrong. Please try again."
}

export default function UploadWizard() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const {
    status,
    progress,
    error,
    start,
    cancel,
    reset,
    sessionId,
    totalChunks,
    uploadedChunkCount,
  } = useChunkedUpload()

  const canStart =
    !!file &&
    (status === "idle" || status === "error" || status === "canceled" || status === "done")
  const isBusy = status === "uploading" || status === "finalizing"
  const isReady = status === "done" && !!sessionId

  const fileInfo = useMemo(() => {
    if (!file) return null
    return { name: file.name, size: formatBytes(file.size) }
  }, [file])

  const currentPhaseIndex = (() => {
    if (status === "done") return 4
    if (status === "finalizing") return 3
    if (status === "uploading") return 2
    if (file && (status === "idle" || status === "error" || status === "canceled")) return 1
    return 0
  })()

  const phaseMessage = (() => {
    if (status === "uploading" && totalChunks > 0)
      return `Uploading your file… part ${uploadedChunkCount} of ${totalChunks}`
    if (status === "finalizing") return "Almost done — saving your file…"
    if (status === "done") return "Your file is ready."
    if (file && !validationError && status !== "error") return "File looks good. Click Start upload when ready."
    if (file && validationError) return validationError
    if (status === "error" && error) return toUserMessage(error)
    if (status === "canceled") return "Upload was cancelled."
    return "Choose a CSV file (about 10–100 MB is fine)."
  })()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.files?.[0] ?? null
    setFile(next)
    setValidationError(null)
    if (next) {
      const err = validateFile(next)
      setValidationError(err)
    }
  }

  const handleStart = () => {
    if (!file) return
    const err = validateFile(file)
    if (err) {
      setValidationError(err)
      return
    }
    setValidationError(null)
    start(file)
  }

  const handleReset = () => {
    reset()
    setFile(null)
    setValidationError(null)
  }

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 24, maxWidth: 520 }}>
      {/* Phase stepper */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 24,
          fontSize: 12,
          color: "#666",
        }}
      >
        {PHASES.map((phase, i) => (
          <span
            key={phase}
            style={{
              fontWeight: i === currentPhaseIndex ? 600 : 400,
              color: i <= currentPhaseIndex ? "#111" : "#999",
            }}
          >
            {phase}
          </span>
        ))}
      </div>

      {/* Select / file info */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={isBusy}
          onChange={handleFileChange}
          aria-label="Choose CSV file"
        />
        {fileInfo && (
          <span style={{ color: "#444" }}>
            {fileInfo.name} · {fileInfo.size}
          </span>
        )}
      </div>

      {/* Main message */}
      <p
        style={{
          marginTop: 16,
          marginBottom: 0,
          fontSize: 14,
          color: status === "error" ? "#b00020" : "#333",
          minHeight: 20,
        }}
      >
        {phaseMessage}
      </p>

      {/* Progress bar (only during upload/finalize) */}
      {(status === "uploading" || status === "finalizing") && (
        <>
          <div
            style={{
              marginTop: 12,
              background: "#eee",
              borderRadius: 999,
              height: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: "100%",
                background: "#111",
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "#666" }}>
            {status === "finalizing"
              ? "Saving…"
              : totalChunks > 0
                ? `${uploadedChunkCount} of ${totalChunks} parts uploaded`
                : null}
          </p>
        </>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 20 }}>
        <button
          onClick={handleStart}
          disabled={!canStart || !!validationError || isBusy}
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            fontWeight: 600,
            background: "#111",
            color: "#fff",
            border: "none",
            cursor: canStart && !validationError && !isBusy ? "pointer" : "not-allowed",
          }}
        >
          Start upload
        </button>

        {isBusy && (
          <button
            onClick={() => cancel()}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "#fff",
              color: "#333",
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}

        {(status === "error" || status === "canceled" || status === "done") && (
          <button
            onClick={handleReset}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              background: "#fff",
              color: "#333",
              border: "1px solid #ccc",
              cursor: "pointer",
            }}
          >
            {status === "done" ? "Upload another file" : "Start over"}
          </button>
        )}

        {isReady && (
          <button
            onClick={() => router.push(`/preview?sessionId=${encodeURIComponent(sessionId ?? "")}`)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              fontWeight: 600,
              background: "#0d6efd",
              color: "#fff",
              border: "none",
              cursor: "pointer",
            }}
          >
            View your data
          </button>
        )}
      </div>

      {/* Error block: only show after a real upload error, with retry emphasis */}
      {status === "error" && error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: "#fef2f2",
            borderRadius: 8,
            fontSize: 13,
            color: "#b00020",
          }}
        >
          <strong>What you can do:</strong> Use &quot;Start upload&quot; again to retry, or choose a different file and try again.
        </div>
      )}
    </div>
  )
}
