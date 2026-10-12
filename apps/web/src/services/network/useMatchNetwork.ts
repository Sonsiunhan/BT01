import { useCallback, useEffect, useRef, useState } from "react";
import type {
  DomainEventEnvelope,
  MatchSnapshot,
  MatchStatus,
} from "@ottv2/contracts";

import {
  createReconciler,
  reconcileDomainEvent,
  reconcilePulse,
  reconcileSnapshot,
} from "./reconciler";
import {
  getSubscriptionManager,
  type SubscriptionLease,
  type SubscriptionManager,
} from "./subscriptionManager";
import type { NetworkConnectionState } from "./networkStore";

export type PulseData = {
  anchorMs: number;
  clocksMs: Record<string, number>;
  serverTime: number;
};

export type MatchNetworkOptions = {
  roomId: string;
  principal?: string | undefined;
  initialSnapshot?: MatchSnapshot | null | undefined;
  onSnapshot?: ((snapshot: MatchSnapshot) => void) | undefined;
  onPulse?: ((pulse: PulseData) => void) | undefined;
  onEvent?: ((event: DomainEventEnvelope) => void) | undefined;
  onGapDetected?: (() => void) | undefined;
  onRevoked?: ((reason: string) => void) | undefined;
  subscriptionManager?: SubscriptionManager | undefined;
};

export type NetworkBannerProps = {
  message: string;
  visible: boolean;
  variant: "info" | "warning" | "danger" | "neutral";
  role: "status";
  "aria-live": "polite";
  tabIndex: -1;
};

export function getNetworkBannerProps(
  state: NetworkConnectionState,
  reason?: string
): NetworkBannerProps {
  switch (state) {
    case "CONNECTING":
      return {
        message: "Đang đồng bộ trận đấu...",
        visible: true,
        variant: "info",
        role: "status",
        "aria-live": "polite",
        tabIndex: -1,
      };
    case "RECONNECTING":
      return {
        message: "Mất kết nối. Đang kết nối lại...",
        visible: true,
        variant: "warning",
        role: "status",
        "aria-live": "polite",
        tabIndex: -1,
      };
    case "READ_ONLY":
      return {
        message: reason
          ? `Chế độ chỉ xem: ${reason}`
          : "Chế độ chỉ xem. Quyền thao tác đã bị thu hồi.",
        visible: true,
        variant: "warning",
        role: "status",
        "aria-live": "polite",
        tabIndex: -1,
      };
    case "FATAL":
      return {
        message:
          reason === "SESSION_EXPIRED"
            ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
            : "Phiên kết nối đã bị thu hồi hoặc đóng Authoritatively.",
        visible: true,
        variant: "danger",
        role: "status",
        "aria-live": "polite",
        tabIndex: -1,
      };
    case "SYNCED":
    default:
      return {
        message: "",
        visible: false,
        variant: "neutral",
        role: "status",
        "aria-live": "polite",
        tabIndex: -1,
      };
  }
}

