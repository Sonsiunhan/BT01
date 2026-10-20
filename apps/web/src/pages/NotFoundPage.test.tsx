import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NotFoundPage from "./NotFoundPage";

describe("NotFoundPage", () => {
  it("renders the branded explanation and a lobby action", () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);

    expect(screen.getByRole("link", { name: "ROBOT LAB — Về sảnh" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "OTT v2 Robot Lab" })).toHaveAttribute("data-brand", "robot-lab");
    const heading = screen.getByRole("heading", { name: "Trang này không tồn tại" });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(screen.getByText(/Đường dẫn có thể đã đổi/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về sảnh" })).toHaveAttribute("href", "/");
  });
});
