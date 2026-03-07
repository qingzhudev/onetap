import { useEffect, useMemo, useRef, useState } from "react"
import { Globe, FileText, Settings } from "lucide-react"

import {
  buildServiceUrl,
  getOrderedGroups,
  getUngroupedServices
} from "~lib/config"
import { UNGROUPED_ID } from "~lib/constants"
import { extractDomainFromText, queryActiveTab, queryActiveTabUrl, getRootDomain } from "~lib/domain"
import { t } from "~lib/i18n"
import { openTab, openTabsInOrder } from "~lib/open"
import { getConfig, subscribeConfig, addDomainToHistory, addKeywordToHistory } from "~lib/storage"
import { incrementUsageStats } from "~lib/stats"
import { useToast } from "~lib/toast"
import type {
  AnalysisService,
  OperationMode,
  ServiceGroup,
  UserConfig
} from "~lib/types"
import "~styles/popup.css"

const SidePanel = () => {
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const [mode, setMode] = useState<OperationMode>("domain")
  const [textInput, setTextInput] = useState("")
  const [isSelecting, setIsSelecting] = useState(false)
  const { toasts, notify } = useToast()

  // Use ref to track last selection without causing re-renders
  const lastSelectionRef = useRef<string | null>(null)

  const textValue = textInput.trim()

  /**
   * Detect text selection and intelligently set mode based on content type
   * - If selection is a domain/URL, use domain mode with extracted domain
   * - If selection is plain text, use text mode
   * - If no selection, use domain mode with current tab's domain
   */
  const detectSelectionAndSetMode = async () => {
    const selection = await fetchSelectedText()
    const trimmedSelection = selection?.trim() || null

    if (!trimmedSelection) {
      // No selection - use domain mode
      setMode("domain")
      setTextInput("")
      lastSelectionRef.current = null
      return
    }

    lastSelectionRef.current = trimmedSelection

    // Check if selection looks like a domain/URL
    const extractedDomain = extractDomainFromText(trimmedSelection)
    if (extractedDomain) {
      // Selection is a domain/URL - use domain mode with this domain
      setDomain(extractedDomain)
      setMode("domain")
      setTextInput(extractedDomain)
    } else {
      // Selection is plain text - use text mode
      setMode("text")
      setTextInput(trimmedSelection)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    let isMounted = true

    const load = async () => {
      const [configData, tabUrl] = await Promise.all([
        getConfig(),
        queryActiveTabUrl()
      ])

      if (!isMounted) {
        return
      }

      setConfig(configData)
      const rootDomain = getRootDomain(tabUrl)
      setDomain(rootDomain)
      
      // Detect selection and set mode on initialization
      await detectSelectionAndSetMode()
    }

    load()

    const unsubscribe = subscribeConfig((next) => {
      setConfig(next)
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])
  /* eslint-disable react-hooks/exhaustive-deps */

  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.runtime?.onMessage) {
      return
    }

    const handler: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (
      message
    ) => {
      if (message?.type === "TAB_UPDATED" || message?.type === "TAB_ACTIVATED") {
        void handleTabChange()
      }
    }

    chrome.runtime.onMessage.addListener(handler)
    return () => chrome.runtime.onMessage.removeListener(handler)
  }, [])

  // Auto detect text selection changes
  // Monitors for selection changes, re-selections, and cancellations
  useEffect(() => {
    if (typeof chrome === "undefined") {
      return
    }

    const checkSelection = async () => {
      const currentSelection = await fetchSelectedText()
      const trimmedSelection = currentSelection?.trim() || null

      // Selection state changed - re-evaluate mode
      if (trimmedSelection !== lastSelectionRef.current) {
        await detectSelectionAndSetMode()
      }
    }

    const intervalId = setInterval(checkSelection, 500)

    return () => {
      clearInterval(intervalId)
    }
  }, [mode])

  const handleTabChange = async () => {
    const tabUrl = await queryActiveTabUrl()
    setDomain(getRootDomain(tabUrl))
    // Detect selection and set mode on tab change
    await detectSelectionAndSetMode()
  }

  const fetchSelectedText = async (): Promise<string | null> => {
    if (typeof chrome === "undefined" || !chrome.tabs || !chrome.scripting) {
      return null
    }

    const tab = await queryActiveTab()
    if (!tab?.id) {
      return null
    }

    return new Promise((resolve) => {
      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          func: () => window.getSelection?.().toString() || ""
        },
        (results) => {
          if (chrome.runtime.lastError) {
            resolve(null)
            return
          }
          const value = results?.[0]?.result
          resolve(typeof value === "string" ? value : null)
        }
      )
    })
  }

  const orderedGroups = useMemo(() => {
    if (!config) {
      return []
    }

    return getOrderedGroups(config)
  }, [config])

  const orderedGroupIds = useMemo(() => {
    if (!config) {
      return []
    }

    const order = config.groupOrder.length
      ? config.groupOrder
      : [UNGROUPED_ID]

    return order.includes(UNGROUPED_ID) ? order : [...order, UNGROUPED_ID]
  }, [config])

  const visibleServices = useMemo(() => {
    if (!config) {
      return []
    }

    return config.services.filter((service) => {
      if (mode === "domain") {
        return service.supportedVariables.domain && !service.supportedVariables.text
      }
      return service.supportedVariables.text
    })
  }, [config, mode])

  const ungroupedServices = useMemo(() => {
    if (!config) {
      return []
    }

    return getUngroupedServices(visibleServices, config.groups)
  }, [config, visibleServices])

  const groupedServices = useMemo(() => {
    if (!config) {
      return new Map<string, AnalysisService[]>()
    }

    const map = new Map<string, AnalysisService[]>()

    orderedGroups.forEach((group) => {
      const services = group.serviceIds
        .map((id) => visibleServices.find((service) => service.id === id))
        .filter((service): service is AnalysisService => Boolean(service))

      if (services.length > 0) {
        map.set(group.id, services)
      }
    })

    return map
  }, [config, orderedGroups, visibleServices])

  const setError = (message: string) => {
    notify(message)
  }

  const handleOpenService = async (service: AnalysisService, active = true) => {
    if (mode === "domain" && !domain) {
      return
    }

    if (mode === "text" && !textValue) {
      setError(t("popupNoSelection"))
      return
    }

    const url = buildServiceUrl(service.urlTemplate, {
      domain,
      text: textValue
    })
    if (!url) {
      setError(t("popupServiceUrlError"))
      return
    }

    void incrementUsageStats({ serviceIds: [service.id] })

    if (mode === "domain" && domain) {
      void addDomainToHistory(domain)
    } else if (mode === "text" && textValue) {
      void addKeywordToHistory(textValue)
    }

    // Get current window ID before opening new tab
    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    await openTab(url, active)

    // After opening new tab, close sidepanel by messaging background script
    if (active && windowId) {
      chrome.runtime.sendMessage({
        type: "CLOSE_SIDEPANEL",
        windowId
      }).catch(() => {
        // Ignore errors if sidepanel already closed
      })
    }
  }

  const handleServiceClick = (service: AnalysisService) => (event: React.MouseEvent) => {
    // Left click (button 0) → open in foreground + close sidepanel
    // Middle click (button 1) → open in background
    const active = event.button === 0

    void handleOpenService(service, active)
  }

  const handleOpenGroup = async (group: ServiceGroup, active = true) => {
    if (mode === "domain" && !domain) {
      return
    }

    if (mode === "text" && !textValue) {
      setError(t("popupNoSelection"))
      return
    }

    if (!group.serviceIds.length) {
      setError(t("popupGroupEmpty"))
      return
    }

    const services = group.serviceIds
      .map((id) => config?.services.find((service) => service.id === id))
      .filter((service): service is AnalysisService => Boolean(service))

    const urls = services
      .map((service) =>
        buildServiceUrl(service.urlTemplate, {
          domain,
          text: textValue
        })
      )
      .filter((url): url is string => Boolean(url))

    if (urls.length !== services.length) {
      setError(t("popupServiceUrlError"))
    }

    if (!urls.length) {
      return
    }

    void incrementUsageStats({
      groupId: group.id,
      serviceIds: services.map((service) => service.id)
    })

    if (mode === "domain" && domain) {
      void addDomainToHistory(domain)
    } else if (mode === "text" && textValue) {
      void addKeywordToHistory(textValue)
    }

    // For group clicks, activate the first tab if active is true
    const activeIndex = active ? 0 : null

    // Get current window ID before opening new tabs
    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    await openTabsInOrder(urls, activeIndex)

    // After opening new tabs, close sidepanel by messaging background script
    if (active && windowId) {
      chrome.runtime.sendMessage({
        type: "CLOSE_SIDEPANEL",
        windowId
      }).catch(() => {
        // Ignore errors if sidepanel already closed
      })
    }
  }

  const handleGroupClick = (group: ServiceGroup) => (event: React.MouseEvent) => {
    // Left click (button 0) → open in foreground + close sidepanel
    // Middle click (button 1) → open in background
    const active = event.button === 0

    void handleOpenGroup(group, active)
  }

  const handleOpenOptions = async () => {
    const currentTab = await queryActiveTab()
    const windowId = currentTab?.windowId ?? null

    if (chrome?.runtime?.openOptionsPage) {
      await chrome.runtime.openOptionsPage()
    }

    if (windowId) {
      chrome.runtime.sendMessage({
        type: "CLOSE_SIDEPANEL",
        windowId
      }).catch(() => {
      })
    }
  }

  const handleUseSelection = async () => {
    setIsSelecting(true)
    await detectSelectionAndSetMode()
    setIsSelecting(false)
  }

  const renderServiceItem = (service: AnalysisService) => (
    <li key={service.id}>
      <button
        className="service-list__item"
        disabled={
          !buildServiceUrl(service.urlTemplate, {
            domain,
            text: textValue
          })
        }
        onMouseDown={handleServiceClick(service)}>
        {service.name}
      </button>
    </li>
  )

  return (
    <div className="popup">
      <header className="popup__header">
        <div className="popup__domain-line">
          <div className="popup__domain">
            {domain ?? t("popupDomainUnavailable")}
          </div>
          <div className="popup__mode-tabs">
            <button
              className={`popup__mode-tab ${
                mode === "domain" ? "is-active" : ""
              }`}
              title={t("popupModeDomainTooltip")}
              onClick={() => setMode("domain")}>
              <Globe size={17} />
            </button>
            <button
              className={`popup__mode-tab ${
                mode === "text" ? "is-active" : ""
              }`}
              title={t("popupModeTextTooltip")}
              onClick={() => setMode("text")}>
              <FileText size={17} />
            </button>
          </div>
        </div>
      </header>

      <main
        className={`popup__body ${
          mode === "domain" && !domain ? "is-disabled" : ""
        }`}>
        {mode === "text" && (
          <section className="popup__text">
            <input
              className="popup__text-input"
              type="text"
              value={textInput}
              placeholder={t("popupTextPlaceholder")}
              onChange={(event) => setTextInput(event.target.value)}
            />
            <div className="popup__text-actions">
              <button
                className="popup__text-button"
                onClick={handleUseSelection}
                disabled={isSelecting}>
                {t("popupUseSelection")}
              </button>
              <button
                className="popup__text-button is-ghost"
                onClick={() => setTextInput("")}
                disabled={!textValue}>
                {t("popupClearText")}
              </button>
            </div>
          </section>
        )}
        {orderedGroupIds.map((groupId) => {
          const isUngrouped = groupId === UNGROUPED_ID
          const group = isUngrouped
            ? {
                id: UNGROUPED_ID,
                name: t("optionDefaultGroup"),
                icon: "📋",
                serviceIds: ungroupedServices.map((s) => s.id)
              }
            : config?.groups.find((item) => item.id === groupId)

          const services = isUngrouped
            ? ungroupedServices
            : (group ? groupedServices.get(group.id) : null)

          if (!group || !services?.length) {
            return null
          }

          return (
            <section className="group" key={group.id}>
              <div className="group__header">
                  <button
                    className="group__icon"
                    disabled={
                      !services.some((service) =>
                        buildServiceUrl(service.urlTemplate, {
                          domain,
                          text: textValue
                        })
                      )
                    }
                    onMouseDown={handleGroupClick(group as ServiceGroup)}>
                    <span>{group.icon}</span>
                  </button>
                <div className="group__title">
                  <span>{group.name}</span>
                  <span className="group__count">({services.length})</span>
                </div>
              </div>
              <ul className="service-list">
                  {services.map(renderServiceItem)}
              </ul>
            </section>
          )
        })}
      </main>

      <footer className="popup__footer">
        <button className="popup__manage" onClick={handleOpenOptions}>
          <Settings size={16} />
          {t("popupManageGroups")}
        </button>
      </footer>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default SidePanel
