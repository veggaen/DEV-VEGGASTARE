'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import dynamic from 'next/dynamic';
import { FiDollarSign, FiTrendingUp, FiFileText, FiUsers, FiPieChart, FiAlertTriangle, FiSettings, FiPlus, FiChevronDown, FiChevronUp, FiDownload, FiExternalLink, FiInfo, FiBook } from 'react-icons/fi';
import { TAX_PROFILES, VAT_RATES, TAX_SOURCES, TAX_YEAR, type CompanyOrgType, type TaxEntityType } from '@/lib/tax/constants';
import type { TaxBreakdown } from '@/lib/tax/calculator';

// Lazy-load Chart.js components
const Line = dynamic(() => import('react-chartjs-2').then(m => ({ default: m.Line })), { ssr: false });
const Pie = dynamic(() => import('react-chartjs-2').then(m => ({ default: m.Pie })), { ssr: false });
const Bar = dynamic(() => import('react-chartjs-2').then(m => ({ default: m.Bar })), { ssr: false });

// Register Chart.js
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Filler,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, ChartTooltip, Legend);

// ─── Tooltip Component ─────────────────────────────────────────

function TaxTip({ text, sourceUrl }: { text: string; sourceUrl?: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="ml-1 inline-flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        aria-label="More info"
      >
        <FiInfo className="h-3.5 w-3.5" />
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-normal rounded-lg border border-black/10 bg-white px-3 py-2 text-[11px] leading-relaxed text-zinc-700 shadow-lg dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300 min-w-[200px] max-w-[300px]">
          {text}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
            >
              Skatteetaten <FiExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
        </span>
      )}
    </span>
  );
}

// ─── Types ────────────────────────────────────────────────────

interface TaxDashboardData {
  company: {
    id: string;
    name: string;
    orgType: CompanyOrgType | TaxEntityType | null;
    orgNumber: string | null;
    taxHelperEnabled: string;
    vatRegistered: boolean;
    vatNumber: string | null;
  };
  enabled: boolean;
  year: number;
  summary: {
    grossIncome: number;
    totalProfit: number;
    totalExpenses: number;
    totalSalariesGross: number;
    totalSalariesNet: number;
    saleCount: number;
    expenseCount: number;
    salaryPaymentCount: number;
    employeeCount: number;
  };
  taxBreakdown: TaxBreakdown;
  expensesByCategory: { category: string; total: number; count: number }[];
  monthlyTrend: { month: string; revenue: number; profit: number }[];
  recentExpenses: { id: string; category: string; amount: number; date: string; description?: string | null }[];
  recentReports: { id: string; period: string; type: string; generatedAt: string }[];
}

interface ExpenseForm {
  category: string;
  amount: string;
  date: string;
  description: string;
  receiptUrl: string;
}

// ─── Helpers ──────────────────────────────────────────────────

function nok(amount: number): string {
  return new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(amount);
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

const CATEGORY_LABELS: Record<string, string> = {
  OFFICE: '🏢 Office',
  TRAVEL: '✈️ Travel',
  UNION_DUES: '🤝 Union Dues',
  EQUIPMENT: '🔧 Equipment',
  SOFTWARE: '💻 Software',
  MARKETING: '📢 Marketing',
  INSURANCE: '🛡️ Insurance',
  PROFESSIONAL_SERVICES: '👔 Professional Services',
  RENT: '🏠 Rent',
  UTILITIES: '⚡ Utilities',
  VEHICLE: '🚗 Vehicle',
  MEALS: '🍽️ Meals',
  DEBT_INTEREST: '💰 Debt Interest',
  DEPRECIATION: '📉 Depreciation',
  SALARY_COST: '👥 Salary Cost',
  EMPLOYER_NI: '🏛️ Employer NI',
  OTHER: '📋 Other',
};

const MONTHS_NO = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];

// ─── Component ────────────────────────────────────────────────

