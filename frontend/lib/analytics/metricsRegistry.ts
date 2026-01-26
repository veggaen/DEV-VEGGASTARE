export type TimeSeriesDatum = {
  date: Date;
  users?: number;
  companies?: number;
};

export type AnalyticsMetricKey = "users" | "companies" | "products";

export type AnalyticsMetricDefinition = {
  key: AnalyticsMetricKey;
  title: string;
  description: string;
  endpoint: string;
  value: (d: TimeSeriesDatum) => number;
  datasetLabel: string;
  colors: { stroke: string; fill: string };
};

export const analyticsMetrics: Record<AnalyticsMetricKey, AnalyticsMetricDefinition> = {
  users: {
    key: "users",
    title: "User Growth Analytics",
    description:
      "This chart displays the user growth over time, helping you understand the growth trend for your application.",
    endpoint: "/api/analytics/users",
    value: (d) => d.users ?? 0,
    datasetLabel: "Users",
    colors: { stroke: "rgba(59,130,246,0.95)", fill: "rgba(59,130,246,0.20)" },
  },
  companies: {
    key: "companies",
    title: "Company Growth Analytics",
    description:
      "This chart displays the company growth over time, helping you understand the growth trend for your application.",
    endpoint: "/api/analytics/companies",
    value: (d) => d.companies ?? 0,
    datasetLabel: "Companies",
    colors: { stroke: "rgba(168,85,247,0.95)", fill: "rgba(168,85,247,0.20)" },
  },
  products: {
    key: "products",
    title: "Product Growth Analytics",
    description:
      "This chart displays the product growth over time, helping you understand the growth trend for your application.",
    endpoint: "/api/analytics/products",
    // Current API returns the count on `users` (legacy naming). Keep compatible.
    value: (d) => d.users ?? 0,
    datasetLabel: "Products",
    colors: { stroke: "rgba(34,197,94,0.95)", fill: "rgba(34,197,94,0.20)" },
  },
};
