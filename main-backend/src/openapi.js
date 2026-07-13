// PURPOSE: OpenAPI 3.0 specification for the gateway API, served as an
// interactive Swagger UI page at /api-docs.
//
// WHAT THIS FILE DOES:
//   1. Describe every endpoint (auth, predictions, favorites, history, accuracy)
//   2. Declare the JWT "bearerAuth" security scheme so the "Authorize" button
//      lets you paste a token and try protected routes live
//   3. Mark public vs protected endpoints

const resultEnum = ["home_win", "draw", "away_win"];

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "WorldCup Hub API",
    version: "1.0.0",
    description:
      "API gateway for WorldCup Hub. Google login issues a JWT; every " +
      "/api/v1 route requires that JWT (Authorization: Bearer <token>). " +
      "Use the Authorize button to paste a token and try the protected routes.",
  },
  servers: [{ url: "http://localhost:4000", description: "Local gateway" }],
  tags: [
    { name: "Auth", description: "Google OAuth login and JWT" },
    { name: "Predictions", description: "ML predictions and live matches (external API)" },
    { name: "Favorites", description: "Favorite teams (MongoDB)" },
    { name: "History", description: "Prediction history (MongoDB)" },
    { name: "Accuracy", description: "Model prediction vs real result" },
    { name: "System", description: "Health" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Prediction: {
        type: "object",
        properties: {
          prediction: { type: "string", enum: resultEnum, example: "home_win" },
          probabilities: {
            type: "object",
            properties: {
              home_win: { type: "number", example: 0.42 },
              draw: { type: "number", example: 0.17 },
              away_win: { type: "number", example: 0.41 },
            },
          },
        },
      },
      AccessDenied: {
        type: "object",
        properties: {
          error: { type: "string", example: "Access denied" },
          message: { type: "string", example: "Missing JWT. Provide an Authorization: Bearer <token> header." },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Service health",
        responses: { 200: { description: "OK" } },
      },
    },
    "/auth/google": {
      get: {
        tags: ["Auth"],
        summary: "Start Google login (redirects to Google's consent screen)",
        responses: { 302: { description: "Redirect to Google" } },
      },
    },
    "/auth/dev-login": {
      get: {
        tags: ["Auth"],
        summary: "Dev-only login shortcut — returns a JWT without Google",
        description: "Only available when ALLOW_DEV_LOGIN=true. Handy to grab a token for the Authorize button.",
        parameters: [
          { name: "email", in: "query", schema: { type: "string" }, example: "demo@worldcuphub.dev" },
        ],
        responses: {
          200: {
            description: "A signed JWT and the user",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    token: { type: "string" },
                    user: { type: "object" },
                  },
                },
              },
            },
          },
          404: { description: "Dev login disabled" },
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current logged-in user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "The user decoded from the JWT" },
          401: { description: "Access denied", content: { "application/json": { schema: { $ref: "#/components/schemas/AccessDenied" } } } },
        },
      },
    },
    "/api/v1/predict": {
      post: {
        tags: ["Predictions"],
        summary: "Predict a match result (via the external ML API)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["homeTeam", "awayTeam"],
                properties: {
                  homeTeam: { type: "string", example: "France" },
                  awayTeam: { type: "string", example: "Argentina" },
                  stage: { type: "string", example: "GROUP_STAGE" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Prediction", content: { "application/json": { schema: { $ref: "#/components/schemas/Prediction" } } } },
          400: { description: "Missing homeTeam / awayTeam" },
          401: { description: "Access denied", content: { "application/json": { schema: { $ref: "#/components/schemas/AccessDenied" } } } },
        },
      },
    },
    "/api/v1/matches": {
      get: {
        tags: ["Predictions"],
        summary: "Live World Cup matches",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "List of matches" }, 401: { description: "Access denied" } },
      },
    },
    "/api/v1/accuracy": {
      get: {
        tags: ["Accuracy"],
        summary: "Stored model-accuracy report",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Accuracy summary + per-match evaluations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer", example: 100 },
                    correct: { type: "integer", example: 79 },
                    accuracy: { type: "number", example: 0.79 },
                    matches: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          401: { description: "Access denied" },
        },
      },
    },
    "/api/v1/accuracy/refresh": {
      post: {
        tags: ["Accuracy"],
        summary: "Backtest the model on finished matches and store the result",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Updated accuracy report" }, 401: { description: "Access denied" } },
      },
    },
    "/api/v1/favorites": {
      get: {
        tags: ["Favorites"],
        summary: "List the user's favorite teams",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Favorites" }, 401: { description: "Access denied" } },
      },
      post: {
        tags: ["Favorites"],
        summary: "Add a favorite team",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["team"], properties: { team: { type: "string", example: "Morocco" } } },
            },
          },
        },
        responses: { 201: { description: "Added" }, 409: { description: "Already a favorite" }, 401: { description: "Access denied" } },
      },
    },
    "/api/v1/favorites/{team}": {
      delete: {
        tags: ["Favorites"],
        summary: "Remove a favorite team",
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "team", in: "path", required: true, schema: { type: "string" }, example: "Morocco" }],
        responses: { 200: { description: "Removed" }, 404: { description: "Not found" }, 401: { description: "Access denied" } },
      },
    },
    "/api/v1/history": {
      get: {
        tags: ["History"],
        summary: "The user's prediction history",
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "History" }, 401: { description: "Access denied" } },
      },
    },
  },
};
