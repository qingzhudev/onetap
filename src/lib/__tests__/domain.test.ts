import { describe, expect, it } from "vitest"

import { extractDomainFromText, getRootDomain, isDomainLike } from "~lib/domain"

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

describe("isDomainLike", () => {
  describe("valid domain-like strings", () => {
    it("recognizes simple domains", () => {
      expect(isDomainLike("example.com")).toBe(true)
      expect(isDomainLike("www.example.com")).toBe(true)
      expect(isDomainLike("sub.example.com")).toBe(true)
    })

    it("recognizes domains with paths", () => {
      expect(isDomainLike("https://example.com/path")).toBe(true)
      expect(isDomainLike("http://example.com/path?query=value")).toBe(true)
      expect(isDomainLike("https://www.example.com/path/to/page")).toBe(true)
    })

    it("recognizes various TLDs", () => {
      expect(isDomainLike("example.co.uk")).toBe(true)
      expect(isDomainLike("example.io")).toBe(true)
      expect(isDomainLike("example.tech")).toBe(true)
      expect(isDomainLike("example.online")).toBe(true)
      expect(isDomainLike("example.app")).toBe(true)
    })

    it("recognizes domains with numbers and hyphens", () => {
      expect(isDomainLike("my-example.com")).toBe(true)
      expect(isDomainLike("123.example.com")).toBe(true)
      expect(isDomainLike("sub-1.example-2.com")).toBe(true)
    })
  })

  describe("invalid inputs", () => {
    it("rejects plain text", () => {
      expect(isDomainLike("hello world")).toBe(false)
      expect(isDomainLike("some random text")).toBe(false)
    })

    it("rejects email addresses", () => {
      expect(isDomainLike("user@example.com")).toBe(false)
    })

    it("rejects partial domains", () => {
      expect(isDomainLike("example")).toBe(false)
      expect(isDomainLike("www.")).toBe(false)
      expect(isDomainLike(".com")).toBe(false)
    })

    it("rejects empty and whitespace", () => {
      expect(isDomainLike("")).toBe(false)
      expect(isDomainLike("   ")).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isDomainLike(null as any)).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(isDomainLike(undefined as any)).toBe(false)
    })

    it("rejects non-HTTP protocols", () => {
      expect(isDomainLike("chrome://extensions")).toBe(false)
      expect(isDomainLike("ftp://example.com")).toBe(false)
      expect(isDomainLike("mailto:test@example.com")).toBe(false)
    })
  })
})

describe("extractDomainFromText", () => {
  describe("URL extraction", () => {
    it("extracts domain from HTTPS URLs", () => {
      expect(extractDomainFromText("https://example.com")).toBe("example.com")
      expect(extractDomainFromText("https://www.example.com")).toBe("example.com")
    })

    it("extracts domain from HTTP URLs", () => {
      expect(extractDomainFromText("http://example.com")).toBe("example.com")
      expect(extractDomainFromText("http://example.com/path")).toBe("example.com")
    })

    it("extracts domain from URLs with paths", () => {
      expect(extractDomainFromText("https://example.com/path/to/page")).toBe("example.com")
      expect(extractDomainFromText("http://www.example.com/path?query=value")).toBe("example.com")
    })

    it("extracts subdomains correctly", () => {
      expect(extractDomainFromText("https://api.example.com")).toBe("api.example.com")
      expect(extractDomainFromText("https://sub.domain.example.com")).toBe("sub.domain.example.com")
    })
  })

  describe("domain string extraction", () => {
    it("extracts from plain domain strings", () => {
      expect(extractDomainFromText("example.com")).toBe("example.com")
      expect(extractDomainFromText("www.example.com")).toBe("example.com")
    })

    it("extracts from domain strings with whitespace", () => {
      expect(extractDomainFromText("  example.com  ")).toBe("example.com")
    })
  })

  describe("invalid inputs", () => {
    it("returns null for plain text", () => {
      expect(extractDomainFromText("hello world")).toBeNull()
      expect(extractDomainFromText("some random text")).toBeNull()
    })

    it("returns null for empty and whitespace", () => {
      expect(extractDomainFromText("")).toBeNull()
      expect(extractDomainFromText("   ")).toBeNull()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(extractDomainFromText(null as any)).toBeNull()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(extractDomainFromText(undefined as any)).toBeNull()
    })

    it("returns null for non-HTTP protocols", () => {
      expect(extractDomainFromText("chrome://extensions")).toBeNull()
      expect(extractDomainFromText("ftp://example.com")).toBeNull()
    })

    it("returns null for email addresses", () => {
      expect(extractDomainFromText("user@example.com")).toBeNull()
    })

    it("returns null for partial domains", () => {
      expect(extractDomainFromText("example")).toBeNull()
      expect(extractDomainFromText("www.")).toBeNull()
    })
  })
})
