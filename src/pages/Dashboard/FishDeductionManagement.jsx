import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Fish,
  Plus,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Building2,
  Trash2,
  Pencil,
  Eye,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  Loader2,
  FileSpreadsheet,
  RefreshCw,
  User,
  FileText,
} from "lucide-react";
import Swal from "sweetalert2";
import { toast } from "react-toastify";
import * as XLSX from "xlsx";
import { fetchCompanies } from "@services/ApiDataService";
import {
  fetchFishDeductions,
  createFishDeduction,
  updateFishDeduction,
  deleteFishDeduction,
} from "@services/FishDeductionService";
import employeeService from "@services/EmployeeDataService";

const MONTHS = [
  { value: "01", label: "January", num: 1 },
  { value: "02", label: "February", num: 2 },
  { value: "03", label: "March", num: 3 },
  { value: "04", label: "April", num: 4 },
  { value: "05", label: "May", num: 5 },
  { value: "06", label: "June", num: 6 },
  { value: "07", label: "July", num: 7 },
  { value: "08", label: "August", num: 8 },
  { value: "09", label: "September", num: 9 },
  { value: "10", label: "October", num: 10 },
  { value: "11", label: "November", num: 11 },
  { value: "12", label: "December", num: 12 },
];

const currentYear = new Date().getFullYear();
const currentMonth = String(new Date().getMonth() + 1).padStart(2, "0");
const YEARS = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

const packOn = (company, key) =>
  !!(company?.process_config?.[key]?.enabled ?? company?.process_config?.[key] === true);

