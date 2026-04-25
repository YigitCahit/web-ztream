"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import type { DashboardPayload, StoredCharacter } from "@/types/domain";

type DashboardClientProps = {
  initialData: DashboardPayload;
};

type CharacterApiPayload = {
  characters: StoredCharacter[];
  activeCharacterId: string | null;
  error?: string;
};

export default function DashboardClient({
  initialData,
}: DashboardClientProps) {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [frameWidth, setFrameWidth] = useState(100);
  const [frameHeight, setFrameHeight] = useState(100);
  const [frames, setFrames] = useState(8);
  const [displaySize, setDisplaySize] = useState(260);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const warnings = useMemo(
    () => Array.from(new Set(data.warnings.filter(Boolean))),
    [data.warnings],
  );

  const activeCharacter = useMemo(
    () =>
      data.characters.find((character) => character.id === data.activeCharacterId) ??
      data.characters[0] ??
      null,
    [data.activeCharacterId, data.characters],
  );

  function applyCharacterPayload(payload: CharacterApiPayload): void {
    setData((previous) => ({
      ...previous,
      characters: payload.characters,
      activeCharacterId: payload.activeCharacterId,
    }));
  }

  async function refreshDashboard(): Promise<void> {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Panel verileri yenilenemedi.");
    }

    const payload = (await response.json()) as DashboardPayload;
    setData(payload);
  }

  async function handleCopyOverlayUrl(): Promise<void> {
    try {
      await navigator.clipboard.writeText(data.overlayUrl);
      setMessage("Overlay URL panoya kopyalandı.");
      setError(null);
    } catch {
      setError("URL kopyalanamadı. Tarayıcı izinlerini kontrol edin.");
    }
  }

  async function handleResubscribe(): Promise<void> {
    setSyncBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/dashboard", {
        method: "POST",
      });

      const body = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? "Abonelik yenilenemedi.");
      }

      setMessage("Kick event aboneliği yenilendi.");
      await refreshDashboard();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function handleSetActive(characterId: string): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/characters", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ characterId }),
      });

      const payload = (await response.json()) as CharacterApiPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Aktif karakter değiştirilemedi.");
      }

      applyCharacterPayload(payload);
      setMessage("Aktif karakter güncellendi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(characterId: string): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/characters/${characterId}`, {
        method: "DELETE",
      });

      const payload = (await response.json()) as CharacterApiPayload;
      if (!response.ok) {
        throw new Error(payload.error ?? "Karakter silinemedi.");
      }

      applyCharacterPayload(payload);
      setMessage("Karakter silindi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    if (!file) {
      setError("Lütfen bir sprite dosyası seçin.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("sprite", file);
      formData.append("frameWidth", String(frameWidth));
      formData.append("frameHeight", String(frameHeight));
      formData.append("frames", String(frames));
      formData.append("displaySize", String(displaySize));

      const response = await fetch("/api/characters", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as CharacterApiPayload & {
        character?: StoredCharacter;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Yükleme başarısız.");
      }

      applyCharacterPayload(payload);
      setFile(null);
      setName("");
      setFileInputKey((prev) => prev + 1);
      setMessage("Karakter yüklendi ve aktif edildi.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Bilinmeyen bir hata oluştu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 md:px-6 md:py-10">
      <header className="panel flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">
        <div>
          <p className="display-font text-xs uppercase text-[var(--accent-cool)]">
            Dashboard
          </p>
          <h1 className="mt-2 text-3xl font-bold text-[var(--ink-main)] md:text-4xl">
            Hoş geldin, {data.username}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-soft)]">
            Karakterlerini yönet, overlay URL&apos;ini kopyala ve OBS&apos;e ekle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={data.overlayUrl}
            target="_blank"
            className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold"
          >
            Overlay Önizleme
          </Link>
          <a
            href="/api/auth/logout"
            className="rounded-xl bg-[var(--ink-main)] px-4 py-2 text-sm font-semibold text-white"
          >
            Çıkış Yap
          </a>
        </div>
      </header>

      <section className="panel-strong p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-[var(--ink-soft)]">Kişisel OBS URL</p>
            <p className="mt-1 break-all text-base font-semibold text-[var(--ink-main)]">
              {data.overlayUrl}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCopyOverlayUrl}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              URL Kopyala
            </button>
            <button
              type="button"
              onClick={handleResubscribe}
              disabled={syncBusy}
              className="rounded-xl border border-[var(--line)] bg-white/80 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {syncBusy ? "Yenileniyor..." : "Aboneliği Yenile"}
            </button>
          </div>
        </div>
      </section>

      {warnings.length > 0 ? (
        <section className="panel-strong border-l-4 border-[var(--accent)] p-6">
          <h2 className="text-base font-bold">Kurulum Uyarıları</h2>
          <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
            {warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? (
        <div className="panel-strong border-l-4 border-[var(--accent-cool)] px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="panel-strong border-l-4 border-[var(--accent-strong)] px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="panel p-6 md:p-8">
        <h2 className="text-xl font-bold">Yeni Karakter Ekle</h2>
        <p className="mt-2 text-sm text-[var(--ink-soft)]">
          Sprite sheet önerisi: 8 kare yan yana, her kare 100x100.
        </p>

        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleUpload}>
          <label className="flex flex-col gap-2 text-sm font-semibold">
            Karakter Adı
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={32}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-normal"
              placeholder="Örn: Neon Şövalye"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Sprite Dosyası (PNG/WEBP/GIF)
            <input
              key={fileInputKey}
              type="file"
              accept="image/png,image/webp,image/gif"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm font-normal"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Frame Genişliği
            <input
              type="number"
              min={16}
              max={512}
              value={frameWidth}
              onChange={(event) => setFrameWidth(Number(event.target.value || 100))}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-normal"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Frame Yüksekliği
            <input
              type="number"
              min={16}
              max={512}
              value={frameHeight}
              onChange={(event) => setFrameHeight(Number(event.target.value || 100))}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-normal"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Kare Sayısı
            <input
              type="number"
              min={1}
              max={32}
              value={frames}
              onChange={(event) => setFrames(Number(event.target.value || 8))}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-normal"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold">
            Ekrandaki Boyut
            <input
              type="number"
              min={64}
              max={600}
              value={displaySize}
              onChange={(event) => setDisplaySize(Number(event.target.value || 260))}
              className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 font-normal"
            />
          </label>

          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-[var(--ink-main)] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-65"
            >
              {busy ? "Yükleniyor..." : "Karakteri Yükle"}
            </button>
          </div>
        </form>
      </section>

      <section className="panel p-6 md:p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Karakter Kütüphanesi</h2>
          {activeCharacter ? (
            <p className="text-sm text-[var(--ink-soft)]">
              Aktif: <span className="font-semibold">{activeCharacter.name}</span>
            </p>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.characters.map((character) => {
            const isActive = character.id === data.activeCharacterId;

            return (
              <article
                key={character.id}
                className="panel-strong flex flex-col gap-3 p-4"
              >
                <div className="overflow-hidden rounded-lg border border-[var(--line)] bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={character.spriteUrl}
                    alt={character.name}
                    className="h-24 w-full object-contain"
                  />
                </div>

                <div>
                  <h3 className="text-base font-bold">{character.name}</h3>
                  <p className="mt-1 text-xs text-[var(--ink-soft)]">
                    {character.frameWidth}x{character.frameHeight} • {character.frames} kare •
                    {" "}
                    {character.displaySize}px
                  </p>
                </div>

                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    disabled={busy || isActive}
                    onClick={() => void handleSetActive(character.id)}
                    className="flex-1 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {isActive ? "Aktif" : "Aktif Yap"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDelete(character.id)}
                    className="rounded-lg bg-[var(--accent-strong)] px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    Sil
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
