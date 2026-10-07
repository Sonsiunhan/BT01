import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "../components/ui/ThemeSwitcher";
import { readStoredTheme, THEME_STORAGE_KEY } from "./theme.storage";
import { ThemeProvider } from "./ThemeProvider";

describe("ThemeProvider", () => {
  beforeEach(() => localStorage.clear());

  it("dùng Dark cho hồ sơ mới và lưu lựa chọn hợp lệ", async () => {
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    const select = screen.getByRole("combobox", { name: "Chọn giao diện" });
    expect(select).toHaveValue("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    await userEvent.selectOptions(select, "light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("bỏ qua cache không hợp lệ", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "unknown");
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    expect(screen.getByRole("combobox", { name: "Chọn giao diện" })).toHaveValue("dark");
  });

  it.each(["light", "dark", "system"])("giữ lựa chọn cũ %s", (choice) => {
    localStorage.setItem(THEME_STORAGE_KEY, choice);
    render(<ThemeProvider><ThemeSwitcher /></ThemeProvider>);
    expect(screen.getByRole("combobox", { name: "Chọn giao diện" })).toHaveValue(choice);
    expect(document.documentElement.dataset.theme).toBe(choice === "system" ? "light" : choice);
  });

  it("storage bị chặn vẫn trả Dark", () => {
    const denied = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    try { expect(readStoredTheme()).toBe("dark"); } finally { denied.mockRestore(); }
  });
});
