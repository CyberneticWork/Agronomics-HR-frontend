import React, { useState, useEffect } from 'react';
import { User, Calendar, Clock, DollarSign, UserCheck, CreditCard, Building2, Briefcase, BarChart3, CheckCircle, XCircle, AlertCircle, Edit } from 'lucide-react';
import { getLeavesByEmployee } from '@src/services/LeaveMaster';
import { fetchSalaryDataAPI } from '@src/services/SalaryService';
import timeCardService from '@src/services/timeCardService';

const EmployeeDashboard = ({ 
  employeeProfile, 
  attendanceRecords, 
  isLoadingAttendance, 
  lateCount,
  setActiveItem 
}) => {
  const [attendanceSummary, setAttendanceSummary] = useState({ present: 0, absent: 0, late: 0, total: 0 });
  const [otSummary, setOtSummary] = useState({ totalHours: 0, totalAmount: 0 });
  const [loanSummary, setLoanSummary] = useState({ loanAmount: 0, monthlyDeduction: 0, balance: 0 });
  const [showSalarySlip, setShowSalarySlip] = useState(false);
  const [leaveRecords, setLeaveRecords] = useState([]);
  const [latestSalaryRecord, setLatestSalaryRecord] = useState(null);

  useEffect(() => {
    if (employeeProfile?.id) {
      fetchLeaveRecords();
      calculateOtSummary();
      calculateLoanSummary();
      fetchLatestSalaryRecord();
      fetchMyAttendance();
    }
  }, [employeeProfile?.id, employeeProfile?.loans]);

  useEffect(() => {
    if (attendanceRecords.length > 0) {
      calculateAttendanceSummary(attendanceRecords);
    }
  }, [attendanceRecords]);

  const fetchLatestSalaryRecord = async () => {
    try {
      const response = await fetchSalaryDataAPI();
      if (response && Array.isArray(response)) {
        const empRecords = response.filter(
          r => r.employee_no === employeeProfile?.attendance_employee_no
        );
        if (empRecords.length > 0) {
          empRecords.sort((a, b) => {
            if (b.year !== a.year) return b.year - a.year;
            return b.month - a.month;
          });
          const latest = empRecords[0];
          setLatestSalaryRecord({
            ...latest,
            salary_breakdown: typeof latest.salary_breakdown === 'string' ? JSON.parse(latest.salary_breakdown) : (latest.salary_breakdown || {}),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching salary record:', error);
    }
  };

  const fetchMyAttendance = async () => {
    if (!employeeProfile?.attendance_employee_no) return;
    try {
      const response = await timeCardService.searchEmployeeTimeCards(employeeProfile.attendance_employee_no);
      if (response && Array.isArray(response)) {
        calculateAttendanceSummary(response);
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
    }
  };

  const fetchLeaveRecords = async () => {
    try {
      const data = await getLeavesByEmployee(employeeProfile.id);
      if (data && Array.isArray(data)) {
        setLeaveRecords(data);
      }
    } catch (error) {
      console.error('Error fetching leave records:', error);
    }
  };

  const calculateAttendanceSummary = (records) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const monthRecords = records.filter(record => {
      const d = record.date || record.actual_date;
      if (!d) return false;
      const recordDate = new Date(d);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    const uniqueDates = [...new Set(monthRecords.map(r => r.date || r.actual_date))];
    const absentDates = [...new Set(monthRecords.filter(r => r.status === 'Absent' || r.status === 'NPL' || r.status === 'No Pay Leave').map(r => r.date || r.actual_date))];
    const presentDates = uniqueDates.filter(d => !absentDates.includes(d));
    const lateDates = [...new Set(monthRecords.filter(r => r.status === 'Late Coming').map(r => r.date || r.actual_date))];

    setAttendanceSummary({ present: presentDates.length, absent: absentDates.length, late: lateDates.length, total: uniqueDates.length });
  };

  const calculateOtSummary = () => {
    if (employeeProfile?.overtimes && Array.isArray(employeeProfile.overtimes)) {
      const totalHours = employeeProfile.overtimes.reduce((sum, ot) => sum + (parseFloat(ot.ot_hours) || 0), 0);
      const totalAmount = employeeProfile.overtimes.reduce((sum, ot) => sum + (parseFloat(ot.total_ot_amount) || 0), 0);
      setOtSummary({ totalHours: totalHours.toFixed(2), totalAmount: totalAmount.toFixed(2) });
    }
  };

  const calculateLoanSummary = () => {
    if (employeeProfile?.loans && Array.isArray(employeeProfile.loans) && employeeProfile.loans.length > 0) {
      const activeLoan = employeeProfile.loans.find(loan => loan.status === 'active' || loan.status === 'Active');
      if (activeLoan) {
        const loanAmount = parseFloat(activeLoan.loan_amount) || 0;
        const monthlyDeduction = parseFloat(activeLoan.monthly_deduction) || 0;
        const balance = parseFloat(activeLoan.balance) || 0;
        setLoanSummary({ loanAmount, monthlyDeduction, balance });
      } else {
        setLoanSummary({ loanAmount: 0, monthlyDeduction: 0, balance: 0 });
      }
    } else {
      setLoanSummary({ loanAmount: 0, monthlyDeduction: 0, balance: 0 });
    }
  };

  return (
    <div className="space-y-6 min-h-screen">
      {/* Quick Actions - Moved to Top */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <button
          onClick={() => setActiveItem('myProfile')}
          className="group bg-white p-7 rounded-2xl shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-teal-50 hover:border-teal-300 hover:shadow-xl transition-all text-left transform hover:-translate-y-1"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-gradient-to-br from-teal-500 to-teal-700 rounded-2xl group-hover:scale-110 transition-transform shadow-lg">
              <User className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[var(--brand-ink)] text-lg mb-1">My Profile</h3>
              <p className="text-sm text-slate-500">View & edit details</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveItem('leaveMaster')}
          className="group p-7 rounded-2xl shadow-xl hover:shadow-2xl transition-all text-left transform hover:scale-[1.02] text-white"
          style={{ background: "linear-gradient(135deg, #0D9488, #0B4F5C)" }}
        >
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-2xl group-hover:bg-white/30 transition-colors shadow-lg">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg mb-1">Apply Leave</h3>
              <p className="text-sm text-teal-50">Request time off</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setActiveItem('attendanceReport')}
          className="group bg-white p-7 rounded-2xl shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-orange-50 hover:border-[#FF6B4A]/40 hover:shadow-xl transition-all text-left transform hover:-translate-y-1"
        >
          <div className="flex items-center gap-4">
            <div className="p-4 rounded-2xl group-hover:scale-110 transition-transform shadow-lg" style={{ background: "linear-gradient(135deg, #FF6B4A, #F5A524)" }}>
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[var(--brand-ink)] text-lg mb-1">My Attendance</h3>
              <p className="text-sm text-slate-500">View report</p>
            </div>
          </div>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-emerald-50 border-l-4 border-l-emerald-500 hover:shadow-xl transition-shadow anim-rise">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <UserCheck className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[var(--brand-ink)]">{attendanceSummary.present}</p>
          <p className="text-sm text-slate-500 mt-2">Present Days</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-orange-50 border-l-4 border-l-[#FF6B4A] hover:shadow-xl transition-shadow anim-rise" style={{ animationDelay: "0.05s" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-orange-100 rounded-xl">
              <Clock className="h-6 w-6 text-[#FF6B4A]" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[var(--brand-ink)]">{lateCount}</p>
          <p className="text-sm text-slate-500 mt-2">Late Days</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-teal-50 border-l-4 border-l-teal-500 hover:shadow-xl transition-shadow anim-rise" style={{ animationDelay: "0.1s" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-teal-100 rounded-xl">
              <Clock className="h-6 w-6 text-teal-700" />
            </div>
          </div>
          <p className="text-3xl font-display font-bold text-[var(--brand-ink)]">{otSummary.totalHours}</p>
          <p className="text-sm text-slate-500 mt-2">OT Hours</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-amber-50 border-l-4 border-l-amber-500 hover:shadow-xl transition-shadow anim-rise" style={{ animationDelay: "0.15s" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-amber-100 rounded-xl">
              <DollarSign className="h-6 w-6 text-amber-600" />
            </div>
          </div>
          <div className="text-3xl font-display font-bold text-[var(--brand-ink)]">Rs. {Number(loanSummary.balance || 0).toLocaleString()}</div>
          <p className="text-sm text-slate-500 mt-2">Loan Balance</p>
        </div>
      </div>

      {/* Profile & Salary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile Card */}
        {employeeProfile && (
          <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-teal-50 hover:shadow-xl transition-shadow">
            <h3 className="font-display font-bold text-[var(--brand-ink)] mb-4 flex items-center gap-2 text-lg">
              <div className="p-2 bg-teal-100 rounded-lg">
                <User className="h-5 w-5 text-teal-700" />
              </div>
              Employee Profile
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Name</span>
                <span className="text-sm font-medium text-[var(--brand-ink)]">{employeeProfile.name_with_initials || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Department</span>
                <span className="text-sm font-medium text-[var(--brand-ink)]">{employeeProfile.organization_assignment?.department?.name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Employee ID</span>
                <span className="text-sm font-medium text-[var(--brand-ink)]">{employeeProfile.attendance_employee_no || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Salary Card */}
        {employeeProfile && (
          <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-emerald-50 hover:shadow-xl transition-shadow">
            <h3 className="font-display font-bold text-[var(--brand-ink)] mb-4 flex items-center gap-2 text-lg">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              Current Salary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Basic Salary</span>
                <span className="text-sm font-medium text-[var(--brand-ink)]">Rs. {(parseFloat(latestSalaryRecord?.salary_breakdown?.basic_salary || latestSalaryRecord?.basic_salary || employeeProfile.compensation?.basic_salary) || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Allowances</span>
                <span className="text-sm font-medium text-emerald-600">+ Rs. {parseFloat(latestSalaryRecord?.salary_breakdown?.total_allowances || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-slate-500">Deductions</span>
                <span className="text-sm font-medium text-[#FF6B4A]">- Rs. {parseFloat(latestSalaryRecord?.salary_breakdown?.total_deductions || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-3 border-t border-teal-50">
                <span className="text-base font-bold text-[var(--brand-ink)]">Net Salary</span>
                <span className="text-base font-bold text-teal-700">
                  Rs. {latestSalaryRecord ? parseFloat(latestSalaryRecord.salary_breakdown?.net_salary || 0).toLocaleString() : (parseFloat(latestSalaryRecord?.salary_breakdown?.basic_salary || latestSalaryRecord?.basic_salary || employeeProfile.compensation?.basic_salary || 0)).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowSalarySlip(true)}
                className="w-full text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-md hover:shadow-lg"
                style={{ background: "linear-gradient(135deg, #0D9488, #0B4F5C)" }}
              >
                View Salary Slip
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Leave Records */}
      <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-teal-50">
        <h3 className="font-display font-semibold text-[var(--brand-ink)] mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-teal-600" />
          My Leave Requests
        </h3>
        {leaveRecords.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No leave records found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="bg-teal-50/60">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-teal-800 uppercase border border-teal-100">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-teal-800 uppercase border border-teal-100">Type</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-teal-800 uppercase border border-teal-100">Duration</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-teal-800 uppercase border border-teal-100">Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRecords.slice(0, 5).map((leave) => (
                  <tr key={leave.id} className="hover:bg-teal-50/40">
                    <td className="px-4 py-2 border border-teal-50 text-sm">
                      {leave.leave_date || `${leave.leave_from} to ${leave.leave_to}`}
                    </td>
                    <td className="px-4 py-2 border border-teal-50 text-sm">{leave.leave_type}</td>
                    <td className="px-4 py-2 border border-teal-50 text-sm">
                      {leave.is_short_leave ? 'Short Leave' : leave.is_half_day ? 'Half Day' : `${leave.leave_duration} day(s)`}
                    </td>
                    <td className="px-4 py-2 border border-teal-50 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        leave.status === 'Approved' || leave.status === 'HR_Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : leave.status === 'Rejected'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {leave.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button
          onClick={() => setActiveItem('leaveMaster')}
          className="w-full mt-4 bg-teal-50 hover:bg-teal-100 text-teal-800 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          View All / Apply Leave
        </button>
      </div>

      {/* Attendance Summary */}
      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-teal-50">
          <h3 className="font-display font-semibold text-[var(--brand-ink)] mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            Monthly Attendance Summary
          </h3>
          {isLoadingAttendance ? (
            <div className="py-8 text-center">
              <div className="inline-block w-6 h-6 border-t-2 border-b-2 border-teal-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-200">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-display font-bold text-emerald-600">{attendanceSummary.present}</p>
                  <p className="text-xs text-slate-500 mt-1">Present</p>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center border border-red-200">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <XCircle className="h-4 w-4 text-red-600" />
                  </div>
                  <p className="text-2xl font-display font-bold text-red-600">{attendanceSummary.absent}</p>
                  <p className="text-xs text-slate-500 mt-1">Absent</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="text-2xl font-display font-bold text-amber-600">{attendanceSummary.late}</p>
                  <p className="text-xs text-slate-500 mt-1">Late</p>
                </div>
              </div>
              <div className="bg-teal-50/50 rounded-xl p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500">Total Days</span>
                  <span className="text-lg font-display font-bold text-[var(--brand-ink)]">{attendanceSummary.total}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveItem('attendanceReport')}
                className="w-full mt-4 bg-teal-50 hover:bg-teal-100 text-teal-800 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              >
                View Full Report
              </button>
            </>
          )}
        </div>
      </div>

      {/* Salary Slip Modal */}
      {showSalarySlip && (() => {
        const sb = latestSalaryRecord?.salary_breakdown || {};
        const basicSalary = parseFloat(sb.basic_salary || latestSalaryRecord?.basic_salary || employeeProfile?.compensation?.basic_salary || 0);
        const brAllowance = parseFloat(sb.br_allowance || 0);
        const otMorning = parseFloat(sb.ot_morning_fees || 0);
        const otNight = parseFloat(sb.ot_night_fees || 0);
        const otherAllowances = parseFloat(sb.total_allowances || 0);
        const grossSalary = parseFloat(sb.gross_salary || basicSalary);
        const epf = parseFloat(sb.epf_employee_deduction || 0);
        const loanInstallment = parseFloat((sb.loan_principal || 0) + (sb.loan_interest || 0)) || parseFloat(loanSummary.monthlyDeduction || 0);
        const stampDuty = parseFloat(sb.stamp_duty || sb.stamp || 0);
        const noPay = parseFloat(sb.full_day_nopay_deduction || sb.no_pay_deduction || 0);
        const otherDeductions = parseFloat(sb.total_fixed_deductions || 0);
        const fishDeduction = parseFloat(sb.fish_deduction || 0);
        const totalDeductions = parseFloat(sb.total_deductions || 0);
        const netSalary = parseFloat(sb.net_salary || basicSalary);
        const period = latestSalaryRecord ? `${latestSalaryRecord.month}/${latestSalaryRecord.year}` : `${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
        const status = latestSalaryRecord?.status || 'N/A';
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="p-6 text-white flex justify-between items-center sticky top-0 rounded-t-2xl" style={{ background: "linear-gradient(135deg, #0D9488, #062A32)" }}>
                <div>
                  <h2 className="text-2xl font-display font-bold">Salary Slip</h2>
                  <p className="text-teal-100 text-sm mt-1">Period: {period}</p>
                </div>
                <button onClick={() => setShowSalarySlip(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">✕</button>
              </div>

              <div className="p-6 space-y-5">
                {/* Employee Info */}
                <div className="bg-teal-50 rounded-xl p-4 border border-teal-200 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Name</p>
                    <p className="font-bold text-gray-900 mt-1">{employeeProfile?.name_with_initials || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Employee ID</p>
                    <p className="font-bold text-gray-900 mt-1">{employeeProfile?.attendance_employee_no || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Department</p>
                    <p className="font-bold text-gray-900 mt-1">{employeeProfile?.organization_assignment?.department?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Status</p>
                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      status === 'processed' ? 'bg-green-100 text-green-800' :
                      status === 'issued' ? 'bg-teal-100 text-teal-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>{status}</span>
                  </div>
                </div>

                {/* Earnings & Deductions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Earnings */}
                  <div className="border-2 border-green-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-5 bg-green-500 rounded"></div>
                      <h3 className="font-bold text-gray-900">Earnings</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-1 border-b border-gray-100">
                        <span className="text-gray-600">Basic Salary</span>
                        <span className="font-semibold">Rs. {basicSalary.toLocaleString()}</span>
                      </div>
                      {brAllowance > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">BR Allowance</span>
                          <span className="font-semibold">Rs. {brAllowance.toLocaleString()}</span>
                        </div>
                      )}
                      {otMorning > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">OT Morning</span>
                          <span className="font-semibold">Rs. {otMorning.toLocaleString()}</span>
                        </div>
                      )}
                      {otNight > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">OT Night</span>
                          <span className="font-semibold">Rs. {otNight.toLocaleString()}</span>
                        </div>
                      )}
                      {otherAllowances > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">Other Allowances</span>
                          <span className="font-semibold text-green-600">Rs. {otherAllowances.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 bg-green-50 px-2 rounded-lg font-bold">
                        <span>Gross Salary</span>
                        <span className="text-green-600">Rs. {grossSalary.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Deductions */}
                  <div className="border-2 border-red-200 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-1 h-5 bg-red-500 rounded"></div>
                      <h3 className="font-bold text-gray-900">Deductions</h3>
                    </div>
                    <div className="space-y-2 text-sm">
                      {epf > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">EPF (8%)</span>
                          <span className="font-semibold">Rs. {epf.toLocaleString()}</span>
                        </div>
                      )}
                      {loanInstallment > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">Loan Installment</span>
                          <span className="font-semibold">Rs. {loanInstallment.toLocaleString()}</span>
                        </div>
                      )}
                      {stampDuty > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">Stamp Duty</span>
                          <span className="font-semibold">Rs. {stampDuty.toLocaleString()}</span>
                        </div>
                      )}
                      {noPay > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">No Pay</span>
                          <span className="font-semibold">Rs. {noPay.toLocaleString()}</span>
                        </div>
                      )}
                      {fishDeduction > 0 && (
                        <div className="flex justify-between py-1 border-b border-cyan-100 bg-cyan-50/50 px-1 rounded">
                          <span className="text-gray-700 font-medium">FISH</span>
                          <span className="font-semibold text-gray-900">Rs. {fishDeduction.toLocaleString()}</span>
                        </div>
                      )}
                      {otherDeductions > 0 && (
                        <div className="flex justify-between py-1 border-b border-gray-100">
                          <span className="text-gray-600">Other Deductions</span>
                          <span className="font-semibold">Rs. {otherDeductions.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 bg-red-50 px-2 rounded-lg font-bold">
                        <span>Total Deductions</span>
                        <span className="text-red-600">Rs. {totalDeductions.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Salary */}
                <div className="rounded-xl p-6 text-white flex justify-between items-center" style={{ background: "linear-gradient(135deg, #0D9488, #0B4F5C)" }}>
                  <div>
                    <p className="text-teal-100 text-sm font-semibold uppercase">Net Salary</p>
                    <p className="text-teal-100 text-xs mt-1">Amount to be credited</p>
                  </div>
                  <p className="text-4xl font-display font-bold">Rs. {netSalary.toLocaleString()}</p>
                </div>

                {/* Extra Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Working Days</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{sb.working_days || '—'}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-semibold">No Pay Days</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{sb.no_pay_days || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-semibold">Loan Balance</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">Rs. {loanSummary.balance.toLocaleString()}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase font-semibold">EPF/ETF</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{latestSalaryRecord?.enable_epf_etf ? 'Enabled' : 'Disabled'}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 pt-4 flex justify-between items-center">
                  <p className="text-xs text-gray-400">Generated on {new Date().toLocaleDateString()}</p>
                  <button onClick={() => setShowSalarySlip(false)}
                    className="px-5 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors text-sm">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default EmployeeDashboard;