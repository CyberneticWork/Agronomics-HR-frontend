import React, { useState, useEffect, useRef, useMemo } from "react";
import EmpPersonalDetails from "@dashboard/AddEmployeeMaster/EmpPersonalDetails";
import AddressDetails from "@dashboard/AddEmployeeMaster/AddressDetails";
import OrganizationDetails from "@dashboard/AddEmployeeMaster/OrganizationDetails";
import CompensationManagement from "@dashboard/AddEmployeeMaster/CompensationManagement";
import Employeedocument from "@dashboard/AddEmployeeMaster/Employeedocument";
import EmployeeQualifications from "@dashboard/AddEmployeeMaster/EmployeeQualifications";
import EmployeePreviousEmployment from "@dashboard/AddEmployeeMaster/EmployeePreviousEmployment";
import EmployeeConfirmationModal from "./EmployeeConfirmationModal";
import {
  EmployeeFormProvider,
  useEmployeeForm,
} from "@contexts/EmployeeFormContext";
import { useAuth } from "@contexts/AuthContext";
import employeeService from "@services/EmployeeDataService";
import { fetchCompanies } from "@services/ApiDataService";
import Swal from "sweetalert2";
import { Download, Upload } from "lucide-react";

const baseSteps = [
  "personal",
  "address",
  "compensation",
  "organization",
  "documents",
  "confirmation",
];

const STEP_LABELS = { previousEmployment: "Previous Employment" };

const packOn = (company, key) => {
  if (!company) return false;
  let cfg = company.process_config;
  if (typeof cfg === "string") {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      cfg = {};
    }
  }
  const val = cfg?.[key];
  return !!(val?.enabled ?? val === true);
};

const EmployeeMasterWrapper = () => {
  return (
    <EmployeeFormProvider>
      <EmployeeMaster />
    </EmployeeFormProvider>
  );
};

