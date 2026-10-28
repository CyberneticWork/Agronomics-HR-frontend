import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DollarSign, Calendar, Loader2, FileText, Download, Eye, ArrowLeft, RefreshCw } from 'lucide-react';
import { fetchSalaryDataAPI } from '@src/services/SalaryService';
import { downloadPayslip } from '../../utils/payslipPdf';

const POLL_INTERVAL = 30000; // 30 seconds

const EmployeeSalaryRecordView = ({ employeeProfile }) => {
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;
  const pollRef = useRef(null);

  const fetchEmployeeSalaryRecords = useCallback(async (silent = false) => {
    if (!employeeProfile?.attendance_employee_no) return;
    silent ? setIsRefreshing(true) : setIsLoading(true);
    try {
      const response = await fetchSalaryDataAPI({ employee_no: employeeProfile.attendance_employee_no });
      if (response && Array.isArray(response)) {
        const sorted = [...response]
          .map(r => ({
            ...r,
            salary_breakdown: typeof r.salary_breakdown === 'string' ? JSON.parse(r.salary_breakdown) : (r.salary_breakdown || {}),
            allowances: typeof r.allowances === 'string' ? JSON.parse(r.allowances) : (r.allowances || []),
            deductions: typeof r.deductions === 'string' ? JSON.parse(r.deductions) : (r.deductions || []),
          }))
          .sort((a, b) => new Date(b.year, b.month - 1) - new Date(a.year, a.month - 1));
        setSalaryRecords(sorted);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.error('Error fetching salary records:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [employeeProfile]);

  // Initial fetch + polling
  useEffect(() => {
    fetchEmployeeSalaryRecords(false);
    pollRef.current = setInterval(() => fetchEmployeeSalaryRecords(true), POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [fetchEmployeeSalaryRecords]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin h-12 w-12 text-blue-500" />
      </div>
    );
  }

  // If viewing a specific record
  if (selectedRecord) {
    return <SalaryRecordDetail record={selectedRecord} employeeProfile={employeeProfile} onBack={() => setSelectedRecord(null)} />;
  }

  if (salaryRecords.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="mx-auto max-w-md">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-4">
            <FileText size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No salary records found</h3>
          <p className="mt-1 text-sm text-gray-500">Your salary records will appear here</p>
        </div>
      </div>
    );
  }

  // Pagination
  const totalPages = Math.ceil(salaryRecords.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, salaryRecords.length);
  const paginatedRecords = salaryRecords.slice(startIndex, endIndex);

  return (
    <div className="space-y-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl shadow-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Salary Records</h1>
            <p className="text-violet-100">View all your salary records and details</p>
            {lastUpdated && (
              <p className="text-violet-200 text-xs mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</p>
            )}
          </div>
          <button
            onClick={() => fetchEmployeeSalaryRecords(true)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Basic Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gross Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Deductions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Salary</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedRecords.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-900">{record.month}/{record.year}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    Rs. {parseFloat(record.salary_breakdown?.basic_salary || record.basic_salary || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                    Rs. {parseFloat(record.salary_breakdown?.gross_salary || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                    Rs. {parseFloat(record.salary_breakdown?.total_deductions || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                    Rs. {parseFloat(record.salary_breakdown?.net_salary || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                      record.status === 'processed' ? 'bg-green-100 text-green-800' :
                      record.status === 'issued' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {record.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={() => setSelectedRecord(record)}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {salaryRecords.length > rowsPerPage && (
          <div className="px-6 py-4 bg-white border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
              <span className="font-medium">{endIndex}</span> of{" "}
              <span className="font-medium">{salaryRecords.length}</span> records
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded-md border ${
                  currentPage === 1
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                }`}
              >
                Prev
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`px-3 py-1 rounded-md border ${
                    p === currentPage
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {p}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded-md border ${
                  currentPage === totalPages
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white hover:bg-gray-50 text-gray-700"
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Salary Record Detail Component
const SalaryRecordDetail = ({ record, onBack }) => {
  const sb = record.salary_breakdown || {};
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = () => {
    setIsDownloading(true);
    try {
      downloadPayslip(record);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-6 bg-gradient-to-br from-gray-50 to-blue-50 min-h-screen p-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-medium shadow border border-gray-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Records
      </button>

      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl shadow-xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Salary Record</h1>
        <p className="text-violet-100">{record.full_name} • {record.month}/{record.year}</p>
      </div>

      {/* Employee & Basic Info */}
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b-2 border-gray-200">
          <div>
            <p className="text-sm text-gray-600 mb-1">Employee Name</p>
            <p className="text-lg font-bold text-gray-900">{record.full_name || 'N/A'}</p>
            <p className="text-sm text-gray-500 mt-1">{record.department_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Employee ID</p>
            <p className="text-lg font-bold text-gray-900">{record.employee_no || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Company</p>
            <p className="text-lg font-bold text-gray-900">{record.company_name || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Period</p>
            <p className="text-lg font-bold text-gray-900">{record.month}/{record.year}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Basic Salary</p>
            <p className="text-lg font-bold text-blue-600">Rs. {parseFloat(record.basic_salary || 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
              record.status === 'processed' ? 'bg-green-100 text-green-800' :
              record.status === 'issued' ? 'bg-blue-100 text-blue-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {record.status}
            </span>
          </div>
        </div>
      </div>

      {/* Salary Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Earnings */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-6 shadow-lg border-2 border-green-200">
          <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
            <div className="p-2 bg-green-500 rounded-lg">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Earnings
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between bg-white p-3 rounded-lg">
              <span className="text-gray-700">Basic Salary</span>
              <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.basic_salary || record.basic_salary || 0).toLocaleString()}</span>
            </div>
            {sb.br_allowance > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">BR Allowance</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.br_allowance || 0).toLocaleString()}</span>
              </div>
            )}
            {sb.ot_morning_fees > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Morning OT</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.ot_morning_fees || 0).toLocaleString()}</span>
              </div>
            )}
            {sb.ot_night_fees > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Evening OT</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.ot_night_fees || 0).toLocaleString()}</span>
              </div>
            )}
            {sb.holiday_amount > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Holiday Pay</span>
                <span className="font-semibold text-emerald-600">Rs. {parseFloat(sb.holiday_amount || 0).toLocaleString()}</span>
              </div>
            )}
            {sb.off_day_amount > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Off-Day Pay</span>
                <span className="font-semibold text-teal-600">Rs. {parseFloat(sb.off_day_amount || 0).toLocaleString()}</span>
              </div>
            )}
            {sb.total_allowances > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Other Allowances</span>
                <span className="font-semibold text-green-600">Rs. {parseFloat(sb.total_allowances || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="border-t-2 border-green-300 pt-3 flex justify-between bg-white p-3 rounded-lg font-bold">
              <span className="text-gray-900">{sb.is_jaysea_process ? "Total Earnings" : "Total Earnings"}</span>
              <span className="text-green-600">Rs. {parseFloat(sb.total_earnings || sb.gross_salary || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-6 shadow-lg border-2 border-red-200">
          <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
            <div className="p-2 bg-red-500 rounded-lg">
              <DollarSign className="h-5 w-5 text-white" />
            </div>
            Deductions
          </h3>
          <div className="space-y-3">
            {sb.no_pay_deduction > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">No Pay Deduction</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.no_pay_deduction || 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between bg-white p-3 rounded-lg">
              <span className="text-gray-700">EPF (8%)</span>
              <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.epf_employee_deduction || 0).toLocaleString()}</span>
            </div>
            {(parseFloat(sb.paye_deduction || 0) > 0 || parseFloat(sb.paye_amount || 0) > 0) && (
              <div className="flex justify-between bg-white p-3 rounded-lg border-l-4 border-amber-500">
                <span className="text-gray-700 font-medium">PAYE / APIT</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.paye_deduction || sb.paye_amount).toLocaleString()}</span>
              </div>
            )}
            {parseFloat(sb.advance_salary || 0) > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Salary Advance</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.advance_salary).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between bg-white p-3 rounded-lg">
              <span className="text-gray-700">Loan Installment</span>
              <span className="font-semibold text-gray-900">Rs. {parseFloat((sb.loan_principal || 0) + (sb.loan_interest || 0)).toLocaleString()}</span>
            </div>
            {parseFloat(sb.stamp_duty || 0) > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg">
                <span className="text-gray-700">Stamp Duty</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.stamp_duty || 0).toLocaleString()}</span>
              </div>
            )}
            {parseFloat(sb.fish_deduction || 0) > 0 && (
              <div className="flex justify-between bg-white p-3 rounded-lg border-l-4 border-cyan-500">
                <span className="text-gray-700 font-medium">FISH</span>
                <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.fish_deduction).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between bg-white p-3 rounded-lg">
              <span className="text-gray-700">Other Deductions</span>
              <span className="font-semibold text-gray-900">Rs. {parseFloat(sb.total_fixed_deductions || 0).toLocaleString()}</span>
            </div>
            <div className="border-t-2 border-red-300 pt-3 flex justify-between bg-white p-3 rounded-lg font-bold">
              <span className="text-gray-900">Total Deductions</span>
              <span className="text-red-600">Rs. {parseFloat(sb.total_deductions || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Net Salary */}
      <div className="bg-gradient-to-r from-blue-100 to-blue-50 rounded-2xl p-8 shadow-xl border-2 border-blue-500">
        <div className="flex justify-between items-center">
          <span className="text-2xl font-bold text-gray-900">Net Salary</span>
          <span className="text-4xl font-bold text-blue-600">Rs. {parseFloat(sb.net_salary || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* Additional Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-blue-500">
          <p className="text-sm text-gray-600 mb-1">Working Days</p>
          <p className="text-2xl font-bold text-gray-900">{sb.working_days || 22}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-orange-500">
          <p className="text-sm text-gray-600 mb-1">Per Day Salary</p>
          <p className="text-2xl font-bold text-gray-900">Rs. {parseFloat(sb.per_day_salary || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-purple-500">
          <p className="text-sm text-gray-600 mb-1">Probation Deduction</p>
          <p className="text-2xl font-bold text-gray-900">Rs. {parseFloat(sb.probation_deduction || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-green-500">
          <p className="text-sm text-gray-600 mb-1">Loan Balance</p>
          <p className="text-2xl font-bold text-gray-900">Rs. {parseFloat(record.loan_balance || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Allowances & Deductions Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Allowances */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            Allowances
          </h3>
          {record.allowances && Array.isArray(record.allowances) && record.allowances.length > 0 ? (
            <div className="space-y-2">
              {record.allowances.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-200">
                  <span className="text-gray-700 font-medium">{item.name}</span>
                  <span className="text-green-600 font-bold">Rs. {parseFloat(item.amount || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t-2 border-green-300 pt-3 flex justify-between items-center font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-green-600">Rs. {parseFloat(sb.total_allowances || 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm italic">No allowances</p>
          )}
        </div>

        {/* Deductions Details */}
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
          <h3 className="font-bold text-gray-900 mb-4 text-lg flex items-center gap-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-red-600" />
            </div>
            Deductions
          </h3>
          {record.deductions && Array.isArray(record.deductions) && record.deductions.length > 0 ? (
            <div className="space-y-2">
              {record.deductions.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-gray-700 font-medium">{item.name}</span>
                  <span className="text-red-600 font-bold">Rs. {parseFloat(item.amount || 0).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t-2 border-red-300 pt-3 flex justify-between items-center font-bold">
                <span className="text-gray-900">Total</span>
                <span className="text-red-600">Rs. {parseFloat(sb.total_fixed_deductions || 0).toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-sm italic">No deductions</p>
          )}
        </div>
      </div>

      {/* Configuration Details */}
      <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
        <h3 className="font-bold text-gray-900 mb-4 text-lg">Configuration Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">EPF/ETF Status</p>
            <p className="text-lg font-bold text-gray-900">{record.enable_epf_etf ? 'Enabled' : 'Disabled'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">Stamp Duty</p>
            <p className="text-lg font-bold text-gray-900">{record.stamp ? 'Applied' : 'Not Applied'}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600 mb-1">BR Status</p>
            <p className="text-lg font-bold text-gray-900">
              {record.br1 && record.br2 ? 'BR1 & BR2' : record.br1 ? 'BR1' : record.br2 ? 'BR2' : 'None'}
            </p>
          </div>
          {record.increment_active && (
            <>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Increment Value</p>
                <p className="text-lg font-bold text-gray-900">Rs. {parseFloat(record.increment_value || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 mb-1">Increment Effective Date</p>
                <p className="text-lg font-bold text-gray-900">{record.increment_effected_date?.split('T')[0] || 'N/A'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Download Button */}
      <div className="flex justify-center">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all disabled:opacity-60"
        >
          {isDownloading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          {isDownloading ? 'Generating PDF...' : 'Salary Slip'}
        </button>
      </div>
    </div>
  );
};

export default EmployeeSalaryRecordView;
