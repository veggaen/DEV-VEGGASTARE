'use client';

import React from 'react';
import UserProductCreationChart from '@/components/uicustom/charts/analytics/UserProductCreationChart';
import MetricTimeSeriesChart from '@/components/uicustom/charts/analytics/MetricTimeSeriesChart';

const MyPageAnalyticsUsers = () => {
  return (
    <>
      <MetricTimeSeriesChart metric="users" />
      <UserProductCreationChart />
    </>
  );
}

export default MyPageAnalyticsUsers;