import { act, fireEvent, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../test/renderWithProviders";
import * as api from "../../services/guest/guestApi";
import { GuestBotHistoryImport } from "./GuestBotHistoryImport";

const record = { localId: "guest-bot-online:00000000-0000-4000-8000-000000000001:BLUE", mode: "BOT_ONLINE" as const, result: "WIN" as const, playerName: "Khách Xanh", opponentName: "Khách Đỏ", timerSeconds: 300, durationSeconds: 5, endedAt: new Date().toISOString(), scoreDelta: 0 };
describe("Guest Bot summary import consent", () => {
  it("freezes the reviewed record set even if another terminal summary arrives", async () => {
    vi.spyOn(api, "getImportedGuestBotHistory").mockResolvedValue({ records: [] });
    const upload = vi.spyOn(api, "importGuestBotHistory").mockResolvedValue({ importedCount: 1, skippedCount: 0 });
    function ChangingRecords() {
      const [records, setRecords] = useState([record]);
      useEffect(() => {
        const append = () => setRecords([record, { ...record, localId: record.localId.replace(/1:BLUE$/, "2:BLUE") }]);
        window.addEventListener("test:new-summary", append);
        return () => window.removeEventListener("test:new-summary", append);
      }, []);
      return <GuestBotHistoryImport records={records} />;
    }
    renderWithProviders(<ChangingRecords />);
    fireEvent.click(screen.getByRole("button", { name: "Nhập lịch sử Bot Guest" }));
    act(() => { window.dispatchEvent(new Event("test:new-summary")); });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập tóm tắt" }));
    await screen.findByText("Đã nhập 1; bỏ qua 0 bản trùng. Dữ liệu thiết bị được giữ nguyên.");
    expect(upload).toHaveBeenCalledWith([record]);
  });
  it("previews first, imports only after confirmation and never includes private fields", async () => {
    vi.spyOn(api, "getImportedGuestBotHistory").mockResolvedValue({ records: [] });
    const upload = vi.spyOn(api, "importGuestBotHistory").mockResolvedValue({ importedCount: 1, skippedCount: 0 });
    renderWithProviders(<GuestBotHistoryImport records={[record]} />);
    fireEvent.click(screen.getByRole("button", { name: "Nhập lịch sử Bot Guest" }));
    expect(upload).not.toHaveBeenCalled();
    expect(screen.getByText(/Không tải Python/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập tóm tắt" }));
    await screen.findByText("Đã nhập 1; bỏ qua 0 bản trùng. Dữ liệu thiết bị được giữ nguyên.");
    expect(upload).toHaveBeenCalledWith([record]);
  });
  it("preserves the preview and device records when import fails", async () => {
    vi.spyOn(api, "getImportedGuestBotHistory").mockResolvedValue({ records: [] });
    vi.spyOn(api, "importGuestBotHistory").mockRejectedValue(new Error("network"));
    const records = [record];
    renderWithProviders(<GuestBotHistoryImport records={records} />);
    fireEvent.click(screen.getByRole("button", { name: "Nhập lịch sử Bot Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận nhập tóm tắt" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(records).toEqual([record]);
  });
});
