import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Calendar,
  Building2,
  CreditCard,
  AlertCircle,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useEmployeeForm } from "@contexts/EmployeeFormContext";
import { useAuth } from "@contexts/AuthContext";
import FieldError from "@components/ErrorMessage/FieldError";
import { banks } from "@utils/banks";
import { calculateCompensationSummary } from "@utils/compensationCalculations";
import { fetchCompanies } from "@services/ApiDataService";

// Utility: safely parse a numeric string to Number, treating empty/invalid as 0.
const toNumber = (val) => {
  if (val === null || val === undefined || val === "") return 0;
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};

// Utility: format money for display without changing the underlying value.
const formatMoney = (val) =>
  toNumber(val).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const handleKeyDown = (e) => {
  // Allow: backspace, delete, tab, escape, enter, arrows
  // Allow: digits (0-9), decimal point (.)
  if (
    // Navigation keys
    [46, 8, 9, 27, 13, 110, 190].includes(e.keyCode) ||
    // Arrow keys
    (e.keyCode >= 35 && e.keyCode <= 40) ||
    // Numbers and decimal on main keyboard
    (e.keyCode >= 48 && e.keyCode <= 57) ||
    // Numbers on numpad
    (e.keyCode >= 96 && e.keyCode <= 105) ||
    // Decimal on numpad
    e.keyCode === 110 ||
    e.keyCode === 190
  ) {
    // Allow only one decimal point
    if (
      (e.keyCode === 110 || e.keyCode === 190) &&
      e.target.value.includes(".")
    ) {
      e.preventDefault();
    }
    return;
  }
  // Prevent all other keys
  e.preventDefault();
};

