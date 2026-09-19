import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Cloud from "lucide-react/dist/esm/icons/cloud";
import Eye from "lucide-react/dist/esm/icons/eye";
import EyeOff from "lucide-react/dist/esm/icons/eye-off";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Globe from "lucide-react/dist/esm/icons/globe";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { TextArea } from "@/components/base/input/textarea";
import { EngineIcon } from "@/components/foundations/icons/engine-icon";
import { openExternal } from "@/lib/platform";
import { cx } from "@/utils/cx";
import type { EngineId } from "./providers";
import {
  CLAUDE_MODEL_SLOTS,
  DAYUE_API_KEYS_URL,
  RUYUAN_ANTHROPIC_BASE_URL,
  RUYUAN_OPENAI_BASE_URL,
  isOfficialAnthropicEndpoint,
  type ClaudeModelSlot,
  type ProviderPreset,
} from "./providerPresets";
import type { ProviderForm } from "./useProviderForm";
const slotLabelKey = (slot: ClaudeModelSlot) =>
  `settings.cli${slot.charAt(0).toUpperCase()}${slot.slice(1)}Model`;

function isRuyuanProvider(engine: EngineId, form: ProviderForm): boolean {
  const baseUrl = engine === "codex" ? form.value.configToml : form.value.baseUrl;
  return (
    form.matchedPreset?.name === "如愿AI" ||
    form.value.name.trim() === "如愿AI" ||
    baseUrl.includes(RUYUAN_OPENAI_BASE_URL) ||
    baseUrl.includes(RUYUAN_ANTHROPIC_BASE_URL)
  );
}

function RuyuanApiKeyButton() {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      leadingIcon={ExternalLink}
      className="text-text-secondary hover:text-text-primary"
      onClick={() => openExternal(DAYUE_API_KEYS_URL)}
    >
      {t("settings.cliGetRuyuanApiKey")}
    </Button>
  );
}

/** Friendly API form used by the RuYuanAI hub. The underlying CLI-specific
 * TOML/JSON is generated on submit, so regular users never need to edit code. */
export function RuyuanSimpleProviderFields({
  engine: _engine,
  form,
}: {
  engine: EngineId;
  form: ProviderForm;
}) {
  const { t } = useTranslation();
  const [showKey, setShowKey] = useState(false);
  const { value, patch } = form;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label={t("settings.cliName")}
          isRequired
          size="small"
          placeholder={t("settings.cliNamePlaceholder")}
          value={value.name}
          onChange={(name) => patch({ name })}
          autoFocus
        />
        <Input
          label={t("settings.cliRemark")}
          size="small"
          placeholder={t("settings.cliRemarkPlaceholder")}
          value={value.remark}
          onChange={(remark) => patch({ remark })}
        />
        <Input
          label={t("settings.cliBaseUrl")}
          isRequired
          size="small"
          placeholder="https://…"
          value={value.baseUrl}
          onChange={(baseUrl) => patch({ baseUrl })}
        />
        <div className="relative flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-medium text-text-primary">
              {t("settings.cliApiKey")}
              <span aria-hidden="true" className="text-text-error-primary">*</span>
            </span>
            <RuyuanApiKeyButton />
          </div>
          <Input
            aria-label={t("settings.cliApiKey")}
            isRequired
            size="small"
            type={showKey ? "text" : "password"}
            placeholder="sk-..."
            value={value.apiKey}
            onChange={(apiKey) => patch({ apiKey })}
            fieldClassName="pr-8"
          />
          <button
            type="button"
            aria-label={showKey ? t("settings.cliHideApiKey") : t("settings.cliShowApiKey")}
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2 bottom-1.5 flex size-5 items-center justify-center rounded text-foreground-icon-tertiary hover:text-foreground-icon-primary"
          >
            {showKey ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border-button-default bg-background-secondary-default p-2">
          <TestConnectionControl
            testing={form.testing}
            error={form.testError}
            success={form.testSuccess}
            disabled={!value.baseUrl.trim() || !value.apiKey.trim()}
            onTest={() => void form.handleTestConnection()}
          />
          <FetchModelsControl
            fetching={form.fetching}
            error={form.fetchError}
            count={form.fetchedModels.length}
            disabled={!value.baseUrl.trim() || !value.apiKey.trim()}
            onFetch={() => void form.handleFetchModels()}
          />
        </div>
        <FetchedModelInput
          label={t("settings.cliModel")}
          placeholder={t("settings.cliModelPlaceholder")}
          models={form.fetchedModels}
          value={value.model}
          onChange={(model) => patch({ model })}
        />
        {form.fetchedModels.length > 0 && (
          <p className="text-body-2-regular text-text-tertiary">
            {t("settings.cliSelectFetchedModel")}
          </p>
        )}
      </div>
      <p className="text-body-2-regular text-text-tertiary">
        {t("settings.ruyuanSimpleFormHint")}
      </p>
    </div>
  );
}

