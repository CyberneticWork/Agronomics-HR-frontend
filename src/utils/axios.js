import axiosLib from "axios";
import { expireSession, getToken } from "../services/TokenService";
import config from "../config";

const CYBERNETIC_TOKEN_KEY = "cybernetic_admin_token";

function onCyberneticAdminPage() {
  const path = String(window.location?.pathname || "");
  return path.startsWith("/cybernetic-admin") || path === "/admin" || path.startsWith("/admin/");
}

function readCyberneticToken() {
  try {
    return localStorage.getItem(CYBERNETIC_TOKEN_KEY) || sessionStorage.getItem(CYBERNETIC_TOKEN_KEY);
  } catch {
    return null;
  }
}

function clearCyberneticToken() {
  try {
    localStorage.removeItem(CYBERNETIC_TOKEN_KEY);
    sessionStorage.removeItem(CYBERNETIC_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

const root = String(config.apiBaseUrl || "").replace(/\/$/, "");
const apiUrl = root ? `${root}/api` : "/api";

const axios = axiosLib.create({
  baseURL: apiUrl,
  timeout: 30000,
  headers: {
    Accept: "application/json",
  },
});

axios.interceptors.request.use((req) => {
  req.headers = req.headers || {};
  rewriteIndexPhpFrontController(req);
  const token = getToken();
  // HR pages never send the Cybernetic Admin token: an expired admin token must not break HR calls.
  const cyberneticToken = onCyberneticAdminPage() ? readCyberneticToken() : null;
  if (cyberneticToken) {
    req.headers["X-Cybernetic-Token"] = cyberneticToken;
  }
  const url = String(req.url || "");
  const lr = String(req.params?.__lr || "");
  const companyAdminCall =
    url.includes("/companies") ||
    url.includes("cybernetic-admin") ||
    url.includes("/media/firebase") ||
    lr.includes("/companies") ||
    lr.includes("cybernetic-admin") ||
    lr.includes("/media/firebase");
  if (cyberneticToken && (companyAdminCall || !token)) {
    req.headers.Authorization = `Bearer ${cyberneticToken}`;
    req._authKind = "cybernetic";
  } else if (token) {
    req.headers.Authorization = `Bearer ${token}`;
    req._authKind = "hr";
  } else {
    req._authKind = "none";
  }
  return req;
});

axios.interceptors.response.use(
  (res) => {
    const ct = String(res.headers?.["content-type"] || "");
    if (
      typeof res.data === "string" &&
      (ct.includes("text/html") || /^\s*<!DOCTYPE html/i.test(res.data) || /^\s*<html/i.test(res.data))
    ) {
      return Promise.reject(
        Object.assign(new Error("API returned an HTML page instead of JSON."), {
          response: { status: 502, data: { message: "API host is not routing Laravel /api. Use /index.php/api/... or enable FrontController." } },
        })
      );
    }
    return res;
  },
  (err) => {
    const status = err?.response?.status;
    if (status === 401 && !urlIsLogin(err)) {
      const kind = err?.config?._authKind;
      if (kind === "cybernetic") {
        clearCyberneticToken();
      } else if (kind === "hr" && !onCyberneticAdminPage() && isSessionRejected(err)) {
        expireSession("unauthorized");
      }
    }
    if (err?.response?.data && typeof err.response.data === "object") {
      const safe = { message: err.response.data.message || "Request failed." };
      if (status === 422 && err.response.data.errors && urlIsLogin(err)) {
        err.response.data = { message: "The provided credentials are incorrect." };
      } else if (status >= 500) {
        // Keep backend error text for employee save so HR sees the real cause
        // (unique login, missing fields, etc.) instead of a generic wipe.
        if (urlIsEmployeeWrite(err)) {
          const next = {
            message:
              err.response.data.error ||
              err.response.data.message ||
              "Request failed. Please try again.",
          };
          if (err.response.data.error) next.error = err.response.data.error;
          err.response.data = next;
        } else {
          err.response.data = { message: "Request failed. Please try again." };
        }
      } else {
        const next = { ...err.response.data, ...safe };
        delete next.trace;
        delete next.exception;
        delete next.file;
        delete next.line;
        err.response.data = next;
      }
    }
    return Promise.reject(err);
  }
);

function urlIsLogin(err) {
  const url = String(err?.config?.url || "");
  const lr = String(err?.config?.params?.__lr || "");
  return url.includes("/login") || url.includes("/send-otp") || lr.includes("/login") || lr.includes("/send-otp");
}

/** 401 from the auth middleware (bad/expired/revoked token), not e.g. "current password is incorrect". */
function isSessionRejected(err) {
  const data = err?.response?.data;
  const message = String((data && (data.message || data.error)) || "").trim().toLowerCase();
  const url = `${err?.config?.url || ""} ${err?.config?.params?.__lr || ""}`;
  return (
    message === "unauthenticated." ||
    message === "unauthenticated" ||
    message === "user not authenticated" ||
    /\/user(\?|\s|$)/.test(url)
  );
}

function urlIsEmployeeWrite(err) {
  const url = String(err?.config?.url || "");
  const lr = String(err?.config?.params?.__lr || "");
  const method = String(err?.config?.method || "").toLowerCase();
  const path = `${url} ${lr}`;
  const isEmployees =
    path.includes("/employees") ||
    path.includes("/employes") ||
    path.includes("/employee-leave-balances");
  return isEmployees && (method === "post" || method === "put" || method === "patch");
}

/** Hosts that only execute *.php need /index.php?__lr=/api/... instead of /index.php/api/... */
function rewriteIndexPhpFrontController(req) {
  const base = String(req.baseURL || "");
  const marker = "/index.php";
  const at = base.toLowerCase().indexOf(marker);
  if (at === -1) return;
  // Urban nginx already runs /index.php/api/... PATH_INFO. __lr is ignored there and
  // returns the Laravel welcome HTML, so Cybernetic Admin shows an empty company list.
  if (/urbanhr/i.test(base)) return;

  const currentUrl = String(req.url || "");
  if (currentUrl === "/index.php" && req.params && req.params.__lr) return;

  const origin = base.slice(0, at);
  const afterFront = base.slice(at + marker.length).replace(/\/$/, "");
  const [relPath, relQuery] = currentUrl.split("?");
  const pathPart = relPath.startsWith("/") ? relPath : `/${relPath}`;
  const lr = `${afterFront}${pathPart}` || "/";

  const params = { ...(req.params || {}) };
  if (relQuery) {
    new URLSearchParams(relQuery).forEach((value, key) => {
      if (params[key] == null) params[key] = value;
    });
  }
  params.__lr = lr.startsWith("/") ? lr : `/${lr}`;

  req.baseURL = origin;
  req.url = "/index.php";
  req.params = params;
}

export default axios;
