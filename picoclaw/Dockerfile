# ── PicoClaw Research Sidecar ────────────────────────────────────────────────
# Lightweight Go binary (<10MB RAM) that provides web search + fact-checking
# for the AI poll generation pipeline. Deployed on Railway alongside the backend.
#
# Gateway mode: exposes REST API on port 8080 for the Vercel frontend to call.
# Tools: DuckDuckGo (free, always available) + Brave Search (paid, primary).
# ─────────────────────────────────────────────────────────────────────────────

FROM alpine:3.20 AS builder

ARG PICOCLAW_VERSION=v0.3.0

RUN apk add --no-cache curl tar

# Download PicoClaw binary for linux/amd64
# Pin to a specific version for reproducible builds
RUN curl -fsSL "https://github.com/anthropics/picoclaw/releases/download/${PICOCLAW_VERSION}/picoclaw_linux_amd64.tar.gz" \
    -o /tmp/picoclaw.tar.gz \
    && tar -xzf /tmp/picoclaw.tar.gz -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/picoclaw \
    && rm /tmp/picoclaw.tar.gz

# ── Production stage ─────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache ca-certificates

COPY --from=builder /usr/local/bin/picoclaw /usr/local/bin/picoclaw
COPY config.json /etc/picoclaw/config.json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://localhost:8080/health || exit 1

# Run in gateway mode — REST API on port 8080
CMD ["picoclaw", "gateway", "--config", "/etc/picoclaw/config.json", "--port", "8080"]
