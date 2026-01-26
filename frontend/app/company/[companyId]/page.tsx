import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { dbPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CompanyPublicPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;

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

              <div className="flex items-center gap-3">
                <Link
                  href={`/nexus/company/${company.id}`}
                  className="text-sm text-white/80 hover:text-white"
                >
                  Manage company
                </Link>
              </div>
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
        </div>
      </div>
    </div>
  );
}
