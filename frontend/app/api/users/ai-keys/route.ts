import { NextResponse } from "next/server";
import { z } from "zod";

import { MyLibUserAuth } from "@/lib/user-auth";
import { ensureUser } from "@/lib/ensure-user";
import { AI_PROVIDER_VALUES, normalizeProvider } from "@/lib/ai-key-crypto";
import {
  deleteUserAiKey,
  listUserAiKeyMeta,
  setDefaultUserAiProvider,
  upsertUserAiKey,
} from "@/lib/ai-key-store";

const SaveSchema = z.object({
  provider: z.enum(AI_PROVIDER_VALUES),
  apiKey: z.string().min(8),
  setDefault: z.boolean().optional(),
});

const DeleteSchema = z.object({
  provider: z.enum(AI_PROVIDER_VALUES),
});

const SetDefaultSchema = z.object({
  provider: z.enum(AI_PROVIDER_VALUES),
});

export async function GET() {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ensure = await ensureUser(session);
  if (!ensure.success) {
    return NextResponse.json({ error: "Failed to initialize user." }, { status: 500 });
  }

  try {
    const keys = await listUserAiKeyMeta(ensure.userId);
    return NextResponse.json({
      providers: AI_PROVIDER_VALUES,
      keys,
      hasSavedKeys: keys.length > 0,
    });
  } catch (error) {
    console.error("[api/users/ai-keys][GET]", error);
    return NextResponse.json({ error: "Failed to load AI keys." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ensure = await ensureUser(session);
  if (!ensure.success) {
    return NextResponse.json({ error: "Failed to initialize user." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse({
    provider: normalizeProvider((body as any)?.provider),
    apiKey: (body as any)?.apiKey,
    setDefault: (body as any)?.setDefault,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider or API key." }, { status: 400 });
  }

  try {
    await upsertUserAiKey({
      userId: ensure.userId,
      provider: parsed.data.provider,
      apiKey: parsed.data.apiKey,
      setDefault: parsed.data.setDefault,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/users/ai-keys][PUT]", error);
    return NextResponse.json({ error: error?.message || "Failed to save AI key." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ensure = await ensureUser(session);
  if (!ensure.success) {
    return NextResponse.json({ error: "Failed to initialize user." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = SetDefaultSchema.safeParse({ provider: normalizeProvider((body as any)?.provider) });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  try {
    await setDefaultUserAiProvider(ensure.userId, parsed.data.provider);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[api/users/ai-keys][PATCH]", error);
    return NextResponse.json({ error: error?.message || "Failed to set default provider." }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await MyLibUserAuth();
  if (!session?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ensure = await ensureUser(session);
  if (!ensure.success) {
    return NextResponse.json({ error: "Failed to initialize user." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = DeleteSchema.safeParse({ provider: normalizeProvider((body as any)?.provider) });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid provider." }, { status: 400 });
  }

  try {
    const result = await deleteUserAiKey(ensure.userId, parsed.data.provider);
    return NextResponse.json({ success: result.deleted });
  } catch (error) {
    console.error("[api/users/ai-keys][DELETE]", error);
    return NextResponse.json({ error: "Failed to delete AI key." }, { status: 500 });
  }
}
