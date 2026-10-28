import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  UserCheck,
  Calendar,
  Clock,
  DollarSign,
  PieChart,
  User,
  BarChart3,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  CreditCard,
  CheckCircle,
} from "lucide-react";
import NotificationBell from "../../components/NotificationBell";
import { useBranding } from "../../contexts/BrandingContext";
import { Bar, Pie, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";

import Sidebar from "./Sidebar";
import EmployeeDashboardComponent from "./EmployeeDashboard";
import EmployeeMaster from "@dashboard/AddEmployeeMaster/EmployeeMaster";
import EmployeeAdd from "@dashboard/EmployeeAdd";
import ShowEmployee from "@dashboard/ShowEmployee";
import MyProfile from "@dashboard/MyProfile";
import ChangePassword from "@dashboard/ChangePassword";
import CreateNewDeduction from "@dashboard/createnewdeduction";

import CreateNewBonus from "@dashboard/CreateNewBonus";
import ShiftSchedule from "@dashboard/ShiftSchedule";
import ShiftOvertimeRates from "@dashboard/ShiftOvertimeRates";
import CreateNewAllowance from "@dashboard/CreateNewAllowance";
import EmployeeLoan from "@dashboard/EmployeeLoan";
import EmployeeLoanView from "@dashboard/EmployeeLoanView";
import TimeCard from "@dashboard/TimeCard";
import Overtime from "@dashboard/Overtime";
import LateEarlyApproval from "@dashboard/LateEarlyApproval";
import TimeCardApproval from "@dashboard/TimeCardApproval";
import TimeCardAuditReport from "@dashboard/TimeCardAuditReport";
import ShiftHoursReport from "@dashboard/ShiftHoursReport";
import MonthlyHoursReport from "@dashboard/MonthlyHoursReport";
import ContractAttendanceReport from "@dashboard/ContractAttendanceReport";
import DailyOtHoursReport from "@dashboard/DailyOtHoursReport";
import Department from "@dashboard/Department";
import Grouproster from "@dashboard/Grouproster";
import RosterCalendar from "@dashboard/RosterCalendar";
import LeaveMaster from "@dashboard/LeaveMaster";
import NoPayManagement from "@dashboard/NoPayManagement";
import MonthlyLateDeduction from "@dashboard/MonthlyLateDeduction";
import ExcessLateReview from "@dashboard/ExcessLateReview";
import PersonalOut from "@dashboard/PersonalOut";
import LeaveCalendar from "@dashboard/LeaveCalendar";
import SalaryProcessPage from "@dashboard/SalaryProcessPage";
import LeaveApproval from "@dashboard/LeaveApproval";
import HRLeaveApproval from "@dashboard/HRLeaveApproval";
import Resignation from "@dashboard/Resignation";
import Termination from "@dashboard/Termination";
import NopayWorkingDaysSettings from "@dashboard/NopayWorkingDaysSettings";

import ViewLoans from "@dashboard/viewLoans";
import SalaryPage from "@dashboard/SalaryPage";
import UserManagement from "@dashboard/UserManagement";
import AccessControl from "@dashboard/AccessControl";
import LaborManagement from "@dashboard/LaborManagement";
import Chatbot from "./Chatbot";
// Import PMS components
import { PMSDashboard, PerformanceReviews, KPIs } from "../PMS";
import EmployeePerformanceEvaluation from "../PMS/EmployeeEvaluation";
import EmployeeKPIView from "../PMS/KPIs/EmployeeKPIView";
import TaskApproval from "../../pages/PMS/TaskApproval/TaskApproval";
import PerformanceAppraisal from "../PMS/PerformanceAppraisal/PerformanceAppraisal";

// Import LMS components
import LMS from "../LMS/LMS";
import UserStats from "../LMS/UserStats";

// Import Accounting components
import AccountingDashboard from "../Accounting/Dashboard";
import Supplier from "../Inventory/MasterFile/Supplier";
import DoubleEntry from "../Accounting/DoubleEntry";
import ChartOfAccounts from "../Accounting/ChartOfAccounts";
import AccountList from "../Accounting/AccountList";
import Customer from "../Inventory/MasterFile/Customer";
import Center from "../Inventory/MasterFile/Center";
import DiscountLevel from "../Inventory/MasterFile/DiscountLevel";
import ProductList from "../Inventory/MasterFile/ProductList";
import ProductType from "../Inventory/MasterFile/ProductType";
import Transactions from "../Accounting/Transactions";
import Ledger from "../Accounting/Ledger";
import TrialBalance from "../Accounting/TrialBalance";
import IncomeStatement from "../Accounting/IncomeStatement";
import BalanceSheet from "../Accounting/BalanceSheet";
import CashFlowStatement from "../Accounting/CashFlowStatement";
import Invoices from "../Inventory/Invoices";
import SalesOrder from "../Inventory/SalesOrder";
import SalesReturn from "../Inventory/SalesReturn";
import GRN from "../Inventory/GRN";
import PurchaseReturn from "../Inventory/PurchaseReturn";
import PurchaseOrder from "../Inventory/PurchaseOrder";
import StockTransfer from "../Inventory/StockTransfer";
import StockVerification from "../Inventory/StockVerification";
import Pending from "../Inventory/Pending";
import Expenses from "../Accounting/Expenses";
import AccountingReports from "../Accounting/Reports";
import AccountingSettings from "../Accounting/Settings";
// Import new accounting pages
import SupplierEnterBill from "../Accounting/SupplierEnterBill";
import Payment from "../Accounting/Payment";
import AdvancePayment from "../Accounting/AdvancePayment";
import MakeDeposit from "../Accounting/MakeDeposit";
import Receipt from "../Accounting/Receipt";
import UtilityBill from "../Accounting/UtilityBill";
import UtilityBillPayment from "../Accounting/UtilityBillPayment";
import JournalEntry from "../Accounting/JournalEntry";
import PettyCash from "../Accounting/PettyCash";
import Cheque from "../Accounting/Cheque";
import BankReconciliation from "../Accounting/BankReconciliation";

import employeeService from "../../services/EmployeeDataService";
import { fetchDepartments } from "../../services/ApiDataService";
import timeCardService from "../../services/timeCardService";
import ProtectedComponent from "../../components/ProtectedComponent";
import SingleEntryReport from "@src/pages/Reports/TimeCard/SingleEntryReport";
import AttendanceReport from "../Reports/TimeCard/AttendanceReport";
import EmployeeAttendanceReport from "@dashboard/EmployeeAttendanceReport";
import LeaveSettings from "./LeaveSettings";
import EmployeeLeaveBalance from "@dashboard/EmployeeLeaveBalance";
import EmployeeSalaryRecordView from "@dashboard/EmployeeSalaryRecordView";
import SalaryRecords from "@dashboard/SalaryRecords";

// Check if this line is missing and add it
import AbsentReport from "../Reports/TimeCard/AbsentReport";

import AllowancessPaymentFull from "../Dashboard/Allowancess_payment_full";
import AdvanceApprovals from "../Dashboard/AdvanceApprovals";
import LoanApprovals from "../Dashboard/LoanApprovals";
import WeeklyOffManagement from "../Dashboard/WeeklyOffManagement";
import MedicalClaims from "../Dashboard/MedicalClaims";
import PendingPayments from "../Dashboard/PendingPayments";
import CompanyNotices from "../Dashboard/CompanyNotices";

import DinnerAllowance from "@dashboard/DinnerAllowance";
import FishDeductionManagement from "./FishDeductionManagement";
import PayeManagement from "@dashboard/PayeManagement";
import OffDayHolidayManagement from "@dashboard/OffDayHolidayManagement";


import MidShiftBreaks from "@dashboard/MidShiftBreaks";

import SupervisorLeaveApproval from "@dashboard/SupervisorLeaveApproval";

import { useLocation, useNavigate } from "react-router-dom";
import { isEmployeeUser, enterEmployeePortal } from "../../services/UserService";
import {
  sidebarUtils,
  toggleSidebar,
  closeSidebar,
  isOutsideClick,
  handleBreakpointChange,
} from "../../utils/SidebarUtils";
import { getResponsive } from "../../utils/ResponsiveUtils";
import AllowanceManagement from "./AllowanceManagement";
import DeductionManagement from "./DeductionManagement";
import BonusManagement from "./BonusManagement";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

// ─── DashboardStats ───────────────────────────────────────────────────────────
const DashboardStats = () => {
  const [stats, setStats] = useState([
    { name: "Total Employees", value: "-", change: "-", icon: Users },
    { name: "Present Today", value: "-", change: "-", icon: UserCheck },
    { name: "On Leave", value: "-", change: "-", icon: Calendar },
    { name: "Departments", value: "-", change: "-", icon: Building2 },
  ]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const employees = await employeeService.fetchEmployees();
        const departments = await fetchDepartments();
        const todayStats = await timeCardService.fetchTodayStats();

        setStats([
          {
            name: "Total Employees",
            value: employees.length,
            change: "+12%",
            icon: Users,
          },
          {
            name: "Present Today",
            value: todayStats.present,
            change: "+2.3%",
            icon: UserCheck,
          },
          {
            name: "On Leave",
            value: todayStats.on_leave,
            change: "-5.4%",
            icon: Calendar,
          },
          {
            name: "Departments",
            value: departments.length,
            change: "+1",
            icon: Building2,
          },
        ]);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
      {stats.map((stat, index) => {
        const accents = [
          { bar: "from-teal-500 to-teal-400", iconBg: "bg-teal-500/15 text-teal-700" },
          { bar: "from-sky-500 to-cyan-400", iconBg: "bg-sky-500/15 text-sky-700" },
          { bar: "from-amber-500 to-orange-400", iconBg: "bg-amber-500/15 text-amber-700" },
          { bar: "from-[#FF6B4A] to-orange-400", iconBg: "bg-orange-500/15 text-orange-700" },
        ][index % 4];
        return (
          <div
            key={index}
            className="anim-rise relative overflow-hidden rounded-2xl bg-white border border-teal-50 shadow-[0_12px_40px_rgba(6,42,50,0.08)] p-6 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(6,42,50,0.14)] transition-all duration-300"
            style={{ animationDelay: `${index * 0.07}s` }}
          >
            <div
              className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accents.bar}`}
            />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-1">{stat.name}</p>
                <p className="font-display text-3xl font-bold text-[var(--brand-ink)] mt-1">
                  {stat.value}
                </p>
                <p
                  className={`text-sm mt-3 font-semibold ${
                    stat.change.startsWith("+") ? "text-teal-600" : "text-red-500"
                  }`}
                >
                  {stat.change} from last month
                </p>
              </div>
              <div className={`p-4 rounded-2xl ${accents.iconBg}`}>
                <stat.icon className="h-7 w-7" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ─── DashboardCharts ──────────────────────────────────────────────────────────
const DashboardCharts = () => {
  const [attendanceData, setAttendanceData] = useState({
    labels: [],
    datasets: [],
  });
  const [departmentData, setDepartmentData] = useState({
    labels: [],
    datasets: [],
  });

  useEffect(() => {
    async function fetchChartData() {
      try {
        const weekly = await timeCardService.fetchWeeklyAttendanceStats();

        setAttendanceData({
          labels: weekly.days,
          datasets: [
            {
              label: "Present",
              data: weekly.present,
              backgroundColor: "rgba(13, 148, 136, 0.75)",
              borderColor: "rgba(11, 79, 92, 1)",
              borderWidth: 2,
              borderRadius: 8,
              borderSkipped: false,
            },
            {
              label: "Absent",
              data: weekly.absent,
              backgroundColor: "rgba(255, 107, 74, 0.75)",
              borderColor: "rgba(220, 80, 50, 1)",
              borderWidth: 2,
              borderRadius: 8,
              borderSkipped: false,
            },
          ],
        });

        const departments = await fetchDepartments();
        const deptLabels = departments.map((d) => d.name);
        const deptCounts = departments.map((d) => d.employees || 0);

        setDepartmentData({
          labels: deptLabels,
          datasets: [
            {
              data: deptCounts,
              backgroundColor: [
                "rgba(13, 148, 136, 0.85)",
                "rgba(255, 107, 74, 0.85)",
                "rgba(245, 165, 36, 0.85)",
                "rgba(56, 189, 248, 0.85)",
                "rgba(11, 79, 92, 0.85)",
                "rgba(45, 212, 191, 0.85)",
              ],
              borderColor: [
                "rgba(13, 148, 136, 1)",
                "rgba(255, 107, 74, 1)",
                "rgba(245, 165, 36, 1)",
                "rgba(56, 189, 248, 1)",
                "rgba(11, 79, 92, 1)",
                "rgba(45, 212, 191, 1)",
              ],
              borderWidth: 2,
            },
          ],
        });
      } catch (error) {
        console.error("Error fetching chart data:", error);
      }
    }
    fetchChartData();
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className="bg-white p-7 rounded-2xl shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-teal-50 hover:shadow-xl transition-all duration-300 anim-rise">
        <div className="flex items-center mb-6">
          <div className="bg-teal-100 p-2.5 rounded-xl mr-3">
            <Clock className="h-6 w-6 text-teal-700" />
          </div>
          <h3 className="text-xl font-display font-bold text-[var(--brand-ink)]">Weekly Attendance</h3>
        </div>
        <div className="h-80">
          <Bar
            data={attendanceData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "top",
                  labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 12, weight: "bold" },
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: "rgba(0, 0, 0, 0.1)" },
                  ticks: {
                    callback: (value) => value.toLocaleString(),
                    font: { size: 11 },
                  },
                },
                x: {
                  grid: { display: false },
                  ticks: { font: { size: 11 } },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="bg-white p-7 rounded-2xl shadow-[0_12px_36px_rgba(6,42,50,0.08)] border border-emerald-50 hover:shadow-xl transition-all duration-300 anim-rise" style={{ animationDelay: "0.08s" }}>
        <div className="flex items-center mb-6">
          <div className="bg-emerald-100 p-2.5 rounded-xl mr-3">
            <Building2 className="h-6 w-6 text-emerald-700" />
          </div>
          <h3 className="text-xl font-display font-bold text-[var(--brand-ink)]">
            Department Distribution
          </h3>
        </div>
        <div className="h-80">
          <Pie
            data={departmentData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: "right",
                  labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: { size: 12, weight: "bold" },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ─── QuickActions ─────────────────────────────────────────────────────────────
const QuickActions = ({ setActiveItem }) => {
  const actions = [
    {
      icon: Users,
      label: "Add Employee",
      action: "employeeMaster",
      iconBg: "bg-teal-100",
      iconColor: "text-teal-700",
    },
    {
      icon: Calendar,
      label: "Leave",
      action: "leaveMaster",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-700",
    },
    {
      icon: Clock,
      label: "Time Cards",
      action: "TimeCard",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-700",
    },
    {
      icon: DollarSign,
      label: "Loan",
      action: "employeeLoan",
      iconBg: "bg-sky-100",
      iconColor: "text-sky-700",
    },
    {
      icon: PieChart,
      label: "Leave Calendar",
      action: "leavecalendar",
      iconBg: "bg-orange-100",
      iconColor: "text-[#FF6B4A]",
    },
  ];

  return (
    <div className="bg-white/90 p-7 rounded-2xl shadow-[0_12px_40px_rgba(6,42,50,0.08)] border border-teal-50 mb-8">
      <h3 className="font-display text-xl font-bold text-[var(--brand-ink)] mb-5">
        Quick Actions
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={() => setActiveItem(action.action)}
            className="group flex flex-col items-center justify-center p-5 rounded-2xl bg-gradient-to-br from-teal-50/80 to-white border border-teal-50 hover:border-teal-200 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
          >
            <div
              className={`${action.iconBg} p-3 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-300`}
            >
              <action.icon className={`h-6 w-6 ${action.iconColor}`} />
            </div>
            <span className="text-sm font-semibold text-slate-700 group-hover:text-[var(--brand-ink)]">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── AdminHRDashboardHome ─────────────────────────────────────────────────────
const AdminHRDashboardHome = ({ setActiveItem }) => (
  <>
    <DashboardStats />
    <QuickActions setActiveItem={setActiveItem} />
    <DashboardCharts />
  </>
);

// ─── Dashboard (main) ─────────────────────────────────────────────────────────
const Dashboard = ({ user, onLogout }) => {
  const { branding } = useBranding();
  const [activeItem, setActiveItem] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [employeeProfile, setEmployeeProfile] = useState(null);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [lateCount, setLateCount] = useState(0);
  const responsive = getResponsive();

  useEffect(() => {
    const onNavigate = (event) => {
      const id = event?.detail;
      if (typeof id === "string" && id) setActiveItem(id);
    };
    window.addEventListener("hr:navigate", onNavigate);
    return () => window.removeEventListener("hr:navigate", onNavigate);
  }, []);

  // Fetch employee profile for employee role
  useEffect(() => {
    if (user.role === "employee" && user.employee_id) {
      fetchEmployeeProfile();
    }

    // Listen for employee updates
    const handleEmployeeUpdate = (event) => {
      if (user.role === "employee" && event.detail.employeeId === user.employee_id) {
        fetchEmployeeProfile();
      }
    };

    window.addEventListener('employeeUpdated', handleEmployeeUpdate);

    return () => {
      window.removeEventListener('employeeUpdated', handleEmployeeUpdate);
    };
  }, [user]);

  const fetchEmployeeProfile = () => {
    employeeService
      .fetchEmployeeById(user.employee_id)
      .then((data) => {
        setEmployeeProfile(data);
        if (data?.attendance_employee_no) {
          fetchAttendanceRecords(data.attendance_employee_no);
        }
      })
      .catch((err) =>
        console.error("Error fetching employee profile:", err)
      );
  };

  const fetchAttendanceRecords = async (empNo) => {
    setIsLoadingAttendance(true);
    try {
      const response = await timeCardService.searchEmployeeTimeCards(empNo);
      if (response && Array.isArray(response)) {
        setAttendanceRecords(response); // full records pass කරනවා
        calculateLateCount(response);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const calculateLateCount = (records) => {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const lateDates = [...new Set(
      records
        .filter(record => {
          const recordDate = new Date(record.date);
          return (
            recordDate.getMonth() === currentMonth &&
            recordDate.getFullYear() === currentYear &&
            record.status === 'Late Coming'
          );
        })
        .map(r => r.date)
    )];
    setLateCount(lateDates.length);
  };

  useEffect(() => {
    const unsubscribe = sidebarUtils.subscribe((isOpen) => {
      setIsSidebarOpen(isOpen);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    handleBreakpointChange(responsive.isDesktop);
  }, [responsive.isDesktop]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if ((responsive.isMobile || responsive.isTablet) && isSidebarOpen) {
        if (isOutsideClick(event)) {
          closeSidebar();
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isSidebarOpen, responsive.isMobile, responsive.isTablet]);

  const toggle = () => toggleSidebar();

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isEmployeeUser(user)) {
      navigate("/employee-portal", { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    if (
      parts[0] === "dashboard" &&
      parts[1] === "pms" &&
      parts[2] === "evaluation"
    ) {
      setActiveItem("employeeEvaluation");
    } else {
      const section = parts[1] || "dashboard";
      if (section && section !== activeItem) {
        setActiveItem(section);
      }
    }
  }, [location.pathname]);

  const handleSetActiveItem = (id) => {
    setActiveItem(id);
    if (id === "dashboard") navigate("/dashboard", { replace: false });
    else if (id === "employeeEvaluation")
      navigate("/dashboard/pms/evaluation", { replace: false });
    else navigate(`/dashboard/${id}`, { replace: false });
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeItem]);

  const renderContent = () => {
    switch (activeItem) {
      case "employeeMaster":
        return (
          <ProtectedComponent module="employeeMaster" action="view">
            <EmployeeMaster />
          </ProtectedComponent>
        );
      case "employeeAdd":
        return (
          <ProtectedComponent module="employeeAdd" action="view">
            <EmployeeAdd />
          </ProtectedComponent>
        );
      case "show":
        return (
          <ProtectedComponent module="show" action="view">
            <ShowEmployee />
          </ProtectedComponent>
        );
      case "myProfile":
        return <MyProfile />;
      case "EmployeeMaster":
        return (
          <ProtectedComponent module="EmployeeMaster" action="view">
            <EmployeeMaster />
          </ProtectedComponent>
        );
      case "createNewDeduction":
        return (
          <ProtectedComponent module="createNewDeduction" action="view">
            <DeductionManagement />
          </ProtectedComponent>
        );
      case "createNewBonus":
        return (
          <ProtectedComponent module="createNewBonus" action="view">
            <BonusManagement />
          </ProtectedComponent>
        );
      case "shiftTime":
        return (
          <ProtectedComponent module="shiftTime" action="view">
            <ShiftSchedule />
          </ProtectedComponent>
        );
      case "createNewAllowance":
        return (
          <ProtectedComponent module="createNewAllowance" action="view">
            {/* <CreateNewAllowance /> */}
            <AllowanceManagement />
          </ProtectedComponent>
        );
      case "employeeLoan":
        return (
          <ProtectedComponent module="employeeLoan" action="view">
            <EmployeeLoan />
          </ProtectedComponent>
        );
      case "loanApprovals":
        return (
          <ProtectedComponent module="loanApprovals" action="view">
            <LoanApprovals />
          </ProtectedComponent>
        );
      case "viewLoans":
        return (
          <ProtectedComponent module="viewLoans" action="view">
            {user.role === 'employee' ? (
              <EmployeeLoanView employeeProfile={employeeProfile} />
            ) : (
              <ViewLoans />
            )}
          </ProtectedComponent>
        );
      case "noPayManagement":
        return (
          <ProtectedComponent module="noPayManagement" action="view">
            <NoPayManagement />
          </ProtectedComponent>
        );
      case "monthlyLateDeduction":
        return (
          <ProtectedComponent module="monthlyLateDeduction" action="view">
            <MonthlyLateDeduction />
          </ProtectedComponent>
        );
      case "excessLateReview":
        return (
          <ProtectedComponent module="excessLateReview" action="view">
            <ExcessLateReview />
          </ProtectedComponent>
        );
      case "personalOut":
        return (
          <ProtectedComponent module="personalOut" action="view">
            <PersonalOut />
          </ProtectedComponent>
        );
      case "hrLeaveApproval":
        return (
          <ProtectedComponent module="hrLeaveApproval" action="view">
            <HRLeaveApproval />
          </ProtectedComponent>
        );
      case "leaveApproval":
        return (
          <ProtectedComponent module="leaveApproval" action="view">
            <LeaveApproval />
          </ProtectedComponent>
        );
      case "leaveMaster":
        return (
          <ProtectedComponent module="leaveMaster" action="view">
            <LeaveMaster employeeProfile={employeeProfile} />
          </ProtectedComponent>
        );
      case "TimeCard":
        return (
          <ProtectedComponent module="TimeCard" action="view">
            {user.role === 'employee' ? (
              <EmployeeAttendanceReport employeeProfile={employeeProfile} />
            ) : (
              <TimeCard employeeProfile={null} />
            )}
          </ProtectedComponent>
        );
      case "Overtime":
        return (
          <ProtectedComponent module="Overtime" action="view">
            <Overtime />
          </ProtectedComponent>
        );
      case "lateEarlyApproval":
        return (
          <ProtectedComponent module="lateEarlyApproval" action="view">
            <LateEarlyApproval />
          </ProtectedComponent>
        );
      case "timeCardApproval":
        return (
          <ProtectedComponent module="timeCardApproval" action="view">
            <TimeCardApproval />
          </ProtectedComponent>
        );
      case "departmentMaster":
        return (
          <ProtectedComponent module="departmentMaster" action="view">
            <Department />
          </ProtectedComponent>
        );
      case "grouproster":
        return (
          <ProtectedComponent module="grouproster" action="view">
            <Grouproster />
          </ProtectedComponent>
        );
      case "rosterCalendar":
        return (
          <ProtectedComponent module="rosterCalendar" action="view">
            <RosterCalendar />
          </ProtectedComponent>
        );
      case "shiftOvertimeRates":
        return (
          <ProtectedComponent module="shiftOvertimeRates" action="view">
            <ShiftOvertimeRates />
          </ProtectedComponent>
        );
      case "leavecalendar":
        return (
          <ProtectedComponent module="leavecalendar" action="view">
            <LeaveCalendar employeeProfile={employeeProfile} />
          </ProtectedComponent>
        );
      case "SalaryProcessPage":
        return (
          <ProtectedComponent module="SalaryProcessPage" action="view">
            <SalaryProcessPage />
          </ProtectedComponent>
        );
      case "termination":
        return (
          <ProtectedComponent module="termination" action="view">
            <Termination />
          </ProtectedComponent>
        );
      case "SalaryPage":
        return (
          <ProtectedComponent module="SalaryPage" action="view">
            {user.role === 'employee' ? (
              <SalaryPage employeeProfile={employeeProfile} />
            ) : (
              <SalaryRecords />
            )}
          </ProtectedComponent>
        );
      case "payeManagement":
        return (
          <ProtectedComponent module="payeManagement" action="view">
            <PayeManagement />
          </ProtectedComponent>
        );
      case "offDayHolidayManagement":
        return (
          <ProtectedComponent module="offDayHolidayManagement" action="view">
            <OffDayHolidayManagement />
          </ProtectedComponent>
        );
      case "resignation":
        return (
          <ProtectedComponent module="resignation" action="view">
            <Resignation />
          </ProtectedComponent>
        );
      case "userManagement":
        return (
          <ProtectedComponent module="userManagement" action="view">
            <UserManagement />
          </ProtectedComponent>
        );
      case "accessControl":
        return (
          <ProtectedComponent module="accessControl" action="view">
            <AccessControl />
          </ProtectedComponent>
        );
      case "laborManagement":
        return (
          <ProtectedComponent module="laborManagement" action="view">
            <LaborManagement />
          </ProtectedComponent>
        );
      case "pmsDashboard":
        return (
          <ProtectedComponent module="pmsDashboard" action="view">
            <PMSDashboard />
          </ProtectedComponent>
        );
      case "performanceReviews":
        return (
          <ProtectedComponent module="performanceReviews" action="view">
            <PerformanceReviews />
          </ProtectedComponent>
        );
      case "kpis":
        return (
          <ProtectedComponent module="kpis" action="view">
            <KPIs />
          </ProtectedComponent>
        );
      case "employeeEvaluation":
        return <EmployeePerformanceEvaluation />;
      case "PerformanceAppraisal":
        return (
          <ProtectedComponent module="PerformanceAppraisal" action="view">
            <PerformanceAppraisal />
          </ProtectedComponent>
        );
      case "taskApproval":
        return (
          <ProtectedComponent module="taskApproval" action="view">
            <TaskApproval />
          </ProtectedComponent>
        );
      case "myKPIs":
        return (
          <ProtectedComponent module="myKPIs" action="view">
            <EmployeeKPIView />
          </ProtectedComponent>
        );

      case "supervisorLeaveApproval":
        return (
          <ProtectedComponent module="supervisorLeaveApproval" action="view">
            <SupervisorLeaveApproval />
          </ProtectedComponent>
        );

      // renderContent case :
      case "midShiftBreaks":
        return (
          <ProtectedComponent module="midShiftBreaks" action="view">
            <MidShiftBreaks />
          </ProtectedComponent>
        );
      case "absentReport":
        return (
          <ProtectedComponent module="absentReport" action="view">
            <AbsentReport />
          </ProtectedComponent>
        );
      case "shiftHoursReport":
        return (
          <ProtectedComponent module="shiftHoursReport" action="view">
            <ShiftHoursReport />
          </ProtectedComponent>
        );
      case "monthlyWorkingHoursReport":
        return (
          <ProtectedComponent module="monthlyWorkingHoursReport" action="view">
            <MonthlyHoursReport reportType="working" />
          </ProtectedComponent>
        );
      case "monthlyOtHoursReport":
        return (
          <ProtectedComponent module="monthlyOtHoursReport" action="view">
            <MonthlyHoursReport reportType="ot" />
          </ProtectedComponent>
        );
      case "contractAttendanceReport":
        return (
          <ProtectedComponent module="contractAttendanceReport" action="view">
            <ContractAttendanceReport />
          </ProtectedComponent>
        );
      case "dailyOtHoursReport":
        return (
          <ProtectedComponent module="dailyOtHoursReport" action="view">
            <DailyOtHoursReport />
          </ProtectedComponent>
        );
      case "timeCardAuditReport":
        return (
          <ProtectedComponent module="timeCardAuditReport" action="view">
            <TimeCardAuditReport />
          </ProtectedComponent>
        );
      case "deletedTimeCardReport":
        return (
          <ProtectedComponent module="deletedTimeCardReport" action="view">
            <TimeCardAuditReport defaultAction="deleted" />
          </ProtectedComponent>
        );
        {/*
      case "attendanceReport":
        return (
          <ProtectedComponent module="attendanceReport" action="view">

            <AttendanceReport />
          </ProtectedComponent>
        );
        */}

      case "attendanceReport":
        return (
          <ProtectedComponent module="attendanceReport" action="view">
            {user.role === "employee" ? (
              /* Employee kenek nam eyage report eka witharai */
              <EmployeeAttendanceReport employeeProfile={employeeProfile} />
            ) : (
              /* Admin hari HR hari nam loku report eka witharai */
              <AttendanceReport employeeProfile={employeeProfile} />
            )}
          </ProtectedComponent>
        );
      case "singleEntryReport":
        return (
          <ProtectedComponent module="singleEntryReport" action="view">
            <SingleEntryReport />
          </ProtectedComponent>
        );
      case "lms":
        return (
          <ProtectedComponent module="lms" action="view">
            <LMS />
          </ProtectedComponent>
        );
      case "lmsDashboard":
        return (
          <ProtectedComponent module="lms" action="view">
            <LMS initialView="dashboard" />
          </ProtectedComponent>
        );
      case "manageExams":
        return (
          <ProtectedComponent module="manageExams" action="view">
            <LMS initialView="exams" />
          </ProtectedComponent>
        );
      case "manageCourses":
        return (
          <ProtectedComponent module="manageCourses" action="view">
            <LMS initialView="manage" />
          </ProtectedComponent>
        );
      case "myProgress":
        return (
          <ProtectedComponent module="myProgress" action="view">
            <LMS initialView="progress" />
          </ProtectedComponent>
        );
      case "lmsUserStats":
        return (
          <ProtectedComponent module="lmsUserStats" action="view">
            <UserStats />
          </ProtectedComponent>
        );
      case "accountingDashboard":
        return (
          <ProtectedComponent module="accountingDashboard" action="view">
            <AccountingDashboard setActiveItem={setActiveItem} />
          </ProtectedComponent>
        );
      case "customer":
        return (
          <ProtectedComponent module="customer" action="view">
            <Customer />
          </ProtectedComponent>
        );
      case "center":
        return (
          <ProtectedComponent module="center" action="view">
            <Center />
          </ProtectedComponent>
        );
      case "product":
        return (
          <ProtectedComponent module="product" action="view">
            <ProductList />
          </ProtectedComponent>
        );
      case "productType":
        return (
          <ProtectedComponent module="productType" action="view">
            <ProductType />
          </ProtectedComponent>
        );
      case "discountLevel":
        return (
          <ProtectedComponent module="discountLevel" action="view">
            <DiscountLevel />
          </ProtectedComponent>
        );
      case "chartOfAccounts":
        return (
          <ProtectedComponent module="chartOfAccounts" action="view">
            <ChartOfAccounts />
          </ProtectedComponent>
        );
      case "accountList":
        return (
          <ProtectedComponent module="accountList" action="view">
            <AccountList />
          </ProtectedComponent>
        );
      case "transactions":
      case "transactionsList":
        return (
          <ProtectedComponent module="transactions" action="view">
            <Transactions />
          </ProtectedComponent>
        );
      case "ledger":
        return (
          <ProtectedComponent module="ledger" action="view">
            <Ledger />
          </ProtectedComponent>
        );
      case "trialBalance":
        return (
          <ProtectedComponent module="trialBalance" action="view">
            <TrialBalance />
          </ProtectedComponent>
        );
      case "incomeStatement":
        return (
          <ProtectedComponent module="incomeStatement" action="view">
            <IncomeStatement />
          </ProtectedComponent>
        );
      case "balanceSheet":
        return (
          <ProtectedComponent module="balanceSheet" action="view">
            <BalanceSheet />
          </ProtectedComponent>
        );
      case "cashFlowStatement":
        return (
          <ProtectedComponent module="cashFlowStatement" action="view">
            <CashFlowStatement />
          </ProtectedComponent>
        );
      case "invoices":
        return (
          <ProtectedComponent module="invoices" action="view">
            <Invoices />
          </ProtectedComponent>
        );
      case "salesOrder":
        return (
          <ProtectedComponent module="salesOrder" action="view">
            <SalesOrder />
          </ProtectedComponent>
        );
      case "salesReturn":
        return (
          <ProtectedComponent module="salesReturn" action="view">
            <SalesReturn />
          </ProtectedComponent>
        );
      case "grn":
        return (
          <ProtectedComponent module="grn" action="view">
            <GRN />
          </ProtectedComponent>
        );
      case "purchaseReturn":
        return (
          <ProtectedComponent module="purchaseReturn" action="view">
            <PurchaseReturn />
          </ProtectedComponent>
        );
      case "purchaseOrder":
        return (
          <ProtectedComponent module="purchaseOrder" action="view">
            <PurchaseOrder />
          </ProtectedComponent>
        );
      case "stockTransfer":
        return (
          <ProtectedComponent module="stockTransfer" action="view">
            <StockTransfer />
          </ProtectedComponent>
        );
      case "stockVerification":
        return (
          <ProtectedComponent module="stockVerification" action="view">
            <StockVerification />
          </ProtectedComponent>
        );
      case "pendingApprovals":
        return (
          <ProtectedComponent module="pendingApprovals" action="view">
            <Pending />
          </ProtectedComponent>
        );
      case "supplier":
        return (
          <ProtectedComponent module="supplier" action="view">
            <Supplier />
          </ProtectedComponent>
        );
      case "accountingReports":
        return (
          <ProtectedComponent module="accountingReports" action="view">
            <AccountingReports />
          </ProtectedComponent>
        );
      case "accountingSettings":
        return (
          <ProtectedComponent module="accountingSettings" action="view">
            <AccountingSettings />
          </ProtectedComponent>
        );
      case "supplierEnterBill":
        return (
          <ProtectedComponent module="supplierEnterBill" action="view">
            <SupplierEnterBill />
          </ProtectedComponent>
        );
      case "payment":
        return (
          <ProtectedComponent module="payment" action="view">
            <Payment />
          </ProtectedComponent>
        );
      case "advancePayment":
        return (
          <ProtectedComponent module="advancePayment" action="view">
            <AdvancePayment />
          </ProtectedComponent>
        );
      case "makeDeposit":
        return (
          <ProtectedComponent module="makeDeposit" action="view">
            <MakeDeposit />
          </ProtectedComponent>
        );
      case "receipt":
        return (
          <ProtectedComponent module="receipt" action="view">
            <Receipt />
          </ProtectedComponent>
        );
      case "createUtilityBill":
        return (
          <ProtectedComponent module="createUtilityBill" action="view">
            <UtilityBill />
          </ProtectedComponent>
        );
      case "utilityBillPayment":
        return (
          <ProtectedComponent module="utilityBillPayment" action="view">
            <UtilityBillPayment />
          </ProtectedComponent>
        );
      case "journalEntry":
        return (
          <ProtectedComponent module="journalEntry" action="view">
            <JournalEntry />
          </ProtectedComponent>
        );
      case "pettyCash":
        return (
          <ProtectedComponent module="pettyCash" action="view">
            <PettyCash />
          </ProtectedComponent>
        );
      case "cheque":
        return (
          <ProtectedComponent module="cheque" action="view">
            <Cheque />
          </ProtectedComponent>
        );
      case "doubleEntry":
        return (
          <ProtectedComponent module="doubleEntry" action="view">
            <DoubleEntry />
          </ProtectedComponent>
        );
      case "bankReconciliation":
        return (
          <ProtectedComponent module="bankReconciliation" action="view">
            <BankReconciliation />
          </ProtectedComponent>
        );
      case "leaveSettings":
        return (
          <ProtectedComponent module="leaveSettings" action="view">
            <LeaveSettings />
          </ProtectedComponent>
        );
      case "employeeLeaveBalance":
        return (
          <ProtectedComponent module="employeeLeaveBalance" action="view">
            <EmployeeLeaveBalance />
          </ProtectedComponent>
        );
      case "nopayWorkingDays":
        return (
          <ProtectedComponent module="nopayWorkingDays" action="view">
            <NopayWorkingDaysSettings />
          </ProtectedComponent>
        );
      case "dinnerAllowance":
        return (
          <ProtectedComponent module="dinnerAllowance" action="view">
            <DinnerAllowance />
          </ProtectedComponent>
        );
      case "fishDeduction":
        return (
          <ProtectedComponent module="fishDeduction" action="view">
            <FishDeductionManagement />
          </ProtectedComponent>
        );
      case "chatbot":
        return (
          <ProtectedComponent module="chatbot" action="view">
            <Chatbot />
          </ProtectedComponent>
        );
      case "changePassword":
        return <ChangePassword />;
      case "downloadSalarySlip":
        return (
          <ProtectedComponent module="downloadSalarySlip" action="view">
            <SalaryPage employeeProfile={employeeProfile} />
          </ProtectedComponent>
        );

      case "allowancesReport":
        return (
          <ProtectedComponent module="allowancesReport" action="view">
            <AllowancessPaymentFull />
          </ProtectedComponent>
        );

      case "advanceApprovals":
        return (
          <ProtectedComponent module="advanceApprovals" action="view">
            <AdvanceApprovals />
          </ProtectedComponent>
        );

      case "weeklyOffManagement":
        return (
          <ProtectedComponent module="weeklyOffManagement" action="view">
            <WeeklyOffManagement />
          </ProtectedComponent>
        );

      case "medicalClaims":
        return (
          <ProtectedComponent module="medicalClaims" action="view">
            <MedicalClaims />
          </ProtectedComponent>
        );

      case "companyNotices":
        return (
          <ProtectedComponent module="companyNotices" action="view">
            <CompanyNotices />
          </ProtectedComponent>
        );

      case "pendingPayments":
        return (
          <ProtectedComponent module="pendingPayments" action="view">
            <PendingPayments />
          </ProtectedComponent>
        );

      case "employeePortal":
        enterEmployeePortal();
        navigate("/employee-portal");
        return null;

      case "salaryRecords":
        return (
          <ProtectedComponent module="salaryRecords" action="view">
            {user.role === 'employee' ? (
              <EmployeeSalaryRecordView employeeProfile={employeeProfile} />
            ) : (
              <SalaryRecords />
            )}
          </ProtectedComponent>
        );

      default:
        // Home / dashboard view
        return (
          <div className="space-y-8 anim-rise">
            <div
              className="relative overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(6,42,50,0.18)] p-8 sm:p-10 text-white"
              style={{
                background:
                  "linear-gradient(125deg, #062A32 0%, #0B4F5C 40%, #0D9488 78%, #FF6B4A 125%)",
              }}
            >
              <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/10 blur-2xl anim-float" />
              <div className="absolute -left-8 bottom-0 w-40 h-40 rounded-full bg-amber-300/20 blur-xl" />
              <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-teal-100/90">
                Management dashboard
              </p>
              <h1 className="relative font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold mt-2 max-w-2xl leading-tight">
                {user.role === "employee"
                  ? "Your staff portal"
                  : `${branding?.name || "HR"} control center`}
              </h1>
              <p className="relative mt-3 text-teal-50/90 text-base sm:text-lg max-w-xl">
                {user.role === "employee"
                  ? "Attendance, leave and payslips — clear and colorful."
                  : "Workforce, attendance, leave and payroll at a glance."}
              </p>
            </div>
            {user.role === "employee" ? (
              <EmployeeDashboardComponent
                employeeProfile={employeeProfile}
                attendanceRecords={attendanceRecords}
                isLoadingAttendance={isLoadingAttendance}
                lateCount={lateCount}
                setActiveItem={handleSetActiveItem}
              />
            ) : (
              <AdminHRDashboardHome setActiveItem={handleSetActiveItem} />
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen dash-shell flex">
      <Sidebar
        user={user}
        employeeProfile={employeeProfile}
        onLogout={onLogout}
        activeItem={activeItem}
        setActiveItem={handleSetActiveItem}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col lg:ml-0 min-w-0">
        <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-teal-100/70 shadow-sm flex-shrink-0">
          <div className="px-3 sm:px-4 lg:px-6 xl:px-8">
            <div className="flex justify-between h-14 sm:h-16">
              <div className="flex items-center lg:hidden">
                <button
                  data-hamburger
                  onClick={toggle}
                  className="text-teal-800 hover:text-[var(--brand-ink)] focus:outline-none p-2 rounded-xl hover:bg-teal-50 transition-colors duration-200"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              </div>
              <div className="hidden lg:flex items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md"
                    style={{
                      background: "linear-gradient(135deg, var(--brand-teal), var(--brand-coral))",
                    }}
                  >
                    <Building2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <span className="font-display text-lg font-bold text-[var(--brand-ink)] block leading-tight">
                      {user.role === "employee" ? "Staff Portal" : "HR Dashboard"}
                    </span>
                    <span className="text-[11px] font-semibold text-teal-700/80 tracking-wide">
                      Professional management
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="hidden sm:flex text-slate-700 items-center gap-2 text-sm">
                  Welcome, <strong className="text-[var(--brand-ink)]">{user.name}</strong>
                  <span
                    className="inline-flex items-center gap-1 text-white text-xs font-bold px-3 py-1 rounded-full capitalize shadow-sm"
                    style={{
                      background: "linear-gradient(120deg, var(--brand-teal), var(--brand-deep) 70%, var(--brand-coral))",
                    }}
                  >
                    {user.role}
                  </span>
                </span>
                <NotificationBell />
                <button
                  onClick={onLogout}
                  className="text-white px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 shadow-md hover:brightness-110"
                  style={{
                    background: "linear-gradient(120deg, var(--brand-coral), #e11d48)",
                  }}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex-1">
          <div className="py-4 sm:py-5 lg:py-7 px-3 sm:px-4 lg:px-6 xl:px-8">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;