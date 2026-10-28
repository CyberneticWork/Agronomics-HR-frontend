import React, { useEffect, useMemo, useState } from "react";
import { Shield, X, Save } from "lucide-react";
import Swal from "sweetalert2";
import axios from "../../utils/axios";

const ACTIONS = [
  { key: "view", label: "View" },
  { key: "add", label: "Add" },
  { key: "edit", label: "Edit" },
  { key: "delete", label: "Delete" },
  { key: "approve", label: "Approve" },
];

export default function UserAclModal({ user, onClose }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState({});
  const [modules, setModules] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`/acl/users/${user.id}`);
        if (cancelled) return;
        setFeatures(data.company_features || {});
        setModules(data.modules || []);
      } catch (err) {
        Swal.fire({
          icon: "error",
          title: "Could not load ACL",
          text: err?.response?.data?.message || err.message,
        });
        onClose();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const groups = useMemo(() => {
    const map = {};
    for (const row of modules) {
      const g = row.group || "Other";
      if (!map[g]) map[g] = [];
      map[g].push(row);
    }
    return map;
  }, [modules]);

  const toggle = (key, action, value) => {
    setModules((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, [action]: value };
        if (action !== "view" && value) next.view = true;
        if (action === "view" && !value) {
          next.add = false;
          next.edit = false;
          next.delete = false;
          next.approve = false;
        }
        return next;
      })
    );
  };

  const setGroup = (group, on) => {
    setModules((prev) =>
      prev.map((row) => {
        if ((row.group || "Other") !== group) return row;
        const next = { ...row };
        for (const a of row.actions || ["view"]) {
          next[a] = on;
        }
        if (on) next.view = true;
        return next;
      })
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        modules: modules.map((row) => ({
          key: row.key,
          view: !!row.view,
          add: !!row.add,
          edit: !!row.edit,
          delete: !!row.delete,
          approve: !!row.approve,
        })),
      };
      try {
        await axios.post(`/acl/users/${user.id}`, payload);
      } catch (first) {
        const status = first?.response?.status;
        if (status === 404 || status === 405) {
          await axios.put(`/acl/users/${user.id}`, payload);
        } else {
          throw first;
        }
      }
      Swal.fire({
        icon: "success",
        title: "ACL saved",
        text: `${user.name} can only use the screens and actions you ticked, and only if Cybernetic Admin enabled that company feature.`,
        timer: 1800,
        showConfirmButton: false,
      });
      onClose();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: err?.response?.data?.message || err.message || "Request failed. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const featureChips = [
    ["weekly_off", "Weekly off"],
    ["medical_claims", "Medical claims"],
    ["medical_leave", "Medical leave"],
    ["salary_advance", "Salary advance"],
    ["leave_workflow", "Leave covering"],
    ["fish_deduction", "Fish deduction"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Shield className="h-5 w-5 text-teal-700" />
              Allocate ACL — {user.name}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Role: <span className="font-medium capitalize">{user.role}</span>. Tick User Management and
              Labor Management if this role should use those screens. Access Control stays with Admin.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {featureChips.map(([key, label]) => (
                <span
                  key={key}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    features[key] ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {label}: {features[key] ? "on" : "off"}
                </span>
              ))}
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-slate-500">Loading company features…</p>
          ) : (
            Object.entries(groups).map(([group, rows]) => (
              <div key={group} className="mb-5">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-800">{group}</h4>
                  <div className="flex gap-2 text-xs">
                    <button type="button" className="text-teal-700 hover:underline" onClick={() => setGroup(group, true)}>
                      All
                    </button>
                    <button type="button" className="text-slate-500 hover:underline" onClick={() => setGroup(group, false)}>
                      None
                    </button>
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Screen</th>
                        {ACTIONS.map((a) => (
                          <th key={a.key} className="px-2 py-2 text-center font-medium">
                            {a.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.key} className="border-t">
                          <td className="px-3 py-2 text-slate-800">
                            {row.label}
                            {row.pack ? (
                              <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                                {row.pack}
                              </span>
                            ) : null}
                          </td>
                          {ACTIONS.map((a) => {
                            const allowed = (row.actions || []).includes(a.key);
                            return (
                              <td key={a.key} className="px-2 py-2 text-center">
                                {allowed ? (
                                  <input
                                    type="checkbox"
                                    checked={!!row[a.key]}
                                    onChange={(e) => toggle(row.key, a.key, e.target.checked)}
                                  />
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={save}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save ACL"}
          </button>
        </div>
      </div>
    </div>
  );
}
