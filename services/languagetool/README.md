# VeggaStare LanguageTool Service

Self-hosted spelling and grammar cleanup for Pulse dictation.

## Railway

Create a new Railway service from this folder:

```text
services/languagetool
```

After Railway gives you a public URL, set this on the Vercel frontend:

```text
LANGUAGETOOL_API_URL=https://your-languagetool-service.up.railway.app/v2/check
```

The Pulse polish endpoint tries LanguageTool first, then Gemini/BYOK if
configured, then local cleanup. Dictation therefore does not require paid AI just
to add basic punctuation, casing, and spelling fixes.
