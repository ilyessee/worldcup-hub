// PURPOSE: Everything about JSON Web Tokens — create them at login and
// verify them on every protected request.
//
// WHAT THIS FILE DOES:
//   1. signToken()   -> sign a JWT for a user (payload + secret, expires in 12h)
//   2. verifyToken() -> check a token's signature and decode it
//   3. requireAuth   -> Express middleware protecting routes: reads the
//      "Authorization: Bearer <jwt>" header, verifies it, attaches req.user,
//      and returns 401 "Access denied" if the token is missing or invalid
import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name, picture: user.picture },
    config.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

// Express middleware guarding every protected route: expects
// "Authorization: Bearer <jwt>", rejects with an explicit 401 otherwise.
export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      error: "Access denied",
      message: "Missing JWT. Provide an Authorization: Bearer <token> header.",
    });
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    return res.status(401).json({
      error: "Access denied",
      message: "Invalid or expired JWT.",
    });
  }
}
