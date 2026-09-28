"use client";

/**
 * @fileOverview  Reach analytics for the settings profile section: a radar of
 *                the five normalised signals plus the raw numbers and the
 *                formula behind each. Colours come from the CSS tokens so the
 *                chart matches both themes and any accent.
 * @stability     evolving
 */

import { useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { Chart as ChartJS, Filler, Legend, LineElement, PointElement, RadialLinearScale, Tooltip } from "chart.js";
import { Radar } from "react-chartjs-2";
import { FiActivity, FiEye, FiFileText, FiTrendingUp, FiUserPlus, FiUsers } from "react-icons/fi";
import { SettingsCard, SettingsGroup } from "../settings-primitives";

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

export type ReachStats = { totalViews: number; uniqueViewers: number; totalReplies: number; engagementRate: number; postCount: number; followerCount: number };

const pct = (n: number) => Math.max(0, Math.min(100, n));

export function ReachAnalytics({ reach }: { reach: ReachStats | null }) {
  const { resolvedTheme } = useTheme();
  const [palette, setPalette] = useState<{ accent: string; fill: string; grid: string; label: string; point: string } | null>(null);

  // Read the live tokens (theme + accent preset) after paint; re-read when the theme flips.
  useEffect(() => {
    // Next frame: the theme class has been applied by then.
    const raf = requestAnimationFrame(() => {
      const cs = getComputedStyle(document.documentElement);
      const accent = cs.getPropertyValue("--brand-accent").trim();
      const fg = cs.getPropertyValue("--foreground").trim();
      const card = cs.getPropertyValue("--card").trim();
      if (!accent || !fg) return;
      setPalette({ accent: `hsl(${accent})`, fill: `hsl(${accent} / 0.18)`, grid: `hsl(${fg} / 0.12)`, label: `hsl(${fg} / 0.7)`, point: `hsl(${card})` });
    });
    return () => cancelAnimationFrame(raf);
  }, [resolvedTheme]);

  const r = reach ?? { totalViews: 0, uniqueViewers: 0, totalReplies: 0, engagementRate: 0, postCount: 0, followerCount: 0 };
  const rows = useMemo(() => [
    { icon: <FiEye />, label: "Views", value: r.totalViews.toLocaleString(), score: pct(r.totalViews / 10), how: "1,000 views fills the chart" },
    { icon: <FiUsers />, label: "Unique viewers", value: r.uniqueViewers.toLocaleString(), score: pct(r.uniqueViewers / 5), how: "500 unique viewers fills the chart" },
    { icon: <FiActivity />, label: "Engagement", value: `${r.engagementRate.toFixed(1)}%`, score: pct(r.engagementRate), how: `replies ÷ unique viewers: ${r.totalReplies} ÷ ${Math.max(r.uniqueViewers, 1)}` },
    { icon: <FiFileText />, label: "Posts", value: r.postCount.toLocaleString(), score: pct(r.postCount * 10), how: "10 posts fills the chart" },
    { icon: <FiUserPlus />, label: "Followers", value: r.followerCount.toLocaleString(), score: pct(r.followerCount), how: "100 followers fills the chart" },
  ], [r.totalViews, r.uniqueViewers, r.engagementRate, r.totalReplies, r.postCount, r.followerCount]);

  const data = {
    labels: rows.map((row) => row.label),
    datasets: [{
      label: "Your reach",
      data: rows.map((row) => row.score),
      backgroundColor: palette?.fill ?? "transparent",
      borderColor: palette?.accent ?? "transparent",
      borderWidth: 2,
      pointBackgroundColor: palette?.accent ?? "transparent",
      pointBorderColor: palette?.point ?? "transparent",
      pointRadius: 3,
    }],
  };
  const options = {
    scales: {
      r: {
        angleLines: { color: palette?.grid ?? "transparent" },
        grid: { color: palette?.grid ?? "transparent" },
        pointLabels: { color: palette?.label ?? "transparent", font: { size: 11 } },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: { legend: { display: false } },
    maintainAspectRatio: true,
    animation: { duration: 250 },
  };

  return (
    <SettingsGroup title="Reach analytics" description="Real engagement metrics, not vanity follower counts.">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        <SettingsCard className="flex items-center justify-center" aria-label="Reach radar chart">
          <div className="w-full max-w-60">{palette && <Radar data={data} options={options} />}</div>
        </SettingsCard>
        <SettingsCard className="divide-y divide-border/50 p-1 sm:p-1">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3 px-3 py-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-accent/10 text-brand-accent [&>svg]:size-4">{row.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{row.label}</p>
                <p className="text-xs text-muted-foreground">{row.how}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-foreground">{row.value}</p>
                <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-foreground/[0.08]"><span className="block h-full rounded-full bg-brand-accent" style={{ width: `${row.score}%` }} /></div>
              </div>
            </div>
          ))}
        </SettingsCard>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FiTrendingUp aria-hidden="true" className="size-3.5" />Verified accounts and linked wallets multiply reach. See the Verification section.</p>
    </SettingsGroup>
  );
}