const CompensationManagement = ({ onNext, onPrevious, selectedCompany, companies: propCompanies }) => {
  const { user } = useAuth();
  const { formData, updateFormData, errors, clearFieldError } =
    useEmployeeForm();

  const [internalCompanies, setInternalCompanies] = useState([]);

  useEffect(() => {
    if (!selectedCompany && (!propCompanies || !propCompanies.length)) {
      fetchCompanies()
        .then((rows) => setInternalCompanies(Array.isArray(rows) ? rows : []))
        .catch(() => setInternalCompanies([]));
    }
  }, [selectedCompany, propCompanies]);

  const activeCompany = useMemo(() => {
    if (selectedCompany) return selectedCompany;
    const list = (propCompanies?.length ? propCompanies : internalCompanies) || [];
    if (!list.length) return null;
    const compId = formData.organization?.company;
    if (compId) {
      const match = list.find((c) => String(c.id) === String(compId));
      if (match) return match;
    }
    if (user?.company_id) {
      const match = list.find((c) => Number(c.id) === Number(user.company_id));
      if (match) return match;
    }
    return list.find((c) => c.portal_active) || list[0] || null;
  }, [selectedCompany, propCompanies, internalCompanies, formData.organization?.company, user?.company_id]);

  const isStampPayeHolidayOn = useMemo(() => {
    if (!activeCompany) return false;
    let cfg = activeCompany.process_config;
    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    }
    const val = cfg?.stamp_duty_paye_holiday;
    return !!(val?.enabled ?? val === true);
  }, [activeCompany]);

  const [openSections, setOpenSections] = useState({
    salary: true,
    increment: false,
    employment: false,
    overtime: false,
    bank: false,
    relief: false,
    primary: false,
    comments: false,
  });

  const toggleSection = (section) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (field, value) => {
    // Clear error when user makes changes
    if (errors.compensation?.[field]) {
      clearFieldError("compensation", field);
    }
    updateFormData("compensation", { [field]: value });
  };

  const handleToggleChange = (field) => {
    updateFormData("compensation", { [field]: !formData.compensation[field] });
  };

  const isHighSalary = Number(formData.compensation?.basicSalary || 0) > 40000; // add this

  // Auto-calculated overview values:
  //   Total Salary             = Basic Salary + Monthly Bonus
  //   Sports Fund Amount       = Total Salary × (Sports Fund % / 100)
  //   Remaining Total Salary   = Total Salary − Sports Fund − Staff Fund
  const basicSalaryNum = toNumber(formData.compensation?.basicSalary);
  const monthlyBonusNum = toNumber(formData.compensation?.monthlyBonus);
  const sportsFundPctNum = toNumber(formData.compensation?.sportsFundPercentage);
  const staffFundAmountNum = toNumber(formData.compensation?.staffFundAmount);

  const { totalSalary, sportsFundAmount, remainingTotalSalary } = useMemo(
    () => calculateCompensationSummary({
      basicSalary: basicSalaryNum,
      monthlyBonus: monthlyBonusNum,
      sportsFundPercentage: sportsFundPctNum,
      staffFundAmount: staffFundAmountNum,
    }),
    [basicSalaryNum, monthlyBonusNum, sportsFundPctNum, staffFundAmountNum]
  );

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Header */}
      <div className="p-8">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center">
            <DollarSign className="w-6 h-6 mr-2 text-green-600" />
            Compensation Management
          </h2>
        </div>
        <form>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Salary Information */}
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('salary')}
                  className="w-full flex items-center justify-between p-6 hover:bg-green-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                    Salary Information
                  </h2>
                  {openSections.salary ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.salary && (
                  <div className="p-6 pt-0">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Basic Salary / Daily Salary <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.compensation.basicSalary}
                          onChange={(e) =>
                            handleInputChange("basicSalary", e.target.value)
                          }
                          onKeyDown={handleKeyDown}
                          className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.basicSalary
                            ? "border-red-500"
                            : "border-gray-300"
                            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                          placeholder="Enter basic salary"
                          required
                        />
                      </div>
                      <FieldError error={errors.compensation?.basicSalary} />
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Monthly Bonus (part of total salary)</label>
                      <input
                        type="text"
                        value={formData.compensation.monthlyBonus || ""}
                        onChange={(e) => handleInputChange("monthlyBonus", e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                        placeholder="Employee-wise monthly bonus amount"
                      />
                    </div>

                    {/* Auto-calculated Total Salary (read-only overview) */}
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Salary <span className="text-xs text-gray-500 font-normal">(Basic Salary + Monthly Bonus)</span>
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-600" />
                        <input
                          type="text"
                          value={formatMoney(totalSalary)}
                          readOnly
                          tabIndex={-1}
                          className="w-full pl-10 pr-4 py-3 border border-green-200 bg-green-50 text-green-800 font-semibold rounded-lg cursor-not-allowed"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Auto-calculated for overview. Not editable.</p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Sports Fund (%)</label>
                        <input
                          type="text"
                          value={formData.compensation.sportsFundPercentage || ""}
                          onChange={(e) => handleInputChange("sportsFundPercentage", e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg"
                          placeholder="e.g. 2.5"
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter percentage applied on Total Salary (Basic + Bonus).</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sports Fund (Amount) <span className="text-xs text-gray-500 font-normal">(auto-calculated)</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-blue-600" />
                          <input
                            type="text"
                            value={formatMoney(sportsFundAmount)}
                            readOnly
                            tabIndex={-1}
                            className="w-full pl-10 pr-4 py-3 border border-blue-200 bg-blue-50 text-blue-800 font-semibold rounded-lg cursor-not-allowed"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {`= Total Salary × Sports Fund %  (${formatMoney(totalSalary)} × ${sportsFundPctNum || 0}%)`}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Staff Fund (Amount)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          value={formData.compensation.staffFundAmount ?? ""}
                          onChange={(e) => handleInputChange("staffFundAmount", e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg"
                          placeholder="e.g. 500.00"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Fixed monthly staff fund amount deducted from salary.</p>
                    </div>

                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remaining Total Salary <span className="text-xs text-gray-500 font-normal">(after Sports &amp; Staff Fund)</span>
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-600" />
                        <input
                          type="text"
                          value={formatMoney(remainingTotalSalary)}
                          readOnly
                          tabIndex={-1}
                          className="w-full pl-10 pr-4 py-3 border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold rounded-lg cursor-not-allowed"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {`= Total Salary − Sports Fund − Staff Fund  (${formatMoney(totalSalary)} − ${formatMoney(sportsFundAmount)} − ${formatMoney(staffFundAmountNum)})`}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Increment Settings */}
              <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-xl border border-indigo-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('increment')}
                  className="w-full flex items-center justify-between p-6 hover:bg-indigo-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-indigo-600" />
                    Increment Settings
                  </h2>
                  {openSections.increment ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.increment && (
                  <div className="p-6 pt-0">
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border mb-4">
                      <label
                        htmlFor="incrementActive"
                        className="text-sm font-medium text-gray-700"
                      >
                        Increment Active
                      </label>
                      <div
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        style={{
                          backgroundColor: formData.compensation.incrementActive
                            ? "#3b82f6"
                            : "#e5e7eb",
                        }}
                        onClick={() => handleToggleChange("incrementActive")}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.incrementActive
                            ? "translate-x-6"
                            : "translate-x-1"
                            }`}
                        />
                      </div>
                    </div>

                    {formData.compensation.incrementActive && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Increment Value
                          </label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="text"
                              value={formData.compensation.incrementValue}
                              onChange={(e) =>
                                handleInputChange("incrementValue", e.target.value)
                              }
                              onKeyDown={handleKeyDown}
                              className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.incrementValue
                                ? "border-red-500"
                                : "border-gray-300"
                                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                              placeholder="Enter increment"
                            />
                          </div>
                          <FieldError error={errors.compensation?.incrementValue} />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Increment Effective From
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                              type="date"
                              value={formData.compensation.incrementEffectiveFrom}
                              onChange={(e) =>
                                handleInputChange(
                                  "incrementEffectiveFrom",
                                  e.target.value
                                )
                              }
                              className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.incrementEffectiveFrom
                                ? "border-red-500"
                                : "border-gray-300"
                                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            />
                          </div>
                          <FieldError
                            error={errors.compensation?.incrementEffectiveFrom}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Employment Settings */}
              <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-xl border border-purple-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('employment')}
                  className="w-full flex items-center justify-between p-6 hover:bg-purple-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                    <User className="w-5 h-5 mr-2 text-purple-600" />
                    Employment Settings
                  </h2>
                  {openSections.employment ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.employment && (
                  <div className="p-6 pt-0">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="secondaryEmp"
                          className="text-sm font-medium text-gray-700"
                        >
                          Secondary Employment
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.secondaryEmp
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("secondaryEmp")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.secondaryEmp
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      {isStampPayeHolidayOn && (
                        <>
                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <label
                              htmlFor="stamp"
                              className="text-sm font-medium text-gray-700"
                            >
                              Stamp Duty
                            </label>
                            <div
                              id="stamp"
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                              style={{
                                backgroundColor: formData.compensation.stamp
                                  ? "#3b82f6"
                                  : "#e5e7eb",
                              }}
                              onClick={() => handleToggleChange("stamp")}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.stamp
                                  ? "translate-x-6"
                                  : "translate-x-1"
                                  }`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <label
                              htmlFor="paye_active"
                              className="text-sm font-medium text-gray-700"
                            >
                              PAYE / APIT
                            </label>
                            <div
                              id="paye_active"
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                              style={{
                                backgroundColor: (formData.compensation.paye_active || formData.compensation.payeActive)
                                  ? "#3b82f6"
                                  : "#e5e7eb",
                              }}
                              onClick={() => {
                                const val = !(formData.compensation.paye_active || formData.compensation.payeActive);
                                updateFormData("compensation", { paye_active: val, payeActive: val });
                              }}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${(formData.compensation.paye_active || formData.compensation.payeActive)
                                  ? "translate-x-6"
                                  : "translate-x-1"
                                  }`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <label
                              htmlFor="holiday_processing"
                              className="text-sm font-medium text-gray-700"
                            >
                              Holiday Processing
                            </label>
                            <div
                              id="holiday_processing"
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                              style={{
                                backgroundColor: (formData.compensation.holiday_processing || formData.compensation.holidayProcessing)
                                  ? "#3b82f6"
                                  : "#e5e7eb",
                              }}
                              onClick={() => {
                                const val = !(formData.compensation.holiday_processing || formData.compensation.holidayProcessing);
                                updateFormData("compensation", { holiday_processing: val, holidayProcessing: val });
                              }}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${(formData.compensation.holiday_processing || formData.compensation.holidayProcessing)
                                  ? "translate-x-6"
                                  : "translate-x-1"
                                  }`}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <label
                              htmlFor="off_day_processing"
                              className="text-sm font-medium text-gray-700"
                            >
                              Off-Day Processing
                            </label>
                            <div
                              id="off_day_processing"
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                              style={{
                                backgroundColor: (formData.compensation.off_day_processing || formData.compensation.offDayProcessing)
                                  ? "#3b82f6"
                                  : "#e5e7eb",
                              }}
                              onClick={() => {
                                const val = !(formData.compensation.off_day_processing || formData.compensation.offDayProcessing);
                                updateFormData("compensation", { off_day_processing: val, offDayProcessing: val });
                              }}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${(formData.compensation.off_day_processing || formData.compensation.offDayProcessing)
                                  ? "translate-x-6"
                                  : "translate-x-1"
                                  }`}
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="enableEpfEtf"
                          className="text-sm font-medium text-gray-700"
                        >
                          Enable EPF/ETF
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.enableEpfEtf
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("enableEpfEtf")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.enableEpfEtf
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="otActive"
                          className="text-sm font-medium text-gray-700"
                        >
                          OT Active
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.otActive
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("otActive")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.otActive
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="otActiveSpecial"
                          className="text-sm font-medium text-gray-700"
                        >
                          Special OT Active
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.otActiveSpecial
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("otActiveSpecial")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.otActiveSpecial
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="nopayActive"
                          className="text-sm font-medium text-gray-700"
                        >
                          No-pay Active
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.nopayActive
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("nopayActive")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.nopayActive
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="earlyDeduction"
                          className="text-sm font-medium text-gray-700"
                        >
                          Early Deduction
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.earlyDeduction
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("earlyDeduction")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.earlyDeduction
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      {/* <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="onlyEpf"
                          className="text-sm font-medium text-gray-700"
                        >
                          Only EPF
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.onlyEpf
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("onlyEpf")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.onlyEpf
                                ? "translate-x-6"
                                : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div> */}

                      {/* <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <label
                      htmlFor="onlyEtf"
                      className="text-sm font-medium text-gray-700"
                    >
                      Only ETF
                    </label>
                    <div
                      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                      style={{
                        backgroundColor: formData.compensation.onlyEtf
                          ? "#3b82f6"
                          : "#e5e7eb",
                      }}
                      onClick={() => handleToggleChange("onlyEtf")}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                          formData.compensation.onlyEtf
                            ? "translate-x-6"
                            : "translate-x-1"
                        }`}
                      />
                    </div>
                  </div> */}
                    </div>
                  </div>
                )}
              </div>

              {/* OT Settings */}
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('overtime')}
                  className="w-full flex items-center justify-between p-6 hover:bg-orange-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                    Overtime Settings
                  </h2>
                  {openSections.overtime ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.overtime && (
                  <div className="p-6 pt-0">

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="morningOt"
                          className="text-sm font-medium text-gray-700"
                        >
                          Morning OT
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.morningOt
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("morningOt")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.morningOt
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="eveningOt"
                          className="text-sm font-medium text-gray-700"
                        >
                          Evening OT
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.eveningOt
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("eveningOt")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.eveningOt
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Morning OT Rate <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.compensation.ot_morning_rate}
                            onChange={(e) =>
                              handleInputChange("ot_morning_rate", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.ot_morning_rate
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter Morning OT Rate"
                            required
                          />
                        </div>
                        <FieldError error={errors.compensation?.ot_morning_rate} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Night OT Rate <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.compensation.ot_night_rate}
                            onChange={(e) =>
                              handleInputChange("ot_night_rate", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.ot_night_rate
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter Night OT Rate"
                            required
                          />
                        </div>
                        <FieldError error={errors.compensation?.ot_night_rate} />
                      </div>
                    </div>

                    <h2 className="text-xl font-semibold text-gray-800 mt-4 mb-4 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
                      Special Overtime Settings
                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="morningOtSpecial"
                          className="text-sm font-medium text-gray-700"
                        >
                          Morning OT
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.morningOtSpecial
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("morningOtSpecial")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.morningOtSpecial
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                        <label
                          htmlFor="eveningOtSpecial"
                          className="text-sm font-medium text-gray-700"
                        >
                          Evening OT
                        </label>
                        <div
                          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                          style={{
                            backgroundColor: formData.compensation.eveningOtSpecial
                              ? "#3b82f6"
                              : "#e5e7eb",
                          }}
                          onClick={() => handleToggleChange("eveningOtSpecial")}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.eveningOtSpecial
                              ? "translate-x-6"
                              : "translate-x-1"
                              }`}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Morning OT Rate <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.compensation.ot_morning_rate_special}
                            onChange={(e) =>
                              handleInputChange("ot_morning_rate_special", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.ot_morning_rate_special
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter Morning OT Rate"
                            required
                          />
                        </div>
                        <FieldError error={errors.compensation?.ot_morning_rate_special} />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Night OT Rate <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.compensation.ot_night_rate_special}
                            onChange={(e) =>
                              handleInputChange("ot_night_rate_special", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.ot_night_rate_special
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter Night OT Rate"
                            required
                          />
                        </div>
                        <FieldError error={errors.compensation?.ot_night_rate_special} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Bank Information */}
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('bank')}
                  className="w-full flex items-center justify-between p-6 hover:bg-blue-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                    <Building2 className="w-5 h-5 mr-2 text-blue-600" />
                    Bank Information
                  </h2>
                  {openSections.bank ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.bank && (
                  <div className="p-6 pt-0">

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Account Holder's Name <span className="text-xs text-gray-400 font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.compensation.accountHolderName || ""}
                            onChange={(e) =>
                              handleInputChange("accountHolderName", e.target.value)
                            }
                            className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.accountHolderName
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter account holder's name (if different from employee)"
                          />
                        </div>
                        <FieldError error={errors.compensation?.accountHolderName} />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bank Name <span className="text-xs text-gray-400 font-normal">(optional)</span>
                          </label>
                          <select
                            value={formData.compensation.bankName}
                            onChange={(e) =>
                              handleInputChange("bankName", e.target.value)
                            }
                            className={`w-full px-4 py-3 border ${errors.compensation?.bankName
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                          >
                            <option value="">Select Bank</option>
                            {banks.map((bank, idx) => (
                              <option key={idx} value={bank}>
                                {bank}
                              </option>
                            ))}
                          </select>
                          <FieldError error={errors.compensation?.bankName} />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Branch Name <span className="text-xs text-gray-400 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={formData.compensation.branchName}
                            onChange={(e) =>
                              handleInputChange("branchName", e.target.value)
                            }
                            className={`w-full px-4 py-3 border ${errors.compensation?.branchName
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter branch name"
                          />
                          <FieldError error={errors.compensation?.branchName} />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bank Code
                            {/* <span className="text-red-500">*</span> */}
                          </label>
                          <input
                            type="text"
                            value={formData.compensation.bankCode}
                            onChange={(e) =>
                              handleInputChange("bankCode", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            className={`w-full px-4 py-3 border ${errors.compensation?.bankCode
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter bank code"
                          />
                          <FieldError error={errors.compensation?.bankCode} />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Branch Code
                            {/* <span className="text-red-500">*</span> */}
                          </label>
                          <input
                            type="text"
                            value={formData.compensation.branchCode}
                            onChange={(e) =>
                              handleInputChange("branchCode", e.target.value)
                            }
                            className={`w-full px-4 py-3 border ${errors.compensation?.branchCode
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter branch code"
                          />
                          <FieldError error={errors.compensation?.branchCode} />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Bank Account Number{" "}
                          <span className="text-xs text-gray-400 font-normal">(optional)</span>
                        </label>
                        <div className="relative">
                          <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={formData.compensation.bankAccountNo}
                            onChange={(e) =>
                              handleInputChange("bankAccountNo", e.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            className={`w-full pl-10 pr-4 py-3 border ${errors.compensation?.bankAccountNo
                              ? "border-red-500"
                              : "border-gray-300"
                              } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all`}
                            placeholder="Enter account number"
                          />
                        </div>
                        <FieldError error={errors.compensation?.bankAccountNo} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Budgetary Relief Allowances - HIDDEN */}
              {/* 
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('relief')}
                  className="w-full flex items-center justify-between p-6 hover:bg-emerald-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800">
                    Budgetary Relief Allowances
                  </h2>
                  {openSections.relief ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.relief && (
                  <div className="p-6 pt-0">

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Budgetary Relief Allowance 2015
                      </h3>
                      <p className="text-sm text-gray-600">
                        BR1 Relief allowance for 2015
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        style={{
                          backgroundColor: formData.compensation
                            .budgetaryReliefAllowance2015
                            ? "#3b82f6"
                            : "#e5e7eb",
                        }}
                        onClick={() =>
                          handleToggleChange("budgetaryReliefAllowance2015")
                        }
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            formData.compensation.budgetaryReliefAllowance2015
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                      {isHighSalary && (
                        <span className="text-xs text-green-600">Eligible</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                    <div>
                      <h3 className="font-medium text-gray-800">
                        Budgetary Relief Allowance 2016
                      </h3>
                      <p className="text-sm text-gray-600">
                        BR2 Relief allowance for 2016
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        style={{
                          backgroundColor: formData.compensation
                            .budgetaryReliefAllowance2016
                            ? "#3b82f6"
                            : "#e5e7eb",
                        }}
                        onClick={() =>
                          handleToggleChange("budgetaryReliefAllowance2016")
                        }
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                            formData.compensation.budgetaryReliefAllowance2016
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </div>
                      {isHighSalary && (
                        <span className="text-xs text-green-600">Eligible</span>
                      )}
                    </div>
                  </div>
                </div>
                  </div>
                )}
              </div>
              */}

              {/* Primary Employment Basic */}
              {/* <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('primary')}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800">
                    Primary Employment Basic
                  </h2>
                  {openSections.primary ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.primary && (
                  <div className="p-6 pt-0">

                    <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
                      <div>
                        <h3 className="font-medium text-gray-800">
                          Primary Employment Basic
                        </h3>
                      </div>
                      <div
                        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 cursor-pointer"
                        style={{
                          backgroundColor: formData.compensation
                            .primaryEmploymentBasic
                            ? "#3b82f6"
                            : "#e5e7eb",
                        }}
                        onClick={() => handleToggleChange("primaryEmploymentBasic")}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${formData.compensation.primaryEmploymentBasic
                            ? "translate-x-6"
                            : "translate-x-1"
                            }`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div> */}

              {/* Comments */}
              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection('comments')}
                  className="w-full flex items-center justify-between p-6 hover:bg-yellow-100 transition-colors"
                >
                  <h2 className="text-xl font-semibold text-gray-800">
                    Comments
                  </h2>
                  {openSections.comments ? (
                    <ChevronUp className="w-6 h-6 text-gray-600" />
                  ) : (
                    <ChevronDown className="w-6 h-6 text-gray-600" />
                  )}
                </button>

                {openSections.comments && (
                  <div className="p-6 pt-0">

                    <textarea
                      value={formData.compensation.comments}
                      onChange={(e) =>
                        handleInputChange("comments", e.target.value)
                      }
                      rows="4"
                      className={`w-full px-4 py-3 border ${errors.compensation?.comments
                        ? "border-red-500"
                        : "border-gray-300"
                        } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none`}
                      placeholder="Add any additional comments or notes..."
                    />
                    <FieldError error={errors.compensation?.comments} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between space-x-4">
            <button
              type="button"
              onClick={onPrevious}
              className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              Next
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompensationManagement;
