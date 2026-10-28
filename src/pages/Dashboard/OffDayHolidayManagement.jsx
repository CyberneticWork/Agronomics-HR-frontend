import React, { useState, useEffect } from "react";
import {
  Calendar,
  Search,
  Printer,
  RefreshCw,
  Building2,
  DollarSign,
  Sun,
  Award,
  Users,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { fetchCompanies as fetchCompaniesApi } from "@services/ApiDataService";
import OffDayHolidayService from "@services/OffDayHolidayService";
import Swal from "sweetalert2";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function OffDayHolidayManagement() {
  const currentDate = new Date();
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({
    total_employees: 0,
    total_off_days_worked: 0,
    total_off_day_pay: 0,
    total_holidays_worked: 0,
    total_holiday_pay: 0,
    total_additional_pay: 0,
  });
  const [companyEnabled, setCompanyEnabled] = useState(true);
  const [companyInfo, setCompanyInfo] = useState(null);

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
      setRecords([]);
      setSummary({
        total_employees: 0,
        total_off_days_worked: 0,
        total_off_day_pay: 0,
        total_holidays_worked: 0,
        total_holiday_pay: 0,
        total_additional_pay: 0,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await OffDayHolidayService.getOffDayHolidayRecords({
        company_id: selectedCompany,
        salary_month: selectedMonth,
        salary_year: selectedYear,
        search: debouncedSearch,
        all: 1,
      });

      setCompanyEnabled(res.company_enabled !== false && res.feature_enabled !== false);
      setCompanyInfo(res.company || activeCompObj);
      const list = Array.isArray(res.data)
        ? res.data.filter((r) => r.off_day_processing || r.off_day_processing_active || r.holiday_processing || r.holiday_processing_active)
        : [];
      setRecords(list);
      setSummary(res.summary || {
        total_employees: list.length,
        total_off_days_worked: 0,
        total_off_day_pay: 0,
        total_holidays_worked: 0,
        total_holiday_pay: 0,
        total_additional_pay: 0,
      });
    } catch (err) {
      if (err?.response?.status === 403 || err?.response?.data?.feature_enabled === false || err?.response?.data?.company_enabled === false) {
        setCompanyEnabled(false);
        setCompanyInfo(activeCompObj);
        setRecords([]);
        setSummary({
          total_employees: 0,
          total_off_days_worked: 0,
          total_off_day_pay: 0,
          total_holidays_worked: 0,
          total_holiday_pay: 0,
          total_additional_pay: 0,
        });
      } else {
        console.error("Error fetching off-day & holiday records:", err);
        Swal.fire({
          icon: "error",
          title: "Error",
          text: err?.response?.data?.message || "Failed to load off-day and holiday pay records.",
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

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Off-Day & Holiday Remuneration Schedule - ${monthName} ${selectedYear}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; margin: 24px; color: #1e293b; font-size: 11px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0D9488; padding-bottom: 12px; }
            .header h1 { margin: 0 0 4px; color: #0D9488; font-size: 20px; }
            .header p { margin: 0; color: #64748b; font-size: 12px; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background-color: #0D9488; color: #ffffff; font-weight: 600; font-size: 10px; text-transform: uppercase; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .num { text-align: right; }
            .bold { font-weight: 600; }
            .footer { margin-top: 24px; text-align: right; font-size: 10px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${compName}</h1>
            <p>Off-Day & Public Holiday Work Compensation — ${monthName} ${selectedYear}</p>
            <p><small>Daily Rate Rule: Basic Salary ÷ 30 | Holiday Pay: Daily Rate × Holidays Worked | Off-Day Pay: Daily Rate × Off-Days Worked</small></p>
          </div>
          <div class="summary">
            <div><strong>Total Off-Days Worked:</strong> ${summary.total_off_days_worked} (Rs. ${Number(summary.total_off_day_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
            <div><strong>Total Holidays Worked:</strong> ${summary.total_holidays_worked} (Rs. ${Number(summary.total_holiday_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
            <div><strong>Total Additions to Gross:</strong> Rs. ${Number(summary.total_additional_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Emp No</th>
                <th>Employee Name</th>
                <th class="num">Basic Salary</th>
                <th class="num">Daily Rate</th>
                <th class="num">Off-Days</th>
                <th class="num">Off-Day Pay</th>
                <th class="num">Holidays</th>
                <th class="num">Holiday Pay</th>
                <th class="num">Total Additions</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${records.map((row) => `
                <tr>
                  <td>${row.employee_no}</td>
                  <td>${row.name}</td>
                  <td class="num">Rs. ${Number(row.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="num">Rs. ${Number(row.daily_rate).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="num bold">${row.off_days_worked}</td>
                  <td class="num">Rs. ${Number(row.off_day_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="num bold">${row.holidays_worked}</td>
                  <td class="num">Rs. ${Number(row.holiday_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td class="num bold" style="color: #0D9488;">Rs. ${Number(row.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td>${row.status}</td>
                </tr>
              `).join("")}
            </tbody>
            <tfoot>
              <tr style="background:#f1f5f9; font-weight: bold;">
                <td colspan="4" style="text-align: right;">Grand Totals:</td>
                <td class="num">${summary.total_off_days_worked}</td>
                <td class="num">Rs. ${Number(summary.total_off_day_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="num">${summary.total_holidays_worked}</td>
                <td class="num">Rs. ${Number(summary.total_holiday_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td class="num" style="color: #0D9488;">Rs. ${Number(summary.total_additional_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
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
            <div className="p-3 bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-2xl shadow-md">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Off-Day & Holiday Processing
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Attendance-based off-day & public holiday cross-referencing, daily rate calculations & compensation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {companyEnabled && (
            <button
              onClick={handlePrint}
              disabled={!records.length}
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

      {/* Feature Disabled Alert */}
      {!companyEnabled && (
        <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-900 shadow-sm flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <h4 className="font-bold text-base text-amber-950 mb-1">
              Feature Not Enabled for this Company
            </h4>
            <p className="text-amber-800">
              The <strong>Stamp Duty, PAYE, No-Pay and Off-Day + Holiday Processing</strong> feature is currently disabled for{" "}
              <strong>{companyInfo?.name || "this company"}</strong>.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              To activate Off-Day and Holiday compensation rules, navigate to <strong>Cybernetic Admin Panel → Feature Management</strong> and enable this feature pack.
            </p>
          </div>
        </div>
      )}

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

      {companyEnabled && (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Off-Days Worked
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {summary.total_off_days_worked} <span className="text-xs font-normal text-slate-500">Days</span>
                </h3>
                <p className="text-xs font-semibold text-teal-700 mt-0.5">
                  {formatCurrency(summary.total_off_day_pay)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                <Sun className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Holidays Worked
                </p>
                <h3 className="text-2xl font-black text-slate-900 mt-1">
                  {summary.total_holidays_worked} <span className="text-xs font-normal text-slate-500">Days</span>
                </h3>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                  {formatCurrency(summary.total_holiday_pay)}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Total Additional Pay
                </p>
                <h3 className="text-xl font-black text-teal-800 mt-1 truncate">
                  {formatCurrency(summary.total_additional_pay)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Included in Gross Salary
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-cyan-700 flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Calculation Basis
                </p>
                <h3 className="text-sm font-bold text-slate-900 mt-1">
                  Daily Rate = Basic ÷ 30
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  No double counting on overlaps
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Main Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Off-Day and Holiday Compensation Records
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Attendance days cross-referenced with roster off-days and holiday calendars
                </p>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {records.length} Employee(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                    <th className="px-5 py-3.5">Emp No</th>
                    <th className="px-5 py-3.5">Employee Name</th>
                    <th className="px-5 py-3.5 text-right">Basic Salary</th>
                    <th className="px-5 py-3.5 text-right">Daily Rate</th>
                    <th className="px-5 py-3.5 text-center">Off-Days</th>
                    <th className="px-5 py-3.5 text-right">Off-Day Pay</th>
                    <th className="px-5 py-3.5 text-center">Holidays</th>
                    <th className="px-5 py-3.5 text-right">Holiday Pay</th>
                    <th className="px-5 py-3.5 text-right">Total Additions</th>
                    <th className="px-5 py-3.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                        Calculating off-day and holiday attendance...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="py-12 text-center text-slate-400">
                        No records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    records.map((row) => (
                      <tr key={row.id} className="hover:bg-teal-50/20 transition">
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          {row.employee_no}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-slate-800">
                          <div>{row.name}</div>
                          <span className="text-[11px] text-slate-400">
                            Off: {row.scheduled_day_off || "Sunday"}
                            {!row.off_day_processing_active && " · Off-Days OFF"}
                            {!row.holiday_processing_active && " · Holidays OFF"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium text-slate-700">
                          {formatCurrency(row.basic_salary)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-slate-600">
                          {formatCurrency(row.daily_rate)}
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-teal-700">
                          {row.off_days_worked}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                          {formatCurrency(row.off_day_amount)}
                        </td>
                        <td className="px-5 py-3.5 text-center font-bold text-emerald-700">
                          {row.holidays_worked}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-900">
                          {formatCurrency(row.holiday_amount)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-teal-800 text-base">
                          {formatCurrency(row.total_amount)}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                              row.total_amount > 0
                                ? "bg-teal-100 text-teal-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {row.status}
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
