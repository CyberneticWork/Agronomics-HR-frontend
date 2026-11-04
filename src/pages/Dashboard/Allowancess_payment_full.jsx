import React, { useState, useEffect } from "react";
import { 
  FileSpreadsheet, Building2, Download, Eye,
  FileText, FileBarChart, Loader2, FileCheck, Wallet, CreditCard, Scissors, Gift, Clock, Banknote, Coins, X
} from "lucide-react";
import Swal from "sweetalert2";
import ReportService from "../../services/ReportService";
import { useBranding } from "../../contexts/BrandingContext";
import { fetchCompanies } from "@services/ApiDataService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NOTES_ARRAY = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1];

const formatPeriodYm = (val, joined, resigned) => {
  if (val && typeof val === "string" && val !== "-" && val !== "TOTAL") {
    if (/^\d+Y\s+\d+M$/i.test(val.trim())) return val.trim();
    const ymMatch = val.match(/(\d+)\s*y(?:ears?)?.*?(\d+)\s*m(?:onths?)?/i);
    if (ymMatch) return `${ymMatch[1]}Y ${ymMatch[2]}M`;
    const yOnly = val.match(/(\d+)\s*y(?:ears?)?/i);
    if (yOnly) return `${yOnly[1]}Y 0M`;
    const mOnly = val.match(/(\d+)\s*m(?:onths?)?/i);
    if (mOnly) return `0Y ${mOnly[1]}M`;
    return val;
  }
  if (!joined || joined === "-") return "-";
  try {
    const startDate = new Date(joined);
    const endDate = (resigned && resigned !== "-") ? new Date(resigned) : new Date();
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate) return "0Y 0M";
    let years = endDate.getFullYear() - startDate.getFullYear();
    let months = endDate.getMonth() - startDate.getMonth();
    if (endDate.getDate() < startDate.getDate()) {
      months--;
    }
    if (months < 0) {
      years--;
      months += 12;
    }
    return `${Math.max(0, years)}Y ${Math.max(0, months)}M`;
  } catch (e) {
    return val || "-";
  }
};

