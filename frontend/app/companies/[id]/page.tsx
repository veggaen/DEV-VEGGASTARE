import Image from "next/image";
import PriceAmount from '@/components/crypto-related/PriceAmount';
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, Globe, LayoutDashboard, Package, Settings, ShieldAlert, Star, Users } from "lucide-react";

import { dbPrisma } from "@/lib/db";
import { auth } from "@/auth";
import CompanyReachChart from "@/components/uicustom/company/CompanyReachChart";
import BannerThemeWrapper from "@/components/uicustom/banner/BannerThemeWrapper";
import { HoverChaser } from "@/components/uicustom/chrome/hover-chaser";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const heroBtn = "inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-black/45 px-3.5 text-sm font-medium text-white backdrop-blur-md transition-[background-color,border-color] duration-200 hover:border-white/30 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default async function CompanyPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: companyId } = await params;
  const session = await auth();
  if (!companyId) notFound();

  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: {
      id: true, name: true, description: true, websiteUrl: true, orgNumber: true, orgType: true, logo: true, bannerImage: true, ownerId: true, creatorId: true, createdAt: true,
      Employee: { select: { userId: true } },
      Product: {
        where: { visibility: 'PUBLIC' },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, price: true, priceCurrency: true, image: true, category: true, viewCount: true, Review: { select: { rating: true } } },
      },
      orgVerification: { select: { status: true } },
    },
  });
  if (!company) notFound();

  const banner = company.bannerImage?.[0] ?? null;
  const logo = company.logo?.[0] ?? null;
  const userId = session?.user?.id;
  const canManage = userId && (company.ownerId === userId || session?.user?.role === 'ADMIN' || session?.user?.role === 'OWNER' || company.Employee.some(e => e.userId === userId));
  const verified = company.orgVerification?.status === 'VERIFIED' && !!company.orgNumber;

  const totalProductViews = company.Product.reduce((sum, p) => sum + p.viewCount, 0);
  const allRatings = company.Product.flatMap(p => p.Review.map(r => r.rating));
  const averageRating = allRatings.length > 0 ? allRatings.reduce((sum, r) => sum + r, 0) / allRatings.length : 0;
  let website: string | null = null;
  try { const url = new URL(company.websiteUrl ?? ''); if (['https:', 'http:'].includes(url.protocol)) website = url.href; } catch { /* no public website */ }
  const founded = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(company.createdAt);

  return (
    <BannerThemeWrapper bannerUrl={banner} className="w-full">
      {/* Hero: the banner with the identity block over its lower edge */}
      <div className="relative w-full">
        <div className="absolute inset-0">
          {banner ? (
            <>
              <Image src={banner} alt="" fill sizes="100vw" className="object-cover" priority />
              <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.45),rgba(0,0,0,0.35)_50%,rgba(0,0,0,0.75))]" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.35),hsl(var(--brand-accent)/0.08)_55%,hsl(var(--muted)))]" />
          )}
        </div>

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-8 pt-6 sm:px-6 lg:px-8 md:pb-10 md:pt-8">
          <Link href="/companies" className={`${heroBtn} mb-6`}><ArrowLeft aria-hidden="true" className="size-4" />Back to companies</Link>
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex min-w-0 items-end gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl border-2 border-white/20 bg-card shadow-e2 md:size-24">
                {logo ? <Image src={logo} alt="" fill sizes="96px" className="object-cover" /> : <span className="grid h-full w-full place-items-center text-3xl font-semibold text-foreground">{company.name[0]?.toUpperCase()}</span>}
              </div>
              <div className="min-w-0 pb-1">
                <h1 className="text-balance text-3xl font-semibold tracking-tight text-white drop-shadow-sm md:text-4xl">{company.name}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/85">
                  {verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-accent/50 bg-brand-accent/25 px-2.5 py-0.5 text-xs font-semibold text-white" title="Verified organization: ownership confirmed through the registered email"><BadgeCheck aria-hidden="true" className="size-3.5" />Verified organization</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-black/35 px-2.5 py-0.5 text-xs font-medium text-white/90" title="No confirmed legal ownership link yet"><ShieldAlert aria-hidden="true" className="size-3.5" />Unverified organization</span>
                  )}
                  {company.orgType && <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-0.5 text-xs font-medium">{company.orgType}</span>}
                  <span className="inline-flex items-center gap-1 text-xs"><Package aria-hidden="true" className="size-3.5" />{company.Product.length} products</span>
                  <span className="inline-flex items-center gap-1 text-xs"><Users aria-hidden="true" className="size-3.5" />{company.Employee.length + 1} people</span>
                  <span className="text-xs">Since {founded}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {website && <a className={heroBtn} href={website} target="_blank" rel="noreferrer"><Globe aria-hidden="true" className="size-4" />Website</a>}
              {canManage && (
                <>
                  <Link href={`/companies/${company.id}/hub`} className={heroBtn}><LayoutDashboard aria-hidden="true" className="size-4" />Hub</Link>
                  <Link href={`/companies/${company.id}/settings`} className={heroBtn}><Settings aria-hidden="true" className="size-4" />Settings</Link>
                </>
              )}
            </div>
          </div>
          {company.description && <p className="mt-5 max-w-3xl text-pretty text-sm leading-relaxed text-white/85 md:text-base">{company.description}</p>}
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-10 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        {/* Stat strip */}
        <HoverChaser as="div" className="grid grid-cols-2 gap-3 lg:grid-cols-4" boxClassName="rounded-2xl">
          {[
            { label: 'Products', value: company.Product.length.toLocaleString(), icon: Package },
            { label: 'Product views', value: totalProductViews.toLocaleString(), icon: Users },
            { label: 'Average rating', value: allRatings.length ? averageRating.toFixed(1) : '—', icon: Star },
            { label: 'Reviews', value: allRatings.length.toLocaleString(), icon: BadgeCheck },
          ].map((stat) => (
            <div key={stat.label} data-chase className="rounded-2xl border border-border/60 bg-card/70 p-4 shadow-e1 backdrop-blur-xl">
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><stat.icon aria-hidden="true" className="size-3.5 text-brand-accent" />{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{stat.value}</p>
            </div>
          ))}
        </HoverChaser>

        <section aria-labelledby="company-products">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="company-products" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Products</h2>
              <p className="mt-1 text-sm text-muted-foreground">Latest first. Open a product to see files, price and reviews.</p>
            </div>
          </div>
          {company.Product.length ? (
            <HoverChaser className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" boxClassName="rounded-2xl">
              {company.Product.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} data-chase className="group flex min-w-0 gap-4 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-e1 backdrop-blur-xl transition-[transform] duration-200 motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <div className="relative size-20 flex-none overflow-hidden rounded-xl bg-muted">
                    {p.image?.[0] ? <Image src={p.image[0]} alt="" fill sizes="80px" className="object-cover" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{p.category}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-foreground">{p.title}</p>
                    <p className="mt-2 flex items-center justify-between gap-2 text-sm font-semibold text-brand-accent-hover dark:text-brand-accent-light">
                      <PriceAmount amount={p.price} currency={p.priceCurrency} />
                      <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-brand-accent" />
                    </p>
                  </div>
                </Link>
              ))}
            </HoverChaser>
          ) : (
            <p className="rounded-2xl border border-dashed border-border/70 px-5 py-10 text-center text-sm text-muted-foreground">No products yet.</p>
          )}
        </section>

        <CompanyReachChart companyName={company.name} stats={{ totalProductViews, productCount: company.Product.length, averageRating, reviewCount: allRatings.length }} />
      </div>
    </BannerThemeWrapper>
  );
}
