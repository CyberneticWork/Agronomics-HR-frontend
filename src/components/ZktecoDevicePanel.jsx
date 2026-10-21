import React, { useEffect, useState } from "react";
import Swal from "sweetalert2";
import zktecoService from "@services/zktecoService";

const emptyForm = {
  name: "",
  model: "K40 Pro",
  serial_number: "",
  ip_address: "",
  port: 4370,
  company_id: "",
  is_active: true,
  adms_enabled: true,
};

export default function ZktecoDevicePanel({ companies = [] }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [expanded, setExpanded] = useState(false);

  const loadDevices = async () => {
    setLoading(true);
    try {
      setDevices(await zktecoService.listDevices());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (expanded) loadDevices();
  }, [expanded]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.serial_number) {
      Swal.fire({ icon: "warning", title: "Missing fields", text: "Name and Serial Number (SN) are required." });
      return;
    }

    try {
      const res = await zktecoService.createDevice({
        ...form,
        company_id: form.company_id || null,
        port: Number(form.port) || 4370,
        ip_address: form.ip_address || null,
      });
      Swal.fire({
        icon: "success",
        title: "Device added",
        html: `<p class="text-sm">${res.message || "Saved"}</p>
          <p class="text-xs mt-2 break-all">ADMS URL:<br/><code>${res.data?.adms_url || ""}</code></p>`,
      });
      setForm(emptyForm);
      setShowForm(false);
      loadDevices();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Save failed", text: err.response?.data?.message || err.message });
    }
  };

  const removeDevice = async (id) => {
    const ok = await Swal.fire({
      icon: "warning",
      title: "Remove device?",
      text: "Punches already imported stay on the Time Card.",
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#e11d48",
    });
    if (!ok.isConfirmed) return;
    try {
      await zktecoService.deleteDevice(id);
      loadDevices();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Remove failed", text: err.response?.data?.message || err.message });
    }
  };

  const showLogs = async (id) => {
    try {
      const logs = await zktecoService.getEventLogs(id, 30);
      if (!logs.length) {
        Swal.fire({ icon: "info", title: "No events yet", text: "Wait for the device handshake, then scan a finger." });
        return;
      }
      Swal.fire({
        icon: "info",
        title: "Recent punches",
        width: 720,
        html: `<div class="text-left text-xs max-h-80 overflow-auto">
          <table class="w-full border-collapse">
            <thead><tr class="bg-slate-100">
              <th class="p-1 text-left">Time</th><th class="p-1 text-left">Emp</th>
              <th class="p-1 text-left">Status</th><th class="p-1 text-left">Msg</th>
            </tr></thead>
            <tbody>${logs
              .map(
                (l) => `<tr class="border-t">
              <td class="p-1">${l.event_time || ""}</td>
              <td class="p-1">${l.employee_no || ""}</td>
              <td class="p-1">${l.status}</td>
              <td class="p-1">${(l.message || "").toString().slice(0, 80)}</td>
            </tr>`
              )
              .join("")}</tbody>
          </table>
        </div>`,
      });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Logs failed", text: err.response?.data?.message || err.message });
    }
  };

  const copyText = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      Swal.fire({ icon: "success", title: `${label} copied`, timer: 1200, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "info", title: label, text: text });
    }
  };

  return (
    <div className="mb-6 border border-teal-200 rounded-xl overflow-hidden bg-teal-50/40">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-teal-700 text-white font-semibold"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>ZKTeco Fingerprint Device Sync (K40 Pro)</span>
        <span>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-4">
          <p className="text-sm text-slate-600">
            The K40 Pro pushes punches over <b>ADMS / Cloud Server</b> to HR, then Time Card is written the same way as
            Hikvision (IN/OUT toggle). Device <b>User ID</b> must match <strong>Attendance Employee No</strong>. Serial
            Number (SN) must match the terminal exactly.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium"
              onClick={() => setShowForm((v) => !v)}
            >
              {showForm ? "Cancel" : "Add Device"}
            </button>
            <button
              type="button"
              className="px-3 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-medium"
              onClick={loadDevices}
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              className="px-3 py-2 bg-amber-100 text-amber-900 rounded-lg text-sm font-medium"
              onClick={async () => {
                try {
                  const g = await zktecoService.getSetupGuide();
                  Swal.fire({
                    icon: "info",
                    title: "ZKTeco K40 Pro setup",
                    width: 640,
                    html: `<ol class="text-left text-sm list-decimal pl-5 space-y-2">${(g.steps || [])
                      .map((s) => `<li><b>${s.title}</b><br/>${s.detail}</li>`)
                      .join("")}</ol>`,
                  });
                } catch (e) {
                  Swal.fire({ icon: "error", title: "Failed", text: e.message });
                }
              }}
            >
              Setup Guide
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white rounded-lg border">
              {[
                ["name", "Device name", "text"],
                ["model", "Model", "text"],
                ["serial_number", "Serial Number (SN) — required", "text"],
                ["ip_address", "IP address (optional)", "text"],
                ["port", "Port (default 4370)", "number"],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={key === "name" || key === "serial_number"}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Company</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: e.target.value })}
                >
                  <option value="">All companies</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold">
                  Save Device
                </button>
              </div>
            </form>
          )}

          {loading && <p className="text-sm text-slate-500">Loading devices...</p>}
          {!loading && devices.length === 0 && (
            <p className="text-sm text-slate-500">No ZKTeco devices yet. Add the K40 Pro with its Serial Number.</p>
          )}

          {devices.map((d) => (
            <div key={d.id} className="p-4 bg-white border rounded-lg space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-800">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.model} · SN {d.serial_number}
                    {d.ip_address ? ` · ${d.ip_address}:${d.port}` : ""}
                  </p>
                </div>
                <div className="flex gap-2 items-start">
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      d.online ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {d.online ? "Online (handshake)" : "Waiting for device"}
                  </span>
                  <span
                    className={`text-xs px-2 py-1 rounded ${d.is_active ? "bg-teal-100 text-teal-800" : "bg-gray-100"}`}
                  >
                    {d.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="text-xs space-y-1">
                <p>
                  <span className="font-semibold text-slate-600">ADMS / Cloud Server URL:</span>
                  <button
                    type="button"
                    className="ml-2 text-teal-700 underline break-all"
                    onClick={() => copyText(d.adms_url, "ADMS URL")}
                  >
                    {d.adms_url}
                  </button>
                </p>
                <p className="text-slate-500">
                  Last handshake: {d.last_handshake_at || "—"} · Last punch: {d.last_event_at || "—"}
                </p>
                {d.last_error && <p className="text-rose-600">{d.last_error}</p>}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded bg-slate-100"
                  onClick={() => copyText(d.adms_url, "ADMS URL")}
                >
                  Copy ADMS URL
                </button>
                <button type="button" className="px-2 py-1 text-xs rounded bg-slate-100" onClick={() => showLogs(d.id)}>
                  Recent punches
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded bg-rose-50 text-rose-700"
                  onClick={() => removeDevice(d.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
