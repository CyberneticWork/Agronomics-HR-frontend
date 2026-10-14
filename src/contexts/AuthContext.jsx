import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import { loadUser } from "../services/AuthService";
import { permissions } from "../config/permissions";
import { getToken } from "../services/TokenService";

const AuthContext = createContext();

const MODULE_ALIASES = {
  employeemaster: ["show"],
  show: ["employeemaster"],
  personalout: ["nopaymanagement"],
};

function isFullAccessUser(user) {
  const role = String(user?.role || "").toLowerCase();
  return role === "admin" || role === "super_admin" || !!user?.is_super_admin;
}

function actionGranted(block, action) {
  if (!block || typeof block !== "object") return false;
  if (block[action] || block[`can_${action}`]) return true;
  if (action === "edit" && (block.update || block.add || block.can_edit || block.can_add)) return true;
  if (action === "add" && (block.create || block.edit || block.can_add || block.can_edit)) return true;
  if (
    action === "view" &&
    (block.edit || block.add || block.update || block.approve || block.delete ||
      block.can_edit || block.can_add || block.can_approve || block.can_delete)
  ) {
    return true;
  }
  return false;
}

function permMap(source) {
  const out = {};
  if (!source || typeof source !== "object") return out;
  for (const [key, value] of Object.entries(source)) {
    out[String(key).toLowerCase()] = value && typeof value === "object" ? value : {};
  }
  return out;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState({});

  useEffect(() => {
    const fetchUser = async () => {
      if (!getToken()) {
        return;
      }
      try {
        const userData = await loadUser();
        setUser(userData);
        setUserPermissions(userData.permissions || permissions[userData.role] || {});
      } catch {
        setUser(null);
        setUserPermissions({});
      }
    };
    fetchUser();
  }, []);

  useEffect(() => {
    if (user && user.permissions) {
      setUserPermissions(user.permissions);
    } else if (user && user.role) {
      setUserPermissions(permissions[user.role] || {});
    } else {
      setUserPermissions({});
    }
  }, [user]);

  const setAuthUser = (newUser) => {
    setUser(newUser);
    const role = newUser?.role;
    setUserPermissions(newUser?.permissions || (role ? permissions[role] || {} : {}));
  };

  const clearAuth = () => {
    setUser(null);
    setUserPermissions({});
  };

  const hasPermission = useMemo(() => {
    const map = permMap(userPermissions);
    return (module, action) => {
      if (isFullAccessUser(user)) return true;
      const key = String(module || "").toLowerCase();
      const keys = [key, ...(MODULE_ALIASES[key] || [])];
      return keys.some((k) => actionGranted(map[k], action));
    };
  }, [user, userPermissions]);

  return (
    <AuthContext.Provider
      value={{ user, userPermissions, hasPermission, setAuthUser, clearAuth }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