export function useMatchNetwork(options: MatchNetworkOptions) {
  const {
    roomId,
    principal,
    initialSnapshot,
    onSnapshot,
    onPulse,
    onEvent,
    onGapDetected,
    onRevoked,
    subscriptionManager = getSubscriptionManager(),
  } = options;

  const [networkState, setNetworkState] = useState<NetworkConnectionState>("CONNECTING");
  const [networkReason, setNetworkReason] = useState<string | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(
    initialSnapshot ?? null
  );
  const [gapDetected, setGapDetected] = useState(false);
  const [lastPulse, setLastPulse] = useState<PulseData | null>(null);

  const initialStatus = initialSnapshot?.status;
  const isTerminalRef = useRef(
    initialStatus === "FINISHED" || initialStatus === "ABORTED"
  );
  const isPausedRef = useRef(initialStatus === "PAUSED");

  const reconcilerRef = useRef(
    createReconciler(
      "MATCH",
      roomId,
      "gen-1",
      initialSnapshot ?? null,
      initialSnapshot?.sequence ?? 0,
      initialSnapshot?.stateVersion ?? 0
    )
  );

  // Update terminal status when snapshot updates
  const updateStatusFlags = useCallback((status?: MatchStatus) => {
    if (status === "FINISHED" || status === "ABORTED") {
      isTerminalRef.current = true;
      isPausedRef.current = false;
    } else if (status === "PAUSED") {
      isPausedRef.current = true;
    } else if (status === "PLAYING") {
      // Invariant: Terminal status cannot be overwritten by PLAYING!
      if (!isTerminalRef.current) {
        isPausedRef.current = false;
      }
    }
  }, []);

  const handleSnapshotUpdate = useCallback(
    (newSnapshot: MatchSnapshot) => {
      // Invariant: once terminal, do not downgrade to PLAYING
      if (
        isTerminalRef.current &&
        newSnapshot.status !== "FINISHED" &&
        newSnapshot.status !== "ABORTED"
      ) {
        return;
      }

      reconcilerRef.current = reconcileSnapshot(
        reconcilerRef.current,
        newSnapshot,
        newSnapshot.sequence,
        newSnapshot.stateVersion
      );
      setGapDetected(false);
      updateStatusFlags(newSnapshot.status);
      setSnapshot(newSnapshot);
      onSnapshot?.(newSnapshot);
    },
    [onSnapshot, updateStatusFlags]
  );

  // Manage subscription lifecycle & Rematch transition
  useEffect(() => {
    // Reset state for new roomId (Rematch or route navigation)
    reconcilerRef.current = createReconciler(
      "MATCH",
      roomId,
      "gen-1",
      initialSnapshot ?? null,
      initialSnapshot?.sequence ?? 0,
      initialSnapshot?.stateVersion ?? 0
    );
    isTerminalRef.current =
      initialSnapshot?.status === "FINISHED" ||
      initialSnapshot?.status === "ABORTED";
    isPausedRef.current = initialSnapshot?.status === "PAUSED";
    setGapDetected(false);
    setLastPulse(null);

    const path = `/matches/${encodeURIComponent(roomId)}/events${
      principal ? `?clientId=${encodeURIComponent(principal)}` : ""
    }`;

    let lease: SubscriptionLease | null = subscriptionManager.acquire(
      "MATCH",
      roomId,
      path,
      {
        onStateChange: (state) => {
          setNetworkState(state);
          setNetworkReason(lease?.networkStore.reason);
        },
        onEvent: (event: MessageEvent) => {
          try {
            const parsed = JSON.parse(event.data);

            // 1. Sync snapshot event
            if (event.type === "sync" || parsed.matchId) {
              handleSnapshotUpdate(parsed as MatchSnapshot);
              return;
            }

            // 2. Pulse event: update clock without touching board or domain sequence
            if (event.type === "pulse" || parsed.anchorMs !== undefined) {
              const pulse = parsed as PulseData;
              reconcilerRef.current = reconcilePulse(reconcilerRef.current, pulse);
              setLastPulse(pulse);
              onPulse?.(pulse);
              return;
            }

            // 3. Revoked event
            if (event.type === "revoked" || parsed.type === "REVOKED") {
              const reason = parsed.reason ?? "SESSION_REVOKED";
              onRevoked?.(reason);
              return;
            }

            // 4. Domain event envelope
            if (parsed.protocolVersion && parsed.sequence !== undefined) {
              const domainEvent = parsed as DomainEventEnvelope;
              const result = reconcileDomainEvent(
                reconcilerRef.current,
                domainEvent,
                (current) => current
              );
              reconcilerRef.current = result.state;

              if (result.action === "GAP_DETECTED") {
                setGapDetected(true);
                onGapDetected?.();
              } else if (result.action === "APPLIED") {
                onEvent?.(domainEvent);
              }
            }
          } catch { /* Ignore malformed stream data; canonical snapshots remain authoritative. */ }
        },
      }
    );

    return () => {
      if (lease) {
        lease.release();
        lease = null;
      }
    };
  }, [
    roomId,
    principal,
    subscriptionManager,
    handleSnapshotUpdate,
    onPulse,
    onEvent,
    onGapDetected,
    onRevoked,
    initialSnapshot,
  ]);

  const bannerProps = getNetworkBannerProps(networkState, networkReason);
  const isTerminal =
    snapshot?.status === "FINISHED" ||
    snapshot?.status === "ABORTED" ||
    isTerminalRef.current;
  const isPaused = snapshot?.status === "PAUSED" || isPausedRef.current;

  return {
    networkState,
    networkReason,
    snapshot,
    gapDetected,
    lastPulse,
    isTerminal,
    isPaused,
    watermarkSequence: reconcilerRef.current.watermarkSequence,
    stateVersion: reconcilerRef.current.stateVersion,
    bannerProps,
    applySnapshot: handleSnapshotUpdate,
  };
}

