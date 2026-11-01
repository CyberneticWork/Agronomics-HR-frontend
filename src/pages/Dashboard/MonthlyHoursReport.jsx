import React, { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Search, Clock3, Timer } from "lucide-react";
import Swal from "sweetalert2";
import * as XLSX from "xlsx";
import { fetchCompanies, fetchDepartments } from "@services/ApiDataService";
import monthlyHoursReportService from "@services/monthlyHoursReportService";

const weekdayLetter = (isoDate) => {
  const letters = ["S", "M", "T", "W", "T", "F", "S"];
  return letters[new Date(`${isoDate}T00:00:00`).getDay()];
};

const formatHHMM = (value, zeroDefault = "") => {
  if (value == null || value === "" || value === false) return zeroDefault;
  if (typeof value === "string" && value.includes(":")) {
    const parts = value.trim().split(":");
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      if (h === 0 && m === 0 && zeroDefault !== "00:00") return zeroDefault;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    }
    return value;
  }
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return zeroDefault;
  const hours = Math.floor(num);
  const frac = Math.round((num - hours) * 100);
  let mins = (frac === 15 || frac === 30 || frac === 45) ? frac : Math.round((num - hours) * 60);
  let finalHours = hours;
  if (mins >= 60) {
    finalHours += Math.floor(mins / 60);
    mins = mins % 60;
  }
  return `${String(finalHours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

const MonthlyHoursReport = ({ reportType = "working" }) => {
  const isOt = reportType === "ot";
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [rows, setRows] = useState([]);
  const [dates, setDates] = useState([]);
  const [dayTotals, setDayTotals] = useState({});
  const [grandTotal, setGrandTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    month: currentMonth,
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

  const loadData = async () => {
    if (!filters.month) {
      Swal.fire({ icon: "warning", title: "Select month" });
      return;
    }
    setLoading(true);
    try {
      const params = {
        month: filters.month,
        type: reportType,
        ...Object.fromEntries(
          Object.entries({
            company_id: filters.company_id,
            department_id: filters.department_id,
            search: filters.search,
          }).filter(([, v]) => v !== "" && v != null)
        ),
      };
      const data = await monthlyHoursReportService.fetch(params);
      setRows(data.data || []);
      setDates(data.dates || []);
      setDayTotals(data.day_totals || {});
      setGrandTotal(data.grand_total || 0);
    } catch (e) {
      Swal.fire({ icon: "error", title: "Load failed", text: e.response?.data?.message || e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportType]);

  const title = isOt ? "Monthly OT Hours Report" : "Monthly Working Hours Report";
  const subtitle = isOt
    ? "Company employees down the page, each day of the month across — OT hours (HH:MM)."
    : "Company employees down the page, each day of the month across — working hours (HH:MM).";

  const exportExcel = () => {
    if (!rows.length) {
      Swal.fire({ icon: "info", title: "No data", text: "Load the report before downloading." });
      return;
    }
    const sheetRows = rows.map((r) => {
      const line = {
        "Emp No": r.emp_no,
        Name: r.employee_name,
        Company: r.company,
        Department: r.department,
      };
      dates.forEach((iso) => {
        const day = iso.slice(-2);
        line[day] = formatHHMM(r.days?.[iso], "");
      });
      line["Total (HH:MM)"] = formatHHMM(r.total, "00:00");
      return line;
    });
    const totalLine = { "Emp No": "", Name: "TOTAL", Company: "", Department: "" };
    dates.forEach((iso) => {
      totalLine[iso.slice(-2)] = formatHHMM(dayTotals[iso], "00:00");
    });
    totalLine["Total (HH:MM)"] = formatHHMM(grandTotal, "00:00");
    sheetRows.push(totalLine);

    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isOt ? "OT Hours" : "Working Hours");
    XLSX.writeFile(wb, `${isOt ? "monthly-ot-hours" : "monthly-working-hours"}-${filters.month}.xlsx`);
  };

  const filteredCompanies = useMemo(() => companies, [companies]);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isOt ? "bg-amber-600" : "bg-sky-700"}`}>
            {isOt ? <Timer className="w-6 h-6 text-white" /> : <Clock3 className="w-6 h-6 text-white" />}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="text-gray-600 text-sm">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={exportExcel}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <FileSpreadsheet className="w-4 h-4" /> Download Excel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border p-4 mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <input
          type="month"
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.month}
          onChange={(e) => setFilters({ ...filters, month: e.target.value })}
        />
        <select
          className="border rounded-lg px-3 py-2 text-sm"
          value={filters.company_id}
          onChange={(e) => setFilters({ ...filters, company_id: e.target.value })}
        >
          <option value="">All companies</option>
          {filteredCompanies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_code ? `${c.company_code} - ${c.name}` : c.name}
            </option>
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
          placeholder="Search employee..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
        />
        <button
          onClick={loadData}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" /> View
        </button>
      </div>

      <div className="bg-white rounded-xl shadow border overflow-auto max-h-[75vh]">
        <table className="min-w-max text-xs">
          <thead className="bg-slate-800 text-white sticky top-0 z-20">
            <tr>
              <th className="p-2 text-left sticky left-0 bg-slate-800 z-30 min-w-[72px]">Emp No</th>
              <th className="p-2 text-left sticky left-[72px] bg-slate-800 z-30 min-w-[160px]">Employee</th>
              <th className="p-2 text-left min-w-[120px]">Company</th>
              {dates.map((iso) => (
                <th key={iso} className="p-1 text-center min-w-[42px] leading-tight">
                  <div>{iso.slice(-2)}</div>
                  <div className="text-[10px] font-normal text-slate-300">{weekdayLetter(iso)}</div>
                </th>
              ))}
              <th className="p-2 text-center min-w-[56px] bg-slate-900">Total (HH:MM)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={dates.length + 4} className="p-6 text-center text-gray-500">Loading...</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={dates.length + 4} className="p-6 text-center text-gray-500">
                  No employees for this filter. Select a company and month, then View.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.employee_id} className="border-t hover:bg-slate-50">
                  <td className="p-2 sticky left-0 bg-white z-10 font-medium">{r.emp_no}</td>
                  <td className="p-2 sticky left-[72px] bg-white z-10 whitespace-nowrap">{r.employee_name}</td>
                  <td className="p-2 whitespace-nowrap">{r.company_code || r.company}</td>
                  {dates.map((iso) => (
                    <td key={iso} className="p-1 text-center tabular-nums">
                      {formatHHMM(r.days?.[iso], "")}
                    </td>
                  ))}
                  <td className="p-2 text-center font-semibold bg-slate-50 tabular-nums">
                    {formatHHMM(r.total, "00:00")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="sticky bottom-0 bg-slate-100 font-semibold">
              <tr>
                <td className="p-2 sticky left-0 bg-slate-100 z-10" colSpan={2}>Total</td>
                <td className="p-2" />
                {dates.map((iso) => (
                  <td key={iso} className="p-1 text-center tabular-nums">{formatHHMM(dayTotals[iso], "00:00")}</td>
                ))}
                <td className="p-2 text-center tabular-nums">{formatHHMM(grandTotal, "00:00")}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default MonthlyHoursReport;
