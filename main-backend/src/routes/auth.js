// PURPOSE: Authentication routes — Google OAuth 2.0 login and JWT issuance.
//
// WHAT THIS FILE DOES:
//   1. GET /auth/google          -> redirect the user to Google's consent screen
//   2. GET /auth/google/callback -> exchange the code for the Google profile,
//      upsert the user in users-service, sign a JWT, redirect to the frontend
//   3. GET /auth/dev-login       -> dev-only shortcut to get a JWT without Google
//   4. GET /auth/me              -> return the current user (requires a valid JWT)
import { Router } from "express";
import crypto from "node:crypto";
import { config } from "../config.js";
import { signToken, requireAuth } from "../auth/jwt.js";
import { usersService } from "../services/internal.js";

export const authRouter = Router();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// Step 1: redirect the user to Google's consent screen
authRouter.get("/google", (_req, res) => {
  if (!config.google.clientId) {
    return res.status(503).json({
      error: "Google OAuth is not configured (missing GOOGLE_CLIENT_ID).",
    });
  }
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.callbackUrl,
    response_type: "code",
    scope: "openid email profile",
    state: crypto.randomUUID(),
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// Step 2: Google redirects back with a code, we exchange it for the
// user's profile, upsert the user, then hand a JWT to the frontend.
authRouter.get("/google/callback", async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: "Missing authorization code" });

    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.callbackUrl,
        grant_type: "authorization_code",
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok) {
      return res.status(401).json({ error: "Google token exchange failed", details: tokens });
    }

    const profileResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileResponse.json();

    const user = await usersService.upsert({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    });

    const jwt = signToken(user);
    res.redirect(`${config.frontendUrl}/auth/callback?token=${jwt}`);
  } catch (err) {
    next(err);
  }
});

// Dev-only shortcut so the app can be developed and demoed
// without Google credentials. Disabled unless ALLOW_DEV_LOGIN=true.
authRouter.get("/dev-login", async (req, res, next) => {
  if (!config.allowDevLogin) {
    return res.status(404).json({ error: "Not found" });
  }
  try {
    const email = req.query.email || "dev@example.com";
    const user = await usersService.upsert({
      googleId: `dev-${email}`,
      email,
      name: req.query.name || "Dev User",
      picture: null,
    });
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

// Who am I — lets the frontend validate its stored token
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({
    id: req.user.sub,
    email: req.user.email,
    name: req.user.name,
    picture: req.user.picture,
  });
});
