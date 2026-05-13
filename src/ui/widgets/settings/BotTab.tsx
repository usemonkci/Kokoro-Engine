import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "clsx";
import {
    Bot,
    CheckCircle2,
    Hash,
    KeyRound,
    Loader2,
    MessageCircle,
    Play,
    RefreshCw,
    Send,
    Shield,
    Square,
    Volume2,
    Webhook,
    X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    getTelegramStatus,
    listCharacters,
    saveBotConfig,
    startTelegramBot,
    stopTelegramBot,
} from "../../../lib/kokoro-bridge";
import type {
    BotConfig,
    BotPlatformId,
    CharacterRecord,
    DiscordBotConfig,
    LineBotConfig,
    TelegramConfig,
    TelegramStatus,
    WebhookBotConfig,
} from "../../../lib/kokoro-bridge";
import { inputClasses, labelClasses } from "../../styles/settings-primitives";
import { Select } from "@/components/ui/select";

interface BotTabProps {
    botConfig: BotConfig | null;
    initialStatus?: TelegramStatus | null;
    initialCharacters?: CharacterRecord[];
    onBotConfigChange: (config: BotConfig) => void;
}

export default function BotTab({
    botConfig,
    initialStatus,
    initialCharacters,
    onBotConfigChange,
}: BotTabProps) {
    const { t } = useTranslation();
    const hasInitialStatus = initialStatus !== undefined;
    const hasInitialCharacters = initialCharacters !== undefined;
    const [status, setStatus] = useState<TelegramStatus | null>(initialStatus ?? null);
    const [loading, setLoading] = useState(!(hasInitialStatus && hasInitialCharacters));
    const [dirty, setDirty] = useState(false);
    const [listInput, setListInput] = useState("");
    const [characters, setCharacters] = useState<CharacterRecord[]>(initialCharacters ?? []);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const platformOptions = [
        {
            value: "telegram",
            label: t("bot.platform.telegram"),
            description: t("bot.platform.telegram_desc"),
        },
        {
            value: "discord",
            label: t("bot.platform.discord"),
            description: t("bot.platform.discord_desc"),
        },
        {
            value: "line",
            label: t("bot.platform.line"),
            description: t("bot.platform.line_desc"),
        },
        {
            value: "webhook",
            label: t("bot.platform.webhook"),
            description: t("bot.platform.webhook_desc"),
        },
    ];

    const loadStatus = async () => {
        try {
            const [st, chars] = await Promise.all([
                getTelegramStatus(),
                listCharacters(),
            ]);
            setStatus(st);
            setCharacters(chars);
        } catch (e) {
            console.error("[BotTab] Failed to load status:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (hasInitialStatus) {
            setStatus(initialStatus ?? null);
        }
        if (hasInitialCharacters) {
            setCharacters(initialCharacters ?? []);
        }
        if (hasInitialStatus && hasInitialCharacters) {
            setLoading(false);
        }

        void loadStatus();

        pollRef.current = setInterval(() => {
            getTelegramStatus().then(setStatus).catch(() => {});
        }, 5000);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [hasInitialStatus, hasInitialCharacters, initialStatus, initialCharacters]);

    useEffect(() => {
        setListInput("");
    }, [botConfig?.selected_platform]);

    if (loading || !botConfig) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={20} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
        );
    }

    const selectedPlatform = botConfig.selected_platform;
    const isRunning = status?.running ?? false;

    const updateBotConfig = (next: BotConfig) => {
        onBotConfigChange(next);
        setDirty(true);
    };

    const updateSelectedPlatform = (platform: BotPlatformId) => {
        updateBotConfig({ ...botConfig, selected_platform: platform });
    };

    const updateTelegram = (patch: Partial<TelegramConfig>) => {
        updateBotConfig({ ...botConfig, telegram: { ...botConfig.telegram, ...patch } });
    };

    const updateDiscord = (patch: Partial<DiscordBotConfig>) => {
        updateBotConfig({ ...botConfig, discord: { ...botConfig.discord, ...patch } });
    };

    const updateLine = (patch: Partial<LineBotConfig>) => {
        updateBotConfig({ ...botConfig, line: { ...botConfig.line, ...patch } });
    };

    const updateWebhook = (patch: Partial<WebhookBotConfig>) => {
        updateBotConfig({ ...botConfig, webhook: { ...botConfig.webhook, ...patch } });
    };

    const handleStartTelegram = async () => {
        try {
            if (dirty) {
                await saveBotConfig(botConfig);
                setDirty(false);
            }
            await startTelegramBot();
            const st = await getTelegramStatus();
            setStatus(st);
        } catch (e) {
            console.error("[BotTab] Telegram start failed:", e);
        }
    };

    const handleStopTelegram = async () => {
        try {
            await stopTelegramBot();
            const st = await getTelegramStatus();
            setStatus(st);
        } catch (e) {
            console.error("[BotTab] Telegram stop failed:", e);
        }
    };

    const characterOptions = [
        { value: "", label: t("telegram.character_id.auto") },
        ...characters.map(char => ({
            value: char.id,
            label: char.name,
        })),
    ];

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Bot size={16} strokeWidth={1.5} className="text-[var(--color-accent)]" />
                    <div className="text-sm font-heading font-semibold">{t("bot.title")}</div>
                </div>
                <div>
                    <label className={labelClasses}>{t("bot.platform.label")}</label>
                    <Select
                        value={selectedPlatform}
                        onChange={value => updateSelectedPlatform(value as BotPlatformId)}
                        options={platformOptions}
                    />
                </div>
            </div>

            <div className="h-px bg-[var(--color-border)]" />

            {selectedPlatform === "telegram" && (
                <TelegramSettings
                    config={botConfig.telegram}
                    isRunning={isRunning}
                    characterOptions={characterOptions}
                    onUpdate={updateTelegram}
                    onStart={handleStartTelegram}
                    onStop={handleStopTelegram}
                    onRefresh={loadStatus}
                />
            )}

            {selectedPlatform === "discord" && (
                <DiscordSettings
                    config={botConfig.discord}
                    listInput={listInput}
                    setListInput={setListInput}
                    characterOptions={characterOptions}
                    onUpdate={updateDiscord}
                />
            )}

            {selectedPlatform === "line" && (
                <LineSettings
                    config={botConfig.line}
                    listInput={listInput}
                    setListInput={setListInput}
                    characterOptions={characterOptions}
                    onUpdate={updateLine}
                />
            )}

            {selectedPlatform === "webhook" && (
                <WebhookSettings
                    config={botConfig.webhook}
                    characterOptions={characterOptions}
                    onUpdate={updateWebhook}
                />
            )}
        </div>
    );
}

