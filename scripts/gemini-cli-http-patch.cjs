"use strict";

const http = require("node:http");
const https = require("node:https");

const TARGET_HOSTS = new Set(["cloudcode-pa.googleapis.com"]);
const PATCH_MARKER = Symbol.for("trigen.geminiCliHttpPatch");

patchRequest(http);
patchRequest(https);

function patchRequest(moduleRef) {
  if (moduleRef.request[PATCH_MARKER]) {
    return;
  }

  const originalRequest = moduleRef.request;
  function trigenPatchedRequest(options, ...args) {
    try {
      const target = normalizeOptions(options);
      if (target && TARGET_HOSTS.has(target.hostname)) {
        forceIdentityEncoding(target.options);
      }
    } catch {
      // This patch must never block the provider CLI. Fall back to the original request.
    }
    return originalRequest.call(this, options, ...args);
  }

  Object.defineProperty(trigenPatchedRequest, PATCH_MARKER, {
    value: true
  });
  moduleRef.request = trigenPatchedRequest;
}

function normalizeOptions(options) {
  if (!options || typeof options !== "object") {
    return undefined;
  }

  const hostname = String(options.hostname ?? options.host ?? "").split(":")[0];
  if (!hostname) {
    return undefined;
  }

  return { hostname, options };
}

function forceIdentityEncoding(options) {
  const headers = options.headers;
  if (!headers) {
    options.headers = { "Accept-Encoding": "identity" };
    return;
  }

  if (Array.isArray(headers)) {
    for (let index = 0; index < headers.length; index += 2) {
      if (String(headers[index]).toLowerCase() === "accept-encoding") {
        headers[index + 1] = "identity";
        return;
      }
    }
    headers.push("Accept-Encoding", "identity");
    return;
  }

  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "accept-encoding") {
      delete headers[key];
    }
  }
  headers["Accept-Encoding"] = "identity";
}
