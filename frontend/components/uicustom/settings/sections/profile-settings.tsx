"use client";

/**
 * @fileOverview  Settings › Profile: banner, picture and bio with the same
 *                in-place framing editor as the public profile page. A picked
 *                or dropped image becomes the framing surface where it sits
 *                (drag to pan, slider/wheel to zoom); "Use this framing" bakes
 *                and uploads it, and Save Changes persists everything at once.
 * @stability     evolving
 */

import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type DragEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { toast } from "sonner";
import { FiCamera, FiCheck, FiChevronDown, FiChevronRight, FiImage, FiMove, FiSave, FiTrash2, FiUpload, FiUser, FiX } from "react-icons/fi";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Spinner from "@/components/uicustom/spinner";
import { FramerZoom, ImageFramer, type ImageFramerHandle } from "@/components/uicustom/image-framer";
import { useEdgeStore } from "@/lib/edgestore";
import { cn } from "@/lib/utils";
import { SectionHeader, SettingsGroup, StatusPill, StickyActions, fieldClass } from "../settings-primitives";
import { ReachAnalytics, type ReachStats } from "./reach-analytics";

type ImageTarget = "banner" | "avatar";
type Pending = { image?: string | null; banner?: string | null; bio?: string };
type Original = { image: string | null; banner: string | null; bio: string | null; name: string | null; reach: ReachStats | null };

const onImageButton = "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 text-xs font-medium text-white backdrop-blur-md transition-[background-color,border-color] duration-200 hover:border-white/30 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const accentPill = "inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand-accent px-3.5 text-xs font-semibold text-brand-accent-foreground shadow-e1 transition-[background-color] duration-200 hover:bg-brand-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const menuClass = "z-[120] min-w-52 rounded-xl border-border/70 bg-popover/95 p-1 shadow-e3 backdrop-blur-xl";
const menuItem = "min-h-10 gap-2 rounded-lg px-2.5 text-sm";

