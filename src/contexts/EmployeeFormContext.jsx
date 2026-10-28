import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import config from "@src/config";

const EmployeeFormContext = createContext();

const toBool = (val, defaultValue = false) => {
  if (val === undefined || val === null) return defaultValue;
  if (typeof val === "boolean") return val;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const s = val.trim().toLowerCase();
    if (s === "1" || s === "true" || s === "yes" || s === "on") return true;
    if (s === "0" || s === "false" || s === "no" || s === "off") return false;
  }
  return Boolean(val);
};

const initialState = {
  personal: {
    id: "",
    title: "",
    attendanceEmpNo: "",
    epfNo: "",
    nicNumber: "",
    dob: "",
    gender: "",
    religion: "",
    countryOfBirth: "",
    profilePicture: null,
    profilePicturePreview: null,
    employmentStatus: "",
    nameWithInitial: "",
    fullName: "",
    displayName: "",
    maritalStatus: "",
    relationshipType: "",
    spouseTitle: "",
    spouseName: "",
    spouseAge: "",
    spouseDob: "",
    spouseNic: "",
    children: [{ name: "", age: "", dob: "", nic: "" }],
  },
  address: {
    permanentAddress: "",
    temporaryAddress: "",
    email: "",
    password: "",
    landLine: "",
    mobileLine: "",
    gnDivision: "",
    policeStation: "",
    district: "",
    province: "",
    electoralDivision: "",
    emergencyContact: {
      relationship: "",
      contactName: "",
      contactAddress: "",
      contactTel: "",
    },
  },
  compensation: {
    basicSalary: "",
    monthlyBonus: "",
    sportsFundPercentage: "",
    staffFundAmount: "",
    incrementValue: "",
    incrementEffectiveFrom: "",
    bankName: "",
    branchName: "",
    bankCode: "",
    branchCode: "",
    bankAccountNo: "",
    accountHolderName: "",
    comments: "",
    secondaryEmp: false,
    primaryEmploymentBasic: false,
    enableEpfEtf: false,
    otActive: false,

    otActiveSpecial: false,

    earlyDeduction: false,
    incrementActive: false,
    nopayActive: false,
    morningOt: false,
    ot_morning_rate: "0",
    ot_night_rate: "0",
    eveningOt: false,

    morningOtSpecial: false,
    ot_morning_rate_special: "0",
    ot_night_rate_special: "0",
    eveningOtSpecial: false,

    budgetaryReliefAllowance2015: false,
    budgetaryReliefAllowance2016: false,
    stamp: false,
    paye_active: false,
    holiday_processing: false,
    off_day_processing: false,
  },
  organization: {
    company: "",
    department: "",
    subDepartment: "",
    companyName: "",
    companyCode: "",
    departmentName: "",
    subDepartmentName: "",
    location: "",
    locationName: "",
    currentSupervisor: "",
    dateOfJoined: "",
    designation: "",
    designationName: "",
    probationPeriod: false,
    trainingPeriod: false,
    contractPeriod: false,
    probationFrom: "",
    probationTo: "",
    trainingFrom: "",
    trainingTo: "",
    contractFrom: "",
    contractTo: "",
    confirmationDate: "",
    resignationDate: "",
    resignationLetter: null,
    resignationApproved: false,
    currentStatus: 1,
    dayOff: "",
    employeeCategory: "Non-Executive",
  },
  qualifications: [],
  followingQualifications: [],
  previousEmployments: [],
  schoolResults: {
    ol: { englishGrade: "", mathsGrade: "", yearSat: "" },
    al: { syllabus: "", stream: "", yearSat: "" },
  },
  documents: [],
};

export const mapSchoolResultsFromApi = (row) => ({
  ol: {
    englishGrade: row?.ol_english_grade || "",
    mathsGrade: row?.ol_maths_grade || "",
    yearSat: row?.ol_year ? String(row.ol_year) : "",
  },
  al: {
    syllabus: row?.al_syllabus || "",
    stream: row?.al_stream || "",
    yearSat: row?.al_year ? String(row.al_year) : "",
  },
});

export const mapQualificationsFromApi = (rows) =>
  (Array.isArray(rows) ? rows : [])
    .filter((q) => q.status !== "following")
    .map((q) => ({
      qualificationType: q.qualification_type || "",
      courseName: q.course_name || "",
      instituteName: q.institute_name || "",
      completionYear: q.completion_year ? String(q.completion_year) : "",
    }));

const toMonthInput = (year, month) =>
  year && month ? `${year}-${String(month).padStart(2, "0")}` : "";

