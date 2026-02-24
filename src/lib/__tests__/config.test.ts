import { describe, expect, it } from "vitest"

import { createDefaultConfig, createInitialConfig, normalizeConfig } from "~lib/config"
import { UNGROUPED_ID } from "~lib/constants"
import type { UserConfig } from "~lib/types"

describe("config helpers", () => {
  it("normalizeConfig returns empty config when missing", () => {
    const config = normalizeConfig(null)
    expect(config.services.length).toBe(0)
    expect(config.groups.length).toBe(0)
    expect(config.groupOrder).toContain(UNGROUPED_ID)
    expect(config.groupOrder[0]).toBe(UNGROUPED_ID)
    expect(config.preferences.closeSidePanelAfterOpen).toBe("batch-only")
    expect(config.lastOperations.domainMode).toBeTruthy()
    expect(config.lastOperations.textMode).toBeTruthy()
  })

  it("normalizeConfig infers supportedVariables", () => {
    const config = normalizeConfig({
      services: [
        {
          id: "1",
          name: "Test",
          urlTemplate: "https://example.com?q={domain}&q={text}",
          createdAt: "2024-01-01"
        }
      ],
      groups: [],
      groupOrder: [UNGROUPED_ID]
    } as UserConfig)

    expect(config.services[0].supportedVariables.domain).toBe(true)
    expect(config.services[0].supportedVariables.text).toBe(true)
  })

  it("createInitialConfig starts empty", () => {
    const config = createInitialConfig()
    expect(config.groupOrder.length).toBe(config.groups.length + 1)
    expect(config.services.length).toBe(0)
    expect(config.groupOrder).toContain(UNGROUPED_ID)
    expect(config.groupOrder[0]).toBe(UNGROUPED_ID)
    expect(config.preferences.closeSidePanelAfterOpen).toBe("batch-only")
  })

  it("createDefaultConfig aligns groupOrder", () => {
    const config = createDefaultConfig()
    expect(config.groupOrder.length).toBe(config.groups.length + 1)
    expect(config.services.length).toBeGreaterThan(0)
    expect(config.groupOrder).toContain(UNGROUPED_ID)
    expect(config.groupOrder[0]).toBe(UNGROUPED_ID)
    expect(config.services[0].supportedVariables).toBeTruthy()
  })
})
