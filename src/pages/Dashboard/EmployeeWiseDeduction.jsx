import { fetchCompanies } from "@services/ApiDataService";
import { fetchDeductions } from "@services/DeductionService";
import {
  assignDeduction,
  deleteAssignedDeduction,
  listAssignedDeductions,
  updateAssignedDeductionAmount,
} from "@services/AssignSalaryComponentService";
import {
  AssignModal,
  EditableAmountCell,
  MONTHS,
  YEARS,
} from "./EmployeeWiseAllowance";
import { Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

const currentYear = new Date().getFullYear();

function normalizeDeductions(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
}

export default function EmployeeWiseDeduction() {
  const [companies, setCompanies] = useState([]);
  const [predefined, setPredefined] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCompany, setFilterCompany] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState(String(currentYear));
  const [deletingId, setDeletingId] = useState(null);

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {};
      if (filterCompany) params.company_id = filterCompany;
      if (filterMonth) params.month = filterMonth;
      if (filterYear) params.year = filterYear;
      setAssignments(await listAssignedDeductions(params));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load deduction assignments");
    } finally {
      setIsLoading(false);
    }
  }, [filterCompany, filterMonth, filterYear]);

  useEffect(() => {
    (async () => {
      try {
        const [companyList, deductionList] = await Promise.all([
          fetchCompanies(),
          fetchDeductions(),
        ]);
        setCompanies(companyList || []);
        setPredefined(
          normalizeDeductions(deductionList).filter((d) => d.status !== "inactive")
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load masters");
      }
    })();
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return assignments;
    return assignments.filter(
      (r) =>
        String(r.deduction_code || "").toLowerCase().includes(term) ||
        String(r.deduction_name || "").toLowerCase().includes(term) ||
        String(r.employee_name || "").toLowerCase().includes(term) ||
        String(r.attendance_no || "").toLowerCase().includes(term)
    );
  }, [assignments, searchTerm]);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this deduction for this month?")) return;
    setDeletingId(id);
    try {
      await deleteAssignedDeduction(id);
      toast.success("Assignment removed");
      await loadAssignments();
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove assignment");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Assign Deductions</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pick a predefined deduction and assign it to one employee. For salary advance,
            choose Basic or Bonus per employee.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          disabled={predefined.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Assign Deduction
        </button>
      </div>

      {predefined.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No predefined deductions yet. Go to <strong>1. Predefine</strong> and create one first.
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <select
          value={filterCompany}
          onChange={(e) => setFilterCompany(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_label || c.name}
            </option>
          ))}
        </select>
        <select
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
        >
          <option value="">All years</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employee / deduction"
            className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-rose-700" />
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Emp No</th>
                <th className="px-4 py-3">Deduction</th>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Deduct from</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 hover:bg-rose-50/30">
                  <td className="px-4 py-3">{row.employee_name}</td>
                  <td className="px-4 py-3">{row.attendance_no}</td>
                  <td className="px-4 py-3">
                    {row.deduction_code} — {row.deduction_name}
                  </td>
                  <td className="px-4 py-3">
                    {MONTHS.find((m) => m.value === Number(row.month))?.label || row.month}/
                    {row.year}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <EditableAmountCell
                      value={row.amount}
                      onSave={async (amt) => {
                        await updateAssignedDeductionAmount(row.id, amt);
                        toast.success("Amount updated");
                        await loadAssignments();
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {String(row.deduct_from || "").toLowerCase() === "basic"
                      ? "Basic salary"
                      : String(row.deduct_from || "").toLowerCase() === "bonus"
                        ? "Monthly bonus"
                        : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={deletingId === row.id}
                      onClick={() => handleDelete(row.id)}
                      className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-700"
                    >
                      {deletingId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No assignments for this filter. Click Assign Deduction to add.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <AssignModal
          companies={companies}
          predefined={predefined}
          accent="rose"
          title="Assign Deduction"
          itemLabel="Deduction"
          idKey="deduction_id"
          codeKey="deduction_code"
          nameKey="deduction_name"
          onClose={() => setShowModal(false)}
          onAssign={assignDeduction}
          onSuccess={async () => {
            setShowModal(false);
            await loadAssignments();
          }}
        />
      )}
    </div>
  );
}
