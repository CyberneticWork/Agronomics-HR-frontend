import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Printer,
  RefreshCw,
  Building2,
  Calendar,
  AlertCircle,
  TrendingUp,
  Percent,
  DollarSign,
  Users,
  Eye,
  ShieldCheck,
  Info,
} from "lucide-react";
import { fetchCompanies as fetchCompaniesApi } from "@services/ApiDataService";
import PayeManagementService from "@services/PayeManagementService";
import Swal from "sweetalert2";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function PayeManagement() {
  const currentDate = new Date();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [payeData, setPayeData] = useState([]);
  const [summary, setSummary] = useState({
    total_employees: 0,
    paye_active_count: 0,
    total_taxable_remuneration: 0,
    total_paye_deduction: 0,
  });
  const [companyEnabled, setCompanyEnabled] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [appliedTaxTable, setAppliedTaxTable] = useState(null);

  useEffect(() => {
    loadCompanies();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchRecords();
  }, [selectedCompany, selectedMonth, selectedYear, debouncedSearch]);

  const loadCompanies = async () => {
    try {
      const data = await fetchCompaniesApi();
      const list = Array.isArray(data) ? data : [];
      setCompanies(list);
      if (list.length > 0 && !selectedCompany) {
        setSelectedCompany(list[0].id);
      }
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  const fetchRecords = async () => {
    if (!selectedCompany) return;
    const activeCompObj = companies.find((c) => String(c.id) === String(selectedCompany));
    let compProcessConfig = activeCompObj?.process_config;
    if (typeof compProcessConfig === "string") {
      try {
        compProcessConfig = JSON.parse(compProcessConfig);
      } catch {
        compProcessConfig = {};
      }
    }
    const isCompOn = !!(
      compProcessConfig?.stamp_duty_paye_holiday?.enabled ??
      compProcessConfig?.stamp_duty_paye_holiday === true
    );
    if (!isCompOn) {
      setCompanyEnabled(false);
      setCompanyInfo(activeCompObj);
      setPayeData([]);
      return;
    }

    setLoading(true);
    try {
      const res = await PayeManagementService.getPayeRecords({
        company_id: selectedCompany,
        salary_month: selectedMonth,
        salary_year: selectedYear,
        search: debouncedSearch,
        all: 1,
      });

      setCompanyEnabled(res.company_enabled !== false && res.feature_enabled !== false);
      setCompanyInfo(res.company || activeCompObj);
      setAppliedTaxTable(res.tax_table);
      const list = Array.isArray(res.data) ? res.data.filter((emp) => emp.paye_active || emp.paye_setting_active) : [];
      setPayeData(list);
      setSummary(res.summary || {
        total_employees: list.length,
        paye_active_count: list.length,
        total_taxable_remuneration: 0,
        total_paye_deduction: 0,
      });
    } catch (err) {
      if (err?.response?.status === 403 || err?.response?.data?.feature_enabled === false) {
        setCompanyEnabled(false);
        setCompanyInfo(activeCompObj);
        setPayeData([]);
      } else {
        console.error("Error fetching PAYE records:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: err?.response?.data?.message || "Failed to load PAYE records.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "height=700,width=1000");
    const monthName = MONTHS[selectedMonth - 1];
    const compName = companyInfo?.name || companies.find((c) => String(c.id) === String(selectedCompany))?.name || "Company";
    const rangeRows = appliedTaxTable?.range_table || [];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>PAYE / APIT Tax Schedule - ${monthName} ${selectedYear}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #1e293b; font-size: 11px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0B4F5C; padding-bottom: 12px; }
            .header h1 { margin: 0 0 4px; color: #0B4F5C; font-size: 20px; }
            .header p { margin: 0; color: #64748b; font-size: 12px; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 24px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background-color: #0B4F5C; color: #ffffff; font-weight: 600; font-size: 10px; text-transform: uppercase; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .num { text-align: right; }
            .center { text-align: center; }
            .bold { font-weight: 600; }
            .section-title { font-size: 13px; font-weight: 700; color: #0B4F5C; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
            .formula-note { background: #f1f5f9; padding: 8px 12px; border-radius: 4px; margin-top: 8px; font-size: 10px; color: #475569; }
            .footer { margin-top: 24px; text-align: right; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${compName}</h1>
            <p>PAYE / APIT Tax Deduction Schedule — ${monthName} ${selectedYear}</p>
            <p><small>Applied Table: ${appliedTaxTable?.name || "Standard APIT"} | Personal Relief: ${appliedTaxTable?.personal_relief_monthly ? `Rs. ${Number(appliedTaxTable.personal_relief_monthly).toLocaleString()}/month` : "N/A"}</small></p>
          </div>
          <div class="summary">
            <div><strong>Total Taxable Employees:</strong> ${summary.paye_active_count} / ${summary.total_employees}</div>
            <div><strong>Total Gross Remuneration:</strong> Rs. ${Number(summary.total_gross ?? summary.total_taxable_remuneration).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
            <div><strong>Total PAYE Deducted:</strong> Rs. ${Number(summary.total_paye_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>

          <div class="section-title">1. Official Government PAYE / APIT Tax Range Table</div>
          <table>
            <thead>
              <tr>
                <th>Monthly Taxable Regular Profits</th>
                <th>PAYE/APIT Calculation</th>
                <th class="center">Applicable Tax Rate</th>
                <th class="num">Fixed Deduction</th>
              </tr>
            </thead>
            <tbody>
              ${rangeRows.map((rng) => `
                <tr>
                  <td class="bold">${rng.range_display}</td>
                  <td><code>${rng.calculation_display || rng.formula}</code></td>
                  <td class="center">${rng.rate_display}</td>
                  <td class="num">${rng.fixed_deduction_display}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="section-title">2. Employee Details Table</div>
          <table>
            <thead>
              <tr>
                <th>Employee Number</th>
                <th>Employee Name</th>
                <th class="num">Gross Salary</th>
                <th class="num">PAYE/APIT Amount</th>
                <th class="center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${payeData.map((row) => `
                <tr>
                  <td>${row.employee_no}</td>
                  <td>${row.name || row.employee_name || "-"}</td>
                  <td class="num">Rs. ${Number(row.gross_salary ?? row.taxable_remuneration ?? row.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="num bold" style="color: #0B4F5C;">Rs. ${Number(row.paye_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="center">${row.status || (row.paye_amount > 0 ? "Taxable" : "Exempt")}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9; font-weight: bold;">
                <td colspan="3" style="text-align: right;">Total PAYE/APIT Deduction:</td>
                <td class="num" style="color: #0B4F5C;">Rs. ${Number(summary.total_paye_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>

          <div class="formula-note">
            <strong>Gross Salary Calculation Basis:</strong> Gross Salary = Basic Salary + Holiday Payment + Off-Day Payment + Increment Amount − No-Pay Amount.
            <br />
            Personal tax-free relief of ${appliedTaxTable?.personal_relief_monthly ? `Rs. ${Number(appliedTaxTable.personal_relief_monthly).toLocaleString()}/month` : "applicable relief"} is exempted before progressive Inland Revenue APIT rates are applied.
          </div>

          <div class="footer">
            Printed on: ${new Date().toLocaleString()} | Cybernetic HR System
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const formatCurrency = (val) =>
    `Rs. ${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-teal-700 to-emerald-800 text-white rounded-2xl shadow-md">
              <Percent className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                PAYE / APIT Management
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Government tax table configuration, personal relief deductions & PAYE schedules
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {companyEnabled && (
            <button
              onClick={handlePrint}
              disabled={!payeData.length || !companyEnabled}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              Print Report
            </button>
          )}
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Company
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 transition"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {companyEnabled && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Salary Month
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 transition"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 transition"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Search Employee
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="Emp no or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-teal-500 transition"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Feature Disabled View */}
      {!companyEnabled ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-8 text-amber-900 shadow-sm flex flex-col items-center text-center max-w-2xl mx-auto my-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-3 text-amber-600">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h4 className="font-bold text-xl text-amber-950 mb-1.5">
            PAYE Management Disabled
          </h4>
          <p className="text-amber-800 text-sm max-w-lg mb-3">
            The <strong>STAMP DUTY, PAYE, No-Pay and Off-Day + Holiday Processing</strong> feature is currently disabled for{" "}
            <strong>{companyInfo?.name || companies.find((c) => String(c.id) === String(selectedCompany))?.name || "this company"}</strong>.
          </p>
          <p className="text-xs text-amber-700 bg-amber-100/80 rounded-lg px-4 py-2 border border-amber-200">
            To enable this feature, navigate to <strong>Cybernetic Admin Panel → Process Configuration</strong> and activate the toggle for this company.
          </p>
        </div>
      ) : (
        <>


      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Taxable Employees
            </p>
            <h3 className="text-2xl font-black text-slate-900 mt-1">
              {summary.paye_active_count}
              <span className="text-xs font-normal text-slate-500 ml-1.5">
                / {summary.total_employees} active
              </span>
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Gross Remuneration
            </p>
            <h3 className="text-xl font-black text-slate-900 mt-1 truncate">
              {formatCurrency(summary.total_gross ?? summary.total_taxable_remuneration)}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total PAYE Deduction
            </p>
            <h3 className="text-xl font-black text-emerald-700 mt-1 truncate">
              {formatCurrency(summary.total_paye_deduction)}
            </h3>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Applied Tax Table
            </p>
            <h3 className="text-sm font-bold text-slate-900 mt-1 truncate">
              {appliedTaxTable?.name || "Inland Revenue APIT"}
            </h3>
            <p className="text-xs text-teal-700 font-semibold mt-0.5">
              Relief: {appliedTaxTable?.personal_relief_monthly ? `${formatCurrency(appliedTaxTable.personal_relief_monthly)}/mo` : "N/A"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Official Government PAYE / APIT Tax Range Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gradient-to-r from-slate-50 via-teal-50/20 to-emerald-50/30">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-700" />
              <h2 className="text-base font-bold text-slate-900">
                Official Government PAYE / APIT Tax Range Table
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {appliedTaxTable?.name || "Sri Lanka Inland Revenue Department APIT Tax Schedule"}
              {appliedTaxTable?.effective_from ? ` | Effective: ${appliedTaxTable.effective_from}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
              Tax-Free Personal Relief: {appliedTaxTable?.personal_relief_monthly ? `${formatCurrency(appliedTaxTable.personal_relief_monthly)}/month` : "N/A"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="px-5 py-3.5">Monthly Taxable Regular Profits</th>
                <th className="px-5 py-3.5">PAYE/APIT Calculation</th>
                <th className="px-5 py-3.5 text-center">Applicable Tax Rate</th>
                <th className="px-5 py-3.5 text-right">Fixed Deduction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {(appliedTaxTable?.range_table || []).map((rng, idx) => (
                <tr key={idx} className={idx === 0 ? "bg-emerald-50/20" : "hover:bg-slate-50/60 transition"}>
                  <td className="px-5 py-3.5 font-bold text-slate-900">
                    {rng.range_display}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-xs">
                    <code className="px-2.5 py-1 rounded bg-slate-100 border border-slate-200 font-semibold text-slate-800">
                      {rng.calculation_display || rng.formula}
                    </code>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        rng.rate_percent === 0
                          ? "bg-slate-100 text-slate-700 border border-slate-200"
                          : "bg-teal-100 text-teal-800 border border-teal-200"
                      }`}
                    >
                      {rng.rate_display}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right font-semibold text-slate-800">
                    {rng.fixed_deduction_display}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700">Salary Calculation Formula: </span>
            <code className="bg-white px-2 py-0.5 rounded border border-slate-300 font-semibold text-teal-800">
              Gross Salary = Basic Salary + Holiday Payment + Off-Day Payment + Increment Amount − No-Pay Amount
            </code>
          </div>
          <p className="text-slate-500 italic">
            * Inland Revenue progressive rates apply to Gross Salary after exempting monthly personal relief.
          </p>
        </div>
      </div>

      {/* Employee Details Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Employee Details Table
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Calculated dynamically from Gross Salary = Basic Salary + Holiday Payment + Off-Day Payment + Increment Amount − No-Pay Amount
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700 self-start sm:self-auto">
            {payeData.length} Employee(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="px-5 py-3.5">Employee Number</th>
                <th className="px-5 py-3.5">Employee Name</th>
                <th className="px-5 py-3.5 text-right">Gross Salary</th>
                <th className="px-5 py-3.5 text-right">PAYE/APIT Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                    Calculating PAYE records...
                  </td>
                </tr>
              ) : payeData.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-12 text-center text-slate-400">
                    No employee records found matching your filters.
                  </td>
                </tr>
              ) : (
                payeData.map((row) => (
                  <tr key={row.id || row.employee_id || row.employee_no} className="hover:bg-teal-50/20 transition">
                    <td className="px-5 py-3.5 font-bold text-slate-900">
                      {row.employee_no}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">
                      {row.name || row.employee_name || "-"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="font-bold text-slate-900">
                        {formatCurrency(row.gross_salary ?? row.taxable_remuneration ?? row.basic_salary)}
                      </div>
                      {(Number(row.holiday_amount || 0) > 0 || Number(row.off_day_amount || 0) > 0 || Number(row.nopay_amount || 0) > 0 || Number(row.increment_amount || 0) > 0) && (
                        <div className="text-[11px] text-slate-400 mt-0.5 font-normal">
                          Basic: {formatCurrency(row.basic_salary)}
                          {Number(row.off_day_amount || 0) > 0 && ` + Off-Day: ${formatCurrency(row.off_day_amount)}`}
                          {Number(row.holiday_amount || 0) > 0 && ` + Hol: ${formatCurrency(row.holiday_amount)}`}
                          {Number(row.increment_amount || 0) > 0 && ` + Inc: ${formatCurrency(row.increment_amount)}`}
                          {Number(row.nopay_amount || 0) > 0 && ` − NoPay: ${formatCurrency(row.nopay_amount)}`}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="font-black text-teal-800 text-base">
                        {formatCurrency(row.paye_amount)}
                      </div>
                      {row.paye_amount > 0 ? (
                        <div className="text-[11px] text-teal-700 font-semibold mt-0.5 font-mono">
                          {row.applicable_formula ? (
                            <span>({row.applicable_rate}% × {formatCurrency(row.gross_salary)} − Rs. {Number(row.fixed_deduction || 0).toLocaleString()})</span>
                          ) : (
                            <span>{row.applicable_rate ? `${row.applicable_rate}% band applied` : "Tax applied"}</span>
                          )}
                        </div>
                      ) : Number(row.gross_salary ?? row.taxable_remuneration ?? row.basic_salary ?? 0) <= Number(row.relief_amount ?? appliedTaxTable?.personal_relief_monthly ?? 0) ? (
                        <div className="text-[11px] text-slate-400 italic">
                          Tax relief – Nil ({row.applicable_range || (appliedTaxTable?.personal_relief_monthly ? `Up to ${formatCurrency(appliedTaxTable.personal_relief_monthly)}` : "Within Relief")})
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-600 font-medium italic">Exempt in Settings</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          (row.status || (row.paye_amount > 0 ? "Taxable" : "Exempt")) === "Exempt"
                            ? "bg-slate-100 text-slate-600"
                            : row.paye_amount > 0
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {row.status || row.calculation_status || (row.paye_amount > 0 ? "Taxable" : "Exempt")}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
  );
}
