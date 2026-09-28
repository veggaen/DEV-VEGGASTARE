"use client";

/**
 * @fileOverview  Settings › Privacy: heartbeat visibility toggles, GDPR data
 *                export, account deletion (30-day grace) and the user's own
 *                content reports.
 * @stability     evolving
 */

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FiAlertTriangle, FiDownload, FiFlag, FiLock, FiTrash2 } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { exportMyData } from "@/actions/gdpr-data-export";
import { cancelAccountDeletion, requestAccountDeletion } from "@/actions/gdpr-account-deletion";
import { EmptyState, RowList, RowsSkeleton, SectionHeader, SettingsCard, SettingsGroup, SettingsRow, StatusPill, fieldClass } from "../settings-primitives";

type PrivacyFlags = { showPulsesGiven: boolean; showPulsesReceived: boolean; showNegativePulses: boolean; showRepulses: boolean; allowNegativePulses: boolean };
const HEARTBEAT_ROWS: { key: keyof PrivacyFlags; title: string; description: string }[] = [
  { key: "showPulsesGiven", title: "Show heartbeats given", description: "Let others see what content you have heartbeated" },
  { key: "showPulsesReceived", title: "Show heartbeats received", description: "Display heartbeat counts on your content" },
  { key: "showNegativePulses", title: "Show negative heartbeats", description: "Display negative heartbeat counts publicly (hidden by default)" },
  { key: "showRepulses", title: "Show repulses", description: "Let others see your repulse activity" },
  { key: "allowNegativePulses", title: "Allow negative heartbeats", description: "Let others give negative heartbeats to your content" },
];

export function PrivacySettings() {
  const [settings, setSettings] = useState<PrivacyFlags>({ showPulsesGiven: true, showPulsesReceived: true, showNegativePulses: false, showRepulses: true, allowNegativePulses: true });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/users/privacy-settings")
      .then((res) => res.json())
      .then((data) => { if (data && !data.message) setSettings((prev) => ({ ...prev, ...data })); })
      .catch((err) => console.error("Failed to fetch privacy settings:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggle = async (key: keyof PrivacyFlags) => {
    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));
    setIsSaving(true);
    try {
      const res = await fetch("/api/users/privacy-settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: newValue }) });
      if (!res.ok) throw new Error("save failed");
      toast.success("Privacy setting updated");
    } catch {
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
      toast.error("Failed to update setting");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiLock} title="Privacy" description="Control who can see your information and activity." />

      <SettingsGroup title="Heartbeats" description="What of your Pulse activity is visible to others.">
        {isLoading ? (
          <RowsSkeleton rows={5} label="Loading privacy settings" />
        ) : (
          <RowList aria-label="Heartbeat privacy">
            {HEARTBEAT_ROWS.map((row) => (
              <SettingsRow key={row.key} title={row.title} description={row.description} htmlFor={`privacy-${row.key}`}>
                <Switch id={`privacy-${row.key}`} checked={settings[row.key]} onCheckedChange={() => void handleToggle(row.key)} disabled={isSaving} />
              </SettingsRow>
            ))}
          </RowList>
        )}
      </SettingsGroup>

      <SettingsGroup title="General" description="Profile visibility and activity status are not configurable yet; your profile is public.">
        <RowList aria-label="General privacy">
          <SettingsRow title={<span className="flex items-center gap-2">Public profile <StatusPill>Always on</StatusPill></span>} description="Anyone can view your profile page." disabled>
            <Switch checked disabled aria-label="Public profile" />
          </SettingsRow>
          <SettingsRow title={<span className="flex items-center gap-2">Show activity status <StatusPill>Coming soon</StatusPill></span>} description="Let others see when you are online." disabled>
            <Switch checked={false} disabled aria-label="Show activity status" />
          </SettingsRow>
          <SettingsRow title={<span className="flex items-center gap-2">Usage analytics <StatusPill>Coming soon</StatusPill></span>} description="Share anonymous usage data to help improve Veggat." disabled>
            <Switch checked={false} disabled aria-label="Usage analytics" />
          </SettingsRow>
        </RowList>
      </SettingsGroup>

      <SettingsGroup title="Dine data (GDPR)" description="Eksport og sletting etter personvernforordningen.">
        <div className="grid gap-3 lg:grid-cols-2">
          <DataExportCard />
          <AccountDeletionCard />
        </div>
      </SettingsGroup>

      <MyReportsCard />
    </div>
  );
}

