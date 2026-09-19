import { useState } from "react";
import { useTranslation } from "react-i18next";
import ExternalLink from "lucide-react/dist/esm/icons/external-link";
import Plus from "lucide-react/dist/esm/icons/plus";
import { Button } from "@/components/base/buttons/button";
import {
  SettingsCard,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { WorkspaceSortableList } from "@/components/application/ai-chat/workspace-sortable-list";
import { ipc } from "@/lib/ipc";
import { openExternal } from "@/lib/platform";
import { PSEUDO_LOCAL, type EngineId } from "./providers";
import { ChannelRow } from "./CliChannelRow";
import { CliEngineCard } from "./CliEngineCard";
import { CliEngineSettingsCard } from "./CliEngineSettingsCard";
import { CliImportMenu } from "./CliImportMenu";
import { CliSyncBanner } from "./CliSyncBanner";
import { DshHostSection } from "./DshHostSection";
import { DAYUE_API_KEYS_URL, DAYUE_HOME_URL } from "./providerPresets";
import { PiFamilyAuthSection } from "./PiFamilyAuthSection";
import type { CliConfigState } from "./useCliConfig";

/** Engines cc-switch manages — the import dropdown only shows on these tabs. */
const CCS_IMPORT_ENGINES: readonly EngineId[] = ["claude", "codex", "grok"];
const RUYUAN_QUICKSTART_ENGINES: readonly EngineId[] = ["claude", "codex", "kimi", "grok"];

function RuyuanQuickStartCard({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border-button-default bg-background-secondary-default p-4 shadow-xs">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-body-medium text-text-primary">
            {t("settings.cliRuyuanQuickStartTitle")}
          </p>
          <p className="mt-1 text-body-2-regular text-text-secondary">
            {t("settings.cliRuyuanQuickStartDesc")}
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-body-2-regular text-text-secondary">
            <li>{t("settings.cliRuyuanQuickStartStep1")}</li>
            <li>{t("settings.cliRuyuanQuickStartStep2")}</li>
            <li>{t("settings.cliRuyuanQuickStartStep3")}</li>
          </ol>
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
            variant="secondary"
            size="small"
            trailingIcon={ExternalLink}
            onClick={() => openExternal(DAYUE_API_KEYS_URL)}
          >
            {t("settings.cliGetRuyuanApiKey")}
          </Button>
          <Button size="small" leadingIcon={Plus} onClick={onAdd}>
            {t("settings.cliRuyuanAddChannel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The loaded CLI config UI:
 *   cc-switch sync banner (when the store changed)
 *   → 引擎设置 card (enable switch)
 *   → everything below the switch lives in one overlay wrapper so a disabled
 *     engine masks all of it:
 *       官方配置 fallback row
 *       → Pi-family auth section (pi/omp only)
 *       → DSH local host section (dsh only)
 *       → 供应商渠道 card (avatar/switch/⋯-menu rows + drag sorting)
 *       → empty state.
 */
export function CliConfigBody({ cli }: { cli: CliConfigState }) {
  const {
    t,
    engine,
    ccStatus,
    busy,
    enabled,
    entries,
    currentId,
    mutate,
    activate,
    setDialog,
    setPendingDelete,
    syncCcSwitch,
    importCcSwitchFile,
    dismissCcSwitch,
  } = cli;
  // pi/omp official files are never cc-gui-managed: their 编辑 entry opens
  // the models.json/models.yml editor already living in the auth section.
  const [customEditorSignal, setCustomEditorSignal] = useState(0);

  return (
    <>
      {ccStatus?.changed && (
        <CliSyncBanner
          providers={ccStatus.providers}
          busy={busy}
          onSync={() => void syncCcSwitch("all")}
          onDismiss={dismissCcSwitch}
        />
      )}

      <CliEngineCard
        engine={engine}
        enabled={enabled}
        busy={busy}
        onToggleEnabled={(on) => void mutate(() => ipc.setEngineEnabled(engine, on))}
      />

      {entries.length === 0 && RUYUAN_QUICKSTART_ENGINES.includes(engine) && (
        <RuyuanQuickStartCard onAdd={() => setDialog({})} />
      )}

      <div className="relative flex w-full flex-col gap-6">
        <CliEngineSettingsCard
          cli={cli}
          onEditOfficial={() => {
            if (engine === "pi" || engine === "omp") setCustomEditorSignal((n) => n + 1);
            else cli.setOfficialEditing(true);
          }}
        />

        {(engine === "pi" || engine === "omp") && (
          <PiFamilyAuthSection engine={engine} openCustomEditorSignal={customEditorSignal} />
        )}
        {engine === "dsh" && <DshHostSection />}

        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <SettingsSectionLabel>
              {t("settings.cliChannels")}
              <span className="ml-2 text-body-2-regular font-normal text-text-tertiary">
                {t("settings.cliChannelsHint")}
              </span>
            </SettingsSectionLabel>
            <div className="flex shrink-0 items-center gap-2">
              {CCS_IMPORT_ENGINES.includes(engine) && (
                <CliImportMenu
                  busy={busy}
                  onSyncAuto={() => void syncCcSwitch(engine)}
                  onImportFile={() => void importCcSwitchFile()}
                />
              )}
              <Button
                size="small"
                leadingIcon={Plus}
                disabled={busy}
                onClick={() => setDialog({})}
              >
                {t("settings.cliDialogAdd")}
              </Button>
            </div>
          </div>

          <SettingsCard>
            <WorkspaceSortableList
              items={entries}
              onReorder={(ids) => void mutate(() => ipc.reorderProviders(engine, ids))}
              renderItem={(entry, drag) => (
                <ChannelRow
                  engine={engine}
                  entry={entry}
                  current={currentId === entry.id}
                  busy={busy}
                  drag={drag}
                  onToggle={(on) => activate(on ? entry.id : PSEUDO_LOCAL)}
                  onEdit={() => setDialog({ entry })}
                  onDelete={() => setPendingDelete(entry)}
                />
              )}
            />
          </SettingsCard>

          {entries.length === 0 && (
            <div className="mt-3 rounded-2xl border border-dashed border-border-button-default px-4 py-6 text-center">
              <p className="text-body-medium text-text-primary">
                {t("settings.cliEmptyTitle")}
              </p>
              <p className="mt-1 text-body-2-regular text-text-secondary">
                {t("settings.cliEmptyDesc")}
              </p>
            </div>
          )}
        </div>

        {!enabled && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-background-primary-default/70 pt-10 backdrop-blur-[1px]">
            <p className="rounded-xl border border-border-button-default bg-background-primary-default px-4 py-2 text-body-2-medium text-text-secondary shadow-sm">
              {t("settings.cliDisabledOverlay")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
