import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import BookOpen from "lucide-react/dist/esm/icons/book-open";
import History from "lucide-react/dist/esm/icons/history";
import { Button } from "@/components/base/buttons/button";
import {
  SettingsCard,
  SettingsRow,
  SettingsSectionLabel,
} from "@/components/application/settings/settings-rows";
import { getAppVersion, openExternal } from "@/lib/platform";
import { useUpdateStore } from "@/features/update/store";
import { CHANGELOG_DATA, GITHUB_REPO_URL } from "@/version/changelog";
import { ChangelogDialog } from "./ChangelogDialog";

const RUYUAN_HOME_URL = "https://www.dayueai.fun/";
const RUYUAN_CONSOLE_URL = "https://www.dayueai.fun/keys/?source=ruyuan-desktop";

/** About page: RuYuanAI app identity, API entry, and version history. */
export function AboutSection() {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const updateStage = useUpdateStore((s) => s.stage);
  const checkForUpdates = useUpdateStore((s) => s.checkForUpdates);
  const updateError = useUpdateStore((s) => s.error);

  useEffect(() => {
    let cancelled = false;
    getAppVersion()
      .then((v) => {
        if (!cancelled && v) setVersion(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      {/* App identity + version */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>{t("settings.about")}</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow label="如愿AI" description={t("settings.aboutDesc")}>
            <span className="text-body-regular text-text-secondary">
              {version ? `v${version}` : "…"}
            </span>
          </SettingsRow>
          <SettingsRow label={t("settings.ruyuanApiTitle")} description={t("settings.ruyuanApiDesc")}>
            <Button
              size="small"
              variant="secondary"
              leadingIcon={BookOpen}
              onClick={() => openExternal(RUYUAN_CONSOLE_URL)}
            >
              {t("settings.ruyuanApiAction")}
            </Button>
          </SettingsRow>
          <SettingsRow
            label={t("settings.checkUpdates")}
            description={
              updateStage === "checking"
                ? t("settings.updateChecking")
                : updateStage === "latest"
                  ? t("settings.updateLatest")
                  : updateStage === "error"
                    ? t("settings.updateError", { message: updateError })
                    : undefined
            }
          >
            <Button
              size="small"
              variant="secondary"
              disabled={updateStage === "checking"}
              onClick={() => void checkForUpdates({ interactive: true })}
            >
              {t("settings.checkUpdates")}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Official links + version history */}
      <div className="flex w-full flex-col gap-2">
        <SettingsSectionLabel>{t("settings.socialTitle")}</SettingsSectionLabel>
        <SettingsCard>
          <SettingsRow label={t("settings.socialDocs")} description={t("settings.socialDocsDesc")}>
            <Button
              size="small"
              variant="secondary"
              leadingIcon={BookOpen}
              onClick={() => openExternal(RUYUAN_HOME_URL)}
            >
              {t("settings.socialDocs")}
            </Button>
          </SettingsRow>
          <SettingsRow label={t("settings.versionHistory")} description={t("settings.versionHistoryDesc")}>
            <Button
              size="small"
              variant="secondary"
              leadingIcon={History}
              onClick={() => setShowChangelog(true)}
            >
              {t("settings.versionHistory")}
            </Button>
          </SettingsRow>
        </SettingsCard>
      </div>

      {showChangelog && (
        <ChangelogDialog
          entries={CHANGELOG_DATA}
          githubUrl={GITHUB_REPO_URL}
          onClose={() => setShowChangelog(false)}
        />
      )}
    </div>
  );
}
