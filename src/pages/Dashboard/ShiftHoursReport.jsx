import React, { useEffect, useState } from "react";
import { FileSpreadsheet, Search, Timer, Clock3 } from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { fetchCompanies, fetchDepartments } from "@services/ApiDataService";
import shiftHoursReportService from "@services/shiftHoursReportService";
import DatePickerInput from "@components/DatePickerInput";

/** Display duration as HH:MM (supports API string or decimal hours). */
const formatHHMM = (value) => {
  if (value == null || value === "") return "00:00";
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.trim().split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return value;
  }
  const decimal = Number(value);
  if (Number.isNaN(decimal) || decimal <= 0) return "00:00";
  const totalMinutes = Math.max(0, Math.round(decimal * 60));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const ShiftHoursReport = () => {
  const [reportType, setReportType] = useState("within");
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    company_id: "",
    department_id: "",
    search: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [c, d] = await Promise.all([fetchCompanies(), fetchDepartments()]);
        setCompanies(Array.isArray(c) ? c : c?.data || []);
        setDepartments(Array.isArray(d) ? d : d?.data || []);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  const loadData = async (type = reportType) => {
    if (!filters.from_date || !filters.to_date) {
      Swal.fire({ icon: "warning", title: "Select date range", text: "From date and To date are required." });
      return;
    }
    setLoading(true);
    try {
      const params = {
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== "" && v != null)),
        report_type: type,
      };
      const data = await shiftHoursReportService.fetch(params);
      setRows(data.data || []);
      setTotals(data.totals || null);
      setReportType(type);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Load failed", text: e.response?.data?.message || e.message });
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    if (!rows.length) return;
    const sheetRows = rows.map((r) => ({
      "Emp No": r.emp_no,
      Name: r.employee_name,
      Company: r.company,
      Department: r.department,
      Date: r.date,
      Shift: `${r.shift_start} - ${r.shift_end}`,
      "In Time": r.in_time,
      "Out Time": r.out_time,
      "Within Shift Hours (HH:MM)": formatHHMM(r.within_shift_hours),
      "Extra Hours (HH:MM)": formatHHMM(r.extra_hours),
      "Total Worked Hours (HH:MM)": formatHHMM(r.total_worked_hours),
    }));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, reportType === "extra" ? "Extra Hours" : "Within Shift");
    XLSX.writeFile(wb, `${reportType === "extra" ? "Extra_Hours" : "Within_Shift_Hours"}_Report.xlsx`);
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shift Hours Reports</h1>
        <p className="text-gray-600 text-sm">
          Within-shift working hours and extra hours after shift end (shown as <span className="font-semibold">HH:MM</span>)
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => loadData("within")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${reportType === "within" ? "bg-blue-600 text-white" : "bg-white border"}`}
        >
          <Timer className="w-4 h-4" /> Within Shift Hours
        </button>
        <button
          onClick={() => loadData("extra")}
          className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${reportType === "extra" ? "bg-indigo-600 text-white" : "bg-white border"}`}
        >
          <Clock3 className="w-4 h-4" /> Extra Hours (After Shift Out)
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border p-4 mb-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <DatePickerInput
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.from_date}
          onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
        />
        <DatePickerInput
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.to_date}
          onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.company_id}
          onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
        >
          <option value="">All companies</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.department_id}
          onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <input
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="Search employee"
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <div className="flex gap-2">
          <button onClick={() => loadData(reportType)} className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold flex items-center justify-center gap-1">
            <Search className="w-4 h-4" /> Load
          </button>
          <button onClick={exportExcel} className="px-3 py-2 bg-green-600 text-white rounded-lg">
            <FileSpreadsheet className="w-4 h-4" />
          </button>
        </div>
      </div>

      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Within Shift Hours (HH:MM)</p>
            <p className="text-xl font-bold text-blue-700 font-mono">{formatHHMM(totals.within_shift_hours)}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Extra Hours (HH:MM)</p>
            <p className="text-xl font-bold text-indigo-700 font-mono">{formatHHMM(totals.extra_hours)}</p>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <p className="text-xs text-gray-500">Records</p>
            <p className="text-xl font-bold text-slate-800">{totals.records}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow border overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-3 text-left">Emp No</th>
              <th className="p-3 text-left">Name</th>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Shift</th>
              <th className="p-3 text-left">In</th>
              <th className="p-3 text-left">Out</th>
              <th className="p-3 text-right">Within (HH:MM)</th>
              <th className="p-3 text-right">Extra (HH:MM)</th>
              <th className="p-3 text-right">Total (HH:MM)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="9" className="p-8 text-center text-gray-500">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan="9" className="p-8 text-center text-gray-500">No data. Select dates and click Load.</td></tr>
            ) : (
              rows.map((r, i) => (
                <tr key={`${r.employee_id}-${r.date}-${i}`} className="border-t hover:bg-slate-50">
                  <td className="p-3 font-mono">{r.emp_no}</td>
                  <td className="p-3">{r.employee_name}</td>
                  <td className="p-3">{r.date}</td>
                  <td className="p-3 font-mono text-xs">{r.shift_start} - {r.shift_end}</td>
                  <td className="p-3 font-mono">{r.in_time}</td>
                  <td className="p-3 font-mono">{r.out_time}</td>
                  <td className="p-3 text-right font-semibold text-blue-700 font-mono">{formatHHMM(r.within_shift_hours)}</td>
                  <td className="p-3 text-right font-semibold text-indigo-700 font-mono">{formatHHMM(r.extra_hours)}</td>
                  <td className="p-3 text-right font-mono">{formatHHMM(r.total_worked_hours)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ShiftHoursReport;