export function ProfileSettings({ userId, onSaved }: { userId: string; onSaved?: (changes: Pending) => void }) {
  const { edgestore } = useEdgeStore();
  const [original, setOriginal] = useState<Original>({ image: null, banner: null, bio: null, name: null, reach: null });
  const [pending, setPending] = useState<Pending>({});
  const [isSaving, setIsSaving] = useState(false);
  const [bannerEdit, setBannerEdit] = useState<File | null>(null);
  const [avatarEdit, setAvatarEdit] = useState<File | null>(null);
  const [bannerZoom, setBannerZoom] = useState(1);
  const [avatarZoom, setAvatarZoom] = useState(1);
  const [busy, setBusy] = useState<ImageTarget | null>(null);
  const [opening, setOpening] = useState<ImageTarget | null>(null);
  const [dragOver, setDragOver] = useState<ImageTarget | null>(null);
  const bannerFramer = useRef<ImageFramerHandle>(null);
  const avatarFramer = useRef<ImageFramerHandle>(null);
  const bannerInput = useRef<HTMLInputElement>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const hasUnsavedChanges = Object.keys(pending).length > 0;
  const current = (key: "image" | "banner") => (key in pending ? pending[key] ?? null : original[key]);
  const bio = "bio" in pending ? pending.bio ?? "" : original.bio ?? "";

  useEffect(() => {
    let active = true;
    fetch(`/api/users/${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const u = data.user || data;
        setOriginal({
          image: u.image || null, banner: u.banner || null, bio: u.bio || null, name: u.name || null,
          reach: u.reach ? { totalViews: u.reach.totalViews || 0, uniqueViewers: u.reach.uniqueViewers || 0, totalReplies: u.reach.totalReplies || 0, engagementRate: u.reach.engagementRate || 0, postCount: u._count?.posts || 0, followerCount: u._count?.followers || 0 } : null,
        });
      })
      .catch((err) => console.error("Failed to fetch profile:", err));
    return () => { active = false; };
  }, [userId]);

  const validImage = (file: File) => {
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) { toast.error("Please upload a valid image file (JPG, PNG, GIF, or WebP)"); return false; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return false; }
    return true;
  };
  const setEdit = (target: ImageTarget, file: File | null) => { (target === "banner" ? setBannerEdit : setAvatarEdit)(file); (target === "banner" ? setBannerZoom : setAvatarZoom)(1); };
  const setPendingImage = (target: ImageTarget, url: string | null) => setPending((prev) => (target === "banner" ? { ...prev, banner: url } : { ...prev, image: url }));

  const upload = useCallback(async (target: ImageTarget, file: File) => {
    setBusy(target);
    try {
      const res = await edgestore.myPublicImages.upload({ file });
      setPendingImage(target, res.url);
      toast.success(`${target === "banner" ? "Banner" : "Picture"} ready. Save Changes to apply it.`);
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setBusy(null);
    }
  }, [edgestore]);

  // A picked file becomes the framing surface; GIFs skip framing so the animation survives.
  const pickImage = (target: ImageTarget, file: File) => {
    if (!validImage(file)) return;
    if (file.type === "image/gif") { void upload(target, file); return; }
    setEdit(target, file);
  };
  const applyFraming = async (target: ImageTarget) => {
    const framer = target === "banner" ? bannerFramer : avatarFramer;
    if (!framer.current) return;
    setBusy(target);
    try {
      const blob = await framer.current.export(target === "banner" ? 1500 : 512, target === "banner" ? 500 : 512);
      setEdit(target, null);
      await upload(target, new File([blob], `${target}-framed.webp`, { type: "image/webp" }));
    } catch {
      toast.error("The framing could not be prepared. Try again.");
      setBusy(null);
    }
  };
  // Reframe what is already there: fetch it and open it in place.
  const startReframe = async (target: ImageTarget) => {
    const src = current(target === "banner" ? "banner" : "image");
    if (!src) { (target === "banner" ? bannerInput : avatarInput).current?.click(); return; }
    setOpening(target);
    try {
      const response = await fetch(src, { mode: "cors", signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error(String(response.status));
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error(blob.type);
      const ext = blob.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
      setEdit(target, new File([blob], `${target}-current.${ext}`, { type: blob.type }));
    } catch {
      toast.error("That image could not be loaded for editing. Upload a new one instead.");
    } finally {
      setOpening(null);
    }
  };

  const onInput = (target: ImageTarget) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) pickImage(target, file);
  };
  const onDrop = (target: ImageTarget) => (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(null);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (file.type.startsWith("image/")) pickImage(target, file); else toast.error("Please drop an image file");
  };
  const onPaste = (target: ImageTarget) => (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
    const file = item?.getAsFile();
    if (file) { e.preventDefault(); pickImage(target, file); }
  };

  const save = async () => {
    if (!hasUnsavedChanges) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pending) });
      if (!res.ok) throw new Error("Failed to update profile");
      setOriginal((prev) => ({ ...prev, ...pending }));
      onSaved?.(pending);
      setPending({});
      toast.success("Profile saved");
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };
  const discard = () => { setPending({}); setEdit("banner", null); setEdit("avatar", null); toast.info("Changes discarded"); };

  const bannerUrl = current("banner");
  const avatarUrl = current("image");
  const bannerChanged = "banner" in pending && pending.banner !== original.banner;
  const avatarChanged = "image" in pending && pending.image !== original.image;
  const bioChanged = "bio" in pending && (pending.bio ?? "") !== (original.bio ?? "");
  const saveActions = (
    <>
      <Button type="button" variant="vegaNormalBtn" onClick={discard} disabled={isSaving} className="min-h-11 gap-1.5"><FiX className="size-4" aria-hidden="true" />Discard</Button>
      <Button type="button" variant="vegaEmeraldBtn" onClick={() => void save()} disabled={isSaving || busy !== null} className="min-h-11 gap-1.5">
        {isSaving ? <Spinner className="size-4" /> : <FiSave className="size-4" aria-hidden="true" />}{isSaving ? "Saving…" : "Save Changes"}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiImage} title="Profile" description="Your banner, picture and bio, exactly as others see them." actions={hasUnsavedChanges && <div className="hidden items-center gap-2 sm:flex">{saveActions}</div>} />

      <input ref={bannerInput} aria-label="Choose banner image" type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onInput("banner")} />
      <input ref={avatarInput} aria-label="Choose profile picture" type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onInput("avatar")} />

      {/* The hero as it appears on the profile page: banner with the picture overlapping its bottom-left corner. */}
      <div>
        <div
          className={cn("relative aspect-[3/1] w-full overflow-hidden rounded-2xl bg-foreground/[0.04] transition-[box-shadow] duration-200", dragOver === "banner" && "ring-2 ring-brand-accent", bannerEdit && "z-10")}
          tabIndex={0}
          aria-label="Banner: paste or drop an image, or use the Edit banner menu"
          onPaste={onPaste("banner")}
          onDragOver={(e) => { e.preventDefault(); setDragOver("banner"); }}
          onDragLeave={() => setDragOver(null)}
          onDrop={onDrop("banner")}
        >
          {bannerEdit ? (
            <ImageFramer ref={bannerFramer} fill file={bannerEdit} aspect={3} zoom={bannerZoom} onZoomChange={setBannerZoom} className="rounded-2xl" />
          ) : bannerUrl ? (
            <Image src={bannerUrl} alt="Banner" fill sizes="(min-width: 1024px) 800px, calc(100vw - 32px)" className="object-cover" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.35),hsl(var(--brand-accent)/0.08)_55%,hsl(var(--muted)))]">
              <span className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur"><FiImage className="size-4" aria-hidden="true" />Add a banner · click, paste or drop</span>
            </div>
          )}
          {!bannerEdit && bannerUrl && <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-background/70 via-transparent to-transparent" />}
          {bannerChanged && !bannerEdit && <StatusPill tone="accent" className="absolute left-3 top-3">Unsaved</StatusPill>}
          {busy === "banner" && <div className="absolute inset-0 grid place-items-center bg-background/60 backdrop-blur-sm"><Spinner className="size-6" /></div>}

          <div className="absolute right-3 top-3 flex items-center gap-2">
            {bannerEdit ? (
              <>
                <button type="button" onClick={() => bannerInput.current?.click()} className={onImageButton}><FiUpload className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">Change</span></button>
                <button type="button" onClick={() => setEdit("banner", null)} disabled={busy === "banner"} className={onImageButton}><FiX className="size-3.5" aria-hidden="true" /><span className="hidden sm:inline">Cancel</span></button>
                <button type="button" onClick={() => void applyFraming("banner")} disabled={busy === "banner"} className={accentPill}><FiCheck className="size-3.5" aria-hidden="true" />Use this framing</button>
              </>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" disabled={busy !== null || opening !== null} aria-label="Edit banner" className={onImageButton}>
                    {opening === "banner" ? <Spinner className="size-3.5" /> : <FiCamera className="size-3.5" aria-hidden="true" />}<span className="hidden sm:inline">Edit banner</span><FiChevronDown className="size-3 opacity-70" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={menuClass}>
                  {bannerUrl && <DropdownMenuItem className={menuItem} onSelect={() => void startReframe("banner")}><FiMove className="size-4 text-muted-foreground" aria-hidden="true" />Reframe current banner</DropdownMenuItem>}
                  <DropdownMenuItem className={menuItem} onSelect={() => bannerInput.current?.click()}><FiUpload className="size-4 text-muted-foreground" aria-hidden="true" />Upload from device…</DropdownMenuItem>
                  {bannerUrl && (<><DropdownMenuSeparator /><DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={() => setPendingImage("banner", null)}><FiTrash2 className="size-4" aria-hidden="true" />Remove banner</DropdownMenuItem></>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {bannerEdit && (
            <div className="absolute bottom-3 right-3 w-56 sm:w-72">
              <span className={cn(onImageButton, "w-full gap-2 px-3")}><FiMove className="size-4 shrink-0" aria-hidden="true" /><FramerZoom zoom={bannerZoom} onZoomChange={setBannerZoom} className="flex-1 [&_[data-track]]:bg-white/30" /></span>
            </div>
          )}
        </div>

        <div className="pointer-events-none relative -mt-12 ml-4 flex flex-wrap items-end gap-3 sm:-mt-14 sm:ml-6 [&>*]:pointer-events-auto">
          <div
            className={cn("relative z-20 w-fit rounded-full", dragOver === "avatar" && "ring-2 ring-brand-accent ring-offset-2 ring-offset-card")}
            tabIndex={0}
            aria-label="Profile picture: paste or drop an image, or use the camera button"
            onPaste={onPaste("avatar")}
            onDragOver={(e) => { e.preventDefault(); setDragOver("avatar"); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={onDrop("avatar")}
          >
            {avatarEdit ? (
              <div className="relative size-24 overflow-hidden rounded-full shadow-e2 ring-4 ring-card sm:size-28"><ImageFramer ref={avatarFramer} fill round file={avatarEdit} aspect={1} zoom={avatarZoom} onZoomChange={setAvatarZoom} className="rounded-full" /></div>
            ) : (
              <Avatar className="size-24 shadow-e2 ring-4 ring-card sm:size-28">
                <AvatarImage src={avatarUrl || undefined} alt={original.name ? `${original.name} profile picture` : "Profile picture"} className="object-cover" />
                <AvatarFallback className="bg-[linear-gradient(135deg,hsl(var(--brand-accent)/0.5),hsl(var(--muted)))] text-2xl font-medium text-foreground">{original.name?.[0]?.toUpperCase() || <FiUser className="size-8" aria-hidden="true" />}</AvatarFallback>
              </Avatar>
            )}
            {busy === "avatar" && <div className="absolute inset-0 grid place-items-center rounded-full bg-background/60 backdrop-blur-sm"><Spinner className="size-5" /></div>}
            {!avatarEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" disabled={busy !== null || opening !== null} aria-label="Edit profile picture" className="absolute bottom-0 right-0 grid size-10 place-items-center rounded-full border-2 border-card bg-card text-foreground shadow-e1 transition-[background-color] duration-200 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
                    {opening === "avatar" ? <Spinner className="size-4" /> : <FiCamera className="size-4" aria-hidden="true" />}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className={menuClass}>
                  {avatarUrl && <DropdownMenuItem className={menuItem} onSelect={() => void startReframe("avatar")}><FiMove className="size-4 text-muted-foreground" aria-hidden="true" />Reframe current picture</DropdownMenuItem>}
                  <DropdownMenuItem className={menuItem} onSelect={() => avatarInput.current?.click()}><FiUpload className="size-4 text-muted-foreground" aria-hidden="true" />Upload from device…</DropdownMenuItem>
                  {avatarUrl && (<><DropdownMenuSeparator /><DropdownMenuItem className={cn(menuItem, "text-destructive focus:text-destructive")} onSelect={() => setPendingImage("avatar", null)}><FiTrash2 className="size-4" aria-hidden="true" />Remove picture</DropdownMenuItem></>)}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          {avatarEdit ? (
            <div className="mb-1 flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-popover/95 p-2 shadow-e2 backdrop-blur-xl">
              <FramerZoom zoom={avatarZoom} onZoomChange={setAvatarZoom} className="min-w-40 flex-1" onReset={() => avatarFramer.current?.reset()} />
              <button type="button" onClick={() => avatarInput.current?.click()} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/60 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FiUpload className="size-3.5" aria-hidden="true" />Change</button>
              <button type="button" onClick={() => setEdit("avatar", null)} disabled={busy === "avatar"} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border/60 px-2.5 text-xs font-medium text-foreground hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FiX className="size-3.5" aria-hidden="true" />Cancel</button>
              <button type="button" onClick={() => void applyFraming("avatar")} disabled={busy === "avatar"} className={cn(accentPill, "min-h-9")}><FiCheck className="size-3.5" aria-hidden="true" />Use this framing</button>
            </div>
          ) : (
            <div className="mb-2 min-w-0 flex-1 basis-full sm:basis-auto">
              <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">{original.name || "Your name"}{avatarChanged && <StatusPill tone="accent">Picture unsaved</StatusPill>}</p>
              <p className="text-xs text-muted-foreground">Banner 1500×500 · picture 512×512 · JPG, PNG, GIF or WebP up to 5 MB. Drag to reframe before saving; GIFs are kept as they are.</p>
            </div>
          )}
        </div>
      </div>

      <SettingsGroup title="Bio" description="Up to 500 characters. Shown on your profile and next to your listings." action={bioChanged && <StatusPill tone="accent">Unsaved</StatusPill>}>
        <Textarea value={bio} onChange={(e) => setPending((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Tell others about yourself…" maxLength={500} aria-label="Bio" className={cn(fieldClass, "min-h-28 resize-none")} />
        <p className="text-right text-xs tabular-nums text-muted-foreground">{bio.length}/500</p>
      </SettingsGroup>

      <ReachAnalytics reach={original.reach} />

      <div className="border-t border-border/60 pt-4">
        <Link href={`/profile/${userId}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-brand-accent-hover transition-colors hover:text-brand-accent dark:text-brand-accent-light">
          <FiUser className="size-4" aria-hidden="true" />View your public profile<FiChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      {hasUnsavedChanges && (
        <StickyActions>
          <p className="mr-auto text-sm text-muted-foreground">You have unsaved changes.</p>
          {saveActions}
        </StickyActions>
      )}
    </div>
  );
}
