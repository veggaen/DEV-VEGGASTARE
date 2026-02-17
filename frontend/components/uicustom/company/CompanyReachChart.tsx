'use client';

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { FiTrendingUp, FiUsers, FiPackage, FiEye, FiDollarSign, FiStar } from 'react-icons/fi';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface CompanyReachStats {
  totalProductViews: number;
  uniqueVisitors: number;
  productCount: number;
  totalSales?: number;
  averageRating?: number;
  employeeCount?: number;
}

interface CompanyReachChartProps {
  companyName: string;
  stats: CompanyReachStats;
}

export default function CompanyReachChart({ companyName, stats }: CompanyReachChartProps) {
  // Calculate normalized scores (0-100) for radar chart
  const viewScore = Math.min((stats.totalProductViews || 0) / 100, 100);
  const visitorScore = Math.min((stats.uniqueVisitors || 0) / 50, 100);
  const productScore = Math.min((stats.productCount || 0) * 10, 100);
  const salesScore = Math.min(((stats.totalSales || 0) / 10), 100);
  const ratingScore = ((stats.averageRating || 0) / 5) * 100;

  const chartData = {
    labels: ['Product Views', 'Unique Visitors', 'Products', 'Sales', 'Rating'],
    datasets: [{
      label: 'Company Reach',
      data: [viewScore, visitorScore, productScore, salesScore, ratingScore],
      backgroundColor: 'rgba(56, 189, 248, 0.2)',
      borderColor: 'rgba(56, 189, 248, 1)',
      borderWidth: 2,
      pointBackgroundColor: 'rgba(56, 189, 248, 1)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgba(56, 189, 248, 1)',
    }],
  };

  const chartOptions = {
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: { color: 'rgba(255, 255, 255, 0.7)', font: { size: 10 } },
        ticks: { display: false },
        suggestedMin: 0,
        suggestedMax: 100,
      },
    },
    plugins: { legend: { display: false } },
    maintainAspectRatio: true,
  };

  // Calculate engagement rate: views per product
  const engagementRate = stats.productCount > 0 
    ? ((stats.totalProductViews / stats.productCount) || 0).toFixed(1)
    : '0';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-sm p-6 mt-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <FiTrendingUp className="h-5 w-5 text-sky-400" />
          {companyName}&apos;s Reach
        </h3>
        <p className="text-sm text-white/50 mt-1">
          Real engagement metrics - how many people actually interact with this company
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar Chart */}
        <div className="rounded-xl bg-white/5 p-6">
          <div className="max-w-[260px] mx-auto">
            <Radar data={chartData} options={chartOptions} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-linear-to-r from-sky-500/10 to-sky-600/5 border border-sky-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiEye className="h-4 w-4 text-sky-400" />
              <span className="text-xs text-white/60">Product Views</span>
            </div>
            <div className="text-2xl font-bold text-sky-400">
              {(stats.totalProductViews || 0).toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl bg-linear-to-r from-emerald-500/10 to-emerald-600/5 border border-emerald-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiUsers className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-white/60">Unique Visitors</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">
              {(stats.uniqueVisitors || 0).toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl bg-linear-to-r from-purple-500/10 to-purple-600/5 border border-purple-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiPackage className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-white/60">Products</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">
              {stats.productCount}
            </div>
          </div>

          <div className="rounded-xl bg-linear-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiTrendingUp className="h-4 w-4 text-amber-400" />
              <span className="text-xs text-white/60">Views/Product</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">
              {engagementRate}
            </div>
          </div>

          {stats.averageRating && stats.averageRating > 0 && (
            <div className="col-span-2 rounded-xl bg-linear-to-r from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FiStar className="h-4 w-4 text-yellow-400" />
                    <span className="text-xs text-white/60">Average Rating</span>
                  </div>
                  <div className="text-2xl font-bold text-yellow-400">
                    {stats.averageRating.toFixed(1)} / 5
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <FiStar 
                      key={star} 
                      className={`h-5 w-5 ${
                        star <= Math.round(stats.averageRating || 0) 
                          ? 'text-yellow-400 fill-yellow-400' 
                          : 'text-white/20'
                      }`} 
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Insight */}
      <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="text-sm font-medium text-white/80 mb-1">💡 Company Reach</div>
        <p className="text-xs text-white/50 leading-relaxed">
          Company reach measures actual engagement - product views, unique visitors, and interaction rates.
          Unlike follower counts, these metrics show how many people <em>actually</em> discover and engage with this company&apos;s products.
        </p>
      </div>
    </div>
  );
}
