import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import HomePage from "./page"

describe("HomePage", () => {
  it("offers personal, private, and AI chat spaces", () => {
    render(<HomePage />)

    expect(
      screen.getByRole("link", { name: /Personal Chat/i }),
    ).toHaveAttribute("href", "/personal")
    expect(screen.getByRole("link", { name: /Private Chat/i })).toHaveAttribute(
      "href",
      "/private",
    )
    expect(screen.getByRole("link", { name: /AI Chat/i })).toHaveAttribute(
      "href",
      "/ai",
    )
    expect(screen.getByText(/Free, Fast, and Balanced/i)).toBeInTheDocument()
  })
})
