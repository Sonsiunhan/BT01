import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { routes } from "../../../app/routes";
import { UiGlyph } from "../../../components/ui/UiGlyph";
import { getOfflineCapabilities, checkOfflineKit, type OfflineCapabilitiesResponse } from "./offlineApi";
import type { OfflineKitStatus } from "../../../services/local/offlineKit";

export default function OfflineHubPage() {
  const [capabilitiesData, setCapabilitiesData] = useState<OfflineCapabilitiesResponse | null>(null);
  const [kitStatus, setKitStatus] = useState<OfflineKitStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getOfflineCapabilities(), checkOfflineKit()])
      .then(([cap, kit]) => {
        if (!active) return;
        setCapabilitiesData(cap);
        setKitStatus(kit);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const hasAccess = capabilitiesData?.capabilities?.["offline.hub.read"] ?? true;

  if (!loading && !hasAccess) {
    return (
      <div className="admin-page-container" style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto" }}>
        <div
          role="alert"
          style={{
            background: "color-mix(in srgb, var(--danger, #ef4444) 10%, transparent)",
            border: "1px solid var(--danger, #ef4444)",
            borderRadius: "0.75rem",
            padding: "1.5rem",
            color: "var(--foreground)",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>Từ chối quyền truy cập</h2>
          <p style={{ color: "var(--muted)", marginBottom: "1rem" }}>
            Tài khoản của bạn không có quyền <code>offline.hub.read</code> để truy cập Hub công cụ Offline.
          </p>
          <Link
            to={routes.adminTournaments}
            className="button secondary"
            style={{ display: "inline-block", padding: "0.5rem 1rem", borderRadius: "0.375rem" }}
          >
            Quay lại Quản lý giải đấu
          </Link>
        </div>
      </div>
    );
  }

  const modes = capabilitiesData?.modes ?? [
    {
      id: "BOT_LIBRARY",
      title: "Kho Bot của tôi",
      description: "Quản lí danh sách mã nguồn Bot cá nhân và theo dõi trạng thái tương thích.",
      route: routes.adminOfflineBots,
      status: "ACTIVE" as const,
    },
    {
      id: "BOT_VS_BOT",
      title: "Đấu Bot Offline (Bot – Bot)",
      description: "Môi trường giả lập hai Bot thi đấu đối kháng trực tiếp trong trình duyệt.",
      route: routes.botOffline,
      status: "ACTIVE" as const,
    },
    {
      id: "PRACTICE_HUMAN_BOT",
      title: "Phòng tập Người – Bot",
      description: "Môi trường thi đấu luyện tập cục bộ giữa người chơi và Bot Python trong sandbox an toàn.",
      route: routes.adminOfflinePracticeHumanBot,
      status: "ACTIVE" as const,
    },
    {
      id: "PRACTICE_HUMAN_HUMAN",
      title: "Phòng tập Người – Người",
      description: "Chế độ chơi hai người trên cùng một thiết bị với bàn cờ Robot Lab.",
      route: routes.adminOfflinePracticeHumanHuman,
      status: "ACTIVE" as const,
    },
  ];

  return (
    <div className="admin-page-container" style={{ padding: "2rem 1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <header style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--primary)",
              textTransform: "uppercase",
              fontFamily: "var(--font-data)",
            }}
          >
            P15 · ROBOT LAB · ADMIN CONSOLE
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "0.15rem 0.5rem",
              borderRadius: "9999px",
              background: "color-mix(in srgb, var(--success, #10b981) 15%, transparent)",
              color: "var(--success, #10b981)",
              border: "1px solid color-mix(in srgb, var(--success, #10b981) 30%, transparent)",
            }}
          >
            Cục bộ · Cô lập
          </span>
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, color: "var(--foreground)", margin: "0 0 0.5rem 0" }}>
          Trung tâm công cụ Offline
        </h1>
        <p style={{ color: "var(--muted)", margin: 0, fontSize: "0.95rem", maxWidth: "720px", lineHeight: 1.5 }}>
          Cổng truy cập tập trung vào các công cụ thực thi offline: Kho Bot, Đấu Bot, và Phòng luyện tập cục bộ.
          Tất cả các lượt tính toán chạy hoàn toàn trong trình duyệt hoặc Web Worker cô lập.
        </p>
      </header>

      {/* Runtime Isolation & Kit Status Banner */}
      <section
        aria-label="Trạng thái môi trường cách ly"
        style={{
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
          background: "var(--surface)",
          padding: "1.25rem 1.5rem",
          marginBottom: "2rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: "2.5rem",
              height: "2.5rem",
              borderRadius: "0.5rem",
              background: "color-mix(in srgb, var(--primary) 12%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
            }}
          >
            <UiGlyph name="lock" size={20} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--foreground)" }}>
              {kitStatus?.ready ? "Môi trường Sandbox Web Worker sẵn sàng" : "Môi trường cách ly trình duyệt"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
              Chính sách an toàn: Không chạy mã trên máy chủ · Không lộ mã nguồn qua public audit · Chạy hoàn toàn cục bộ
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.8rem",
              fontWeight: 600,
              padding: "0.35rem 0.75rem",
              borderRadius: "0.375rem",
              background: "color-mix(in srgb, var(--surface-raised, #1e293b) 80%, transparent)",
              border: "1px solid var(--border)",
              fontFamily: "var(--font-data)",
              color: "var(--foreground)",
            }}
          >
            <UiGlyph name="brand" size={14} />
            {capabilitiesData?.runtime?.isolation ?? "BROWSER_WORKER_CPYTHON"}
          </span>
        </div>
      </section>

      {/* Four Modes Cards Grid */}
      <section aria-label="Bốn lối vào công cụ Offline">
        <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: "1rem", color: "var(--foreground)" }}>
          Bốn lối vào công cụ
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))",
            gap: "1.25rem",
          }}
        >
          {modes.map((mode, index) => {
            const badges = ["Riêng tư", "Đối kháng Bot", "Luyện tập Bot", "Pass & Play"];

            return (
              <div
                key={mode.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "0.75rem",
                  background: "var(--surface)",
                  padding: "1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  boxShadow: "var(--elevation-card, 0 1px 3px rgba(0,0,0,0.1))",
                  transition: "transform 0.15s ease, border-color 0.15s ease",
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "1rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                        color: "var(--primary)",
                        fontFamily: "var(--font-data)",
                      }}
                    >
                      LỐI VÀO {index + 1} · {badges[index]}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "var(--success, #10b981)",
                      }}
                    >
                      Sẵn sàng
                    </span>
                  </div>

                  <h3
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 700,
                      color: "var(--foreground)",
                      margin: "0 0 0.5rem 0",
                    }}
                  >
                    {mode.title}
                  </h3>

                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--muted)",
                      margin: 0,
                      lineHeight: 1.5,
                      minHeight: "2.6rem",
                    }}
                  >
                    {mode.description}
                  </p>
                </div>

                <div style={{ marginTop: "1.5rem" }}>
                  <Link
                    to={mode.route}
                    className="button primary"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      width: "100%",
                      padding: "0.6rem 1rem",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      textAlign: "center",
                      fontSize: "0.9rem",
                    }}
                  >
                    Truy cập công cụ
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
