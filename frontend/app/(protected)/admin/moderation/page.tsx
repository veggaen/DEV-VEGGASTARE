'use client';

/**
 * @fileOverview Admin content moderation dashboard (DSA compliance).
 * @stability active
 * @keyInvariants Only OWNER/ADMIN can access. Reports must have statement of reasons.
 */

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useTransition } from "react";
import { motion } from "framer-motion";
import {
  FiFlag, FiCheck, FiX, FiEye, FiMessageSquare,
  FiAlertTriangle, FiArrowLeft, FiChevronDown, FiClock,
  FiShield, FiFilter,
} from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { toast } from "sonner";
import { resolveContentReport, getPendingReports } from "@/actions/content-report";
import type { ReportStatus, ModerationActionType } from "@/generated/prisma/client";

interface ReportItem {
  id: string;
  contentType: string;
  contentId: string;
  reason: string;
  description: string | null;
  status: ReportStatus;
  createdAt: string;
  Reporter: { id: string; name: string | null; image: string | null };
}

const reasonLabels: Record<string, string> = {
  ILLEGAL_CONTENT: 'Ulovlig innhold',
  HATE_SPEECH: 'Hatefulle ytringer',
  HARASSMENT: 'Trakassering / mobbing',
  VIOLENCE: 'Vold / trusler',
  SEXUAL_CONTENT: 'Seksuelt innhold',
  CHILD_EXPLOITATION: 'Overgrep mot barn',
  SPAM: 'Spam',
  SCAM: 'Svindel / bedrageri',
  IMPERSONATION: 'Etterligning',
  COPYRIGHT_INFRINGEMENT: 'Opphavsrett',
  MISINFORMATION: 'Villedende info',
  PLATFORM_MANIPULATION: 'Manipulering',
  OTHER: 'Annet',
};

const contentTypeLabels: Record<string, string> = {
  POST: 'Innlegg (Pulse)',
  MESSAGE: 'Melding',
  PRODUCT: 'Produkt',
  POLL: 'Avstemning',
  USER_PROFILE: 'Brukerprofil',
  IMAGE: 'Bilde',
  OTHER: 'Annet',
};

const actionOptions: { value: ModerationActionType; label: string; severity: 'info' | 'warning' | 'danger' }[] = [
  { value: "DISMISSED", label: "Avvis rapport", severity: "info" },
  { value: "CONTENT_REMOVED", label: "Fjern innhold", severity: "danger" },
  { value: "CONTENT_RESTRICTED", label: "Begrens innhold", severity: "warning" },
  { value: "ACCOUNT_WARNING", label: "Advarsel til bruker", severity: "warning" },
  { value: "ACCOUNT_SUSPENDED", label: "Suspender konto", severity: "danger" },
  { value: "ACCOUNT_BANNED", label: "Utesteng permanent", severity: "danger" },
  { value: "REFERRED_TO_AUTHORITY", label: "Henvist til myndighet", severity: "danger" },
];

