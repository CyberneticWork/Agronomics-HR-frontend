import axios from "@utils/axios";
import { uploadToFirebase } from "./firebaseStorage";

async function appendEmployeeMedia(formData, submissionData) {
  if (formData.personal.profilePicture instanceof File) {
    const url = await uploadToFirebase(formData.personal.profilePicture, "hr/employee/photos");
    submissionData.append("profile_picture_url", url);
  } else if (
    typeof formData.personal.profilePicturePreview === "string" &&
    /^https?:\/\//i.test(formData.personal.profilePicturePreview)
  ) {
    submissionData.append("profile_picture_url", formData.personal.profilePicturePreview);
  }

  const remote = [];
  for (const doc of formData.documents || []) {
    if (doc.url && /^https?:\/\//i.test(doc.url) && !doc.file) {
      remote.push({ type: doc.type || "unknown", name: doc.name || "document", url: doc.url });
      continue;
    }
    if (doc.file instanceof File) {
      const url = await uploadToFirebase(doc.file, "hr/employee/documents");
      remote.push({ type: doc.type || "unknown", name: doc.name || doc.file.name, url });
    }
  }
  if (remote.length) {
    submissionData.append("documents_remote", JSON.stringify(remote));
  }
}

function appendQualifications(formData, submissionData) {
  if (Array.isArray(formData.qualifications)) {
    submissionData.append("qualifications", JSON.stringify(formData.qualifications));
  }
  if (Array.isArray(formData.followingQualifications)) {
    submissionData.append("following_qualifications", JSON.stringify(formData.followingQualifications));
  }
  if (Array.isArray(formData.previousEmployments)) {
    submissionData.append("previous_employments", JSON.stringify(formData.previousEmployments));
  }
  if (formData.schoolResults && typeof formData.schoolResults === "object") {
    submissionData.append("school_results", JSON.stringify(formData.schoolResults));
  }
}

const employeeService = {
  // Submit employee data with file uploads
  async submitEmployee(formData) {
    try {
      // Create FormData for file uploads
      const submissionData = new FormData();

      await appendEmployeeMedia(formData, submissionData);
      appendQualifications(formData, submissionData);

      // Append all other form data as JSON
      submissionData.append(
        "personal",
        JSON.stringify({
          ...formData.personal,
          profilePicture: undefined, // Remove the file object from JSON data
        })
      );

      submissionData.append("address", JSON.stringify(formData.address));
      submissionData.append(
        "compensation",
        JSON.stringify(formData.compensation)
      );
      submissionData.append(
        "organization",
        JSON.stringify(formData.organization)
      );

      const response = await axios.post("/employees", submissionData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      return response.data;
    } catch (error) {
      console.error("Submit error:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        throw error;
      } else if (error.request) {
        console.error("No response received:", error.request);
        throw new Error("No response from server");
      } else {
        console.error("Error message:", error.message);
        throw new Error("Error setting up request");
      }
    }
  },

  async updateEmployee(id, formData) {
    try {
      // Create FormData for file uploads
      const submissionData = new FormData();

      await appendEmployeeMedia(formData, submissionData);
      appendQualifications(formData, submissionData);

      // Append all other form data as JSON
      submissionData.append(
        "personal",
        JSON.stringify({
          ...formData.personal,
          profilePicture: undefined, // Remove the file object from JSON data
        })
      );

      submissionData.append("address", JSON.stringify(formData.address));
      submissionData.append(
        "compensation",
        JSON.stringify(formData.compensation)
      );
      submissionData.append(
        "organization",
        JSON.stringify(formData.organization)
      );

      const response = await axios.post(
        "/employes/post/update",
        submissionData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Update response:", JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error("Update error:", error);
      if (error.response) {
        console.error("Response status:", error.response.status);
        console.error("Response data:", error.response.data);
        throw error;
      } else if (error.request) {
        console.error("No response received:", error.request);
        throw new Error("No response from server");
      } else {
        console.error("Error message:", error.message);
        throw new Error("Error setting up request");
      }
    }
  },

  async searchEmployees(searchTerm) {
    try {
      const response = await axios.get(`/emp/search`, {
        params: { search: searchTerm },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching employees:", error);
      return [];
    }
  },

  async searchByAttendanceNo(searchTerm) {
    try {
      const response = await axios.get(`/emp/search/empno?attendance_no=${searchTerm}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching employees:", error);
      return [];
    }
  },

  async fetchEmployees() {
    try {
      const response = await axios.get(`/employees`);
      return response.data;
    } catch (error) {
      console.error("Error fetching employees:", error);
      return [];
    }
  },

  async getEmployees() {
    return this.fetchEmployees();
  },

  async fetchEmployeesForTable(page = 1, perPage = 10, search = "") {
    try {
      const response = await axios.get(
        `/emp/table?page=${page}&per_page=${perPage}&search=${search}`
      );
      return response.data;
    } catch (error) {
      console.error("Error fetching employees:", error);
      return [];
    }
  },

  async fetchEmployeeById(id) {
    try {
      const response = await axios.get(`/employees/${id}`);
      return response.data.data; // Return the actual employee data from the wrapper
    } catch (error) {
      console.error("Error fetching employees:", error);
      throw error;
    }
  },

  async getEmployeeDetails(id) {
    try {
      const response = await axios.get(`/employees/${id}`);
      return response.data.data; // Returns employee object with all relationships
    } catch (error) {
      console.error("Error fetching employee details:", error);
      throw error;
    }
  },

  async deleteEmployeeById(id) {
    try {
      const response = await axios.delete(`/employees/${id}`);
      return true;
    } catch (error) {
      console.error("Error delete employees:", error);
      return [];
    }
  },

  async exportEmployees(employeeId = null) {
    try {
      const params = employeeId ? { employee_id: employeeId } : {};
      const response = await axios.get("/employees/export/data", { params });
      return response.data;
    } catch (error) {
      console.error("Error exporting employees:", error);
      throw error;
    }
  },

  async fetchEmployeeReport({ employeeId = null, employeeNo = null, companyId = null, departmentId = null, activeOnly = false } = {}) {
    try {
      const params = {};
      if (employeeId) params.employee_id = employeeId;
      if (employeeNo) params.employee_no = employeeNo;
      if (companyId) params.company_id = companyId;
      if (departmentId) params.department_id = departmentId;
      if (activeOnly) params.active_only = true;
      const response = await axios.get("/employees/report/export", { params });
      return response.data;
    } catch (error) {
      console.error("Error fetching employee report:", error);
      throw error;
    }
  },

  async downloadMasterTemplate() {
    const response = await axios.get("/employees/template", { responseType: "blob" });
    const blob = new Blob([response.data], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "employee_master_import.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },

  async importMasterExcel(file) {
    const form = new FormData();
    form.append("file", file);
    const response = await axios.post("/employees/import-excel", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },
};

export default employeeService;