const EmployeeMaster = () => {
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("personal");
  const { formData, updateFormData, setFormErrors, setIsSubmitting, clearForm, loadEmployeeData } =
    useEmployeeForm();
  const excelInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    fetchCompanies()
      .then((rows) => setCompanies(Array.isArray(rows) ? rows : []))
      .catch(() => setCompanies([]));
  }, []);

  const selectedCompanyId = formData.organization?.company;
  const selectedCompany = useMemo(() => {
    if (!companies.length) return null;
    if (selectedCompanyId) {
      const match = companies.find((c) => String(c.id) === String(selectedCompanyId));
      if (match) return match;
    }
    if (user?.company_id) {
      const match = companies.find((c) => Number(c.id) === Number(user.company_id));
      if (match) return match;
    }
    return companies.find((c) => c.portal_active) || companies[0] || null;
  }, [companies, selectedCompanyId, user?.company_id]);

  useEffect(() => {
    if (companies.length && !formData.organization?.company) {
      const preferred =
        (user?.company_id && companies.find((c) => Number(c.id) === Number(user.company_id))) ||
        companies.find((c) => c.portal_active) ||
        companies[0];
      if (preferred) {
        updateFormData("organization", {
          company: String(preferred.id),
          companyCode: preferred.company_code || "",
          companyName: preferred.name || "",
        });
      }
    }
  }, [companies, formData.organization?.company, user?.company_id, updateFormData]);

  const educationPacks = {
    qualifications: packOn(selectedCompany, "qualifications"),
    following: packOn(selectedCompany, "following_qualifications"),
    ol: packOn(selectedCompany, "ol_results"),
    al: packOn(selectedCompany, "al_results"),
  };
  const showEducation = Object.values(educationPacks).some(Boolean);
  const showPreviousEmployment = packOn(selectedCompany, "previous_employment");
  const steps = useMemo(() => {
    const addonSteps = [
      ...(showEducation ? ["education"] : []),
      ...(showPreviousEmployment ? ["previousEmployment"] : []),
    ];
    const at = baseSteps.indexOf("organization") + 1;
    return [...baseSteps.slice(0, at), ...addonSteps, ...baseSteps.slice(at)];
  }, [showEducation, showPreviousEmployment]);
  const currentStepIndex = steps.indexOf(activeCategory);

  useEffect(() => {
    if (!steps.includes(activeCategory)) {
      setActiveCategory("organization");
    }
  }, [activeCategory, steps]);

  // Load employee data if editing
  useEffect(() => {
    const editEmployeeId = localStorage.getItem('editEmployeeId');
    if (editEmployeeId) {
      const fetchEmployee = async () => {
        try {
          const employeeData = await employeeService.fetchEmployeeById(editEmployeeId);
          loadEmployeeData(employeeData);
          localStorage.removeItem('editEmployeeId');
        } catch (error) {
          console.error('Error loading employee:', error);
        }
      };
      fetchEmployee();
    }
  }, [loadEmployeeData]);

  const handleDownloadTemplate = async () => {
    try {
      await employeeService.downloadMasterTemplate();
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Download failed",
        text: err.response?.data?.message || err.message || "Could not download the Excel template.",
      });
    }
  };

  const handleExcelSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    try {
      const result = await employeeService.importMasterExcel(file);
      const failed = (result.details || []).filter((row) => row.status === "failed");
      await Swal.fire({
        icon: result.failed ? "warning" : "success",
        title: "Excel import finished",
        html: `<p>${result.message || ""}</p>${
          failed.length
            ? `<pre class="text-left text-xs mt-2 max-h-40 overflow-auto">${failed
                .map((row) => `${row.name}: ${row.reason}`)
                .join("\n")}</pre>`
            : ""
        }`,
      });
    } catch (err) {
      Swal.fire({
        icon: "error",
        title: "Import failed",
        text: err.response?.data?.message || err.message || "Could not import the Excel file.",
      });
    } finally {
      setImporting(false);
    }
  };

  const goNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setActiveCategory(steps[currentStepIndex + 1]);
    }
  };

  const goPrevious = () => {
    if (currentStepIndex > 0) {
      setActiveCategory(steps[currentStepIndex - 1]);
    }
  };

  const handleSubmit = async (allEmployeeData) => {
    setIsSubmitting(true);

    try {
      let response;
      if (allEmployeeData.personal?.id) {
        response = await employeeService.updateEmployee(
          allEmployeeData.personal.id,
          allEmployeeData
        );
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Employee updated successfully!",
        });
        window.dispatchEvent(new CustomEvent('employeeUpdated', {
          detail: { employeeId: allEmployeeData.personal.id }
        }));
        clearForm();
        setActiveCategory("personal");
      } else {
        response = await employeeService.submitEmployee(allEmployeeData);
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Employee submitted successfully!",
        });
        if (response?.data?.id) {
          window.dispatchEvent(new CustomEvent('employeeUpdated', {
            detail: { employeeId: response.data.id }
          }));
        }
        clearForm();
        setActiveCategory("personal");
      }
      return response;
    } catch (error) {
      console.error("Update error:", error);
      console.error("Full error response:", error.response?.data);
      console.error("Validation errors:", error.response?.data?.errors);
      console.error("Error message:", error.response?.data?.message);
      console.error("Error status:", error.response?.status);
      
      if (error.response?.data?.errors) {
        const formattedErrors = {};

        Object.entries(error.response.data.errors).forEach(
          ([fieldPath, messages]) => {
            const pathParts = fieldPath.split(".");
            let currentLevel = formattedErrors;

            pathParts.forEach((part, index) => {
              if (index === pathParts.length - 1) {
                currentLevel[part] = Array.isArray(messages) ? messages[0] : messages;
              } else {
                currentLevel[part] = currentLevel[part] || {};
                currentLevel = currentLevel[part];
              }
            });
          }
        );

        setFormErrors(formattedErrors);
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Please fix the errors in the form!",
        });
      } else {
        const errorMsg = error.response?.data?.message || error.response?.data?.error || error.message || "Error updating employee. Please try again.!";
        Swal.fire({
          icon: "error",
          title: "Oops...",
          text: errorMsg,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg mb-6 mx-4 mt-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Employee Master</h1>
            <p className="text-blue-100">Complete employee information management system</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleExcelSelected}
            />
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold text-white hover:bg-white/25"
            >
              <Download size={16} /> Excel template
            </button>
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              disabled={importing}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
            >
              <Upload size={16} /> {importing ? "Uploading…" : "Upload Excel"}
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 px-4 py-2 border-b border-gray-200 bg-white items-center justify-between">
        <div className="flex gap-2">
          {steps.map((step) => (
            <button
              key={step}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                activeCategory === step
                  ? "bg-indigo-600 text-white"
                  : "text-indigo-700 hover:bg-indigo-100"
              }`}
              onClick={() => setActiveCategory(step)}
            >
              {STEP_LABELS[step] || step.charAt(0).toUpperCase() + step.slice(1)}
            </button>
          ))}
        </div>
        <h1 className="text-xl font-bold text-gray-800">Edit Employee</h1>
      </div>
      <div className="p-4">
        <div className="p-4">
          {activeCategory === "personal" && (
            <EmpPersonalDetails
              onNext={goNext}
              activeCategory={activeCategory}
            />
          )}
          {activeCategory === "address" && (
            <AddressDetails
              onNext={goNext}
              onPrevious={goPrevious}
              activeCategory={activeCategory}
            />
          )}
          {activeCategory === "compensation" && (
            <CompensationManagement
              onNext={goNext}
              onPrevious={goPrevious}
              activeCategory={activeCategory}
              selectedCompany={selectedCompany}
              companies={companies}
            />
          )}
          {activeCategory === "organization" && (
            <OrganizationDetails
              onNext={goNext}
              onPrevious={goPrevious}
              activeCategory={activeCategory}
            />
          )}
          {activeCategory === "education" && showEducation && (
            <EmployeeQualifications
              onNext={goNext}
              onPrevious={goPrevious}
              packs={educationPacks}
            />
          )}
          {activeCategory === "previousEmployment" && showPreviousEmployment && (
            <EmployeePreviousEmployment onNext={goNext} onPrevious={goPrevious} />
          )}
          {activeCategory === "documents" && (
            <Employeedocument
              onNext={goNext}
              onPrevious={goPrevious}
              onSubmit={handleSubmit}
              activeCategory={activeCategory}
            />
          )}
          {activeCategory === "confirmation" && (
            <EmployeeConfirmationModal
              onPrevious={goPrevious}
              onSubmit={handleSubmit}
              activeCategory={activeCategory}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeMasterWrapper;
