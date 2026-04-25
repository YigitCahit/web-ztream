import Link from "next/link";

import { getSessionFromServerComponent } from "@/lib/auth";

type HomePageProps = {
  searchParams: Promise<{
    auth_error?: string;
  }>;
};

const authErrorMap: Record<string, string> = {
  eksik_parametre: "Kick geri dönüşünde gerekli parametreler eksik geldi.",
  kick_ayar_eksik: "Kick OAuth ayarları eksik. .env değerlerini kontrol edin.",
  state_gecersiz: "Giriş doğrulaması geçersiz oldu. Tekrar deneyin.",
  oauth_hatasi: "Kick OAuth işlemi sırasında bir hata oluştu.",
  session_yok: "Oturum çerezi alınamadı. Tarayıcıda site çerezleri engelli olabilir.",
  session_kv_yok: "Oturum çerezi var ama KV kaydı bulunamadı. KV bağlantısını kontrol edin.",
  session_ticket_gecersiz:
    "Giriş finalizasyonu geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.",
  profil_yok: "Oturum var ama profil bulunamadı. Tekrar giriş yapmayı deneyin.",
};

export default async function Home({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const session = await getSessionFromServerComponent();
  const authError = params.auth_error ? authErrorMap[params.auth_error] : null;

  return (
    <main className="relative flex min-h-screen w-full flex-col px-5 py-10 md:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8">
        <header className="panel flex flex-col gap-6 px-6 py-8 md:flex-row md:items-center md:justify-between md:px-10">
          <div>
            <p className="display-font text-sm uppercase text-[var(--accent-cool)]">
              Web Ztream
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ink-main)] md:text-5xl">
              Kick chat mesajlarını OBS ekranında
              <br className="hidden md:block" />
              hareketli karakterlere dönüştür.
            </h1>
          </div>

          <div className="flex flex-col items-stretch gap-3 md:min-w-64">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-xl bg-[var(--accent)] px-5 py-3 text-center font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                >
                  Paneli Aç
                </Link>
                <a
                  href="/api/auth/logout"
                  className="rounded-xl border border-[var(--line)] bg-white/70 px-5 py-3 text-center font-semibold text-[var(--ink-main)]"
                >
                  Çıkış Yap
                </a>
              </>
            ) : (
              <a
                href="/api/auth/login"
                className="rounded-xl bg-[var(--accent)] px-5 py-3 text-center font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Kick ile Giriş Yap
              </a>
            )}
          </div>
        </header>

        {authError ? (
          <div className="panel-strong border-l-4 border-[var(--accent-strong)] px-5 py-4 text-sm text-[var(--ink-main)]">
            {authError}
          </div>
        ) : null}

        <section className="grid gap-5 md:grid-cols-3">
          <article className="panel-strong p-6">
            <h2 className="text-lg font-bold">1. Kick hesabınla bağlan</h2>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              OAuth ile güvenli giriş yap, kanalına özel event aboneliği otomatik
              kurulsun.
            </p>
          </article>

          <article className="panel-strong p-6">
            <h2 className="text-lg font-bold">2. Kişisel URL al</h2>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              Sistem sana tekil bir overlay bağlantısı üretir. Bu bağlantı sadece
              sana özeldir.
            </p>
          </article>

          <article className="panel-strong p-6">
            <h2 className="text-lg font-bold">3. OBS&apos;e ekle</h2>
            <p className="mt-3 text-sm text-[var(--ink-soft)]">
              Browser Source olarak URL&apos;i yapıştır, chat mesajlarında karakterlerin
              sahnede yürümeye başlasın.
            </p>
          </article>
        </section>

        <section className="panel-strong mt-auto p-6 md:p-8">
          <h3 className="text-xl font-bold">Gerekli Kick Uygulama Ayarları</h3>
          <p className="mt-3 text-sm text-[var(--ink-soft)]">
            Kick Developer panelinde uygulama oluşturup callback adresini
            <span className="font-semibold"> /api/auth/callback</span>, webhook adresini
            <span className="font-semibold"> /api/kick/webhook</span> olarak
            tanımlaman gerekir.
          </p>
        </section>
      </div>
    </main>
  );
}
