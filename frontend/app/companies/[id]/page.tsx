import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dbPrisma } from "@/lib/db";
import { auth } from "@/auth";
import CompanyReachChart from "@/components/uicustom/company/CompanyReachChart";

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
        },
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

  // Calculate company reach stats
  // Note: viewCount and rating are not currently on Product model - would need to be added
  const totalProductViews = 0; // Placeholder until Product.viewCount is added
  const averageRating = 0; // Placeholder until Product.rating is added

  // For unique visitors, we'd need to track this separately - using estimate for now
  const uniqueVisitors = Math.floor(totalProductViews * 0.7); // Estimate: 70% unique

  return (
    <div className="w-full">
      {/* Full-bleed hero */}
      <div className="relative w-full">
        <div className="absolute inset-0">
          {banner ? (
            <>
              <Image src={banner} alt={`${company.name} banner`} fill className="object-cover" priority />
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/40 to-black/70" />
            </>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 via-sky-500/10 to-fuchsia-500/15" />
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
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-200">
              Products
            </h2>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Latest first
            </div>
          </div>

          {company.Product.length ? (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {company.Product.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="group border border-black/10 bg-white/40 backdrop-blur-sm transition-[border-radius,box-shadow,background-color] duration-200 hover:bg-white/60 hover:shadow-lg dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.05] rounded-lg hover:rounded-2xl"
                >
                  <div className="flex gap-4 p-4">
                    <div className="relative h-20 w-20 flex-none overflow-hidden bg-black/5 dark:bg-white/[0.03] rounded-md transition-[border-radius] duration-200 group-hover:rounded-xl">
                      {p.image?.[0] ? (
                        <Image src={p.image[0]} alt={p.title} fill className="object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                        {p.category}
                      </div>
                      <div className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
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
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300">No products yet.</div>
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
    </div>
  );
}