export default function ModerationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved'>('pending');

  useEffect(() => {
    if (status === "loading") return;
    if (!session || (session.user?.role !== "OWNER" && session.user?.role !== "ADMIN")) {
      router.push("/");
    }
  }, [session, status, router]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      if (statusFilter === 'pending') {
        const result = await getPendingReports(page, 20);
        if (result.success) {
          setReports(result.reports as ReportItem[]);
          setTotal(result.total);
        }
      } else {
        // Fetch all/resolved from API
        const res = await fetch(`/api/admin/reports?status=${statusFilter}&page=${page}`);
        if (res.ok) {
          const data = await res.json();
          setReports(data.reports);
          setTotal(data.total);
        }
      }
    } catch {
      toast.error('Feil ved henting av rapporter.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    if (session?.user?.role === "OWNER" || session?.user?.role === "ADMIN") {
      fetchReports();
    }
  }, [session, fetchReports]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
            <FiArrowLeft className="h-4 w-4" />
            Tilbake til admin
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-linear-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <FiFlag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Innholdsmoderering
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                DSA-kompatibel moderering • {total} {statusFilter === 'pending' ? 'ventende' : 'totalt'}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <FiFilter className="h-4 w-4 text-muted-foreground" />
            {(['pending', 'resolved', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setStatusFilter(f); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === f
                    ? 'bg-foreground text-background'
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {f === 'pending' ? 'Ventende' : f === 'resolved' ? 'Behandlet' : 'Alle'}
              </button>
            ))}
          </div>
        </div>

        {/* Reports list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-16">
            <FiShield className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
            <h3 className="text-lg font-medium text-foreground">Ingen rapporter</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === 'pending' ? 'Alle rapporter er behandlet!' : 'Ingen rapporter funnet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report, i) => (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ReportCard
                  report={report}
                  isExpanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                  onResolved={fetchReports}
                />
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 20 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              Forrige
            </Button>
            <span className="px-3 py-1.5 text-sm text-muted-foreground">
              Side {page} av {Math.ceil(total / 20)}
            </span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page * 20 >= total}>
              Neste
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({ report, isExpanded, onToggle, onResolved }: {
  report: ReportItem;
  isExpanded: boolean;
  onToggle: () => void;
  onResolved: () => void;
}) {
  const [selectedAction, setSelectedAction] = useState<ModerationActionType | null>(null);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  const isActionable = report.status === 'PENDING' || report.status === 'IN_REVIEW';
  const severityColor = report.reason === 'CHILD_EXPLOITATION' || report.reason === 'ILLEGAL_CONTENT'
    ? 'border-red-500/30 bg-red-500/5'
    : 'border-border dark:border-white/10';

  const handleResolve = () => {
    if (!selectedAction || reason.trim().length < 5) {
      toast.error('Velg handling og skriv begrunnelse (minst 5 tegn).');
      return;
    }

    startTransition(async () => {
      const result = await resolveContentReport({
        reportId: report.id,
        action: selectedAction,
        reason: reason.trim(),
      });

      if (result.success) {
        toast.success('Rapport behandlet.');
        onResolved();
      } else {
        toast.error(result.error || 'Feil.');
      }
    });
  };

  return (
    <div className={`rounded-xl border p-4 bg-white/70 dark:bg-white/5 transition-colors ${severityColor}`}>
      {/* Header row */}
      <button onClick={onToggle} className="w-full flex items-center gap-3 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              {contentTypeLabels[report.contentType] || report.contentType}
            </Badge>
            <span className="font-medium text-sm text-foreground dark:text-white/90">
              {reasonLabels[report.reason] || report.reason}
            </span>
            {(report.reason === 'CHILD_EXPLOITATION' || report.reason === 'ILLEGAL_CONTENT') && (
              <Badge variant="destructive" className="text-xs">Prioritert</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <FiClock className="h-3 w-3" />
            <span>{new Date(report.createdAt).toLocaleString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>·</span>
            <span>Rapportert av: {report.Reporter?.name || 'Ukjent'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={report.status} />
          <FiChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="mt-4 pt-4 border-t border-border dark:border-white/10 space-y-4"
        >
          {/* Report details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Innholds-ID:</span>
              <code className="ml-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded">{report.contentId}</code>
            </div>
            <div>
              <span className="text-muted-foreground">Rapportør-ID:</span>
              <code className="ml-1 text-xs bg-muted/50 px-1.5 py-0.5 rounded">{report.Reporter?.id}</code>
            </div>
          </div>

          {report.description && (
            <div>
              <Label className="text-xs text-muted-foreground">Beskrivelse fra rapportør:</Label>
              <p className="text-sm mt-1 p-3 rounded-lg bg-muted/30">{report.description}</p>
            </div>
          )}

          {/* Action panel (only for actionable reports) */}
          {isActionable && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/20 border border-border dark:border-white/10">
              <Label className="text-sm font-medium">Handling (DSA Art. 17 — begrunnelsesplikt):</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {actionOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedAction(opt.value)}
                    className={`text-left px-3 py-2 rounded-lg text-xs transition-colors border ${
                      selectedAction === opt.value
                        ? opt.severity === 'danger'
                          ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-400'
                          : opt.severity === 'warning'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : 'border-border dark:border-white/10 hover:bg-muted/50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <Label htmlFor={`reason-${report.id}`} className="text-xs text-muted-foreground">
                  Begrunnelse (synlig for bruker ved anke) *
                </Label>
                <Textarea
                  id={`reason-${report.id}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Forklar handlingen og hvilken regel som ble brutt..."
                  rows={3}
                  maxLength={2000}
                  className="mt-1"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleResolve}
                  disabled={isPending || !selectedAction || reason.trim().length < 5}
                  className="gap-2"
                >
                  <FiCheck className="h-4 w-4" />
                  {isPending ? 'Behandler...' : 'Utfør handling'}
                </Button>
                <Button variant="ghost" size="sm" onClick={onToggle}>
                  Lukk
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    IN_REVIEW: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
    RESOLVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    DISMISSED: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
  };
  const labels: Record<string, string> = {
    PENDING: 'Venter',
    IN_REVIEW: 'Under vurdering',
    RESOLVED: 'Behandlet',
    DISMISSED: 'Avvist',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${styles[status] || styles.PENDING}`}>
      {labels[status] || status}
    </span>
  );
}
