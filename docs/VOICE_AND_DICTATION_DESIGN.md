# Voice Channels, Dictation & Voice-Learning — Technical Design

> Status: **DRAFT for sign-off** · Owner: voice workstream · Last updated: 2026-06-17
> Related memory: [[voice-architecture-decision]], [[chat-redesign-north-star]]

This is the one-page (ish) design that PR-1 depends on. It reconciles the build
plan with **what already exists in the repo** so we extend rather than reinvent.

---

## 1. What already exists (verified in-repo, do not rebuild)

| Concern | Reality today | Implication |
|---|---|---|
| Voice seam | `frontend/lib/voice/types.ts` — `VoiceProvider` interface; UI binds only to it. | Extend this interface; never import a vendor SDK into components. |
| Provider switch | `useVoiceRoom.ts` factory: LiveKit when `NEXT_PUBLIC_LIVEKIT_URL` set, else `StubVoiceProvider`. | Single switch stays. Stub remains the no-keys fallback. |
| LiveKit (real) | `livekit-provider.ts` connects, publishes mic, maps active-speakers → `VoiceMember[]`. Raise-hand rides participant **metadata**; host actions (`promote/demote/mute/remove`) currently only `publishData` a signal — **no server actor consumes it yet**. | PR-1/PR-2 must add the server-side actor (token re-issue / `RoomServiceClient.updateParticipant`). |
| Token mint | `app/api/voice/token/route.ts` — mints LiveKit JWT, rooms namespaced `vegga_<roomId>`, `canPublish = isHost`, returns `{configured:false}` when keys absent. | Keep path + namespace. Promotion = re-mint token with `canPublish:true` OR server `updateParticipant`. |
| Dictation cleanup | `app/api/voice/polish/route.ts` — **Gemini 1.5 Flash** (BYOK Google key, platform fallback), Wispr-style filler/self-correction cleanup, returns raw on any failure. | Reuse as-is for the LLM cleanup pass. **Correction:** the original prompt assumed Claude/Deepgram for this step — polish stays Gemini. |
| Discord roles | `AiMemberRole` enum (OWNER/MODERATOR/MEMBER) on `AiConvParticipant`; creator backfilled to OWNER (migration `20260617000000_add_ai_member_role`). | New voice membership mirrors this enum exactly. |
| SDK deps | `livekit-client@^2.19`, `livekit-server-sdk@^2.15` installed. **No Deepgram / ElevenLabs deps yet.** | STT/TTS deps added in their PRs only. |
| UI | `ChatSidebar.tsx` (stage/listeners/raise-hand/host buttons — buttons **not wired**, line ~331), `VoiceSettingsModal.tsx` (device pick + live mic test), `useMicLevel.ts`, `MicWaveform`. | Extend these; host buttons get wired in PR-1. |
| Realtime app events | Pusher (existing across app). | Channel created / member joined / hand raised app-events ride Pusher, not a new socket. |

**Net:** "voice channels" is ~60% scaffolded. The missing pieces are server-side
role enforcement, persistence, push-to-talk, STT capture (vs. cleanup), and the
learning loop.

---

## 2. Deploy topology (the boundary that bites)

```
┌────────────────────────┐     mint JWT / CRUD / webhooks / polish / STT-batch
│  Vercel (Next.js app)  │◄──────────────────────────────────────────────┐
│  - /api/voice/token    │                                                │
│  - /api/voice/polish   │   token                                        │
│  - /api/voice/channels │──────────────┐                                 │
│  - /api/dictation/*    │              ▼                                 │
└─────────┬──────────────┘     ┌─────────────────┐    media (WebRTC)   ┌──┴────────┐
          │ Pusher app-events  │  LiveKit Cloud  │◄───────────────────│  Browsers │
          ▼                    │   (SFU media)   │                     └───────────┘
   ┌────────────┐             └────────┬────────┘
   │  Postgres  │                      │ room audio (subscribe)
   │  (Prisma)  │             ┌────────▼─────────────────────────┐
   └────────────┘             │  LiveKit Agent worker (NOT Vercel)│
                              │  Railway/Fly/Render — long-running │
                              │  - Deepgram streaming STT          │
                              │  - emits captions (data channel)   │
                              │  - writes VoiceSession transcript  │
                              │  - optional egress→EdgeStore record│
                              └────────────────────────────────────┘
```

**Hard rule:** anything needing a persistent socket or long-lived audio
subscription (the live-room transcriber, egress recording) runs in the Agent
worker, **off Vercel**. Vercel handles only request/response: token mint, CRUD,
the `polish` cleanup, and **short** dictation transcription (composer utterances,
within `maxDuration`). PRs that touch the worker must say so in their summary.

---

## 3. Data model (additive Prisma migrations)

Mirror existing conventions: `cuid()` ids, `createdAt`/`updatedAt`, FK indexes,
enums in SCREAMING_CASE. Reuse the `AiMemberRole`-style role naming.