function PlatformHeader({
    icon: Icon,
    title,
    enabled,
}: {
    icon: typeof Bot;
    title: string;
    enabled: boolean;
}) {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Icon size={16} strokeWidth={1.5} className="text-[var(--color-accent)]" />
                <div>
                    <div className="text-sm font-heading font-semibold">{title}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">
                        {enabled ? t("bot.status.enabled") : t("bot.status.disabled")}
                    </div>
                </div>
                <div className={clsx(
                    "w-2 h-2 rounded-full",
                    enabled ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-muted)]"
                )} />
            </div>
        </div>
    );
}

function ToggleRow({
    label,
    enabled,
    onChange,
    icon: Icon,
}: {
    label: string;
    enabled: boolean;
    onChange: (enabled: boolean) => void;
    icon?: typeof Bot;
}) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={14} className="text-[var(--color-text-muted)]" />}
                <div className="text-sm text-[var(--color-text-secondary)]">{label}</div>
            </div>
            <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => onChange(!enabled)}
                className={clsx(
                    "w-12 h-6 rounded-full relative transition-colors duration-200",
                    enabled
                        ? "bg-[var(--color-accent)]"
                        : "bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
                )}
            >
                <motion.div
                    animate={{ x: enabled ? 24 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={clsx(
                        "w-5 h-5 rounded-full absolute top-0.5",
                        enabled ? "bg-black" : "bg-[var(--color-text-muted)]"
                    )}
                />
            </motion.button>
        </div>
    );
}

