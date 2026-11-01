import React, { useState, useEffect } from "react";
import { getSingleEntryRecords } from "@services/Reports/SingleEntryReportService";
import { fetchCompanies, fetchDepartmentsById } from "@services/ApiDataService";
import {
  Calendar,
  Search,
  Download,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import DatePickerInput from "@components/DatePickerInput";

const SingleEntryReport = ({ employeeProfile }) => {
  const [reportType, setReportType] = useState("month");
  const [date, setDate] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [search, setSearch] = useState("");
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [perPage, setPerPage] = useState(15);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filter States
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [employeeCategory, setEmployeeCategory] = useState("");
  const [isHolidayWorked, setIsHolidayWorked] = useState(false);

  // employeeProfile auto-fill if provided
  useEffect(() => {
    if (employeeProfile?.attendance_employee_no) {
      setSearch(employeeProfile.attendance_employee_no);
    }
    if (employeeProfile?.organization_assignment?.company?.id) {
      const companyId = String(employeeProfile.organization_assignment.company.id);
      setSelectedCompany(companyId);
      fetchDepartmentsById(companyId)
        .then((depts) => {
          setDepartments(depts || []);
          if (employeeProfile?.organization_assignment?.department?.id) {
            setSelectedDepartment(String(employeeProfile.organization_assignment.department.id));
          }
        })
        .catch(() => {});
    }
  }, [employeeProfile]);

  // Load companies on mount
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const list = await fetchCompanies();
        setCompanies(list || []);
      } catch (error) {
        console.error("Failed to load companies:", error);
      }
    };
    loadCompanies();
  }, []);

  const handleCompanyChange = async (e) => {
    const companyId = e.target.value;
    setSelectedCompany(companyId);
    setSelectedDepartment("");
    if (companyId) {
      try {
        const depts = await fetchDepartmentsById(companyId);
        setDepartments(depts || []);
      } catch (error) {
        console.error("Failed to load departments:", error);
      }
    } else {
      setDepartments([]);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const monthVal = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${monthVal}-${day}`;
  };

  const getQueryParams = (pageOverride = 1, perPageOverride = perPage) => {
    return {
      report_type: reportType,
      date: reportType === "date" ? date : undefined,
      month: reportType === "month" ? month : undefined,
      from_date: reportType === "range" ? fromDate : undefined,
      to_date: reportType === "range" ? toDate : undefined,
      page: pageOverride,
      per_page: perPageOverride,
      search: search || undefined,
      company_id: selectedCompany || undefined,
      department_id: selectedDepartment || undefined,
      employee_category: employeeCategory || undefined,
      holiday_worked: isHolidayWorked,
    };
  };

  const validateDates = () => {
    if (reportType === "date" && !date) {
      Swal.fire({
        icon: "warning",
        title: "Date Required",
        text: "Please select a date to generate the report",
        confirmButtonColor: "#3b82f6",
      });
      return false;
    }
    if (reportType === "month" && !month) {
      Swal.fire({
        icon: "warning",
        title: "Month Required",
        text: "Please select a month to generate the report",
        confirmButtonColor: "#3b82f6",
      });
      return false;
    }
    if (reportType === "range" && (!fromDate || !toDate)) {
      Swal.fire({
        icon: "warning",
        title: "Date Range Required",
        text: "Please select from and to dates",
        confirmButtonColor: "#3b82f6",
      });
      return false;
    }
    return true;
  };

  const fetchReport = async (page = 1) => {
    if (!validateDates()) return;

    try {
      setLoading(true);
      const params = getQueryParams(page, perPage);
      const res = await getSingleEntryRecords(params);
      setData(res.data || []);
      setMeta({
        current_page: res.current_page || 1,
        last_page: res.last_page || 1,
        total: res.total || 0,
      });
    } catch (e) {
      Swal.fire({
        icon: "error",
        title: "Failed to Fetch Report",
        text: e.response?.data?.message || e.message,
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    if (!validateDates()) return;

    if (data.length === 0) {
      Swal.fire({
        icon: "info",
        title: "No Data",
        text: "Generate the report first to export",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    try {
      setExporting(true);

      let allData = [];
      let currentPage = 1;
      let lastPage = 1;

      do {
        const params = getQueryParams(currentPage, 100);
        const res = await getSingleEntryRecords(params);

        allData = allData.concat(res.data || []);
        lastPage = res.last_page || 1;
        currentPage++;
      } while (currentPage <= lastPage);

      if (allData.length === 0) {
        Swal.fire({
          icon: "info",
          title: "No Records",
          text: "No data available to export",
          confirmButtonColor: "#3b82f6",
        });
        return;
      }

      const exportData = allData.map((r, idx) => ({
        "No.": idx + 1,
        "EMP No": r.empNo || "-",
        "Name": r.name || "-",
        "Company": r.company || "-",
        "Department": r.department || "-",
        "Sub Department": r.sub_department || "-",
        "Date": r.date_label ? `${r.date || "-"} (${r.date_label})` : r.date || "-",
        "Time": r.time || "-",
        "Status": r.status || "-",
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Single Entry Report");

      const maxWidth = exportData.reduce((w, r) => {
        Object.keys(r).forEach((key) => {
          const len = String(r[key]).length;
          w[key] = Math.max(w[key] || 10, len);
        });
        return w;
      }, {});
      ws["!cols"] = Object.keys(maxWidth).map((key) => ({ wch: maxWidth[key] + 2 }));

      const suffix =
        reportType === "month"
          ? month
          : reportType === "range"
          ? `${fromDate}_to_${toDate}`
          : date;
      XLSX.writeFile(wb, `Single_Entry_Report_${suffix}.xlsx`);

      Swal.fire({
        icon: "success",
        title: "Exported Successfully",
        text: `${allData.length} records exported`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error("Export error:", e);
      Swal.fire({
        icon: "error",
        title: "Export Failed",
        text: e.response?.data?.message || e.message || "Failed to export data",
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setReportType("month");
    const now = new Date();
    setMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    setDate("");
    setFromDate("");
    setToDate("");
    setSearch("");
    setPerPage(15);
    setSelectedCompany("");
    setSelectedDepartment("");
    setDepartments([]);
    setEmployeeCategory("");
    setIsHolidayWorked(false);
    setData([]);
    setMeta({ current_page: 1, last_page: 1, total: 0 });
  };

  const goToPage = (page) => {
    if (page >= 1 && page <= meta.last_page) {
      fetchReport(page);
    }
  };

  const renderPageNumbers = () => {
    const pages = [];
    const { current_page, last_page } = meta;

    pages.push(1);

    let start = Math.max(2, current_page - 1);
    let end = Math.min(last_page - 1, current_page + 1);

    if (start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < last_page - 1) {
      pages.push("...");
    }

    if (last_page > 1) {
      pages.push(last_page);
    }

    return pages;
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Single Entry Report</h1>
        <p className="text-slate-600">
          View employees with only one attendance entry (IN or OUT) for a specific date, month, or range
        </p>
      </div>

      {/* Filters Card */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-slate-200">
        {/* Top Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Report Type</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none bg-white"
            >
              <option value="month">By Month</option>
              <option value="date">By Date</option>
              <option value="range">By Date Range</option>
            </select>
          </div>

          {reportType === "date" ? (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Date</label>
              <DatePickerInput
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={getTodayDate()}
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              />
            </div>
          ) : reportType === "range" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">From Date</label>
                <DatePickerInput
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  max={toDate || getTodayDate()}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">To Date</label>
                <DatePickerInput
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  min={fromDate}
                  max={getTodayDate()}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Select Month</label>
              <DatePickerInput
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                max={getTodayDate().slice(0, 7)}
                displayFormat="yyyy-MM"
                className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Search Employee</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, NIC or EMP No"
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Records Per Page</label>
            <select
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none bg-white"
              value={perPage}
              onChange={(e) => setPerPage(Number(e.target.value))}
            >
              {[10, 15, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} records
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Bottom Advanced Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Company</label>
            <select
              value={selectedCompany}
              onChange={handleCompanyChange}
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none bg-white"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Department</label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              disabled={!selectedCompany}
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none bg-white disabled:bg-slate-100 disabled:cursor-not-allowed"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
            <select
              value={employeeCategory}
              onChange={(e) => setEmployeeCategory(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none bg-white"
            >
              <option value="">All Categories</option>
              <option value="Executive">Executive</option>
              <option value="Non-Executive">Non-Executive</option>
            </select>
          </div>

          <div className="flex items-center h-full pb-3">
            <label className="flex items-center space-x-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isHolidayWorked}
                onChange={(e) => setIsHolidayWorked(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <span className="text-sm font-semibold text-slate-700">Holiday Worked Only</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => fetchReport(1)}
            disabled={loading}
            className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center min-w-[130px]"
          >
            {loading ? (
              <>
                <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Loading...
              </>
            ) : (
              "Generate"
            )}
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl border border-gray-300 hover:bg-gray-200 transition-all font-semibold"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Results Card */}
      <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
        {/* Table Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-slate-700">
              Showing{" "}
              <span className="text-blue-600">
                {meta.total === 0 ? 0 : (meta.current_page - 1) * perPage + 1}
              </span>{" "}
              to{" "}
              <span className="text-blue-600">
                {Math.min(meta.current_page * perPage, meta.total)}
              </span>{" "}
              of <span className="text-blue-600">{meta.total || 0}</span> records
            </div>
          </div>

          <button
            onClick={exportToExcel}
            disabled={exporting || data.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl shadow hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm"
          >
            {exporting ? (
              <>
                <div className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4" />
                Export to Excel
              </>
            )}
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-slate-100 to-blue-50 border-b-2 border-slate-200">
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  EMP No
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Employee Name
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Department
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Sub Department
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Time
                </th>
                <th className="text-left px-6 py-4 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                      <p className="text-slate-600 font-medium">Loading report...</p>
                    </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                      </div>
                      <p className="text-slate-600 font-medium mb-1">No single entry records found</p>
                      <p className="text-slate-500 text-sm">
                        Select your filter options and click Generate to view the report
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((r) => (
                  <tr key={r.id} className="hover:bg-blue-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{r.empNo || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{r.name || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.company || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.department || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{r.sub_department || "-"}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {r.date || "-"}
                      {r.date_label && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          {r.date_label}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-slate-700">{r.time || "-"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold
                        ${
                          r.status === "IN"
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : r.status === "OUT"
                            ? "bg-blue-100 text-blue-800 border border-blue-200"
                            : "bg-amber-100 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {r.status || "-"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {meta.last_page > 1 && !loading && (
          <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-50 to-blue-50 border-t border-slate-200">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(1)}
                disabled={meta.current_page === 1}
                className="p-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                title="First Page"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToPage(meta.current_page - 1)}
                disabled={meta.current_page === 1}
                className="p-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {renderPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-3 py-2 text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => goToPage(page)}
                    className={`px-4 py-2 rounded-lg font-semibold transition-all shadow-sm
                      ${
                        meta.current_page === page
                          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg scale-105"
                          : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                      }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => goToPage(meta.current_page + 1)}
                disabled={meta.current_page === meta.last_page}
                className="p-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToPage(meta.last_page)}
                disabled={meta.current_page === meta.last_page}
                className="p-2 rounded-lg bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                title="Last Page"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SingleEntryReport;
