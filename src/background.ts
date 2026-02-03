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
