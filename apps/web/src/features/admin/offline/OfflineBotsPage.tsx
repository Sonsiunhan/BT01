import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../../app/routes";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import {
  getBotLibrary,
  createBot,
  testBotRevision,
} from "../../../services/bot-library/botLibraryApi";
import type { BotLibraryItem } from "@ottv2/contracts";

export default function OfflineBotsPage() {
  const [bots, setBots] = useState<BotLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchBots = () => {
    setLoading(true);
    getBotLibrary()
      .then((res) => {
        setBots(res.bots);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Không thể tải danh sách bot");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchBots();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setTestResult(null);

    try {
      const source = await file.text();
      const botName = file.name.replace(/\.[^/.]+$/, "");
      await createBot({
        name: botName || "Bot Offline",
        source,
      });
      fetchBots();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải lên bot thất bại");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleTestBot = async (botId: string, revisionId: string) => {
    setTestingId(revisionId);
    setTestResult(null);
    try {
      const res = await testBotRevision(botId, revisionId);
      const isOk = res.revision.status === "READY" || res.revision.status === "PASSED";
      setTestResult(
        isOk
          ? `Preflight đạt (${res.legalPreview?.length ?? 0} nước đi hợp lệ). Sẵn sàng đấu offline!`
          : `Kiểm tra thất bại: trạng thái ${res.revision.status}`
      );
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : "Kiểm tra lỗi runtime");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="admin-page-container" style={{ padding: "2rem 1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Breadcrumb & Navigation */}
      <nav aria-label="Đường dẫn điều hướng" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem" }}>
          <Link to={routes.adminOffline} style={{ color: "var(--primary)", textDecoration: "none" }}>
            Hub công cụ Offline
          </Link>
          <span style={{ color: "var(--muted)" }}>/</span>
          <span style={{ color: "var(--foreground)", fontWeight: 600 }}>Kho Bot của tôi</span>
        </div>
      </nav>

      {/* Header */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0 0 0.5rem 0", color: "var(--foreground)" }}>
            Kho Bot của tôi
          </h1>
          <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.95rem", maxWidth: "680px" }}>
            Quản lý mã nguồn Bot cá nhân thuộc tài khoản quản trị. Toàn bộ mã nguồn và revision được bảo mật riêng tư,
            chỉ chạy trong môi trường sandbox cô lập.
          </p>
        </div>

        {/* Upload Action */}
        <div>
          <label
            className="button primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.6rem 1.25rem",
              borderRadius: "0.5rem",
              cursor: uploading ? "not-allowed" : "pointer",
              fontWeight: 600,
            }}
          >
            <span aria-hidden="true">↑</span>
            {uploading ? "Đang xử lý..." : "Tải lên file Bot (.py)"}
            <input
              type="file"
              accept=".py,text/x-python"
              style={{ display: "none" }}
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </header>

      {/* Feedback Messages */}
      {error && (
        <div
          role="alert"
          style={{
            background: "color-mix(in srgb, var(--danger, #ef4444) 12%, transparent)",
            border: "1px solid var(--danger, #ef4444)",
            borderRadius: "0.5rem",
            padding: "0.85rem 1rem",
            color: "var(--danger, #ef4444)",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {testResult && (
        <div
          role="status"
          style={{
            background: "color-mix(in srgb, var(--primary) 12%, transparent)",
            border: "1px solid var(--primary)",
            borderRadius: "0.5rem",
            padding: "0.85rem 1rem",
            color: "var(--foreground)",
            marginBottom: "1.5rem",
            fontSize: "0.9rem",
          }}
        >
          {testResult}
        </div>
      )}

      {/* Bots List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--muted)" }}>
          Đang tải danh sách Bot cá nhân...
        </div>
      ) : bots.length === 0 ? (
        <div
          style={{
            border: "2px dashed var(--border)",
            borderRadius: "0.75rem",
            padding: "3rem 2rem",
            textAlign: "center",
            background: "var(--surface)",
          }}
        >
          <div style={{ color: "var(--muted)", marginBottom: "1rem" }}>
            <UiGlyph name="brand" size={40} />
          </div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0 0 0.5rem 0", color: "var(--foreground)" }}>
            Chưa có Bot nào trong kho
          </h3>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", maxWidth: "480px", margin: "0 auto 1.5rem auto" }}>
            Tải lên file mã nguồn Python (.py) triển khai hàm <code>choose_move(state, memory)</code> để bắt đầu luyện tập và kiểm thử.
          </p>
          <label
            className="button secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              cursor: "pointer",
            }}
          >
            Tải file Python mẫu
            <input
              type="file"
              accept=".py,text/x-python"
              style={{ display: "none" }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {bots.map((bot) => (
            <div
              key={bot.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "0.75rem",
                background: "var(--surface)",
                padding: "1.25rem 1.5rem",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0, color: "var(--foreground)" }}>
                    {bot.name}
                  </h3>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      padding: "0.15rem 0.5rem",
                      borderRadius: "0.25rem",
                      background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                      color: "var(--primary)",
                      fontFamily: "var(--font-data)",
                    }}
                  >
                    {bot.revisions.length} revision(s)
                  </span>
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--muted)", fontFamily: "var(--font-data)" }}>
                  ID: {bot.id} · Cập nhật: {new Date(bot.updatedAt).toLocaleString("vi-VN")}
                </div>
              </div>

              {/* Latest Revision Actions */}
              {bot.revisions[0] && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontFamily: "var(--font-data)",
                      color: "var(--muted)",
                      padding: "0.35rem 0.5rem",
                      background: "color-mix(in srgb, var(--surface-raised, #1e293b) 60%, transparent)",
                      borderRadius: "0.25rem",
                      border: "1px solid var(--border)",
                    }}
                  >
                    SHA: {bot.revisions[0].sourceDigest.slice(0, 12)}...
                  </span>

                  <button
                    type="button"
                    className="button secondary"
                    disabled={testingId === bot.revisions[0].id}
                    onClick={() => handleTestBot(bot.id, bot.revisions[0].id)}
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.85rem",
                    }}
                  >
                    {testingId === bot.revisions[0].id ? "Đang kiểm tra..." : "Preflight Check"}
                  </button>

                  <Link
                    to={`${routes.botOffline}?botId=${encodeURIComponent(bot.id)}&revisionId=${encodeURIComponent(
                      bot.revisions[0].id
                    )}`}
                    className="button primary"
                    style={{
                      padding: "0.45rem 0.85rem",
                      borderRadius: "0.375rem",
                      fontSize: "0.85rem",
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    Đấu trong Bot Offline
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
