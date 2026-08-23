import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => `http://localhost:8080/api${path}`,
  isSetupRequired: vi.fn(async () => false),
}))

import { middleware } from "./middleware"

describe("middleware", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  it("allows unauthenticated access to /register/complete with token", async () => {
    const request = new NextRequest(
      new URL("http://localhost:3000/register/complete?token=oauth-complete-token")
    )

    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get("location")).toBeNull()
  })

  it("redirects unauthenticated users from protected routes to /login", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/"))

    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe("http://localhost:3000/login")
  })
})