```prisma
enum VoiceRoleDB { HOST MODERATOR SPEAKER LISTENER }       // DB role (superset of UI VoiceRole)
enum DictationSource { COMPOSER ROOM }
enum CorrectionKind { TYPO MISHEARD INTENTIONAL_REPHRASE UNKNOWN }

model VoiceChannel {
  id             String   @id @default(cuid())
  conversationId String?  // link to an existing Conversation (DM/group) — optional
  ownerUserId    String
  name           String
  slug           String
  isPersonal     Boolean  @default(false)   // auto-created "Vegga's channel"
  isLocked       Boolean  @default(false)
  maxSpeakers    Int?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  members        VoiceChannelMember[]
  sessions       VoiceSession[]
  @@unique([ownerUserId, slug])
  @@index([conversationId])
  @@index([ownerUserId])
}

model VoiceChannelMember {
  id          String      @id @default(cuid())
  channelId   String
  userId      String
  role        VoiceRoleDB @default(LISTENER)
  mutedByHost Boolean     @default(false)
  joinedAt    DateTime    @default(now())
  lastSeenAt  DateTime    @default(now())
  channel     VoiceChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  @@unique([channelId, userId])
  @@index([channelId])
  @@index([userId])
}

model VoiceSession {
  id               String   @id @default(cuid())
  channelId        String
  startedAt        DateTime @default(now())
  endedAt          DateTime?
  recordingAssetId String?  // EdgeStore key (consent-gated)
  transcriptJson   Json?    // [{ userId, ts, text }]
  participantsJson Json?    // snapshot
  channel          VoiceChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  @@index([channelId, startedAt])
}

model DictationProfile {
  id               String   @id @default(cuid())
  userId           String   @unique
  language         String   @default("en")
  customVocabulary String[] @default([])  // → Deepgram keyterm boosting
  replacements     Json     @default("{}") // { "veggat": "Veggat" } applied post-STT
  captureConsent   Boolean  @default(false) // store audio? opt-in
  utteranceCount   Int      @default(0)
  correctionCount  Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model DictationUtterance {
  id            String          @id @default(cuid())
  userId        String
  source        DictationSource @default(COMPOSER)
  rawTranscript String          @db.Text
  finalText     String          @db.Text  // what the user actually accepted/sent
  confidence    Float?
  wordsJson     Json?           // per-word { word, start, end, confidence }
  audioAssetId  String?         // EdgeStore key, only if captureConsent
  createdAt     DateTime        @default(now())
  corrections   DictationCorrection[]
  @@index([userId, createdAt])
}

model DictationCorrection {
  id               String         @id @default(cuid())
  utteranceId      String
  originalWord     String
  correctedWord    String
  wordIndex        Int
  kind             CorrectionKind @default(UNKNOWN)
  userConfirmed    Boolean        @default(false)
  reSaidAudioAssetId String?
  createdAt        DateTime       @default(now())
  utterance        DictationUtterance @relation(fields: [utteranceId], references: [id], onDelete: Cascade)
  @@index([utteranceId])
}
```

**Migration plan / reconciliation:**
1. The in-flight `20260617000000_add_ai_member_role` is **already a clean,
   self-contained migration** (creates `AiMemberRole`, adds column, backfills
   OWNER). It is unrelated to voice tables → leave it as the immediate next
   migration; just `git add` it with PR-1 so it's not orphaned.
2. New voice/dictation tables go in a **separate** migration
   (`<ts>_add_voice_and_dictation`) created via `prisma migrate dev` so the diff
   is reviewable and the AI-role migration history stays intact.
3. `VoiceRoleDB` is a DB superset; the UI `VoiceRole` (`host|speaker|listener`)
   maps from it (MODERATOR → host-capable in UI for now). Keep the mapping in one
   helper so we don't scatter it.

---

## 4. Host-control protocol (the missing server actor)

Today `promote/demote/mute/remove` only `publishData` a hint into the room — no
authority enforces it. Fix:

- New `POST /api/voice/channels/[channelId]/members/[userId]/role` (and `/mute`,
  `/remove`). Authorizes caller is HOST/MODERATOR of that channel via
  `VoiceChannelMember`, then:
  - **promote** → server `RoomServiceClient.updateParticipant` granting
    `canPublish:true` (or re-mint token), update `VoiceChannelMember.role`.
  - **mute** → `updateParticipant`/`mutePublishedTrack`, set `mutedByHost`.
  - **remove** → `removeParticipant`.
- Persist the role change, then emit a **Pusher** event so every client's roster
  updates; the LiveKit metadata path remains for instant optimistic UI.
- `livekit-provider.ts` `signal()` is replaced by a `fetch` to these endpoints
  (keep the data-channel emit as optimistic echo only).

Auth source of truth = `VoiceChannelMember.role`, **not** client-claimed `isHost`
(the token route currently trusts `body.isHost` — PR-1 hardens it to derive host
from membership/ownership server-side).

---

## 5. Auto-created personal channel ("Vegga joins → Vegga's channel")

On first join where no `VoiceChannel` exists for the context:
- If joining your *own* conversation/profile with no channel → create
  `VoiceChannel{ isPersonal:true, ownerUserId:self, name:"<Name>'s channel" }`
  and a `VoiceChannelMember{ role:HOST }`. Idempotent (unique `ownerUserId+slug`).
