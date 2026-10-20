import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./PasswordField";

describe("PasswordField", () => {
  it("toggles visibility without losing the value", () => {
    render(<PasswordField label="Mật khẩu" value="secret123" readOnly onChange={() => undefined} />);
    const input = screen.getByLabelText("Mật khẩu");
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("secret123");
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("links both hint and error to aria-describedby and marks aria-invalid", () => {
    render(
      <PasswordField
        id="pwd"
        label="Mật khẩu"
        hint="Tối thiểu 8 ký tự"
        error="Mật khẩu không hợp lệ"
        errorId="pwd-err"
        value=""
        onChange={() => undefined}
      />
    );
    const input = screen.getByLabelText(/^Mật khẩu/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "pwd-hint pwd-err");
    expect(screen.getByText("Tối thiểu 8 ký tự")).toBeInTheDocument();
    expect(screen.getByText("Mật khẩu không hợp lệ")).toBeInTheDocument();
  });
});