export default function TaxHelperDashboard({ companyId }: { companyId: string }) {
  const user = useCurrentUser();
  const [data, setData] = useState<TaxDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expenseForm, setExpenseForm] = useState<ExpenseForm>({
    category: 'OFFICE',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    description: '',
    receiptUrl: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [whatIfMode, setWhatIfMode] = useState(false);
  const [whatIfIncome, setWhatIfIncome] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/companies/${companyId}/tax`);
      if (!res.ok) throw new Error('Failed to load tax data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEnableTax = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/tax/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      if (res.ok) fetchData();
    } catch { /* ignore */ }
  };

  const handleAddExpense = async () => {
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/tax/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: expenseForm.category,
          amount: parseFloat(expenseForm.amount),
          date: expenseForm.date,
          description: expenseForm.description || undefined,
          receiptUrl: expenseForm.receiptUrl || undefined,
        }),
      });
      if (res.ok) {
        setShowExpenseForm(false);
        setExpenseForm({ category: 'OFFICE', amount: '', date: new Date().toISOString().slice(0, 10), description: '', receiptUrl: '' });
        fetchData();
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const handleWhatIf = async () => {
    if (!whatIfIncome) return;
    try {
      const res = await fetch(`/api/companies/${companyId}/tax/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period: `${data?.year ?? new Date().getFullYear()}`,
          overrideGrossIncome: parseFloat(whatIfIncome),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setData(prev => prev ? { ...prev, taxBreakdown: json.breakdown } : prev);
      }
    } catch { /* ignore */ }
  };

  // ─── Loading / Disabled States ──────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/20">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (data && !data.enabled) {
    const orgType = data.company.orgType as CompanyOrgType | null;
    const profile = orgType ? TAX_PROFILES[orgType] : null;
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-black/10 bg-linear-to-br from-emerald-50 to-teal-50 p-8 dark:border-white/10 dark:from-emerald-950/20 dark:to-teal-950/20">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-emerald-100 p-3 dark:bg-emerald-900/50">
              <FiDollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Tax Helper</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Automatic tax calculations and overview based on company activity.
                Norwegian tax rules {TAX_YEAR}, tailored to {profile?.label ?? 'your company'}.
              </p>
              {profile && (
                <p className="mt-2 text-xs text-zinc-500">
                  {profile.description} • {profile.specialNotes}
                </p>
              )}
              <button
                onClick={handleEnableTax}
                className="mt-4 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Enable Tax Helper
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, taxBreakdown: tb, expensesByCategory, monthlyTrend } = data;
  const profile = data.company.orgType ? TAX_PROFILES[data.company.orgType as TaxEntityType] : null;

  // ─── Chart Data ─────────────────────────────────────────────

  const trendData = {
    labels: monthlyTrend.map((_m, i) => MONTHS_NO[i]),
    datasets: [
      {
        label: 'Revenue',
        data: monthlyTrend.map(m => m.revenue),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.1)',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Profit',
        data: monthlyTrend.map(m => m.profit),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const pieColors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b'];
  const expensePieData = {
    labels: expensesByCategory.map(e => CATEGORY_LABELS[e.category] ?? e.category),
    datasets: [{
      data: expensesByCategory.map(e => e.total),
      backgroundColor: expensesByCategory.map((_, i) => pieColors[i % pieColors.length]),
      borderWidth: 0,
    }],
  };

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <FiDollarSign className="text-emerald-500" />
            Tax Helper {data.year}
          </h2>
          <p className="text-sm text-zinc-500">
            {profile?.label ?? 'Company'} • {data.company.orgNumber ?? 'No org number'}
            {data.company.vatRegistered && ` • VAT: ${data.company.vatNumber ?? 'Registered'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWhatIfMode(!whatIfMode)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              whatIfMode
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
            }`}
          >
            🔮 What-If
          </button>
        </div>
      </div>

      {/* What-if Mode */}
      {whatIfMode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">Simulation mode — what if your income was different?</p>
          <div className="flex gap-2">
            <input
              type="number"
              value={whatIfIncome}
              onChange={e => setWhatIfIncome(e.target.value)}
              placeholder="New gross income (NOK)"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm dark:border-amber-800 dark:bg-zinc-900"
            />
            <button onClick={handleWhatIf} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
              Calculate
            </button>
            <button onClick={() => { setWhatIfMode(false); fetchData(); }} className="rounded-lg bg-zinc-200 px-4 py-2 text-sm dark:bg-zinc-700">
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Score Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Gross Income', value: nok(summary.grossIncome), icon: <FiTrendingUp />, color: 'emerald' },
          { label: 'Expenses', value: nok(summary.totalExpenses), icon: <FiPieChart />, color: 'rose' },
          { label: 'Estimated Tax', value: nok(tb.totalTaxLiability), icon: <FiDollarSign />, color: 'amber' },
          { label: 'Effective Tax Rate', value: pct(tb.effectiveTaxRate), icon: <FiFileText />, color: 'indigo' },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <span className={`text-${card.color}-500`}>{card.icon}</span>
              <span className="text-xs font-medium">{card.label}</span>
            </div>
            <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white tabular-nums">{card.value}</div>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: Charts (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Revenue Trend */}
          <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Monthly Revenue & Profit</h3>
            <div className="h-64">
              <Line data={trendData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { boxWidth: 12, usePointStyle: true, color: '#71717a' } } },
                scales: {
                  x: { grid: { display: false }, ticks: { color: '#71717a', font: { size: 11 } } },
                  y: {
                    grid: { color: 'rgba(0,0,0,0.06)' },
                    ticks: {
                      color: '#71717a',
                      font: { size: 11 },
                      callback: (v) => `${(Number(v) / 1000).toFixed(0)}k`,
                    },
                  },
                },
              }} />
            </div>
          </div>

          {/* Tax Breakdown */}
          <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
            <button
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="flex w-full items-center justify-between text-left"
            >
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Detailed Tax Breakdown</h3>
              {showBreakdown ? <FiChevronUp /> : <FiChevronDown />}
            </button>
            {showBreakdown && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-zinc-600 dark:text-zinc-400">Gross Income</span>
                  <span className="font-medium tabular-nums">{nok(tb.grossIncome)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-zinc-600 dark:text-zinc-400">− Expenses</span>
                  <span className="font-medium tabular-nums text-red-500">−{nok(tb.totalExpenses)}</span>
                </div>
                <div className="flex justify-between border-t border-black/10 py-1 dark:border-white/10">
                  <span className="font-medium">Net Profit</span>
                  <span className="font-bold tabular-nums">{nok(tb.netProfit)}</span>
                </div>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800" />

                {tb.corporateTax > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center">
                      Corporate Tax ({pct(tb.corporateTaxRate)})
                      <TaxTip text={`${pct(tb.corporateTaxRate)} on net profit. Financial sector: 25%.`} sourceUrl={TAX_SOURCES.GENERAL_INCOME} />
                    </span>
                    <span className="font-medium tabular-nums">{nok(tb.corporateTax)}</span>
                  </div>
                )}
                {tb.ordinaryIncomeTax > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center">
                      Ordinary Income Tax (22%)
                      <TaxTip text="Flat 22% tax on general income (alminnelig inntekt) after deductions." sourceUrl={TAX_SOURCES.GENERAL_INCOME} />
                    </span>
                    <span className="font-medium tabular-nums">{nok(tb.ordinaryIncomeTax)}</span>
                  </div>
                )}
                {tb.bracketTax > 0 && (
                  <>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-600 dark:text-zinc-400 flex items-center">
                        Bracket Tax
                        <TaxTip text="Progressive tax (trinnskatt) on personal income in 5 steps: 1.7% → 4.0% → 13.7% → 16.8% → 17.8%." sourceUrl={TAX_SOURCES.BRACKET_TAX} />
                      </span>
                      <span className="font-medium tabular-nums">{nok(tb.bracketTax)}</span>
                    </div>
                    {tb.bracketTaxDetails.map((d, i) => (
                      <div key={i} className="flex justify-between py-0.5 pl-4 text-xs text-zinc-500">
                        <span>{d.bracket} ({pct(d.rate)})</span>
                        <span className="tabular-nums">{nok(d.amount)}</span>
                      </div>
                    ))}
                  </>
                )}
                {tb.nationalInsurance > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center">
                      National Insurance
                      <TaxTip text="Trygdeavgift: 7.6% on salary (employees), 10.8% on business income (self-employed)." sourceUrl={TAX_SOURCES.NATIONAL_INSURANCE} />
                    </span>
                    <span className="font-medium tabular-nums">{nok(tb.nationalInsurance)}</span>
                  </div>
                )}
                {tb.employerNI > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center">
                      Employer NI (14.1%)
                      <TaxTip text="Arbeidsgiveravgift: 14.1% in Zone I. Reduced in zones II–V (0–10.6%)." sourceUrl={TAX_SOURCES.EMPLOYER_NI} />
                    </span>
                    <span className="font-medium tabular-nums">{nok(tb.employerNI)}</span>
                  </div>
                )}
                {tb.dividendTax > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-zinc-600 dark:text-zinc-400 flex items-center">
                      Dividend Tax (~37.84%)
                      <TaxTip text="Dividends are upwardly adjusted by factor 1.72, then taxed at 22% = effective 37.84%." sourceUrl={TAX_SOURCES.DIVIDEND_UPLIFT} />
                    </span>
                    <span className="font-medium tabular-nums">{nok(tb.dividendTax)}</span>
                  </div>
                )}
                {tb.personalAllowance > 0 && (
                  <div className="flex justify-between py-1 text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center">
                      − Personal Allowance
                      <TaxTip text={`Personfradrag: NOK ${tb.personalAllowance.toLocaleString('nb-NO')} deducted from general income.`} sourceUrl={TAX_SOURCES.PERSONAL_ALLOWANCE} />
                    </span>
                    <span className="tabular-nums">−{nok(tb.personalAllowance)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-black/10 pt-2 dark:border-white/10">
                  <span className="font-bold text-zinc-900 dark:text-white">Total Estimated Tax</span>
                  <span className="font-bold text-emerald-600 tabular-nums">{nok(tb.totalTaxLiability)}</span>
                </div>

                {tb.vatOwed !== 0 && (
                  <div className="flex justify-between py-1 text-xs text-zinc-500">
                    <span>VAT Owed (collected − paid)</span>
                    <span className="tabular-nums">{nok(tb.vatOwed)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expense Breakdown Pie */}
          {expensesByCategory.length > 0 && (
            <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Expenses by Category</h3>
              <div className="mx-auto h-64 max-w-xs">
                <Pie data={expensePieData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 }, color: '#71717a' } } },
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Tax Profile Card */}
          {profile && (
            <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Your Company Type</h3>
              <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/20">
                <div className="font-medium text-emerald-700 dark:text-emerald-300">{profile.label}</div>
                <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{profile.description}</div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between items-center">
                  <span className="flex items-center">Corporate Tax <TaxTip text="Tax on company profits. Pass-through entities pay personal income tax instead." sourceUrl={TAX_SOURCES.GENERAL_INCOME} /></span>
                  <span className="font-medium">{profile.hasCorporateTax ? pct(profile.corporateTaxRate) : 'No (pass-through)'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="flex items-center">Limited Liability <TaxTip text="Whether the owner's personal assets are protected from company debts." /></span>
                  <span className="font-medium">{profile.limitedLiability ? '✅ Yes' : '❌ No'}</span>
                </div>
                {profile.minCapital && (
                  <div className="flex justify-between">
                    <span>Min. Capital</span>
                    <span className="font-medium">{nok(profile.minCapital)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="flex items-center">Dividend Tax <TaxTip text="Dividends are adjusted upward by 1.72x, then taxed at 22% = ~37.84% effective rate." sourceUrl={TAX_SOURCES.DIVIDEND_UPLIFT} /></span>
                  <span className="font-medium">{profile.dividendTaxApplies ? '~37.84%' : 'N/A'}</span>
                </div>
              </div>
              <p className="mt-3 text-[10px] text-zinc-400">{profile.specialNotes}</p>
            </div>
          )}

          {/* Quick Stats */}
          <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Overview {data.year}</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Sales Recorded', value: summary.saleCount },
                { label: 'Expense Items', value: summary.expenseCount },
                { label: 'Salary Payments', value: summary.salaryPaymentCount },
                { label: 'Employees', value: summary.employeeCount },
                { label: 'Gross Salaries Paid', value: nok(summary.totalSalariesGross) },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-zinc-500">{row.label}</span>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Add Expense */}
          <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Expenses</h3>
              <button
                onClick={() => setShowExpenseForm(!showExpenseForm)}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
              >
                <FiPlus className="h-3 w-3" /> Add
              </button>
            </div>

            {showExpenseForm && (
              <div className="mb-4 space-y-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/50">
                <select
                  value={expenseForm.category}
                  onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Amount (NOK)"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm(f => ({ ...f, amount: e.target.value }))}
                    className="flex-1 rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <input
                    type="date"
                    value={expenseForm.date}
                    onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))}
                    className="rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={expenseForm.description}
                  onChange={e => setExpenseForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
                <button
                  onClick={handleAddExpense}
                  disabled={submitting || !expenseForm.amount}
                  className="w-full rounded-lg bg-emerald-600 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            )}

            {/* Recent Expenses List */}
            <div className="space-y-1.5">
              {data.recentExpenses.slice(0, 5).map(exp => (
                <div key={exp.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span>{CATEGORY_LABELS[exp.category]?.slice(0, 2) ?? '📋'}</span>
                    <span className="text-zinc-600 dark:text-zinc-400 truncate max-w-[120px]">
                      {exp.description || CATEGORY_LABELS[exp.category] || exp.category}
                    </span>
                  </div>
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-white">{nok(exp.amount)}</span>
                </div>
              ))}
              {data.recentExpenses.length === 0 && (
                <p className="text-xs text-zinc-400 italic">No expenses recorded yet</p>
              )}
            </div>
          </div>

          {/* VAT Summary */}
          <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2 flex items-center">
              VAT Rates
              <TaxTip text="Merverdiavgift (MVA). VAT registration required when turnover exceeds NOK 50,000." sourceUrl={TAX_SOURCES.VAT} />
            </h3>
            <div className="space-y-1.5 text-xs">
              {Object.entries(VAT_RATES).map(([key, rate]) => (
                <div key={key} className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>{key === 'STANDARD' ? 'Standard' : key === 'FOOD' ? 'Food & Water' : key === 'TRANSPORT' ? 'Transport/Hotel' : key === 'CULTURE' ? 'Culture/Events' : key === 'LOW' ? 'Reduced' : key === 'ZERO' ? 'Exempt (0%)' : key}</span>
                  <span className="font-medium">{pct(rate)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tax Export */}
          <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Export Tax Data</h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">
              Download your tax records for Skatteetaten. Includes sales, expenses, salaries, and crypto payments with NOK conversion.
            </p>
            <div className="flex gap-2">
              <a
                href={`/api/companies/${companyId}/tax/export?format=csv&year=${new Date().getFullYear()}`}
                download
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
              >
                <FiDownload className="h-3.5 w-3.5" /> CSV Export
              </a>
              <a
                href={`/api/companies/${companyId}/tax/export?format=json&year=${new Date().getFullYear()}`}
                download
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 transition-colors"
              >
                <FiDownload className="h-3.5 w-3.5" /> JSON Export
              </a>
            </div>
          </div>

          {/* Official Sources & References */}
          <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.03]">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3 flex items-center gap-1.5">
              <FiBook className="h-3.5 w-3.5 text-indigo-500" />
              Official Sources
            </h3>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">
              All tax rates are sourced from official Norwegian authorities for the {TAX_YEAR} tax year.
            </p>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Skatteetaten — All Rates', url: TAX_SOURCES.ALL_RATES, desc: 'Official tax rates' },
                { label: 'Bracket Tax (Trinnskatt)', url: TAX_SOURCES.BRACKET_TAX, desc: 'Progressive income tax' },
                { label: 'National Insurance', url: TAX_SOURCES.NATIONAL_INSURANCE, desc: 'Trygdeavgift rates' },
                { label: 'Employer NI Contributions', url: TAX_SOURCES.EMPLOYER_NI, desc: 'Arbeidsgiveravgift' },
                { label: 'Dividend / Share Gains', url: TAX_SOURCES.DIVIDEND_UPLIFT, desc: 'Uplift factor 1.72x' },
                { label: 'VAT Rates', url: TAX_SOURCES.VAT, desc: 'Merverdiavgift (MVA)' },
                { label: 'Crypto & Virtual Assets', url: TAX_SOURCES.CRYPTO_TAX, desc: 'Tax rules for crypto' },
                { label: 'Skatteloven (Lovdata)', url: TAX_SOURCES.SKATTELOVEN, desc: 'Tax Act full text' },
                { label: 'MVA-loven (Lovdata)', url: TAX_SOURCES.MVA_LOVEN, desc: 'VAT Act full text' },
                { label: 'Altinn — Business Taxes', url: TAX_SOURCES.ALTINN_TAXES, desc: 'Start & run business' },
                { label: 'Brønnøysundregistrene', url: TAX_SOURCES.COMPANY_REGISTRATION, desc: 'Company register' },
              ].map(src => (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 -mx-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-700 dark:text-zinc-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">{src.label}</div>
                    <div className="text-[10px] text-zinc-400">{src.desc}</div>
                  </div>
                  <FiExternalLink className="h-3 w-3 shrink-0 text-zinc-400 group-hover:text-indigo-500 ml-2" />
                </a>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-950/20">
            <div className="flex gap-2">
              <FiAlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
              <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-relaxed">
                {tb.disclaimer} These figures are estimates based on recorded data and Norwegian tax rules for {TAX_YEAR}.
                Contact an authorized accountant or{' '}
                <a href={TAX_SOURCES.ALL_RATES} target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-800 dark:hover:text-amber-200">
                  Skatteetaten
                </a>{' '}
                for final calculations.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
