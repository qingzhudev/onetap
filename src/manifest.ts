import type { PlasmoManifest } from "plasmo"

// Ensure required permissions are included in the generated dev/prod manifests.
export default {
  permissions: ["storage", "tabs"]
} satisfies PlasmoManifest
