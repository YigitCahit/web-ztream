export const keys = {
  session: (sessionId: string) => `session:${sessionId}`,
  oauthState: (state: string) => `oauth-state:${state}`,
  userProfile: (userId: number) => `user-profile:${userId}`,
  overlayUserMap: (overlayKey: string) => `overlay-user-map:${overlayKey}`,
  overlayEvents: (userId: number) => `overlay-events:${userId}`,
  webhookMessage: (messageId: string) => `webhook-message:${messageId}`,
};