- Others joining that channel get `LISTENER` (or SPEAKER if `isLocked=false` and
  channel policy allows). Owner keeps HOST.

---

## 6. Correction-diff & profile-application algorithm (learning loop v1)

**Provenance:** when dictation inserts text into the composer, tag the inserted
range with its `DictationUtterance.id` (in-memory map keyed by composer span).
On send/edit, we know which utterance produced which words.

**Detection (pure function, unit-tested):**
```
diffCorrections(utterance.finalText, editedText, utterance.wordsJson) -> Correction[]
```
- Token-align original vs edited (word-level Levenshtein / Myers diff).
- For each substitution where the original token came from the utterance, emit a
  candidate `{ originalWord, correctedWord, wordIndex }`.
- Classify `kind` heuristically first: identical-after-normalization → ignore;
  homophone/edit-distance≤2 + low STT word-confidence → likely **MISHEARD**;
  otherwise **UNKNOWN** (ask the user).

**Prompt UX:** quiet inline chip — *"Did I mishear 'X'? You said it, I wrote
'Y'."* → **[Typo — my fault]** / **[You misheard — Re-say it 🎤]** / **[I
changed my mind]**. Re-said audio → `reSaidAudioAssetId`; sets
`userConfirmed=true`, `kind=MISHEARD`.

**Application (immediate, no training):** a confirmed MISHEARD updates
`DictationProfile`:
- add `correctedWord` (and any proper noun) to `customVocabulary` → next STT call
  passes it as Deepgram **keyterm** boosting.
- add `{ misheardForm: correctedWord }` to `replacements` → applied as a
  deterministic post-STT pass before the Gemini `polish` step.

This is the shippable loop. **Roadmap (not built in v1):** `DictationUtterance` +
confirmed `DictationCorrection` form a paired (raw→corrected) corpus; an eval
harness measures WER on a per-user held-out slice; once a user has enough labeled
pairs (rough order: low-thousands of words), evaluate per-user acoustic biasing /
fine-tuning. v1 delivers value with zero of that.

---

## 7. PR sequence (unchanged from plan, re-scoped to reality)

1. **PR-1** Voice channel backend: models + migration, channel CRUD, auto-personal
   channel, **harden token route** (derive host from membership), wire host-action
   endpoints + Pusher, wire the dead `ChatSidebar` buttons. *(builds on existing
   token route + provider)*
2. **PR-2** Finish `LiveKitVoiceProvider` host controls against the new endpoints +
   real `updateParticipant`. Real audio verified across two sessions.
3. **PR-3** Push-to-talk / push-to-mute hold-key (default `V`), composer-focus-safe,
   accessible toggle fallback. Settings in `VoiceSettingsModal`.
4. **PR-4** Award-worthy UI pass (channel list, presence, crown/shield, mobile sheet).
5. **PR-5** Dictation **capture** (`SpeechToText` iface + Deepgram), composer mic +
   hold-key, persist `DictationUtterance`, apply `DictationProfile`. Reuse existing
   `polish` for cleanup.
6. **PR-6** Live-room transcription **Agent worker** (off Vercel) + optional egress
   recording, consent-gated.
7. **PR-7** TTS (`TextToSpeech` iface + ElevenLabs, Aura fallback), read-aloud, cache
   by content hash.
8. **PR-8** Correction-learning loop (diff fn + prompt UX + profile application).

---

## 8. Cross-cutting (every PR)

- **Consent/GDPR:** audio capture/recording opt-in, indicated, deletable; reuse
  existing GDPR/privacy models.
- **Cost:** STT/TTS metering + caps; cache TTS; silence-stop streaming.
- **A11y:** keyboard-reachable, ARIA, `useReducedMotion`, captions for room audio.
- **Resilience:** stub fallback when keys absent; LiveKit reconnect; never lose an
  in-progress dictation on a blip.
- **Verification:** unit tests for the diff/profile fns; two-session manual test for
  rooms; recorded animation for any motion change (per [[record-animations-rule]]).

---

## 9. Decisions (signed off 2026-06-18)

1. **STT vendor for capture → Deepgram.** Streaming + keyterm boosting (powers the
   learning-loop vocabulary biasing). Cleanup step stays Gemini (`/api/voice/polish`).
   `SpeechToText` interface keeps it swappable.
2. **Channel scope → Both.** Voice channels may attach to a `Conversation` *and*
   exist as standalone/personal channels — keep `conversationId` nullable and the
   `isPersonal` auto-create path (§5).
3. **Recording default → off** unless host enables, with all participants notified
   (consent-gated, "recording" badge visible).

## 10. Status

Design **approved**; awaiting go-ahead to build PR-1 (models + migration, channel
CRUD, auto-personal channel, token-route hardening, wire host actions + dead
`ChatSidebar` buttons). The in-flight `20260617000000_add_ai_member_role` migration
will be committed alongside PR-1 so it is not orphaned.
