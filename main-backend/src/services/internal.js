import { config } from "../config.js";

// Small fetch wrapper for service-to-service calls, authenticated
// with the shared internal token (microservices reject anything else).
async function callService(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      "x-internal-token": config.internalApiToken,
      ...(options.headers || {}),
    },
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || `Service call failed: ${path}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

export const usersService = {
  upsert: (profile) =>
    callService(config.usersServiceUrl, "/users/upsert", {
      method: "POST",
      body: JSON.stringify(profile),
    }),
  get: (id) => callService(config.usersServiceUrl, `/users/${id}`),
};

export const favoritesService = {
  list: (userId) => callService(config.favoritesServiceUrl, `/favorites/${userId}`),
  add: (userId, team) =>
    callService(config.favoritesServiceUrl, "/favorites", {
      method: "POST",
      body: JSON.stringify({ userId, team }),
    }),
  remove: (userId, team) =>
    callService(
      config.favoritesServiceUrl,
      `/favorites/${userId}/${encodeURIComponent(team)}`,
      { method: "DELETE" }
    ),
  history: (userId) => callService(config.favoritesServiceUrl, `/history/${userId}`),
  logPrediction: (entry) =>
    callService(config.favoritesServiceUrl, "/history", {
      method: "POST",
      body: JSON.stringify(entry),
    }),
};

export const accuracyService = {
  report: () => callService(config.favoritesServiceUrl, "/accuracy"),
  storedIds: () => callService(config.favoritesServiceUrl, "/accuracy/ids"),
  saveBulk: (evaluations) =>
    callService(config.favoritesServiceUrl, "/accuracy/bulk", {
      method: "POST",
      body: JSON.stringify({ evaluations }),
    }),
};
