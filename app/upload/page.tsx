import UploadWizard from "@/components/UploadWizard"

export default function UploadPage() {
  return (
    <main>
      <h1 style={{ margin: "8px 0 4px" }}>Upload</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Upload a CSV file (up to 100 MB). We’ll guide you through each step.
      </p>
      <UploadWizard />
    </main>
  )
}

