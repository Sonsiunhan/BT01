import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import LocalGamePage from "./LocalGamePage";

describe("R11 local manual and AI compatibility", () => {
  beforeEach(() => localStorage.clear());

  it("starts Offline 2P on the canonical board with local-only state", async () => {
    renderWithProviders(<LocalGamePage mode="OFFLINE" />, "/offline");

    expect(await screen.findByRole("heading", { name: "Hai người một máy" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ván" }));

    expect(screen.getByText("Không có kết nối lại · trạng thái local là nguồn sự thật của ván này.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Bàn cờ, góc nhìn phe Xanh" })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a1, Quân Kéo phe Xanh/ })).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô i9, Quân Kéo phe Đỏ/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("gridcell", { name: /Ô a1, Quân Kéo phe Xanh/ }));
    fireEvent.click(screen.getByRole("gridcell", { name: /Ô a2, trống/ }));
    expect(screen.getByText("Lượt phe Đỏ")).toBeInTheDocument();
    expect(screen.getByRole("gridcell", { name: /Ô a2, Quân Kéo phe Xanh/ })).toBeInTheDocument();
  }, 15000);

  it("keeps AI view canonical and presents the local bot without a server mode", async () => {
    renderWithProviders(<LocalGamePage mode="AI" />, "/ai");

    expect(await screen.findByRole("heading", { name: "Đấu với máy" })).toBeInTheDocument();
    expect(screen.getByText("Bot thường" )).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ván" }));

    expect(screen.getByRole("region", { name: "Bàn cờ, góc nhìn phe Xanh" })).toBeInTheDocument();
    expect(screen.getByText("Không có kết nối lại · trạng thái local là nguồn sự thật của ván này.")).toBeInTheDocument();
  });
});
