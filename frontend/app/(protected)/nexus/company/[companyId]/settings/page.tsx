import { redirect } from "next/navigation";

export default async function CompanySettingsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  redirect(`/companies/${companyId}/settings`);
}
