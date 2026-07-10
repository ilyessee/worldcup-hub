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