function SecretField({
    label,
    value,
    env,
    placeholder,
    hint,
    onValueChange,
    onEnvChange,
}: {
    label: string;
    value?: string;
    env?: string;
    placeholder: string;
    hint: string;
    onValueChange: (value?: string) => void;
    onEnvChange: (value?: string) => void;
}) {
    return (
        <div>
            <label className={labelClasses}>{label}</label>
            <input
                type="password"
                value={value ?? ""}
                onChange={e => onValueChange(e.target.value || undefined)}
                placeholder={placeholder}
                className={inputClasses}
            />
            <div className="mt-2 flex items-center gap-2">
                <KeyRound size={12} className="text-[var(--color-text-muted)]" />
                <input
                    type="text"
                    value={env ?? ""}
                    onChange={e => onEnvChange(e.target.value || undefined)}
                    placeholder={hint}
                    className={clsx(inputClasses, "py-2 text-xs")}
                />
            </div>
        </div>
    );
}

function StringListEditor({
    label,
    description,
    placeholder,
    addLabel,
    values,
    input,
    setInput,
    onChange,
    numeric = false,
}: {
    label: string;
    description: string;
    placeholder: string;
    addLabel: string;
    values: string[];
    input: string;
    setInput: (value: string) => void;
    onChange: (values: string[]) => void;
    numeric?: boolean;
}) {
    const { t } = useTranslation();
    const addValue = () => {
        const trimmed = input.trim();
        if (!trimmed) return;
        if (numeric && !/^-?\d+$/.test(trimmed)) return;
        if (values.includes(trimmed)) return;
        onChange([...values, trimmed]);
        setInput("");
    };

    return (
        <div>
            <label className={labelClasses}>
                <Shield size={12} className="inline mr-1" />
                {label}
            </label>
            <div className="text-xs text-[var(--color-text-muted)] mb-2">
                {description}
            </div>
            <div className="flex gap-2 mb-2">
                <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addValue()}
                    placeholder={placeholder}
                    className={clsx(inputClasses, "flex-1")}
                />
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={addValue}
                    className="px-3 py-2 rounded-md text-xs font-heading
                        bg-[var(--color-bg-surface)] border border-[var(--color-border)]
                        hover:border-[var(--color-accent)] transition-colors"
                >
                    {addLabel}
                </motion.button>
            </div>
            {values.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {values.map(value => (
                        <span
                            key={value}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs
                                bg-[var(--color-bg-surface)] border border-[var(--color-border)]"
                        >
                            {value}
                            <button
                                onClick={() => onChange(values.filter(item => item !== value))}
                                className="text-[var(--color-text-muted)] hover:text-red-400 transition-colors ml-1"
                                aria-label={t("common.actions.delete")}
                                title={t("common.actions.delete")}
                            >
                                <X size={10} strokeWidth={1.8} />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function CharacterSelect({
    value,
    options,
    onChange,
}: {
    value?: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value?: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <div>
            <label className={labelClasses}>{t("telegram.character_id.label")}</label>
            <Select
                value={value ?? ""}
                onChange={v => onChange(v || undefined)}
                options={options}
            />
            <div className="text-xs text-[var(--color-text-muted)] mt-1">
                {t("bot.character_hint")}
            </div>
        </div>
    );
}

function TelegramSettings({
    config,
    isRunning,
    characterOptions,
    onUpdate,
    onStart,
    onStop,
    onRefresh,
}: {
    config: TelegramConfig;
    isRunning: boolean;
    characterOptions: Array<{ value: string; label: string }>;
    onUpdate: (patch: Partial<TelegramConfig>) => void;
    onStart: () => void;
    onStop: () => void;
    onRefresh: () => void;
}) {
    const { t } = useTranslation();
    const [chatIdInput, setChatIdInput] = useState("");

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Send size={16} strokeWidth={1.5} className="text-[var(--color-accent)]" />
                    <div>
                        <div className="text-sm font-heading font-semibold">{t("telegram.title")}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                            {isRunning ? t("telegram.status.running") : t("telegram.status.stopped")}
                        </div>
                    </div>
                    <div className={clsx(
                        "w-2 h-2 rounded-full",
                        isRunning ? "bg-[var(--color-accent)]" : "bg-[var(--color-text-muted)]"
                    )} />
                </div>
                <div className="flex items-center gap-2">
                    {isRunning ? (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={onStop}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-heading
                                bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors"
                        >
                            <Square size={12} /> {t("telegram.stop")}
                        </motion.button>
                    ) : (
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={onStart}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-heading
                                bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30
                                hover:bg-[var(--color-accent)]/30 transition-colors"
                        >
                            <Play size={12} /> {t("telegram.start")}
                        </motion.button>
                    )}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={onRefresh}
                        className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        aria-label={t("common.actions.refresh")}
                        title={t("common.actions.refresh")}
                    >
                        <RefreshCw size={14} />
                    </motion.button>
                </div>
            </div>

            <ToggleRow
                label={t("telegram.auto_start")}
                enabled={config.enabled}
                onChange={enabled => onUpdate({ enabled })}
            />

            <SecretField
                label={t("telegram.bot_token.label")}
                value={config.bot_token}
                env={config.bot_token_env}
                placeholder={t("telegram.bot_token.placeholder")}
                hint="TELEGRAM_BOT_TOKEN"
                onValueChange={value => onUpdate({ bot_token: value })}
                onEnvChange={value => onUpdate({ bot_token_env: value })}
            />

            <StringListEditor
                label={t("telegram.whitelist.label")}
                description={t("telegram.whitelist.desc")}
                placeholder={t("telegram.whitelist.placeholder")}
                addLabel={t("telegram.whitelist.add")}
                values={config.allowed_chat_ids.map(String)}
                input={chatIdInput}
                setInput={setChatIdInput}
                onChange={values => onUpdate({ allowed_chat_ids: values.map(value => Number(value)) })}
                numeric
            />

            <CharacterSelect
                value={config.character_id}
                options={characterOptions}
                onChange={character_id => onUpdate({ character_id })}
            />

            <ToggleRow
                label={t("telegram.voice_reply")}
                enabled={config.send_voice_reply}
                onChange={send_voice_reply => onUpdate({ send_voice_reply })}
                icon={Volume2}
            />
        </div>
    );
}

function DiscordSettings({
    config,
    listInput,
    setListInput,
    characterOptions,
    onUpdate,
}: {
    config: DiscordBotConfig;
    listInput: string;
    setListInput: (value: string) => void;
    characterOptions: Array<{ value: string; label: string }>;
    onUpdate: (patch: Partial<DiscordBotConfig>) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <PlatformHeader icon={MessageCircle} title={t("bot.platform.discord")} enabled={config.enabled} />
            <ToggleRow
                label={t("bot.fields.enable_platform", { platform: t("bot.platform.discord") })}
                enabled={config.enabled}
                onChange={enabled => onUpdate({ enabled })}
                icon={CheckCircle2}
            />
            <SecretField
                label={t("bot.discord.bot_token")}
                value={config.bot_token}
                env={config.bot_token_env}
                placeholder={t("bot.discord.bot_token_placeholder")}
                hint="DISCORD_BOT_TOKEN"
                onValueChange={bot_token => onUpdate({ bot_token })}
                onEnvChange={bot_token_env => onUpdate({ bot_token_env })}
            />
            <ToggleRow
                label={t("bot.discord.allow_dm")}
                enabled={config.allow_direct_messages}
                onChange={allow_direct_messages => onUpdate({ allow_direct_messages })}
                icon={MessageCircle}
            />
            <StringListEditor
                label={t("bot.discord.allowed_channels")}
                description={t("bot.discord.allowed_channels_desc")}
                placeholder={t("bot.discord.channel_placeholder")}
                addLabel={t("telegram.whitelist.add")}
                values={config.allowed_channel_ids}
                input={listInput}
                setInput={setListInput}
                onChange={allowed_channel_ids => onUpdate({ allowed_channel_ids })}
            />
            <CharacterSelect
                value={config.character_id}
                options={characterOptions}
                onChange={character_id => onUpdate({ character_id })}
            />
        </div>
    );
}

function LineSettings({
    config,
    listInput,
    setListInput,
    characterOptions,
    onUpdate,
}: {
    config: LineBotConfig;
    listInput: string;
    setListInput: (value: string) => void;
    characterOptions: Array<{ value: string; label: string }>;
    onUpdate: (patch: Partial<LineBotConfig>) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <PlatformHeader icon={Send} title={t("bot.platform.line")} enabled={config.enabled} />
            <ToggleRow
                label={t("bot.fields.enable_platform", { platform: t("bot.platform.line") })}
                enabled={config.enabled}
                onChange={enabled => onUpdate({ enabled })}
                icon={CheckCircle2}
            />
            <SecretField
                label={t("bot.line.access_token")}
                value={config.channel_access_token}
                env={config.channel_access_token_env}
                placeholder={t("bot.line.access_token_placeholder")}
                hint="LINE_CHANNEL_ACCESS_TOKEN"
                onValueChange={channel_access_token => onUpdate({ channel_access_token })}
                onEnvChange={channel_access_token_env => onUpdate({ channel_access_token_env })}
            />
            <SecretField
                label={t("bot.line.channel_secret")}
                value={config.channel_secret}
                env={config.channel_secret_env}
                placeholder={t("bot.line.channel_secret_placeholder")}
                hint="LINE_CHANNEL_SECRET"
                onValueChange={channel_secret => onUpdate({ channel_secret })}
                onEnvChange={channel_secret_env => onUpdate({ channel_secret_env })}
            />
            <div>
                <label className={labelClasses}>{t("bot.line.webhook_path")}</label>
                <input
                    type="text"
                    value={config.webhook_path}
                    onChange={e => onUpdate({ webhook_path: e.target.value || "/line/webhook" })}
                    placeholder="/line/webhook"
                    className={inputClasses}
                />
            </div>
            <StringListEditor
                label={t("bot.line.allowed_users")}
                description={t("bot.line.allowed_users_desc")}
                placeholder={t("bot.line.user_placeholder")}
                addLabel={t("telegram.whitelist.add")}
                values={config.allowed_user_ids}
                input={listInput}
                setInput={setListInput}
                onChange={allowed_user_ids => onUpdate({ allowed_user_ids })}
            />
            <CharacterSelect
                value={config.character_id}
                options={characterOptions}
                onChange={character_id => onUpdate({ character_id })}
            />
        </div>
    );
}

function WebhookSettings({
    config,
    characterOptions,
    onUpdate,
}: {
    config: WebhookBotConfig;
    characterOptions: Array<{ value: string; label: string }>;
    onUpdate: (patch: Partial<WebhookBotConfig>) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <PlatformHeader icon={Webhook} title={t("bot.platform.webhook")} enabled={config.enabled} />
            <ToggleRow
                label={t("bot.fields.enable_platform", { platform: t("bot.platform.webhook") })}
                enabled={config.enabled}
                onChange={enabled => onUpdate({ enabled })}
                icon={CheckCircle2}
            />
            <div className="grid grid-cols-[1fr_110px] gap-3">
                <div>
                    <label className={labelClasses}>{t("bot.webhook.bind_host")}</label>
                    <input
                        type="text"
                        value={config.bind_host}
                        onChange={e => onUpdate({ bind_host: e.target.value || "127.0.0.1" })}
                        placeholder="127.0.0.1"
                        className={inputClasses}
                    />
                </div>
                <div>
                    <label className={labelClasses}>{t("bot.webhook.port")}</label>
                    <input
                        type="number"
                        min={1}
                        max={65535}
                        value={config.port}
                        onChange={e => onUpdate({ port: Number(e.target.value) || 8787 })}
                        className={inputClasses}
                    />
                </div>
            </div>
            <div>
                <label className={labelClasses}>{t("bot.webhook.endpoint_path")}</label>
                <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        type="text"
                        value={config.endpoint_path}
                        onChange={e => onUpdate({ endpoint_path: e.target.value || "/webhook/message" })}
                        placeholder="/webhook/message"
                        className={clsx(inputClasses, "pl-9")}
                    />
                </div>
            </div>
            <SecretField
                label={t("bot.webhook.bearer_token")}
                value={config.bearer_token}
                env={config.bearer_token_env}
                placeholder={t("bot.webhook.bearer_token_placeholder")}
                hint="KOKORO_WEBHOOK_TOKEN"
                onValueChange={bearer_token => onUpdate({ bearer_token })}
                onEnvChange={bearer_token_env => onUpdate({ bearer_token_env })}
            />
            <CharacterSelect
                value={config.character_id}
                options={characterOptions}
                onChange={character_id => onUpdate({ character_id })}
            />
        </div>
    );
}
