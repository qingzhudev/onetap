import { describe, expect, it } from "vitest"

import {
  createDefaultConfig,
  createInitialConfig,
  normalizeConfig,
  serializeConfigForExport
} from "~lib/config"
import { DEFAULT_GROUP_ID } from "~lib/constants"
import type { UserConfig } from "~lib/types"

describe("config helpers", () => {
  it("normalizeConfig returns empty config when missing", () => {
    const config = normalizeConfig(null)
    expect(config.services.length).toBe(0)
    expect(config.workflows.length).toBe(0)
    expect(config.groups.length).toBe(0)
    expect(config.groupOrder).toContain(DEFAULT_GROUP_ID)
    expect(config.groupOrder[0]).toBe(DEFAULT_GROUP_ID)
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
      workflows: [
        {
          id: "wf1",
          name: "Workflow",
          serviceIds: ["1", "missing"],
          mode: "text",
          pinned: true,
          openStrategy: "background-all"
        }
      ],
      workflowOrder: ["wf1"],
      groups: [],
      groupOrder: [DEFAULT_GROUP_ID]
    } as UserConfig)

    expect(config.services[0].supportedVariables.domain).toBe(true)
    expect(config.services[0].supportedVariables.text).toBe(true)
    expect(config.workflows[0].serviceIds).toEqual(["1"])
  })

  it("createInitialConfig starts empty", () => {
    const config = createInitialConfig()
    expect(config.groupOrder.length).toBe(config.groups.length + 1)
    expect(config.services.length).toBe(0)
    expect(config.workflows.length).toBe(0)
    expect(config.groupOrder).toContain(DEFAULT_GROUP_ID)
    expect(config.groupOrder[0]).toBe(DEFAULT_GROUP_ID)
    expect(config.preferences.closeSidePanelAfterOpen).toBe("batch-only")
  })

  it("createDefaultConfig aligns groupOrder", () => {
    const config = createDefaultConfig()
    expect(config.groupOrder.length).toBe(config.groups.length + 1)
    expect(config.services.length).toBe(0)
    expect(config.workflows.length).toBe(0)
    expect(config.groupOrder).toContain(DEFAULT_GROUP_ID)
    expect(config.groupOrder[0]).toBe(DEFAULT_GROUP_ID)
  })

  it("serializeConfigForExport keeps workflows and workflowOrder", () => {
    const config = normalizeConfig({
      services: [
        {
          id: "svc-1",
          name: "Keyword Difficulty",
          urlTemplate: "https://example.com?q={text}",
          createdAt: "2026-04-19T00:00:00.000Z"
        }
      ],
      workflows: [
        {
          id: "wf-1",
          name: "Keyword Validation",
          serviceIds: ["svc-1"],
          mode: "text",
          pinned: true,
          openStrategy: "foreground-first"
        }
      ],
      workflowOrder: ["wf-1"],
      groups: [],
      groupOrder: [DEFAULT_GROUP_ID]
    } as UserConfig)

    const exported = serializeConfigForExport(config)

    expect(exported.workflows).toHaveLength(1)
    expect(exported.workflows[0].id).toBe("wf-1")
    expect(exported.workflowOrder).toEqual(["wf-1"])
  })
})
