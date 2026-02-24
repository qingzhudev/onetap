// Ensure required permissions are included in the generated dev/prod manifests.
export default {
  permissions: ["storage", "tabs", "sidePanel", "scripting"],
  host_permissions: ["<all_urls>"],
  side_panel: {
    default_path: "sidepanel.html"
  }
}
