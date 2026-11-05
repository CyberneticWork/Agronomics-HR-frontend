import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Search, Trash2, Edit3, X } from "lucide-react";
import Swal from "sweetalert2";
import employeeLeaveBalanceService from "@services/employeeLeaveBalanceService";

const currentYear = new Date().getFullYear();

const emptyForm = {
  employee_id: "",
  year: String(currentYear),
  leave_type: "Annual Leave",
  entitled_days: "",
  notes: "",
  status: "active",
};

const EmployeeLeaveBalance = () => {
  const [rows, setRows] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({
    year: String(currentYear),
    search: "",
    status: "active",
  });

  const loadMeta = useCallback(async () => {
    try {
      const [types, emps] = await Promise.all([
        employeeLeaveBalanceService.leaveTypes(),
        employeeLeaveBalanceService.searchEmployees(),
      ]);
      setLeaveTypes(Array.isArray(types) ? types : []);
      setEmployees(Array.isArray(emps) ? emps : []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== "" && v != null)
      );
      const data = await employeeLeaveBalanceService.list(params);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Load failed",
        text: e.response?.data?.message || e.message,
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Which leave types are already assigned to this employee and year (excluding current edited row)
  const existingLeaveTypesForEmployee = useMemo(() => {
    if (!form.employee_id || !form.year) return new Set();
    const set = new Set();
    rows.forEach((r) => {
      if (
        String(r.employee_id) === String(form.employee_id) &&
        String(r.year) === String(form.year) &&
        r.id !== editingId
      ) {
        set.add(r.leave_type);
      }
    });
    return set;
  }, [rows, form.employee_id, form.year, editingId]);

  const hasDuplicateConflict = existingLeaveTypesForEmployee.has(form.leave_type);

  const openCreate = () => {
    setEditingId(null);
    const yr = filters.year || String(currentYear);
    const initialEmp = employees[0]?.id ? String(employees[0].id) : "";
    const taken = new Set(
      rows
        .filter((r) => String(r.employee_id) === String(initialEmp) && String(r.year) === String(yr))
        .map((r) => r.leave_type)
    );
    const firstAvailable = leaveTypes.find((t) => !taken.has(t)) || "Annual Leave";
    setForm({
      ...emptyForm,
      year: yr,
      employee_id: initialEmp,
      leave_type: firstAvailable,
    });
    setShowForm(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm({
      employee_id: String(row.employee_id),
      year: String(row.year),
      leave_type: row.leave_type,
      entitled_days: String(row.entitled_days),
      notes: row.notes || "",
      status: row.status || "active",
    });
    setShowForm(true);
  };

  const handleEmployeeChange = (employeeId) => {
    const taken = new Set(
      rows
        .filter((r) => String(r.employee_id) === String(employeeId) && String(r.year) === String(form.year))
        .map((r) => r.leave_type)
    );
    let nextType = form.leave_type;
    if (taken.has(nextType)) {
      const firstAvailable = leaveTypes.find((t) => !taken.has(t));
      if (firstAvailable) nextType = firstAvailable;
    }
    setForm({ ...form, employee_id: employeeId, leave_type: nextType });
  };

  const handleYearChange = (year) => {
    const taken = new Set(
      rows
        .filter((r) => String(r.employee_id) === String(form.employee_id) && String(r.year) === String(year) && r.id !== editingId)
        .map((r) => r.leave_type)
    );
    let nextType = form.leave_type;
    if (taken.has(nextType)) {
      const firstAvailable = leaveTypes.find((t) => !taken.has(t));
      if (firstAvailable) nextType = firstAvailable;
    }
    setForm({ ...form, year, leave_type: nextType });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.employee_id || !form.year || !form.leave_type || form.entitled_days === "") {
      Swal.fire({ icon: "warning", title: "Missing fields", text: "Employee, year, leave type and days are required." });
      return;
    }

    if (hasDuplicateConflict) {
      Swal.fire({
        icon: "warning",
        title: "Duplicate Leave Balance",
        text: `A leave balance for this employee already exists for ${form.leave_type} (${form.year}). Please choose another leave type or edit the existing record.`,
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employee_id: Number(form.employee_id),
        year: Number(form.year),
        leave_type: form.leave_type,
        entitled_days: Number(form.entitled_days),
        notes: form.notes || null,
        status: form.status,
      };
      if (editingId) {
        await employeeLeaveBalanceService.update(editingId, payload);
      } else {
        await employeeLeaveBalanceService.create(payload);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      await loadData();
      Swal.fire({ icon: "success", title: "Saved", timer: 1200, showConfirmButton: false });
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "Request failed. Please try again.";
      Swal.fire({
        icon: "error",
        title: "Save failed",
        text: message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row) => {
    const ask = await Swal.fire({
      title: "Delete leave balance?",
      text: `${row.employee_name} — ${row.leave_type} (${row.year})`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Yes, delete",
    });
    if (!ask.isConfirmed) return;
    try {
      await employeeLeaveBalanceService.remove(row.id);
      await loadData();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Delete failed",
        text: err.response?.data?.message || err.message,
      });
    }
  };

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y -= 1) years.push(y);
    return years;
  }, []);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Leave Balances</h1>
          <p className="text-sm text-gray-600">
            Set entitled leave days per employee and year. These override default leave policy on Leave Form.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> Add Balance
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.year}
          onChange={(e) => setFilters({ ...filters, year: e.target.value })}
        >
          <option value="">All years</option>
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
            placeholder="Search employee"
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          />
        </div>
        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Emp No</th>
              <th className="p-3 text-left">Employee</th>
              <th className="p-3 text-left">Year</th>
              <th className="p-3 text-left">Leave Type</th>
              <th className="p-3 text-right">Entitled Days</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-left">Notes</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="8" className="p-8 text-center text-gray-500">No leave balances found.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono">{row.emp_no}</td>
                  <td className="p-3 font-medium">{row.employee_name}</td>
                  <td className="p-3">{row.year}</td>
                  <td className="p-3">{row.leave_type}</td>
                  <td className="p-3 text-right font-semibold">{row.entitled_days}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{row.notes || "-"}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => openEdit(row)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded mr-1" title="Edit">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(row)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative">
            <button
              className="absolute right-3 top-3 p-1 text-gray-500 hover:bg-gray-100 rounded"
              onClick={() => setShowForm(false)}
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Leave Balance" : "Add Leave Balance"}</h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Employee {editingId && <span className="text-xs text-gray-400 font-normal">(Cannot be changed)</span>}
                </label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                  value={form.employee_id}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  required
                  disabled={Boolean(editingId)}
                >
                  <option value="">Select employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {(emp.attendance_employee_no || emp.id) + " — " + (emp.full_name || emp.name_with_initials)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Year {editingId && <span className="text-xs text-gray-400 font-normal">(Cannot be changed)</span>}
                  </label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-600 disabled:cursor-not-allowed"
                    value={form.year}
                    onChange={(e) => handleYearChange(e.target.value)}
                    required
                    disabled={Boolean(editingId)}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Entitled Days</label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.entitled_days}
                    onChange={(e) => setForm({ ...form, entitled_days: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Leave Type</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.leave_type}
                  onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
                  required
                >
                  {leaveTypes.map((t) => {
                    const isTaken = existingLeaveTypesForEmployee.has(t);
                    return (
                      <option key={t} value={t} disabled={isTaken}>
                        {t} {isTaken ? "(already assigned)" : ""}
                      </option>
                    );
                  })}
                </select>
                {hasDuplicateConflict && (
                  <p className="text-xs text-amber-600 mt-1 font-medium">
                    ⚠️ A leave balance for this employee already exists for {form.leave_type} ({form.year}). Please choose another leave type or edit the existing record.
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <input
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || hasDuplicateConflict}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-blue-700"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeLeaveBalance;
