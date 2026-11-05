import React, { useState, useEffect } from "react";
import { fetchLoans, updateLoan, fetchLoanReport, requestLoanSkip, decideLoanSkip } from "@services/LoanService";
import { exportLoanReportCSV, exportLoanReportPDF } from "@utils/loanReportExport";
import Swal from "sweetalert2";
import {
  Search,
  FileText,
  Download,
  Filter,
  Eye,
  Pencil,
  Briefcase,
  Calendar,
  DollarSign,
  Percent,
} from "lucide-react";

const paySourceLabel = (from) => (String(from || "").toLowerCase() === "basic" ? "Basic" : "Monthly Bonus");

const loanDeductSummary = (loan) => {
  const legacy = loan?.deduct_from === "basic" ? "basic" : "bonus";
  const inst = loan?.installment_deduct_from || legacy;
  const interest = loan?.interest_deduct_from || inst;
  if (inst === interest) return `Installment and interest from ${paySourceLabel(inst)}`;
  return `Installment from ${paySourceLabel(inst)}, interest from ${paySourceLabel(interest)}`;
};

const ViewLoans = () => {
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchFilter, setSearchFilter] = useState("all");
  const [filteredLoans, setFilteredLoans] = useState([]);
  const [showDetails, setShowDetails] = useState(null);
  const [editLoan, setEditLoan] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-LK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const getScheduleRows = (loan) => {
    if (!loan) return [];
    const s = loan.schedule;
    if (typeof s === "string") {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(s) ? s : [];
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  useEffect(() => {
    const loadLoans = async () => {
      setIsLoading(true);
      try {
        const data = await fetchLoans();
        setLoans(data);
        setFilteredLoans(data);
      } catch (err) {
        setError("Failed to load loan data. Please try again later.");
        console.error("Error loading loans:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLoans();
  }, []);

  // Filter logic updated to use attendance_employee_no
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredLoans(loans);
      return;
    }

    const filtered = loans.filter((loan) => {
      const term = searchTerm.toLowerCase();
      // Backend à¶‘à¶šà·™à¶±à·Š à¶‘à¶± employee object à¶‘à¶šà·™à¶±à·Š à¶…à¶‚à¶šà¶º à¶½à¶¶à· à¶œà·à¶±à·“à¶¸
      const empNo = loan.employee?.attendance_employee_no?.toLowerCase() || "";
      const empName = loan.employee?.full_name?.toLowerCase() || "";
      const loanId = loan.loan_id?.toLowerCase() || "";

      if (searchFilter === "all") {
        return loanId.includes(term) || empNo.includes(term) || empName.includes(term);
      } else if (searchFilter === "loan_id") {
        return loanId.includes(term);
      } else if (searchFilter === "employee_id") {
        return empNo.includes(term) || empName.includes(term);
      }
      return true;
    });

    setFilteredLoans(filtered);
  }, [searchTerm, searchFilter, loans]);

  const showLoanDetails = (loan) => {
    setShowDetails(loan);
  };

  const [reportLoading, setReportLoading] = useState(false);

  const statusBadge = (status) => {
    const styles = {
      paid: "bg-green-100 text-green-800",
      pending: "bg-amber-100 text-amber-800",
      overdue: "bg-red-100 text-red-800",
      pending_approval: "bg-orange-100 text-orange-800",
      approved_deferred: "bg-blue-100 text-blue-800",
      rejected: "bg-rose-100 text-rose-800",
    };
    const labels = {
      paid: "Paid",
      pending: "Pending",
      overdue: "Overdue",
      pending_approval: "Skip Pending",
      approved_deferred: "Deferred",
      rejected: "Skip Rejected",
    };
    const key = (status || "").toLowerCase();
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[key] || "bg-gray-100 text-gray-700"}`}>
        {labels[key] || status || "—"}
      </span>
    );
  };

  const refreshLoanInState = (updatedLoan) => {
    setLoans((prev) => prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l)));
    setFilteredLoans((prev) => prev.map((l) => (l.id === updatedLoan.id ? updatedLoan : l)));
    setShowDetails(updatedLoan);
  };

  const handleRequestSkip = async (loan, installmentNo) => {
    const { value: reason } = await Swal.fire({
      title: `Skip installment #${installmentNo}?`,
      input: "textarea",
      inputLabel: "Reason (required)",
      inputPlaceholder: "Why should this month not be deducted?",
      showCancelButton: true,
      confirmButtonText: "Submit for approval",
      inputValidator: (v) => (!v || !String(v).trim() ? "Reason is required" : undefined),
    });
    if (!reason) return;
    try {
      const res = await requestLoanSkip(loan.id, installmentNo, reason);
      refreshLoanInState(res.loan);
      Swal.fire({ icon: "success", title: "Submitted", text: res.message, timer: 2000, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Failed", text: err.response?.data?.message || "Could not submit skip request" });
    }
  };

  const handleDecideSkip = async (loan, installmentNo, action) => {
    const { value: note } = await Swal.fire({
      title: action === "approve" ? "Approve skip (higher approval)?" : "Reject skip request?",
      text:
        action === "approve"
          ? "This month will not be deducted. Installment and later rows defer by 1 month."
          : "The installment will remain due as scheduled.",
      input: "text",
      inputLabel: "Approver note (optional)",
      showCancelButton: true,
      confirmButtonText: action === "approve" ? "Approve & defer" : "Reject",
      confirmButtonColor: action === "approve" ? "#2563eb" : "#dc2626",
    });
    if (note === undefined) return;
    try {
      const res = await decideLoanSkip(loan.id, installmentNo, action, note || null);
      refreshLoanInState(res.loan);
      Swal.fire({ icon: "success", title: "Done", text: res.message, timer: 2200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Failed", text: err.response?.data?.message || "Could not update skip request" });
    }
  };

  const runReportExport = async (type, { employeeNo = null, loanId = null } = {}) => {
    setReportLoading(true);
    try {
      const report = await fetchLoanReport(employeeNo, loanId);
      if (!report?.loans?.length) {
        Swal.fire({ icon: "info", title: "No Data", text: "No loan records found for this report." });
        return;
      }
      const prefix = loanId
        ? `loan_report_${loanId}`
        : employeeNo
          ? `loan_report_${employeeNo}`
          : "loan_detailed_report";
      if (type === "csv") exportLoanReportCSV(report, prefix);
      else exportLoanReportPDF(report, prefix);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Export Failed", text: err.message || "Could not generate report." });
    } finally {
      setReportLoading(false);
    }
  };

  const exportDetailedReport = (opts) => runReportExport("csv", typeof opts === "string" ? { employeeNo: opts } : opts);
  const exportDetailedPDF = (opts) => runReportExport("pdf", typeof opts === "string" ? { employeeNo: opts } : opts);

  // Export CSV updated
  const exportToCSV = () => {
    if (filteredLoans.length === 0) return;

    const headers = ["Loan ID", "Employee No", "Employee Name", "Amount", "Interest Rate", "Installment", "Request Date", "Deduct From Month", "With Interest"];
    const csvData = filteredLoans.map((loan) => [
      loan.loan_id,
      loan.employee?.attendance_employee_no || "N/A",
      loan.employee?.full_name || "N/A",
      loan.loan_amount,
      loan.interest_rate_per_annum + "%",
      loan.installment_amount,
      loan.request_date || "",
      loan.start_from,
      loan.with_interest ? "Yes" : "No",
    ]);

    const csvContent = [headers, ...csvData].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `loans_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSearchTerm("");
    setSearchFilter("all");
  };

  const openEdit = (loan) => {
    setEditLoan(loan);
    setEditForm({
      loan_amount: loan.loan_amount,
      installment_amount: loan.installment_amount,
      interest_rate_per_annum: loan.interest_rate_per_annum,
      request_date: loan.request_date ? String(loan.request_date).slice(0, 10) : "",
      start_from: loan.start_from ? String(loan.start_from).slice(0, 7) : "",
      installment_deduct_from: loan.installment_deduct_from || (loan.deduct_from === "basic" ? "basic" : "bonus"),
      interest_deduct_from: loan.interest_deduct_from || loan.installment_deduct_from || (loan.deduct_from === "basic" ? "basic" : "bonus"),
      status: loan.status || "active",
    });
  };

  const handleEditSave = async () => {
    const instFrom = editForm.installment_deduct_from || "bonus";
    const intFrom = editForm.interest_deduct_from || instFrom;
    const payload = {
      ...editForm,
      installment_deduct_from: instFrom,
      interest_deduct_from: intFrom,
      deduct_from: instFrom === intFrom ? instFrom : "split",
    };
    setIsSaving(true);
    try {
      await updateLoan(editLoan.id, payload);
      setLoans((prev) => prev.map((l) => l.id === editLoan.id ? { ...l, ...payload } : l));
      setEditLoan(null);
      Swal.fire({ icon: "success", title: "Updated!", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", title: "Update Failed", text: err.response?.data?.message || "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const totalLoans = filteredLoans.length;
  const totalAmount = filteredLoans.reduce((sum, loan) => sum + parseFloat(loan.loan_amount || 0), 0);
  const withInterestCount = filteredLoans.filter((loan) => loan.with_interest).length;
  const withoutInterestCount = filteredLoans.filter((loan) => !loan.with_interest).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-800 to-indigo-900 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">Employee Loans Management</h1>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 sm:p-6 lg:p-8">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-600">Total Loans</p>
              <p className="text-2xl font-bold text-gray-800">{totalLoans}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-600">With Interest</p>
              <p className="text-2xl font-bold text-indigo-600">{withInterestCount}</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <p className="text-sm font-medium text-gray-600">No Interest</p>
              <p className="text-2xl font-bold text-green-600">{withoutInterestCount}</p>
            </div>
          </div>

          {/* Filter Section */}
          <div className="px-4 sm:px-6 lg:px-8 pb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative flex-1 md:col-span-2">
                  <Search className="absolute left-3 top-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by loan ID or Employee No..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl"
                  />
                </div>
                <div className="flex gap-3">
                  <select
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="p-3 border border-gray-300 rounded-xl bg-white shadow-sm"
                  >
                    <option value="all">All Fields</option>
                    <option value="loan_id">Loan ID</option>
                    <option value="employee_id">Employee No</option>
                  </select>
                  <button onClick={resetFilters} className="px-4 py-3 bg-gray-100 rounded-xl">Reset</button>
                  <button onClick={exportToCSV} className="p-3 bg-green-600 text-white rounded-xl" title="Quick CSV"><Download size={20}/></button>
                  <button onClick={() => exportDetailedReport()} disabled={reportLoading} className="px-3 py-3 bg-indigo-600 text-white rounded-xl text-sm disabled:opacity-60">
                    {reportLoading ? "..." : "Full Report CSV"}
                  </button>
                  <button onClick={() => exportDetailedPDF()} disabled={reportLoading} className="px-3 py-3 bg-red-600 text-white rounded-xl text-sm disabled:opacity-60">
                    {reportLoading ? "..." : "Full Report PDF"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="px-4 sm:px-6 lg:px-8 pb-8">
            <div className="overflow-x-auto border rounded-xl">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Loan ID</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Employee No</th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Employee Name</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Interest</th>
                    <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Installment</th>
                    <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{loan.loan_id}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">
                          {loan.employee?.attendance_employee_no || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-800">{loan.employee?.full_name || "N/A"}</td>
                      <td className="px-6 py-4 text-right text-sm font-mono">{formatCurrency(loan.loan_amount)}</td>
                      <td className="px-6 py-4 text-center text-sm">{loan.interest_rate_per_annum}%</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-green-600">{formatCurrency(loan.installment_amount)}</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => showLoanDetails(loan)} className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">
                            <Eye size={18} />
                          </button>
                          <button onClick={() => openEdit(loan)} className="p-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200">
                            <Pencil size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editLoan && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-xl font-bold">Edit Loan — {editLoan.loan_id}</h3>
              <button onClick={() => setEditLoan(null)} className="text-gray-400 hover:text-gray-600 text-2xl">Ã—</button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Loan Amount (LKR)</label>
                <input type="number" className="w-full p-2 border rounded-lg" value={editForm.loan_amount}
                  onChange={(e) => setEditForm({ ...editForm, loan_amount: e.target.value })} min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Installment Amount (LKR)</label>
                <input type="number" className="w-full p-2 border rounded-lg" value={editForm.installment_amount}
                  onChange={(e) => setEditForm({ ...editForm, installment_amount: e.target.value })} min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Interest Rate (%)</label>
                <input type="number" className="w-full p-2 border rounded-lg" value={editForm.interest_rate_per_annum}
                  onChange={(e) => setEditForm({ ...editForm, interest_rate_per_annum: e.target.value })} min="0" step="0.01" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Request Date</label>
                <input type="date" className="w-full p-2 border rounded-lg" value={editForm.request_date || ""}
                  onChange={(e) => setEditForm({ ...editForm, request_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Deduction start month</label>
                <input type="month" className="w-full p-2 border rounded-lg" value={editForm.start_from || ""}
                  onChange={(e) => setEditForm({ ...editForm, start_from: e.target.value })} />
              </div>
              <div className="col-span-2 rounded-xl border-2 border-blue-100 bg-blue-50/50 p-4">
                <p className="text-sm font-bold text-gray-800 mb-1">Where to deduct</p>
                <p className="text-xs text-gray-600 mb-3">Capital installment and interest can come from different payslips.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border-2 border-blue-200 bg-white p-3">
                    <p className="font-semibold text-sm mb-2">Capital installment from</p>
                    <label className="flex items-center gap-2 mb-1 text-sm">
                      <input type="radio" checked={editForm.installment_deduct_from === "basic"}
                        onChange={() => setEditForm({ ...editForm, installment_deduct_from: "basic" })} />
                      Basic salary
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={editForm.installment_deduct_from === "bonus"}
                        onChange={() => setEditForm({ ...editForm, installment_deduct_from: "bonus" })} />
                      Monthly Bonus
                    </label>
                  </div>
                  <div className="rounded-lg border-2 border-indigo-200 bg-white p-3">
                    <p className="font-semibold text-sm mb-2">Interest from</p>
                    <label className="flex items-center gap-2 mb-1 text-sm">
                      <input type="radio" checked={editForm.interest_deduct_from === "basic"}
                        onChange={() => setEditForm({ ...editForm, interest_deduct_from: "basic" })} />
                      Basic salary
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" checked={editForm.interest_deduct_from === "bonus"}
                        onChange={() => setEditForm({ ...editForm, interest_deduct_from: "bonus" })} />
                      Monthly Bonus
                    </label>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select className="w-full p-2 border rounded-lg" value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setEditLoan(null)} className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300">Cancel</button>
              <button onClick={handleEditSave} disabled={isSaving}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold">Loan Details</h3>
              <button onClick={() => setShowDetails(null)} className="text-gray-400 hover:text-gray-600 text-2xl">Ã—</button>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap justify-between gap-4 mb-6">
                <div>
                  <h4 className="text-xl font-bold text-blue-900">{showDetails.loan_id}</h4>
                  <p className="text-gray-600 font-medium">Employee No: {showDetails.employee?.attendance_employee_no || "N/A"}</p>
                  <p className="text-sm text-gray-500">Name: {showDetails.employee?.full_name || "N/A"}</p>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  <span className={`px-4 py-1 rounded-full text-sm font-bold ${showDetails.with_interest ? "bg-indigo-100 text-indigo-800" : "bg-green-100 text-green-800"}`}>
                    {showDetails.with_interest ? "With Interest" : "No Interest"}
                  </span>
                  <span className="px-4 py-1 rounded-full text-sm font-bold bg-gray-100 text-gray-800 capitalize">{showDetails.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl mb-6">
                <div><p className="text-xs text-gray-500">Loan Amount</p><p className="font-bold">{formatCurrency(showDetails.loan_amount)}</p></div>
                <div><p className="text-xs text-gray-500">Installment</p><p className="font-bold text-green-600">{formatCurrency(showDetails.installment_amount)}</p></div>
                <div><p className="text-xs text-gray-500">Interest Rate</p><p className="font-bold">{showDetails.interest_rate_per_annum}% p.a.</p></div>
                <div><p className="text-xs text-gray-500">Request Date</p><p className="font-bold">{formatDate(showDetails.request_date)}</p></div>
                <div><p className="text-xs text-gray-500">Deduct From Month</p><p className="font-bold">{formatDate(showDetails.start_from)}</p></div>
                <div>
                  <p className="text-xs text-gray-500">Deduct From</p>
                  <p className="font-bold">{loanDeductSummary(showDetails)}</p>
                </div>
                <div><p className="text-xs text-gray-500">Installments Left</p><p className="font-bold">{showDetails.installment_count ?? "—"}</p></div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => exportDetailedPDF(showDetails.employee?.attendance_employee_no)}
                  disabled={reportLoading}
                  className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-60"
                >
                  Employee PDF Report
                </button>
                <button
                  type="button"
                  onClick={() => exportDetailedReport(showDetails.employee?.attendance_employee_no)}
                  disabled={reportLoading}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-60"
                >
                  Employee CSV Report
                </button>
                <button
                  type="button"
                  onClick={() => exportDetailedPDF({ loanId: showDetails.loan_id })}
                  disabled={reportLoading}
                  className="px-4 py-2 border border-red-200 text-red-700 text-sm rounded-lg hover:bg-red-50 disabled:opacity-60"
                >
                  This Loan PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportDetailedReport({ loanId: showDetails.loan_id })}
                  disabled={reportLoading}
                  className="px-4 py-2 border border-indigo-200 text-indigo-700 text-sm rounded-lg hover:bg-indigo-50 disabled:opacity-60"
                >
                  This Loan CSV
                </button>
              </div>

              <h4 className="font-bold mb-3 text-gray-800">Repayment Schedule (reducing interest)</h4>
              <p className="text-xs text-gray-500 mb-3">
                Deduct from:{" "}
                <strong>{loanDeductSummary(showDetails)}</strong>
                {" · "}
                To skip a month: Request Skip → Higher Approve (defers installment).
              </p>
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="p-2 text-left">No</th>
                      <th className="p-2 text-left">Due Date</th>
                      <th className="p-2 text-right">Installment</th>
                      <th className="p-2 text-right">Principal</th>
                      <th className="p-2 text-right">Interest</th>
                      <th className="p-2 text-right">Balance</th>
                      <th className="p-2 text-center">Skip</th>
                      <th className="p-2 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getScheduleRows(showDetails).length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-gray-500">No schedule saved for this loan.</td></tr>
                    ) : (
                      getScheduleRows(showDetails).map((row, idx) => {
                        const no = row.no || row.installment_no || idx + 1;
                        const skipStatus = (row.skip_status || "").toLowerCase();
                        return (
                          <tr key={idx} className="border-t hover:bg-gray-50">
                            <td className="p-2">{no}</td>
                            <td className="p-2">{row.dueDateIso || row.dueDate || row.due_date || row.due_date_display}</td>
                            <td className="p-2 text-right font-bold">{formatCurrency(row.installmentAmount || row.installment_amount)}</td>
                            <td className="p-2 text-right">{formatCurrency(row.capitalRepayment || row.capital_repayment || row.principal_deduction)}</td>
                            <td className="p-2 text-right">{formatCurrency(row.interestPayment || row.interest_payment || row.interest_deduction)}</td>
                            <td className="p-2 text-right">{formatCurrency(row.dueBalance || row.due_balance || row.balance_after)}</td>
                            <td className="p-2 text-center">{statusBadge(skipStatus || row.status)}</td>
                            <td className="p-2 text-center">
                              <div className="flex flex-wrap justify-center gap-1">
                                {showDetails.status === "active" && !skipStatus && (
                                  <button
                                    type="button"
                                    onClick={() => handleRequestSkip(showDetails, no)}
                                    className="px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
                                  >
                                    Request Skip
                                  </button>
                                )}
                                {skipStatus === "pending_approval" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleDecideSkip(showDetails, no, "approve")}
                                      className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDecideSkip(showDetails, no, "reject")}
                                      className="px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-4 border-t bg-gray-50 text-right sticky bottom-0">
              <button onClick={() => setShowDetails(null)} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewLoans;
