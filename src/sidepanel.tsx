import { useEffect, useMemo, useState } from "react"

import {
  buildServiceUrl,
  getOrderedGroups,
  getUngroupedServices
} from "~lib/config"
import { UNGROUPED_ID } from "~lib/constants"
import { queryActiveTab, queryActiveTabUrl, getRootDomain } from "~lib/domain"
import { t } from "~lib/i18n"
import { openTab, openTabsInOrder } from "~lib/open"
import { getConfig, subscribeConfig } from "~lib/storage"
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

  const textValue = textInput.trim()

  const detectSelectionAndSetMode = async () => {
    const selection = await fetchSelectedText()
    if (selection) {
      setMode("text")
      setTextInput(selection)
    } else {
      setMode("domain")
      setTextInput("")
    }
  }

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

  // Auto detect text selection changes in text mode
  useEffect(() => {
    if (mode !== "text" || typeof chrome === "undefined") {
      return
    }

    let lastSelection: string | null = textInput
    let intervalId: NodeJS.Timeout

    const checkSelection = async () => {
      const currentSelection = await fetchSelectedText()
      if (currentSelection && currentSelection !== lastSelection) {
        setTextInput(currentSelection)
        lastSelection = currentSelection
      }
    }

    // Check selection every 1 second in text mode
    intervalId = setInterval(checkSelection, 1000)

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [mode, textInput])

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

  const handleOpenService = async (service: AnalysisService) => {
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
    await openTab(url, true)
  }

  const handleOpenGroup = async (group: ServiceGroup) => {
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
    await openTabsInOrder(urls)
  }

  const handleOpenOptions = async () => {
    if (chrome?.runtime?.openOptionsPage) {
      await chrome.runtime.openOptionsPage()
    }
  }

  const handleUseSelection = async () => {
    setIsSelecting(true)
    const selection = await fetchSelectedText()
    setIsSelecting(false)

    if (!selection) {
      notify(t("popupNoSelection"))
      return
    }

    setTextInput(selection)
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
        onClick={() => handleOpenService(service)}>
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
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="2" y1="12" x2="22" y2="12"></line>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
              </svg>
            </button>
            <button
              className={`popup__mode-tab ${
                mode === "text" ? "is-active" : ""
              }`}
              title={t("popupModeTextTooltip")}
              onClick={() => setMode("text")}>
              <svg viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </button>
          </div>
        </div>
        {mode === "text" && (
          <div className="popup__subtitle">{t("popupTextPlaceholder")}</div>
        )}
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
          if (groupId === UNGROUPED_ID) {
            if (ungroupedServices.length === 0) {
              return null
            }

            return (
              <section className="group group--standalone" key="ungrouped">
                <ul className="service-list">
                  {ungroupedServices.map(renderServiceItem)}
                </ul>
              </section>
            )
          }

          const group = config?.groups.find((item) => item.id === groupId)
          const services = group ? groupedServices.get(group.id) : null

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
                    onClick={() => handleOpenGroup(group)}>
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