/** Brand mark for a preset button: explicit per-preset assets keep relay
 *  providers distinct from the model they happen to serve by default. */
function PresetIcon({ preset }: { preset: ProviderPreset }) {
  return (
    <img
      src={preset.iconSrc}
      alt=""
      className={cx("size-3.5 object-contain", preset.iconClassName)}
      aria-hidden
    />
  );
}

/** Official direct-connection card (claude/codex); selecting it pins the
 *  channel to the vendor's own endpoint. */
function OfficialPresetSection({
  engine,
  official,
  onSelect,
}: {
  engine: EngineId;
  official: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const isClaude = engine === "claude";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-2-medium text-text-secondary">
        {t("settings.cliOfficialSection")}
      </p>
      <button
        type="button"
        aria-pressed={official}
        onClick={onSelect}
        className={cx(
          "flex w-full cursor-pointer items-center gap-3 rounded-2lg border p-3 text-left transition-colors",
          official
            ? "border-border-focus-ring bg-background-secondary-default"
            : "border-border-button-default hover:bg-background-secondary-hover",
        )}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-tertiary-default text-foreground-icon-primary">
          <EngineIcon engine={engine} size={16} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-medium text-text-primary">
            {isClaude ? t("settings.cliOfficialPreset") : t("settings.cliCodexOfficialPreset")}
          </span>
          <span className="text-body-2-regular text-text-secondary">
            {isClaude
              ? t("settings.cliOfficialPresetDesc")
              : t("settings.cliCodexOfficialPresetDesc")}
          </span>
        </span>
      </button>
    </div>
  );
}

/** Third-party relay preset grid, plus the 自定义配置 escape hatch that
 *  unlocks the URL without prefilling anything. */
function ProxyPresetSection({
  engine,
  presets,
  official,
  matchedPreset,
  onSelectCustom,
  onSelectPreset,
}: {
  engine: EngineId;
  presets: ProviderPreset[];
  official: boolean;
  matchedPreset: ProviderPreset | undefined;
  onSelectCustom: () => void;
  onSelectPreset: (preset: ProviderPreset) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-2-medium text-text-secondary">
        {t("settings.cliProxySection")}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {/* 自定义配置: pure escape hatch — unlocks the URL without
            prefilling anything. */}
        <button
          type="button"
          aria-pressed={!official && !matchedPreset}
          onClick={onSelectCustom}
          className={cx(
            "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-body-2-regular transition-colors",
            !official && !matchedPreset
              ? "border-border-focus-ring bg-background-secondary-default text-text-primary"
              : "border-border-button-default text-text-secondary hover:bg-background-secondary-hover",
          )}
        >
          <Globe className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t("settings.cliPresetCustom")}</span>
        </button>
        {presets.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-pressed={matchedPreset?.name === preset.name}
            onClick={() => onSelectPreset(preset)}
            className={cx(
              "flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-2 text-body-2-regular transition-colors",
              matchedPreset?.name === preset.name
                ? "border-border-focus-ring bg-background-secondary-default text-text-primary"
                : "border-border-button-default text-text-secondary hover:bg-background-secondary-hover",
            )}
          >
            <span className="shrink-0 text-foreground-icon-secondary">
              <PresetIcon preset={preset} />
            </span>
            <span className="truncate">{preset.name}</span>
          </button>
        ))}
      </div>
      {engine === "claude" && (
        <p className="text-body-2-regular text-text-tertiary">
          {t("settings.cliProxyHint")}
        </p>
      )}
    </div>
  );
}

