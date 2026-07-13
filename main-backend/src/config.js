// PURPOSE: Central configuration read from environment variables (12-factor):
// server, JWT secret, Google OAuth credentials, microservice URLs, external API.
// Every value has a safe default for local development.
export const config = {
  port: process.env.PORT || 4000,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET || "change-me-jwt-secret",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ||
      "http://localhost:4000/auth/google/callback",
  },
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === "true",
  usersServiceUrl: process.env.USERS_SERVICE_URL || "http://localhost:4001",
  favoritesServiceUrl:
    process.env.FAVORITES_SERVICE_URL || "http://localhost:4002",
  internalApiToken:
    process.env.INTERNAL_API_TOKEN || "change-me-internal-secret",
  fifaApiUrl:
    process.env.FIFA_API_URL || "https://fifa-backend-production.onrender.com",
};
