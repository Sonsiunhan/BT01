import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BotOnlineSnapshot } from "@ottv2/contracts";
import { BotRevisionUpload } from "./BotRevisionUpload";

const upload = vi.hoisted(() => vi.fn());
vi.mock("../../services/bot-online/botOnlineApi", () => ({ uploadBotOnline: upload }));
const snapshot = { status: "PLAYING", runtimeState: "READY", players: [{ owner: true, botId: "server-owner-bot" }] } as unknown as BotOnlineSnapshot;
describe("Online owner revision upload", () => {
  beforeEach(() => vi.clearAllMocks());
  it("does not expose upload to a non-owner and locks paused/terminal/disconnected matches", () => {
    const view = render(<BotRevisionUpload roomId="ROOM42" snapshot={{ ...snapshot, players: [] }} connected />);
    expect(screen.queryByLabelText("Tải chiến thuật Python mới")).not.toBeInTheDocument();
    for (const status of ["PAUSED", "RESUMING", "FINISHED", "ABORTED"] as const) {
      view.rerender(<BotRevisionUpload roomId="ROOM42" snapshot={{ ...snapshot, status }} connected />);
      expect(screen.getByLabelText("Tải chiến thuật Python mới")).toBeDisabled();
    }
    view.rerender(<BotRevisionUpload roomId="ROOM42" snapshot={snapshot} connected={false} />);
    expect(screen.getByLabelText("Tải chiến thuật Python mới")).toBeDisabled();
  });
  it("rejects oversize files before reading or submitting source", async () => {
    render(<BotRevisionUpload roomId="ROOM42" snapshot={snapshot} connected />);
    fireEvent.change(screen.getByLabelText("Tải chiến thuật Python mới"), { target: { files: [new File(["x".repeat(65537)], "large.py")] } });
    await screen.findByRole("alert");
    expect(upload).not.toHaveBeenCalled();
  });
  it("binds decoded source to the server-owned bot and shows pending rather than pretending active", async () => {
    upload.mockResolvedValue({ snapshot: { players: [{ owner: true, pendingRevisionNumber: 2 }] } });
    const file = new File(["fixture"], "fixed.py");
    Object.defineProperty(file, "arrayBuffer", { value: async () => new TextEncoder().encode("fixture").buffer });
    render(<BotRevisionUpload roomId="ROOM42" snapshot={snapshot} connected />);
    fireEvent.change(screen.getByLabelText("Tải chiến thuật Python mới"), { target: { files: [file] } });
    await waitFor(() => expect(upload).toHaveBeenCalledWith("ROOM42", { botId: "server-owner-bot", source: "fixture" }));
    await screen.findByText(/Đã kiểm tra r2; chờ lượt kế tiếp/);
  });
});
