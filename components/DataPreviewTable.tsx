"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import type { PreviewResponse } from "@/lib/types"

const FRIENDLY_TYPE: Record<string, string> = {
  number: "Number",
  string: "Text",
  boolean: "Yes/No",
  unknown: "Mixed or empty",
}

const PREVIEW_ROW_CAP = 50
const COLUMNS_PEEK = 12 // show this many column names before "and N more"
const STICKY_COLUMNS = 1 // first column(s) sticky when scrolling horizontally

function deriveIssues(
  columns: string[],
  rows: Array<Record<string, string>>,
  types: Record<string, string>
): { message: string; severity: "info" | "warning" }[] {
  const issues: { message: string; severity: "info" | "warning" }[] = []
  const seen = new Map<string, number>()
  columns.forEach((c, i) => {
    const prev = seen.get(c)
    if (prev !== undefined) issues.push({ message: `Column "${c}" appears more than once (column ${prev + 1} and ${i + 1}).`, severity: "warning" })
    else seen.set(c, i)
  })

  const emptyColumns = columns.filter((col) => {
    const values = rows.map((r) => r[col])
    return values.every((v) => v == null || String(v).trim() === "")
  })
  if (emptyColumns.length > 0) {
    const list = emptyColumns.length <= 3 ? emptyColumns.join(", ") : `${emptyColumns.slice(0, 2).join(", ")} and ${emptyColumns.length - 2} more`
    issues.push({
      message: `In this preview, these columns have no data: ${list}. Check if that's expected.`,
      severity: "info",
    })
  }

  const unknownTypeCols = columns.filter((c) => (types[c] ?? "unknown") === "unknown")
  if (unknownTypeCols.length > 0 && rows.length > 0) {
    issues.push({
      message: `${unknownTypeCols.length} column(s) look like text or mixed values. You can still use them; we're just noting the type.`,
      severity: "info",
    })
  }

  return issues
}

export default function DataPreviewTable() {
  const [data, setData] = useState<PreviewResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const searchParams = useSearchParams()
  const sessionId = searchParams.get("sessionId")

  useEffect(() => {
    if (!sessionId) return
    ;(async () => {
      setError(null)
      setData(null)
      const res = await fetch(`/api/upload/finalize?sessionId=${encodeURIComponent(sessionId)}`, { method: "GET" })
      if (!res.ok) {
        setError("We couldn't load your file. Try uploading again or use the link from the upload page.")
        return
      }
      const json = (await res.json()) as PreviewResponse
      setData(json)
    })()
  }, [sessionId])

  const issues = useMemo(
    () =>
      data?.preview
        ? deriveIssues(data.preview.columns, data.preview.rows, data.preview.types)
        : [],
    [data]
  )

  if (!sessionId) {
    return (
      <div style={{ padding: 16, background: "#f8f9fa", borderRadius: 8, color: "#444" }}>
        No file to preview. Upload a file first, then use &quot;View your data&quot; on the upload page.
      </div>
    )
  }
  if (error) {
    return (
      <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, color: "#b00020" }}>
        {error}
      </div>
    )
  }
  if (!data) {
    return (
      <div style={{ padding: 16, color: "#666" }}>
        Loading your data…
      </div>
    )
  }

  const { columns, types, rows } = data.preview
  const isWide = columns.length > 15
  const displayRows = rows.slice(0, PREVIEW_ROW_CAP)
  const showColumnsPeek = columns.length > COLUMNS_PEEK
  const columnsToShowInList = showColumnsPeek ? columns.slice(0, COLUMNS_PEEK) : columns
  const moreColumnsCount = columns.length - columnsToShowInList.length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Summary */}
      <div style={{ fontSize: 15, color: "#333" }}>
        Your file has <strong>{rows.length}</strong> row{rows.length !== 1 ? "s" : ""} and <strong>{columns.length}</strong> column{columns.length !== 1 ? "s" : ""}.
        {isWide && " Scroll the table to the right to see all columns."}
      </div>

      {/* Schema / data issues */}
      {issues.length > 0 && (
        <div
          style={{
            padding: 14,
            borderRadius: 8,
            background: issues.some((i) => i.severity === "warning") ? "#fef3c7" : "#f0f9ff",
            border: `1px solid ${issues.some((i) => i.severity === "warning") ? "#f59e0b" : "#bae6fd"}`,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 14 }}>Things to check</div>
          <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#333", lineHeight: 1.6 }}>
            {issues.map((issue, i) => (
              <li key={i}>{issue.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Column list */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>What&apos;s in your file</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            maxHeight: isWide ? 120 : "none",
            overflowY: "auto",
          }}
        >
          {columnsToShowInList.map((c) => (
            <span
              key={`${c}-${columns.indexOf(c)}`}
              style={{
                padding: "5px 10px",
                borderRadius: 6,
                background: "#f3f4f6",
                fontSize: 12,
              }}
            >
              <span style={{ fontWeight: 500 }}>{c}</span>
              <span style={{ color: "#6b7280", marginLeft: 6 }}>{FRIENDLY_TYPE[types[c] ?? "unknown"] ?? "Text"}</span>
            </span>
          ))}
          {showColumnsPeek && (
            <span style={{ padding: "5px 10px", fontSize: 12, color: "#6b7280" }}>
              … and {moreColumnsCount} more (see table below)
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
          First {displayRows.length} row{displayRows.length !== 1 ? "s" : ""} (preview)
        </div>
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400, borderRadius: 8, border: "1px solid #eee" }}>
          <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 13 }}>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={`${c}-${i}`}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "2px solid #e5e7eb",
                      whiteSpace: "nowrap",
                      background: "#f9fafb",
                      position: i < STICKY_COLUMNS ? "sticky" : undefined,
                      left: i < STICKY_COLUMNS ? (i * 140) : undefined,
                      zIndex: i < STICKY_COLUMNS ? 2 : 1,
                      boxShadow: i === STICKY_COLUMNS - 1 && columns.length > STICKY_COLUMNS ? "4px 0 8px -2px rgba(0,0,0,.06)" : undefined,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r, idx) => (
                <tr key={idx}>
                  {columns.map((c, i) => (
                    <td
                      key={c}
                      style={{
                        padding: "8px 12px",
                        borderBottom: "1px solid #f3f4f6",
                        whiteSpace: "nowrap",
                        maxWidth: 280,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        position: i < STICKY_COLUMNS ? "sticky" : undefined,
                        left: i < STICKY_COLUMNS ? (i * 140) : undefined,
                        zIndex: i < STICKY_COLUMNS ? 1 : 0,
                        background: i < STICKY_COLUMNS ? "#fff" : undefined,
                        boxShadow: i === STICKY_COLUMNS - 1 && columns.length > STICKY_COLUMNS ? "4px 0 8px -2px rgba(0,0,0,.04)" : undefined,
                      }}
                      title={String(r[c] ?? "")}
                    >
                      {String(r[c] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PREVIEW_ROW_CAP && (
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12, color: "#6b7280" }}>
            Showing the first {PREVIEW_ROW_CAP} of {rows.length} rows.
          </p>
        )}
        {isWide && (
          <p style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: "#6b7280" }}>
            Scroll right to see all {columns.length} columns. The first column stays visible.
          </p>
        )}
      </div>
    </div>
  )
}
