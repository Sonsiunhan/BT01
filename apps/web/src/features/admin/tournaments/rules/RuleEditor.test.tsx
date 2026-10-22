import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createDefaultRuleEditorValue } from "./ruleEditorDefaults";
import { RuleEditor } from "./RuleEditor";
import { createRulePreviewRequest, type RuleEditorValue } from "./ruleEditorTypes";

function Harness({ errors = [] }: { errors?: Array<{ path: string; message: string }> }) {
  const [value, setValue] = useState<RuleEditorValue>(createDefaultRuleEditorValue());
  return <RuleEditor value={value} onChange={setValue} errors={errors} />;
}

describe("RuleEditor V1", () => {
  it("exports a controlled value and changes board and movement fields", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const rows = screen.getByRole("spinbutton", { name: "Số hàng bàn" });
    await user.clear(rows);
    await user.type(rows, "7");
    expect(rows).toHaveValue(7);

    const movement = screen.getByRole("combobox", { name: "Movement Xanh R" });
    await user.selectOptions(movement, "KNIGHT_LEAP");
    expect(movement).toHaveValue("KNIGHT_LEAP");
  });

  it("supports goal mode selection and only exposes fields for that mode", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const goalMode = screen.getByRole("combobox", { name: "Goal mode Xanh" });
    await user.selectOptions(goalMode, "CYCLE");
    expect(screen.getByRole("textbox", { name: "Danh sách goal Xanh" })).toHaveValue("a5");
    expect(screen.getByRole("spinbutton", { name: "Khoảng goal Xanh" })).toHaveValue(1);
  });

  it("renders field errors in both the summary and the related field", () => {
    render(<Harness errors={[{ path: "profile.board.rows", message: "Số hàng không hợp lệ." }]} />);
    expect(screen.getByTestId("rule-editor-error-summary")).toHaveTextContent("Số hàng không hợp lệ.");
    expect(screen.getByRole("spinbutton", { name: "Số hàng bàn" }).parentElement).toHaveTextContent("Số hàng không hợp lệ.");
  });

  it("builds a request with the current revisions and a detached profile", () => {
    const value = createDefaultRuleEditorValue();
    const request = createRulePreviewRequest(value, 4, 9);
    expect(request).toMatchObject({ expectedConfigRevision: 4, draftRevision: 9, profile: value });
    expect(request.profile).not.toBe(value);
  });
});
