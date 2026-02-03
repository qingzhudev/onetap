import type { PlasmoManifest } from "plasmo"

// Ensure required permissions are included in the generated dev/prod manifests.
export default {
  permissions: ["storage", "tabs", "sidePanel"],
  side_panel: {
    default_path: "sidepanel.html"
  }
} satisfies PlasmoManifest
