import { Suspense } from "react"
import DataPreviewTable from "@/components/DataPreviewTable"

export default function PreviewPage() {
  return (
    <main>
      <h1 style={{ margin: "8px 0 4px" }}>Preview</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Check that your data looks right: summary, things to watch for, and a preview of the first rows.
      </p>
      <Suspense fallback={<div style={{ padding: 16, color: "#666" }}>Loading your data…</div>}>
        <DataPreviewTable />
      </Suspense>
    </main>
  )
}

