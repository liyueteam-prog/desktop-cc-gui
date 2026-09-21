import { invoke } from "@tauri-apps/api/core";
import { isWeb } from "./transport";

const INSTALL_ID_KEY = "ruyuan.desktop.install-id.v1";
const FIRST_OPEN_KEY = "ruyuan.desktop.first-open-sent.v1";
const HEARTBEAT_MS = 60_000;
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1500;
const IDLE_AFTER_MS = 5 * 60_000;
const INSTALL_MARKER = Symbol.for("ruyuan.desktop.telemetry.installed");

type DesktopState = "active" | "idle" | "background" | "closed";
type DesktopEvent = "app_first_open" | "app_open" | "heartbeat" | "app_close";

type TelemetryWindow = Window & { [INSTALL_MARKER]?: boolean };

function randomId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function installId(): string {
  const stored = window.localStorage.getItem(INSTALL_ID_KEY);
  if (stored && stored.length >= 8) return stored;
  const created = randomId();
  window.localStorage.setItem(INSTALL_ID_KEY, created);
  return created;
}

function stateFrom(lastInteractionAt: number): DesktopState {
  if (document.visibilityState !== "visible" || !document.hasFocus()) return "background";
  return Date.now() - lastInteractionAt >= IDLE_AFTER_MS ? "idle" : "active";
}

/**
 * Installs privacy-safe desktop telemetry for the main native window.
 * It sends only a random installation ID, app/platform metadata and aggregate
 * active/idle/background seconds. API keys, prompts, file paths and hardware
 * identifiers are never read.
 */
export function installDesktopTelemetry(): void {
  const telemetryWindow = window as TelemetryWindow;
  if (telemetryWindow[INSTALL_MARKER] || isWeb || !import.meta.env.PROD) return;
  telemetryWindow[INSTALL_MARKER] = true;

  const deviceId = installId();
  const sessionId = randomId();
  let lastInteractionAt = Date.now();
  let lastSentAt = Date.now();
  let closing = false;

  const send = (eventName: DesktopEvent, forcedState?: DesktopState): Promise<void> => {
    const now = Date.now();
    const elapsedSeconds = Math.max(0, Math.min(300, Math.round((now - lastSentAt) / 1000)));
    const usageState = stateFrom(lastInteractionAt);
    const state = forcedState ?? usageState;
    lastSentAt = now;
    const durations = {
      activeSeconds: usageState === "active" ? elapsedSeconds : 0,
      idleSeconds: usageState === "idle" ? elapsedSeconds : 0,
      backgroundSeconds: usageState === "background" ? elapsedSeconds : 0,
    };
    return invoke("desktop_telemetry_event", {
      payload: {
        eventId: randomId(),
        eventName,
        installId: deviceId,
        state,
        sessionId,
        ...durations,
      },
    });
  };

  const logDeliveryFailure = (error: unknown) => {
    console.debug(
      "[desktop-telemetry] event was not delivered",
      error instanceof Error ? error.message : String(error),
    );
  };

  const sendWithRetry = async (eventName: DesktopEvent, forcedState?: DesktopState) => {
    let lastError: unknown;
    for (let attempt = 0; attempt < RETRY_COUNT; attempt += 1) {
      try {
        await send(eventName, forcedState);
        return;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < RETRY_COUNT) {
          await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "delivery failed"));
  };

  const firstOpen = window.localStorage.getItem(FIRST_OPEN_KEY) !== "1";
  if (firstOpen) {
    void sendWithRetry("app_first_open")
      .then(() => window.localStorage.setItem(FIRST_OPEN_KEY, "1"))
      .catch(logDeliveryFailure);
  } else {
    void sendWithRetry("app_open").catch(logDeliveryFailure);
  }

  const noteInteraction = () => {
    lastInteractionAt = Date.now();
  };
  for (const name of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"] as const) {
    window.addEventListener(name, noteInteraction, { passive: true });
  }

  const timer = window.setInterval(() => {
    void sendWithRetry("heartbeat").catch(logDeliveryFailure);
  }, HEARTBEAT_MS);
  const close = () => {
    if (closing) return;
    closing = true;
    window.clearInterval(timer);
    void sendWithRetry("app_close", "closed").catch(logDeliveryFailure);
  };
  window.addEventListener("pagehide", close, { once: true });
  window.addEventListener("beforeunload", close, { once: true });
}
