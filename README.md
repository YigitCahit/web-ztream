# Web Ztream

Kick chat mesajlarını OBS içinde hareketli karakterlere dönüştüren, Vercel uyumlu web uygulaması.

## Neler Yapıyor?

- Kick OAuth ile kullanıcı girişi yapar.
- Her kullanıcı için kişisel bir overlay URL üretir.
- Kick Events API üzerinden `chat.message.sent` event aboneliğini kurar.
- Kick webhook eventlerini imza doğrulamasıyla alır.
- Overlay sayfasında chat yazan kullanıcı isimlerine göre karakterleri yürütür.
- Kullanıcının kendi sprite dosyasını yükleyip aktif karakter seçmesine izin verir.

## Teknik Mimari

- Frontend: Next.js App Router (TypeScript)
- Backend: Next.js Route Handlers (serverless)
- Kalıcı veri: Upstash Redis (KV_REST_API_URL / KV_REST_API_TOKEN)
- Karakter dosyaları: Vercel Blob (BLOB_READ_WRITE_TOKEN)
- Realtime yaklaşımı: Overlay tarafında kısa aralıklarla polling

## 1) Kick Developer Ayarları

Kick hesabında bir uygulama oluşturup şunları tanımla:

- Callback URL: `https://<domain>/api/auth/callback`
- Webhook URL: `https://<domain>/api/kick/webhook`

Not: Callback URL ile `.env` içindeki `KICK_REDIRECT_URI` birebir aynı olmalıdır.

## 2) Ortam Değişkenleri

`.env.example` dosyasını kopyalayıp `.env.local` oluştur:

```bash
cp .env.example .env.local
```

Gerekli alanlar:

- `NEXT_PUBLIC_APP_URL`
- `KICK_CLIENT_ID`
- `KICK_CLIENT_SECRET`
- `KICK_REDIRECT_URI`
- `KICK_SCOPES` (`user:read channel:read events:subscribe`)

Önerilen alanlar:

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `BLOB_READ_WRITE_TOKEN`

## 3) Lokal Çalıştırma

```bash
npm install
npm run dev
```

Uygulama: `http://localhost:3000`

## 4) Vercel Deploy

1. Projeyi Vercel'e bağla.
2. Vercel project settings içinde `.env.example` değişkenlerini gir.
3. Domain aldıktan sonra `NEXT_PUBLIC_APP_URL` ve `KICK_REDIRECT_URI` değerlerini gerçek domain ile güncelle.
4. Kick Developer panelindeki callback/webhook adreslerini aynı domain ile güncelle.

## 5) Kullanım Akışı

1. Ana sayfadan Kick ile giriş yap.
2. Dashboard'da kişisel overlay URL'ini kopyala.
3. OBS > Browser Source > URL alanına bu bağlantıyı yapıştır.
4. İstersen dashboard'dan yeni sprite yükleyip aktif karakteri değiştir.

## API Uç Noktaları

- `GET /api/auth/login`
- `GET /api/auth/callback`
- `GET|POST /api/auth/logout`
- `GET|POST /api/dashboard`
- `GET|POST|PATCH /api/characters`
- `DELETE /api/characters/:id`
- `POST /api/kick/webhook`
- `GET /api/overlay/config/:overlayKey`
- `GET /api/overlay/events/:overlayKey?cursor=<timestamp>`

## Notlar

- Redis ve Blob tanımlı değilse uygulama fallback modda yine çalışır, ancak veriler kalıcı olmayabilir.
- Webhook güvenliği için `Kick-Event-Signature` doğrulaması yapılır.
- Chat eventleri idempotent şekilde işlenir (aynı webhook birden fazla kez yazılmaz).
