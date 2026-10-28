import React, { useState, useEffect } from "react";
import {
  Calendar,
  Search,
  Trash2,
  Printer,
  Clock,
  User,
  DollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import axios from "@utils/axios";
import { fetchCompanies as fetchCompaniesApi } from "@services/ApiDataService";
import { format, parseISO } from "date-fns";
import Swal from "sweetalert2";
import NoPayService from "@services/Nopayservice";
import DatePickerInput from "@components/DatePickerInput";

const NoPayManagement = () => {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedCompany, setSelectedCompany] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [noPayRecords, setNoPayRecords] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMonth, setIsGeneratingMonth] = useState(false);

  const [selectedRecords, setSelectedRecords] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  const [stats, setStats] = useState({
    totalRecords: 0,
    totalDays: 0,
    affectedEmployees: 0,
    totalAmount: 0,
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const fetchCompanies = async () => {
    try {
      const data = await fetchCompaniesApi();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const formatNoPayDisplay = (record) => {
    if (record.display_value) return record.display_value;

    if (record.type === "FULL_DAY" || Number(record.no_pay_count) === 1) {
      return "Full Day";
    }

    const hours = Number(record.hours || 0);
    const minutes = Number(record.minutes || 0);

    if (hours > 0 && minutes > 0) return `${hours} Hours ${minutes} Minutes`;
    if (hours > 0) return `${hours} Hours`;
    if (minutes > 0) return `${minutes} Minutes`;

    return record.no_pay_count;
  };

  const getSelectedMonthNumber = () => {
    if (!month) return null;
    const m = months.indexOf(month) + 1;
    return m >= 1 && m <= 12 ? m : null;
  };

  const fetchNoPayRecords = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        per_page: recordsPerPage,
      };

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) params.company_id = companyId;
      }

      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }

      if (selectedDate) {
        params.date = selectedDate;
      } else {
        const m = getSelectedMonthNumber();
        if (m) params.month = m;
        if (year) params.year = year;
      }

      const response = await NoPayService.getAllRecords(params);

      const rawItems = response?.data ?? [];
      const items = Array.isArray(rawItems)
        ? rawItems.filter((r) => r.active_nopay !== false && r.employee?.compensation?.active_nopay !== false)
        : [];
      setNoPayRecords(items);

      setTotalRecords(
        response?.total ??
        response?.meta?.total ??
        items.length
      );

      setSelectedRecords([]);
      setSelectAll(false);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch no-pay records",
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) params.company_id = companyId;
      }

      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }

      if (selectedDate) {
        params.date = selectedDate;
      } else {
        const m = getSelectedMonthNumber();
        if (m) params.month = m;
        if (year) params.year = year;
      }

      const data = await NoPayService.getStats(params);

      setStats({
        totalRecords: data.total_records ?? 0,
        totalDays: data.total_days ?? 0,
        affectedEmployees: data.affected_employees ?? 0,
        totalAmount: data.total_amount ?? 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchNoPayRecords();
    fetchStats();
  }, [month, year, currentPage, recordsPerPage, selectedCompany, selectedDate, debouncedSearchTerm]);


  const handleSelectRecord = (id) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((recordId) => recordId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(noPayRecords.map((record) => record.id));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedRecords.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No records selected",
        text: "Please select at least one record to update",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Update Status?",
      text: `This will update ${selectedRecords.length} records to ${status}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Update",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        const response = await NoPayService.bulkUpdateStatus(selectedRecords, status);

        Swal.fire({
          icon: "success",
          title: "Success!",
          text: response.message,
          confirmButtonColor: "#3b82f6",
        });

        fetchNoPayRecords();
        fetchStats();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to update records",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No records selected",
        text: "Please select at least one record to delete",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Delete Records?",
      text: `This will permanently delete ${selectedRecords.length} records`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        const response = await axios.delete("/no-pay-records/bulk-delete", {
          data: { ids: selectedRecords },
        });

        Swal.fire({
          icon: "success",
          title: "Success!",
          text: response.data.message,
          confirmButtonColor: "#3b82f6",
        });

        fetchNoPayRecords();
        fetchStats();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to delete records",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  const handleRemoveRecord = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/no-pay-records/${id}`);
        setNoPayRecords((prev) => prev.filter((r) => r.id !== id));

        Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Record has been deleted.",
          confirmButtonColor: "#3b82f6",
        });

        fetchStats();
      } catch {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to delete record",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  const showGenerateResult = async (response) => {
    const generatedCount = response?.data?.records?.length ?? 0;
    const skippedCount = response?.data?.skipped?.length ?? 0;

    let html = `
      <div style="text-align:left">
        <p><strong>Generated Records:</strong> ${generatedCount}</p>
        <p><strong>Skipped Employees:</strong> ${skippedCount}</p>
    `;

    if (skippedCount > 0) {
      html += `<div style="max-height:250px; overflow:auto; margin-top:10px;">`;
      html += `<table style="width:100%; border-collapse:collapse;">`;
      html += `
        <thead>
          <tr>
            <th style="border:1px solid #ddd; padding:6px;">Employee ID</th>
            <th style="border:1px solid #ddd; padding:6px;">Reason</th>
          </tr>
        </thead>
        <tbody>
      `;

      response.data.skipped.slice(0, 100).forEach((item) => {
        html += `
          <tr>
            <td style="border:1px solid #ddd; padding:6px;">
            ${item.attendance_employee_no ?? item.employee_id ?? "-"}
            </td>
            <td style="border:1px solid #ddd; padding:6px;">${item.reason ?? "-"}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    }

    html += `</div>`;

    await Swal.fire({
      icon: "success",
      title: response?.data?.message || "Generation completed",
      html,
      width: 850,
      confirmButtonColor: "#3b82f6",
    });
  };

  const handleGenerateNoPay = async () => {
    if (!selectedDate) {
      Swal.fire({
        icon: "warning",
        title: "Select a Date",
        text: "Please select a date to generate records",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Generate No-Pay Records?",
      text: `This will generate records for ${format(new Date(selectedDate), "MMMM d, yyyy")}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Generate",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsGenerating(true);

    try {
      const payload = { date: selectedDate };

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) payload.company_id = companyId;
      }

      const response = await axios.post("/no-pay-records/generate", payload);

      await showGenerateResult(response);
      fetchNoPayRecords();
      fetchStats();
    } catch (error) {
      if (error.response && error.response.status === 422) {
        const errors = error.response.data.errors || error.response.data;
        let errorMessage = "Invalid date selection.";

        if (errors.date && errors.date.length > 0) {
          errorMessage = errors.date[0];
        }

        Swal.fire({
          icon: "warning",
          title: "Invalid Date",
          text: errorMessage,
          confirmButtonColor: "#f59e0b",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to generate no-pay records",
          confirmButtonColor: "#3b82f6",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // මින් පෙර හැංගිලා (comment) තිබුණු Monthly Generate ෆන්ක්ෂන් එක
  const handleGenerateMonthlyNoPay = async () => {
    const monthNumber = getSelectedMonthNumber();

    if (!monthNumber || !year) {
      Swal.fire({
        icon: "warning",
        title: "Select Month and Year",
        text: "Please select both month and year to generate monthly records",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Generate Monthly No-Pay?",
      text: `This will generate records for ${month} ${year}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Generate Month",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsGeneratingMonth(true);

    try {
      const payload = {
        month: monthNumber,
        year,
      };

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) payload.company_id = companyId;
      }

      const response = await axios.post("/no-pay-records/generate-monthly", payload);

      await showGenerateResult(response);
      fetchNoPayRecords();
      fetchStats();
    } catch (error) {
      if (error.response && error.response.status === 422) {
        const errors = error.response.data.errors || error.response.data;
        let errorMessage = "Invalid selection.";

        if (errors.month && errors.month.length > 0) {
          errorMessage = errors.month[0];
        } else if (errors.date && errors.date.length > 0) {
          errorMessage = errors.date[0];
        } else {
          const firstErrorKey = Object.keys(errors)[0];
          if (firstErrorKey) {
            errorMessage = Array.isArray(errors[firstErrorKey])
              ? errors[firstErrorKey][0]
              : errors[firstErrorKey];
          }
        }

        Swal.fire({
          icon: "warning",
          title: "Cannot Generate",
          text: errorMessage,
          confirmButtonColor: "#f59e0b",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to generate monthly no-pay records",
          confirmButtonColor: "#3b82f6",
        });
      }
    } finally {
      setIsGeneratingMonth(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "height=600,width=900");
    const currentDate = new Date().toLocaleString();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>No Pay Days Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .report-header { text-align: center; margin-bottom: 20px; }
            .report-header h1 { margin-bottom: 5px; }
            .report-meta { font-size: 14px; margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .report-footer { margin-top: 30px; font-size: 12px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>No Pay Days Report</h1>
            <p>Generated on: ${currentDate}</p>
          </div>

          <div class="report-meta">
            ${selectedDate ? `<strong>Date:</strong> ${selectedDate} | ` : ""}
            ${month ? `<strong>Month:</strong> ${month} ${year} | ` : ""}
            ${selectedCompany ? `<strong>Company ID:</strong> ${selectedCompany} | ` : ""}
            ${searchTerm ? `<strong>Search:</strong> ${searchTerm} | ` : ""}
            <strong>Total Records:</strong> ${noPayRecords.length}
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Emp No</th>
                <th>Name</th>
                <th>No Pay Count</th>
                <th>No-Pay Amount (Rs.)</th>
                <th>Type & Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${noPayRecords.map((record) => `
                <tr>
                  <td>
                    ${format(parseISO(record.date), "MMM dd, yyyy")}
                    <br/>
                    <small>${record.type !== 'FULL_DAY' && record.start_time ? `${record.start_time} - ${record.end_time}` : ""}</small>
                  </td>
                  <td>${record.employee?.attendance_employee_no || "N/A"}</td>
                  <td>${record.employee?.full_name || "N/A"}</td>
                  <td>${formatNoPayDisplay(record)}</td>
                  <td>Rs. ${Number(record.no_pay_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td>
                    <strong>${record.type === 'LATE_IN' ? 'Late In' : record.type === 'EARLY_OUT' ? 'Early Out' : 'Full Day'}</strong>
                    <br/>
                    ${record.description || ""}
                  </td>
                  <td>${record.status || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="report-footer">
            <p>HR System - Cybernetic Software Solutions</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
              NoPay Management
            </h1>
            <p className="text-slate-300 text-center mt-2 text-sm sm:text-base">
              Manage employee no pay records and absences
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {selectedRecords.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-blue-800 font-medium">
                  {selectedRecords.length} record(s) selected
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBulkStatusUpdate("Approved")}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Approve Selected
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate("Rejected")}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reject Selected
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Month</label>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setSelectedDate("");
                    setCurrentPage(1);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                >
                  <option value="">All Months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Year</label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(parseInt(e.target.value, 10));
                    setSelectedDate("");
                    setCurrentPage(1);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Date (Filter + Daily Generate)
                </label>
                <div className="flex gap-2">
                  <DatePickerInput
                    value={selectedDate || ""}
                    onChange={(e) => {
                      setSelectedDate(e.target.value || "");
                      setCurrentPage(1);
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate("");
                      setCurrentPage(1);
                    }}
                    className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl"
                    title="Clear date"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  If you select a date, the table will only be for that date. If you clear it, you will see Month/Year records.
                </p>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateNoPay}
                  disabled={isGenerating || !selectedDate}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  Daily Generate
                </button>
              </div>
            </div>

            {/* අලුතින් Activate කරපු Monthly Generate Button එක */}
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={handleGenerateMonthlyNoPay}
                disabled={isGeneratingMonth || !month || !year}
                className="px-5 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingMonth ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <Calendar className="w-5 h-5" />
                )}
                Generate Full Month
              </button>

              <div className="text-sm text-gray-500 flex items-center">
                Month/Year view shows saved records. Monthly generate button will create missing records for the whole month.
              </div>
            </div>
            {/*---*/}
            <div className="relative flex-grow mb-6">
              <input
                type="text"
                placeholder="Search by employee number, name or description..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-3 pl-10 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-200"
              />
              <Search className="absolute left-3 top-3.5 text-gray-400" />
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-6">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="mt-2">Loading records...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emp No</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Pay Count</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No-Pay Amount</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type & Description</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200">
                        {noPayRecords.length > 0 ? (
                          noPayRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedRecords.includes(record.id)}
                                  onChange={() => handleSelectRecord(record.id)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">
                                    {format(parseISO(record.date), "MMM dd, yyyy")}
                                  </span>
                                  {record.start_time && record.end_time && record.type !== 'FULL_DAY' && (
                                    <span className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {record.start_time} - {record.end_time}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {record.employee?.attendance_employee_no || "N/A"}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {record.employee?.full_name || "N/A"}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                {formatNoPayDisplay(record)}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-rose-600">
                                {record.no_pay_amount != null
                                  ? `Rs. ${Number(record.no_pay_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                  : "-"}
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col items-start gap-1">
                                  {record.type === 'LATE_IN' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                      Late In
                                    </span>
                                  )}
                                  {record.type === 'EARLY_OUT' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                      Early Out
                                    </span>
                                  )}
                                  {record.type === 'FULL_DAY' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                      Full Day
                                    </span>
                                  )}
                                  <span className="text-sm text-gray-700 max-w-xs truncate" title={record.description}>
                                    {record.description}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <select
                                  value={record.status}
                                  onChange={async (e) => {
                                    try {
                                      await NoPayService.updateStatus(record.id, e.target.value);
                                      fetchNoPayRecords();
                                      fetchStats();
                                    } catch {
                                      Swal.fire({
                                        icon: "error",
                                        title: "Error",
                                        text: "Failed to update status",
                                        confirmButtonColor: "#3b82f6",
                                      });
                                    }
                                  }}
                                  className={`px-2 py-1 text-xs rounded-full focus:outline-none ${record.status === "Approved"
                                    ? "bg-green-100 text-green-800 border-green-200 border"
                                    : record.status === "Rejected"
                                      ? "bg-red-100 text-red-800 border-red-200 border"
                                      : "bg-yellow-100 text-yellow-800 border-yellow-200 border"
                                    }`}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-center flex justify-center gap-2">
                                <button
                                  onClick={() => handleRemoveRecord(record.id)}
                                  className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" className="px-6 py-16 text-center text-gray-500">
                              No records found. Adjust your filters or generate records.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalRecords > recordsPerPage && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                      <div className="text-sm text-gray-700">
                        Showing{" "}
                        <span className="font-medium">{(currentPage - 1) * recordsPerPage + 1}</span>{" "}
                        to{" "}
                        <span className="font-medium">
                          {Math.min(currentPage * recordsPerPage, totalRecords)}
                        </span>{" "}
                        of <span className="font-medium">{totalRecords}</span> records
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded-md flex items-center gap-1 disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                          <button
                            key={number}
                            onClick={() => paginate(number)}
                            className={`px-3 py-1 rounded-md ${currentPage === number
                              ? "bg-blue-500 text-white"
                              : "border border-gray-300 hover:bg-gray-50"
                              }`}
                          >
                            {number}
                          </button>
                        ))}

                        <button
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 border border-gray-300 rounded-md flex items-center gap-1 disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <button
                onClick={handlePrint}
                className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>

              <button
                onClick={() => {
                  fetchNoPayRecords();
                  fetchStats();
                }}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total No Pay Records</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total No Pay Days</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Affected Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.affectedEmployees}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Deduction</p>
                <p className="text-2xl font-bold text-rose-600">
                  Rs. {Number(stats.totalAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="p-3 bg-rose-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-rose-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoPayManagement;


/*
import React, { useState, useEffect } from "react";
import {
  Calendar,
  Search,
  Trash2,
  Printer,
  Clock,
  User,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
} from "lucide-react";
import axios from "@utils/axios";
import { fetchCompanies as fetchCompaniesApi } from "@services/ApiDataService";
import { format, parseISO } from "date-fns";
import Swal from "sweetalert2";
import NoPayService from "@services/Nopayservice";

const NoPayManagement = () => {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedCompany, setSelectedCompany] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [noPayRecords, setNoPayRecords] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingMonth, setIsGeneratingMonth] = useState(false);

  const [selectedRecords, setSelectedRecords] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);

  const [stats, setStats] = useState({
    totalRecords: 0,
    totalDays: 0,
    affectedEmployees: 0,
  });

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  const fetchCompanies = async () => {
    try {
      const data = await fetchCompaniesApi();
      setCompanies(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const formatNoPayDisplay = (record) => {
    if (record.display_value) return record.display_value;

    if (record.type === "FULL_DAY" || Number(record.no_pay_count) === 1) {
      return "Full Day";
    }

    const hours = Number(record.hours || 0);
    const minutes = Number(record.minutes || 0);

    if (hours > 0 && minutes > 0) return `${hours} Hours ${minutes} Minutes`;
    if (hours > 0) return `${hours} Hours`;
    if (minutes > 0) return `${minutes} Minutes`;

    return record.no_pay_count;
  };

  const getSelectedMonthNumber = () => {
    if (!month) return null;
    const m = months.indexOf(month) + 1;
    return m >= 1 && m <= 12 ? m : null;
  };

  const fetchNoPayRecords = async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        per_page: recordsPerPage,
      };

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) params.company_id = companyId;
      }

      if (searchTerm) params.search = searchTerm;

      if (selectedDate) {
        params.date = selectedDate;
      } else {
        const m = getSelectedMonthNumber();
        if (m) params.month = m;
        if (year) params.year = year;
      }

      const response = await NoPayService.getAllRecords(params);

      const items = response?.data ?? [];
      setNoPayRecords(Array.isArray(items) ? items : []);

      setTotalRecords(
        response?.total ??
        response?.meta?.total ??
        (Array.isArray(items) ? items.length : 0)
      );

      setSelectedRecords([]);
      setSelectAll(false);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to fetch no-pay records",
        confirmButtonColor: "#3b82f6",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) params.company_id = companyId;
      }

      if (selectedDate) {
        params.date = selectedDate;
      } else {
        const m = getSelectedMonthNumber();
        if (m) params.month = m;
        if (year) params.year = year;
      }

      const data = await NoPayService.getStats(params);

      setStats({
        totalRecords: data.total_records ?? 0,
        totalDays: data.total_days ?? 0,
        affectedEmployees: data.affected_employees ?? 0,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    fetchNoPayRecords();
  }, [month, year, currentPage, recordsPerPage, selectedCompany, searchTerm, selectedDate]);

  useEffect(() => {
    fetchStats();
  }, [month, year, selectedCompany, selectedDate]);

  const handleSelectRecord = (id) => {
    setSelectedRecords((prev) =>
      prev.includes(id) ? prev.filter((recordId) => recordId !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRecords([]);
    } else {
      setSelectedRecords(noPayRecords.map((record) => record.id));
    }
    setSelectAll(!selectAll);
  };

  const handleBulkStatusUpdate = async (status) => {
    if (selectedRecords.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No records selected",
        text: "Please select at least one record to update",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Update Status?",
      text: `This will update ${selectedRecords.length} records to ${status}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Update",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        const response = await NoPayService.bulkUpdateStatus(selectedRecords, status);

        Swal.fire({
          icon: "success",
          title: "Success!",
          text: response.message,
          confirmButtonColor: "#3b82f6",
        });

        fetchNoPayRecords();
        fetchStats();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to update records",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.length === 0) {
      Swal.fire({
        icon: "warning",
        title: "No records selected",
        text: "Please select at least one record to delete",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Delete Records?",
      text: `This will permanently delete ${selectedRecords.length} records`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });

    if (result.isConfirmed) {
      try {
        const response = await axios.delete("/no-pay-records/bulk-delete", {
          data: { ids: selectedRecords },
        });

        Swal.fire({
          icon: "success",
          title: "Success!",
          text: response.data.message,
          confirmButtonColor: "#3b82f6",
        });

        fetchNoPayRecords();
        fetchStats();
      } catch (error) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to delete records",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  const handleRemoveRecord = async (id) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#ef4444",
      confirmButtonText: "Yes, delete it!",
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/no-pay-records/${id}`);
        setNoPayRecords((prev) => prev.filter((r) => r.id !== id));

        Swal.fire({
          icon: "success",
          title: "Deleted!",
          text: "Record has been deleted.",
          confirmButtonColor: "#3b82f6",
        });

        fetchStats();
      } catch {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to delete record",
          confirmButtonColor: "#3b82f6",
        });
      }
    }
  };

  const showGenerateResult = async (response) => {
    const generatedCount = response?.data?.records?.length ?? 0;
    const skippedCount = response?.data?.skipped?.length ?? 0;

    let html = `
      <div style="text-align:left">
        <p><strong>Generated Records:</strong> ${generatedCount}</p>
        <p><strong>Skipped Employees:</strong> ${skippedCount}</p>
    `;

    if (skippedCount > 0) {
      html += `<div style="max-height:250px; overflow:auto; margin-top:10px;">`;
      html += `<table style="width:100%; border-collapse:collapse;">`;
      html += `
        <thead>
          <tr>
            <th style="border:1px solid #ddd; padding:6px;">Employee ID</th>
            <th style="border:1px solid #ddd; padding:6px;">Reason</th>
          </tr>
        </thead>
        <tbody>
      `;

      response.data.skipped.slice(0, 100).forEach((item) => {
        html += `
          <tr>
            <td style="border:1px solid #ddd; padding:6px;">
            ${item.attendance_employee_no ?? item.employee_id ?? "-"}
            </td>
            <td style="border:1px solid #ddd; padding:6px;">${item.reason ?? "-"}</td>
          </tr>
        `;
      });

      html += `</tbody></table></div>`;
    }

    html += `</div>`;

    await Swal.fire({
      icon: "success",
      title: response?.data?.message || "Generation completed",
      html,
      width: 850,
      confirmButtonColor: "#3b82f6",
    });
  };

  const handleGenerateNoPay = async () => {
    if (!selectedDate) {
      Swal.fire({
        icon: "warning",
        title: "Select a Date",
        text: "Please select a date to generate records",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Generate No-Pay Records?",
      text: `This will generate records for ${format(new Date(selectedDate), "MMMM d, yyyy")}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Generate",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsGenerating(true);

    try {
      const payload = { date: selectedDate };

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) payload.company_id = companyId;
      }

      const response = await axios.post("/no-pay-records/generate", payload);

      await showGenerateResult(response);
      fetchNoPayRecords();
      fetchStats();
    } catch (error) {
      // මෙතන තමයි Daily Generate එකේ Error එක අල්ලන තැන 
      if (error.response && error.response.status === 422) {
        const errors = error.response.data.errors || error.response.data;
        let errorMessage = "Invalid date selection.";

        if (errors.date && errors.date.length > 0) {
          errorMessage = errors.date[0];
        }

        Swal.fire({
          icon: "warning",
          title: "Invalid Date",
          text: errorMessage,
          confirmButtonColor: "#f59e0b",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to generate no-pay records",
          confirmButtonColor: "#3b82f6",
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMonthlyNoPay = async () => {
    const monthNumber = getSelectedMonthNumber();

    if (!monthNumber || !year) {
      Swal.fire({
        icon: "warning",
        title: "Select Month and Year",
        text: "Please select both month and year to generate monthly records",
        confirmButtonColor: "#3b82f6",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Generate Monthly No-Pay?",
      text: `This will generate records for ${month} ${year}`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "Generate Month",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    setIsGeneratingMonth(true);

    try {
      const payload = {
        month: monthNumber,
        year,
      };

      if (selectedCompany !== "" && selectedCompany !== null && selectedCompany !== undefined) {
        const companyId = Number(selectedCompany);
        if (!Number.isNaN(companyId)) payload.company_id = companyId;
      }

      const response = await axios.post("/no-pay-records/generate-monthly", payload);

      await showGenerateResult(response);
      fetchNoPayRecords();
      fetchStats();
    } catch (error) {
      // මෙතන තමයි Monthly Generate එකේ Error එක අල්ලන තැන 
      if (error.response && error.response.status === 422) {
        const errors = error.response.data.errors || error.response.data;
        let errorMessage = "Invalid selection.";

        if (errors.month && errors.month.length > 0) {
          errorMessage = errors.month[0];
        } else if (errors.date && errors.date.length > 0) {
          errorMessage = errors.date[0];
        } else {
          const firstErrorKey = Object.keys(errors)[0];
          if (firstErrorKey) {
            errorMessage = Array.isArray(errors[firstErrorKey]) 
                            ? errors[firstErrorKey][0] 
                            : errors[firstErrorKey];
          }
        }

        Swal.fire({
          icon: "warning",
          title: "Cannot Generate",
          text: errorMessage,
          confirmButtonColor: "#f59e0b",
        });
      } else {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: error.response?.data?.message || "Failed to generate monthly no-pay records",
          confirmButtonColor: "#3b82f6",
        });
      }
    } finally {
      setIsGeneratingMonth(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "height=600,width=900");
    const currentDate = new Date().toLocaleString();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>No Pay Days Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .report-header { text-align: center; margin-bottom: 20px; }
            .report-header h1 { margin-bottom: 5px; }
            .report-meta { font-size: 14px; margin-bottom: 20px; color: #666; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .report-footer { margin-top: 30px; font-size: 12px; text-align: center; color: #666; }
          </style>
        </head>
        <body>
          <div class="report-header">
            <h1>No Pay Days Report</h1>
            <p>Generated on: ${currentDate}</p>
          </div>

          <div class="report-meta">
            ${selectedDate ? `<strong>Date:</strong> ${selectedDate} | ` : ""}
            ${month ? `<strong>Month:</strong> ${month} ${year} | ` : ""}
            ${selectedCompany ? `<strong>Company ID:</strong> ${selectedCompany} | ` : ""}
            <strong>Total Records:</strong> ${noPayRecords.length}
          </div>

          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Emp No</th>
                <th>Name</th>
                <th>No Pay Count</th>
                <th>Type & Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${noPayRecords.map((record) => `
                <tr>
                  <td>
                    ${format(parseISO(record.date), "MMM dd, yyyy")}
                    <br/>
                    <small>${record.type !== 'FULL_DAY' && record.start_time ? `${record.start_time} - ${record.end_time}` : ""}</small>
                  </td>
                  <td>${record.employee?.attendance_employee_no || "N/A"}</td>
                  <td>${record.employee?.full_name || "N/A"}</td>
                  <td>${formatNoPayDisplay(record)}</td>
                  <td>
                    <strong>${record.type === 'LATE_IN' ? 'Late In' : record.type === 'EARLY_OUT' ? 'Early Out' : 'Full Day'}</strong>
                    <br/>
                    ${record.description || ""}
                  </td>
                  <td>${record.status || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="report-footer">
            <p>HR System - Cybernetic Software Solutions</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const paginate = (pageNumber) => setCurrentPage(pageNumber);
  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
              NoPay Management
            </h1>
            <p className="text-slate-300 text-center mt-2 text-sm sm:text-base">
              Manage employee no pay records and absences
            </p>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {selectedRecords.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
                <div className="text-blue-800 font-medium">
                  {selectedRecords.length} record(s) selected
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleBulkStatusUpdate("Approved")}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Approve Selected
                  </button>
                  <button
                    onClick={() => handleBulkStatusUpdate("Rejected")}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Reject Selected
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Company</label>
                <select
                  value={selectedCompany}
                  onChange={(e) => {
                    setSelectedCompany(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Month</label>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(e.target.value);
                    setSelectedDate("");
                    setCurrentPage(1);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                >
                  <option value="">All Months</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Year</label>
                <select
                  value={year}
                  onChange={(e) => {
                    setYear(parseInt(e.target.value, 10));
                    setSelectedDate("");
                    setCurrentPage(1);
                  }}
                  className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Date (Filter + Daily Generate)
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={selectedDate || ""}
                    onChange={(e) => {
                      setSelectedDate(e.target.value || "");
                      setCurrentPage(1);
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate("");
                      setCurrentPage(1);
                    }}
                    className="px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-xl"
                    title="Clear date"
                  >
                    Clear
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  If you select a date, the table will only be for that date. If you clear it, you will see Month/Year records.
                </p>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleGenerateNoPay}
                  disabled={isGenerating || !selectedDate}
                  className="w-full px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-5 h-5" />
                  )}
                  Daily Generate
                </button>
              </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-3">
           
            </div>

            <div className="relative flex-grow mb-6">
              <input
                type="text"
                placeholder="Search by employee number, name or description..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full p-3 pl-10 border-2 border-gray-300 rounded-xl"
              />
              <Search className="absolute left-3 top-3.5 text-gray-400" />
            </div>

            <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden mb-6">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
                  <p className="mt-2">Loading records...</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                            />
                          </th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Emp No</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">No Pay Count</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type & Description</th>
                          <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-gray-200">
                        {noPayRecords.length > 0 ? (
                          noPayRecords.map((record) => (
                            <tr key={record.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <input
                                  type="checkbox"
                                  checked={selectedRecords.includes(record.id)}
                                  onChange={() => handleSelectRecord(record.id)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                                />
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col">
                                  <span className="font-medium text-gray-900">
                                    {format(parseISO(record.date), "MMM dd, yyyy")}
                                  </span>
                                  {record.start_time && record.end_time && record.type !== 'FULL_DAY' && (
                                    <span className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {record.start_time} - {record.end_time}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {record.employee?.attendance_employee_no || "N/A"}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                {record.employee?.full_name || "N/A"}
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-medium">
                                {formatNoPayDisplay(record)}
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col items-start gap-1">
                                  {record.type === 'LATE_IN' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                      Late In
                                    </span>
                                  )}
                                  {record.type === 'EARLY_OUT' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                      Early Out
                                    </span>
                                  )}
                                  {record.type === 'FULL_DAY' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                      Full Day
                                    </span>
                                  )}
                                  <span className="text-sm text-gray-700 max-w-xs truncate" title={record.description}>
                                    {record.description}
                                  </span>
                                </div>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap">
                                <select
                                  value={record.status}
                                  onChange={async (e) => {
                                    try {
                                      await NoPayService.updateStatus(record.id, e.target.value);
                                      fetchNoPayRecords();
                                      fetchStats();
                                    } catch {
                                      Swal.fire({
                                        icon: "error",
                                        title: "Error",
                                        text: "Failed to update status",
                                        confirmButtonColor: "#3b82f6",
                                      });
                                    }
                                  }}
                                  className={`px-2 py-1 text-xs rounded-full focus:outline-none ${
                                    record.status === "Approved"
                                      ? "bg-green-100 text-green-800 border-green-200 border"
                                      : record.status === "Rejected"
                                      ? "bg-red-100 text-red-800 border-red-200 border"
                                      : "bg-yellow-100 text-yellow-800 border-yellow-200 border"
                                  }`}
                                >
                                  <option value="Pending">Pending</option>
                                  <option value="Approved">Approved</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>

                              <td className="px-6 py-4 whitespace-nowrap text-center flex justify-center gap-2">
                                <button
                                  onClick={() => handleRemoveRecord(record.id)}
                                  className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-full"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" className="px-6 py-16 text-center text-gray-500">
                              No records found. Adjust your filters or generate records.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalRecords > recordsPerPage && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                      <div className="text-sm text-gray-700">
                        Showing{" "}
                        <span className="font-medium">{(currentPage - 1) * recordsPerPage + 1}</span>{" "}
                        to{" "}
                        <span className="font-medium">
                          {Math.min(currentPage * recordsPerPage, totalRecords)}
                        </span>{" "}
                        of <span className="font-medium">{totalRecords}</span> records
                      </div>

                      <div className="flex space-x-2">
                        <button
                          onClick={() => paginate(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1 border border-gray-300 rounded-md flex items-center gap-1 disabled:opacity-50"
                        >
                          <ChevronLeft className="w-4 h-4" />
                          Previous
                        </button>

                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                          <button
                            key={number}
                            onClick={() => paginate(number)}
                            className={`px-3 py-1 rounded-md ${
                              currentPage === number
                                ? "bg-blue-500 text-white"
                                : "border border-gray-300 hover:bg-gray-50"
                            }`}
                          >
                            {number}
                          </button>
                        ))}

                        <button
                          onClick={() => paginate(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 border border-gray-300 rounded-md flex items-center gap-1 disabled:opacity-50"
                        >
                          Next
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-4">
              <button
                onClick={handlePrint}
                className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>

              <button
                onClick={() => {
                  fetchNoPayRecords();
                  fetchStats();
                }}
                className="px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total No Pay Records</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalRecords}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-xl">
                <Clock className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total No Pay Days</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalDays}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-xl">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Affected Employees</p>
                <p className="text-2xl font-bold text-gray-900">{stats.affectedEmployees}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <User className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoPayManagement;

*/

