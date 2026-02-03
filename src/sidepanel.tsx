import { useEffect, useMemo, useState } from "react"

import {
  buildServiceUrl,
  getOrderedGroups,
  getUngroupedServices
} from "~lib/config"
import { UNGROUPED_ID } from "~lib/constants"
import { queryActiveTabUrl, getRootDomain } from "~lib/domain"
import { t } from "~lib/i18n"
import { openTab, openTabsInOrder } from "~lib/open"
import { getConfig, subscribeConfig } from "~lib/storage"
import { incrementUsageStats } from "~lib/stats"
import { useToast } from "~lib/toast"
import type { AnalysisService, ServiceGroup, UserConfig } from "~lib/types"
import "~styles/popup.css"

const SidePanel = () => {
  const [config, setConfig] = useState<UserConfig | null>(null)
  const [domain, setDomain] = useState<string | null>(null)
  const { toasts, notify } = useToast()

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
      // Domain header already shows the missing state; avoid duplicate toast.
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

  const ungroupedServices = useMemo(() => {
    if (!config) {
      return []
    }

    return getUngroupedServices(config.services, config.groups)
  }, [config])

  const groupedServices = useMemo(() => {
    if (!config) {
      return new Map<string, AnalysisService[]>()
    }

    const map = new Map<string, AnalysisService[]>()

    orderedGroups.forEach((group) => {
      const services = group.serviceIds
        .map((id) => config.services.find((service) => service.id === id))
        .filter((service): service is AnalysisService => Boolean(service))

      if (services.length > 0) {
        map.set(group.id, services)
      }
    })

    return map
  }, [config, orderedGroups])

  const setError = (message: string) => {
    notify(message)
  }

  const handleOpenService = async (service: AnalysisService) => {
    if (!domain) {
      return
    }

    const url = buildServiceUrl(service.urlTemplate, domain)
    if (!url) {
      setError(t("popupServiceUrlError"))
      return
    }

    void incrementUsageStats({ serviceIds: [service.id] })
    await openTab(url, true)
  }

  const handleOpenGroup = async (group: ServiceGroup) => {
    if (!domain) {
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
      .map((service) => buildServiceUrl(service.urlTemplate, domain))
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

  return (
    <div className="popup">
      <header className="popup__header">
        <div className="popup__domain">{domain ?? t("popupDomainUnavailable")}</div>
      </header>

      <main className={`popup__body ${!domain ? "is-disabled" : ""}`}>
        {orderedGroupIds.map((groupId) => {
          if (groupId === UNGROUPED_ID) {
            if (ungroupedServices.length === 0) {
              return null
            }

            return (
              <section className="group group--standalone" key="ungrouped">
                <ul className="service-list">
                  {ungroupedServices.map((service) => (
                    <li key={service.id}>
                      <button
                        className="service-list__item"
                        disabled={!domain}
                        onClick={() => handleOpenService(service)}>
                        {service.name}
                      </button>
                    </li>
                  ))}
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
                  disabled={!domain}
                  onClick={() => handleOpenGroup(group)}>
                  <span>{group.icon}</span>
                </button>
                <div className="group__title">
                  <span>{group.name}</span>
                  <span className="group__count">({services.length})</span>
                </div>
              </div>
              <ul className="service-list">
                {services.map((service) => (
                  <li key={service.id}>
                    <button
                      className="service-list__item"
                      disabled={!domain}
                      onClick={() => handleOpenService(service)}>
                      {service.name}
                    </button>
                  </li>
                ))}
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