function DataExportCard() {
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportMyData();
      if (!result.success) { toast.error(result.error || "Feil ved eksport."); return; }
      const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `veggat-mine-data-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Data eksportert og lastet ned.");
    } catch {
      toast.error("Noe gikk galt.");
    } finally {
      setIsExporting(false);
    }
  };
  return (
    <SettingsCard className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-accent/10 text-brand-accent"><FiDownload className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Last ned dine data</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Eksporter all personlig informasjon vi har om deg som JSON-fil (GDPR Art. 15/20).</p>
        </div>
      </div>
      <Button type="button" variant="vegaNormalBtn" onClick={() => void handleExport()} disabled={isExporting} className="min-h-11 w-fit gap-2">
        <FiDownload className="size-4" aria-hidden="true" />{isExporting ? "Eksporterer…" : "Last ned mine data"}
      </Button>
    </SettingsCard>
  );
}

function AccountDeletionCard() {
  const [pendingDeletion, setPendingDeletion] = useState<{ scheduledFor: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetch("/api/users/deletion-status")
      .then((res) => res.json())
      .then((data) => { if (data.pending) setPendingDeletion({ scheduledFor: data.scheduledFor }); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleRequest = async () => {
    if (confirmText !== "SLETT") return;
    setIsRequesting(true);
    try {
      const result = await requestAccountDeletion();
      if (result.success && result.scheduledFor) {
        toast.success("Slettingsforespørsel registrert. Du har 30 dager til å angre.");
        setPendingDeletion({ scheduledFor: result.scheduledFor });
        setShowConfirm(false);
        setConfirmText("");
      } else toast.error(result.error || "Feil.");
    } catch {
      toast.error("Noe gikk galt.");
    } finally {
      setIsRequesting(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const result = await cancelAccountDeletion();
      if (result.success) { toast.success("Slettingsforespørsel kansellert."); setPendingDeletion(null); }
      else toast.error(result.error || "Feil.");
    } catch {
      toast.error("Noe gikk galt.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) return <SettingsCard className="min-h-32 motion-safe:animate-pulse" aria-hidden="true" />;

  if (pendingDeletion) {
    const scheduledDate = new Date(pendingDeletion.scheduledFor);
    return (
      <SettingsCard tone="danger" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"><FiAlertTriangle className="size-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <p className="font-medium text-destructive">Slettingsforespørsel registrert</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Forespørselen er satt til gjennomgang fra <strong className="text-foreground">{scheduledDate.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}</strong>. Du kan avbryte så lenge den venter på behandling.
            </p>
          </div>
        </div>
        <Button type="button" variant="vegaNormalBtn" onClick={() => void handleCancel()} disabled={isCancelling} className="min-h-11 w-fit">{isCancelling ? "Kansellerer…" : "Avbryt sletting"}</Button>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive"><FiTrash2 className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">Slett konto</p>
          <p className="mt-0.5 text-sm text-muted-foreground">Be om sletting av kontoen. Vi gjennomgår forespørselen og hvilke opplysninger som må beholdes. Ingen data slettes når du sender forespørselen.</p>
        </div>
      </div>
      {showConfirm ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-destructive">Skriv <code className="rounded bg-destructive/10 px-1.5 py-0.5">SLETT</code> for å bekrefte:</p>
          <div className="flex flex-wrap items-center gap-2">
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="SLETT" aria-label="Bekreftelse" className={`${fieldClass} max-w-32`} />
            <Button type="button" variant="destructive" onClick={() => void handleRequest()} disabled={confirmText !== "SLETT" || isRequesting} className="min-h-11">{isRequesting ? "Sender…" : "Bekreft sletting"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setShowConfirm(false); setConfirmText(""); }} className="min-h-11">Avbryt</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="vegaNormalBtnRed" onClick={() => setShowConfirm(true)} className="min-h-11 w-fit gap-2"><FiTrash2 className="size-4" aria-hidden="true" />Slett min konto</Button>
      )}
    </SettingsCard>
  );
}

const STATUS: Record<string, { label: string; tone: "warning" | "neutral" | "accent" }> = {
  PENDING: { label: "Venter", tone: "warning" },
  IN_REVIEW: { label: "Under vurdering", tone: "neutral" },
  RESOLVED: { label: "Behandlet", tone: "accent" },
  DISMISSED: { label: "Avvist", tone: "neutral" },
};
const REASONS: Record<string, string> = {
  ILLEGAL_CONTENT: "Ulovlig innhold", HATE_SPEECH: "Hatefulle ytringer", HARASSMENT: "Trakassering", VIOLENCE: "Vold/trusler", SEXUAL_CONTENT: "Seksuelt innhold",
  CHILD_EXPLOITATION: "Overgrep mot barn", SPAM: "Spam", SCAM: "Svindel", IMPERSONATION: "Etterligning", COPYRIGHT_INFRINGEMENT: "Opphavsrett",
  MISINFORMATION: "Villedende info", PLATFORM_MANIPULATION: "Manipulering", OTHER: "Annet",
};

function MyReportsCard() {
  const [reports, setReports] = useState<{ id: string; contentType: string; reason: string; status: string; createdAt: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    fetch("/api/users/my-reports")
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setReports(data); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <SettingsGroup title="Mine rapporter" description="Innhold du har rapportert, og hvor saken står.">
      {isLoading ? (
        <RowsSkeleton rows={2} label="Laster rapporter" />
      ) : reports.length === 0 ? (
        <EmptyState icon={<FiFlag />} title="Ingen rapporter" description="Du har ikke rapportert noe innhold ennå." />
      ) : (
        <RowList aria-label="Mine rapporter">
          {reports.map((report) => {
            const status = STATUS[report.status] ?? STATUS.PENDING;
            return (
              <SettingsRow
                key={report.id}
                icon={<FiFlag />}
                title={<span>{REASONS[report.reason] || report.reason} <span className="font-normal capitalize text-muted-foreground">· {report.contentType.toLowerCase()}</span></span>}
                description={new Date(report.createdAt).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" })}
              >
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              </SettingsRow>
            );
          })}
        </RowList>
      )}
    </SettingsGroup>
  );
}