const Reports = () => {
  const { branding } = useBranding();
  const [selectedCompany, setSelectedCompany] = useState("");
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const c = await fetchCompanies();
        setCompanies(Array.isArray(c) ? c : c?.data || []);
      } catch (e) {
        console.error("Error loading companies:", e);
      }
    })();
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [reportData, setReportData] = useState([]);
  const [scheduleReportData, setScheduleReportData] = useState(null);
  const [leaveSummaryData, setLeaveSummaryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showCoinageModal, setShowCoinageModal] = useState(false);
  const [coinageFormat, setCoinageFormat] = useState("pdf");
  const [coinageType, setCoinageType] = useState("cash");
  const [editableCoinage, setEditableCoinage] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);

  const months = [
    { value: "01", label: "January" }, { value: "02", label: "February" },
    { value: "03", label: "March" }, { value: "04", label: "April" },
    { value: "05", label: "May" }, { value: "06", label: "June" },
    { value: "07", label: "July" }, { value: "08", label: "August" },
    { value: "09", label: "September" }, { value: "10", label: "October" },
    { value: "11", label: "November" }, { value: "12", label: "December" },
  ];
  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));
  const monthLabel = months.find(m => m.value === selectedMonth)?.label || selectedMonth;

  const selectedCompObj = selectedCompany
    ? companies.find((c) => String(c.id) === String(selectedCompany))
    : null;
  const activeCompObj = selectedCompObj || companies.find((c) => c.portal_active) || companies[0] || branding;
  const getSpmStatus = (obj) => {
    if (!obj || !obj.process_config) return null;
    return !!(obj.process_config?.spm_reports?.enabled ?? obj.process_config?.spm_reports === true);
  };
  const spmReportsEnabled = getSpmStatus(activeCompObj) ?? getSpmStatus(branding) ?? false;

  const handleFetchData = async () => {
    try {
      setIsLoading(true);
      const [data, scheduleData, leaveData] = await Promise.all([
        ReportService.getMonthlyReportData(selectedMonth, selectedYear, selectedCompany),
        ReportService.getScheduleReportData(selectedMonth, selectedYear, selectedCompany),
        ReportService.getLeaveSummaryData(selectedMonth, selectedYear, selectedCompany).catch(() => []),
      ]);
      setReportData(data);
      setScheduleReportData(scheduleData);
      setLeaveSummaryData(Array.isArray(leaveData) ? leaveData : []);
      if(data.length === 0) Swal.fire("No Data", "No salaries processed for this month.", "info");
      else Swal.fire({ icon: "success", title: "Data Loaded", text: `Ready to generate reports for ${data.length} employees.`, timer: 1500, showConfirmButton: false });
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      Swal.fire("Error", `Failed: ${JSON.stringify(errorMsg)}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // --- AMOUNT FORMATTING & ALIGNMENT HELPERS ---
  const fmt = (n) => {
    const num = Number(n);
    if (n === "" || n === null || n === undefined || isNaN(num)) return "-";
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const isAmountColumn = (header, colIndex, rows) => {
    if (!header && header !== 0) return false;
    const h = String(header).trim().toLowerCase();
    if (
      h === "emp no" || h === "emp_no" || h === "employee no" || h === "epf no" || h === "epf_no" ||
      h === "member no." || h === "member no" || h === "name" || h === "employee name" ||
      h.includes("bank account") || h.includes("account no") || h.includes("bank name") || h.includes("branch") ||
      h.includes("date") || h.includes("period") || h.includes("month") || h.includes("year") ||
      h.includes("notes & coins") || h.includes("nos.") || h.includes("days") || h.includes("rate") ||
      h.includes("entitlement") || h.includes("obtained") || h.includes("leaves") ||
      (h.includes("balance") && !h.includes("loan") && !h.includes("rs") && !h.includes("outstanding") && !h.includes("amount") && !h.includes("total"))
    ) {
      return false;
    }
    if (
      h.includes("salary") || h.includes("amount") || h.includes("pay") || h.includes("deduct") ||
      h.includes("fund") || h.includes("bonus") || h.includes("allowance") || h.includes("total") ||
      h.includes("net") || h.includes("gross") || h.includes("installment") || h.includes("interest") ||
      h.includes("8%") || h.includes("12%") || h.includes("20%") || h.includes("3%") || h.includes("0.5%") ||
      h.includes("rs") || h.includes("advance") || h.includes("contribution") || h.includes("ot") ||
      h.includes("outstanding") || h.includes("recoverable")
    ) {
      return true;
    }
    if (rows && rows.length > 0) {
      const samples = rows.slice(0, 5).map(r => r ? r[colIndex] : null).filter(v => v !== null && v !== undefined && v !== "" && v !== "-");
      if (samples.length > 0 && samples.every(v => typeof v === "number" || (typeof v === "string" && /^[-+]?[0-9]{1,3}(,[0-9]{3})*(\.[0-9]{2})$/.test(v.trim())))) {
        return true;
      }
    }
    return false;
  };

  const buildColumnStyles = (headers, rows) => {
    const styles = {};
    if (!headers || !headers.length) return styles;
    headers.forEach((h, i) => {
      const hStr = String(h).trim();
      const numVal = Number(hStr.replace(/,/g, ''));
      if (NOTES_ARRAY.includes(numVal)) {
        styles[i] = { halign: 'center' };
      } else if (isAmountColumn(h, i, rows)) {
        styles[i] = { halign: 'right' };
      }
    });
    return styles;
  };

  const sumField = (fieldName) => {
    return (reportData || []).reduce((acc, emp) => acc + (Number(emp[fieldName]) || 0), 0);
  };

  // --- REPORT GENERATORS ---

  // 1. Full Master Payroll
  const generateMasterData = () => {
    const uniqueAllowances = new Set(); const uniqueBonuses = new Set(); const uniqueDeductions = new Set();
    reportData.forEach(e => {
       (e.raw_allowances || []).forEach(a => uniqueAllowances.add(a.name));
       (e.raw_bonuses || []).forEach(b => uniqueBonuses.add(b.name));
       (e.raw_deductions || []).forEach(d => uniqueDeductions.add(d.name));
    });
    const dynAllowances = Array.from(uniqueAllowances);
    const dynBonuses = Array.from(uniqueBonuses);
    const dynDeductions = Array.from(uniqueDeductions);

    let headers;
    if (spmReportsEnabled) {
      headers = [
        "Emp No", "EPF No", "Name", "Basic Salary", "Increment", "Total Basic",
        ...dynAllowances, "Total Allowances",
        ...dynBonuses, "Total Bonuses",
        "OT Amount", "Gross Salary",
        "Salary Advance", "Staff Loan Inst", "Staff Loan Int", "Sports Fund", "Staff Fund",
        ...dynDeductions, "EPF 8%", "Total Deductions", "Net Salary", "Employer EPF 12%", "Employer ETF 3%"
      ];
    } else {
      headers = [
        "Emp No", "Name", "Basic Salary", "Increment", "Total Basic",
        ...dynAllowances, "Total Allowances",
        ...dynBonuses, "Total Bonuses",
        "OT Amount", "Gross Salary",
        "Salary Advance", "Staff Loan Inst", "Staff Loan Int",
        ...dynDeductions, "EPF 8%", "Total Deductions", "Net Salary", "Employer EPF 12%", "Employer ETF 3%"
      ];
    }

    let rows = [];
    let totals = new Array(headers.length - (spmReportsEnabled ? 3 : 2)).fill(0);

    reportData.forEach(e => {
      let r;
      if (spmReportsEnabled) {
        r = [e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name];
      } else {
        r = [e.emp_no, e.name];
      }
      let basic = Number(e.basic_salary) || 0;
      let inc = Number(e.increment_amount) || 0;
      r.push(fmt(basic), fmt(inc), fmt(basic + inc));

      let tAllow = 0;
      dynAllowances.forEach(name => {
        let val = Number((e.raw_allowances || []).find(a => a.name === name)?.amount) || 0;
        tAllow += val; r.push(fmt(val));
      });
      r.push(fmt(tAllow));

      let tBonus = 0;
      dynBonuses.forEach(name => {
        let val = Number((e.raw_bonuses || []).find(b => b.name === name)?.amount) || 0;
        tBonus += val; r.push(fmt(val));
      });
      r.push(fmt(tBonus));

      r.push(fmt(e.total_ot_amount));
      r.push(fmt(e.gross_salary));

      r.push(fmt(e.salary_advance));
      r.push(fmt(e.loan_installment));
      r.push(fmt(e.loan_interest));

      if (spmReportsEnabled) {
        r.push(fmt(e.sports_fund));
        r.push(fmt(e.staff_fund));
      }

      dynDeductions.forEach(name => {
        let val = Number((e.raw_deductions || []).find(d => d.name === name)?.amount) || 0;
        r.push(fmt(val));
      });

      r.push(fmt(e.epf_8));
      r.push(fmt(e.total_deductions));
      r.push(fmt(e.net_salary));
      r.push(fmt(e.epf_12));
      r.push(fmt(e.etf_3));

      const offset = spmReportsEnabled ? 3 : 2;
      for (let k = offset; k < r.length; k++) {
        totals[k - offset] += (Number(String(r[k]).replace(/,/g, '')) || 0);
      }
      rows.push(r);
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", ...totals.map(v => fmt(v))]
      : ["TOTAL", "", ...totals.map(v => fmt(v))];

    return { headers, rows, footer };
  };

  // 2. Bank Transfer File
  const generateBankData = () => {
    let rows = []; let total = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "Bank Account Number", "Bank Name", "Branch", "Amount"]
      : ["Emp No", "Name", "Bank Account Number", "Bank Name", "Branch", "Bank Net Amount"];

    reportData.forEach(e => {
      let netPay = Number(e.bank_transfer_amount ?? e.bank_amount ?? e.net_salary) || 0;
      if (netPay > 0) {
        total += netPay;
        if (spmReportsEnabled) {
          rows.push([
            e.emp_no,
            e.epf_no || e.epf || e.epf_member_no || "-",
            e.name,
            e.bank_account_no || "-",
            e.bank_name || "-",
            e.bank_branch || "-",
            fmt(netPay)
          ]);
        } else {
          rows.push([
            e.emp_no,
            e.name,
            e.bank_account_no || "-",
            e.bank_name || "-",
            e.bank_branch || "-",
            fmt(netPay)
          ]);
        }
      }
    });

    const footer = spmReportsEnabled
      ? ["", "", "", "", "", "TOTAL", fmt(total)]
      : ["", "", "", "", "TOTAL", fmt(total)];

    return { headers, rows, footer };
  };

  // 3. Schedule 06: EPF & ETF
  const generateEPFSchedule06Data = () => {
    const company = scheduleReportData?.company;
    const regNo = company?.registration_no && company.registration_no !== '-' ? company.registration_no : '';
    let rows = [];
    let tBase = 0, tEmp12 = 0, tEmp8 = 0, tEpf20 = 0, tEtf3 = 0;

    reportData.forEach(e => {
      const epf8 = Number(e.epf_8) || 0;
      const epf12 = Number(e.epf_12) || 0;
      const etf3 = Number(e.etf_3) || 0;
      const epfBase = Number(e.salary_for_epf ?? e.epf_base) || 0;
      if (epf8 + epf12 + etf3 > 0 || epfBase > 0) {
        const epf20 = epf8 + epf12;
        tBase += epfBase; tEmp12 += epf12; tEmp8 += epf8; tEpf20 += epf20; tEtf3 += etf3;
        if (spmReportsEnabled) {
          rows.push([
            e.emp_no,
            e.epf_no || e.epf || e.epf_member_no || "-",
            e.name,
            fmt(epfBase),
            fmt(epf12),
            fmt(epf8),
            fmt(epf20),
            fmt(etf3),
          ]);
        } else {
          rows.push([
            e.epf_member_no || e.epf_no || e.emp_no,
            e.name,
            fmt(epfBase),
            fmt(epf12),
            fmt(epf8),
            fmt(epf20),
            fmt(etf3),
          ]);
        }
      }
    });

    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Employee Name", "Salary for EPF", "Employer 12%", "Employee 8%", "Total EPF 20%", "ETF 3%"]
      : ["Member No.", "Employee Name", "Salary for EPF", "Employer 12%", "Employee 8%", "Total EPF 20%", "ETF 3%"];

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", fmt(tBase), fmt(tEmp12), fmt(tEmp8), fmt(tEpf20), fmt(tEtf3)]
      : ["", "TOTAL", fmt(tBase), fmt(tEmp12), fmt(tEmp8), fmt(tEpf20), fmt(tEtf3)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Schedule 06 — EPF & ETF — ${monthLabel} ${selectedYear}`,
      subtitle: regNo ? `Company Registration No: ${regNo}` : undefined,
    };
  };

  // 4. Overtime Summary
  const generateOTData = () => {
    let rows = [];
    let tNormHrs = 0, tNormAmt = 0, tDblHrs = 0, tDblAmt = 0, tGrandAmt = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "1.5 OT Hours", "1.5 OT Amount", "2.0 OT Hours", "2.0 OT Amount", "Total OT Amount"]
      : ["Emp No", "Name", "1.5 OT Hours", "1.5 OT Amount", "2.0 OT Hours", "2.0 OT Amount", "Total OT Amount"];

    reportData.forEach(e => {
      let nHrs = Number(e.normal_ot_hours) || 0;
      let nAmt = Number(e.normal_ot_amount) || 0;
      let dHrs = Number(e.double_ot_hours) || 0;
      let dAmt = Number(e.double_ot_amount) || 0;
      let tot = Number(e.total_ot_amount) || (nAmt + dAmt);

      if (tot > 0 || nHrs > 0 || dHrs > 0) {
        tNormHrs += nHrs; tNormAmt += nAmt; tDblHrs += dHrs; tDblAmt += dAmt; tGrandAmt += tot;
        if (spmReportsEnabled) {
          rows.push([
            e.emp_no,
            e.epf_no || e.epf || e.epf_member_no || "-",
            e.name,
            nHrs.toFixed(1),
            fmt(nAmt),
            dHrs.toFixed(1),
            fmt(dAmt),
            fmt(tot)
          ]);
        } else {
          rows.push([
            e.emp_no,
            e.name,
            nHrs.toFixed(1),
            fmt(nAmt),
            dHrs.toFixed(1),
            fmt(dAmt),
            fmt(tot)
          ]);
        }
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", tNormHrs.toFixed(1), fmt(tNormAmt), tDblHrs.toFixed(1), fmt(tDblAmt), fmt(tGrandAmt)]
      : ["TOTAL", "", tNormHrs.toFixed(1), fmt(tNormAmt), tDblHrs.toFixed(1), fmt(tDblAmt), fmt(tGrandAmt)];

    return { headers, rows, footer };
  };

  // 5. Dynamic Allowances
  const generateAllowancesOnlyData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_allowances || []).forEach(a => uniqueNames.add(a.name)); });
    const dynamicHeaders = Array.from(uniqueNames);

    let rows = [];
    let columnTotals = new Array(dynamicHeaders.length).fill(0);
    let tTotal = 0;

    reportData.forEach(e => {
      let row = spmReportsEnabled
        ? [e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name]
        : [e.emp_no, e.name];
      let empTotalAllow = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let item = (e.raw_allowances || []).find(a => a.name === headerName);
        let amount = item ? parseFloat(item.amount) || 0 : 0;
        row.push(fmt(amount));
        columnTotals[index] += amount;
        empTotalAllow += amount;
      });
      row.push(fmt(empTotalAllow));
      tTotal += empTotalAllow;
      rows.push(row);
    });

    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", ...dynamicHeaders, "Total Allowances"]
      : ["Emp No", "Name", ...dynamicHeaders, "Total Allowances"];

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", ...columnTotals.map(v => fmt(v)), fmt(tTotal)]
      : ["TOTAL", "", ...columnTotals.map(v => fmt(v)), fmt(tTotal)];

    return { headers, rows, footer };
  };

  // 6. Dynamic Bonuses / Schedule 01(a): Monthly Bonus
  const generateBonusesOnlyData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_bonuses || []).forEach(b => uniqueNames.add(b.name)); });
    let dynamicHeaders = Array.from(uniqueNames);

    if (spmReportsEnabled) {
      if (dynamicHeaders.length === 0) {
        dynamicHeaders = ["Monthly Bonus"];
      } else if (!dynamicHeaders.includes("Monthly Bonus")) {
        dynamicHeaders.unshift("Monthly Bonus");
      }
    }

    let rows = [];
    let columnTotals = new Array(dynamicHeaders.length).fill(0);
    let tTotal = 0;

    reportData.forEach(e => {
      let row = spmReportsEnabled
        ? [e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name]
        : [e.emp_no, e.name];
      let empTotalBonus = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let amount = 0;
        let item = (e.raw_bonuses || []).find(b => b.name === headerName);
        if (item) {
          amount = parseFloat(item.amount) || 0;
        } else if (headerName === "Monthly Bonus") {
          amount = parseFloat(e.monthly_bonus) || 0;
        }
        row.push(fmt(amount));
        columnTotals[index] += amount;
        empTotalBonus += amount;
      });
      row.push(fmt(empTotalBonus));
      tTotal += empTotalBonus;
      rows.push(row);
    });

    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", ...dynamicHeaders, "Total Bonuses"]
      : ["Emp No", "Name", ...dynamicHeaders, "Total Bonuses"];

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", ...columnTotals.map(v => fmt(v)), fmt(tTotal)]
      : ["TOTAL", "", ...columnTotals.map(v => fmt(v)), fmt(tTotal)];

    return {
      headers,
      rows,
      footer,
      reportTitle: spmReportsEnabled ? `Schedule 01(a): Monthly Bonus — ${monthLabel} ${selectedYear}` : undefined,
    };
  };

  // 7. Custom Deductions / Schedule 3: Salary Advance
  const generateDynamicDeductionsData = () => {
    const uniqueNames = new Set();
    reportData.forEach(e => { (e.raw_deductions || []).forEach(d => uniqueNames.add(d.name)); });
    let dynamicHeaders = Array.from(uniqueNames);

    if (spmReportsEnabled) {
      if (dynamicHeaders.length === 0) {
        dynamicHeaders = ["Salary Advance"];
      } else if (!dynamicHeaders.includes("Salary Advance")) {
        dynamicHeaders.unshift("Salary Advance");
      }
    }

    let rows = [];
    let columnTotals = new Array(dynamicHeaders.length).fill(0);
    let tTotal = 0;

    reportData.forEach(e => {
      let row = spmReportsEnabled
        ? [e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name]
        : [e.emp_no, e.name];
      let empTotalDeds = 0;
      dynamicHeaders.forEach((headerName, index) => {
        let amount = 0;
        let item = (e.raw_deductions || []).find(d => d.name === headerName);
        if (item) {
          amount = parseFloat(item.amount) || 0;
        } else if (headerName === "Salary Advance") {
          amount = parseFloat(e.salary_advance) || 0;
        }
        row.push(fmt(amount));
        columnTotals[index] += amount;
        empTotalDeds += amount;
      });
      row.push(fmt(empTotalDeds));
      tTotal += empTotalDeds;
      rows.push(row);
    });

    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", ...dynamicHeaders, "Total Deductions"]
      : ["Emp No", "Name", ...dynamicHeaders, "Total Deductions"];

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", ...columnTotals.map(v => fmt(v)), fmt(tTotal)]
      : ["TOTAL", "", ...columnTotals.map(v => fmt(v)), fmt(tTotal)];

    return {
      headers,
      rows,
      footer,
      reportTitle: spmReportsEnabled ? `Schedule 3: Salary Advance — ${monthLabel} ${selectedYear}` : undefined,
    };
  };

  // 8. Staff Loans
  const generateLoanData = () => {
    let rows = []; let tInst = 0, tInt = 0, tTot = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "Loan Installment", "Loan Interest", "Total Loan Deduction"]
      : ["Emp No", "Name", "Loan Installment", "Loan Interest", "Total Loan Deduction"];

    reportData.forEach(e => {
      let inst = Number(e.loan_installment) || 0;
      let intVal = Number(e.loan_interest) || 0;
      let tot = Number(e.total_loan) || (inst + intVal);
      if (tot > 0 || inst > 0 || intVal > 0) {
        tInst += inst; tInt += intVal; tTot += tot;
        if (spmReportsEnabled) {
          rows.push([e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name, fmt(inst), fmt(intVal), fmt(tot)]);
        } else {
          rows.push([e.emp_no, e.name, fmt(inst), fmt(intVal), fmt(tot)]);
        }
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", fmt(tInst), fmt(tInt), fmt(tTot)]
      : ["TOTAL", "", fmt(tInst), fmt(tInt), fmt(tTot)];

    return { headers, rows, footer };
  };

  // 9. No Pay Details
  const generateNoPayData = () => {
    let rows = []; let tDays = 0, tAmt = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "No Pay Days", "No Pay Amount"]
      : ["Emp No", "Name", "No Pay Days", "No Pay Amount"];

    reportData.forEach(e => {
      let days = Number(e.no_pay_days) || 0;
      let amt = Number(e.no_pay_amount) || 0;
      if (amt > 0 || days > 0) {
        tDays += days; tAmt += amt;
        if (spmReportsEnabled) {
          rows.push([e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name, days.toFixed(1), fmt(amt)]);
        } else {
          rows.push([e.emp_no, e.name, days.toFixed(1), fmt(amt)]);
        }
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", tDays.toFixed(1), fmt(tAmt)]
      : ["TOTAL", "", tDays.toFixed(1), fmt(tAmt)];

    return { headers, rows, footer };
  };

  // 11. Salary & Monthly Bonus (Total)
  const generateSalaryAllowanceTotalData = () => {
    let rows = [];
    const totals = new Array(12).fill(0);
    const headers = spmReportsEnabled
      ? [
          "Emp No", "EPF No", "Name", "Basic Salary", "Monthly Bonus", "Gross Pay",
          "No Pay Amount", "Salary Advance", "Loan Installment", "Loan Interest",
          "Sports Fund", "Staff Fund", "EPF 8%", "Other Deductions", "Total Deductions", "Net Pay"
        ]
      : [
          "Name", "Salary", "Allowance", "Gross Salary",
          "No Pay", "Advance", "Loan Inst", "Loan Int",
          "Sports Fund", "EPF 8%", "Staff Fund", "Other Ded", "Total Deductions", "Net Pay"
        ];

    reportData.forEach(e => {
      const gross = (Number(e.salary_component) || 0) + (Number(spmReportsEnabled ? e.monthly_bonus : e.allowance_component) || 0);
      const rowVals = [
        Number(e.salary_component) || 0,
        Number(spmReportsEnabled ? e.monthly_bonus : e.allowance_component) || 0,
        gross,
        Number(e.no_pay_amount) || 0,
        Number(e.salary_advance) || 0,
        Number(e.loan_installment) || 0,
        Number(e.loan_interest) || 0,
        Number(e.sports_fund) || 0,
        spmReportsEnabled ? (Number(e.staff_fund) || 0) : (Number(e.epf_8) || 0),
        spmReportsEnabled ? (Number(e.epf_8) || 0) : (Number(e.staff_fund) || 0),
        Number(e.other_deduction) || 0,
        Number(e.total_report_deductions ?? e.total_deductions) || 0,
        Number(e.total_report_net ?? e.net_salary) || 0,
      ];
      rowVals.forEach((v, idx) => { if (idx < totals.length) totals[idx] += v; });

      if (spmReportsEnabled) {
        rows.push([
          e.emp_no,
          e.epf_no || e.epf || e.epf_member_no || "-",
          e.name,
          ...rowVals.map(v => fmt(v))
        ]);
      } else {
        rows.push([
          e.name,
          ...rowVals.map(v => fmt(v))
        ]);
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", ...totals.map(v => fmt(v))]
      : ["TOTAL", ...totals.map(v => fmt(v))];

    return {
      headers,
      rows,
      footer,
      reportTitle: spmReportsEnabled ? `Salary & Monthly Bonus (Total) — ${monthLabel} ${selectedYear}` : undefined,
    };
  };

  // 12. Salary Details
  const generateSalaryDetailsData = () => {
    let rows = [];
    if (spmReportsEnabled) {
      const headers = [
        "Emp No", "EPF No", "Name", "Joined Date",
        "Basic Salary", "Basic No Pay", "Salary for EPF", "Salary Advance",
        "Loan (Basic)", "EPF 8%", "Sch 06 Deductions", "Sch 06 Net Pay"
      ];
      const totals = new Array(8).fill(0);

      reportData.forEach(e => {
        const rowVals = [
          Number(e.base_basic_salary ?? e.basic_salary) || 0,
          Number(e.basic_no_pay) || 0,
          Number(e.salary_for_epf) || 0,
          Number(e.salary_advance_basic) || 0,
          Number(e.loan_on_basic) || 0,
          Number(e.epf_8) || 0,
          Number(e.epf_schedule_deductions) || 0,
          Number(e.epf_schedule_net) || 0,
        ];
        rowVals.forEach((v, idx) => { totals[idx] += v; });

        rows.push([
          e.emp_no,
          e.epf_no || e.epf || e.epf_member_no || "-",
          e.name,
          e.date_joined || "-",
          ...rowVals.map(v => fmt(v))
        ]);
      });

      const footer = ["", "TOTAL", "", "", ...totals.map(v => fmt(v))];

      return {
        headers,
        rows,
        footer,
        reportTitle: `Salary Details — ${monthLabel} ${selectedYear}`,
      };
    }

    const headers = [
      "Name", "EPF Member No", "Joined Date",
      "Basic Salary", "BR Allowance", "BR Allowance II", "Sch 01 Total",
      "Basic No Pay", "Salary for EPF", "Salary Advance", "Loan (Basic)", "EPF 8%", "Sch 06 Deductions", "Sch 06 Net Pay"
    ];
    const totals = new Array(11).fill(0);

    reportData.forEach(e => {
      const rowVals = [
        Number(e.base_basic_salary) || 0,
        Number(e.budgetary_allowance) || 0,
        Number(e.budget_relief_allowance) || 0,
        Number(e.total_salary_sch01) || 0,
        Number(e.basic_no_pay) || 0,
        Number(e.salary_for_epf) || 0,
        Number(e.salary_advance_basic) || 0,
        Number(e.loan_on_basic) || 0,
        Number(e.epf_8) || 0,
        Number(e.epf_schedule_deductions) || 0,
        Number(e.epf_schedule_net) || 0,
      ];
      rowVals.forEach((v, idx) => { if (idx < totals.length) totals[idx] += v; });

      rows.push([
        e.name,
        e.epf_member_no || e.emp_no || "-",
        e.date_joined || "-",
        ...rowVals.map(v => fmt(v))
      ]);
    });

    const footer = ["TOTAL", "", "", ...totals.map(v => fmt(v))];

    return {
      headers,
      rows,
      footer,
      reportTitle: undefined,
    };
  };

  // 13. Monthly Bonus / Allowance Report
  const generateAllowanceScheduleData = () => {
    let rows = [];
    const totals = new Array(11).fill(0);
    const headers = spmReportsEnabled
      ? [
          "Emp No", "EPF No", "Name", "Monthly Bonus", "Gross Bonus",
          "Bonus No Pay", "Salary Advance", "Loan Installment", "Loan Interest",
          "Sports Fund", "Staff Fund", "Other Deductions", "Total Deductions", "Net Bonus"
        ]
      : [
          "Name", "Joined Date",
          "Allowance", "Gross Allowance",
          "Bonus No Pay", "Salary Advance", "Loan (Bonus)", "Loan Interest",
          "Sports Fund", "Staff Fund", "Other Deductions", "Total Deductions", "Net Allowance"
        ];

    reportData.forEach(e => {
      const bonusAmount = Number(spmReportsEnabled ? e.monthly_bonus : e.allowance_component) || 0;
      const gross = Number(spmReportsEnabled ? (e.monthly_bonus ?? e.allowance_gross) : e.allowance_gross) || bonusAmount;
      const rowVals = [
        bonusAmount,
        gross,
        Number(e.bonus_no_pay) || 0,
        Number(e.salary_advance_bonus ?? e.salary_advance) || 0,
        Number(e.loan_on_bonus ?? e.loan_installment) || 0,
        Number(e.loan_interest) || 0,
        Number(e.sports_fund) || 0,
        Number(e.staff_fund) || 0,
        Number(e.allowance_other_deductions ?? e.other_deduction) || 0,
        Number(e.allowance_deductions) || 0,
        Number(e.allowance_net) || 0,
      ];
      rowVals.forEach((v, idx) => { if (idx < totals.length) totals[idx] += v; });

      if (spmReportsEnabled) {
        rows.push([
          e.emp_no,
          e.epf_no || e.epf || e.epf_member_no || "-",
          e.name,
          ...rowVals.map(v => fmt(v))
        ]);
      } else {
        rows.push([
          e.name,
          e.date_joined || "-",
          ...rowVals.map(v => fmt(v))
        ]);
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", ...totals.map(v => fmt(v))]
      : ["TOTAL", "", ...totals.map(v => fmt(v))];

    return {
      headers,
      rows,
      footer,
      reportTitle: spmReportsEnabled ? `Monthly Bonus — ${monthLabel} ${selectedYear}` : undefined,
    };
  };

  // 14. Schedule 02: Nopay
  const generateSchedule02NoPayData = () => {
    const buildSection = (label, getSalary, getDays, getAmount) => {
      let rows = []; let subSalary = 0, subDays = 0, subAmount = 0;
      reportData.forEach(e => {
        const salary = Number(getSalary(e)) || 0;
        const days = Number(getDays(e)) || 0;
        const amount = Number(getAmount(e)) || 0;
        if (amount > 0 || days > 0) {
          subSalary += salary; subDays += days; subAmount += amount;
          if (spmReportsEnabled) {
            rows.push([e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name, fmt(salary), days.toFixed(1), fmt(amount)]);
          } else {
            rows.push([e.name, fmt(salary), days.toFixed(1), fmt(amount)]);
          }
        }
      });
      const foot = spmReportsEnabled
        ? ["", "Total", "", fmt(subSalary), subDays.toFixed(1), fmt(subAmount)]
        : ["Total", fmt(subSalary), subDays.toFixed(1), fmt(subAmount)];
      return { rows, foot, subSalary, subDays, subAmount };
    };

    const basic = buildSection("Basic", e => e.base_basic_salary, e => e.basic_no_pay_days ?? e.no_pay_days, e => e.basic_no_pay);
    const salary = buildSection("Salary", e => e.salary_component, e => e.no_pay_days, e => e.no_pay_amount);
    const allowance = buildSection("Allowance", e => spmReportsEnabled ? e.monthly_bonus : e.allowance_component, e => e.bonus_no_pay_days ?? e.no_pay_days, e => e.bonus_no_pay);

    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Employee Name", "Salary Rs.", "Nopay Days", "Nopay Amount Rs."]
      : ["Employee Name", "Salary Rs.", "Nopay Days", "Nopay Amount Rs."];

    const grandDays = basic.subDays + salary.subDays + allowance.subDays;
    const grandAmount = basic.subAmount + salary.subAmount + allowance.subAmount;
    const grandSalary = basic.subSalary + salary.subSalary + allowance.subSalary;

    const multiSections = [
      { title: "Schedule 02: Nopay — Basic", headers, rows: basic.rows, footer: basic.foot },
      { title: "Schedule 02: Nopay — Salary", headers, rows: salary.rows, footer: salary.foot },
      { title: "Schedule 02: Nopay — Monthly Bonus", headers, rows: allowance.rows, footer: allowance.foot },
    ];

    const summaryHeaders = ["Total Salary", "Total Nopay Days", "Total Nopay Amount", "Net Salary"];
    const summaryRows = [[fmt(grandSalary), grandDays.toFixed(1), fmt(grandAmount), fmt(grandSalary - grandAmount)]];

    return {
      headers,
      rows: multiSections[0].rows,
      footer: spmReportsEnabled ? ["", "GRAND TOTAL", "", fmt(grandSalary), grandDays.toFixed(1), fmt(grandAmount)] : ["GRAND TOTAL", fmt(grandSalary), grandDays.toFixed(1), fmt(grandAmount)],
      multiSections,
      summaryHeaders,
      summaryRows,
      reportTitle: `Schedule 02: Nopay — ${monthLabel} ${selectedYear}`,
    };
  };

  // 15. Schedule 07: Staff Fund
  const generateSchedule07StaffFundData = () => {
    const sf = scheduleReportData?.staff_fund;
    if (!sf) return { headers: ["No Data"], rows: [], footer: [] };

    const headers = spmReportsEnabled
      ? [
          "Emp No", "EPF No", "Date Joined", "Period of Service", "Employee Name",
          "Basic Salary", "Monthly Bonus", "Total Salary",
          "Employee Contribution", "Employer Contribution", "Total Contribution"
        ]
      : [
          "Date Joined", "Period of Service", "Employee Name",
          "Basic Salary", "Allowance", "Total Salary",
          "Employee Contribution", "Employer Contribution", "Total Contribution"
        ];

    let tBasic = 0, tAllow = 0, tTotal = 0, tEmp = 0, tEmpr = 0, tContrib = 0;
    const rows = (sf.details?.rows || []).map(r => {
      const basic = Number(r.basic_salary) || 0;
      const allow = Number(r.allowance) || 0;
      const tot = Number(r.total_salary) || (basic + allow);
      const empC = Number(r.employee_contribution) || 0;
      const emprC = Number(r.employer_contribution) || 0;
      const totC = Number(r.total_contribution) || (empC + emprC);

      tBasic += basic; tAllow += allow; tTotal += tot; tEmp += empC; tEmpr += emprC; tContrib += totC;
      const p = formatPeriodYm(r.period_of_service, r.date_joined, r.date_resigned);

      if (spmReportsEnabled) {
        return [
          r.employee_no || r.emp_no || "-",
          r.epf_no || r.epf || "-",
          r.date_joined || "-",
          p,
          r.employee_name || "-",
          fmt(basic),
          fmt(allow),
          fmt(tot),
          fmt(empC),
          fmt(emprC),
          fmt(totC),
        ];
      }
      return [
        r.date_joined || "-",
        p,
        r.employee_name || "-",
        fmt(basic),
        fmt(allow),
        fmt(tot),
        fmt(empC),
        fmt(emprC),
        fmt(totC),
      ];
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", "", "", fmt(tBasic), fmt(tAllow), fmt(tTotal), fmt(tEmp), fmt(tEmpr), fmt(tContrib)]
      : ["TOTAL", "", "", fmt(tBasic), fmt(tAllow), fmt(tTotal), fmt(tEmp), fmt(tEmpr), fmt(tContrib)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Schedule 07: Staff Fund — ${monthLabel} ${selectedYear}`,
    };
  };

  // 16. Schedule 04: Loan Summary
  const generateSchedule04LoanSummaryData = () => {
    const sch = scheduleReportData?.loan_summary;
    if (!sch) return { headers: ["No Data"], rows: [], footer: [] };

    const headers = spmReportsEnabled
      ? [
          "Emp No", "EPF No", "Employee Name",
          "Loan Date", "Loan Amount", "Loan Installment", "Total Loan Deduction", "Loan Balance Outstanding",
          "Interest Deduction", "Total Interest Deduction", "Interest Balance Outstanding"
        ]
      : [
          "Employee Name", "Granted Date", "Granted Amount",
          "Loan Monthly Deduction", "Loan Total Deduction", "Loan Balance Outstanding",
          "Interest Monthly Deduction", "Interest Total Deduction", "Interest Balance Outstanding"
        ];

    let tGranted = 0, tInst = 0, tTotDed = 0, tBal = 0, tInt = 0, tTotInt = 0, tIntBal = 0;
    const rows = (sch.rows || []).map(r => {
      const granted = Number(r.granted_amount ?? r.loan_amount) || 0;
      const inst = Number(r.loan_monthly_deduction ?? r.loan_installment) || 0;
      const totDed = Number(r.loan_total_deduction ?? r.total_deduction) || 0;
      const bal = Number(r.loan_balance_outstanding ?? (granted - totDed)) || 0;
      const intDed = Number(r.interest_monthly_deduction ?? r.interest_deduction) || 0;
      const totInt = Number(r.interest_total_deduction ?? r.total_interest_deduction) || 0;
      const intBal = Number(r.interest_balance_outstanding) || 0;

      tGranted += granted; tInst += inst; tTotDed += totDed; tBal += bal;
      tInt += intDed; tTotInt += totInt; tIntBal += intBal;

      const loanDateStr = r.loan_date || r.granted_date || "-";

      if (spmReportsEnabled) {
        return [
          r.employee_no || r.emp_no || "-",
          r.epf_no || r.epf || "-",
          r.employee_name || "-",
          loanDateStr,
          fmt(granted),
          fmt(inst),
          fmt(totDed),
          fmt(bal),
          fmt(intDed),
          fmt(totInt),
          fmt(intBal),
        ];
      }
      return [
        r.employee_name || "-",
        loanDateStr,
        fmt(granted),
        fmt(inst),
        fmt(totDed),
        fmt(bal),
        fmt(intDed),
        fmt(totInt),
        fmt(intBal),
      ];
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", "", fmt(tGranted), fmt(tInst), fmt(tTotDed), fmt(tBal), fmt(tInt), fmt(tTotInt), fmt(tIntBal)]
      : ["TOTAL", "", fmt(tGranted), fmt(tInst), fmt(tTotDed), fmt(tBal), fmt(tInt), fmt(tTotInt), fmt(tIntBal)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Schedule 04: Loan Summary — ${monthLabel} ${selectedYear}`,
    };
  };

  // 17. Schedule 04(a): Staff Loan Detail
  const generateSchedule04aLoanDetailData = () => {
    const sections = scheduleReportData?.loan_details || [];
    if (sections.length === 0) {
      return { headers: ["Month", "Loan Amount", "Monthly Deduction", "Balance", "Interest", "Total Deduction"], rows: [], multiSections: [] };
    }

    const multiSections = sections.map((sec) => {
      const headers = spmReportsEnabled
        ? ["Month", "Loan Date", "Loan Amount", "Loan Installment", "Total Loan Deduction", "Interest Deduction", "Total Interest Deduction"]
        : (sec.headers || ["Month", "Loan Amount", "Monthly Deduction", "Balance", "Interest", "Total Deduction"]);

      let tAmount = 0, tInst = 0, tDed = 0, tInt = 0, tTotInt = 0;
      const rows = (sec.rows || []).map((r) => {
        const amt = Number(r.loan_amount) || 0;
        const inst = Number(r.monthly_deduction ?? r.installment_amount) || 0;
        const totDed = Number(r.total_deduction ?? r.principal_deduction) || 0;
        const interest = Number(r.interest ?? r.interest_deduction) || 0;
        const totInt = Number(r.total_interest_deduction) || 0;

        tAmount += amt; tInst += inst; tDed += totDed; tInt += interest; tTotInt += totInt;
        const lDate = r.loan_date || sec.loan_date || "-";

        if (spmReportsEnabled) {
          return [
            r.month || "-",
            lDate,
            fmt(amt),
            fmt(inst),
            fmt(totDed),
            fmt(interest),
            fmt(totInt),
          ];
        }
        return [
          r.month || "-",
          fmt(amt),
          fmt(inst),
          fmt(r.balance_outstanding),
          fmt(interest),
          fmt(r.total_deduction),
        ];
      });

      const footer = spmReportsEnabled
        ? ["Total", "", fmt(tAmount), fmt(tInst), fmt(tDed), fmt(tInt), fmt(tTotInt)]
        : ["Total", fmt(tAmount), fmt(tInst), "", fmt(tInt), fmt(tDed + tInt)];

      return {
        title: `${sec.employee_name} — ${sec.loan_label || "Staff Loan"}`,
        subtitle: `Emp No: ${sec.employee_no || "-"} | EPF No: ${sec.epf_no || "-"} | Loan Date: ${sec.loan_date || "-"}`,
        headers,
        rows,
        footer,
      };
    });

    return {
      headers: multiSections[0]?.headers || [],
      rows: multiSections[0]?.rows || [],
      footer: multiSections[0]?.footer || [],
      multiSections,
      reportTitle: `Schedule 04(a): Staff Loan Detail — ${monthLabel} ${selectedYear}`,
    };
  };

  // 18. Summary for Net Pay
  const generateNetPaySummaryListData = () => {
    let rows = []; let tSalary = 0, tAllow = 0, tNet = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "Basic Salary", "Monthly Bonus", "Net Pay"]
      : ["Emp No", "Name", "Basic Salary", "Allowance", "Net Pay"];

    reportData.forEach(e => {
      const basic = Number(e.basic_salary ?? e.salary_component) || 0;
      const allow = Number(spmReportsEnabled ? (e.monthly_bonus ?? e.allowance_component) : e.allowance_component) || 0;
      const net = Number(e.net_salary ?? (basic + allow)) || 0;
      tSalary += basic; tAllow += allow; tNet += net;

      if (spmReportsEnabled) {
        rows.push([e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name, fmt(basic), fmt(allow), fmt(net)]);
      } else {
        rows.push([e.emp_no, e.name, fmt(basic), fmt(allow), fmt(net)]);
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", fmt(tSalary), fmt(tAllow), fmt(tNet)]
      : ["TOTAL", "", fmt(tSalary), fmt(tAllow), fmt(tNet)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Summary for Net Pay — ${monthLabel} ${selectedYear}`,
    };
  };

  // 19. Summary for Net Pay (Breakdown)
  const generateNetPaySummaryBreakdownData = () => {
    const salaryComp = sumField('salary_component');
    const allowComp = spmReportsEnabled ? sumField('monthly_bonus') : sumField('allowance_component');
    const gross = sumField('gross_salary');
    const basicNp = sumField('basic_no_pay');
    const bonusNp = sumField('bonus_no_pay');
    const totalNp = sumField('no_pay_amount');
    const advance = sumField('salary_advance');
    const advanceBasic = sumField('salary_advance_basic');
    const loanInst = sumField('loan_installment');
    const loanInt = sumField('loan_interest');
    const sports = sumField('sports_fund');
    const staff = sumField('staff_fund');
    const epf8 = sumField('epf_8');
    const totalDed = sumField('total_deductions');
    const basicNet = sumField('epf_schedule_net');
    const allowNet = sumField('allowance_net');
    const net = sumField('net_salary');

    const rows = [
      ["Earnings", fmt(salaryComp), fmt(allowComp), fmt(gross)],
      ["Less: No pay", fmt(basicNp), fmt(bonusNp), fmt(totalNp)],
      ["Gross Pay", fmt(salaryComp - basicNp), fmt(allowComp - bonusNp), fmt(gross - totalNp)],
      ["Salary Advance", fmt(advanceBasic), fmt(advance - advanceBasic), fmt(advance)],
      ["Loan Installment", fmt(sumField('loan_on_basic')), fmt(sumField('loan_on_bonus')), fmt(loanInst)],
      ["Loan Interest", fmt(0), fmt(loanInt), fmt(loanInt)],
      ["Sports Fund", fmt(0), fmt(sports), fmt(sports)],
      ["Staff Fund", fmt(0), fmt(staff), fmt(staff)],
      ["EPF 8%", fmt(epf8), fmt(0), fmt(epf8)],
      ["Total Deductions", fmt(epf8 + basicNp + sumField('loan_on_basic') + advanceBasic), fmt(totalDed - epf8 - basicNp - sumField('loan_on_basic') - advanceBasic), fmt(totalDed)],
      ["Net Pay", fmt(basicNet), fmt(allowNet), fmt(net)],
    ];

    return {
      headers: ["", "Basic Salary", spmReportsEnabled ? "Monthly Bonus" : "Allowance", "Total"],
      rows,
      reportTitle: `Summary for Net Pay (Breakdown) — ${monthLabel} ${selectedYear}`,
    };
  };

  // 20. Bank Salary Payment Letter
  const generateBankSalaryLetterData = () => {
    const company = scheduleReportData?.company;
    const companyName = company?.name || "Company";
    let rows = []; let total = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "Account No", "Amount"]
      : ["Emp No", "Name", "Account No", "Amount"];

    reportData.forEach(e => {
      const net = Number(e.bank_transfer_amount ?? e.bank_amount ?? e.net_salary) || 0;
      if (net > 0) {
        total += net;
        if (spmReportsEnabled) {
          rows.push([e.emp_no, e.epf_no || e.epf || e.epf_member_no || "-", e.name, e.bank_account_no || "-", fmt(net)]);
        } else {
          rows.push([e.emp_no, e.name, e.bank_account_no || "-", fmt(net)]);
        }
      }
    });

    const footer = spmReportsEnabled
      ? ["", "", "TOTAL", "", fmt(total)]
      : ["TOTAL", "", "", fmt(total)];

    const letterLines = [
      `Date: ${new Date().toISOString().split("T")[0]}`,
      "The Manager,",
      "Bank of Ceylon / Commercial Bank,",
      "",
      `Dear Sir/Madam,`,
      `RE: SALARY REMITTANCE FOR ${monthLabel.toUpperCase()} ${selectedYear}`,
      `Please credit the following accounts from ${companyName} with the respective amounts listed below:`,
      "",
    ];

    return {
      headers,
      rows,
      footer,
      letterLines,
      reportTitle: `Bank Salary Payment Letter — ${monthLabel} ${selectedYear}`,
    };
  };

  // 21. Overtime Schedule
  const generateOvertimeScheduleData = () => {
    let rows = [];
    let tNormHrs = 0, tNormAmt = 0, tDblHrs = 0, tDblAmt = 0, tGrandAmt = 0;
    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "Basic Rate", "1.5 OT Hours", "1.5 OT Rate", "1.5 OT Amount", "2.0 OT Hours", "2.0 OT Rate", "2.0 OT Amount", "Total OT Amount"]
      : ["Emp No", "Name", "Basic Rate", "1.5 OT Hours", "1.5 OT Rate", "1.5 OT Amount", "2.0 OT Hours", "2.0 OT Rate", "2.0 OT Amount", "Total OT Amount"];

    reportData.forEach(e => {
      const nHrs = Number(e.normal_ot_hours) || 0;
      const nRate = Number(e.normal_ot_rate) || 0;
      const nAmt = Number(e.normal_ot_amount) || 0;
      const dHrs = Number(e.double_ot_hours) || 0;
      const dRate = Number(e.double_ot_rate) || 0;
      const dAmt = Number(e.double_ot_amount) || 0;
      const tot = Number(e.total_ot_amount) || (nAmt + dAmt);

      if (tot > 0 || nHrs > 0 || dHrs > 0) {
        tNormHrs += nHrs; tNormAmt += nAmt; tDblHrs += dHrs; tDblAmt += dAmt; tGrandAmt += tot;
        if (spmReportsEnabled) {
          rows.push([
            e.emp_no,
            e.epf_no || e.epf || e.epf_member_no || "-",
            e.name,
            fmt(e.basic_salary),
            nHrs.toFixed(1),
            fmt(nRate),
            fmt(nAmt),
            dHrs.toFixed(1),
            fmt(dRate),
            fmt(dAmt),
            fmt(tot),
          ]);
        } else {
          rows.push([
            e.emp_no,
            e.name,
            fmt(e.basic_salary),
            nHrs.toFixed(1),
            fmt(nRate),
            fmt(nAmt),
            dHrs.toFixed(1),
            fmt(dRate),
            fmt(dAmt),
            fmt(tot),
          ]);
        }
      }
    });

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", "", tNormHrs.toFixed(1), "", fmt(tNormAmt), tDblHrs.toFixed(1), "", fmt(tDblAmt), fmt(tGrandAmt)]
      : ["TOTAL", "", "", tNormHrs.toFixed(1), "", fmt(tNormAmt), tDblHrs.toFixed(1), "", fmt(tDblAmt), fmt(tGrandAmt)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Overtime Schedule — ${monthLabel} ${selectedYear}`,
    };
  };

  // 22. Cash Summary — Monthly Bonus / Net Allowance
  const generateCashAllowanceSummaryData = () => {
    let rows = []; let noteTotals = new Array(NOTES_ARRAY.length).fill(0); let totalCash = 0;
    reportData.forEach(e => {
      const netPay = Number(e.allowance_net ?? e.cash_amount ?? e.net_salary) || 0;
      if (netPay > 0) {
        totalCash += netPay;
        const counts = [];
        let temp = Math.round(netPay);
        NOTES_ARRAY.forEach((note, idx) => {
          const count = e.saved_coinage ? (e.saved_coinage[note] || 0) : Math.floor(temp / note);
          if (!e.saved_coinage) temp = temp % note;
          counts.push(String(count));
          noteTotals[idx] += count;
        });

        if (spmReportsEnabled) {
          rows.push([
            e.emp_no,
            e.epf_no || e.epf || e.epf_member_no || "-",
            e.name,
            fmt(netPay),
            ...counts,
          ]);
        } else {
          rows.push([
            e.emp_no,
            e.name,
            fmt(netPay),
            ...counts,
          ]);
        }
      }
    });

    const headers = spmReportsEnabled
      ? ["Emp No", "EPF No", "Name", "Net Pay", ...NOTES_ARRAY.map(n => `Rs. ${n}`)]
      : ["Emp No", "Name", "Net Pay", ...NOTES_ARRAY.map(n => `Rs. ${n}`)];

    const footer = spmReportsEnabled
      ? ["", "TOTAL", "", fmt(totalCash), ...noteTotals.map(n => String(n))]
      : ["TOTAL", "", fmt(totalCash), ...noteTotals.map(n => String(n))];

    return {
      headers,
      rows,
      footer,
      reportTitle: spmReportsEnabled
        ? `Cash Summary — Monthly Bonus — ${monthLabel} ${selectedYear}`
        : `Cash Summary — Net Allowance — ${monthLabel} ${selectedYear}`,
    };
  };

  // 23. Coinage — Monthly Bonus / Staff Allowance
  const generateCoinageStaffAllowanceData = () => {
    let noteTotals = new Array(NOTES_ARRAY.length).fill(0); let totalCash = 0;
    reportData.forEach(e => {
      const netPay = Number(e.allowance_net ?? e.cash_amount ?? e.net_salary) || 0;
      if (netPay > 0) {
        totalCash += netPay;
        let temp = Math.round(netPay);
        NOTES_ARRAY.forEach((note, idx) => {
          const count = e.saved_coinage ? (e.saved_coinage[note] || 0) : Math.floor(temp / note);
          if (!e.saved_coinage) temp = temp % note;
          noteTotals[idx] += count;
        });
      }
    });

    const coinRows = NOTES_ARRAY.map((note, i) => [
      note >= 100 ? `${note} Note` : `${note} Coin`,
      String(noteTotals[i]),
      fmt(note * noteTotals[i]),
    ]);

    return {
      headers: ["Notes & Coins", "Nos.", "Amount Rs."],
      rows: coinRows,
      footer: ["Grand Total", "", fmt(totalCash)],
      reportTitle: spmReportsEnabled
        ? `Coinage — Monthly Bonus — ${monthLabel} ${selectedYear}`
        : `Coinage for Staff Allowance — ${monthLabel} ${selectedYear}`,
    };
  };

  // 29. OT Coinage Report
  const generateOTCoinageData = () => {
    let rows = [];
    let noteTotals = new Array(NOTES_ARRAY.length).fill(0);
    let grandTotalOT = 0;
    let grandTotalPay = 0;

    reportData.forEach(e => {
      const otAmount = Number(e.total_ot_amount) || ((Number(e.normal_ot_amount) || 0) + (Number(e.double_ot_amount) || 0)) || Number(e.ot_amount) || 0;
      if (otAmount > 0) {
        grandTotalOT += otAmount;
        let temp = Math.round(otAmount);
        const counts = [];
        let empPay = 0;
        NOTES_ARRAY.forEach((note, idx) => {
          const count = e.saved_ot_coinage ? (e.saved_ot_coinage[note] || 0) : Math.floor(temp / note);
          if (!e.saved_ot_coinage) temp = temp % note;
          counts.push(String(count));
          empPay += count * note;
          noteTotals[idx] += count;
        });
        grandTotalPay += empPay;

        rows.push([
          e.emp_no,
          e.epf_no || e.epf || e.epf_member_no || "-",
          e.name,
          fmt(otAmount),
          ...counts,
          fmt(empPay),
        ]);
      }
    });

    const headers = [
      "Emp No",
      "EPF No",
      "Employee Name",
      "Total OT Rs.",
      "5,000",
      "1,000",
      "500",
      "100",
      "50",
      "20",
      "10",
      "5",
      "2",
      "1",
      "Total Pay Rs.",
    ];

    const footer = [
      "",
      "TOTAL",
      "",
      fmt(grandTotalOT),
      ...noteTotals.map(n => String(n)),
      fmt(grandTotalPay),
    ];

    const multiHead = [
      [
        { content: "Emp No", rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: "EPF No", rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: "Employee Name", rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: "Total OT\nRs.", rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
        { content: "Coinage for Overtime (Rs.)", colSpan: 10, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: "Total Pay\nRs.", rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
      ],
      [
        { content: "Notes", colSpan: 6, styles: { halign: 'center', fontStyle: 'bold' } },
        { content: "Coins", colSpan: 4, styles: { halign: 'center', fontStyle: 'bold' } },
      ],
      [
        { content: "5,000", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "1,000", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "500", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "100", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "50", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "20", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "10", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "5", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "2", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
        { content: "1", styles: { halign: 'center', fillColor: [198, 239, 206], textColor: [0, 97, 0], fontStyle: 'bold' } },
      ],
    ];

    return {
      headers,
      rows,
      footer,
      multiHead,
      reportTitle: `OT Coinage Report — ${monthLabel} ${selectedYear}`,
    };
  };

  // 24. Schedule 07(a): Staff Fund Details
  const generateSchedule07aStaffFundDetailData = () => {
    const list = scheduleReportData?.staff_fund_detail_07a || [];
    if (!list.length) {
      return { headers: ["Period", "Staff Fund", "Sports Fund", "Total"], rows: [], multiSections: [] };
    }

    const empHeaders = ["Period", "Staff Fund (Employee)", "Sports Fund (Employee)", "Total Employee"];
    const erHeaders = ["Period", "Staff Fund (Employer)", "Sports Fund (Employer)", "Total Employer"];
    const multiSections = [];

    list.forEach(sec => {
      const empRows = (sec.employee_rows || []).map(r => [
        r.period,
        fmt(r.employee_staff),
        fmt(r.employee_sports),
        fmt(r.employee_total),
      ]);
      const empFoot = sec.employee_footer || {};
      const empFooter = [
        empFoot.period || "Total",
        fmt(empFoot.employee_staff),
        fmt(empFoot.employee_sports),
        fmt(empFoot.employee_total),
      ];

      const erRows = (sec.employee_rows || []).map(r => [
        r.period,
        fmt(r.employer_staff),
        fmt(r.employer_sports),
        fmt(r.employer_total),
      ]);
      const erFoot = sec.employer_footer || {};
      const erFooter = [
        erFoot.period || "Total",
        fmt(erFoot.employer_staff),
        fmt(erFoot.employer_sports),
        fmt(erFoot.employer_total),
      ];

      const periodFormatted = formatPeriodYm(sec.period_of_service, sec.date_joined, sec.date_resigned);

      multiSections.push({
        title: `${sec.employee_name} — Employee Contribution (${sec.fiscal_year || ""})`,
        subtitle: `Emp No: ${sec.employee_no || "-"} | EPF No: ${sec.epf_no || "-"} | Joined: ${sec.date_joined || "-"} | Resigned: ${sec.date_resigned || "-"} | Period: ${periodFormatted}`,
        headers: empHeaders,
        rows: empRows,
        footer: empFooter,
      });

      multiSections.push({
        title: `${sec.employee_name} — Employer Contribution (${sec.fiscal_year || ""})`,
        subtitle: `Emp No: ${sec.employee_no || "-"} | EPF No: ${sec.epf_no || "-"} | Joined: ${sec.date_joined || "-"} | Resigned: ${sec.date_resigned || "-"} | Period: ${periodFormatted}`,
        headers: erHeaders,
        rows: erRows,
        footer: erFooter,
      });
    });

    return {
      headers: empHeaders,
      rows: multiSections[0]?.rows || [],
      footer: multiSections[0]?.footer || [],
      multiSections,
      reportTitle: `Schedule 07(a): Staff Fund Details — ${monthLabel} ${selectedYear}`,
    };
  };

  // 25. Schedule 01: Basic Salary
  const generateSchedule01BasicSalaryData = () => {
    let rows = []; let totalBasic = 0;
    const headers = ["Emp No", "EPF No", "Employee Name", "Basic Salary"];

    reportData.forEach(e => {
      const basic = Number(e.basic_salary ?? e.base_basic_salary) || 0;
      totalBasic += basic;
      rows.push([
        e.emp_no,
        e.epf_no || e.epf || e.epf_member_no || "-",
        e.name,
        fmt(basic),
      ]);
    });

    const footer = ["", "TOTAL", "", fmt(totalBasic)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Schedule 01: Basic Salary — ${monthLabel} ${selectedYear}`,
    };
  };

  // 26. Schedule 05: Sports Fund
  const generateSchedule05SportsFundData = () => {
    let rows = [];
    let tBasic = 0, tBonus = 0, tTotal = 0, tSports = 0;
    const headers = ["Emp No", "EPF No", "Name", "Basic Salary", "Monthly Bonus", "Total Salary", "Sports Fund (0.5%)"];

    reportData.forEach(e => {
      const basic = Number(e.basic_salary ?? e.base_basic_salary) || 0;
      const bonus = Number(e.monthly_bonus ?? e.allowance_component) || 0;
      const totSalary = Number(e.total_salary) || (basic + bonus);
      const sportsFund = Number(e.sports_fund) || 0;

      tBasic += basic; tBonus += bonus; tTotal += totSalary; tSports += sportsFund;

      rows.push([
        e.emp_no,
        e.epf_no || e.epf || e.epf_member_no || "-",
        e.name,
        fmt(basic),
        fmt(bonus),
        fmt(totSalary),
        fmt(sportsFund),
      ]);
    });

    const footer = ["", "TOTAL", "", fmt(tBasic), fmt(tBonus), fmt(tTotal), fmt(tSports)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Schedule 05: Sports Fund — ${monthLabel} ${selectedYear}`,
    };
  };

  // 28. Leave Summary
  const generateLeaveSummaryData = () => {
    const headers = ["Emp No", "EPF No", "Employee Full Name", "Leave Entitlement", "Leave Obtained", "Leave Balance"];
    let tEntitled = 0, tObtained = 0, tBalance = 0;
    const list = Array.isArray(leaveSummaryData) ? leaveSummaryData : [];

    const formatLeaveDays = (n) => {
      const num = Number(n) || 0;
      return num % 1 === 0 ? num.toFixed(1) : (Math.round(num * 100) / 100).toString();
    };

    const rows = list.map((e) => {
      const entitled = Number(e.leave_entitlement || 0);
      const obtained = Number(e.leave_obtained || 0);
      const balance = Number(e.leave_balance != null ? e.leave_balance : Math.max(0, entitled - obtained));

      tEntitled += entitled;
      tObtained += obtained;
      tBalance += balance;

      const empNo = e.emp_no || e.attendance_employee_no || "-";
      const epfNo = e.epf_no || e.epf || e.epf_member_no || "-";
      const fullName = e.employee_full_name || e.full_name || e.name || e.employee_name || "-";

      return [
        empNo,
        epfNo,
        fullName,
        formatLeaveDays(entitled),
        formatLeaveDays(obtained),
        formatLeaveDays(balance),
      ];
    });

    const footer = ["", "TOTAL", "", formatLeaveDays(tEntitled), formatLeaveDays(tObtained), formatLeaveDays(tBalance)];

    return {
      headers,
      rows,
      footer,
      reportTitle: `Leave Summary — ${monthLabel} ${selectedYear}`,
    };
  };

  // --- COMBINED MULTI-REPORT MODAL & PDF GENERATORS ---

  const downloadCombinedPDF = () => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const sections = [
      { title: spmReportsEnabled ? "Salary & Monthly Bonus (Total)" : "Salary & Allowance (Total)", data: generateSalaryAllowanceTotalData() },
      { title: spmReportsEnabled ? "Salary Details" : "Salary Details (EPF/ETF)", data: generateSalaryDetailsData() },
      { title: spmReportsEnabled ? "Monthly Bonus" : "Allowance", data: generateAllowanceScheduleData() },
    ];
    const doc = new jsPDF("landscape", "mm", "a3");
    doc.setFontSize(16);
    doc.text(`Salary & Allowance Reports - ${monthLabel} ${selectedYear}`, 14, 15);
    let startY = 25;
    sections.forEach((section, idx) => {
      if (idx > 0) startY += 8;
      doc.setFontSize(12);
      doc.text(section.data.reportTitle || section.title, 14, startY);
      autoTable(doc, {
        startY: startY + 4,
        head: [section.data.headers],
        body: section.data.rows,
        foot: section.data.footer?.length ? [section.data.footer] : [],
        theme: "grid",
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: "bold" },
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [20, 20, 20] },
        columnStyles: buildColumnStyles(section.data.headers, section.data.rows),
        margin: { left: 14, right: 14 },
      });
      startY = doc.lastAutoTable.finalY + 10;
      if (startY > 180 && idx < sections.length - 1) {
        doc.addPage();
        startY = 20;
      }
    });
    doc.save(`Salary_Allowance_Schedules_${selectedYear}_${selectedMonth}.pdf`);
  };

  const openCoinageModal = (format, type = "cash") => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    setCoinageType(type);
    let initialData = [];
    if (type === "ot") {
      reportData.forEach(e => {
        const otVal = Number(e.total_ot_amount) || ((Number(e.normal_ot_amount) || 0) + (Number(e.double_ot_amount) || 0)) || Number(e.ot_amount) || 0;
        let amount = Math.round(otVal);
        if (amount > 0) {
          if (e.saved_ot_coinage) {
            initialData.push({ process_id: e.process_id, emp_no: e.emp_no, epf_no: e.epf_no || e.epf || e.epf_member_no || "-", name: e.name, amount: amount, notes: { ...e.saved_ot_coinage } });
          } else {
            let counts = {}; let temp = amount;
            NOTES_ARRAY.forEach(note => { counts[note] = Math.floor(temp / note); temp = temp % note; });
            initialData.push({ process_id: e.process_id, emp_no: e.emp_no, epf_no: e.epf_no || e.epf || e.epf_member_no || "-", name: e.name, amount: amount, notes: counts });
          }
        }
      });
      if (initialData.length === 0) return Swal.fire("Empty", "No overtime payments for this month.", "info");
    } else {
      reportData.forEach(e => {
        let amount = Math.round(Number(e.allowance_net) || Number(e.cash_amount) || 0);
        if (amount > 0) {
          if (e.saved_coinage) {
            initialData.push({ process_id: e.process_id, emp_no: e.emp_no, epf_no: e.epf_no || e.epf || e.epf_member_no || "-", name: e.name, amount: amount, notes: { ...e.saved_coinage } });
          } else {
            let counts = {}; let temp = amount;
            NOTES_ARRAY.forEach(note => { counts[note] = Math.floor(temp / note); temp = temp % note; });
            initialData.push({ process_id: e.process_id, emp_no: e.emp_no, epf_no: e.epf_no || e.epf || e.epf_member_no || "-", name: e.name, amount: amount, notes: counts });
          }
        }
      });
      if (initialData.length === 0) return Swal.fire("Empty", "No allowance cash payments for this month.", "info");
    }
    setEditableCoinage(initialData); setCoinageFormat(format); setShowCoinageModal(true);
  };

  const handleNoteChange = (empIndex, noteValue, newCount) => {
    const updated = [...editableCoinage];
    updated[empIndex].notes[noteValue] = parseInt(newCount) || 0;
    setEditableCoinage(updated);
  };

  const processAndDownloadCoinage = async () => {
    try {
      if (coinageType === "ot") {
        await ReportService.saveOtCoinageData(editableCoinage);
        setReportData(prev => prev.map(emp => {
          const matched = editableCoinage.find(c => (c.process_id && c.process_id === emp.process_id) || c.emp_no === emp.emp_no);
          if (matched) {
            return { ...emp, saved_ot_coinage: { ...matched.notes } };
          }
          return emp;
        }));
        if (coinageFormat === 'csv') downloadCSV(generateOTCoinageData, "OT_Coinage_Report");
        else downloadPDF(generateOTCoinageData, "OT Coinage Report", "OT_Coinage_Report");
        setShowCoinageModal(false);
        handleFetchData();
      } else {
        await ReportService.saveCoinageData(editableCoinage);
        setReportData(prev => prev.map(emp => {
          const matched = editableCoinage.find(c => (c.process_id && c.process_id === emp.process_id) || c.emp_no === emp.emp_no);
          if (matched) {
            return { ...emp, saved_coinage: { ...matched.notes } };
          }
          return emp;
        }));
        let rows = []; let noteTotals = new Array(NOTES_ARRAY.length).fill(0); let totalCash = 0;
        editableCoinage.forEach(emp => {
          let row = [emp.emp_no, emp.name, fmt(emp.amount)];
          totalCash += emp.amount;
          NOTES_ARRAY.forEach((note, index) => {
            let count = emp.notes[note] || 0;
            row.push(count.toString());
            noteTotals[index] += count;
          });
          rows.push(row);
        });
        const headers = ["Emp No", "Name", "Cash Amount", ...NOTES_ARRAY.map(n => `Rs. ${n}`)];
        const footer = ["", "TOTAL", fmt(totalCash), ...noteTotals.map(n => n.toString())];
        const dataFunc = () => ({ headers, rows, footer });

        if (coinageFormat === 'csv') downloadCSV(dataFunc, "Cash_Coinage_Summary");
        else downloadPDF(dataFunc, "Cash Coinage Summary", "Cash_Coinage_Summary");
        setShowCoinageModal(false);
        handleFetchData();
      }
    } catch (error) {
      Swal.fire("Error", "Failed to save coinage data. Please try again.", "error");
    }
  };

  const downloadCSV = (dataFunc, filename) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const { headers, rows, footer, summaryHeaders, summaryRows, multiSections } = dataFunc();
    if (rows.length === 0 && !(multiSections?.length)) return Swal.fire("Empty", "No data available for this report.", "info");
    let csvContent = "\uFEFF";
    if (multiSections?.length) {
      multiSections.forEach((sec, idx) => {
        if (idx > 0) csvContent += "\n";
        csvContent += `"${sec.title}"\n`;
        if (sec.subtitle) csvContent += `"${sec.subtitle}"\n`;
        csvContent += sec.headers.join(",") + "\n";
        sec.rows.forEach(r => { csvContent += r.map(v => `"${v}"`).join(",") + "\n"; });
        if (sec.footer && sec.footer.length > 0) csvContent += sec.footer.map(v => `"${v}"`).join(",") + "\n";
      });
    } else {
      csvContent += headers.join(",") + "\n";
      rows.forEach(r => { csvContent += r.map(v => `"${v}"`).join(",") + "\n"; });
      if (footer && footer.length > 0) csvContent += footer.map(v => `"${v}"`).join(",") + "\n";
    }
    if (summaryHeaders?.length && summaryRows?.length) {
      csvContent += "\n" + summaryHeaders.join(",") + "\n";
      summaryRows.forEach(r => { csvContent += r.map(v => `"${v}"`).join(",") + "\n"; });
    }
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); 
    link.setAttribute("download", `${filename}_${selectedYear}_${selectedMonth}.csv`);
    document.body.appendChild(link); link.click(); link.remove();
  };

  const downloadPDF = (dataFunc, title, filename) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const result = dataFunc();
    const { headers, rows, footer, reportTitle, summaryHeaders, summaryRows, multiSections, letterLines, subtitle, multiHead } = result;
    if (rows.length === 0 && !(multiSections?.length)) return Swal.fire("Empty", "No data available for this report.", "info");
    const isWideTable = headers.length > 9;
    const doc = new jsPDF("landscape", "mm", isWideTable ? "a3" : "a4");
    doc.setFontSize(isWideTable ? 18 : 16);
    doc.text(reportTitle || `${title} - ${monthLabel} ${selectedYear}`, 14, 15);
    let startY = 22;
    if (subtitle) {
      doc.setFontSize(10);
      doc.text(subtitle, 14, startY);
      startY += 8;
    }
    if (letterLines?.length) {
      doc.setFontSize(10);
      letterLines.forEach((line) => {
        if (line) doc.text(line, 14, startY);
        startY += line ? 6 : 3;
      });
      startY += 4;
    }

    const renderTable = (tableStartY, tableHeaders, tableRows, tableFooter, tableMultiHead) => {
      autoTable(doc, {
        startY: tableStartY,
        head: tableMultiHead || [tableHeaders],
        body: tableRows,
        foot: tableFooter?.length > 0 ? [tableFooter] : [],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
        styles: { fontSize: isWideTable ? 8 : 9.5, cellPadding: isWideTable ? 2.5 : 3.5, textColor: [20, 20, 20] },
        columnStyles: buildColumnStyles(tableHeaders, tableRows),
        margin: { left: 14, right: 14 },
      });
    };

    if (multiSections?.length) {
      let y = startY;
      multiSections.forEach((section, idx) => {
        if (idx > 0) y = (doc.lastAutoTable?.finalY || y) + 10;
        doc.setFontSize(12);
        doc.text(section.title, 14, y);
        if (section.subtitle) {
          doc.setFontSize(9);
          doc.text(section.subtitle, 14, y + 5);
          y += 4;
        }
        renderTable(y + 4, section.headers, section.rows, section.footer || [], section.multiHead);
        if ((doc.lastAutoTable?.finalY || 0) > 180 && idx < multiSections.length - 1) {
          doc.addPage();
          y = 20;
        }
      });
    } else {
      renderTable(startY, headers, rows, footer, multiHead);
    }

    if (summaryHeaders?.length && summaryRows?.length) {
      const finalY = doc.lastAutoTable?.finalY || startY;
      doc.setFontSize(12);
      doc.text("Summary", 14, finalY + 12);
      autoTable(doc, {
        startY: finalY + 16,
        head: [summaryHeaders],
        body: summaryRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9.5, cellPadding: 3, textColor: [20, 20, 20] },
        columnStyles: buildColumnStyles(summaryHeaders, summaryRows),
      });
    }
    doc.save(`${filename}_${selectedYear}_${selectedMonth}.pdf`);
  };

  const openReportPreview = (card) => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const result = card.func();
    const { headers, rows, footer, reportTitle, summaryHeaders, summaryRows, multiSections, multiHead } = result;
    if (rows.length === 0 && !(multiSections?.length)) return Swal.fire("Empty", "No data available for this report.", "info");

    const sections = multiSections?.length
      ? multiSections.map(s => ({ title: s.title, subtitle: s.subtitle, headers: s.headers, rows: s.rows, footer: s.footer || [], multiHead: s.multiHead }))
      : [{ title: reportTitle || card.title, headers, rows, footer, summaryHeaders, summaryRows, multiHead }];

    if (!multiSections?.length && summaryHeaders?.length) {
      sections[0].summaryHeaders = summaryHeaders;
      sections[0].summaryRows = summaryRows;
    } else if (multiSections?.length && summaryHeaders?.length) {
      sections.push({ title: "Summary", headers: summaryHeaders, rows: summaryRows, footer: [] });
    }

    setPreviewReport({
      title: reportTitle || card.title,
      file: card.file,
      func: card.func,
      sections,
    });
    setShowPreviewModal(true);
  };

  const openCombinedPreview = () => {
    if (reportData.length === 0) return Swal.fire("Warning", "Please load data first!", "warning");
    const sections = [
      { title: spmReportsEnabled ? "Salary & Monthly Bonus (Total)" : "Salary & Allowance (Total)", ...generateSalaryAllowanceTotalData() },
      { title: spmReportsEnabled ? "Salary Details" : "Salary Details (EPF/ETF)", ...generateSalaryDetailsData() },
      { title: spmReportsEnabled ? "Monthly Bonus" : "Allowance", ...generateAllowanceScheduleData() },
    ];
    if (sections.every(s => s.rows.length === 0)) {
      return Swal.fire("Empty", "No data available for these reports.", "info");
    }
    setPreviewReport({
      title: "Salary & Allowance Schedules (All 3 Reports)",
      file: "Salary_Allowance_Schedules",
      sections,
    });
    setShowPreviewModal(true);
  };

  const renderPreviewTable = (section) => (
    <div key={section.title} className="mb-8 last:mb-0">
      <h3 className="text-base font-bold text-slate-800 mb-2 sticky top-0 bg-white py-1">{section.title}</h3>
      {section.subtitle && <div className="text-xs text-slate-600 font-medium mb-2">{section.subtitle}</div>}
      <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-[13px] text-left whitespace-nowrap">
          {section.multiHead ? (
            <thead className="bg-slate-800 text-white">
              <tr className="border-b border-slate-700">
                <th rowSpan={3} className="px-3 py-2 border border-slate-700 text-center font-semibold align-middle">Emp No</th>
                <th rowSpan={3} className="px-3 py-2 border border-slate-700 text-center font-semibold align-middle">EPF No</th>
                <th rowSpan={3} className="px-3 py-2 border border-slate-700 text-left font-semibold align-middle">Employee Name</th>
                <th rowSpan={3} className="px-3 py-2 border border-slate-700 text-right font-semibold align-middle">Total OT<br />Rs.</th>
                <th colSpan={10} className="px-3 py-1.5 border border-slate-700 text-center font-bold tracking-wider">Coinage for Overtime (Rs.)</th>
                <th rowSpan={3} className="px-3 py-2 border border-slate-700 text-right font-semibold align-middle">Total Pay<br />Rs.</th>
              </tr>
              <tr className="border-b border-slate-700 bg-slate-700/80">
                <th colSpan={6} className="px-2 py-1 border border-slate-600 text-center font-bold text-xs">Notes</th>
                <th colSpan={4} className="px-2 py-1 border border-slate-600 text-center font-bold text-xs">Coins</th>
              </tr>
              <tr className="bg-emerald-700 text-white font-bold text-xs">
                {NOTES_ARRAY.map(n => (
                  <th key={n} className="px-2 py-1 border border-emerald-800 text-center">{n.toLocaleString()}</th>
                ))}
              </tr>
            </thead>
          ) : (
            <thead className="bg-slate-800 text-white">
              <tr>
                {section.headers.map((h, i) => (
                  <th key={i} className={`px-4 py-2.5 font-semibold ${isAmountColumn(h, i, section.rows) ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {section.rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "bg-white hover:bg-slate-50/70" : "bg-slate-50/50 hover:bg-slate-100/70"}>
                {row.map((cell, ci) => {
                  const h = section.headers[ci];
                  const numVal = Number(String(h).replace(/,/g, ''));
                  const isNoteCol = section.multiHead && NOTES_ARRAY.includes(numVal);
                  const isAmt = isAmountColumn(h, ci, section.rows);
                  const alignClass = isNoteCol ? "text-center font-mono" : isAmt ? "text-right font-mono font-medium" : "text-left";
                  return (
                    <td key={ci} className={`px-3 py-2 border-t border-slate-100 text-slate-800 ${alignClass}`}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            ))}
            {section.footer && section.footer.length > 0 && (
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-900">
                {section.footer.map((cell, fi) => {
                  const h = section.headers[fi];
                  const numVal = Number(String(h).replace(/,/g, ''));
                  const isNoteCol = section.multiHead && NOTES_ARRAY.includes(numVal);
                  const isAmt = isAmountColumn(h, fi, section.rows);
                  const alignClass = isNoteCol
                    ? "text-center font-mono bg-emerald-100 text-emerald-900 border-l border-r border-emerald-200"
                    : isAmt
                    ? "text-right font-mono"
                    : (fi === 1 && section.multiHead) ? "text-center" : "text-left";
                  return (
                    <td key={fi} className={`px-3 py-2.5 ${alignClass}`}>
                      {cell}
                    </td>
                  );
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {section.summaryHeaders && section.summaryRows && (
        <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg max-w-2xl shadow-sm">
          <table className="w-full text-[13px] text-left whitespace-nowrap">
            <thead className="bg-slate-700 text-white">
              <tr>
                {section.summaryHeaders.map((h, i) => (
                  <th key={i} className={`px-4 py-2 font-semibold ${isAmountColumn(h, i, section.summaryRows) ? "text-right" : "text-left"}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.summaryRows.map((r, ri) => (
                <tr key={ri} className="bg-white">
                  {r.map((c, ci) => (
                    <td key={ci} className={`px-4 py-2 border-t border-slate-100 text-slate-800 ${isAmountColumn(section.summaryHeaders[ci], ci, section.summaryRows) ? "text-right font-mono font-medium" : "text-left"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-1">{section.rows.length} employee row(s)</p>
    </div>
  );

  // --- REPORT CARDS LIST ---
  const reportCards = [
    { id: 18, title: "Summary for Net Pay", desc: spmReportsEnabled ? "Employee net pay split — Basic Salary & Monthly Bonus." : "Employee net pay split — Basic Salary & Allowance.", icon: <FileBarChart className="w-6 h-6 text-blue-800" />, func: generateNetPaySummaryListData, file: "Summary_Net_Pay" },
    { id: 19, title: "Summary for Net Pay (Breakdown)", desc: spmReportsEnabled ? "Earnings & deductions by Basic / Monthly Bonus / Total." : "Earnings & deductions by Basic / Allowance / Total.", icon: <FileBarChart className="w-6 h-6 text-indigo-800" />, func: generateNetPaySummaryBreakdownData, file: "Summary_Net_Pay_Breakdown" },
    { id: 20, title: "Bank Salary Payment Letter", desc: "Formal bank letter with staff salary transfer list.", icon: <Building2 className="w-6 h-6 text-green-700" />, func: generateBankSalaryLetterData, file: "Bank_Salary_Letter" },
    { id: 21, title: "Overtime Schedule", desc: "OT hours, rates (a/240×1.5 / ×2) and allowances.", icon: <Clock className="w-6 h-6 text-sky-700" />, func: generateOvertimeScheduleData, file: "Overtime_Schedule" },
    { id: 22, title: spmReportsEnabled ? "Cash Summary — Monthly Bonus" : "Cash Summary — Net Allowance", desc: spmReportsEnabled ? "Coinage breakdown per employee for monthly bonus payout." : "Coinage breakdown per employee for allowance payout.", icon: <Banknote className="w-6 h-6 text-emerald-700" />, func: generateCashAllowanceSummaryData, file: spmReportsEnabled ? "Cash_Summary_Monthly_Bonus" : "Cash_Summary_Net_Allowance" },
    { id: 23, title: spmReportsEnabled ? "Coinage — Monthly Bonus" : "Coinage — Staff Allowance", desc: spmReportsEnabled ? "Total notes & coins required for monthly bonus payments." : "Total notes & coins required for allowance payments.", icon: <Banknote className="w-6 h-6 text-emerald-600" />, func: generateCoinageStaffAllowanceData, file: spmReportsEnabled ? "Coinage_Monthly_Bonus" : "Coinage_Staff_Allowance" },
    ...(spmReportsEnabled ? [
      { id: 24, title: "Schedule 07(a): Staff Fund Details", desc: "Monthly employee & employer fund contributions (FY).", icon: <Wallet className="w-6 h-6 text-amber-800" />, func: generateSchedule07aStaffFundDetailData, file: "Schedule_07a_Staff_Fund" },
    ] : []),
    { id: 16, title: "Schedule 04: Loan Summary", desc: "All staff loans — principal & interest with totals.", icon: <CreditCard className="w-6 h-6 text-orange-700" />, func: generateSchedule04LoanSummaryData, file: "Schedule_04_Loan_Summary" },
    { id: 17, title: "Schedule 04(a): Staff Loan Detail", desc: "Per-loan monthly deduction history.", icon: <CreditCard className="w-6 h-6 text-orange-600" />, func: generateSchedule04aLoanDetailData, file: "Schedule_04a_Loan_Detail" },
    ...(spmReportsEnabled ? [
      { id: 25, title: "Schedule 01: Basic Salary", desc: "Listing of employee basic salary.", icon: <FileText className="w-6 h-6 text-blue-700" />, func: generateSchedule01BasicSalaryData, file: "Schedule_01_Basic_Salary" },
      { id: 26, title: "Schedule 05: Sports Fund", desc: "Listing of employee sports fund (0.5%) contributions.", icon: <Wallet className="w-6 h-6 text-teal-700" />, func: generateSchedule05SportsFundData, file: "Schedule_05_Sports_Fund" },
      { id: 28, title: "Leave Summary", desc: "Employee leave entitlement, obtained leaves and available balance.", icon: <FileText className="w-6 h-6 text-emerald-700" />, func: generateLeaveSummaryData, file: "Leave_Summary" },
      { id: 29, title: "OT Coinage Report", desc: "Overtime coinage breakdown (Notes & Coins) matching Excel format.", icon: <Coins className="w-6 h-6 text-sky-700" />, func: generateOTCoinageData, file: "OT_Coinage_Report" },
      { id: 30, title: "OT Coinage (Edit)", desc: "Interactive note & coin breakdown editor for overtime payouts.", icon: <Coins className="w-6 h-6 text-indigo-700" />, isCoinage: true, isOt: true },
    ] : []),
    { id: 14, title: "Schedule 02: Nopay", desc: "Basic, Salary & Allowance nopay sections with summary.", icon: <FileCheck className="w-6 h-6 text-red-700" />, func: generateSchedule02NoPayData, file: "Schedule_02_Nopay" },
    { id: 15, title: "Schedule 07: Staff Fund", desc: "Staff fund contributions & cumulative balance.", icon: <Wallet className="w-6 h-6 text-amber-700" />, func: generateSchedule07StaffFundData, file: "Schedule_07_Staff_Fund" },
    { id: 11, title: spmReportsEnabled ? "Salary & Monthly Bonus (Total)" : "Salary & Allowance (Total)", desc: spmReportsEnabled ? "Combined salary + monthly bonus view with Schedules 02–08." : "Combined salary + allowance view with Schedules 02–08.", icon: <FileBarChart className="w-6 h-6 text-blue-700" />, func: generateSalaryAllowanceTotalData, file: spmReportsEnabled ? "Salary_Monthly_Bonus_Total" : "Salary_Allowance_Total" },
    { id: 12, title: spmReportsEnabled ? "Salary Details" : "Salary Details (EPF/ETF)", desc: spmReportsEnabled ? "Sch 01 earnings, Salary for EPF, Sch 03/04/06 deductions." : "Sch 01 earnings, Salary for EPF, Sch 03/04/06 deductions.", icon: <FileText className="w-6 h-6 text-indigo-700" />, func: generateSalaryDetailsData, file: spmReportsEnabled ? "Salary_Details" : "Salary_Details_EPF_ETF" },
    { id: 13, title: spmReportsEnabled ? "Monthly Bonus" : "Allowance Report", desc: spmReportsEnabled ? "Monthly bonus earnings with related deductions (Sch 02–08)." : "Allowance earnings with related deductions (Sch 02–08).", icon: <Wallet className="w-6 h-6 text-violet-700" />, func: generateAllowanceScheduleData, file: spmReportsEnabled ? "Monthly_Bonus" : "Allowance_Report" },
    { id: 1, title: "Full Master Payroll", desc: "Complete summary with all additions & deductions.", icon: <FileBarChart className="w-6 h-6 text-indigo-600" />, func: generateMasterData, file: "Full_Master_Payroll" },
    { id: 2, title: "Bank Transfer File", desc: "Exact Bank Net Amount sent to accounts.", icon: <Building2 className="w-6 h-6 text-green-600" />, func: generateBankData, file: "Bank_Transfer" },
    { id: 3, title: spmReportsEnabled ? `Schedule 06 — EPF & ETF — ${monthLabel} ${selectedYear}` : "Schedule 06: EPF & ETF", desc: "Member No, Salary for EPF, 12%/8%/3% — printed format.", icon: <FileText className="w-6 h-6 text-blue-600" />, func: generateEPFSchedule06Data, file: "EPF_ETF_Sch06" },
    { id: 4, title: "Overtime Summary", desc: "Morning, Night, and Holiday OT breakdown.", icon: <Clock className="w-6 h-6 text-sky-600" />, func: generateOTData, file: "Overtime_Summary" },
    { id: 5, title: "Dynamic Allowances", desc: "Breakdown of all allowances only.", icon: <Wallet className="w-6 h-6 text-purple-600" />, func: generateAllowancesOnlyData, file: "Allowances_Report" },
    { id: 6, title: spmReportsEnabled ? "Schedule 01(a): Monthly Bonus" : "Dynamic Bonuses", desc: spmReportsEnabled ? "Listing of employee monthly bonuses." : "Breakdown of bonuses only.", icon: <Gift className="w-6 h-6 text-teal-600" />, func: generateBonusesOnlyData, file: spmReportsEnabled ? "Schedule_01a_Monthly_Bonus" : "Bonuses_Report" },
    { id: 7, title: spmReportsEnabled ? "Schedule 3: Salary Advance" : "Custom Deductions", desc: spmReportsEnabled ? "Salary advance deductions and other staff advances." : "Dynamic breakdown of custom deductions.", icon: <Scissors className="w-6 h-6 text-pink-600" />, func: generateDynamicDeductionsData, file: spmReportsEnabled ? "Schedule_3_Salary_Advance" : "Custom_Deductions" },
    { id: 8, title: "Staff Loans", desc: "Loan installments, interest and balance.", icon: <CreditCard className="w-6 h-6 text-orange-600" />, func: generateLoanData, file: "Staff_Loans" },
    { id: 9, title: "No Pay Details", desc: "Deductions based on absent days.", icon: <FileCheck className="w-6 h-6 text-red-600" />, func: generateNoPayData, file: "NoPay_Details" },
    { id: 10, title: "Cash Coinage (Edit)", desc: "Interactive note breakdown for allowance payouts.", icon: <Banknote className="w-6 h-6 text-emerald-600" />, isCoinage: true }
  ];

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 bg-gray-50/50">
      <div className="max-w-7xl mx-auto relative">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="text-blue-600"/> Payroll Documents & Schedules</h1>
            <p className="text-gray-500 text-sm mt-1">Load data first, preview reports, then download Excel or PDF.</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Company</label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-48 sm:w-56 px-3 py-2 border rounded-lg bg-gray-50 outline-none text-sm text-gray-700"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_code ? `${c.company_code} - ${c.name}` : c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Month</label>
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-32 px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                {months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Year</label>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className="w-24 px-3 py-2 border rounded-lg bg-gray-50 outline-none">
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleFetchData}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium shadow-sm transition-all"
            >
              {isLoading ? <Loader2 className="animate-spin w-4 h-4"/> : "Load Data"}
            </button>
          </div>
        </div>

        {reportData.length > 0 && (
          <div className="mb-6 bg-white rounded-2xl border border-blue-100 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-800">
                {spmReportsEnabled ? "Combined Salary & Monthly Bonus Schedules (Schedules 02–08)" : "Combined Salary & Allowance Schedules"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {spmReportsEnabled
                  ? "View or export Salary & Monthly Bonus (Total), Salary Details, and Monthly Bonus together."
                  : "View or export Salary & Allowance (Total), Salary Details (EPF/ETF), and Allowance together."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={openCombinedPreview}
                className="px-4 py-2 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 flex items-center gap-1.5 transition-all"
              >
                <Eye className="w-3.5 h-3.5" /> Preview All 3
              </button>
              <button
                onClick={downloadCombinedPDF}
                className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-sm flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Download Combined PDF
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {reportCards.map((card) => (
            <div key={card.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-gray-50 rounded-xl">{card.icon}</div>
                  <h3 className="font-bold text-gray-800 text-sm leading-snug">{card.title}</h3>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mb-4">{card.desc}</p>
              </div>
              <div className="flex flex-col gap-2">
                {card.isCoinage ? (
                  <div className="flex gap-2">
                    <button onClick={() => openCoinageModal('csv', card.isOt ? 'ot' : 'cash')} className="flex-1 py-2 text-xs font-semibold bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200">
                      Excel
                    </button>
                    <button onClick={() => openCoinageModal('pdf', card.isOt ? 'ot' : 'cash')} className="flex-1 py-2 text-xs font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200">
                      PDF
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => openReportPreview(card)}
                      className="w-full py-2 text-xs font-semibold bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview Report
                    </button>
                    <div className="flex gap-2">
                      <button onClick={() => downloadCSV(card.func, card.file)} className="flex-1 py-2 text-xs font-semibold bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200">
                        Excel
                      </button>
                      <button onClick={() => downloadPDF(card.func, card.title, card.file)} className="flex-1 py-2 text-xs font-semibold bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200">
                        PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {showPreviewModal && previewReport && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[95vw] max-h-[92vh] flex flex-col">
              <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{previewReport.title}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{monthLabel} {selectedYear} &bull; On-Screen Preview with Totals</p>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-auto flex-1">
                {previewReport.sections.map((section) => renderPreviewTable(section))}
              </div>

              <div className="p-4 border-t flex flex-wrap justify-end gap-3 bg-gray-50 rounded-b-2xl shrink-0">
                {previewReport.func && (
                  <>
                    <button
                      onClick={() => downloadCSV(previewReport.func, previewReport.file)}
                      className="px-4 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Download Excel
                    </button>
                    <button
                      onClick={() => downloadPDF(previewReport.func, previewReport.title, previewReport.file)}
                      className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Download PDF
                    </button>
                  </>
                )}
                {!previewReport.func && (
                  <button
                    onClick={downloadCombinedPDF}
                    className="px-4 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" /> Download Combined PDF
                  </button>
                )}
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showCoinageModal && (
          <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
              <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-2xl">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    {coinageType === "ot" ? "OT Coinage Note Allocation" : "Cash Coinage Note Allocation"}
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    {coinageType === "ot"
                      ? "Adjust individual note and coin counts for overtime payout. Totals will update live."
                      : "Adjust individual note counts if needed. Totals will update live."}
                  </p>
                </div>
                <button onClick={() => setShowCoinageModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 overflow-auto flex-1">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-gray-100 text-gray-700 sticky top-0 border-b">
                    <tr>
                      <th className="p-2 border">Emp No</th>
                      <th className="p-2 border">EPF No</th>
                      <th className="p-2 border">Name</th>
                      <th className="p-2 border text-right">
                        {coinageType === "ot" ? "Total OT (Rs.)" : "Cash Amount"}
                      </th>
                      {NOTES_ARRAY.map(note => (
                        <th key={note} className="p-2 border text-center">
                          {note >= 100 ? `Rs. ${note}` : `Coin ${note}`}
                        </th>
                      ))}
                      <th className="p-2 border text-right">Sum Checks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {editableCoinage.map((emp, empIdx) => {
                      let rowSum = 0;
                      NOTES_ARRAY.forEach(note => { rowSum += note * (emp.notes[note] || 0); });
                      const isMatch = Math.abs(rowSum - emp.amount) < 0.01;
                      return (
                        <tr key={emp.emp_no} className="border-b hover:bg-gray-50">
                          <td className="p-2 border font-medium">{emp.emp_no}</td>
                          <td className="p-2 border font-medium">{emp.epf_no || "-"}</td>
                          <td className="p-2 border">{emp.name}</td>
                          <td className="p-2 border text-right font-semibold">{fmt(emp.amount)}</td>
                          {NOTES_ARRAY.map(note => (
                            <td key={note} className="p-1 border text-center">
                              <input
                                type="number"
                                min="0"
                                value={emp.notes[note] ?? 0}
                                onChange={(e) => handleNoteChange(empIdx, note, e.target.value)}
                                className="w-12 p-1 border rounded text-center text-xs outline-none focus:border-blue-500"
                              />
                            </td>
                          ))}
                          <td className={`p-2 border text-right font-semibold ${isMatch ? 'text-green-600' : 'text-red-500 font-bold'}`}>
                            {fmt(rowSum)} {isMatch ? '✓' : '⚠️'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 border-t flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
                <button
                  onClick={() => setShowCoinageModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={processAndDownloadCoinage}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-md"
                >
                  Save & Download {coinageFormat.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
