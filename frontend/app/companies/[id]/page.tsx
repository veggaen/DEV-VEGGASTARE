import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dbPrisma } from "@/lib/db";
import { auth } from "@/auth";
import CompanyReachChart from "@/components/uicustom/company/CompanyReachChart";
import BannerThemeWrapper from "@/components/uicustom/banner/BannerThemeWrapper";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyPublicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: companyId } = await params;
  const session = await auth();

  if (!companyId) notFound();

  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      name: true,
      description: true,
      websiteUrl: true,
      orgNumber: true,
      logo: true,
      bannerImage: true,
      ownerId: true,
      creatorId: true,
      Employee: {
        select: { userId: true },
      },
      Product: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          price: true,
          image: true,
          category: true,
          viewCount: true,
          Review: {
            select: { rating: true },
          },
        },
      },
      orgVerification: {
        select: { status: true },
      },
    },
  });

  if (!company) notFound();

  const banner = company.bannerImage?.[0] ?? null;
  const logo = company.logo?.[0] ?? null;
  
  // Check if current user can manage this company
  const userId = session?.user?.id;
  const canManage = userId && (
    company.ownerId === userId ||
    company.creatorId === userId ||
    company.Employee.some(e => e.userId === userId)
  );

  // Calculate company reach stats from real product data
  const totalProductViews = company.Product.reduce((sum, p) => sum + p.viewCount, 0);
  const allRatings = company.Product.flatMap(p => p.Review.map(r => r.rating));
  const averageRating = allRatings.length > 0
    ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length
    : 0;

  // Unique visitors estimate (70% of total views)
  const uniqueVisitors = Math.floor(totalProductViews * 0.7);

  return (
    <BannerThemeWrapper bannerUrl={banner} className="w-full">
      {/* Full-bleed hero */}
      <div className="relative w-full">
        <div className="absolute inset-0">
          {banner ? (
            <>
              <Image src={banner} alt={`${company.name} banner`} fill className="object-cover" priority />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(0,0,0,0.55), rgba(0,0,0,0.40), rgba(0,0,0,0.70))," +
                    "radial-gradient(circle at top left, rgba(var(--theme-primary-rgb, 16, 185, 129), 0.28), transparent 55%)," +
                    "radial-gradient(circle at bottom right, rgba(var(--theme-secondary-rgb, 56, 189, 248), 0.22), transparent 45%)",
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(var(--theme-primary-rgb, 16, 185, 129), 0.18), rgba(var(--theme-secondary-rgb, 56, 189, 248), 0.14), rgba(var(--theme-accent-rgb, 217, 70, 239), 0.16))",
              }}
            />
          )}
        </div>

        <div className="relative mx-auto w-full max-w-screen-2xl px-4 pb-10 pt-10 md:pb-14 md:pt-14">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex items-end gap-4">
                <div className="relative h-16 w-16 md:h-20 md:w-20 overflow-hidden border border-white/20 bg-black/20 shadow-sm rounded-lg">
                  {logo ? <Image src={logo} alt={`${company.name} logo`} fill className="object-cover" /> : null}
                </div>

                <div className="min-w-0">
                  <h1 className="text-balance text-3xl md:text-4xl font-semibold tracking-tight text-white">
                    {company.name}
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-white/80">
                    {company.websiteUrl ? (
                      <a
                        className="truncate underline underline-offset-4 hover:text-white"
                        href={company.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {company.websiteUrl}
                      </a>
                    ) : null}
                    <span className="opacity-70">•</span>
                    <span>{company.Product.length} products</span>
                    <span className="opacity-70">•</span>
                    {company.orgVerification?.status === 'VERIFIED' && company.orgNumber ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-200"
                        title="Verified organization: company ownership confirmed via official registered email"
                      >
                        ✓ Verified organization
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/15 px-2 py-0.5 text-amber-100"
                        title="Unverified organization: no confirmed legal ownership link yet"
                      >
                        ⚠ Unverified organization
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/companies/${company.id}/hub`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    Hub
                  </Link>
                  <Link
                    href={`/companies/${company.id}/settings`}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/20"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                    Settings
                  </Link>
                </div>
              )}
            </div>

            {company.description ? (
              <p className="max-w-4xl text-pretty text-sm md:text-base text-white/85">
                {company.description}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-screen-2xl px-4 pb-12">
        <div className="pt-8">
          <div className="flex items-end justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-700 dark:text-zinc-200">
              Products
            </h2>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Latest first
            </div>
          </div>

          {company.Product.length ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {company.Product.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/3 dark:hover:bg-white/5 rounded-lg hover:rounded-2xl"
                >
                  <div className="flex gap-4 p-4">
                    <div className="relative h-20 w-20 flex-none overflow-hidden bg-black/5 dark:bg-white/3 rounded-md transition-[border-radius] duration-200 group-hover:rounded-xl">
                      {p.image?.[0] ? (
                        <Image src={p.image[0]} alt={p.title} fill className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
                        {p.category}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {p.title}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        ${p.price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">No products yet.</div>
          )}

          {/* Company Reach Analytics */}
          <CompanyReachChart 
            companyName={company.name}
            stats={{
              totalProductViews,
              uniqueVisitors,
              productCount: company.Product.length,
              averageRating,
            }}
          />
        </div>
      </div>
    </BannerThemeWrapper>
  );
}