export default function FishDeductionManagement() {
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_count: 0, unique_employees: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [isFeatureEnabled, setIsFeatureEnabled] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formEmployee, setFormEmployee] = useState(null);
  const [formAmount, setFormAmount] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formApplicableMonth, setFormApplicableMonth] = useState(`${currentYear}-${currentMonth}`);
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState("Active");

  // Employee Search Dropdown in Modal
  const [companyEmployees, setCompanyEmployees] = useState([]);
  const [empSearchQuery, setEmpSearchQuery] = useState("");
  const [isSearchingEmp, setIsSearchingEmp] = useState(false);
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // 1. Initial Load of Companies
  useEffect(() => {
    (async () => {
      try {
        const rows = await fetchCompanies();
        const list = Array.isArray(rows) ? rows : [];
        setCompanies(list);

        // Prefer JC Foods or company with fish_deduction enabled, else active portal or first company
        const jcFood = list.find(
          (c) =>
            packOn(c, "fish_deduction") ||
            c.name?.toLowerCase().includes("jc") ||
            c.name?.toLowerCase().includes("jay")
        );
        const initial = jcFood || list.find((c) => c.portal_active) || list[0];
        if (initial) {
          setSelectedCompanyId(String(initial.id));
        }
      } catch (err) {
        console.error("Failed to load companies:", err);
        toast.error("Failed to load companies");
      }
    })();
  }, []);

  const activeCompany = useMemo(() => {
    return companies.find((c) => String(c.id) === String(selectedCompanyId)) || null;
  }, [companies, selectedCompanyId]);

  const companyHasFishPack = useMemo(() => {
    if (!activeCompany) return true;
    return packOn(activeCompany, "fish_deduction");
  }, [activeCompany]);

  // 2. Fetch Fish Deductions
  const loadRecords = useCallback(async () => {
    if (!selectedCompanyId) return;
    setIsLoading(true);
    try {
      const applicable = selectedYear && selectedMonth ? `${selectedYear}-${selectedMonth}` : "";
      const params = {
        company_id: selectedCompanyId,
      };
      if (applicable) {
        params.applicable_month = applicable;
      }
      if (statusFilter !== "all") {
        params.status = statusFilter;
      }
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }

      const res = await fetchFishDeductions(params);
      setRecords(res.data || []);
      setSummary(res.summary || { total_amount: 0, total_count: 0, unique_employees: 0 });
      setIsFeatureEnabled(res.feature_enabled !== false);
    } catch (err) {
      console.error("Failed to fetch fish deductions:", err);
      toast.error(err?.response?.data?.message || "Failed to load fish deductions");
    } finally {
      setIsLoading(false);
    }
  }, [selectedCompanyId, selectedYear, selectedMonth, statusFilter, searchTerm]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 3. Load Company Employees for Modal
  useEffect(() => {
    if (!selectedCompanyId) return;
    setIsSearchingEmp(true);
    const fetcher =
      typeof employeeService.fetchEmployees === "function"
        ? employeeService.fetchEmployees()
        : typeof employeeService.getEmployees === "function"
        ? employeeService.getEmployees()
        : Promise.resolve([]);

    fetcher
      .then((res) => {
        const all = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
        const filtered = all.filter(
          (e) =>
            String(
              e.organization_assignment?.company_id ||
                e.organizationAssignment?.company_id ||
                e.organization_assignment?.company?.id ||
                e.company_id
            ) === String(selectedCompanyId)
        );
        // If company has matched employees use filtered, otherwise fallback to all
        setCompanyEmployees(filtered.length > 0 ? filtered : all);
      })
      .catch((err) => {
        console.error("Error loading employees for company:", err);
      })
      .finally(() => setIsSearchingEmp(false));
  }, [selectedCompanyId]);

  // Filtered Employees for Typeahead in Modal
  const searchedEmployees = useMemo(() => {
    const q = empSearchQuery.trim().toLowerCase();
    if (!q) return companyEmployees.slice(0, 30);
    return companyEmployees
      .filter(
        (e) =>
          String(e.full_name || "").toLowerCase().includes(q) ||
          String(e.name_with_initials || "").toLowerCase().includes(q) ||
          String(e.attendance_employee_no || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [companyEmployees, empSearchQuery]);

  // Open Modal for Create
  const handleOpenAdd = () => {
    if (!companyHasFishPack) {
      Swal.fire({
        icon: "warning",
        title: "Feature Disabled",
        text: `Fish Deduction is not enabled for ${activeCompany?.name || "this company"}. Please enable it in Cybernetic Admin first.`,
      });
      return;
    }
    setEditingRecord(null);
    setFormEmployee(null);
    setFormAmount("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormApplicableMonth(`${selectedYear}-${selectedMonth}`);
    setFormDescription("");
    setFormStatus("Active");
    setEmpSearchQuery("");
    setShowEmpDropdown(false);
    setShowModal(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (rec) => {
    setEditingRecord(rec);
    setFormEmployee(rec.employee);
    setFormAmount(String(rec.amount || ""));
    setFormDate(rec.deduction_date ? rec.deduction_date.substring(0, 10) : "");
    setFormApplicableMonth(rec.applicable_month || `${rec.salary_year}-${String(rec.salary_month).padStart(2, "0")}`);
    setFormDescription(rec.description || "");
    setFormStatus(rec.status || "Active");
    setEmpSearchQuery(rec.employee?.full_name || "");
    setShowEmpDropdown(false);
    setShowModal(true);
  };

  // Save Record
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formEmployee?.id) {
      toast.error("Please select an employee");
      return;
    }
    const parsedAmount = Number(formAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }
    if (!formDate) {
      toast.error("Please select a deduction date");
      return;
    }
    if (!formApplicableMonth || !/^\d{4}-(0[1-9]|1[0-2])$/.test(formApplicableMonth)) {
      toast.error("Please select a valid applicable month (YYYY-MM)");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        employee_id: formEmployee.id,
        company_id: Number(selectedCompanyId),
        amount: parsedAmount,
        deduction_date: formDate,
        applicable_month: formApplicableMonth,
        description: formDescription.trim(),
        status: formStatus,
      };

      if (editingRecord) {
        await updateFishDeduction(editingRecord.id, payload);
        toast.success("Fish deduction record updated successfully");
      } else {
        await createFishDeduction(payload);
        toast.success("Fish deduction record created successfully");
      }
      setShowModal(false);
      await loadRecords();
    } catch (err) {
      console.error("Save fish deduction error:", err);
      const msg = err?.response?.data?.message || "Failed to save fish deduction record";
      Swal.fire({
        icon: "error",
        title: "Submission Error",
        text: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Record
  const handleDelete = async (rec) => {
    const result = await Swal.fire({
      title: "Delete Fish Deduction?",
      text: `Are you sure you want to delete the deduction of Rs. ${Number(rec.amount).toFixed(2)} for ${rec.employee?.full_name || "this employee"}?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e11d48",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Yes, delete it",
    });

    if (!result.isConfirmed) return;

    try {
      await deleteFishDeduction(rec.id);
      toast.success("Fish deduction deleted successfully");
      await loadRecords();
    } catch (err) {
      console.error("Delete fish deduction error:", err);
      toast.error(err?.response?.data?.message || "Failed to delete fish deduction");
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!records.length) {
      toast.info("No records to export");
      return;
    }
    const exportData = records.map((r, i) => ({
      "#": i + 1,
      "Employee ID": r.employee?.attendance_employee_no || "N/A",
      "Employee Name": r.employee?.full_name || "N/A",
      "Department": r.employee?.organization_assignment?.department?.name || "N/A",
      "Amount (Rs.)": Number(r.amount || 0).toFixed(2),
      "Deduction Date": r.deduction_date ? r.deduction_date.substring(0, 10) : "",
      "Applicable Month": r.applicable_month,
      "Notes / Description": r.description || "",
      "Status": r.status || "Active",
      "Recorded By": r.creator?.name || "N/A",
      "Created At": r.created_at ? new Date(r.created_at).toLocaleString() : "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fish Deductions");
    const compName = activeCompany?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "Company";
    XLSX.writeFile(wb, `Fish_Deductions_${compName}_${selectedYear}_${selectedMonth}.xlsx`);
  };

  // Pagination Slice
  const totalPages = Math.ceil(records.length / rowsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return records.slice(start, start + rowsPerPage);
  }, [records, currentPage]);

  const selectedMonthObj = MONTHS.find((m) => m.value === selectedMonth);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-teal-50/20 to-slate-100 p-4 md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Top Header Card */}
        <div className="flex flex-col gap-5 rounded-2xl border border-teal-100 bg-white/90 p-6 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md shadow-teal-700/20">
              <Fish className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Fish Deduction Management
                </h1>
                {companyHasFishPack ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 border border-teal-200">
                    <CheckCircle2 className="h-3 w-3" /> Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200">
                    <AlertCircle className="h-3 w-3" /> Disabled
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Track and manage employee fish purchases for JC Foods Processing. Total monthly deductions are automatically applied as{" "}
                <span className="font-semibold text-teal-700">FISH</span> on salary slips.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!records.length}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Export Excel
            </button>
            <button
              type="button"
              onClick={handleOpenAdd}
              disabled={!companyHasFishPack}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-700/20 transition hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              Add Fish Deduction
            </button>
          </div>
        </div>

        {/* Feature Disabled Alert if Company does not have pack */}
        {!companyHasFishPack && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm text-amber-900 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold">
                Fish Deduction feature is currently disabled for {activeCompany?.name || "the selected company"}.
              </p>
              <p className="mt-0.5 text-amber-800">
                To activate this feature for JC Foods Processing (Pvt) Ltd., open the Cybernetic Admin panel (
                <span className="font-mono text-xs">/cybernetic-admin</span>), edit the company, and enable the{" "}
                <strong>Fish Deduction</strong> checkbox under Company process configuration.
              </p>
            </div>
          </div>
        )}

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">
                Total Fish Deductions ({selectedMonthObj?.label || selectedMonth} {selectedYear})
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Rs. {Number(summary.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="mt-1 text-xs text-slate-500">Deducted from monthly payroll for this period</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Records</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {summary.total_count || 0}
            </div>
            <p className="mt-1 text-xs text-slate-500">Individual fish deduction entries</p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Employees Deducted</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                <User className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {summary.unique_employees || 0}
            </div>
            <p className="mt-1 text-xs text-slate-500">Distinct staff with fish deductions</p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {/* Company */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Company</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedCompanyId}
                  onChange={(e) => {
                    setSelectedCompanyId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_code ? `[${c.company_code}] ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Applicable Month */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Salary Month</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Salary Year */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Salary Year</label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  setSelectedYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active</option>
                <option value="Processed">Processed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Emp name, ID, notes..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Records Table Card */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">Employee</th>
                  <th className="px-5 py-3.5">Employee ID</th>
                  <th className="px-5 py-3.5 text-right">Amount (Rs.)</th>
                  <th className="px-5 py-3.5">Deduction Date</th>
                  <th className="px-5 py-3.5">Applicable Month</th>
                  <th className="px-5 py-3.5">Description / Notes</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
                        <span className="text-sm">Loading fish deduction records...</span>
                      </div>
                    </td>
                  </tr>
                ) : paginatedRecords.length > 0 ? (
                  paginatedRecords.map((r) => (
                    <tr key={r.id} className="transition hover:bg-slate-50/70">
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-700 font-semibold text-xs">
                            {r.employee?.full_name?.charAt(0) || "E"}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">
                              {r.employee?.full_name || r.employee?.name_with_initials || "N/A"}
                            </div>
                            <div className="text-xs text-slate-500">
                              {r.employee?.organization_assignment?.department?.name || "General"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-700">
                        {r.employee?.attendance_employee_no || "—"}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        Rs. {Number(r.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {r.deduction_date ? r.deduction_date.substring(0, 10) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800">
                          {r.applicable_month}
                        </span>
                      </td>
                      <td className="px-5 py-4 max-w-xs truncate text-xs text-slate-600" title={r.description}>
                        {r.description || <span className="text-slate-400 italic">No notes</span>}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            r.status === "Active"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : r.status === "Processed"
                              ? "bg-blue-50 text-blue-800 border border-blue-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {r.status || "Active"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewingRecord(r)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(r)}
                            className="rounded-lg p-1.5 text-teal-600 hover:bg-teal-50 hover:text-teal-700"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r)}
                            className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <Fish className="mx-auto h-12 w-12 text-slate-300 mb-2" />
                      <p className="text-base font-semibold text-slate-700">No fish deduction records found</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        {searchTerm || statusFilter !== "all"
                          ? "Try adjusting your search filters or applicable salary month."
                          : "Click '+ Add Fish Deduction' above to record a new fish issue deduction for this company."}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination Footer */}
          {records.length > rowsPerPage && (
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
              <div>
                Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
                {Math.min(currentPage * rowsPerPage, records.length)} of {records.length} records
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setCurrentPage(pg)}
                    className={`rounded-lg px-3 py-1 font-medium ${
                      currentPage === pg
                        ? "bg-teal-700 text-white"
                        : "border border-slate-200 hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {pg}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-200 px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-teal-800">
                  <Fish className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {editingRecord ? "Edit Fish Deduction" : "New Fish Deduction"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeCompany?.name || "Company"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Employee Selector (Searchable Dropdown) */}
              <div className="relative">
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Employee <span className="text-rose-500">*</span>
                </label>

                {formEmployee ? (
                  <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white font-bold text-xs">
                        {formEmployee.full_name?.charAt(0) || "E"}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-slate-900">
                          {formEmployee.full_name || formEmployee.name_with_initials}
                        </div>
                        <div className="text-xs text-slate-500">
                          ID: {formEmployee.attendance_employee_no || "N/A"} •{" "}
                          {formEmployee.organization_assignment?.department?.name || "Department"}
                        </div>
                      </div>
                    </div>
                    {!editingRecord && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormEmployee(null);
                          setEmpSearchQuery("");
                        }}
                        className="rounded p-1 text-slate-400 hover:text-rose-600"
                        title="Change Employee"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search employee by name or ID..."
                        value={empSearchQuery}
                        onFocus={() => setShowEmpDropdown(true)}
                        onChange={(e) => {
                          setEmpSearchQuery(e.target.value);
                          setShowEmpDropdown(true);
                        }}
                        className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {showEmpDropdown && (
                      <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                        {searchedEmployees.length > 0 ? (
                          searchedEmployees.map((emp) => (
                            <button
                              key={emp.id}
                              type="button"
                              onClick={() => {
                                setFormEmployee(emp);
                                setShowEmpDropdown(false);
                              }}
                              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-teal-50/70"
                            >
                              <div>
                                <div className="font-medium text-slate-900">
                                  {emp.full_name || emp.name_with_initials}
                                </div>
                                <div className="text-xs text-slate-500">
                                  ID: {emp.attendance_employee_no || "N/A"} •{" "}
                                  {emp.organization_assignment?.department?.name || "No Dept"}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="p-3 text-center text-xs text-slate-500">
                            {isSearchingEmp ? "Searching employees..." : "No matching employees found"}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Amount (Rs.) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 py-2.5 pl-11 pr-3 text-sm font-semibold focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Grid: Deduction Date & Applicable Month */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Deduction Date */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Deduction Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Date fish was issued/purchased</p>
                </div>

                {/* Applicable Month */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Applicable Salary Month <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="month"
                    required
                    value={formApplicableMonth}
                    onChange={(e) => setFormApplicableMonth(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Payslip month to deduct from</p>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="Active">Active (Ready for Payroll)</option>
                  <option value="Processed">Processed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              {/* Description / Notes */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Description / Notes <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Yellowfin tuna 2kg, voucher #104..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 disabled:opacity-50"
                >
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingRecord ? "Save Changes" : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Fish className="h-5 w-5 text-teal-700" />
                <h3 className="font-bold text-slate-900">Fish Deduction Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Employee</span>
                <span className="font-semibold text-slate-900">
                  {viewingRecord.employee?.full_name || "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Employee ID</span>
                <span className="font-mono text-slate-900">
                  {viewingRecord.employee?.attendance_employee_no || "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-teal-700 text-base">
                  Rs. {Number(viewingRecord.amount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Deduction Date</span>
                <span className="text-slate-800">
                  {viewingRecord.deduction_date ? viewingRecord.deduction_date.substring(0, 10) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Applicable Salary Month</span>
                <span className="font-semibold text-slate-800">{viewingRecord.applicable_month}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <span className="font-semibold">{viewingRecord.status || "Active"}</span>
              </div>
              <div className="py-1 border-b border-slate-100">
                <span className="block text-slate-500 mb-1">Notes / Description</span>
                <p className="text-xs bg-slate-50 p-2.5 rounded-lg text-slate-700">
                  {viewingRecord.description || "No notes attached."}
                </p>
              </div>
              <div className="flex justify-between text-xs text-slate-400 pt-1">
                <span>Recorded By: {viewingRecord.creator?.name || "System"}</span>
                <span>{viewingRecord.created_at ? new Date(viewingRecord.created_at).toLocaleDateString() : ""}</span>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setViewingRecord(null)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
