import { describe, expect, it } from "vitest"

import { getRootDomain } from "~lib/domain"

describe("getRootDomain", () => {
  it("strips www prefix", () => {
    expect(getRootDomain("https://www.example.com/path")).toBe("example.com")
  })

  it("returns hostname for https", () => {
    expect(getRootDomain("https://sub.example.com")).toBe("sub.example.com")
  })

  it("returns null for unsupported protocols", () => {
    expect(getRootDomain("chrome://extensions")).toBeNull()
  })

  it("returns null for invalid urls", () => {
    expect(getRootDomain("not-a-url")).toBeNull()
  })
})
