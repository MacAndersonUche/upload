import { describe, it, expect } from "vitest"
import { parseCsvPreview } from "./csv"

describe("parseCsvPreview", () => {
  it("parses simple CSV with header and rows", () => {
    const csv = "a,b,c\n1,2,3\n4,5,6"
    const out = parseCsvPreview(csv, 10)
    expect(out.columns).toEqual(["a", "b", "c"])
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0]).toEqual({ a: "1", b: "2", c: "3" })
    expect(out.rows[1]).toEqual({ a: "4", b: "5", c: "6" })
    expect(out.types).toEqual({ a: "number", b: "number", c: "number" })
  })

  it("respects maxRows", () => {
    const lines = ["x,y", "1,2", "3,4", "5,6"]
    const csv = lines.join("\n")
    const out = parseCsvPreview(csv, 2)
    expect(out.rows).toHaveLength(2)
    expect(out.rows[0]).toEqual({ x: "1", y: "2" })
    expect(out.rows[1]).toEqual({ x: "3", y: "4" })
  })

  it("handles empty file (header only)", () => {
    const out = parseCsvPreview("name,age\n", 10)
    expect(out.columns).toEqual(["name", "age"])
    expect(out.rows).toHaveLength(0)
    expect(out.types).toEqual({ name: "unknown", age: "unknown" })
  })

  it("infers string type for non-numeric columns", () => {
    const csv = "label,value\nhello,world\nfoo,bar"
    const out = parseCsvPreview(csv, 10)
    expect(out.types).toEqual({ label: "string", value: "string" })
  })

  it("infers boolean type", () => {
    const csv = "flag\ntrue\nfalse\ntrue"
    const out = parseCsvPreview(csv, 10)
    expect(out.types).toEqual({ flag: "boolean" })
  })

  it("handles quoted fields with commas", () => {
    const csv = 'a,b\n"hello, world",2'
    const out = parseCsvPreview(csv, 10)
    expect(out.columns).toEqual(["a", "b"])
    expect(out.rows[0]).toEqual({ a: "hello, world", b: "2" })
  })

  it("handles CRLF line endings", () => {
    const csv = "x,y\r\n1,2\r\n3,4"
    const out = parseCsvPreview(csv, 10)
    expect(out.columns).toEqual(["x", "y"])
    expect(out.rows).toHaveLength(2)
  })
})
