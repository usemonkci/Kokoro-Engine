use crate::error::KokoroError;
use crate::telegram::TelegramService;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct BotConfig {
    pub selected_platform: String,
    pub telegram: crate::telegram::TelegramConfig,
    pub discord: DiscordBotConfig,
    pub line: LineBotConfig,
    pub webhook: WebhookBotConfig,
}

impl Default for BotConfig {
    fn default() -> Self {
        Self {
            selected_platform: "telegram".to_string(),
            telegram: crate::telegram::TelegramConfig::default(),
            discord: DiscordBotConfig::default(),
            line: LineBotConfig::default(),
            webhook: WebhookBotConfig::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct DiscordBotConfig {
    pub enabled: bool,
    pub bot_token: Option<String>,
    pub bot_token_env: Option<String>,
    pub allowed_channel_ids: Vec<String>,
    pub allow_direct_messages: bool,
    pub character_id: Option<String>,
}

impl Default for DiscordBotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            bot_token: None,
            bot_token_env: Some("DISCORD_BOT_TOKEN".to_string()),
            allowed_channel_ids: Vec::new(),
            allow_direct_messages: true,
            character_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct LineBotConfig {
    pub enabled: bool,
    pub channel_access_token: Option<String>,
    pub channel_access_token_env: Option<String>,
    pub channel_secret: Option<String>,
    pub channel_secret_env: Option<String>,
    pub webhook_path: String,
    pub allowed_user_ids: Vec<String>,
    pub character_id: Option<String>,
}

impl Default for LineBotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            channel_access_token: None,
            channel_access_token_env: Some("LINE_CHANNEL_ACCESS_TOKEN".to_string()),
            channel_secret: None,
            channel_secret_env: Some("LINE_CHANNEL_SECRET".to_string()),
            webhook_path: "/line/webhook".to_string(),
            allowed_user_ids: Vec::new(),
            character_id: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(default)]
pub struct WebhookBotConfig {
    pub enabled: bool,
    pub bind_host: String,
    pub port: u16,
    pub endpoint_path: String,
    pub bearer_token: Option<String>,
    pub bearer_token_env: Option<String>,
    pub character_id: Option<String>,
}

impl Default for WebhookBotConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            bind_host: "127.0.0.1".to_string(),
            port: 8787,
            endpoint_path: "/webhook/message".to_string(),
            bearer_token: None,
            bearer_token_env: Some("KOKORO_WEBHOOK_TOKEN".to_string()),
            character_id: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct BotStatus {
    pub telegram: BotPlatformStatus,
    pub discord: BotPlatformStatus,
    pub line: BotPlatformStatus,
    pub webhook: BotPlatformStatus,
}

#[derive(Debug, Serialize)]
pub struct BotPlatformStatus {
    pub enabled: bool,
    pub configured: bool,
    pub running: bool,
}

fn app_data_dir() -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("com.chyin.kokoro")
}

pub(crate) fn bot_config_path() -> PathBuf {
    app_data_dir().join("bot_config.json")
}

fn legacy_telegram_config_path() -> PathBuf {
    app_data_dir().join("telegram_config.json")
}

fn load_legacy_telegram_config() -> Option<crate::telegram::TelegramConfig> {
    let path = legacy_telegram_config_path();
    if path.exists() {
        Some(crate::telegram::load_config(&path))
    } else {
        None
    }
}

pub(crate) fn load_bot_config() -> BotConfig {
    let path = bot_config_path();
    let mut config: BotConfig = crate::config::load_json_config(&path, "BOT");
    let Some(legacy_telegram) = load_legacy_telegram_config() else {
        return config;
    };

    if !path.exists() || config.telegram == crate::telegram::TelegramConfig::default() {
        config.telegram = legacy_telegram;
        if let Err(error) = save_bot_config_file(&config) {
            tracing::warn!(
                target: "bot",
                "failed to migrate telegram_config.json into bot_config.json: {}",
                error
            );
        }
    }

    config
}

pub(crate) fn save_bot_config_file(config: &BotConfig) -> Result<(), KokoroError> {
    crate::config::save_json_config(&bot_config_path(), config, "BOT")
}

fn has_secret(value: &Option<String>, env: &Option<String>) -> bool {
    crate::config::resolve_api_key(value, env).is_some()
}

fn platform_status(enabled: bool, configured: bool) -> BotPlatformStatus {
    BotPlatformStatus {
        enabled,
        configured,
        running: false,
    }
}

#[tauri::command]
pub async fn get_bot_config() -> Result<BotConfig, KokoroError> {
    Ok(load_bot_config())
}

#[tauri::command]
pub async fn save_bot_config(
    state: State<'_, TelegramService>,
    config: BotConfig,
) -> Result<(), KokoroError> {
    save_bot_config_file(&config)?;
    state.update_config(config.telegram.clone()).await;
    Ok(())
}

#[tauri::command]
pub async fn get_bot_status(state: State<'_, TelegramService>) -> Result<BotStatus, KokoroError> {
    let config = load_bot_config();
    Ok(BotStatus {
        telegram: BotPlatformStatus {
            enabled: config.telegram.enabled,
            configured: config.telegram.resolve_bot_token().is_some(),
            running: state.is_running().await,
        },
        discord: platform_status(
            config.discord.enabled,
            has_secret(&config.discord.bot_token, &config.discord.bot_token_env),
        ),
        line: platform_status(
            config.line.enabled,
            has_secret(
                &config.line.channel_access_token,
                &config.line.channel_access_token_env,
            ) && has_secret(&config.line.channel_secret, &config.line.channel_secret_env),
        ),
        webhook: platform_status(
            config.webhook.enabled,
            has_secret(
                &config.webhook.bearer_token,
                &config.webhook.bearer_token_env,
            ),
        ),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bot_config_defaults_cover_all_non_telegram_platforms() {
        let config = BotConfig::default();
        assert_eq!(config.selected_platform, "telegram");
        assert_eq!(config.telegram.bot_token_env.as_deref(), Some("TELEGRAM_BOT_TOKEN"));
        assert_eq!(config.discord.bot_token_env.as_deref(), Some("DISCORD_BOT_TOKEN"));
        assert_eq!(
            config.line.channel_access_token_env.as_deref(),
            Some("LINE_CHANNEL_ACCESS_TOKEN")
        );
        assert_eq!(config.line.webhook_path, "/line/webhook");
        assert_eq!(config.webhook.bind_host, "127.0.0.1");
        assert_eq!(config.webhook.port, 8787);
    }

    #[test]
    fn bot_config_deserializes_partial_files_with_defaults() {
        let config: BotConfig = serde_json::from_str(r#"{"selected_platform":"discord"}"#).unwrap();
        assert_eq!(config.selected_platform, "discord");
        assert!(config.discord.allow_direct_messages);
        assert_eq!(config.webhook.endpoint_path, "/webhook/message");
    }
}
