import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { ipc } from "@/lib/ipc";
import type { EngineId } from "./providers";
import type { ProviderFormValue } from "./ProviderDialog";
import {
  DEFAULT_CODEX_AUTH_JSON,
  OFFICIAL_BASE_URL,
  OFFICIAL_CODEX_BASE_URL,
  OFFICIAL_CODEX_CONFIG_TOML,
  PRESETS,
  RUYUAN_ANTHROPIC_BASE_URL,
  RUYUAN_OPENAI_BASE_URL,
  authJsonApiKey,
  buildCodexConfigToml,
  claudeTemplateJson,
  findMatchedPreset,
  tomlBaseUrl,
  tomlModel,
  type ClaudeModelSlot,
  type ProviderPreset,
} from "./providerPresets";

const EMPTY_FORM: ProviderFormValue = {
  name: "",
  remark: "",
  baseUrl: "",
  apiKey: "",
  model: "",
  settingsJson: "",
  configToml: "",
  authJson: "",
};

const EMPTY_SLOTS: Record<ClaudeModelSlot, string> = { fable: "", sonnet: "", opus: "", haiku: "" };

/** Initial form state per engine. Claude seeds the JSON editor from the
 *  stored settingsConfig (edit), the flat fields (legacy channels), or the
 *  official-direct template (add); codex seeds config.toml/auth.json the
 *  same way. */
function initialForm(
  engine: EngineId,
  initial?: ProviderFormValue,
  simpleMode = false,
): ProviderFormValue {
  const base: ProviderFormValue = { ...EMPTY_FORM, ...initial };
  if (engine === "claude") {
    if (base.settingsJson.trim()) return base;
    if (initial) {
      // Legacy flat channel: migrate its fields into the default template.
      const extra: Record<string, string> = {};
      if (base.model.trim()) extra.ANTHROPIC_MODEL = base.model.trim();
      return {
        ...base,
        settingsJson: claudeTemplateJson(base.baseUrl.trim(), base.apiKey.trim(), extra),
      };
    }
    // RuYuanAI-branded builds default new channels to RuYuanAI, so users only paste their key.
    return {
      ...base,
      name: "如愿AI",
      baseUrl: RUYUAN_ANTHROPIC_BASE_URL,
      settingsJson: claudeTemplateJson(RUYUAN_ANTHROPIC_BASE_URL, "", {
        ANTHROPIC_DEFAULT_FABLE_MODEL: "claude-sonnet-4-6",
        ANTHROPIC_DEFAULT_HAIKU_MODEL: "claude-haiku-4-5-20251001",
        ANTHROPIC_DEFAULT_SONNET_MODEL: "claude-sonnet-4-6",
        ANTHROPIC_DEFAULT_OPUS_MODEL: "claude-opus-5",
      }),
    };
  }
  if (engine === "codex") {
    return {
      ...base,
      ...(simpleMode && !initial
        ? {
            name: "如愿AI",
            baseUrl: RUYUAN_OPENAI_BASE_URL,
            model: "claude-sonnet-4-6",
          }
        : {}),
      configToml: base.configToml.trim()
        ? base.configToml
        : initial
          ? buildCodexConfigToml(
              "ccgui",
              base.baseUrl.trim() || "https://api.example.com/v1",
              base.model.trim() || "gpt-5.1-codex",
              "chat",
            )
          : buildCodexConfigToml(
              "如愿AI",
              RUYUAN_OPENAI_BASE_URL,
              "claude-sonnet-4-6",
              "chat",
            ),
      name: initial ? base.name : base.name || "如愿AI",
      authJson: base.authJson.trim() ? base.authJson : DEFAULT_CODEX_AUTH_JSON,
    };
  }
  if (!initial) {
    const ruyuanPreset = (PRESETS[engine] ?? []).find((preset) => preset.name === "如愿AI");
    if (ruyuanPreset) {
      return {
        ...base,
        name: ruyuanPreset.name,
        baseUrl: ruyuanPreset.baseUrl,
        model: ruyuanPreset.model,
      };
    }
  }
  return base;
}

/** Claude model-slot values parsed out of a settings.json text. */
function slotsFromJson(settingsJson: string): Record<ClaudeModelSlot, string> {
  try {
    const parsed: unknown = JSON.parse(settingsJson);
    const env = (parsed as Record<string, unknown> | null)?.env;
    if (!env || typeof env !== "object") return { ...EMPTY_SLOTS };
    const read = (key: string) => {
      const v = (env as Record<string, unknown>)[key];
      return typeof v === "string" ? v : "";
    };
    return {
      fable: read("ANTHROPIC_DEFAULT_FABLE_MODEL"),
      sonnet: read("ANTHROPIC_DEFAULT_SONNET_MODEL"),
      opus: read("ANTHROPIC_DEFAULT_OPUS_MODEL"),
      haiku: read("ANTHROPIC_DEFAULT_HAIKU_MODEL"),
    };
  } catch {
    return { ...EMPTY_SLOTS };
  }
}

