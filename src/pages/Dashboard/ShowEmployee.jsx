import React, { useState, useEffect, useRef } from "react";
import {
  Eye,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  X,
  Loader2,
  Heart,
  Baby,
  Shield,
  Clock,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Trash2,
  DollarSign,
  Edit,
  Download,
  FileText,
  Upload,
} from "lucide-react";
import { useDebounce } from "@uidotdev/usehooks";
import employeeService from "@services/EmployeeDataService";
import { exportEmployeeReportCSV, exportEmployeeReportPDF } from "@utils/employeeReportExport";
import config from "../../config";
import { mediaUrl } from "../../utils/mediaUrl";
import Swal from "sweetalert2";
import useAcl from "../../hooks/useAcl";

const apiUrl = config.apiBaseUrl;

const ShowEmployee = () => {
  const showAcl = useAcl("show");
  const masterAcl = useAcl("employeeMaster");
  const canEditEmployee = showAcl.canEdit || masterAcl.canEdit;
  const canDeleteEmployee = masterAcl.canDelete || showAcl.canDelete;
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 500); // 500ms delay

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalItems, setTotalItems] = useState(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const employeesData = await employeeService.fetchEmployeesForTable(
        currentPage,
        perPage,
        debouncedSearchTerm
      );
      setEmployees(employeesData.data);
      setTotalItems(employeesData.total);
    } catch (e) {
      console.error("Error loading data:", e);
    } finally {
      setIsLoading(false);
      setIsPageLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentPage, perPage, debouncedSearchTerm]);

  const handleViewEmployee = async (employee) => {
    const employeeData = await employeeService.fetchEmployeeById(employee);
    setSelectedEmployee(employeeData);
    setShowModal(true);
    setDeleteError(null);
    setDeleteSuccess(false);
  };

  const handleEditEmployee = (employeeId) => {
    if (!canEditEmployee || !employeeId) return;
    localStorage.setItem("editEmployeeId", String(employeeId));
    window.dispatchEvent(new CustomEvent("hr:navigate", { detail: "employeeMaster" }));
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedEmployee(null);
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > Math.ceil(totalItems / perPage)) return;
    setIsPageLoading(true);
    setCurrentPage(newPage);
  };

  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteConfirmation(true);
    setDeleteError(null);
    setDeleteSuccess(false);
  };

  const confirmDelete = async (employeeId) => {
    setIsDeleting(true);
    try {
      await employeeService.deleteEmployeeById(employeeId);
      setDeleteSuccess(true);
      setShowDeleteConfirmation(false);
      setShowModal(false);
      loadData();
    } catch (error) {
      setDeleteError(error.message || "Failed to delete employee");
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
  };

  const getStatusBadge = (status) => {
    const statusClass =
      status === 1 || status === true || status === "1"
        ? "bg-green-100 text-green-800 border-green-200"
        : "bg-red-100 text-red-800 border-red-200";
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium border ${statusClass}`}
      >
        {status === 1 || status === true || status === "1" ? "Active" : "Inactive"}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    const typeClass =
      type === "PERMANENT"
        ? "bg-blue-100 text-blue-800 border-blue-200"
        : type === "Training"
        ? "bg-orange-100 text-orange-800 border-orange-200"
        : "bg-purple-100 text-purple-800 border-purple-200";
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium border ${typeClass}`}
      >
        {type || "N/A"}
      </span>
    );
  };

  const getMaritalStatusBadge = (status) => {
    const statusClass =
      status === "married"
        ? "bg-pink-100 text-pink-800 border-pink-200"
        : "bg-gray-100 text-gray-800 border-gray-200";
    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium border ${statusClass}`}
      >
        {status?.charAt(0).toUpperCase() + status?.slice(1) || "Not specified"}
      </span>
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const calculateAge = (dob) => {
    if (!dob) return "Not specified";
    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }
    return `${age} years old`;
  };

  const [reportLoading, setReportLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const excelInputRef = useRef(null);

  const runEmployeeReportExport = async (type, { employeeId = null, activeOnly = false } = {}) => {
    setReportLoading(true);
    try {
      const report = await employeeService.fetchEmployeeReport({ employeeId, activeOnly });
      if (!report?.employees?.length) {
        Swal.fire({ icon: "info", title: "No Data", text: "No employee records found for this report." });
        return;
      }
      const prefix = employeeId
        ? `employee_report_${report.filter?.employee_no || employeeId}`
        : activeOnly
          ? "employee_report_active"
          : "employee_detailed_report";
      if (type === "csv") exportEmployeeReportCSV(report, prefix);
      else exportEmployeeReportPDF(report, prefix);
    } catch (err) {
      Swal.fire({ icon: "error", title: "Export Failed", text: err.response?.data?.message || err.message || "Could not generate report." });
    } finally {
      setReportLoading(false);
    }
  };

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
      loadData();
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

  const handleExportAllCSV = () => runEmployeeReportExport("csv");
  const handleExportAllPDF = () => runEmployeeReportExport("pdf");
  const handleExportActiveCSV = () => runEmployeeReportExport("csv", { activeOnly: true });
  const handleExportActivePDF = () => runEmployeeReportExport("pdf", { activeOnly: true });
  const handleExportSingleCSV = (employeeId) => runEmployeeReportExport("csv", { employeeId });
  const handleExportSinglePDF = (employeeId) => runEmployeeReportExport("pdf", { employeeId });

  const totalPages = Math.ceil(totalItems / perPage);
  const visiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(visiblePages / 2));
  let endPage = Math.min(totalPages, startPage + visiblePages - 1);

  if (endPage - startPage + 1 < visiblePages) {
    startPage = Math.max(1, endPage - visiblePages + 1);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800">
            Loading Employee Data
          </h2>
          <p className="text-gray-600 mt-2">
            Please wait while we fetch the records...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
              <h1 className="text-3xl font-bold mb-2">
                Employee Management
              </h1>
              <p className="text-blue-100">
                Manage and view employee information
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 w-full md:w-auto">
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelSelected}
              />
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800"
              >
                <Download size={16} /> Excel template
              </button>
              <button
                onClick={() => excelInputRef.current?.click()}
                disabled={importing}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-60"
              >
                <Upload size={16} /> {importing ? "Uploading…" : "Upload Excel"}
              </button>
              <button
                onClick={handleExportAllCSV}
                disabled={reportLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60"
              >
                <Download size={16} /> {reportLoading ? "Generating..." : "Full Report CSV"}
              </button>
              <button
                onClick={handleExportAllPDF}
                disabled={reportLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60"
              >
                <FileText size={16} /> {reportLoading ? "Generating..." : "Full Report PDF"}
              </button>
              <button
                onClick={handleExportActiveCSV}
                disabled={reportLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 text-sm"
              >
                <Download size={16} /> Active Only CSV
              </button>
              <button
                onClick={handleExportActivePDF}
                disabled={reportLoading}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60 text-sm"
              >
                <FileText size={16} /> Active Only PDF
              </button>
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  placeholder="Search employees..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-xl font-semibold text-gray-800 flex items-center">
              <User className="mr-2 h-5 w-5 text-blue-600" />
              Employee List
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee Info
                  </th>
                  {/* à¶…à¶½à·”à¶­à·’à¶±à·Š Company à¶‘à¶šà¶­à·” à¶šà·…à· */}
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Position
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees && employees.length > 0 ? (
                  employees.map((employee) => {
                    // Safe access for organization details
                    const org = employee.organizationAssignment || employee.organization_assignment || {};
                    const companyName = org.company?.name || "N/A";
                    const designationName = org.designation?.name || "N/A";
                    const departmentName = org.department?.name || "N/A";

                    return (
                      <tr
                        key={employee.id}
                        className="hover:bg-gray-50 transition-colors duration-200"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-12 w-12">
                              <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden">
                                {employee.profile_photo_path ? (
                                  <img
                                    src={mediaUrl(employee.profile_photo_path)}
                                    alt="Profile photo"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <span className="text-white font-semibold text-sm">
                                    {employee.name_with_initials?.charAt(0) || "?"}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {employee.full_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                Emp No: {employee.attendance_employee_no}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Company Column à¶‘à¶š */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">
                            {companyName}
                          </div>
                        </td>

                        {/* Position (Designation) Column à¶‘à¶š */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 font-medium">
                            {designationName}
                          </div>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {departmentName}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(employee.is_active)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getTypeBadge(employee.employmentType?.name || employee.employment_type?.name)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {employee.contactDetail?.email || employee.contact_detail?.email || "N/A"}
                          </div>
                          <div className="text-sm text-gray-500">
                            {employee.contactDetail?.mobile_line || employee.contact_detail?.mobile_line || ""}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewEmployee(employee.id)}
                              className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors duration-200"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditEmployee(employee.id)}
                              disabled={!canEditEmployee}
                              title={
                                canEditEmployee
                                  ? "Edit this employee"
                                  : "You do not have permission to edit employees"
                              }
                              className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                                canEditEmployee
                                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                      {isLoading ? (
                        <div className="flex justify-center items-center">
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Loading employees...
                        </div>
                      ) : (
                        "No employees found"
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center space-x-2 mb-4 sm:mb-0">
              <span className="text-sm text-gray-600">
                Showing <span className="font-medium">{(currentPage - 1) * perPage + (totalItems > 0 ? 1 : 0)}</span> to{" "}
                <span className="font-medium">{Math.min(currentPage * perPage, totalItems)}</span> of{" "}
                <span className="font-medium">{totalItems}</span> employees
              </span>
              <select
                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                disabled={isPageLoading}
              >
                <option value="5">5 per page</option>
                <option value="10">10 per page</option>
                <option value="20">20 per page</option>
                <option value="50">50 per page</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isPageLoading}
                className={`px-3 py-1 rounded-md border flex items-center ${
                  currentPage === 1 || isPageLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </button>

              {startPage > 1 && (
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={isPageLoading}
                  className={`px-3 py-1 rounded-md border ${
                    isPageLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  1
                </button>
              )}
              {startPage > 2 && <span className="px-2 text-gray-500">...</span>}

              {Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i).map((page) => (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  disabled={isPageLoading}
                  className={`px-3 py-1 rounded-md border ${
                    currentPage === page
                      ? "bg-blue-600 text-white"
                      : isPageLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {page}
                </button>
              ))}

              {endPage < totalPages - 1 && <span className="px-2 text-gray-500">...</span>}
              {endPage < totalPages && (
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={isPageLoading}
                  className={`px-3 py-1 rounded-md border ${
                    isPageLoading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {totalPages}
                </button>
              )}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages || isPageLoading}
                className={`px-3 py-1 rounded-md border flex items-center ${
                  currentPage >= totalPages || isPageLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading overlay during page changes */}
        {isPageLoading && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center z-40">
            <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-3">
              <Loader2 className="h-6 w-6 text-purple-600 animate-spin" />
              <span>Loading employees...</span>
            </div>
          </div>
        )}

        {/* Employee Details Modal */}
        {showModal && selectedEmployee && (
          <div className="fixed inset-0 backdrop-blur-sm bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      {selectedEmployee.profile_photo_path ? (
                        <img
                          src={mediaUrl(selectedEmployee.profile_photo_path)}
                          alt="Profile photo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold text-lg">
                          {selectedEmployee.name_with_initials?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">
                        {selectedEmployee.full_name}
                      </h2>
                      <p className="text-blue-100">{selectedEmployee.organization_assignment?.designation?.name || selectedEmployee.title}</p>
                      <p className="text-blue-200 text-sm">
                        {selectedEmployee.display_name} â€¢ {calculateAge(selectedEmployee.dob)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExportSingleCSV(selectedEmployee.id)}
                      disabled={reportLoading}
                      className="px-3 py-1.5 bg-green-500 hover:bg-green-600 rounded-lg text-sm flex items-center gap-1 disabled:opacity-60"
                    >
                      <Download size={14} /> Full CSV
                    </button>
                    <button
                      onClick={() => handleExportSinglePDF(selectedEmployee.id)}
                      disabled={reportLoading}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm flex items-center gap-1 disabled:opacity-60"
                    >
                      <FileText size={14} /> Full PDF
                    </button>
                    <button onClick={closeModal} className="text-white hover:text-gray-200 transition-colors p-2">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                <div className="mb-8 text-center">
                  <div className="inline-block">
                    <div className="h-40 w-40 rounded-lg bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center overflow-hidden shadow-lg">
                      {selectedEmployee.profile_photo_path ? (
                        <img
                          src={mediaUrl(selectedEmployee.profile_photo_path)}
                          alt="Profile photo"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold text-6xl">
                          {selectedEmployee.name_with_initials?.charAt(0) || "?"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2 text-blue-600" /> Basic Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Employee No</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.attendance_employee_no}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Display Name</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.display_name}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Gender</label>
                      <p className="text-gray-900 font-semibold capitalize">{selectedEmployee.gender}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Date of Birth</label>
                      <p className="text-gray-900 font-semibold flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        {formatDate(selectedEmployee.dob)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Religion</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.religion || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Country of Birth</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.country_of_birth || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">NIC Number</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.nic}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">EPF No</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.epf}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Marital Status</label>
                      <div className="mt-2">{getMaritalStatusBadge(selectedEmployee.marital_status)}</div>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Briefcase className="h-5 w-5 mr-2 text-purple-600" /> Employment Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Employment Type</label>
                      <div className="mt-2">{getTypeBadge(selectedEmployee.employment_type?.name)}</div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Company Name</label>
                      <div className="mt-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-purple-100 text-purple-800 border-purple-200">
                          {selectedEmployee.organization_assignment?.company?.name || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Department Name</label>
                      <div className="mt-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-red-100 text-purple-800 border-purple-200">
                          {selectedEmployee.organization_assignment?.department?.name || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Sub Department</label>
                      <div className="mt-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-green-100 text-purple-800 border-purple-200">
                          {selectedEmployee.organization_assignment?.sub_department?.name || "Not assigned"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Designation</label>
                      <div className="mt-2">
                        <span className="px-3 py-1 rounded-full text-xs font-medium border bg-yellow-100 text-purple-800 border-purple-200">
                          {selectedEmployee.organization_assignment?.designation?.name || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Date of Joining</label>
                      <p className="text-gray-900 font-semibold flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                        {formatDate(selectedEmployee.organization_assignment?.date_of_joining)}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Current Supervisor</label>
                      <p className="text-gray-900 font-semibold">
                        {selectedEmployee.organization_assignment?.current_supervisor || "Not assigned"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Day Off</label>
                      <p className="text-gray-900 font-semibold capitalize">
                        {selectedEmployee.organization_assignment?.day_off || "Not specified"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Confirmation Date</label>
                      <p className="text-gray-900 font-semibold">
                        {formatDate(selectedEmployee.organization_assignment?.confirmation_date) || "Not confirmed"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Status</label>
                      <div className="mt-2">{getStatusBadge(selectedEmployee.is_active)}</div>
                    </div>
                  </div>
                </div>

                {selectedEmployee.organization_assignment && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Clock className="h-5 w-5 mr-2 text-orange-600" /> Employment Periods
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Boolean(selectedEmployee.organization_assignment.probationary_period) && (
                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                          <label className="block text-sm font-medium text-yellow-800 mb-2">Probationary Period</label>
                          <p className="text-sm text-yellow-700">
                            From: {formatDate(selectedEmployee.organization_assignment.probationary_period_from)}
                          </p>
                          <p className="text-sm text-yellow-700">
                            To: {formatDate(selectedEmployee.organization_assignment.probationary_period_to)}
                          </p>
                        </div>
                      )}
                      {Boolean(selectedEmployee.organization_assignment.training_period) && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="block text-sm font-medium text-blue-800 mb-2">Training Period</label>
                          <p className="text-sm text-blue-700">
                            From: {formatDate(selectedEmployee.organization_assignment.training_period_from)}
                          </p>
                          <p className="text-sm text-blue-700">
                            To: {formatDate(selectedEmployee.organization_assignment.training_period_to)}
                          </p>
                        </div>
                      )}
                      {Boolean(selectedEmployee.organization_assignment.contract_period) && (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <label className="block text-sm font-medium text-green-800 mb-2">Contract Period</label>
                          <p className="text-sm text-green-700">
                            From: {formatDate(selectedEmployee.organization_assignment.contract_period_from)}
                          </p>
                          <p className="text-sm text-green-700">
                            To: {formatDate(selectedEmployee.organization_assignment.contract_period_to)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(selectedEmployee.spouse || selectedEmployee.children?.length > 0) && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <Heart className="h-5 w-5 mr-2 text-pink-600" /> Family Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {selectedEmployee.spouse && (
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                          <label className="block text-sm font-medium text-pink-800 mb-2">Spouse Information</label>
                          <p className="text-pink-700 font-semibold">
                            {selectedEmployee.spouse.title} {selectedEmployee.spouse.name}
                          </p>
                          <p className="text-sm text-pink-600">Age: {selectedEmployee.spouse.age} years</p>
                          <p className="text-sm text-pink-600">DOB: {formatDate(selectedEmployee.spouse.dob)}</p>
                          <p className="text-sm text-pink-600">NIC: {selectedEmployee.spouse.nic || "Not provided"}</p>
                        </div>
                      )}
                      {selectedEmployee.children?.length > 0 && (
                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <label className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                            <Baby className="h-4 w-4 mr-1" /> Children ({selectedEmployee.children.length})
                          </label>
                          <div className="space-y-2">
                            {selectedEmployee.children.map((child, index) => (
                              <div key={child.id} className="text-sm">
                                <p className="text-blue-700 font-semibold">
                                  {index + 1}. {child.name}
                                </p>
                                <p className="text-blue-600">
                                  Age: {child.age} years â€¢ DOB: {formatDate(child.dob)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <MapPin className="h-5 w-5 mr-2 text-green-600" /> Address Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Permanent Address</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.permanent_address || "Not provided"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Temporary Address</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.temporary_address || "Not provided"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Province</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.province || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">District</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.district || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">GN Division</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.gn_division || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Police Station</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.police_station || "Not specified"}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Electoral Division</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.electoral_division || "Not specified"}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Phone className="h-5 w-5 mr-2 text-blue-600" /> Contact Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Email</label>
                      <p className="text-gray-900 font-semibold flex items-center">
                        <Mail className="h-4 w-4 mr-1 text-gray-500" />
                        {selectedEmployee.contact_detail?.email || "Not provided"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Mobile</label>
                      <p className="text-gray-900 font-semibold flex items-center">
                        <Phone className="h-4 w-4 mr-1 text-gray-500" />
                        {selectedEmployee.contact_detail?.mobile_line || "Not provided"}
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <label className="block text-sm font-medium text-gray-600 mb-1">Land Line</label>
                      <p className="text-gray-900 font-semibold">{selectedEmployee.contact_detail?.land_line || "Not provided"}</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-red-600" /> Emergency Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <label className="block text-sm font-medium text-red-800 mb-1">Name</label>
                      <p className="text-red-900 font-semibold">{selectedEmployee.contact_detail?.emg_name || "Not specified"}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <label className="block text-sm font-medium text-red-800 mb-1">Relationship</label>
                      <p className="text-red-900 font-semibold">{selectedEmployee.contact_detail?.emg_relationship || "Not specified"}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <label className="block text-sm font-medium text-red-800 mb-1">Emergency Contact Number</label>
                      <p className="text-red-900 font-semibold">{selectedEmployee.contact_detail?.emg_tel || "Not provided"}</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200 md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-red-800 mb-1">Emergency Contact Address</label>
                      <p className="text-red-900 font-semibold">{selectedEmployee.contact_detail?.emg_address || "Not provided"}</p>
                    </div>
                  </div>
                </div>

                {selectedEmployee.compensation && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <DollarSign className="h-5 w-5 mr-2 text-green-600" /> Compensation Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-green-800 mb-1">Basic Salary</label>
                        <p className="text-green-900 font-semibold">Rs. {selectedEmployee.compensation.basic_salary}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-green-800 mb-1">Bank Name</label>
                        <p className="text-green-900 font-semibold">{selectedEmployee.compensation.bank_name || "Not specified"}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-green-800 mb-1">Branch Name</label>
                        <p className="text-green-900 font-semibold">{selectedEmployee.compensation.branch_name || "Not specified"}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-green-800 mb-1">Account Number</label>
                        <p className="text-green-900 font-semibold">{selectedEmployee.compensation.bank_account_no || "Not specified"}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-green-800 mb-1">EPF/ETF Enabled</label>
                        <p className="text-green-900 font-semibold">{selectedEmployee.compensation.enable_epf_etf ? "Yes" : "No"}</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <label className="block text-sm font-medium text-green-800 mb-1">OT Active</label>
                        <p className="text-green-900 font-semibold">{selectedEmployee.compensation.ot_active ? "Yes" : "No"}</p>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEmployee.organization_assignment?.date_of_resigning && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                      <UserCheck className="h-5 w-5 mr-2 text-gray-600" /> Additional Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Date of Resignation</label>
                        <p className="text-gray-900 font-semibold">
                          {formatDate(selectedEmployee.organization_assignment.date_of_resigning)}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <label className="block text-sm font-medium text-gray-600 mb-1">Resignation Reason</label>
                        <p className="text-gray-900 font-semibold">
                          {selectedEmployee.organization_assignment.resigned_reason || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 px-6 py-4 rounded-b-lg flex justify-between items-center">
                {showDeleteConfirmation && (
                  <div className="flex items-center space-x-2 text-red-600">
                    <span>Are you sure you want to delete {selectedEmployee.full_name}?</span>
                    <button
                      onClick={() => confirmDelete(selectedEmployee.id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={cancelDelete}
                      className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 px-6 py-4 rounded-b-2xl">
                <div className="flex justify-end space-x-4">
                  {canDeleteEmployee ? (
                    <button
                      onClick={handleDeleteClick}
                      className="flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors duration-200"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleEditEmployee(selectedEmployee.id)}
                    disabled={!canEditEmployee}
                    title={
                      canEditEmployee
                        ? "Edit this employee"
                        : "You do not have permission to edit employees"
                    }
                    className={`flex items-center px-4 py-2 font-medium rounded-lg transition-colors duration-200 ${
                      canEditEmployee
                        ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                        : "bg-gray-200 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    <Edit className="h-4 w-4 mr-2" /> Edit
                  </button>
                  <button
                    onClick={closeModal}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShowEmployee;
