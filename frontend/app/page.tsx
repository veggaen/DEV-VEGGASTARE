import dynamic from "next/dynamic";
import HomeHero from "@/components/uicustom/home/home-hero";
import LandingChatWidget from "@/components/uicustom/home/LandingChatWidget";
import HeroParticleField from "@/components/uicustom/home/HeroParticleField";
import { MyLibUserAuth } from "@/lib/user-auth";

// Split below-fold content into a separate JS chunk so the hero can hydrate
// and become interactive before the larger below-fold code is parsed.
const BelowFoldSections = dynamic(
  () => import("@/components/uicustom/home/BelowFoldSections"),
  { ssr: true, loading: () => null }
);

export default async function Home() {
  const user = await MyLibUserAuth();

  return (
    <>
      {/* Full-page particle background — fixed, covers the whole landing page and
          sits behind the navbar + all content while scrolling. */}
      <HeroParticleField fixed className="z-0" />

      <HomeHero isLoggedIn={!!user} userName={(user as any)?.name ?? null}>
        <LandingChatWidget
          isLoggedIn={!!user}
          userId={(user as any)?.id ?? null}
        />
      </HomeHero>
      <BelowFoldSections />
    </>
  );
}