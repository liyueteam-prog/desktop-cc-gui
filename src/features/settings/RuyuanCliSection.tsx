import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import ArrowLeftRight from "lucide-react/dist/esm/icons/arrow-left-right";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import FileText from "lucide-react/dist/esm/icons/file-text";
import KeyRound from "lucide-react/dist/esm/icons/key-round";
import Plus from "lucide-react/dist/esm/icons/plus";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { Button } from "@/components/base/buttons/button";
import {
  SettingsCard,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { EngineIcon } from "@/components/foundations/icons/engine-icon";
import { CLI_DISPLAY_NAMES } from "@/components/foundations/icons/engine-brands";
import ruyuanIcon from "@/assets/model-icons/ruyuan.svg";
import { openExternal } from "@/lib/platform";
import { cx } from "@/utils/cx";
import { CliConfigBody } from "./CliConfigBody";
import { CliDeleteConfirm, CliProviderDialog } from "./CliConfigDialogs";
import { CliOfficialEditDialog } from "./CliOfficialEditDialog";
import { DAYUE_API_KEYS_URL, DAYUE_HOME_URL } from "./providerPresets";
import type { EngineId } from "./providers";
import { useCliConfig } from "./useCliConfig";

const RUYUAN_TARGET_ENGINES: readonly EngineId[] = ["codex", "claude", "kimi", "grok"];

interface CatalogModelGroup {
  vendor: string;
  icon: string;
  models: string;
  note: string;
}

const GLOBAL_MODEL_CATALOG: CatalogModelGroup[] = [
  { vendor: "OpenAI", icon: "codex", models: "GPT / o-series / Codex", note: "OpenAI-compatible" },
  { vendor: "Anthropic", icon: "claude", models: "Claude Opus / Sonnet / Haiku", note: "Anthropic-compatible" },
  { vendor: "Google", icon: "gemini", models: "Gemini / Gemma", note: "Google family" },
  { vendor: "DeepSeek", icon: "dsh", models: "DeepSeek Chat / Reasoner / Coder", note: "OpenAI-compatible" },
  { vendor: "Moonshot", icon: "kimi", models: "Kimi / Kimi Coding", note: "OpenAI-compatible" },
  { vendor: "xAI", icon: "grok", models: "Grok", note: "OpenAI-compatible" },
  { vendor: "Alibaba", icon: "qwen", models: "Qwen / QwQ / Qwen Coder", note: "DashScope / OpenAI-compatible" },
  { vendor: "Zhipu", icon: "chatglm", models: "GLM / ChatGLM", note: "OpenAI-compatible" },
  { vendor: "ByteDance", icon: "doubao", models: "Doubao / Seed", note: "OpenAI-compatible" },
  { vendor: "MiniMax", icon: "minimax", models: "MiniMax / abab", note: "OpenAI-compatible" },
  { vendor: "Mistral AI", icon: "mistral", models: "Mistral / Mixtral / Codestral", note: "OpenAI-compatible" },
  { vendor: "Cohere", icon: "cohere", models: "Command / Embed", note: "Cohere family" },
  { vendor: "Perplexity", icon: "perplexity", models: "Sonar", note: "OpenAI-compatible" },
  { vendor: "Meta", icon: "llama", models: "Llama", note: "via compatible gateways" },
  { vendor: "Baidu", icon: "ernie", models: "ERNIE / Wenxin", note: "via compatible gateways" },
  { vendor: "01.AI", icon: "yi", models: "Yi", note: "OpenAI-compatible" },
  { vendor: "Baichuan", icon: "baichuan", models: "Baichuan", note: "OpenAI-compatible" },
  { vendor: "Tencent", icon: "hunyuan", models: "Hunyuan", note: "OpenAI-compatible" },
  { vendor: "StepFun", icon: "stepfun", models: "Step", note: "OpenAI-compatible" },
  { vendor: "OpenRouter", icon: "openrouter", models: "multi-vendor router", note: "one key, many models" },
];

function MethodCard({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default text-foreground-icon-primary">
          <Icon className="size-4.5" aria-hidden />
        </span>
        <span className="min-w-0">
          <p className="text-body-medium text-text-primary">{title}</p>
          <p className="mt-1 text-body-2-regular text-text-secondary">{desc}</p>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function TargetTabs({
  value,
  onChange,
}: {
  value: EngineId;
  onChange: (engine: EngineId) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2">
      <SettingsSectionLabel>{t("settings.ruyuanCliTargetTitle")}</SettingsSectionLabel>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {RUYUAN_TARGET_ENGINES.map((engine) => {
          const active = value === engine;
          return (
            <button
              key={engine}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(engine)}
              className={cx(
                "flex items-center gap-2 rounded-2lg border px-3 py-2 text-left transition-colors",
                active
                  ? "border-border-focus-ring bg-background-secondary-default text-text-primary"
                  : "border-border-button-default text-text-secondary hover:bg-background-secondary-hover",
              )}
            >
              <EngineIcon engine={engine} size={18} className="text-foreground-icon-primary" />
              <span className="truncate text-body-medium">{CLI_DISPLAY_NAMES[engine]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GlobalModelsCatalog() {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? GLOBAL_MODEL_CATALOG : GLOBAL_MODEL_CATALOG.slice(0, 8);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <SettingsSectionLabel>{t("settings.ruyuanCliCatalogTitle")}</SettingsSectionLabel>
          <p className="mt-1 text-body-2-regular text-text-tertiary">
            {t("settings.ruyuanCliCatalogDesc")}
          </p>
        </div>
        <Button variant="secondary" size="small" onClick={() => setExpanded((v) => !v)}>
          {expanded ? t("settings.ruyuanCliCatalogCollapse") : t("settings.ruyuanCliCatalogExpand")}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((item) => (
          <div
            key={item.vendor}
            className="flex min-w-0 items-start gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-3"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default text-foreground-icon-primary">
              <EngineIcon engine={item.icon} size={17} className="text-foreground-icon-primary" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-body-medium text-text-primary">{item.vendor}</span>
                <span className="shrink-0 rounded-full bg-background-tertiary-default px-2 py-0.5 text-caption-medium text-text-tertiary">
                  {item.note}
                </span>
              </span>
              <span className="mt-1 block truncate text-body-2-regular text-text-secondary">
                {item.models}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Branded hub page for RuYuanAI users: one place to create keys, import
 *  cc-switch providers, browse model families, then configure the target CLI
 *  with the same channel manager used by each native engine page. */
export function RuyuanCliSection() {
  const { t } = useTranslation();
  const [targetEngine, setTargetEngine] = useState<EngineId>("codex");
  const cli = useCliConfig(targetEngine);
  const targetName = useMemo(() => CLI_DISPLAY_NAMES[targetEngine], [targetEngine]);

  return (
    <div className="flex w-full flex-col gap-6">
      {cli.error && (
        <p role="alert" className="text-body-regular text-text-error-primary">
          {t("common.error")}: {cli.error}
        </p>
      )}
      {cli.notice && (
        <p role="status" className="text-body-regular text-text-secondary">
          {cli.notice}
        </p>
      )}

      <SettingsCard>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-background-tertiary-default">
              <img src={ruyuanIcon} alt="" className="size-7 object-contain" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-title-3-medium text-text-primary">
                {t("settings.ruyuanCliHeroTitle")}
              </p>
              <p className="mt-1 text-body-regular text-text-secondary">
                {t("settings.ruyuanCliHeroDesc")}
              </p>
              <p className="mt-2 text-body-2-regular text-text-tertiary">
                {t("settings.ruyuanCliHeroEndpoint")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
            <Button
              variant="secondary"
              size="small"
              trailingIcon={ExternalLink}
              onClick={() => openExternal(DAYUE_HOME_URL)}
            >
              {t("settings.cliRuyuanSignIn")}
            </Button>
            <Button
              size="small"
              trailingIcon={ExternalLink}
              onClick={() => openExternal(DAYUE_API_KEYS_URL)}
            >
              {t("settings.cliGetRuyuanApiKey")}
            </Button>
          </div>
        </div>
      </SettingsCard>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <MethodCard
          icon={KeyRound}
          title={t("settings.ruyuanCliMethodManualTitle")}
          desc={t("settings.ruyuanCliMethodManualDesc", { name: targetName })}
        >
          <Button size="small" leadingIcon={Plus} disabled={cli.busy} onClick={() => cli.setDialog({})}>
            {t("settings.cliDialogAdd")}
          </Button>
        </MethodCard>
        <MethodCard
          icon={ArrowLeftRight}
          title={t("settings.ruyuanCliMethodCcsTitle")}
          desc={t("settings.ruyuanCliMethodCcsDesc")}
        >
          <Button
            size="small"
            variant="secondary"
            leadingIcon={ArrowLeftRight}
            disabled={cli.busy}
            onClick={() => void cli.syncCcSwitch("all")}
          >
            {t("settings.ruyuanCliImportAll")}
          </Button>
          <Button
            size="small"
            variant="secondary"
            leadingIcon={FileText}
            disabled={cli.busy}
            onClick={() => void cli.importCcSwitchFile()}
          >
            {t("settings.cliImportFile")}
          </Button>
        </MethodCard>
        <MethodCard
          icon={Sparkles}
          title={t("settings.ruyuanCliMethodCatalogTitle")}
          desc={t("settings.ruyuanCliMethodCatalogDesc")}
        >
          <Button
            size="small"
            variant="secondary"
            trailingIcon={ExternalLink}
            onClick={() => openExternal(DAYUE_API_KEYS_URL)}
          >
            {t("settings.ruyuanCliUseCatalog")}
          </Button>
        </MethodCard>
      </div>

      <GlobalModelsCatalog />
      <TargetTabs value={targetEngine} onChange={setTargetEngine} />

      {!cli.config && !cli.error ? (
        <p className="text-body-regular text-text-tertiary">{t("common.loading")}</p>
      ) : cli.config ? (
        <CliConfigBody cli={cli} />
      ) : null}
      <CliProviderDialog cli={cli} simpleMode />
      <CliOfficialEditDialog cli={cli} />
      <CliDeleteConfirm cli={cli} />
    </div>
  );
}

