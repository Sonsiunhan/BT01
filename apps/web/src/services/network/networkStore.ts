export type NetworkConnectionState =
  | "CONNECTING"
  | "SYNCED"
  | "RECONNECTING"
  | "READ_ONLY"
  | "FATAL";

type Listener = (state: NetworkConnectionState) => void;

export class NetworkStore {
  private currentState: NetworkConnectionState;
  private currentReason?: string | undefined;
  private readonly listeners = new Set<Listener>();

  constructor(initialState: NetworkConnectionState = "CONNECTING") {
    this.currentState = initialState;
  }

  get state(): NetworkConnectionState {
    return this.currentState;
  }

  get reason(): string | undefined {
    return this.currentReason;
  }

  get isTerminal(): boolean {
    return this.currentState === "FATAL";
  }

  get isOperational(): boolean {
    return this.currentState === "SYNCED";
  }

  setState(nextState: NetworkConnectionState, reason?: string): void {
    if (this.currentState === nextState && this.currentReason === reason) return;
    this.currentState = nextState;
    this.currentReason = reason;
    for (const listener of this.listeners) {
      try {
        listener(nextState);
      } catch {}
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    this.listeners.clear();
  }
}