/**
 * Form state + mutations for ProviderDialog: the flat ProviderFormValue, the
 * claude model slots mirrored into the JSON editor both ways, preset
 * selection, 拉取模型, and the per-engine validity/submit mapping. The dialog
 * component itself only wires these into the section components.
 */
export function useProviderForm({
  engine,
  initial,
  simpleMode = false,
  onSubmit,
}: {
  engine: EngineId;
  initial?: ProviderFormValue;
  simpleMode?: boolean;
  onSubmit: (value: ProviderFormValue) => void;
}): ProviderForm {
  const { t } = useTranslation();
  const isClaude = engine === "claude";
  const isCodex = engine === "codex";
  const [value, setValue] = useState<ProviderFormValue>(() =>
    initialForm(engine, initial, simpleMode),
  );
  // Model slots start empty on add (the template's env carries the defaults,
  // same as the reference); on edit they mirror the stored settings.json.
  const [slots, setSlots] = useState<Record<ClaudeModelSlot, string>>(() =>
    isClaude && initial?.settingsJson ? slotsFromJson(initial.settingsJson) : { ...EMPTY_SLOTS },
  );
  const [jsonError, setJsonError] = useState("");
  const [authError, setAuthError] = useState("");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState("");
  const [testSuccess, setTestSuccess] = useState("");

  const presets = PRESETS[engine] ?? [];
  const patch = (p: Partial<ProviderFormValue>) => setValue((v) => ({ ...v, ...p }));

  // ── claude JSON <-> field sync ────────────────────────────────────────────

  /** Write one env key into the JSON editor's text. A text the user broke
   *  (invalid JSON) is left untouched — the editor error is already shown. */
  const updateClaudeEnv = (key: string, val: string) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = value.settingsJson ? (JSON.parse(value.settingsJson) as Record<string, unknown>) : {};
    } catch {
      return;
    }
    const prevEnv = (parsed.env ?? {}) as Record<string, unknown>;
    const nextEnv = { ...prevEnv };
    if (val.trim()) nextEnv[key] = val;
    else delete nextEnv[key];
    const next =
      Object.keys(nextEnv).length > 0
        ? { ...parsed, env: nextEnv }
        : Object.fromEntries(Object.entries(parsed).filter(([k]) => k !== "env"));
    patch({ settingsJson: JSON.stringify(next, null, 2) });
    setJsonError("");
  };

  const onJsonChange = (text: string) => {
    try {
      const parsed = JSON.parse(text) as Record<string, unknown>;
      const env = (parsed.env ?? {}) as Record<string, unknown>;
      const read = (key: string) => {
        const v = env[key];
        return typeof v === "string" ? v : "";
      };
      setSlots({
        fable: read("ANTHROPIC_DEFAULT_FABLE_MODEL"),
        sonnet: read("ANTHROPIC_DEFAULT_SONNET_MODEL"),
        opus: read("ANTHROPIC_DEFAULT_OPUS_MODEL"),
        haiku: read("ANTHROPIC_DEFAULT_HAIKU_MODEL"),
      });
      setValue((v) => ({
        ...v,
        settingsJson: text,
        baseUrl: read("ANTHROPIC_BASE_URL"),
        apiKey: read("ANTHROPIC_AUTH_TOKEN") || read("ANTHROPIC_API_KEY"),
      }));
      setJsonError("");
    } catch {
      setValue((v) => ({ ...v, settingsJson: text }));
      setJsonError(t("settings.cliJsonError"));
    }
  };

  const handleFormatJson = () => {
    try {
      patch({ settingsJson: JSON.stringify(JSON.parse(value.settingsJson), null, 2) });
      setJsonError("");
    } catch {
      setJsonError(t("settings.cliJsonError"));
    }
  };

  const handleFormatAuthJson = () => {
    try {
      patch({ authJson: JSON.stringify(JSON.parse(value.authJson), null, 2) });
      setAuthError("");
    } catch {
      setAuthError(t("settings.cliAuthJsonError"));
    }
  };

  // ── presets ───────────────────────────────────────────────────────────────

  const selectPreset = (preset: ProviderPreset) => {
    if (isClaude) {
      const slotEnv = preset.env ?? {};
      setSlots({
        fable: slotEnv.ANTHROPIC_DEFAULT_FABLE_MODEL ?? "",
        sonnet: slotEnv.ANTHROPIC_DEFAULT_SONNET_MODEL ?? "",
        opus: slotEnv.ANTHROPIC_DEFAULT_OPUS_MODEL ?? "",
        haiku: slotEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL ?? "",
      });
      setValue((v) => ({
        ...v,
        name: preset.name,
        baseUrl: preset.baseUrl,
        settingsJson: claudeTemplateJson(preset.baseUrl, v.apiKey.trim(), slotEnv),
      }));
      setJsonError("");
    } else if (isCodex) {
      setValue((v) => ({
        ...v,
        name: preset.name,
        configToml: buildCodexConfigToml(
          preset.name,
          preset.baseUrl,
          preset.model || "gpt-5.1-codex",
          preset.wireApi ?? "chat",
        ),
      }));
    } else {
      setValue((v) => ({ ...v, name: preset.name, baseUrl: preset.baseUrl, model: preset.model }));
    }
    resetFetch();
  };

  const selectOfficial = () => {
    if (isClaude) {
      setSlots({ ...EMPTY_SLOTS });
      setValue((v) => ({
        ...v,
        baseUrl: OFFICIAL_BASE_URL,
        settingsJson: claudeTemplateJson(OFFICIAL_BASE_URL, v.apiKey.trim()),
      }));
      setJsonError("");
    } else if (isCodex) {
      patch({ configToml: OFFICIAL_CODEX_CONFIG_TOML });
    }
    resetFetch();
  };

  const selectCustom = () => {
    if (isClaude) {
      setSlots({ ...EMPTY_SLOTS });
      setValue((v) => ({
        ...v,
        baseUrl: "",
        settingsJson: claudeTemplateJson("", v.apiKey.trim()),
      }));
      setJsonError("");
    } else if (isCodex) {
      patch({
        configToml: buildCodexConfigToml(
          "custom",
          "https://api.example.com/v1",
          "gpt-5.1-codex",
          "responses",
        ),
      });
    } else {
      patch({ baseUrl: "" });
    }
    resetFetch();
  };

  // ── fetch models ──────────────────────────────────────────────────────────

  function resetFetch() {
    setFetchedModels([]);
    setFetchError("");
    setTestError("");
    setTestSuccess("");
  }

  const requestModelList = async () => {
    // In the friendly RuYuanAI form the user edits the flat URL/key fields.
    // Only the advanced Codex editor needs values parsed from TOML/auth.json.
    const baseUrl = simpleMode || !isCodex ? value.baseUrl.trim() : tomlBaseUrl(value.configToml);
    const apiKey = simpleMode || !isCodex ? value.apiKey.trim() : authJsonApiKey(value.authJson);
    if (!baseUrl) throw new Error(t("settings.cliFetchModelsNeedUrl"));
    if (!apiKey) throw new Error(t("settings.cliFetchModelsNeedApiKey"));
    return ipc.fetchProviderModels(baseUrl, apiKey);
  };

  const handleFetchModels = async () => {
    setFetching(true);
    setFetchError("");
    setTestError("");
    setTestSuccess("");
    try {
      const result = await requestModelList();
      setFetchedModels(result.models);
      if (result.models.length === 0) setFetchError(t("settings.cliFetchModelsEmpty"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setFetchError(message || t("settings.cliFetchModelsError"));
    } finally {
      setFetching(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestError("");
    setTestSuccess("");
    setFetchError("");
    try {
      const result = await requestModelList();
      // A successful model request proves both the URL and API key work. Keep
      // the result available so the user can immediately choose a model.
      setFetchedModels(result.models);
      setTestSuccess(
        result.models.length > 0
          ? t("settings.cliTestConnectionSuccessWithModels", { count: result.models.length })
          : t("settings.cliTestConnectionSuccess"),
      );
      if (result.models.length === 0) setFetchError(t("settings.cliFetchModelsEmpty"));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setTestError(message || t("settings.cliTestConnectionError"));
    } finally {
      setTesting(false);
    }
  };

  // ── validity & submit ─────────────────────────────────────────────────────

  const official = isClaude
    ? value.baseUrl === OFFICIAL_BASE_URL
    : isCodex
      ? tomlBaseUrl(value.configToml) === OFFICIAL_CODEX_BASE_URL
      : false;
  const matchedPreset = findMatchedPreset(
    presets,
    isCodex ? tomlBaseUrl(value.configToml) : value.baseUrl,
  );

  const jsonValid = (() => {
    if (!isClaude) return true;
    try {
      JSON.parse(value.settingsJson || "{}");
      return true;
    } catch {
      return false;
    }
  })();
  const authValid = (() => {
    if (!isCodex || !value.authJson.trim()) return true;
    try {
      JSON.parse(value.authJson);
      return true;
    } catch {
      return false;
    }
  })();
  const valid = simpleMode
    ? value.name.trim() !== "" && value.baseUrl.trim() !== "" && value.apiKey.trim() !== ""
    : value.name.trim() !== "" &&
      (isCodex ? value.configToml.trim() !== "" : value.baseUrl.trim() !== "") &&
      jsonValid &&
      authValid;

  const submit = () => {
    if (!valid) return;
    if (simpleMode) {
      if (isCodex) {
        onSubmit({
          ...value,
          configToml: buildCodexConfigToml(
            value.name.trim(),
            value.baseUrl.trim(),
            value.model.trim() || "claude-sonnet-4-6",
            "chat",
          ),
          authJson: JSON.stringify({ OPENAI_API_KEY: value.apiKey.trim() }, null, 2),
        });
        return;
      }
      if (isClaude) {
        let settings: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(value.settingsJson || "{}");
          if (parsed && typeof parsed === "object") settings = parsed as Record<string, unknown>;
        } catch {
          // The simple form never exposes JSON. Fall back to a fresh object if
          // an older stored value happens to be malformed.
        }
        const previousEnv =
          settings.env && typeof settings.env === "object"
            ? (settings.env as Record<string, unknown>)
            : {};
        const env: Record<string, unknown> = {
          ...previousEnv,
          ANTHROPIC_BASE_URL: value.baseUrl.trim(),
          ANTHROPIC_AUTH_TOKEN: value.apiKey.trim(),
        };
        if (value.model.trim()) {
          env.ANTHROPIC_DEFAULT_FABLE_MODEL = value.model.trim();
          env.ANTHROPIC_DEFAULT_HAIKU_MODEL = value.model.trim();
          env.ANTHROPIC_DEFAULT_SONNET_MODEL = value.model.trim();
          env.ANTHROPIC_DEFAULT_OPUS_MODEL = value.model.trim();
        }
        onSubmit({
          ...value,
          settingsJson: JSON.stringify({ ...settings, env }, null, 2),
        });
        return;
      }
      onSubmit(value);
      return;
    }
    if (isCodex) {
      // Flat mirrors for the row display and model picker; the backend
      // applies the TOML/auth.json themselves.
      onSubmit({
        ...value,
        baseUrl: tomlBaseUrl(value.configToml),
        apiKey: authJsonApiKey(value.authJson),
        model: tomlModel(value.configToml),
      });
      return;
    }
    onSubmit(value);
  };

  return {
    value,
    patch,
    slots,
    setSlots,
    jsonError,
    authError,
    setAuthError,
    fetchedModels,
    fetching,
    fetchError,
    testing,
    testError,
    testSuccess,
    presets,
    official,
    matchedPreset,
    jsonValid,
    authValid,
    valid,
    updateClaudeEnv,
    onJsonChange,
    handleFormatJson,
    handleFormatAuthJson,
    selectPreset,
    selectOfficial,
    selectCustom,
    handleFetchModels,
    handleTestConnection,
    submit,
  };
}

/** State + handler bundle returned by useProviderForm; the section
 *  components take it as a single `form` prop. */
export interface ProviderForm {
  value: ProviderFormValue;
  patch: (p: Partial<ProviderFormValue>) => void;
  slots: Record<ClaudeModelSlot, string>;
  setSlots: Dispatch<SetStateAction<Record<ClaudeModelSlot, string>>>;
  jsonError: string;
  authError: string;
  setAuthError: Dispatch<SetStateAction<string>>;
  fetchedModels: string[];
  fetching: boolean;
  fetchError: string;
  testing: boolean;
  testError: string;
  testSuccess: string;
  presets: ProviderPreset[];
  official: boolean;
  matchedPreset: ProviderPreset | undefined;
  jsonValid: boolean;
  authValid: boolean;
  valid: boolean;
  updateClaudeEnv: (key: string, val: string) => void;
  onJsonChange: (text: string) => void;
  handleFormatJson: () => void;
  handleFormatAuthJson: () => void;
  selectPreset: (preset: ProviderPreset) => void;
  selectOfficial: () => void;
  selectCustom: () => void;
  handleFetchModels: () => Promise<void>;
  handleTestConnection: () => Promise<void>;
  submit: () => void;
}