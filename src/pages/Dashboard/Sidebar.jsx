import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Home,
  UserCheck,
  DollarSign,
  Calendar,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  X,
  User,
  MessageCircle,
  Key,
  Briefcase,
  Shield,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useBranding } from "../../contexts/BrandingContext";
import { isEmployeeUser, canUseHrDesk, canUseEmployeePortal, enterEmployeePortal } from "../../services/UserService";
import { useNavigate } from "react-router-dom";
import config from "@src/config";
import { mediaUrl } from "../../utils/mediaUrl";
import { fetchCompanies } from "../../services/ApiDataService";
import BrandLogo from "../../components/BrandLogo";

const Sidebar = ({
  user,
  employeeProfile,
  onLogout,
  activeItem,
  setActiveItem,
  isOpen,
  setIsOpen,
}) => {
  const authContext = useAuth() || {};
  const hasPermission = authContext.hasPermission || (() => true);
  const { branding } = useBranding();
  const navigate = useNavigate();
  const [companyLogo, setCompanyLogo] = useState(branding?.logo_url || "");
  const [companyName, setCompanyName] = useState(branding?.name || "");
  const showOwnPayLeave = canUseHrDesk(user) && canUseEmployeePortal(user);

  useEffect(() => {
    if (branding?.logo_url) setCompanyLogo(branding.logo_url);
    if (branding?.name) setCompanyName(branding.name);
  }, [branding]);

  const [currentCompany, setCurrentCompany] = useState(null);

  useEffect(() => {
    if (isEmployeeUser(user)) return;
    let cancelled = false;
    (async () => {
      const rows = await fetchCompanies();
      const list = Array.isArray(rows) ? rows : [];
      const active =
        list.find((row) => (user?.company_id && Number(row.id) === Number(user.company_id)) || row.portal_active) ||
        list[0];
      if (cancelled || !active) return;
      setCurrentCompany(active);
      if (active.logo_url) setCompanyLogo(active.logo_url);
      if (active.name) setCompanyName(active.name);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const [expandedItems, setExpandedItems] = useState({
    hrMaster: false,
    allowanceDeduction: false,
    loans: false,
    salaryProcess: false,
    timeAttendance: false,
    reports: false,
    timecardReports: false,
    salaryReports: false,
    settings: false,
  });

  const menuItems = useMemo(() => {
    // 1. සේවකයෙකු සඳහා (Employee Role) පෙන්විය යුතු මෙනු පද්ධතිය
    if (isEmployeeUser(user)) {
      return [
        { id: "employeePortal", name: "Employee Portal", icon: Briefcase },
      ];
    }

    // 2. Admin 
    return [
      { id: "dashboard", name: "Dashboard", icon: Home },
      { id: "accessControl", name: "Access Control (ACL)", icon: Shield },
      { id: "userManagement", name: "User Management", icon: Users },
      { id: "laborManagement", name: "Labor Management", icon: Briefcase },
      {
        id: "hrMaster",
        name: "HRM Master",
        icon: Users,
        subItems: [
          { id: "show", name: "Show Employee", icon: UserCheck },
          { id: "employeeMaster", name: "Add Employee Master" },
          { id: "departmentMaster", name: "Department Master" },
          { id: "shiftTime", name: "Shift Time" },
          { id: "grouproster", name: "Roster" },
          { id: "rosterCalendar", name: "Roster Calendar" },
          { id: "shiftOvertimeRates", name: "Shift OT Rates" },
          { id: "resignation", name: "Resignation request" },
          { id: "termination", name: "Resignation approval" },
          {
            id: "allowanceDeduction",
            name: "Compensation",
            subItems: [
              { id: "createNewAllowance", name: "Allowance" },
              { id: "createNewDeduction", name: "Deduction" },
              { id: "createNewBonus", name: "Bonus" },
              { id: "dinnerAllowance", name: "Dinner Allowance" },
              { id: "fishDeduction", name: "Fish Deduction" },
            ],
          },
          {
            id: "loans",
            name: "Loans",
            subItems: [
              { id: "viewLoans", name: "View Loans" },
              { id: "loanApprovals", name: "Loan approval" },
              { id: "employeeLoan", name: "Employee Wise Loan" },
            ],
          },
          {
            id: "salaryProcess",
            name: "Salary Process",
            subItems: [
              { id: "SalaryProcessPage", name: "Salary Process" },
              { id: "SalaryPage", name: "View Salary" },
              { id: "payeManagement", name: "PAYE Management" },
              { id: "offDayHolidayManagement", name: "Off-Day & Holiday" },
            ],
          },
          {
            id: "timeAttendance",
            name: "Time Attendance",
            subItems: [
              { id: "TimeCard", name: "Time Card" },
              { id: "Overtime", name: "Over Time" },
              { id: "lateEarlyApproval", name: "Late / Early Approval" },
              { id: "timeCardApproval", name: "Time Card Approval" },
              { id: "monthlyLateDeduction", name: "Monthly Late Deduction" },
              { id: "excessLateReview", name: "Late Over 30 Minutes" },
              { id: "personalOut", name: "Personal Out" },
              { id: "leaveMaster", name: "Leave Form" },
              { id: "leaveApproval", name: "Leave Approval" },
              { id: "supervisorLeaveApproval", name: "Supervisor Leave Approval" },
              { id: "midShiftBreaks", name: "Mid-Shift Breaks" },
              { id: "hrLeaveApproval", name: "HR Leave Approval" },
              { id: "noPayManagement", name: "NoPay" },
              { id: "advanceApprovals", name: "Advance Approvals" },
              { id: "weeklyOffManagement", name: "Weekly Offs" },
              { id: "medicalClaims", name: "Medical Claims" },
              { id: "companyNotices", name: "Company notices" },
              { id: "pendingPayments", name: "Pending Payments" },
              { id: "leavecalendar", name: "Leave Calendar" },
            ],
          },
        ],
      },
      {
        id: "reports",
        name: "Reports",
        icon: BarChart3,
        subItems: [
          {
            id: "timecardReports",
            name: "Timecard Reports",
            icon: FileText,
            subItems: [
              { id: "attendanceReport", name: "Attendance Report" },
              { id: "singleEntryReport", name: "Single Entry Report" },
              { id: "absentReport", name: "Absent Report" },
              { id: "shiftHoursReport", name: "Shift Hours Reports" },
              { id: "contractAttendanceReport", name: "Contract Time Attendance" },
              { id: "dailyOtHoursReport", name: "Daily OT Hours" },
              { id: "monthlyWorkingHoursReport", name: "Monthly Working Hours" },
              { id: "monthlyOtHoursReport", name: "Monthly OT Hours" },
              { id: "timeCardAuditReport", name: "Time Card Audit Report" },
              { id: "deletedTimeCardReport", name: "Deleted Time Card Report" },
            ],
          },
          {
            id: "salaryReports",
            name: "Salary Reports",
            icon: DollarSign,
            subItems: [
              { id: "allowancesReport", name: "Allowances Report" },
            ],
          },
        ],
      },
      {
        id: "settings",
        name: "Settings",
        icon: Settings,
        subItems: [
          { id: "leaveSettings", name: "Leave Settings" },
          { id: "employeeLeaveBalance", name: "Employee Leave Balances" },
          { id: "nopayWorkingDays", name: "NoPay Working Days" },
        ],
      },
    ];
  }, [user?.role]);

  // Active Item එක අනුව මෙනු එක ස්වයංක්‍රීයව විවෘත කිරීම (Auto-expand)
  useEffect(() => {
    const findPath = (items, target) => {
      for (const item of items) {
        if (item.id === target) return [item.id];
        if (item.subItems) {
          const subPath = findPath(item.subItems, target);
          if (subPath) return [item.id, ...subPath];
        }
      }
      return null;
    };

    const path = findPath(menuItems, activeItem) || [];

    setExpandedItems({
      hrMaster: path.includes("hrMaster"),
      allowanceDeduction: path.includes("allowanceDeduction"),
      loans: path.includes("loans"),
      salaryProcess: path.includes("salaryProcess"),
      timeAttendance: path.includes("timeAttendance"),
      reports: path.includes("reports"),
      timecardReports: path.includes("timecardReports"),
      salaryReports: path.includes("salaryReports"),
      settings: path.includes("settings")
    });
  }, [activeItem, menuItems]);

  const toggleSection = (id) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Permission අනුව මෙනු Filter කිරීම (Admin සඳහා පමණයි මෙය වැඩ කරන්නේ)
  const filterMenuItems = (items, ancestors = []) => {
    if (isEmployeeUser(user)) return items;
    const isAdmin =
      String(user?.role || "").toLowerCase() === "admin" || !!user?.is_super_admin;

    return items
      .map((item) => {
        const alwaysShowItems = ["dashboard", "myProfile", "changePassword"];
        if (alwaysShowItems.includes(item.id)) return item;
        if (isAdmin && ["userManagement", "accessControl", "laborManagement"].includes(item.id)) {
          return item;
        }

        // Company feature toggle check for Fish Deduction
        if (item.id === "fishDeduction") {
          const isFishDeductionOn = !!(
            user?.is_super_admin ||
            (currentCompany?.process_config?.fish_deduction?.enabled ??
              currentCompany?.process_config?.fish_deduction === true)
          );
          if (!isFishDeductionOn) return null;
          if (!hasPermission("fishDeduction", "view")) return null;
          return item;
        }

        // Company feature toggle check for Stamp Duty, PAYE, Holiday & Off-Day Processing
        if (["payeManagement", "offDayHolidayManagement"].includes(item.id)) {
          const isStampPayeHolidayOn = !!(
            currentCompany?.process_config?.stamp_duty_paye_holiday?.enabled ??
            currentCompany?.process_config?.stamp_duty_paye_holiday === true
          );
          if (!isStampPayeHolidayOn) return null;
          if (!hasPermission(item.id, "view")) return null;
          return item;
        }

        if (item.subItems) {
          const filteredSubItems = filterMenuItems(item.subItems, [...ancestors, item.id]);
          if (filteredSubItems.length > 0 || hasPermission(item.id, "view")) {
            return { ...item, subItems: filteredSubItems };
          }
        } else if (hasPermission(item.id, "view") || ancestors.some((a) => hasPermission(a, "view"))) {
          return item;
        }
        return null;
      })
      .filter(Boolean);
  };

  const filteredMenuItems = filterMenuItems(menuItems);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-[var(--brand-ink)]/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <div
        className={`min-h-screen z-50 transform transition-transform duration-300 ease-in-out w-[272px] fixed left-0 top-0 lg:static lg:z-0 lg:translate-x-0 flex flex-col text-white ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg, var(--brand-ink) 0%, var(--brand-deep) 48%, color-mix(in srgb, var(--brand-ink) 70%, var(--brand-deep)) 100%)",
          boxShadow: "8px 0 40px rgba(var(--brand-ink-rgb), 0.25)",
        }}
      >
        <div className="px-4 pt-3 pb-4 border-b border-white/10 flex-shrink-0">
          <div className="flex flex-col items-stretch gap-2.5">
            {companyLogo && String(user?.role || "").toLowerCase() !== "employee" ? (
              <BrandLogo src={companyLogo} alt={companyName || "Company logo"} className="h-[84px] max-w-full" />
            ) : (
              <div
                className="self-start p-2.5 rounded-2xl shadow-lg"
                style={{
                  background: "linear-gradient(135deg, var(--brand-mint), var(--brand-teal) 50%, var(--brand-coral))",
                }}
              >
                <Building2 className="h-6 w-6 text-white" />
              </div>
            )}
            <div>
              <h2 className="font-display font-bold text-white leading-tight text-lg">
                {user?.role === "employee" ? "Staff Portal" : companyName || branding?.name || "HR Dashboard"}
              </h2>
              <p className="text-[11px] text-teal-200/80 font-medium tracking-wide">
                Management Suite
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/8 border border-white/10">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gradient-to-br from-teal-400 to-teal-700 text-white overflow-hidden ring-2 ring-white/20">
              {employeeProfile?.profile_photo_path ? (
                <img
                  src={mediaUrl(employeeProfile.profile_photo_path)}
                  className="w-full h-full rounded-full object-cover"
                  alt="Profile"
                />
              ) : (
                user?.name?.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                {user?.is_super_admin ? "Super Admin" : user?.role_label || user?.role}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 sidebar-scroll">
          <ul className="space-y-1">
            {filteredMenuItems.map((item) => (
              <li key={item.id}>
                {item.subItems ? (
                  <div className="mb-1">
                    <button
                      onClick={() => toggleSection(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        expandedItems[item.id]
                          ? "bg-white/12 text-white"
                          : "text-teal-50/80 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="h-4 w-4 text-teal-300" />
                        <span>{item.name}</span>
                      </div>
                      {expandedItems[item.id] ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                    {expandedItems[item.id] && (
                      <ul className="mt-1 ml-3 border-l border-teal-400/25 pl-2 space-y-0.5">
                        {item.subItems.map((sub) => (
                          <li key={sub.id}>
                            {sub.subItems ? (
                              <div>
                                <button
                                  onClick={() => toggleSection(sub.id)}
                                  className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-semibold text-teal-100/70 hover:text-white"
                                >
                                  <span>{sub.name}</span>
                                  {expandedItems[sub.id] ? (
                                    <ChevronDown className="h-3 w-3" />
                                  ) : (
                                    <ChevronRight className="h-3 w-3" />
                                  )}
                                </button>
                                {expandedItems[sub.id] && (
                                  <ul className="ml-2 space-y-0.5">
                                    {sub.subItems.map((nested) => (
                                      <li key={nested.id}>
                                        <button
                                          onClick={() => setActiveItem(nested.id)}
                                          className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                                            activeItem === nested.id
                                              ? "bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold shadow-md"
                                              : "text-teal-50/75 hover:bg-white/8"
                                          }`}
                                        >
                                          {nested.name}
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={() => setActiveItem(sub.id)}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                                  activeItem === sub.id
                                    ? "bg-gradient-to-r from-teal-500 to-teal-600 text-white font-semibold shadow-md"
                                    : "text-teal-50/75 hover:bg-white/8"
                                }`}
                              >
                                {sub.name}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveItem(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                      activeItem === item.id
                        ? "text-white shadow-lg shadow-teal-900/40"
                        : "text-teal-50/85 hover:bg-white/8"
                    }`}
                    style={
                      activeItem === item.id
                        ? {
                            background:
                              "linear-gradient(120deg, #0D9488 0%, #FF6B4A 160%)",
                          }
                        : undefined
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          {showOwnPayLeave ? (
            <button
              type="button"
              onClick={() => {
                enterEmployeePortal();
                navigate("/employee-portal");
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-teal-100 hover:bg-white/10 rounded-xl transition-colors"
            >
              <Wallet className="h-4 w-4" />
              <span>My salary & leave</span>
            </button>
          ) : null}
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-coral-200 hover:bg-red-500/15 rounded-xl transition-colors"
          >
            <LogOut className="h-4 w-4 text-[var(--brand-coral)]" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;





/*
import React, { useState, useEffect, useMemo } from "react";
import {
  Building2,
  Users,
  Home,
  UserCheck,
  DollarSign,
  Calendar,
  BarChart3,
  FileText,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  X,
  User2,
  UserPlus,
  User,
  Star,
  Target,
  Award,
  ClipboardCheck,
  PieChart,
  BookOpen,
  Calculator,
  Shield,
  MessageCircle,
  Package,
  Key,
  Briefcase,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useBranding } from "../../contexts/BrandingContext";
import config from "@src/config";
import { mediaUrl } from "../../utils/mediaUrl";

const Sidebar = ({
  user,
  employeeProfile,
  onLogout,
  activeItem,
  setActiveItem,
  isOpen,
  setIsOpen,
}) => {
  // Fallback for useAuth if it's undefined
  const authContext = useAuth() || {};
  const hasPermission = authContext.hasPermission || (() => true);

  const [expandedItems, setExpandedItems] = useState({
    hrMaster: false,
    allowanceDeduction: false,
    loans: false,
    salaryProcess: false,
    timeAttendance: false,
    pms: false,
    lms: false,
    accounting: false,
    chartOfAccounts: false,
    transactions: false,
    financeReports: false,
    inventory: false,
    masterFiles: false,
    reports: false,
    timecardReports: false,
    salaryReports: false, // <-- අලුත් එක
    settings: false,
  });

  const menuItems = useMemo(() => [
    { id: "dashboard", name: "Dashboard", icon: Home, badge: null },
    ...(user?.role === 'employee' ? [
      { id: "myProfile", name: "My Profile", icon: User, badge: null },
      { id: "changePassword", name: "Change Password", icon: Key, badge: null },
    ] : []),
    { id: "chatbot", name: "Chat with System", icon: MessageCircle },
    { id: "userManagement", name: "User Management", icon: Users },
    ...(user?.role !== 'employee' ? [{ id: "laborManagement", name: "Labor Management", icon: Briefcase }] : []),
    {
      id: "hrMaster",
      name: user?.role === 'employee' ? "Employee Master" : "HRM Master",
      icon: Users,
      badge: null,
      subItems: [
        { id: "show", name: "Show Employee", icon: UserCheck },
        { id: "employeeMaster", name: "Add Employee Master" },
        { id: "departmentMaster", name: "Department Master" },
        { id: "shiftTime", name: "Shift Time" },
        { id: "grouproster", name: "Roster" },
        { id: "shiftOvertimeRates", name: "Shift OT Rates" },
        { id: "resignation", name: "Resignation request" },
        { id: "termination", name: "Resignation approval" },
        {
          id: "allowanceDeduction",
          name: "Compensation",
          subItems: [
            { id: "createNewAllowance", name: "Allowance" },
            { id: "createNewDeduction", name: "Deduction" },
            { id: "createNewBonus", name: "Bonus" },
            { id: "dinnerAllowance", name: "Dinner Allowance" },
          ],
        },
        {
          id: "loans",
          name: "Loans",
          subItems: [
            { id: "viewLoans", name: "View Loans" },
            { id: "employeeLoan", name: "Employee Wise Loan" },
          ],
        },
        {
          id: "salaryProcess",
          name: "Salary Process",
          subItems: [
            { id: "SalaryProcessPage", name: "Salary Process" },
            { id: "SalaryPage", name: "View Salary" },
            ...(user?.role !== 'employee' ? [
              { id: "payeManagement", name: "PAYE Management" },
              { id: "offDayHolidayManagement", name: "Off-Day & Holiday" },
            ] : []),
            ...(user?.role === 'employee' ? [{ id: "salaryRecords", name: "Salary Records" }] : []),
            ...(user?.role === 'employee' ? [{ id: "downloadSalarySlip", name: "Download Salary Slip" }] : []),
          ],
        },
        {
          id: "timeAttendance",
          name: "Time Attendance",
          subItems: [
            { id: "TimeCard", name: "Time Card" },
            { id: "Overtime", name: "Over Time" },
            { id: "lateEarlyApproval", name: "Late / Early Approval" },
            { id: "monthlyLateDeduction", name: "Monthly Late Deduction" },
            { id: "excessLateReview", name: "Late Over 30 Minutes" },
            { id: "personalOut", name: "Personal Out" },
            { id: "leaveMaster", name: "Leave Form" },
            { id: "leaveApproval", name: "Leave Approval" },
            { id: "supervisorLeaveApproval", name: "Supervisor Leave Approval" },//new one
            { id: "midShiftBreaks", name: "Mid-Shift Breaks" },
            { id: "hrLeaveApproval", name: "HR Leave Approval" },
            { id: "noPayManagement", name: "NoPay" },
            ...(user?.role !== 'employee' ? [{ id: "leavecalendar", name: "Leave Calendar" }] : []),
          ],
        },
      ],
    },
    {
      id: "reports",
      name: "Reports",
      icon: BarChart3,
      subItems: [
        {
          id: "timecardReports",
          name: "Timecard Reports",
          icon: FileText,
          subItems: [
            { id: "attendanceReport", name: "Attendance Report" },
            { id: "singleEntryReport", name: "Single Entry Report" },
            { id: "absentReport", name: "Absent Report" },
            { id: "shiftHoursReport", name: "Shift Hours Reports" },
            { id: "dailyOtHoursReport", name: "Daily OT Hours" },
          ],
        },
        // --- අලුතින් එකතු කළ Salary Reports කොටස ---
        {
          id: "salaryReports",
          name: "Salary Reports",
          icon: DollarSign,
          subItems: [
            { id: "allowancesReport", name: "Allowances Report" },
          ],
        },
        // ----------------------------------------
      ],
    },
    {
      id: "settings",
      name: "Settings",
      icon: Settings,
      badge: null,
      subItems: [
        { id: "leaveSettings", name: "Leave Settings" },
        { id: "employeeLeaveBalance", name: "Employee Leave Balances" },
        { id: "nopayWorkingDays", name: "NoPay Working Days" },
      ],
    },
  ], [user?.role]);

  // Auto-expand nested groups based on the current activeItem
  useEffect(() => {
    const findPath = (items, target) => {
      for (const item of items) {
        if (item.id === target) return [item.id];
        if (item.subItems) {
          const subPath = findPath(item.subItems, target);
          if (subPath) return [item.id, ...subPath];
        }
      }
      return null;
    };

    const path = findPath(menuItems, activeItem) || [];

    setExpandedItems({
      hrMaster: path.includes("hrMaster"),
      allowanceDeduction:
        path.includes("allowanceDeduction") || activeItem === "allowanceDeduction",
      loans: path.includes("loans") || activeItem === "loans",
      salaryProcess: path.includes("salaryProcess") || activeItem === "salaryProcess" || ["SalaryProcessPage", "SalaryPage", "salaryRecords", "downloadSalarySlip"].includes(activeItem),
      //timeAttendance: path.includes("timeAttendance") || activeItem === "timeAttendance",
      timeAttendance: 
        path.includes("timeAttendance") || 
        activeItem === "timeAttendance" || 
        ["supervisorLeaveApproval"].includes(activeItem), // new one
      pms: path.includes("pms") || activeItem === "pms",
      lms: path.includes("lms") || activeItem === "lms",
      accounting: path.includes("accounting") || activeItem === "accounting",
      chartOfAccounts:
        path.includes("chartOfAccounts") ||
        activeItem === "chartOfAccounts" ||
        [
          "accountList",
          "supplierEnterBill",
          "payment",
          "advancePayment",
          "makeDeposit",
          "receipt",
          "createUtilityBill",
          "utilityBillPayment",
          "journalEntry",
          "pettyCash",
          "cheque",
          "bankReconciliation",
        ].includes(activeItem),
      transactions:
        path.includes("transactions") ||
        activeItem === "transactions" ||
        ["transactionsList"].includes(activeItem),
      financeReports:
        path.includes("financeReports") ||
        activeItem === "financeReports" ||
        ["trialBalance", "incomeStatement", "balanceSheet", "cashFlowStatement"].includes(activeItem),
      inventory:
        path.includes("inventory") ||
        activeItem === "inventory" ||
        [
          "invoices",
          "salesOrder",
          "salesReturn",
          "grn",
          "purchaseReturn",
          "purchaseOrder",
          "stockTransfer",
          "stockVerification",
          "pendingApprovals",
          "customer",
          "supplier",
          "center",
          "product",
          "discountLevel",
        ].includes(activeItem),
      masterFiles:
        path.includes("masterFiles") ||
        activeItem === "masterFiles" ||
        ["customer", "supplier", "center", "product", "discountLevel"].includes(activeItem),
      reports: path.includes("reports") || activeItem === "reports",
      timecardReports:
        path.includes("timecardReports") ||
        activeItem === "timecardReports" ||
        ["attendanceReport", "singleEntryReport","absentReport","shiftHoursReport","contractAttendanceReport","dailyOtHoursReport"].includes(activeItem),
      
      // --- අලුතින් එකතු කළ කොටස ---
      salaryReports:
        path.includes("salaryReports") ||
        activeItem === "salaryReports" ||
        ["allowancesReport"].includes(activeItem),
      // ------------------------

      settings:
        path.includes("settings") ||
        activeItem === "settings" ||
        ["leaveSettings", "employeeLeaveBalance", "nopayWorkingDays"].includes(activeItem)
    });
  }, [activeItem, menuItems]);

  const toggleHrMaster = () => setExpandedItems((prev) => ({ ...prev, hrMaster: !prev.hrMaster }));
  const toggleAllowanceDeduction = () => setExpandedItems((prev) => ({ ...prev, allowanceDeduction: !prev.allowanceDeduction }));
  const toggleLoans = () => setExpandedItems((prev) => ({ ...prev, loans: !prev.loans }));
  const toggleSalaryProcess = () => setExpandedItems((prev) => ({ ...prev, salaryProcess: !prev.salaryProcess }));
  const toggleTimeAttendance = () => setExpandedItems((prev) => ({ ...prev, timeAttendance: !prev.timeAttendance }));
  const togglePMS = () => setExpandedItems((prev) => ({ ...prev, pms: !prev.pms }));
  const toggleLMS = () => setExpandedItems((prev) => ({ ...prev, lms: !prev.lms }));
  const toggleAccounting = () => setExpandedItems((prev) => ({ ...prev, accounting: !prev.accounting }));
  const toggleChartOfAccounts = () => setExpandedItems((prev) => ({ ...prev, chartOfAccounts: !prev.chartOfAccounts }));
  const toggleTransactions = () => setExpandedItems((prev) => ({ ...prev, transactions: !prev.transactions }));
  const toggleFinanceReports = () => setExpandedItems((prev) => ({ ...prev, financeReports: !prev.financeReports }));
  const toggleInventory = () => setExpandedItems((prev) => ({ ...prev, inventory: !prev.inventory }));
  const toggleMasterFiles = () => setExpandedItems((prev) => ({ ...prev, masterFiles: !prev.masterFiles }));
  
  const toggleReports = () => setExpandedItems((prev) => ({ ...prev, reports: !prev.reports }));
  const toggleTimecardReports = () => setExpandedItems((prev) => ({ ...prev, timecardReports: !prev.timecardReports }));
  
  // --- අලුතින් එකතු කළ Toggle එක ---
  const toggleSalaryReports = () => setExpandedItems((prev) => ({ ...prev, salaryReports: !prev.salaryReports }));
  // ------------------------------
  
  const toggleSettings = () => setExpandedItems((prev) => ({ ...prev, settings: !prev.settings }));

  // Recursive function to filter menu items based on permissions
  const filterMenuItems = (items, ancestors = []) => {
    return items
      .map((item) => {
        const alwaysShowItems = ["dashboard", "myProfile", "changePassword"];
        if (alwaysShowItems.includes(item.id)) return item;
        
        if (item.subItems) {
          const filteredSubItems = filterMenuItems(item.subItems, [...ancestors, item.id]);
          if (
            filteredSubItems.length > 0 ||
            hasPermission(item.id, "view") ||
            ancestors.some((a) => hasPermission(a, "view"))
          ) {
            return { ...item, subItems: filteredSubItems };
          }
        } else if (
          hasPermission(item.id, "view") ||
          ancestors.some((a) => hasPermission(a, "view"))
        ) {
          return item;
        }
        return null;
      })
      .filter(Boolean);
  };

  const filteredMenuItems = filterMenuItems(menuItems);

  return (
    <>
      
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

     
      <div
        className={`
        min-h-screen bg-white border-r border-gray-200 shadow-lg z-50
        transform transition-transform duration-300 ease-in-out
        w-64
        fixed left-0 top-0
        lg:static lg:z-0 lg:translate-x-0
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
       
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900">
                  {user?.role === 'employee' ? 'Employee System' : 'HRM System'}
                </h2>
                <p className="text-xs text-gray-500">v2.1.0</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="lg:hidden text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        
        <div className="p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center overflow-hidden">
              {employeeProfile?.profile_photo_path ? (
                <img
                  src={mediaUrl(employeeProfile.profile_photo_path)}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-semibold text-sm">
                  {user?.name
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-sm text-gray-500 truncate capitalize">{user?.role}</p>
            </div>
          </div>
        </div>

        
        <nav className="flex-1 overflow-y-auto">
          <div className="p-4">
            <ul className="space-y-2">
              {filteredMenuItems.map((item) => (
                <li key={item.id}>
                  {item.subItems ? (
                    <>
                      
                      {(() => {
                        const topDropdowns = {
                          hrMaster: { toggle: toggleHrMaster, expanded: expandedItems.hrMaster },
                          pms: { toggle: togglePMS, expanded: expandedItems.pms },
                          lms: { toggle: toggleLMS, expanded: expandedItems.lms },
                          accounting: { toggle: toggleAccounting, expanded: expandedItems.accounting },
                          inventory: { toggle: toggleInventory, expanded: expandedItems.inventory },
                          chartOfAccounts: { toggle: toggleChartOfAccounts, expanded: expandedItems.chartOfAccounts },
                          transactions: { toggle: toggleTransactions, expanded: expandedItems.transactions },
                          financeReports: { toggle: toggleFinanceReports, expanded: expandedItems.financeReports },
                          reports: { toggle: toggleReports, expanded: expandedItems.reports },
                          settings: { toggle: toggleSettings, expanded: expandedItems.settings },
                        };
                        const top = topDropdowns[item.id] || {
                          toggle: () => {},
                          expanded: false,
                        };

                        return (
                          <button
                            onClick={top.toggle}
                            className={`
                              w-full flex items-right justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                              transition-all duration-200 group
                              ${
                                activeItem === item.id ||
                                item.subItems.some((subItem) => activeItem === subItem.id)
                                  ? "bg-indigo-50 text-indigo-700"
                                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                              }
                            `}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <item.icon
                                className={`h-5 w-5 flex-shrink-0 ${
                                  activeItem === item.id ||
                                  item.subItems.some(
                                    (subItem) => activeItem === subItem.id
                                  )
                                    ? "text-indigo-600"
                                    : "text-gray-400 group-hover:text-gray-600"
                                }`}
                              />
                              <span className="flex-1 text-left truncate">
                                {item.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {item.badge && (
                                <span
                                  className={`
                                    px-2 py-0.5 text-xs rounded-full font-medium
                                    ${
                                      activeItem === item.id ||
                                      item.subItems.some((subItem) => activeItem === subItem.id)
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "bg-gray-100 text-gray-600"
                                    }
                                  `}
                                >
                                  {item.badge}
                                </span>
                              )}
                              {top.expanded ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </div>
                          </button>
                        );
                      })()}

                      
                      {(() => {
                        const topExpanded =
                          item.id === "hrMaster" ? expandedItems.hrMaster :
                          item.id === "pms" ? expandedItems.pms :
                          item.id === "lms" ? expandedItems.lms :
                          item.id === "accounting" ? expandedItems.accounting :
                          item.id === "inventory" ? expandedItems.inventory :
                          item.id === "reports" ? expandedItems.reports :
                          item.id === "settings" ? expandedItems.settings :
                          false;
                        if (!topExpanded) return null;
                        return (
                          <ul className="ml-4 mt-1 space-y-1">
                            {item.subItems.map((subItem) => {
                              // Map subItem.id to its toggle and expanded state
                              const subDropdowns = {
                                allowanceDeduction: { toggle: toggleAllowanceDeduction, expanded: expandedItems.allowanceDeduction },
                                masterFiles: { toggle: toggleMasterFiles, expanded: expandedItems.masterFiles },
                                loans: { toggle: toggleLoans, expanded: expandedItems.loans },
                                salaryProcess: { toggle: toggleSalaryProcess, expanded: expandedItems.salaryProcess },
                                timeAttendance: { toggle: toggleTimeAttendance, expanded: expandedItems.timeAttendance },
                                chartOfAccounts: { toggle: toggleChartOfAccounts, expanded: expandedItems.chartOfAccounts },
                                transactions: { toggle: toggleTransactions, expanded: expandedItems.transactions },
                                financeReports: { toggle: toggleFinanceReports, expanded: expandedItems.financeReports },
                                timecardReports: { toggle: toggleTimecardReports, expanded: expandedItems.timecardReports },
                                salaryReports: { toggle: toggleSalaryReports, expanded: expandedItems.salaryReports }, // <-- අලුත් එක
                              };

                              if (subItem.subItems) {
                                const dropdown = subDropdowns[subItem.id] || {};
                                // Check if this is an accounting-related dropdown
                                const isAccountingSubDropdown = [
                                  "chartOfAccounts",
                                  "transactions",
                                  "financeReports",
                                ].includes(subItem.id);
                                return (
                                  <li key={subItem.id}>
                                    <button
                                      onClick={
                                        dropdown.toggle ||
                                        (isAccountingSubDropdown
                                          ? subItem.id === "chartOfAccounts"
                                            ? toggleChartOfAccounts
                                            : subItem.id === "transactions"
                                            ? toggleTransactions
                                            : subItem.id === "financeReports"
                                            ? toggleFinanceReports
                                            : undefined
                                          : undefined)
                                      }
                                      className={`
                                     w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium
                                     transition-all duration-200
                                     ${
                                       activeItem === subItem.id ||
                                       subItem.subItems.some(
                                         (s) => activeItem === s.id
                                       )
                                         ? "bg-indigo-50 text-indigo-700"
                                         : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                     }
                                   `}
                                    >
                                      <span className="flex items-center gap-2 flex-1 text-left">
                                        {subItem.icon ? (
                                          <subItem.icon className={`h-4 w-4 flex-shrink-0 text-gray-400`} />
                                        ) : (
                                          <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
                                        )}
                                        <span className="truncate">{subItem.name}</span>
                                      </span>
                                      <span className="flex-shrink-0">
                                        {dropdown.expanded ? (
                                          <ChevronDown className="h-4 w-4 text-gray-500" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4 text-gray-500" />
                                        )}
                                      </span>
                                    </button>
                                    {(dropdown.expanded ||
                                      (subItem.id === "chartOfAccounts" &&
                                        expandedItems.chartOfAccounts) ||
                                      (subItem.id === "transactions" &&
                                        expandedItems.transactions) ||
                                      (subItem.id === "financeReports" &&
                                        expandedItems.financeReports)) && (
                                      <ul className="ml-4 mt-1 space-y-1">
                                        {subItem.subItems.map((subSubItem) => (
                                          <li key={subSubItem.id}>
                                            <button
                                              onClick={() =>
                                                setActiveItem(subSubItem.id)
                                              }
                                              className={`
                                             w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                                             transition-all duration-200
                                             ${
                                               activeItem === subSubItem.id
                                                 ? "bg-indigo-50 text-indigo-700"
                                                 : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                             }
                                           `}
                                            >
                                              <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0"></span>
                                              <span className="flex-1 text-left truncate">
                                                {subSubItem.name}
                                              </span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                );
                              }
                              return (
                                <li key={subItem.id}>
                                  <button
                                    onClick={() => setActiveItem(subItem.id)}
                                    className={`
                                   w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                                   transition-all duration-200 group
                                   ${
                                     activeItem === subItem.id
                                       ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
                                       : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                                   }
                                 `}
                                  >
                                    <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0"></span>
                                    <span className="flex-1 text-left">{subItem.name}</span>
                                    {subItem.badge && (
                                      <span
                                        className={`
                                          px-2 py-0.5 text-xs rounded-full font-medium
                                          ${
                                            activeItem === subItem.id
                                              ? "bg-indigo-100 text-indigo-700"
                                              : "bg-gray-100 text-gray-600"
                                          }
                                        `}
                                      >
                                        {subItem.badge}
                                      </span>
                                    )}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        );
                      })()}
                    </>
                  ) : (
                    <button
                      onClick={() => setActiveItem(item.id)}
                      className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200 group
                      ${
                        activeItem === item.id
                          ? "bg-indigo-50 text-indigo-700 border-r-2 border-indigo-600"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }
                    `}
                    >
                      <item.icon
                        className={`h-5 w-5 ${
                          activeItem === item.id
                            ? "text-indigo-600"
                            : "text-gray-400 group-hover:text-gray-600"
                        }`}
                      />
                      <span className="flex-1 text-left">{item.name}</span>
                      {item.badge && (
                        <span
                          className={`
                        px-2 py-0.5 text-xs rounded-full font-medium
                        ${
                          activeItem === item.id
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-gray-100 text-gray-600"
                        }
                      `}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </nav>

        
        <div className="p-4 border-t border-gray-100 space-y-2 flex-shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 group"
          >
            <LogOut className="h-5 w-5 text-red-500 group-hover:text-red-600" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
*/