export const mapFollowingQualificationsFromApi = (rows) =>
  (Array.isArray(rows) ? rows : []).map((q) => ({
    qualificationName: q.qualification_name || "",
    instituteName: q.institute_name || "",
    startMonth: toMonthInput(q.start_year, q.start_month),
    endMonth: toMonthInput(q.end_year, q.end_month),
    lectureType: q.lecture_type || "",
  }));

export const mapPreviousEmploymentsFromApi = (rows) =>
  (Array.isArray(rows) ? rows : []).map((p) => ({
    organizationName: p.organization_name || "",
    lastDesignation: p.last_designation || "",
    joinDate: p.join_date ? String(p.join_date).slice(0, 10) : "",
    lastDate: p.last_date ? String(p.last_date).slice(0, 10) : "",
    comments: p.comments || "",
  }));

export const EmployeeFormProvider = ({ children }) => {
  const [formData, setFormData] = useState(initialState);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load data from localStorage on initial render
  useEffect(() => {
    const loadData = () => {
      try {
        const savedData = localStorage.getItem("employeeFormData");
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          const documentsWithPreview =
            parsedData.documents?.map((doc) => ({
              ...doc,
              preview: null,
            })) || [];

          setFormData({
            ...parsedData,
            documents: documentsWithPreview,
            personal: {
              ...parsedData.personal,
              profilePicture: null,
            },
          });
        }
      } catch (error) {
        console.error("Error loading form data:", error);
      }
    };
    loadData();
  }, []);

  // Save to localStorage whenever formData changes
  useEffect(() => {
    const saveData = () => {
      try {
        const dataToSave = {
          ...formData,
          personal: {
            ...formData.personal,
            profilePicture: formData.personal.profilePicturePreview,
          },
          documents: formData.documents.map((doc) => ({
            ...doc,
            file: null,
            type: doc.type,
            name: doc.name,
            size: doc.size,
            status: doc.status,
          })),
        };

        localStorage.setItem("employeeFormData", JSON.stringify(dataToSave));
      } catch (error) {
        console.error("Error saving form data:", error);
      }
    };

    saveData();
  }, [formData]);

  const updateFormData = useCallback((section, data) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...data },
    }));
  }, []);

  const addDocuments = useCallback((files) => {
    const newDocs = Array.from(files).map((file) => ({
      file,
      type: "",
      preview: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null,
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
      status: "pending",
    }));

    setFormData((prev) => ({
      ...prev,
      documents: [...prev.documents, ...newDocs],
    }));
  }, []);

  const updateDocumentType = useCallback((index, type) => {
    setFormData((prev) => {
      const updatedDocs = [...prev.documents];
      updatedDocs[index] = { ...updatedDocs[index], type };
      return { ...prev, documents: updatedDocs };
    });
  }, []);

  const removeDocument = useCallback((index) => {
    setFormData((prev) => {
      const docToRemove = prev.documents[index];
      if (docToRemove?.preview) {
        URL.revokeObjectURL(docToRemove.preview);
      }
      return {
        ...prev,
        documents: prev.documents.filter((_, i) => i !== index),
      };
    });
  }, []);

  const clearForm = useCallback(() => {
    formData.documents.forEach((doc) => {
      if (doc?.preview) URL.revokeObjectURL(doc.preview);
    });
    setFormData(initialState);
    setErrors({});
    localStorage.removeItem("employeeFormData");
  }, [formData.documents]);

  const setFormErrors = useCallback((newErrors) => {
    setErrors(newErrors);
  }, []);

  const clearSectionErrors = useCallback((section) => {
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[section];
      return newErrors;
    });
  }, []);

  const clearFieldError = useCallback((section, field) => {
    setErrors((prev) => {
      if (!prev[section]) return prev;

      const newErrors = { ...prev };
      delete newErrors[section][field];

      if (Object.keys(newErrors[section]).length === 0) {
        delete newErrors[section];
      }

      return newErrors;
    });
  }, []);

  const loadEmployeeData = useCallback((employeeData) => {
    const org =
      employeeData.organization_assignment ||
      employeeData.organizationAssignment ||
      {};
    const companyId = org.company_id ?? org.company?.id ?? "";
    const departmentId = org.department_id ?? org.department?.id ?? "";
    const subDepartmentId = org.sub_department_id ?? org.sub_department?.id ?? "";
    const designationId = org.designation_id ?? org.designation?.id ?? "";

    // Trigger department loading for the employee's real company
    if (companyId) {
      window.dispatchEvent(new CustomEvent('loadDepartments', {
        detail: { companyId }
      }));
    }
    
    setFormData({
      personal: {
        id: employeeData.id || "",
        title: employeeData.title || "",
        attendanceEmpNo: employeeData.attendance_employee_no || "",
        epfNo: employeeData.epf || "",
        nicNumber: employeeData.nic || "",
        dob: employeeData.dob || "",
        gender: employeeData.gender ? (employeeData.gender.charAt(0).toUpperCase() + employeeData.gender.slice(1)) : "",
        religion: employeeData.religion || "",
        countryOfBirth: employeeData.country_of_birth || "",
        profilePicture: null,
        profilePicturePreview: employeeData.profile_photo_path && !employeeData.profile_photo_path.includes('fakepath') && !employeeData.profile_photo_path.startsWith('C:') && !employeeData.profile_photo_path.startsWith('c:')
          ? (employeeData.profile_photo_path.startsWith('http') ? employeeData.profile_photo_path : `${config.apiBaseUrl}/storage/${employeeData.profile_photo_path}`)
          : null,
        employmentStatus: employeeData.employment_type_id || "",
        nameWithInitial: employeeData.name_with_initials || "",
        fullName: employeeData.full_name || "",
        displayName: employeeData.display_name || "",
        maritalStatus: employeeData.marital_status ? (employeeData.marital_status.charAt(0).toUpperCase() + employeeData.marital_status.slice(1)) : "",
        relationshipType: employeeData.spouse?.type || "",
        spouseTitle: employeeData.spouse?.title || "",
        spouseName: employeeData.spouse?.name || "",
        spouseAge: employeeData.spouse?.age?.toString() || "",
        spouseDob: employeeData.spouse?.dob || "",
        spouseNic: employeeData.spouse?.nic || "",
        children: employeeData.children?.length > 0 
          ? employeeData.children.map(child => ({
              name: child.name || "",
              age: child.age?.toString() || "",
              dob: child.dob || "",
              nic: child.nic || ""
            }))
          : [{ name: "", age: "", dob: "", nic: "" }],
      },
      address: {
        permanentAddress: employeeData.contact_detail?.permanent_address || "",
        temporaryAddress: employeeData.contact_detail?.temporary_address || "",
        email: employeeData.contact_detail?.email || "",
        password: "",
        landLine: employeeData.contact_detail?.land_line || "",
        mobileLine: employeeData.contact_detail?.mobile_line || "",
        gnDivision: employeeData.contact_detail?.gn_division || "",
        policeStation: employeeData.contact_detail?.police_station || "",
        district: employeeData.contact_detail?.district || "",
        province: employeeData.contact_detail?.province || "",
        electoralDivision: employeeData.contact_detail?.electoral_division || "",
        emergencyContact: {
          relationship: employeeData.contact_detail?.emg_relationship || "",
          contactName: employeeData.contact_detail?.emg_name || "",
          contactAddress: employeeData.contact_detail?.emg_address || "",
          contactTel: employeeData.contact_detail?.emg_tel || "",
        },
      },
      compensation: {
        basicSalary: employeeData.compensation?.basic_salary || "",
        monthlyBonus: employeeData.compensation?.monthly_bonus ?? "",
        sportsFundPercentage: employeeData.compensation?.sports_fund_percentage ?? "",
        staffFundAmount: employeeData.compensation?.staff_fund_amount ?? "",
        incrementValue: employeeData.compensation?.increment_value || "",
        incrementEffectiveFrom: employeeData.compensation?.increment_effected_date || "",
        bankName: employeeData.compensation?.bank_name || "",
        branchName: employeeData.compensation?.branch_name || "",
        bankCode: employeeData.compensation?.bank_code || "",
        branchCode: employeeData.compensation?.branch_code || "",
        bankAccountNo: employeeData.compensation?.bank_account_no || "",
        accountHolderName: employeeData.compensation?.account_holder_name || "",
        comments: employeeData.compensation?.comments || "",
        secondaryEmp: toBool(employeeData.compensation?.secondary_emp ?? employeeData.compensation?.secondaryEmp),
        primaryEmploymentBasic: toBool(
          employeeData.compensation?.primary_emp_basic ??
          employeeData.compensation?.primary_employment_basic ??
          employeeData.compensation?.primaryEmploymentBasic
        ),
        enableEpfEtf: toBool(employeeData.compensation?.enable_epf_etf ?? employeeData.compensation?.enableEpfEtf),
        otActive: toBool(employeeData.compensation?.ot_active ?? employeeData.compensation?.otActive),
        otActiveSpecial: toBool(employeeData.compensation?.ot_active_special ?? employeeData.compensation?.otActiveSpecial),
        earlyDeduction: toBool(employeeData.compensation?.early_deduction ?? employeeData.compensation?.earlyDeduction),
        incrementActive: toBool(employeeData.compensation?.increment_active ?? employeeData.compensation?.incrementActive),
        nopayActive: toBool(
          employeeData.compensation?.active_nopay ??
          employeeData.compensation?.nopay_active ??
          employeeData.compensation?.nopayActive
        ),
        morningOt: toBool(employeeData.compensation?.ot_morning ?? employeeData.compensation?.morningOt),
        ot_morning_rate: employeeData.compensation?.ot_morning_rate || "0",
        ot_night_rate: employeeData.compensation?.ot_night_rate || "0",
        eveningOt: toBool(employeeData.compensation?.ot_evening ?? employeeData.compensation?.eveningOt),
        morningOtSpecial: toBool(employeeData.compensation?.ot_morning_special ?? employeeData.compensation?.morningOtSpecial),
        ot_morning_rate_special: "0",
        ot_night_rate_special: "0",
        eveningOtSpecial: toBool(employeeData.compensation?.ot_evening_special ?? employeeData.compensation?.eveningOtSpecial),
        budgetaryReliefAllowance2015: toBool(
          employeeData.compensation?.br1 ??
          employeeData.compensation?.budgetary_relief_allowance_2015 ??
          employeeData.compensation?.budgetaryReliefAllowance2015
        ),
        budgetaryReliefAllowance2016: toBool(
          employeeData.compensation?.br2 ??
          employeeData.compensation?.budgetary_relief_allowance_2016 ??
          employeeData.compensation?.budgetaryReliefAllowance2016
        ),
        stamp: toBool(employeeData.compensation?.stamp),
        paye_active: toBool(
          employeeData.compensation?.paye_active ?? employeeData.compensation?.payeActive,
          false
        ),
        holiday_processing: toBool(
          employeeData.compensation?.holiday_processing ?? employeeData.compensation?.holidayProcessing,
          false
        ),
        off_day_processing: toBool(
          employeeData.compensation?.off_day_processing ?? employeeData.compensation?.offDayProcessing,
          false
        ),
      },
      organization: {
        // Selects use id values — never put designation name in the designation field
        company: companyId === "" || companyId == null ? "" : String(companyId),
        department: departmentId === "" || departmentId == null ? "" : String(departmentId),
        subDepartment: subDepartmentId === "" || subDepartmentId == null ? "" : String(subDepartmentId),
        companyName: org.company?.name || "",
        companyCode: org.company?.company_code || "",
        departmentName: org.department?.name || "",
        subDepartmentName: org.sub_department?.name || "",
        location: org.location_id != null ? String(org.location_id) : "",
        locationName: org.location?.name || "",
        currentSupervisor: org.current_supervisor || "",
        dateOfJoined: org.date_of_joining || "",
        designation: designationId === "" || designationId == null ? "" : String(designationId),
        designationName: org.designation?.name || "",
        probationPeriod: !!org.probationary_period,
        trainingPeriod: !!org.training_period,
        contractPeriod: !!org.contract_period,
        probationFrom: org.probationary_period_from || "",
        probationTo: org.probationary_period_to || "",
        trainingFrom: org.training_period_from || "",
        trainingTo: org.training_period_to || "",
        contractFrom: org.contract_period_from || "",
        contractTo: org.contract_period_to || "",
        confirmationDate: org.confirmation_date || "",
        resignationDate: org.date_of_resigning || "",
        resignationLetter: null,
        resignationApproved: false,
        currentStatus: org.is_active ? 1 : 0,
        dayOff: org.day_off || "",
        employeeCategory: (() => {
          const raw = String(employeeData.compensation?.employee_category || "")
            .trim()
            .toLowerCase()
            .replace(/[_/]+/g, " ")
            .replace(/\s+/g, " ");
          if (!raw) return "Non-Executive";
          if (raw.includes("non") && raw.includes("executive")) return "Non-Executive";
          if (raw.includes("executive")) return "Executive";
          return "Non-Executive";
        })(),
      },
      qualifications: mapQualificationsFromApi(employeeData.qualifications),
      followingQualifications: mapFollowingQualificationsFromApi(employeeData.following_qualifications),
      previousEmployments: mapPreviousEmploymentsFromApi(employeeData.previous_employments),
      schoolResults: mapSchoolResultsFromApi(employeeData.school_result),
      documents: [],
    });
  }, []);

  return (
    <EmployeeFormContext.Provider
      value={{
        formData,
        updateFormData,
        setFormData,
        addDocuments,
        removeDocument,
        clearForm,
        isLoading,
        setIsLoading,
        errors,
        setFormErrors,
        clearSectionErrors,
        clearFieldError,
        isSubmitting,
        setIsSubmitting,
        updateDocumentType,
        loadEmployeeData,
      }}
    >
      {children}
    </EmployeeFormContext.Provider>
  );
};

export const useEmployeeForm = () => {
  const context = useContext(EmployeeFormContext);
  if (!context) {
    throw new Error(
      "useEmployeeForm must be used within an EmployeeFormProvider"
    );
  }
  return context;
};
