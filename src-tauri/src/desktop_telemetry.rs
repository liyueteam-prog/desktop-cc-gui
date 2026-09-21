use serde::{Deserialize, Serialize};
use std::time::Duration;

const DESKTOP_TELEMETRY_URL: &str = "https://www.dayueai.fun/api/desktop/events";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopTelemetryInput {
    pub event_id: String,
    pub event_name: String,
    pub install_id: String,
    pub state: String,
    #[serde(default)]
    pub active_seconds: u64,
    #[serde(default)]
    pub idle_seconds: u64,
    #[serde(default)]
    pub background_seconds: u64,
    #[serde(default)]
    pub session_id: String,
}

#[derive(Debug, Serialize)]
struct DesktopTelemetryPayload<'a> {
    event_id: &'a str,
    event_name: &'a str,
    install_id: &'a str,
    state: &'a str,
    active_seconds: u64,
    idle_seconds: u64,
    background_seconds: u64,
    session_id: &'a str,
    platform: &'static str,
    arch: &'static str,
    app_version: &'static str,
    channel: &'static str,
}

fn valid_identifier(value: &str) -> bool {
    (8..=96).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

#[tauri::command]
pub(crate) async fn desktop_telemetry_event(payload: DesktopTelemetryInput) -> Result<(), String> {
    const EVENTS: [&str; 4] = ["app_first_open", "app_open", "heartbeat", "app_close"];
    const STATES: [&str; 4] = ["active", "idle", "background", "closed"];
    if !EVENTS.contains(&payload.event_name.as_str()) {
        return Err("unsupported desktop telemetry event".to_string());
    }
    if !STATES.contains(&payload.state.as_str()) {
        return Err("unsupported desktop telemetry state".to_string());
    }
    if !valid_identifier(&payload.install_id) || !valid_identifier(&payload.event_id) {
        return Err("invalid desktop telemetry identifier".to_string());
    }

    let body = DesktopTelemetryPayload {
        event_id: &payload.event_id,
        event_name: &payload.event_name,
        install_id: &payload.install_id,
        state: &payload.state,
        active_seconds: payload.active_seconds.min(300),
        idle_seconds: payload.idle_seconds.min(300),
        background_seconds: payload.background_seconds.min(300),
        session_id: &payload.session_id,
        platform: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        app_version: env!("CARGO_PKG_VERSION"),
        channel: "desktop-app",
    };
    let response = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("desktop telemetry client: {error}"))?
        .post(DESKTOP_TELEMETRY_URL)
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("desktop telemetry request: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("desktop telemetry HTTP {}", response.status()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::valid_identifier;

    #[test]
    fn accepts_uuid_like_identifiers_only() {
        assert!(valid_identifier("cfa4bd70-8c2a-45cd-bc85-00e94aab252e"));
        assert!(!valid_identifier("short"));
        assert!(!valid_identifier("not safe/value"));
    }
}
