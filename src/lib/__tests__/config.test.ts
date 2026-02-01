import { describe, expect, it } from "vitest"

import {
  buildServiceUrl,
  createDefaultConfig,
  createInitialConfig,
  normalizeConfig
} from "~lib/config"
import { UNGROUPED_ID } from "~lib/constants"

describe("config helpers", () => {
  it("buildServiceUrl replaces domain", () => {
    expect(buildServiceUrl("https://x.com/{domain}", "example.com")).toBe(
      "https://x.com/example.com"
    )
  })

  it("buildServiceUrl returns null when missing placeholder", () => {
    expect(buildServiceUrl("https://x.com", "example.com")).toBeNull()
  })

  it("normalizeConfig returns empty config when missing", () => {
    const config = normalizeConfig(null)
    expect(config.services.length).toBe(0)
    expect(config.groups.length).toBe(0)
    expect(config.groupOrder).toContain(UNGROUPED_ID)
    expect(config.groupOrder[0]).toBe(UNGROUPED_ID)
  })

  it("createInitialConfig starts empty", () => {
    const config = createInitialConfig()
    expect(config.groupOrder.length).toBe(config.groups.length + 1)
    expect(config.services.length).toBe(0)
    expect(config.groupOrder).toContain(UNGROUPED_ID)
    expect(config.groupOrder[0]).toBe(UNGROUPED_ID)
  })

  it("createDefaultConfig aligns groupOrder", () => {
    const config = createDefaultConfig()
    expect(config.groupOrder.length).toBe(config.groups.length + 1)
    expect(config.services.length).toBeGreaterThan(0)
    expect(config.groupOrder).toContain(UNGROUPED_ID)
    expect(config.groupOrder[0]).toBe(UNGROUPED_ID)
  })
})
