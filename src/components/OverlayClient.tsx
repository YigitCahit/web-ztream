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
  const spriteRef = useRef<HTMLImageElement | null>(null);

  const [config, setConfig] = useState<OverlayConfigResponse | null>(null);
  const [status, setStatus] = useState("Overlay hazırlanıyor...");

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
    if (!config) {
      return;
    }

    const sprite = new Image();
    sprite.src = config.character.spriteUrl || "/karakter.png";

    sprite.onload = () => {
      spriteRef.current = sprite;
    };

    sprite.onerror = () => {
      const fallback = new Image();
      fallback.src = "/karakter.png";
      fallback.onload = () => {
        spriteRef.current = fallback;
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
        if (sprite) {
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
              -avatar.x - character.displaySize,
              avatar.y,
              character.displaySize,
              character.displaySize,
            );
          } else {
            context.drawImage(
              sprite,
              sx,
              0,
              character.frameWidth,
              character.frameHeight,
              avatar.x,
              avatar.y,
              character.displaySize,
              character.displaySize,
            );
          }

          context.restore();
        }

        context.fillStyle = "#fefefe";
        context.font = "700 20px var(--font-space-grotesk), sans-serif";
        context.textAlign = "center";
        context.shadowColor = "rgba(0, 0, 0, 0.8)";
        context.shadowBlur = 8;
        context.fillText(
          avatar.username,
          avatar.x + character.displaySize / 2,
          avatar.y - 10,
        );
        context.shadowBlur = 0;
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
    cursorRef.current = 0;

    const spawnAvatar = (event: OverlayEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) {
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

        for (const event of payload.events) {
          spawnAvatar(event);
        }

        cursorRef.current = payload.nextCursor;
      } catch (reason) {
        if (!cancelled) {
          setStatus(
            reason instanceof Error
              ? `Bağlantı sorunu: ${reason.message}`
              : "Bağlantı sorunu",
          );
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
      <div className="overlay-status">{status}</div>
      <canvas ref={canvasRef} className="overlay-canvas" />
    </div>
  );
}