/** 拉取模型 action plus its result/error readout. */
function FetchModelsControl({
  fetching,
  error,
  count,
  disabled,
  onFetch,
}: {
  fetching: boolean;
  error: string;
  count: number;
  disabled: boolean;
  onFetch: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="primary"
        size="small"
        leadingIcon={RefreshCw}
        onClick={onFetch}
        disabled={fetching || disabled}
      >
        {fetching ? t("settings.cliFetchModelsLoading") : t("settings.cliFetchModels")}
      </Button>
      {error ? (
        <span className="text-body-2-regular text-text-error-primary">{error}</span>
      ) : count > 0 ? (
        <span className="text-body-2-regular text-text-tertiary">
          {t("settings.cliFetchModelsCount", { count })}
        </span>
      ) : null}
    </div>
  );
}

function TestConnectionControl({
  testing,
  error,
  success,
  disabled,
  onTest,
}: {
  testing: boolean;
  error: string;
  success: string;
  disabled: boolean;
  onTest: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        size="small"
        leadingIcon={CheckCircle2}
        onClick={onTest}
        disabled={testing || disabled}
      >
        {testing ? t("settings.cliTestConnectionLoading") : t("settings.cliTestConnection")}
      </Button>
      {error ? (
        <span className="text-body-2-regular text-text-error-primary">{error}</span>
      ) : success ? (
        <span className="text-body-2-regular text-notification-success-foreground">{success}</span>
      ) : null}
    </div>
  );
}

/**
 * A real in-app model picker instead of a native <datalist>.
 *
 * WebView2 renders datalist suggestions inconsistently, and the native arrow
 * can appear without opening a menu. This picker keeps the field editable for
 * custom model IDs while making the fetched list explicit and clickable.
 */
