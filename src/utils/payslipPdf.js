import { jsPDF } from "jspdf";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const num = (v) => Number(v || 0).toFixed(2);

function monthLabel(record) {
  const m = Number(record.salaryMonth || record.month || 1);
  return MONTHS[m - 1] || String(record.month || "");
}

export function normalizePayslipRecord(record = {}) {
  const sbRaw = record.breakdown || record.salary_breakdown || {};
  const sb = typeof sbRaw === "string" ? JSON.parse(sbRaw || "{}") : sbRaw || {};
  const isJaysea = !!(sb.is_jaysea_process || record.is_jaysea_process);
  return {
    isJaysea,
    employeeNo: record.employeeNo || record.employee_no || record.emp_no || "",
    fullName: record.fullName || record.full_name || "",
    companyName: record.companyName || record.company_name || "",
    departmentName: record.departmentName || record.department_name || "",
    designation: record.designation || record.designation_name || "",
    epfNo: record.epf_no || record.epfNo || record.employeeNo || "",
    monthName: monthLabel(record),
    year: record.salaryYear || record.year,
    enableEpfEtf: !!(record.enableEpfEtf ?? record.enable_epf_etf),
    allowances: Array.isArray(record.allowances) ? record.allowances : [],
    deductions: Array.isArray(record.deductions) ? record.deductions : [],
    basicSalary: sb.basic_salary || record.basicSalary || record.basic_salary,
    increment: sb.increment_amount || record.increment_value || 0,
    holidayPay: sb.holiday_amount || 0,
    offDayPay: sb.off_day_amount || 0,
    brAllowance: sb.br_allowance,
    otMorning: sb.ot_morning_fees || sb.ot_morning || record.ot_morning,
    otNight: sb.ot_night_fees || sb.ot_evening || record.ot_evening,
    otherAllowances: sb.total_allowances,
    gross: sb.gross_salary || record.grossPay || record.gross_salary,
    totalEarnings: sb.total_earnings || (Number(sb.gross_salary || 0) + Number(sb.total_allowances || 0)),
    epf: sb.epf_employee_deduction,
    paye: sb.paye_deduction || sb.paye_amount || 0,
    nopay: sb.no_pay_deduction || sb.full_day_nopay_deduction,
    advance: sb.advance_salary || record.advance_salary || 0,
    loan: sb.loan_installment || sb.loan_principal,
    stamp: sb.stamp_duty || sb.stamp || record.stamp,
    otherDed: sb.total_fixed_deductions,
    totalDed: sb.total_deductions || record.totalDeductions || record.total_deductions,
    net: sb.net_salary || sb.net_pay || record.netPay || record.net_salary,
    fishDeduction: sb.fish_deduction || record.fish_deduction || 0,
    epfEr: sb.epf_employer_contribution,
    etfEr: sb.etf_employer_contribution,
  };
}

function layout(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 7;
  const gutter = 5;
  const w = (pageW - margin * 2 - gutter) / 2;
  return {
    pageW,
    pageH,
    margin,
    gutter,
    w,
    h: pageH - margin * 2,
    leftX: margin,
    rightX: margin + w + gutter,
    midX: pageW / 2,
  };
}

function drawEmptyHalf(doc, side) {
  const L = layout(doc);
  const x = side === "right" ? L.rightX : L.leftX;
  doc.setFillColor(248, 250, 252);
  doc.rect(x, L.margin, L.w, L.h, "F");
  doc.setDrawColor(200, 210, 216);
  doc.setLineWidth(0.3);
  doc.rect(x, L.margin, L.w, L.h);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(170);
  doc.text("Blank half — fold / cut here", x + L.w / 2, L.pageH / 2, { align: "center" });
}

function drawFoldLine(doc) {
  const L = layout(doc);
  doc.setDrawColor(150);
  doc.setLineWidth(0.25);
  const dash = 2;
  for (let y = L.margin; y < L.pageH - L.margin; y += dash * 2) {
    doc.line(L.midX, y, L.midX, Math.min(y + dash, L.pageH - L.margin));
  }
  doc.setDrawColor(0);
}

function lineRow(doc, x, y, w, label, value, { bold = false, fill = null, color = [20, 20, 20] } = {}) {
  const h = 5.8;
  if (fill) {
    doc.setFillColor(...fill);
    doc.rect(x, y - 4.1, w, h, "F");
  }
  doc.setDrawColor(225);
  doc.rect(x, y - 4.1, w, h);
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(7);
  doc.setTextColor(...color);
  doc.text(String(label), x + 1.8, y);
  doc.text(String(value), x + w - 1.8, y, { align: "right" });
  return y + h;
}

