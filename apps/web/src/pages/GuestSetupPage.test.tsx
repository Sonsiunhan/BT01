import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocation } from "react-router-dom";
import { renderWithProviders } from "../test/renderWithProviders";
import GuestSetupPage from "./GuestSetupPage";
import * as localStorageService from "../services/local/localGameStorage";

afterEach(() => {
  if (vi.isMockFunction(localStorageService.getGuestProfile)) vi.mocked(localStorageService.getGuestProfile).mockRestore();
});

function LocationProbe() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

describe("Guest compatibility onboarding", () => {
  it("uses one generated identity and enters normal Offline2P instead of a Guest mode", async () => {
    renderWithProviders(<><GuestSetupPage /><LocationProbe /></>, "/guest");
    const input = await screen.findByLabelText("Tên khách");
    await waitFor(() => expect((input as HTMLInputElement).value).not.toBe(""));
    expect((input as HTMLInputElement).value).toMatch(/^Khách /);
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/offline"));
  });

  it("shows a storage failure and lets the Guest retry without a login wall", async () => {
    vi.spyOn(localStorageService, "getGuestProfile").mockRejectedValueOnce(new Error("storage")).mockResolvedValue({ displayName: "Khách Test" });
    renderWithProviders(<GuestSetupPage />, "/guest");
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể đọc danh tính khách");
    expect(screen.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Thử lại" })).toHaveAttribute("type", "button");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.getByLabelText("Tên khách")).toHaveValue("Khách Test"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tiếp tục" })).not.toBeDisabled();
  });
});
