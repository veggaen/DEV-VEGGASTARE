import UserProductCreationChart from '@/components/uicustom/charts/analytics/UserProductCreationChart';
import MetricTimeSeriesChart from '@/components/uicustom/charts/analytics/MetricTimeSeriesChart';

export default function UserGrowthAnalytics() {
  return <MetricTimeSeriesChart metric="users">
    <UserProductCreationChart />
  </MetricTimeSeriesChart>;
}