function drawJayseaPayslipHalf(doc, r, side) {
  const L = layout(doc);
  const x = side === "right" ? L.rightX : L.leftX;
  const y0 = L.margin;
  const w = L.w;

  doc.setFillColor(255, 255, 255);
  doc.rect(x, y0, w, L.h, "F");
  doc.setDrawColor(11, 79, 92);
  doc.setLineWidth(0.6);
  doc.rect(x, y0, w, L.h);

  // Top header banner
  doc.setFillColor(11, 79, 92);
  doc.rect(x, y0, w, 15, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(String(r.companyName || "JAYSEA FOOD PROCESSING (PVT) LTD").toUpperCase(), x + w / 2, y0 + 6, { align: "center", maxWidth: w - 4 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(`PAYSLIP FOR THE MONTH OF: ${String(r.monthName).toUpperCase()} ${r.year}`, x + w / 2, y0 + 11.5, { align: "center" });

  let y = y0 + 19;
  const pad = 3;
  const inner = w - pad * 2;
  const left = x + pad;

  // Employee details row
  doc.setFillColor(241, 245, 249);
  doc.rect(left, y - 3, inner, 12, "F");
  doc.setDrawColor(203, 213, 225);
  doc.rect(left, y - 3, inner, 12);
  
  doc.setFontSize(7);
  doc.setTextColor(50);
  doc.setFont("helvetica", "bold");
  doc.text(`Emp No:`, left + 2, y + 1);
  doc.setFont("helvetica", "normal");
  doc.text(String(r.employeeNo || "-"), left + 15, y + 1);

  doc.setFont("helvetica", "bold");
  doc.text(`Name:`, left + 36, y + 1);
  doc.setFont("helvetica", "normal");
  doc.text(String(r.fullName || "-"), left + 46, y + 1, { maxWidth: inner - 48 });

  doc.setFont("helvetica", "bold");
  doc.text(`Dept:`, left + 2, y + 6);
  doc.setFont("helvetica", "normal");
  doc.text(String(r.departmentName || "-"), left + 15, y + 6);

  if (r.designation) {
    doc.setFont("helvetica", "bold");
    doc.text(`Desig:`, left + 46, y + 6);
    doc.setFont("helvetica", "normal");
    doc.text(String(r.designation || "-"), left + 56, y + 6);
  }

  y += 13;

  // Section 1: Earnings & Total for EPF
  const secH = 5;
  doc.setFillColor(15, 118, 110);
  doc.rect(left, y - 3.8, inner, secH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("1. EARNINGS & TOTAL FOR EPF", left + 2, y - 0.5);
  y += secH - 0.5;

  const earnRows = [
    ["Basic Salary", num(r.basicSalary)],
  ];
  if (Number(r.increment) > 0) earnRows.push(["Increment", num(r.increment)]);
  if (Number(r.holidayPay) > 0) earnRows.push(["Holiday Pay", num(r.holidayPay)]);
  if (Number(r.offDayPay) > 0) earnRows.push(["Off-Day Pay", num(r.offDayPay)]);
  if (Number(r.nopay) > 0) earnRows.push(["Less: No Pay", `- ${num(r.nopay)}`, { color: [185, 28, 28] }]);
  earnRows.push(["Total For EPF (Gross Salary)", num(r.gross), { bold: true, fill: [204, 251, 241], color: [15, 118, 110] }]);

  (r.allowances || []).forEach((a) => {
    if (a?.name) earnRows.push([a.name, num(a.amount)]);
  });
  if (Number(r.otherAllowances) && !(r.allowances || []).length) {
    earnRows.push(["Other Allowances", num(r.otherAllowances)]);
  }
  earnRows.push(["TOTAL EARNINGS", num(r.totalEarnings || r.gross), { bold: true, fill: [236, 253, 245], color: [6, 95, 70] }]);

  earnRows.forEach((item) => {
    y = lineRow(doc, left, y, inner, item[0], item[1], item[2] || {});
  });

  y += 2.5;

  // Section 2: Deductions & Net Salary
  doc.setFillColor(185, 28, 28);
  doc.rect(left, y - 3.8, inner, secH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("2. DEDUCTIONS & NET PAY", left + 2, y - 0.5);
  y += secH - 0.5;

  const dedRows = [
    ["EPF Employee (8%)", `- ${num(r.epf)}`],
  ];
  if (Number(r.paye) > 0) dedRows.push(["PAYE / APIT", `- ${num(r.paye)}`]);
  if (Number(r.stamp) > 0) dedRows.push(["Stamp Duty", `- ${num(r.stamp)}`]);
  if (Number(r.advance) > 0) dedRows.push(["Salary Advance", `- ${num(r.advance)}`]);
  if (Number(r.loan) > 0) dedRows.push(["Loan Installment", `- ${num(r.loan)}`]);

  const fishAmt =
    Number(r.fishDeduction || 0) ||
    Number((r.deductions || []).find((d) => String(d?.name || "").toUpperCase() === "FISH")?.amount || 0);
  if (fishAmt > 0) {
    dedRows.push(["FISH Deduction", `- ${num(fishAmt)}`]);
  }

  (r.deductions || [])
    .filter((d) => {
      const uname = String(d?.name || "").trim().toUpperCase();
      return uname !== "FISH" && uname !== "PAYE" && uname !== "APIT" && uname !== "PAYE / APIT" && uname !== "STAMP" && uname !== "STAMP DUTY";
    })
    .forEach((d) => {
      if (d?.name) dedRows.push([d.name, `- ${num(d.amount)}`]);
    });
  if (Number(r.otherDed) && !(r.deductions || []).length && !fishAmt) {
    dedRows.push(["Other Deductions", `- ${num(r.otherDed)}`]);
  }

  dedRows.push(["TOTAL DEDUCTIONS", `- ${num(r.totalDed)}`, { bold: true, fill: [254, 226, 226], color: [185, 28, 28] }]);
  dedRows.push(["NET SALARY", num(r.net), { bold: true, fill: [209, 250, 229], color: [6, 95, 70] }]);

  dedRows.forEach((item) => {
    y = lineRow(doc, left, y, inner, item[0], item[1], item[2] || {});
  });

  y += 2.5;

  // Section 3: Employer Contribution
  doc.setFillColor(71, 85, 105);
  doc.rect(left, y - 3.8, inner, secH, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("3. EMPLOYER CONTRIBUTIONS", left + 2, y - 0.5);
  y += secH - 0.5;

  const erTotal = Number(r.epfEr || 0) + Number(r.etfEr || 0);
  const erRows = [
    ["EPF Employer (12%)", num(r.epfEr)],
    ["ETF Employer (3%)", num(r.etfEr)],
    ["TOTAL EMPLOYER CONTRIBUTION", num(erTotal), { bold: true, fill: [241, 245, 249], color: [51, 65, 85] }],
  ];

  erRows.forEach((item) => {
    y = lineRow(doc, left, y, inner, item[0], item[1], item[2] || {});
  });

  // Footer signature boxes
  y += 5.5;
  doc.setFontSize(6.5);
  doc.setTextColor(100);
  doc.text("Prepared By: ..........................", left + 2, y);
  doc.text("Employee Signature: ..........................", left + inner - 46, y);

  doc.setFontSize(5.5);
  doc.setTextColor(150);
  doc.text("Generated by Cybernetic HR Management System", left + inner / 2, y0 + L.h - 3, { align: "center" });
}

function drawPayslipHalf(doc, record, side) {
  const r = normalizePayslipRecord(record);
  if (r.isJaysea) {
    drawJayseaPayslipHalf(doc, r, side);
    return;
  }
  const L = layout(doc);
  const x = side === "right" ? L.rightX : L.leftX;
  const y0 = L.margin;
  const w = L.w;

  doc.setFillColor(255, 255, 255);
  doc.rect(x, y0, w, L.h, "F");
  doc.setDrawColor(11, 79, 92);
  doc.setLineWidth(0.5);
  doc.rect(x, y0, w, L.h);

  doc.setFillColor(11, 79, 92);
  doc.rect(x, y0, w, 14, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("SALARY SLIP", x + w / 2, y0 + 6.2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`${r.monthName} ${r.year}`, x + w / 2, y0 + 11.2, { align: "center" });

  let y = y0 + 19;
  const pad = 3;
  const inner = w - pad * 2;
  const left = x + pad;
  doc.setTextColor(30);
  doc.setFontSize(7.4);
  doc.setFont("helvetica", "bold");
  doc.text(String(r.fullName || "Employee"), left, y, { maxWidth: inner });
  y += 4.2;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(70);
  [`No: ${r.employeeNo}`, r.companyName, r.departmentName].filter(Boolean).forEach((t) => {
    doc.text(String(t), left, y, { maxWidth: inner });
    y += 3.8;
  });
  y += 2;

  const rows = [
    ["Basic Salary", num(r.basicSalary)],
    ["BR Allowance", num(r.brAllowance)],
    ["OT Morning", num(r.otMorning)],
    ["OT Night", num(r.otNight)],
  ];
  if (Number(r.holidayPay) > 0) rows.push(["Holiday Pay", num(r.holidayPay)]);
  if (Number(r.offDayPay) > 0) rows.push(["Off-Day Pay", num(r.offDayPay)]);
  (r.allowances || []).forEach((a) => {
    if (a?.name) rows.push([a.name, num(a.amount)]);
  });
  if (Number(r.otherAllowances) && !r.allowances.length) {
    rows.push(["Other Allowances", num(r.otherAllowances)]);
  }
  rows.push(["Gross Salary", num(r.gross), { bold: true, fill: [226, 250, 241] }]);
  rows.push(["EPF (8%)", `- ${num(r.epf)}`]);
  if (Number(r.paye) > 0) {
    rows.push(["PAYE / APIT", `- ${num(r.paye)}`]);
  }
  rows.push(["No Pay", `- ${num(r.nopay)}`]);
  rows.push(["Loan", `- ${num(r.loan)}`]);
  if (Number(r.stamp) > 0) {
    rows.push(["Stamp Duty", `- ${num(r.stamp)}`]);
  }
  const fishAmt =
    Number(r.fishDeduction || 0) ||
    Number((r.deductions || []).find((d) => String(d?.name || "").toUpperCase() === "FISH")?.amount || 0);
  if (fishAmt > 0) {
    rows.push(["FISH", `- ${num(fishAmt)}`]);
  }
  (r.deductions || [])
    .filter((d) => {
      const uname = String(d?.name || "").trim().toUpperCase();
      return uname !== "FISH" && uname !== "PAYE" && uname !== "APIT" && uname !== "PAYE / APIT" && uname !== "STAMP" && uname !== "STAMP DUTY";
    })
    .forEach((d) => {
      if (d?.name) rows.push([d.name, `- ${num(d.amount)}`]);
    });
  if (Number(r.otherDed) && !r.deductions.length && !fishAmt) {
    rows.push(["Other Deductions", `- ${num(r.otherDed)}`]);
  }
  rows.push(["Total Deductions", `- ${num(r.totalDed)}`, { bold: true, fill: [254, 226, 226] }]);
  rows.push(["NET SALARY", num(r.net), { bold: true, fill: [209, 250, 229], color: [6, 95, 70] }]);

  rows.forEach((item) => {
    const opts = item[2] || {};
    y = lineRow(doc, left, y, inner, item[0], item[1], opts);
  });

  y += 4;
  doc.setFontSize(6.5);
  doc.setTextColor(80);
  if (r.enableEpfEtf) {
    doc.text(`EPF employer 12%: ${num(r.epfEr)}`, left, y);
    y += 3.4;
    doc.text(`ETF employer 3%: ${num(r.etfEr)}`, left, y);
  }
  doc.setFontSize(6);
  doc.setTextColor(140);
  doc.text("Half A4 portrait (left/right)", left, y0 + L.h - 3.5);
}

export function downloadPayslip(record) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  drawEmptyHalf(doc, "right");
  drawPayslipHalf(doc, record, "left");
  drawFoldLine(doc);
  const r = normalizePayslipRecord(record);
  doc.save(`payslip_${r.employeeNo || "employee"}_${r.monthName}_${r.year}.pdf`);
}

export function downloadPayslips(records = []) {
  const list = (records || []).filter(Boolean);
  if (!list.length) {
    return;
  }
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  list.forEach((record, index) => {
    if (index > 0 && index % 2 === 0) {
      doc.addPage("a4", "portrait");
    }
    const side = index % 2 === 0 ? "left" : "right";
    if (side === "left") {
      drawEmptyHalf(doc, "right");
    }
    drawPayslipHalf(doc, record, side);
    if (side === "left") {
      drawFoldLine(doc);
    }
  });
  const first = normalizePayslipRecord(list[0]);
  doc.save(`payslips_${first.monthName || "all"}_${first.year || ""}.pdf`);
}
