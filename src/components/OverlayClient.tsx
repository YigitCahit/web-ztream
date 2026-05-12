"use client";

import { useEffect, useRef, useState } from "react";

import type { OverlayEvent, StoredCharacter } from "@/types/domain";

type OverlayClientProps = {
  overlayKey: string;
  userIdHint: number | null;
};

type OverlayConfigResponse = {
  username: string;
  character: StoredCharacter;
  settings: {
    avatarLifetimeMs: number;
  };
  error?: string;
};

type OverlayEventsResponse = {
  events: OverlayEvent[];
  nextCursor: number;
  error?: string;
};

type Avatar = {
  id: string;
  username: string;
  x: number;
  y: number;
  speed: number;
  direction: 1 | -1;
  frame: number;
  tick: number;
  expiresAt: number;
};

const POLL_INTERVAL_MS = 1200;
const FRAME_SKIP = 8;

function clamp(min: number, value: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function OverlayClient({
  overlayKey,
  userIdHint,
}: OverlayClientProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarsRef = useRef<Avatar[]>([]);
  const cursorRef = useRef(0);
  const cursorInitializedRef = useRef(false);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const spriteHeadOffsetRatioRef = useRef(0);

  const [config, setConfig] = useState<OverlayConfigResponse | null>(null);
  const [status, setStatus] = useState("Overlay hazırlanıyor...");
  const [statusVisible, setStatusVisible] = useState(true);

  useEffect(() => {
    let stopped = false;

    const loadConfig = async () => {
      try {
        const configUrl = userIdHint
          ? `/api/overlay/config/${overlayKey}?u=${userIdHint}`
          : `/api/overlay/config/${overlayKey}`;

        const response = await fetch(configUrl, {
          cache: "no-store",
        });

        const payload = (await response.json()) as OverlayConfigResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Overlay ayarları alınamadı.");
        }

        if (stopped) {
          return;
        }

        setConfig(payload);
        setStatus(`Canlı: ${payload.username}`);
      } catch (reason) {
        setStatus(
          reason instanceof Error ? `Hata: ${reason.message}` : "Hata: Bilinmeyen sorun",
        );
      }
    };

    void loadConfig();
    const interval = window.setInterval(() => {
      void loadConfig();
    }, 20_000);

    return () => {
      stopped = true;
      window.clearInterval(interval);
    };
  }, [overlayKey, userIdHint]);

  useEffect(() => {
    document.body.classList.add("overlay-body");
    document.documentElement.classList.add("overlay-body");
    return () => {
      document.body.classList.remove("overlay-body");
      document.documentElement.classList.remove("overlay-body");
    };
  }, []);

  const statusLifetime = config
    ? clamp(8_000, config.settings.avatarLifetimeMs, 180_000)
    : null;

  useEffect(() => {
    if (statusLifetime === null) {
      return;
    }

    const hideTimer = window.setTimeout(() => {
      setStatusVisible(false);
    }, statusLifetime);

    return () => {
      window.clearTimeout(hideTimer);
    };
  }, [statusLifetime]);

  useEffect(() => {
    if (!config) {
      return;
    }

    const computeHeadOffset = (src: string, frameWidth: number) => {
      const probe = new Image();
      probe.crossOrigin = "anonymous";
      probe.onload = () => {
        try {
          const frameH = probe.naturalHeight;
          const fw = frameWidth > 0 ? frameWidth : probe.naturalHeight;
          if (frameH <= 0 || fw <= 0) {
            return;
          }

          const tmp = document.createElement("canvas");
          tmp.width = fw;
          tmp.height = frameH;
          const tmpCtx = tmp.getContext("2d", { willReadFrequently: true });
          if (!tmpCtx) {
            return;
          }

          tmpCtx.drawImage(probe, 0, 0);
          const data = tmpCtx.getImageData(0, 0, fw, frameH).data;

          let topPx = 0;
          outer: for (let y = 0; y < frameH; y++) {
            for (let x = 0; x < fw; x++) {
              if (data[(y * fw + x) * 4 + 3] > 0) {
                topPx = y;
                break outer;
              }
            }
          }

          spriteHeadOffsetRatioRef.current = topPx / frameH;
        } catch {
          // CORS or other error — keep default 0
        }
      };
      probe.onerror = () => {
        // CORS-blocked or load failure — keep default 0
      };
      probe.src = src;
    };

    const spriteSrc = config.character.spriteUrl || "/karakter.png";
    const sprite = new Image();
    sprite.src = spriteSrc;

    sprite.onload = () => {
      spriteRef.current = sprite;
      computeHeadOffset(spriteSrc, config.character.frameWidth || sprite.naturalHeight);
    };

    sprite.onerror = () => {
      const fallback = new Image();
      fallback.src = "/karakter.png";
      fallback.onload = () => {
        spriteRef.current = fallback;
        computeHeadOffset("/karakter.png", config.character.frameWidth || fallback.naturalHeight);
      };
    };
  }, [config]);

  useEffect(() => {
    if (!config) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let rafId = 0;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = false;

      const now = Date.now();
      const character = config.character;

      avatarsRef.current = avatarsRef.current.filter((avatar) => avatar.expiresAt > now);

      for (const avatar of avatarsRef.current) {
        avatar.x += avatar.speed * avatar.direction;
        const maxX = Math.max(0, canvas.width - character.displaySize);
        if (avatar.x > maxX) {
          avatar.x = maxX;
          avatar.direction = -1;
        }
        if (avatar.x < 0) {
          avatar.x = 0;
          avatar.direction = 1;
        }

        avatar.tick += 1;
        if (avatar.tick % FRAME_SKIP === 0) {
          avatar.frame = (avatar.frame + 1) % Math.max(1, character.frames);
        }

        const sprite = spriteRef.current;
        const spriteReady = Boolean(sprite && sprite.complete && sprite.naturalWidth > 0);
        const baseX = avatar.x;
        const baseY = avatar.y;
        const size = character.displaySize;
        const labelY = Math.max(24, baseY + size * spriteHeadOffsetRatioRef.current);

        if (spriteReady && sprite) {
          const sx = avatar.frame * character.frameWidth;
          context.save();

          if (avatar.direction === -1) {
            context.scale(-1, 1);
            context.drawImage(
              sprite,
              sx,
              0,
              character.frameWidth,
              character.frameHeight,
              -baseX - size,
              baseY,
              size,
              size,
            );
          } else {
            context.drawImage(
              sprite,
              sx,
              0,
              character.frameWidth,
              character.frameHeight,
              baseX,
              baseY,
              size,
              size,
            );
          }

          context.restore();
        } else {
          context.save();
          context.fillStyle = "rgba(255, 111, 47, 0.72)";
          context.beginPath();
          context.arc(baseX + size / 2, baseY + size / 2, size * 0.18, 0, Math.PI * 2);
          context.fill();
          context.restore();
        }

        context.save();
        context.font = "700 20px var(--font-space-grotesk), sans-serif";
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.lineWidth = 4;
        context.strokeStyle = "rgba(0, 0, 0, 0.85)";
        context.shadowColor = "rgba(0, 0, 0, 0.65)";
        context.shadowBlur = 6;
        context.strokeText(avatar.username, baseX + size / 2, labelY);
        context.shadowBlur = 0;
        context.fillStyle = "#ffffff";
        context.fillText(avatar.username, baseX + size / 2, labelY);
        context.restore();
      }

      rafId = requestAnimationFrame(draw);
    };

    resizeCanvas();
    rafId = requestAnimationFrame(draw);
    window.addEventListener("resize", resizeCanvas);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [config]);

  useEffect(() => {
    if (!config) {
      return;
    }

    let cancelled = false;
    if (!cursorInitializedRef.current) {
      cursorRef.current = Date.now();
      cursorInitializedRef.current = true;
    }

    const spawnAvatar = (event: OverlayEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.warn("[Overlay] Canvas bulunamadı, avatar spawn edilemiyor", event.senderUsername);
        return;
      }

      const character = config.character;
      const lifetime = clamp(8_000, config.settings.avatarLifetimeMs, 180_000);

      const existing = avatarsRef.current.find(
        (avatar) => avatar.username === event.senderUsername,
      );
      if (existing) {
        existing.expiresAt = Date.now() + lifetime;
        existing.speed = 0.8 + Math.random() * 1.8;
        existing.tick = 0;
        return;
      }

      const maxX = Math.max(1, canvas.width - character.displaySize);
      avatarsRef.current.push({
        id: event.id,
        username: event.senderUsername,
        x: Math.random() * maxX,
        y: Math.max(0, canvas.height - character.displaySize - 24),
        speed: 0.8 + Math.random() * 1.8,
        direction: Math.random() > 0.5 ? 1 : -1,
        frame: 0,
        tick: 0,
        expiresAt: Date.now() + lifetime,
      });
        console.log("[Overlay] Avatar spawn başarılı", {
          sender: event.senderUsername,
          toplam: avatarsRef.current.length,
          lifetime,
        });
    };

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          cursor: String(cursorRef.current),
        });
        if (userIdHint) {
          params.set("u", String(userIdHint));
        }

        const response = await fetch(`/api/overlay/events/${overlayKey}?${params}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as OverlayEventsResponse;
        if (!response.ok) {
          throw new Error(payload.error ?? "Event alınamadı.");
        }

        if (payload.events && payload.events.length > 0) {
          console.log(`[Overlay] ${payload.events.length} event geldi`, payload.events);
          for (const event of payload.events) {
            spawnAvatar(event);
          }
        } else {
          console.log("[Overlay] Polling - event yok", { 
            events: payload.events?.length ?? 0,
            cursor: cursorRef.current,
            nextCursor: payload.nextCursor 
          });
        }

        cursorRef.current = payload.nextCursor;
      } catch (reason) {
        if (!cancelled) {
          const msg = reason instanceof Error ? reason.message : "Bilinmeyen sorun";
          console.error(`[Overlay] Polling hatası: ${msg}`, reason);
          setStatus(`Bağlantı sorunu: ${msg}`);
        }
      } finally {
        if (!cancelled) {
          window.setTimeout(() => {
            void poll();
          }, POLL_INTERVAL_MS);
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
    };
  }, [config, overlayKey, userIdHint]);

  return (
    <div className="overlay-stage">
      {statusVisible ? <div className="overlay-status">{status}</div> : null}
      <canvas ref={canvasRef} className="overlay-canvas" />
    </div>
  );
}
