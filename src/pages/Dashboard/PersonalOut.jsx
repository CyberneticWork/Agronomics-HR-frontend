import React, { useEffect, useMemo, useState } from "react";
import { DoorOpen, Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import Swal from "sweetalert2";
import { fetchCompanies } from "@services/ApiDataService";
import PersonalOutService from "@services/PersonalOutService";
import DatePickerInput from "@components/DatePickerInput";
import { useAuth } from "../../contexts/AuthContext";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const fmt = (n) => new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n || 0));
const today = () => new Date().toISOString().split("T")[0];
const fmtMinutes = (m) => {
  const mins = Number(m || 0);
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
};
const sourceBadge = (source) =>
  source === "NoPay"
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : "bg-emerald-50 text-emerald-700 border-emerald-200";

const emptyForm = { employee: null, date: today(), out_time: "", in_time: "", reason: "" };

export default function PersonalOut() {
  const { hasPermission } = useAuth() || {};
  const canAdd = hasPermission ? hasPermission("personalOut", "add") : true;
  const canDelete = hasPermission ? hasPermission("personalOut", "delete") : true;

  const now = new Date();
  const [companies, setCompanies] = useState([]);
  const [companyId, setCompanyId] = useState("");

  const [form, setForm] = useState(emptyForm);
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const years = useMemo(() => Array.from({ length: 6 }, (_, i) => now.getFullYear() - i), [now]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchCompanies();
        setCompanies(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    if (form.employee || employeeQuery.trim().length < 2) {
      setEmployeeOptions([]);
      return undefined;
    }
    const timer = setTimeout(async () => {
      try {
        setEmployeeOptions(await PersonalOutService.employees({
          search: employeeQuery.trim(),
          company_id: companyId || undefined,
        }));
      } catch (e) {
        setEmployeeOptions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [employeeQuery, companyId, form.employee]);

  useEffect(() => {
    if (!form.employee || !form.date) {
      setPreview(null);
      return undefined;
    }
    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const hasTimes = form.out_time && form.in_time;
        setPreview(await PersonalOutService.preview({
          employee_id: form.employee.id,
          date: form.date,
          out_time: hasTimes ? form.out_time : undefined,
          in_time: hasTimes ? form.in_time : undefined,
        }));
      } catch (error) {
        setPreviewError(error?.response?.data?.message || "Could not calculate the deduction.");
      } finally {
        setPreviewLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [form.employee, form.date, form.out_time, form.in_time]);

  const loadList = async () => {
    setLoading(true);
    try {
      setRows(await PersonalOutService.list({
        month,
        year,
        company_id: companyId || undefined,
        search: search || undefined,
      }));
    } catch (error) {
      Swal.fire({ icon: "error", title: "Load failed", text: error?.response?.data?.message || "Could not load personal out entries." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, companyId]);

  const pickEmployee = (emp) => {
    setForm((f) => ({ ...f, employee: emp }));
    setEmployeeQuery(`${emp.emp_no || ""} - ${emp.name || ""}`);
    setEmployeeOptions([]);
  };

  const clearEmployee = () => {
    setForm((f) => ({ ...f, employee: null }));
    setEmployeeQuery("");
    setPreview(null);
  };

  const save = async () => {
    if (!form.employee || !form.date || !form.out_time || !form.in_time) {
      Swal.fire({ icon: "warning", title: "Missing details", text: "Select the employee, date, out time and back-in time." });
      return;
    }
    setSaving(true);
    try {
      const result = await PersonalOutService.create({
        employee_id: form.employee.id,
        date: form.date,
        out_time: form.out_time,
        in_time: form.in_time,
        reason: form.reason || undefined,
      });
      Swal.fire({ icon: "success", title: "Personal out saved", text: result.message });
      setForm((f) => ({ ...emptyForm, date: f.date }));
      setEmployeeQuery("");
      setPreview(null);
      await loadList();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Save failed", text: error?.response?.data?.message || "Could not save the entry." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row) => {
    const confirm = await Swal.fire({
      icon: "warning",
      title: "Remove this entry?",
      text: "The linked leave and NoPay will be reversed.",
      showCancelButton: true,
      confirmButtonText: "Remove",
      confirmButtonColor: "#e11d48",
    });
    if (!confirm.isConfirmed) return;
    try {
      const result = await PersonalOutService.remove(row.id);
      Swal.fire({ icon: "success", title: "Removed", text: result.message, timer: 1600, showConfirmButton: false });
      await loadList();
    } catch (error) {
      Swal.fire({ icon: "error", title: "Remove failed", text: error?.response?.data?.message || "Could not remove the entry." });
    }
  };

  const balances = preview?.balances || {};

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-5 rounded-2xl bg-slate-900 p-6 text-white">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <DoorOpen className="h-6 w-6" /> Personal Out
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Staff going out during working hours. The first 30 minutes are allowed with no deduction. Above that,
            up to 2 hours = short leave (0.25), more than 2 hours = half day (0.5).
            Taken from Casual, then Annual leave. If there is no leave balance it becomes NoPay deducted from the Monthly Bonus (not basic).
          </p>
        </div>

        {canAdd && (
          <div className="mb-5 grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border bg-white p-4 lg:col-span-3">
              <h2 className="mb-3 font-semibold text-slate-800">New entry</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm">
                  Company
                  <select className="mt-1 w-full rounded-lg border px-3 py-2" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
                    <option value="">All companies</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.company_label || c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="relative text-sm">
                  Employee
                  <div className="mt-1 flex gap-2">
                    <input
                      className="w-full rounded-lg border px-3 py-2"
                      placeholder="Type name or EMP No"
                      value={employeeQuery}
                      disabled={!!form.employee}
                      onChange={(e) => setEmployeeQuery(e.target.value)}
                    />
                    {form.employee && (
                      <button type="button" onClick={clearEmployee} className="rounded-lg border px-3 text-xs text-slate-600">
                        Change
                      </button>
                    )}
                  </div>
                  {employeeOptions.length > 0 && (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-white shadow-lg">
                      {employeeOptions.map((emp) => (
                        <button
                          type="button"
                          key={emp.id}
                          onClick={() => pickEmployee(emp)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          <span className="font-medium">{emp.emp_no} - {emp.name}</span>
                          <span className="block text-xs text-slate-500">{emp.company_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                <label className="text-sm">
                  Date
                  <DatePickerInput
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm">
                    Out time
                    <input type="time" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.out_time} onChange={(e) => setForm((f) => ({ ...f, out_time: e.target.value }))} />
                  </label>
                  <label className="text-sm">
                    Back in time
                    <input type="time" className="mt-1 w-full rounded-lg border px-3 py-2" value={form.in_time} onChange={(e) => setForm((f) => ({ ...f, in_time: e.target.value }))} />
                  </label>
                </div>
                <label className="text-sm md:col-span-2">
                  Reason
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2"
                    placeholder="e.g. Personal matter, bank, hospital"
                    value={form.reason}
                    maxLength={500}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  />
                </label>
              </div>

              {preview?.punches?.length > 0 && (
                <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
                  <p className="mb-2 font-medium text-sky-900">Device punches during the shift</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.punches.map((p) => (
                      <button
                        type="button"
                        key={`${p.out_time}-${p.in_time}`}
                        onClick={() => setForm((f) => ({ ...f, out_time: p.out_time, in_time: p.in_time }))}
                        className="rounded-lg border border-sky-300 bg-white px-2 py-1 text-xs text-sky-800 hover:bg-sky-100"
                      >
                        Use {p.out_time} → {p.in_time} ({fmtMinutes(p.minutes)})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={save}
                  disabled={saving || preview?.minutes == null}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save personal out
                </button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4 lg:col-span-2">
              <h2 className="mb-3 font-semibold text-slate-800">Deduction preview</h2>
              {!form.employee && <p className="text-sm text-slate-500">Select an employee to see leave balances.</p>}
              {previewLoading && <Loader2 className="h-5 w-5 animate-spin text-slate-500" />}
              {previewError && <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-700">{previewError}</p>}
              {preview && !previewLoading && (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2">
                    {["Casual Leave", "Annual Leave"].map((type) => (
                      <div key={type} className="rounded-lg border bg-slate-50 p-2">
                        <p className="text-xs text-slate-500">{type}</p>
                        <p className="font-semibold">{Number(balances[type]?.available || 0)} available</p>
                        <p className="text-xs text-slate-500">used {Number(balances[type]?.used || 0)} of {Number(balances[type]?.total || 0)}</p>
                      </div>
                    ))}
                  </div>
                  {preview.minutes != null ? (
                    <>
                      <p>
                        Out for <span className="font-semibold">{fmtMinutes(preview.minutes)}</span> →{" "}
                        <span className="font-semibold">{preview.deduct_label}</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {preview.allocation.map((part) => (
                          <span key={part.source} className={`rounded-full border px-2 py-0.5 text-xs ${sourceBadge(part.source)}`}>
                            {part.source === "NoPay" ? "NoPay (Monthly Bonus)" : part.source}: {part.days}
                          </span>
                        ))}
                      </div>
                      {preview.nopay_days > 0 && (
                        <p className="rounded-lg bg-rose-50 p-2 text-rose-800">
                          No leave balance for {preview.nopay_days} day(s). About {fmt(preview.nopay_amount)} will be deducted
                          from the Monthly Bonus ((basic + bonus) / {preview.rate?.working_days} × days).
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-slate-500">Enter the out and back-in times to calculate the deduction.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4 grid gap-3 rounded-2xl border bg-white p-4 md:grid-cols-4">
          <select className="rounded-lg border px-3 py-2" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.map((name, i) => (
              <option key={name} value={i + 1}>{name}</option>
            ))}
          </select>
          <select className="rounded-lg border px-3 py-2" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input
            className="rounded-lg border px-3 py-2"
            placeholder="Search employee"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadList()}
          />
          <button type="button" onClick={loadList} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-white">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Load
          </button>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Out → In</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Deducted</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">By</th>
                {canDelete && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium text-slate-900">{row.employee?.name}</p>
                    <p className="text-xs text-slate-500">{row.employee?.emp_no} · {row.employee?.company_name}</p>
                  </td>
                  <td className="px-3 py-2">{row.date}</td>
                  <td className="px-3 py-2">{row.out_time} → {row.in_time}</td>
                  <td className="px-3 py-2">{fmtMinutes(row.minutes)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {!(row.allocation || []).length && (
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600">
                          No deduction (within 30 min)
                        </span>
                      )}
                      {(row.allocation || []).map((part) => (
                        <span key={part.source} className={`rounded-full border px-2 py-0.5 text-xs ${sourceBadge(part.source)}`}>
                          {part.source === "NoPay" ? "NoPay (Bonus)" : part.source}: {part.days}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.reason || "-"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{row.created_by || "-"}</td>
                  {canDelete && (
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => remove(row)} className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-50" title="Remove and reverse">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={canDelete ? 8 : 7} className="px-3 py-8 text-center text-slate-500">
                    No personal out entries for this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
