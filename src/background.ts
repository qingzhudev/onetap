type SidePanelApi = {
  setPanelBehavior?: (options: {
    openPanelOnActionClick: boolean
  }) => Promise<void> | void
}

const getSidePanel = (): SidePanelApi | undefined => {
  return (chrome as typeof chrome & { sidePanel?: SidePanelApi }).sidePanel
}

const ensurePanelBehavior = async () => {
  const sidePanel = getSidePanel()
  if (sidePanel?.setPanelBehavior) {
    await sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void ensurePanelBehavior()
})

chrome.runtime.onStartup.addListener(() => {
  void ensurePanelBehavior()
})

// Relay tab events to sidepanel
chrome.tabs.onActivated.addListener((activeInfo) => {
  console.log("[OneTap Background] Tab activated:", activeInfo)
  chrome.runtime.sendMessage({
    type: "TAB_ACTIVATED",
    activeInfo
  }).catch(() => {
    // Sidepanel may not be open, which is fine
  })
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only notify for significant changes
  if (changeInfo.status === "complete" || changeInfo.url) {
    console.log("[OneTap Background] Tab updated:", { tabId, changeInfo, url: tab.url })
    chrome.runtime.sendMessage({
      type: "TAB_UPDATED",
      tabId,
      changeInfo,
      url: tab.url,
      status: tab.status,
      windowId: tab.windowId
    }).catch(() => {
      // Sidepanel may not be open, which is fine
    })
  }
})

// Handle sidepanel close request
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CLOSE_SIDEPANEL") {
    const { windowId } = message
    if (windowId && chrome.sidePanel) {
      const sidePanel = chrome.sidePanel as typeof chrome.sidePanel & {
        close: (options: { windowId: number }) => Promise<void>
      }
      if (typeof sidePanel.close === "function") {
        sidePanel.close({ windowId })
          .then(() => sendResponse({ success: true }))
          .catch((error) => {
            console.error("[OneTap Background] Failed to close sidepanel:", error)
            sendResponse({ success: false, error: error?.message })
          })
      } else {
        sendResponse({ success: false, error: "sidePanel.close not available" })
      }
    } else {
      sendResponse({ success: false, error: "Invalid windowId or sidePanel not available" })
    }
    return true // Keep message channel open for async response
  }
})
