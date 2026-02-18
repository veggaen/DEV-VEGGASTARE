"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiArrowLeft,
  FiCheck,
  FiX,
  FiClock,
  FiPlus,
  FiTrash2,
  FiToggleLeft,
  FiToggleRight,
  FiLoader,
  FiCpu,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { cn } from "@/lib/utils";

/**
 * @fileOverview Admin Polls page — pending review queue + scheduled polls CRUD
 * @stability stable
 */

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface PollItem {
  id: string;
  title: string;
  description: string | null;
  type: string;
  reviewStatus: "PENDING_REVIEW" | "APPROVED" | "REJECTED";
  reviewedAt: string | null;
  reviewedBy: string | null;
  totalResponses: number;
  questionCount: number;
  responseCount: number;
  publishedAt: string | null;
  createdAt: string;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
}

interface ScheduledTemplate {
  id: string;
  cronExpression: string;
  promptTemplate: string;
  targetFeedId: string | null;
  isActive: boolean;
  autoPublish: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: string;
  creator: { id: string; name: string | null; email: string | null; image: string | null };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ─── Tab types ───────────────────────────────────────────────────────────── */

type Tab = "review" | "scheduled";

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function AdminPollsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("review");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || (session.user?.role !== "OWNER" && session.user?.role !== "ADMIN")) {
      router.push("/admin");
    }
  }, [session, status, router]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-teal-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors mb-4"
          >
            <FiArrowLeft className="h-4 w-4" /> Back to Admin
          </button>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-linear-to-br from-teal-500 to-cyan-600 flex items-center justify-center">
              <FiCpu className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">AI & Polls</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Review generated polls and manage scheduled templates
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-6 w-fit">
          <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={FiCheck} label="Pending Review" />
          <TabButton active={tab === "scheduled"} onClick={() => setTab("scheduled")} icon={FiCalendar} label="Scheduled Templates" />
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {tab === "review" ? (
            <motion.div key="review" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              <PendingReviewTab />
            </motion.div>
          ) : (
            <motion.div key="scheduled" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
              <ScheduledPollsTab />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Tab Button ──────────────────────────────────────────────────────────── */

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
        active
          ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm"
          : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

/* ─── Pending Review Tab ──────────────────────────────────────────────────── */

function PendingReviewTab() {
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/polls?status=${statusFilter}&page=${page}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls);
        setPagination(data.pagination);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleAction = async (pollId: string, action: "APPROVE" | "REJECT") => {
    setActionLoading(pollId);
    try {
      const res = await fetch("/api/admin/polls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pollId, action }),
      });
      if (res.ok) {
        // Remove from list or update status
        setPolls((prev) =>
          prev.map((p) =>
            p.id === pollId
              ? { ...p, reviewStatus: action === "APPROVE" ? "APPROVED" : "REJECTED" }
              : p
          )
        );
      }
    } catch { /* silent */ } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {["PENDING_REVIEW", "APPROVED", "REJECTED", "ALL"].map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn(
              "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              statusFilter === s
                ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            )}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Poll list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <FiCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No polls matching this filter.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <motion.div
              key={poll.id}
              layout
              className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{poll.title}</h3>
                    <StatusBadge status={poll.reviewStatus} />
                  </div>
                  {poll.description && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2">
                      {poll.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-zinc-400 dark:text-zinc-500">
                    <span>{poll.type}</span>
                    <span>{poll.questionCount} Q{poll.questionCount !== 1 ? "s" : ""}</span>
                    <span>{poll.responseCount} response{poll.responseCount !== 1 ? "s" : ""}</span>
                    <span>{new Date(poll.createdAt).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">
                      {poll.creator.image ? (
                        <img src={poll.creator.image} alt="" className="h-4 w-4 rounded-full" />
                      ) : null}
                      {poll.creator.name ?? poll.creator.email ?? "Unknown"}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {poll.reviewStatus === "PENDING_REVIEW" && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(poll.id, "APPROVE")}
                      disabled={actionLoading === poll.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === poll.id ? <FiLoader className="h-3.5 w-3.5 animate-spin" /> : <FiCheck className="h-3.5 w-3.5" />}
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(poll.id, "REJECT")}
                      disabled={actionLoading === poll.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                      <FiX className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <FiChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
            disabled={page === pagination.totalPages}
            className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 disabled:opacity-30 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          >
            <FiChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Status Badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING_REVIEW: { label: "Pending", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
    APPROVED: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
    REJECTED: { label: "Rejected", cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
  };
  const { label, cls } = map[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-500" };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border", cls)}>
      {label}
    </span>
  );
}

/* ─── Scheduled Polls Tab ─────────────────────────────────────────────────── */

function ScheduledPollsTab() {
  const [templates, setTemplates] = useState<ScheduledTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form state
  const [newCron, setNewCron] = useState("0 8 * * *");
  const [newPrompt, setNewPrompt] = useState("");
  const [newAutoPublish, setNewAutoPublish] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/polls?tab=scheduled");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
      }
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async () => {
    if (!newPrompt.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/polls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cronExpression: newCron,
          promptTemplate: newPrompt,
          autoPublish: newAutoPublish,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setNewCron("0 8 * * *");
        setNewPrompt("");
        setNewAutoPublish(false);
        fetchTemplates();
      }
    } catch { /* silent */ } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/polls?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch { /* silent */ } finally {
      setDeleting(null);
    }
  };

  return (
    <div>
      {/* Create button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 hover:bg-teal-500/20 transition-colors"
        >
          <FiPlus className="h-4 w-4" />
          New Template
        </button>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-5 bg-white dark:bg-zinc-900 rounded-xl border border-teal-500/20 space-y-4">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Create Scheduled Template</h3>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Cron Expression
                </label>
                <input
                  type="text"
                  value={newCron}
                  onChange={(e) => setNewCron(e.target.value)}
                  placeholder="0 8 * * *"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                />
                <p className="text-[10px] text-zinc-400 mt-1">Default: 0 8 * * * = 8 AM UTC daily</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Prompt Template
                </label>
                <textarea
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  placeholder="Generate a challenging quiz about Norwegian history with 5 questions..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-teal-500/30 resize-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNewAutoPublish(!newAutoPublish)}
                  className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  {newAutoPublish ? (
                    <FiToggleRight className="h-5 w-5 text-teal-500" />
                  ) : (
                    <FiToggleLeft className="h-5 w-5" />
                  )}
                </button>
                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                  Auto-publish (skip review)
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newPrompt.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  {creating ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPlus className="h-4 w-4" />}
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template list */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <FiCalendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No scheduled templates yet.</p>
          <p className="text-xs mt-1 opacity-60">Create one to auto-generate polls on a schedule.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-start gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                  t.isActive
                    ? "bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500"
                )}>
                  <FiClock className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2">
                    {t.promptTemplate}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400 dark:text-zinc-500">
                    <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {t.cronExpression}
                    </span>
                    <span>{t.isActive ? "Active" : "Paused"}</span>
                    <span>{t.autoPublish ? "Auto-publish" : "Needs review"}</span>
                    {t.lastRunAt && <span>Last: {new Date(t.lastRunAt).toLocaleDateString()}</span>}
                    {t.nextRunAt && <span>Next: {new Date(t.nextRunAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting === t.id}
                  className="p-2 rounded-lg text-zinc-400 dark:text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Delete template"
                >
                  {deleting === t.id ? (
                    <FiLoader className="h-4 w-4 animate-spin" />
                  ) : (
                    <FiTrash2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
