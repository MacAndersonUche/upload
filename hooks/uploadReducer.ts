// Single state model: discriminated union to avoid boolean soup and make transitions explicit.
export type UploadState =
  | { phase: "idle" }
  | {
      phase: "uploading"
      sessionId: string
      totalChunks: number
      uploadedChunkCount: number
    }
  | {
      phase: "finalizing"
      sessionId: string
      totalChunks: number
    }
  | { phase: "done"; sessionId: string }
  | { phase: "error"; message: string }
  | { phase: "canceled" }

export type UploadAction =
  | { type: "START_UPLOAD"; sessionId: string; totalChunks: number }
  | { type: "CHUNK_OK"; uploadedChunkCount: number }
  | { type: "START_FINALIZE" }
  | { type: "DONE" }
  | { type: "FAIL"; message: string }
  | { type: "CANCEL" }
  | { type: "RESET" }

export function uploadReducer(
  state: UploadState,
  action: UploadAction
): UploadState {
  switch (action.type) {
    case "START_UPLOAD":
      return {
        phase: "uploading",
        sessionId: action.sessionId,
        totalChunks: action.totalChunks,
        uploadedChunkCount: 0,
      }
    case "CHUNK_OK":
      if (state.phase !== "uploading") return state
      return { ...state, uploadedChunkCount: action.uploadedChunkCount }
    case "START_FINALIZE":
      if (state.phase !== "uploading") return state
      return {
        phase: "finalizing",
        sessionId: state.sessionId,
        totalChunks: state.totalChunks,
      }
    case "DONE":
      if (state.phase !== "finalizing") return state
      return { phase: "done", sessionId: state.sessionId }
    case "FAIL":
      return { phase: "error", message: action.message }
    case "CANCEL":
      return { phase: "canceled" }
    case "RESET":
      return { phase: "idle" }
    default:
      return state
  }
}
