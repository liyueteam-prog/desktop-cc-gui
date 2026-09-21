use serde::{Deserialize, Serialize};
use std::time::Duration;

const DESKTOP_IDENTITY_BIND_URL: &str = "https://www.dayueai.fun/api/desktop/bind";
const DESKTOP_TELEMETRY_URLS: [&str; 2] = [
    "https://www.dayueai.fun/api/desktop/events",
    "http://103.103.64.187:9900/api/desktop/events",
];

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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopIdentityBindInput {
    pub install_id: String,
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Serialize)]
struct DesktopIdentityBindPayload<'a> {
    install_id: &'a str,
    base_url: &'a str,
    app_version: &'static str,
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

fn is_ruyuan_https_url(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };
    let Some(host) = url.host_str().map(|value| value.to_ascii_lowercase()) else {
        return false;
    };
    url.scheme() == "https" && (host == "dayueai.fun" || host.ends_with(".dayueai.fun"))
}

fn valid_identifier(value: &str) -> bool {
    (8..=96).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
}

#[tauri::command]
pub(crate) async fn desktop_bind_identity(payload: DesktopIdentityBindInput) -> Result<(), String> {
    if !valid_identifier(&payload.install_id) {
        return Err("invalid desktop install identifier".to_string());
    }
    if !is_ruyuan_https_url(&payload.base_url) {
        return Err("identity binding is only available for RuYuanAI HTTPS API URLs".to_string());
    }
    let api_key = payload.api_key.trim();
    if !(16..=256).contains(&api_key.len()) || api_key.chars().any(|ch| ch == '\r' || ch == '\n') {
        return Err("invalid API key".to_string());
    }
    let body = DesktopIdentityBindPayload {
        install_id: &payload.install_id,
        base_url: &payload.base_url,
        app_version: env!("CARGO_PKG_VERSION"),
    };
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|_| "identity binding client unavailable".to_string())?;
    let response = client
        .post(DESKTOP_IDENTITY_BIND_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|_| "identity binding request failed".to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "identity binding failed: HTTP {}",
            response.status()
        ))
    }
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
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(4))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| format!("desktop telemetry client: {error}"))?;
    let mut errors = Vec::new();
    for url in DESKTOP_TELEMETRY_URLS {
        match client.post(url).json(&body).send().await {
            Ok(response) if response.status().is_success() => return Ok(()),
            Ok(response) => errors.push(format!("{url}: HTTP {}", response.status())),
            Err(error) => errors.push(format!("{url}: {error}")),
        }
    }
    Err(format!(
        "desktop telemetry delivery failed: {}",
        errors.join("; ")
    ))
}

#[cfg(test)]
mod tests {
    use super::{is_ruyuan_https_url, valid_identifier};

    #[test]
    fn accepts_uuid_like_identifiers_only() {
        assert!(valid_identifier("cfa4bd70-8c2a-45cd-bc85-00e94aab252e"));
        assert!(!valid_identifier("short"));
        assert!(!valid_identifier("not safe/value"));
    }

    #[test]
    fn binds_only_ruyuan_https_hosts() {
        assert!(is_ruyuan_https_url("https://www.dayueai.fun/v1"));
        assert!(is_ruyuan_https_url("https://api2.dayueai.fun/v1"));
        assert!(!is_ruyuan_https_url("http://www.dayueai.fun/v1"));
        assert!(!is_ruyuan_https_url("https://dayueai.fun.evil.example/v1"));
        assert!(!is_ruyuan_https_url("https://api.openai.com/v1"));
    }
}