function FetchedModelInput({
  label,
  placeholder,
  models,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  models: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  const filteredModels = filtering
    ? models.filter((model) => model.toLowerCase().includes(value.trim().toLowerCase()))
    : models;

  return (
    <div ref={rootRef} className="relative">
      <Input
        ref={inputRef}
        label={label}
        size="small"
        placeholder={placeholder}
        value={value}
        onFocus={() => {
          if (models.length > 0) {
            setFiltering(false);
            setOpen(true);
          }
        }}
        onChange={(nextValue) => {
          onChange(nextValue);
          setFiltering(true);
          if (models.length > 0) setOpen(true);
        }}
        fieldClassName="pr-10"
        aria-expanded={open}
        aria-haspopup="listbox"
      />
      {models.length > 0 && (
        <button
          type="button"
          aria-label={open ? t("settings.cliCloseModelList") : t("settings.cliOpenModelList")}
          aria-expanded={open}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            setFiltering(false);
            setOpen((current) => !current);
          }}
          className="absolute right-2 top-[1.75rem] flex size-6 items-center justify-center rounded-md text-foreground-icon-secondary transition-colors hover:bg-background-secondary-hover hover:text-foreground-icon-primary"
        >
          <ChevronDown className={cx("size-4 transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      )}
      {open && models.length > 0 && (
        <div
          role="listbox"
          aria-label={label}
          className="absolute bottom-full left-0 right-0 z-50 mb-1 max-h-64 overflow-y-auto rounded-xl border border-border-button-default bg-background-primary-default p-1 shadow-lg"
        >
          <div className="px-3 py-2 text-body-2-regular text-text-tertiary">
            {t("settings.cliFetchedModelsMenuHint", { count: models.length })}
          </div>
          {filteredModels.length > 0 ? (
            filteredModels.map((model) => (
              <button
                key={model}
                type="button"
                role="option"
                aria-selected={model === value}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(model);
                  setFiltering(false);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center rounded-lg px-3 py-2 text-left text-body-2-regular text-text-primary transition-colors hover:bg-background-secondary-hover",
                  model === value && "bg-background-secondary-default font-medium",
                )}
              >
                <span className="truncate">{model}</span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-body-2-regular text-text-tertiary">
              {t("settings.cliFetchedModelsNoMatch")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Official card (claude/codex only) plus the relay preset grid. */
export function ProviderPresetSections({
  engine,
  form,
}: {
  engine: EngineId;
  form: ProviderForm;
}) {
  const isClaude = engine === "claude";
  const isCodex = engine === "codex";
  return (
    <>
      {(isClaude || isCodex) && (
        <OfficialPresetSection
          engine={engine}
          official={form.official}
          onSelect={form.selectOfficial}
        />
      )}
      {form.presets.length > 0 && (
        <ProxyPresetSection
          engine={engine}
          presets={form.presets}
          official={form.official}
          matchedPreset={form.matchedPreset}
          onSelectCustom={form.selectCustom}
          onSelectPreset={form.selectPreset}
        />
      )}
    </>
  );
}

/** name/remark plus the flat URL/key pair (hidden for codex, which edits
 *  config.toml/auth.json instead). The claude fields mirror every keystroke
 *  into the JSON editor's env. */
export function ProviderBasicFields({
  engine,
  form,
}: {
  engine: EngineId;
  form: ProviderForm;
}) {
  const { t } = useTranslation();
  const isClaude = engine === "claude";
  const isCodex = engine === "codex";
  const [showKey, setShowKey] = useState(false);
  const { value, patch } = form;
  const showRuyuanKeyLink = !form.official && isRuyuanProvider(engine, form);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input
        label={t("settings.cliName")}
        isRequired
        size="small"
        placeholder={t("settings.cliNamePlaceholder")}
        value={value.name}
        onChange={(name) => patch({ name })}
        autoFocus
      />
      <Input
        label={t("settings.cliRemark")}
        size="small"
        placeholder={t("settings.cliRemarkPlaceholder")}
        value={value.remark}
        onChange={(remark) => patch({ remark })}
      />
      {!isCodex && (
        <Input
          label={t("settings.cliBaseUrl")}
          isRequired
          size="small"
          placeholder="https://…"
          value={value.baseUrl}
          onChange={(baseUrl) => {
            patch({ baseUrl });
            if (isClaude) form.updateClaudeEnv("ANTHROPIC_BASE_URL", baseUrl);
          }}
          isDisabled={form.official}
        />
      )}
      {!isCodex && (
        <div className="relative flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-body-medium text-text-primary">
              {t("settings.cliApiKey")}
              <span aria-hidden="true" className="text-text-error-primary">*</span>
            </span>
            {showRuyuanKeyLink && <RuyuanApiKeyButton />}
          </div>
          <Input
            aria-label={t("settings.cliApiKey")}
            isRequired
            size="small"
            type={showKey ? "text" : "password"}
            placeholder={isClaude ? "sk-ant-..." : "…"}
            value={value.apiKey}
            onChange={(apiKey) => {
              patch({ apiKey });
              if (isClaude) form.updateClaudeEnv("ANTHROPIC_AUTH_TOKEN", apiKey);
            }}
            fieldClassName="pr-8"
          />
          <button
            type="button"
            aria-label={t("settings.cliApiKey")}
            onClick={() => setShowKey((s) => !s)}
            className="absolute right-2 bottom-1.5 flex size-5 items-center justify-center rounded text-foreground-icon-tertiary hover:text-foreground-icon-primary"
          >
            {showKey ? (
              <EyeOff className="size-4" aria-hidden />
            ) : (
              <Eye className="size-4" aria-hidden />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

/** Claude-only blocks: relay warning, 模型映射 slot inputs, and the
 *  collapsible JSON 配置 editor. */
export function ClaudeFormSections({
  engine,
  form,
}: {
  engine: EngineId;
  form: ProviderForm;
}) {
  const { t } = useTranslation();
  const [jsonOpen, setJsonOpen] = useState(true);
  if (engine !== "claude") return null;
  const { value, slots, setSlots } = form;
  return (
    <>
      {!isOfficialAnthropicEndpoint(value.baseUrl) && (
        <div className="flex items-center gap-1.5 rounded-lg border border-border-button-default bg-background-secondary-default px-3 py-2 text-body-2-regular text-text-secondary">
          <Cloud className="size-3.5 shrink-0" aria-hidden />
          <span>{t("settings.cliProxyWarning")}</span>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-body-medium text-text-primary">
            {t("settings.cliModelMapping")}
          </p>
          <FetchModelsControl
            fetching={form.fetching}
            error={form.fetchError}
            count={form.fetchedModels.length}
            disabled={!value.baseUrl.trim()}
            onFetch={() => void form.handleFetchModels()}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CLAUDE_MODEL_SLOTS.map(({ slot, envKey }) => (
            <FetchedModelInput
              key={slot}
              label={t(slotLabelKey(slot))}
              placeholder={t(`${slotLabelKey(slot)}Placeholder`)}
              models={form.fetchedModels}
              value={slots[slot]}
              onChange={(model) => {
                setSlots((s) => ({ ...s, [slot]: model }));
                form.updateClaudeEnv(envKey, model);
              }}
            />
          ))}
        </div>
        <p className="text-body-2-regular text-text-tertiary">
          {t("settings.cliModelMappingHint")}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-expanded={jsonOpen}
            onClick={() => setJsonOpen((o) => !o)}
            className="flex items-center gap-1 text-body-medium text-text-primary"
          >
            <ChevronDown
              className={cx("size-3.5 transition-transform", !jsonOpen && "-rotate-90")}
              aria-hidden
            />
            {t("settings.cliJsonConfig")}
          </button>
          <button
            type="button"
            onClick={form.handleFormatJson}
            className="rounded-lg border border-border-button-default px-2 py-0.5 text-body-2-medium text-text-secondary transition-colors hover:bg-background-secondary-hover"
          >
            {t("settings.cliFormatJson")}
          </button>
        </div>
        {jsonOpen && (
          <>
            <p className="text-body-2-regular text-text-tertiary">
              {t("settings.cliJsonConfigDesc")}
            </p>
            <TextArea
              mono
              rows={14}
              spellCheck={false}
              aria-label={t("settings.cliJsonConfig")}
              value={value.settingsJson}
              onChange={form.onJsonChange}
              isInvalid={!form.jsonValid}
              hint={form.jsonError || undefined}
              inputClassName="whitespace-pre"
            />
          </>
        )}
      </div>
    </>
  );
}

/** Flat engines (kimi/grok/pi/omp/dsh): 拉取模型 plus the model input fed by
 *  the shared datalist. */
export function FlatModelSection({
  engine,
  form,
}: {
  engine: EngineId;
  form: ProviderForm;
}) {
  const { t } = useTranslation();
  if (engine === "claude" || engine === "codex") return null;
  return (
    <div className="flex flex-col gap-2">
      <FetchModelsControl
        fetching={form.fetching}
        error={form.fetchError}
        count={form.fetchedModels.length}
        disabled={!form.value.baseUrl.trim()}
        onFetch={() => void form.handleFetchModels()}
      />
      <FetchedModelInput
        label={t("settings.cliModel")}
        models={form.fetchedModels}
        value={form.value.model}
        onChange={(model) => form.patch({ model })}
      />
    </div>
  );
}

/** Codex-only editors: config.toml plus auth.json with its format button. */
export function CodexFormSections({
  engine,
  form,
}: {
  engine: EngineId;
  form: ProviderForm;
}) {
  const { t } = useTranslation();
  if (engine !== "codex") return null;
  const { value, patch } = form;
  return (
    <>
      <TextArea
        mono
        rows={10}
        spellCheck={false}
        label={t("settings.cliConfigToml")}
        hint={t("settings.cliConfigTomlHint")}
        value={value.configToml}
        onChange={(configToml) => patch({ configToml })}
        inputClassName="whitespace-pre"
      />
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <p className="text-body-medium text-text-primary">
              {t("settings.cliAuthJson")}
            </p>
            {isRuyuanProvider(engine, form) && <RuyuanApiKeyButton />}
          </div>
          <button
            type="button"
            onClick={form.handleFormatAuthJson}
            className="rounded-lg border border-border-button-default px-2 py-0.5 text-body-2-medium text-text-secondary transition-colors hover:bg-background-secondary-hover"
          >
            {t("settings.cliFormatJson")}
          </button>
        </div>
        <TextArea
          mono
          rows={4}
          spellCheck={false}
          aria-label={t("settings.cliAuthJson")}
          value={value.authJson}
          onChange={(authJson) => {
            patch({ authJson });
            form.setAuthError("");
          }}
          isInvalid={!form.authValid}
          hint={form.authError || t("settings.cliAuthJsonHint")}
          inputClassName="whitespace-pre"
        />
      </div>
    </>
  );
}
