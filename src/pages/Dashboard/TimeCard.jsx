import React, { useState, useEffect, useRef } from 'react';
import { addTimeCard, fetchTimeCards } from '../../services/ApiDataService';
import timeCardService from '../../services/timeCardService';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import DatePickerInput from '@components/DatePickerInput';
import HikvisionDevicePanel from '@components/HikvisionDevicePanel';
import ZktecoDevicePanel from '@components/ZktecoDevicePanel';
import hikvisionService from '@services/hikvisionService';
import useAcl from '../../hooks/useAcl';

// Pagination component for better UI/UX
const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, page + 2);
  if (page <= 3) end = Math.min(5, totalPages);
  if (page >= totalPages - 2) start = Math.max(1, totalPages - 4);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex justify-center items-center gap-1 mt-4 select-none">
      <button
        className={`px-3 py-1 rounded-lg font-semibold transition-all duration-150 ${page === 1
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
          }`}
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        &larr; Prev
      </button>
      {start > 1 && <span className="px-2 text-gray-400">...</span>}
      {pages.map((p) => (
        <button
          key={p}
          className={`px-3 py-1 rounded-lg font-semibold transition-all duration-150 ${p === page
            ? 'bg-blue-600 text-white shadow'
            : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
            }`}
          onClick={() => onPageChange(p)}
          disabled={p === page}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      {end < totalPages && <span className="px-2 text-gray-400">...</span>}
      <button
        className={`px-3 py-1 rounded-lg font-semibold transition-all duration-150 ${page === totalPages
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
          }`}
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        Next &rarr;
      </button>
    </div>
  );
};

// ==============================================================================
// අලුතින් එකතු කළ කොටස: එකම දවසේ මැද තියෙන Punches අයින් කර, First සහ Last පමණක් තේරීම
// ==============================================================================
// ==============================================================================
// අලුතින් යාවත්කාලීන කළ කොටස: First IN සහ Last OUT පමණක් තේරීම (මැද IN/OUT අයින් කිරීම)
// ==============================================================================
const filterFirstInLastOut = (records) => {
  if (!Array.isArray(records)) return [];

  const grouped = {};
  records.forEach((rec) => {
    // සේවකයාගේ අංකය සහ දිනය අනුව ගෲප් කිරීම
    const key = `${rec.employee_id || rec.empNo}_${rec.date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  });

  const finalRecords = [];

  Object.values(grouped).forEach((group) => {
    // වෙලාව අනුව (time) ascending order එකට හැදීම
    group.sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    if (group.length === 1) {
      // දවසටම තියෙන්නේ එකම එක රෙකෝඩ් එකක් නම්, ඒක ගන්නවා
      finalRecords.push(group[0]);
      return;
    }

    // දවසේ පළවෙනියටම කරපු Punch එක (මේක ගොඩක් වෙලාවට IN එකක්)
    const firstPunch = group[0];
    finalRecords.push(firstPunch);

    // දවසේ තියෙන OUT Punches ටික විතරක් පෙරලා ගන්නවා
    const outPunches = group.filter(r =>
      r.entry === 2 || r.entry === '2' ||
      r.entry === 0 || r.entry === '0' ||
      ['OUT', 'EARLY OUT'].includes((r.status || '').toUpperCase())
    );

    // OUT Punches තියෙනවා නම්, ඒකෙන් අන්තිම OUT එක ගන්නවා
    if (outPunches.length > 0) {
      const lastOut = outPunches[outPunches.length - 1];
      // පළවෙනි Punch එකයි මේ අන්තිම OUT එකයි සමාන නැත්නම් විතරක් Add කරනවා
      if (lastOut.id !== firstPunch.id) {
        finalRecords.push(lastOut);
      }
    }
    // OUT එකක් නැතුව IN දෙක තුනක් විතරක් තිබ්බොත්, 
    // අර පළවෙනි IN එක විතරක් add වෙලා අනිත් IN ටික Main Table එකෙන් හැංගෙනවා!
  });

  return pairSameDayInOut(finalRecords);
};

const NEARBY_IN_OUT_MINUTES = 30;

function punchMinutes(time) {
  const parts = String(time || "")
    .trim()
    .split(":")
    .map((n) => Number(n));
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1] + (Number.isFinite(parts[2]) ? parts[2] / 60 : 0);
}

function isOutPunch(rec) {
  const entry = rec?.entry;
  const status = String(rec?.status || rec?.inOut || "").toUpperCase();
  return (
    entry === 2 ||
    entry === "2" ||
    entry === 0 ||
    entry === "0" ||
    status === "OUT" ||
    status === "EARLY OUT"
  );
}

/** One table row per employee/day: show IN and OUT together when both exist. */
function pairSameDayInOut(records) {
  if (!Array.isArray(records)) return [];

  const grouped = {};
  records.forEach((rec) => {
    const key = `${rec.employee_id || rec.empNo}_${rec.date}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(rec);
  });

  const rows = [];
  Object.values(grouped).forEach((group) => {
    group.sort((a, b) => String(a.time || "").localeCompare(String(b.time || "")));
    const ins = group.filter((r) => !isOutPunch(r));
    const outs = group.filter(isOutPunch);
    const inPunch = ins[0] || (!outs.length ? group[0] : null);
    const outPunch = outs.length ? outs[outs.length - 1] : null;

    if (inPunch && outPunch && inPunch.id !== outPunch.id) {
      const inMin = punchMinutes(inPunch.time);
      const outMin = punchMinutes(outPunch.time);
      const gap = inMin != null && outMin != null ? Math.abs(outMin - inMin) : null;
      rows.push({
        ...inPunch,
        inTime: inPunch.time,
        outTime: outPunch.time,
        time: `${inPunch.time || "—"} – ${outPunch.time || "—"}`,
        inOut: "IN/OUT",
        pairedOutId: outPunch.id,
        nearbyPair: gap != null && gap <= NEARBY_IN_OUT_MINUTES,
        pairMinutes: gap,
        status: inPunch.status === outPunch.status ? inPunch.status : `${inPunch.status} / ${outPunch.status}`,
      });
      return;
    }

    const only = inPunch || outPunch || group[0];
    rows.push({
      ...only,
      inTime: isOutPunch(only) ? "" : only.time,
      outTime: isOutPunch(only) ? only.time : "",
      nearbyPair: false,
      pairMinutes: null,
    });
  });

  return rows.sort((a, b) => {
    if (a.date !== b.date) return new Date(b.date) - new Date(a.date);
    const emp = String(a.empNo || "").localeCompare(String(b.empNo || ""));
    if (emp !== 0) return emp;
    return String(a.time || "").localeCompare(String(b.time || ""));
  });
}
// ==============================================================================
// ==============================================================================

const TimeCard = ({ employeeProfile }) => {
  const { canEdit, canDelete } = useAcl('TimeCard');
  // Form state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [importMethod, setImportMethod] = useState('excel');
  const [filterOption, setFilterOption] = useState('all');
  const [department, setDepartment] = useState('');
  const [nic, setNic] = useState('');
  const [nicError, setNicError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Table data state
  const [attendanceData, setAttendanceData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editInTime, setEditInTime] = useState('');
  const [editOutTime, setEditOutTime] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEntry, setEditEntry] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentees, setAbsentees] = useState([]);
  const [absentSearch, setAbsentSearch] = useState('');
  const [absentLoading, setAbsentLoading] = useState(false);
  const [absentDate, setAbsentDate] = useState('');

  // Pagination state for absentees modal
  const [absentPage, setAbsentPage] = useState(1);
  const rowsPerPage = 6;
  const paginatedAbsentees = absentees.slice(
    (absentPage - 1) * rowsPerPage,
    absentPage * rowsPerPage
  );
  const totalAbsentPages = Math.ceil(absentees.length / rowsPerPage);

  // Attendance table pagination state
  const [attendancePage, setAttendancePage] = useState(1);
  const attendanceRowsPerPage = 8;
  const paginatedAttendance = filteredData.slice(
    (attendancePage - 1) * attendanceRowsPerPage,
    attendancePage * attendanceRowsPerPage
  );
  const totalAttendancePages = Math.ceil(filteredData.length / attendanceRowsPerPage);

  // ADD: guard to prevent pagination reset when refreshing after edit/save
  const preventPaginationReset = useRef(false);

  useEffect(() => {
    setAbsentPage(1);
  }, [absentees]);

  // CHANGE: only reset to first page when not prevented
  useEffect(() => {
    if (preventPaginationReset.current) {
      // keep current page, then clear the guard
      preventPaginationReset.current = false;
      return;
    }
    setAttendancePage(1);
  }, [filteredData]);

  // Handler to open modal and fetch all absentees (with date filter)
  const handleShowAbsentees = async () => {
    setShowAbsentModal(true);
    setAbsentLoading(true);
    try {
      const data = await timeCardService.fetchAbsentees({ date: absentDate, search: absentSearch });
      setAbsentees(data);
    } catch {
      setAbsentees([]);
    }
    setAbsentLoading(false);
  };

  // Handler for date change
  const handleAbsentDateChange = async (e) => {
    const newDate = e.target.value;
    setAbsentDate(newDate);
    setAbsentLoading(true);
    try {
      const data = await timeCardService.fetchAbsentees({ date: newDate, search: absentSearch });
      setAbsentees(data);
    } catch {
      setAbsentees([]);
    }
    setAbsentLoading(false);
  };

  // Handler for search
  const handleAbsentSearch = async (e) => {
    const value = e.target.value;
    setAbsentSearch(value);
    setAbsentLoading(true);
    try {
      const data = await timeCardService.fetchAbsentees({ date: absentDate, search: value });
      setAbsentees(data);
    } catch {
      setAbsentees([]);
    }
    setAbsentLoading(false);
  };

  // Add new record modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    empNo: '',
    name: '',
    time: '',
    date: '',
    entry: '',
    department: '',
    status: '',
  });
  // Inline validation errors for Add New modal
  const [addErrors, setAddErrors] = useState({});

  // Import Data section toggle state
  const [showImport, setShowImport] = useState(true);

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedToDate, setSelectedToDate] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  // ref to clear the native file input after import
  const excelInputRef = useRef(null);

  // debounce ref for backend search
  const searchDebounceRef = useRef(null);

  // Fetch data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      if (employeeProfile?.attendance_employee_no) {
        // Employee view — load only their records
        try {
          const data = await timeCardService.searchEmployeeTimeCards(employeeProfile.attendance_employee_no);
          const arr = Array.isArray(data) ? data : [];
          const filtered = filterFirstInLastOut(arr);
          setAttendanceData(filtered);
          setFilteredData(filtered);
        } catch (e) {
          console.error(e);
        }
      } else {
        const data = await fetchTimeCards();
        const filtered = filterFirstInLastOut(data);
        setAttendanceData(filtered);
        setFilteredData(filtered);
      }
      setIsLoading(false);
    };
    loadData();
  }, [employeeProfile]);

  // Fetch companies from backend (example)
  useEffect(() => {
    const fetchCompanies = async () => {
      const data = await timeCardService.fetchCompanies();
      setCompanies(data);
    };
    fetchCompanies();
  }, []);

  // Filter helpers
  const filterAttendance = (statusFilter = null) => {
    let filtered = attendanceData;

    if (filterOption === 'employee' && employeeSearch) {
      filtered = filtered.filter(
        (rec) =>
          (rec.nic && rec.nic.toLowerCase().includes(employeeSearch.toLowerCase())) ||
          (rec.empNo && rec.empNo.toLowerCase().includes(employeeSearch.toLowerCase()))
      );
    }
    if (filterOption === 'department' && department) {
      filtered = filtered.filter((rec) => rec.department === department);
    }
    if (filterDate) {
      filtered = filtered.filter((rec) => rec.date === filterDate);
    }
    if (dateFrom) {
      filtered = filtered.filter((rec) => rec.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((rec) => rec.date <= dateTo);
    }
    if (statusFilter) {
      filtered = filtered.filter((rec) => rec.status === statusFilter);
    }
    return filtered;
  };

  const handleProcess = async () => {
    if (!dateFrom || !dateTo) {
      Swal.fire({
        icon: 'warning',
        title: 'Select date range',
        text: 'Please select both From Date and To Date, then click Process.',
      });
      return;
    }
    if (dateFrom > dateTo) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid range',
        text: 'From Date cannot be after To Date.',
      });
      return;
    }

    setIsLoading(true);
    setFilterDate('');
    try {
      let data = await fetchTimeCards({ from_date: dateFrom, to_date: dateTo });
      if (!Array.isArray(data)) data = [];
      data = filterFirstInLastOut(data);
      setAttendanceData(data);

      let filtered = data;
      if (filterOption === 'employee' && employeeSearch) {
        const q = employeeSearch.toLowerCase();
        filtered = filtered.filter(
          (rec) =>
            (rec.nic && rec.nic.toLowerCase().includes(q)) ||
            (rec.empNo && rec.empNo.toLowerCase().includes(q)) ||
            (rec.name && rec.name.toLowerCase().includes(q))
        );
      }
      setFilteredData(filtered);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Load failed',
        text: e.response?.data?.message || e.message || 'Could not load time cards.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    setFilteredData(filterAttendance('Early OUT'));
  };

  // Cancel handler for filters
  const handleCancel = () => {
    setDateFrom('');
    setDateTo('');
    setDepartment('');
    setFilterDate('');
    // clear employee search when cancelling filters
    setEmployeeSearch('');
    setFilteredData(attendanceData);
  };

  // Handle delete
  const handleDelete = async (record) => {
    if (!record || !record.id) {
      Swal.fire({ icon: 'error', title: 'Delete failed', text: 'Record ID not found.' });
      return;
    }
    const confirm = await Swal.fire({
      title: 'Delete time card entry?',
      text: 'A reason is required. This is recorded on the deleted-entry report.',
      input: 'textarea',
      inputPlaceholder: 'Reason for deleting this entry',
      inputValidator: (value) => {
        if (!value || value.trim().length < 3) {
          return 'Please enter a reason (at least 3 characters).';
        }
        return undefined;
      },
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Delete',
    });
    if (confirm.isConfirmed) {
      try {
        await timeCardService.deleteTimeCard(record.id, confirm.value.trim());

        preventPaginationReset.current = true;

        const updated = await fetchTimeCards();
        const filtered = filterFirstInLastOut(updated); // මැද ඒවා අයින් කරලා First/Last විතරක් ගත්තා
        setAttendanceData(filtered);
        setFilteredData(filtered);

        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1200, showConfirmButton: false });
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Delete failed', text: e.response?.data?.message || e.message });
      }
    }
  };

  // Handle edit open
  const handleEdit = (record, index) => {
    console.log('Editing record:', record); // Debug log

    setEditRecord({ ...record, index });

    // Set date - ensure proper format for date input (YYYY-MM-DD)
    const formattedDate = record.date ? new Date(record.date).toISOString().split('T')[0] : '';
    setEditDate(formattedDate);

    // Set entry based on record data
    setEditEntry(record.entry || '');

    // Set status - handle both string and numeric entry values
    let statusValue = record.status || '';
    if (!statusValue) {
      // Derive status from entry if status is missing
      if (record.entry === '1' || record.entry === 1) {
        statusValue = 'IN';
      } else if (record.entry === '2' || record.entry === 2) {
        statusValue = 'OUT';
      }
    }
    setEditStatus(statusValue);

    // Set time based on status and inOut field
    const timeValue = record.time || '';
    if (record.inOut === 'IN' || statusValue === 'IN') {
      setEditInTime(timeValue);
      setEditOutTime(''); // Clear out time for IN records
    } else if (record.inOut === 'OUT' || statusValue === 'OUT') {
      setEditOutTime(timeValue);
      setEditInTime(''); // Clear in time for OUT records
    } else {
      // For other statuses, set both to the same time
      setEditInTime(timeValue);
      setEditOutTime(timeValue);
    }

    setShowEditModal(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    try {
      // Validate required fields
      if (!editDate) {
        alert('Date is required');
        return;
      }
      if (!editStatus) {
        alert('Status is required');
        return;
      }

      // Determine the time to send based on status
      let timeToSend = '';
      if (editStatus === 'IN') {
        timeToSend = editInTime;
      } else if (editStatus === 'OUT' || editStatus === 'Early OUT') {
        timeToSend = editOutTime;
      } else if (editStatus === 'Absent') {
        timeToSend = '00:00:00'; // Default time for absent records
      }

      // Validate time for non-absent records
      if (editStatus !== 'Absent' && !timeToSend) {
        alert('Time is required for this status');
        return;
      }

      // Ensure time is in HH:MM:SS format
      if (timeToSend && !timeToSend.includes(':')) {
        alert('Please enter a valid time');
        return;
      }

      const reasonPrompt = await Swal.fire({
        title: 'Adjustment reason',
        input: 'textarea',
        inputPlaceholder: 'Why is this time card being corrected?',
        showCancelButton: true,
        confirmButtonText: 'Save',
      });
      if (!reasonPrompt.isConfirmed) return;

      const payload = {
        date: editDate,
        time: formatTimeForBackend(timeToSend),
        entry: editEntry,
        status: editStatus,
        remarks: (editRecord.remarks || '').trim(),
        reason: (reasonPrompt.value || 'Time card adjusted from Time Card screen').trim(),
      };

      console.log('Saving payload:', payload); // Debug log

      await timeCardService.updateTimeCard(editRecord.id, payload);

      // Refresh data
      const updated = await fetchTimeCards();
      const filtered = filterFirstInLastOut(updated); // මැද ඒවා අයින් කරලා First/Last විතරක් ගත්තා

      // PREVENT resetting to page 1 on this refresh
      preventPaginationReset.current = true;
      setAttendanceData(filtered);
      setFilteredData(filtered);

      // Close modal
      setShowEditModal(false);

      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Attendance record updated successfully.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error('Error updating record:', e);
      const errorMessage = e.response?.data?.message || e.message || 'Failed to update attendance record';

      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: errorMessage,
      });
    }
  };

  const handleAddNew = async () => {
    if (!nic) {
      setNicError('NIC is required');
      return;
    }
    setIsLoading(true);
    setNicError('');
    setAddErrors({});

    // Get employee info
    let employee;
    try {
      employee = await timeCardService.fetchEmployeeByNic(nic);
    } catch {
      setNicError('Employee not found');
      setIsLoading(false);
      return;
    }

    // Validate fields
    const errs = {};
    if (!newRecord.date) errs.date = 'Date is required';
    if (!newRecord.status) errs.status = 'Status is required';
    if (!newRecord.entry) errs.entry = 'Entry will be auto-filled after selecting a Status';
    if (!newRecord.time) errs.time = 'Time is required';

    if (Object.keys(errs).length > 0) {
      setAddErrors(errs);
      setIsLoading(false);
      return;
    }

    const payload = {
      employee_id: employee.id,
      time: newRecord.time,
      date: newRecord.date,
      entry: newRecord.entry,
      status: newRecord.status,
      remarks: (newRecord.remarks || '').trim(),
    };

    try {
      // Add the record
      await addTimeCard(payload);
      // Get updated data
      const updated = await fetchTimeCards();
      const filtered = filterFirstInLastOut(updated); // මැද ඒවා අයින් කරලා First/Last විතරක් ගත්තා

      // Set data first
      setAttendanceData(filtered);
      setFilteredData(filtered);

      // Find the new record with more flexible matching
      let newRecordIndex = filtered.findIndex(record => {
        return (
          // Match by employee info - could be different formats
          (record.empNo === employee.attendance_employee_no ||
            record.employee_id === employee.id) &&
          // Match by date
          record.date === newRecord.date &&
          // Match by approximate time (in case of formatting differences)
          record.time?.includes(newRecord.time.substring(0, 4))
        );
      });

      console.log("Found new record at index:", newRecordIndex);

      if (newRecordIndex !== -1) {
        // Calculate which page contains the new record
        const pageWithNewRecord = Math.floor(newRecordIndex / attendanceRowsPerPage) + 1;
        console.log("Setting page to:", pageWithNewRecord);

        // Use setTimeout to ensure this happens after state updates
        setTimeout(() => {
          setAttendancePage(pageWithNewRecord);
        }, 10);
      }

      setShowAddModal(false);
      clearAddModalFields();

      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Attendance record added and sent to Time Card Approval (Pending).',
        timer: 1800,
        showConfirmButton: false,
      });
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to add attendance record';
      setNicError(msg);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: msg,
      });
    }
    setIsLoading(false);
  };

  // Clear fields helper for Add New modal
  const clearAddModalFields = () => {
    setNic('');
    setNicError('');
    setAddErrors({});
    setNewRecord({
      empNo: '',
      name: '',
      time: '',
      date: '',
      entry: '',
      department: '',
      status: '',
    });
  };

  // Cancel handler for Add New modal: clear fields if any data present, then close
  const handleAddModalCancel = () => {
    const hasData =
      nic ||
      newRecord.empNo ||
      newRecord.name ||
      newRecord.time ||
      newRecord.date ||
      newRecord.entry ||
      newRecord.status;
    if (hasData) clearAddModalFields();
    setShowAddModal(false);
  };

  const handleNicBlur = async () => {
    if (!nic) return;
    setNicError('');
    try {
      const emp = await timeCardService.fetchEmployeeByNic(nic);
      if (emp && emp.attendance_employee_no && emp.full_name) {
        setNewRecord((prev) => ({
          ...prev,
          empNo: emp.attendance_employee_no,
          name: emp.full_name,
          department: emp.department || '',
        }));
      } else {
        setNicError('Employee not found for this NIC');
        setNewRecord((prev) => ({
          ...prev,
          empNo: '',
          name: '',
          department: '',
        }));
      }
    } catch {
      setNicError('Employee not found for this NIC');
      setNewRecord((prev) => ({
        ...prev,
        empNo: '',
        name: '',
        department: '',
      }));
    }
  };

  useEffect(() => {
    if (filterOption !== 'employee') setEmployeeSearch('');
  }, [filterOption]);

  useEffect(() => {
    // Only run when "Filter by Employee" is active
    if (filterOption !== 'employee') {
      // When switched away, restore attendanceData (but respect date filters)
      if (filterDate || dateFrom || dateTo) {
        let data = [...attendanceData];
        if (filterDate) data = data.filter((rec) => rec.date === filterDate);
        if (dateFrom) data = data.filter((rec) => rec.date >= dateFrom);
        if (dateTo) data = data.filter((rec) => rec.date <= dateTo);
        setFilteredData(data);
      } else {
        setFilteredData(attendanceData);
      }
      return;
    }

    const term = (employeeSearch || '').trim();

    // empty search -> show base attendance data (with date filters applied)
    if (!term) {
      let data = [...attendanceData];
      if (filterDate) data = data.filter((rec) => rec.date === filterDate);
      if (dateFrom) data = data.filter((rec) => rec.date >= dateFrom);
      if (dateTo) data = data.filter((rec) => rec.date <= dateTo);
      setFilteredData(data);
      setIsLoading(false);
      return;
    }

    // If the user types only digits, do immediate client-side filtering (instant number-by-number)
    if (/^\d+$/.test(term)) {
      setIsLoading(false);
      const filtered = attendanceData.filter((rec) => {
        const empNo = (rec.empNo || '').toString().toLowerCase();
        const epf = (rec.epf || '').toString().toLowerCase();
        const nicVal = (rec.nic || '').toLowerCase();
        return (
          empNo.includes(term.toLowerCase()) ||
          epf.includes(term.toLowerCase()) ||
          nicVal.includes(term.toLowerCase())
        );
      }).filter((rec) => {
        if (filterDate && rec.date !== filterDate) return false;
        if (dateFrom && rec.date < dateFrom) return false;
        if (dateTo && rec.date > dateTo) return false;
        return true;
      });
      setFilteredData(filtered);
      return;
    }

    // For non-numeric or mixed input, call backend but debounce requests
    setIsLoading(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await timeCardService.searchEmployeeTimeCards(term);
        let results = Array.isArray(data) ? data : [];
        results = filterFirstInLastOut(results); // මැද ඒවා අයින් කරලා First/Last විතරක් ගත්තා

        // apply local date filters if backend doesn't support them
        if (filterDate || dateFrom || dateTo) {
          results = results.filter((rec) => {
            if (filterDate && rec.date !== filterDate) return false;
            if (dateFrom && rec.date < dateFrom) return false;
            if (dateTo && rec.date > dateTo) return false;
            return true;
          });
        }
        setFilteredData(results);
      } catch {
        setFilteredData([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [employeeSearch, filterOption, filterDate, dateFrom, dateTo, attendanceData]);

  const handleExcelUpload = (e) => {
    setExcelFile(e.target.files[0]);
  };

  const handleImportExcel = async () => {
    if (!excelFile) {
      Swal.fire({ icon: 'error', title: 'No file selected', text: 'Please select an Excel file.' });
      return;
    }
    if (!selectedDate) {
      Swal.fire({ icon: 'error', title: 'Missing From Date', text: 'Please select a From Date.' });
      return;
    }
    // NEW: require To Date too
    if (!selectedToDate) {
      Swal.fire({ icon: 'error', title: 'Missing To Date', text: 'Please select a To Date.' });
      return;
    }
    // Ensure To Date is not before From Date
    if (selectedToDate < selectedDate) {
      Swal.fire({ icon: 'error', title: 'Invalid Date Range', text: 'To Date cannot be before From Date.' });
      return;
    }

    setIsLoading(true);

    try {
      if (importMethod === 'hikvision') {
        if (!selectedCompany) {
          Swal.fire({ icon: 'error', title: 'Company required', text: 'Select a company for Hikvision import.' });
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', excelFile);
        formData.append('company_id', String(selectedCompany));
        formData.append('from_date', selectedDate);
        formData.append('to_date', selectedToDate);

        const res = await hikvisionService.importExcel(formData);
        const data = res.data || res;

        Swal.fire({
          icon: 'success',
          title: 'Hikvision Import Completed',
          html: `
            <div>
              <p>Imported: <b>${data.imported ?? 0}</b></p>
              <p>Skipped: <b>${data.skipped ?? 0}</b></p>
              ${data.errors?.length ? `<p class="text-red-600 text-left text-sm mt-2">${data.errors.slice(0, 8).join('<br>')}</p>` : ''}
            </div>
          `
        });

        const updated = await fetchTimeCards();
        const filtered = filterFirstInLastOut(updated);
        setAttendanceData(filtered);
        setFilteredData(filtered);
        setSelectedCompany('');
        setSelectedDate('');
        setSelectedToDate('');
        setExcelFile(null);
        if (excelInputRef.current) excelInputRef.current.value = '';
        setIsLoading(false);
        return;
      }

      if (importMethod === 'reland') {
        if (!selectedCompany) {
          Swal.fire({ icon: 'error', title: 'Company required', text: 'Select a company for Reland import.' });
          setIsLoading(false);
          return;
        }
        const company = companies.find((c) => String(c.id) === String(selectedCompany));
        const relandOn = !!(company?.process_config?.reland_excel_import?.enabled ?? company?.process_config?.reland_excel_import);
        if (!relandOn) {
          Swal.fire({
            icon: 'error',
            title: 'Reland import is off',
            text: 'Enable Reland fingerprint Excel import for this company in Cybernetic Admin.',
          });
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('file', excelFile);
        formData.append('company_id', String(selectedCompany));
        formData.append('from_date', selectedDate);
        formData.append('to_date', selectedToDate);

        const data = await timeCardService.importRelandExcel(formData);

        const imported = data.imported ?? data.data?.imported ?? 0;
        const skipped = data.skipped ?? data.data?.skipped ?? 0;
        const errors = data.errors || data.data?.errors || [];
        Swal.fire({
          icon: imported > 0 ? 'success' : 'warning',
          title: imported > 0 ? 'Reland Import Completed' : 'No punches saved',
          html: `
            <div>
              <p>Imported: <b>${imported}</b></p>
              <p>Skipped: <b>${skipped}</b></p>
              ${errors.length ? `<p class="text-red-600 text-left text-sm mt-2">${errors.slice(0, 10).join('<br>')}</p>` : ''}
            </div>
          `
        });

        const updated = await fetchTimeCards();
        const filtered = filterFirstInLastOut(updated);
        setAttendanceData(filtered);
        setFilteredData(filtered);
        setSelectedCompany('');
        setSelectedDate('');
        setSelectedToDate('');
        setExcelFile(null);
        if (excelInputRef.current) excelInputRef.current.value = '';
        setIsLoading(false);
        return;
      }

      // Read the Excel file client-side using FileReader and SheetJS
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          const headerLine = (jsonData[0] || []).map((h) => String(h || '').toLowerCase()).join(' ');
          const isReland = /user id|enroll id|att type|verify mode/.test(headerLine);

          if (isReland) {
            if (!selectedCompany) {
              Swal.fire({ icon: 'error', title: 'Company required', text: 'Select the company for this Reland file.' });
              setIsLoading(false);
              return;
            }
            const formData = new FormData();
            formData.append('file', excelFile);
            formData.append('company_id', String(selectedCompany));
            formData.append('from_date', selectedDate);
            formData.append('to_date', selectedToDate);
            const relandRes = await timeCardService.importRelandExcel(formData);
            const imported = relandRes.imported ?? relandRes.data?.imported ?? 0;
            const skipped = relandRes.skipped ?? relandRes.data?.skipped ?? 0;
            const errors = relandRes.errors || relandRes.data?.errors || [];
            Swal.fire({
              icon: imported > 0 ? 'success' : 'warning',
              title: imported > 0 ? 'Reland Import Completed' : 'No punches saved',
              html: `
                <div>
                  <p>Imported: <b>${imported}</b></p>
                  <p>Skipped: <b>${skipped}</b></p>
                  ${errors.length ? `<p class="text-red-600 text-left text-sm mt-2">${errors.slice(0, 10).join('<br>')}</p>` : ''}
                  ${imported === 0 ? '<p class="text-left text-sm mt-2">Reland User ID must match the employee attendance number.</p>' : ''}
                </div>
              `
            });
            const updated = await fetchTimeCards();
            const filtered = filterFirstInLastOut(updated);
            setAttendanceData(filtered);
            setFilteredData(filtered);
            setExcelFile(null);
            if (excelInputRef.current) excelInputRef.current.value = '';
            setIsLoading(false);
            return;
          }

          // Skip header row and map data to structured format
          const records = jsonData.slice(1).map(row => ({
            nic: row[0]?.toString() || '',
            date: row[1]?.toString() || '',
            time: row[2]?.toString() || '',
            entry: row[3]?.toString() || '',
            status: row[4]?.toString() || '',
            reason: row[5]?.toString() || ''
          }));

          // Filter out empty rows
          const validRecords = records.filter(r => r.nic && (r.date || r.status === 'Absent'));

          if (validRecords.length === 0) {
            Swal.fire({ icon: 'error', title: 'No valid data', text: 'No valid records found in Excel file.' });
            setIsLoading(false);
            return;
          }

          // Build payload expected by service
          const payload = {
            company_id: selectedCompany || undefined,
            from_date: selectedDate,
            to_date: selectedToDate,
            records: validRecords,
            file: excelFile
          };

          // Use importExcelData which builds FormData on the service side
          const res = await timeCardService.importExcelData(payload);

          Swal.fire({
            icon: 'success',
            title: 'Import Completed',
            html: `
              <div>
                <p>Imported: <b>${res.imported}</b></p>
                <p>Absent: <b>${res.absent}</b></p>
                ${res.errors?.length ? `<p class="text-red-600">Errors:<br>${res.errors.join('<br>')}</p>` : ''}
              </div>
            `
          });

          const updated = await fetchTimeCards();
          const filtered = filterFirstInLastOut(updated); // මැද ඒවා අයින් කරලා First/Last විතරක් ගත්තා
          setAttendanceData(filtered);
          setFilteredData(filtered);

          setSelectedCompany('');
          setSelectedDate('');
          setSelectedToDate('');
          setExcelFile(null);
          if (excelInputRef.current) excelInputRef.current.value = '';
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          // Prefer backend validation messages when available (422) and show them to user
          const backendMessage = error?.response?.data?.message;
          const backendErrors = error?.response?.data?.errors;
          let message = error.message || 'Import failed';
          if (backendMessage) {
            message = backendMessage;
          } else if (backendErrors) {
            if (Array.isArray(backendErrors)) message = backendErrors.join('\n');
            else if (typeof backendErrors === 'object')
              message = Object.values(backendErrors).flat().join('\n');
          }
          Swal.fire({
            icon: 'error',
            title: 'Import failed',
            text: message,
          });
        } finally {
          setIsLoading(false);
        }
      };

      reader.onerror = (error) => {
        console.error("File reading error:", error);
        Swal.fire({
          icon: 'error',
          title: 'Import failed',
          text: 'Error reading file: ' + error.message
        });
        setIsLoading(false);
      };

      // Start reading the file
      reader.readAsArrayBuffer(excelFile);

    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Import failed',
        text: e.message || 'An unexpected error occurred'
      });
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await timeCardService.downloadTemplate();
    } catch (error) {
      alert(error.message);
    }
  };

  // Helper function to format time consistently
  const formatTimeForBackend = (timeStr) => {
    if (!timeStr) return '';

    // If already in HH:MM:SS format, return as is
    if (timeStr.split(':').length === 3) {
      return timeStr;
    }

    // If in HH:MM format, add seconds
    if (timeStr.split(':').length === 2) {
      return timeStr + ':00';
    }

    return timeStr;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
              Time Card Management
            </h1>
            <p className="text-slate-300 text-center mt-2 text-sm sm:text-base">
              Employee Attendance & Time Tracking System
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">

            <HikvisionDevicePanel companies={companies} />
            <ZktecoDevicePanel companies={companies} />

            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <button
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-md font-semibold shadow transition-all duration-200 ${showImport
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-blue-700 hover:bg-blue-100'
                    }`}
                  onClick={() => setShowImport((v) => !v)}
                  aria-expanded={showImport}
                >
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${showImport ? 'rotate-0' : 'rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showImport ? 'Hide Import Data' : 'Show Import Data'}
                </button>
              </div>
              <div>
                <button
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md font-semibold shadow transition-all duration-200 bg-green-600 text-white hover:bg-green-700"
                  onClick={handleDownloadTemplate}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export Template
                </button>
              </div>
            </div>
            {showImport && (
              <div className="mt-6 p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Company</label>
                    <select
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={selectedCompany}
                      onChange={e => setSelectedCompany(e.target.value)}
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">From Date <span className="text-red-500">*</span></label>
                    <DatePickerInput
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">To Date <span className="text-red-500">*</span></label>
                    <DatePickerInput
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={selectedToDate}
                      onChange={e => setSelectedToDate(e.target.value)}
                      min={selectedDate || undefined}
                      required
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-4">Import Method</label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                    <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-blue-100 transition-colors duration-200">
                      <input
                        type="radio"
                        className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        checked={importMethod === 'excel'}
                        onChange={() => setImportMethod('excel')}
                      />
                      <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">HR Template Excel</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-blue-100 transition-colors duration-200">
                      <input
                        type="radio"
                        className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        checked={importMethod === 'hikvision'}
                        onChange={() => setImportMethod('hikvision')}
                      />
                      <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">iVMS-4200 / Hik-Connect Export</span>
                    </label>
                    <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-blue-100 transition-colors duration-200">
                      <input
                        type="radio"
                        className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        checked={importMethod === 'reland'}
                        onChange={() => setImportMethod('reland')}
                      />
                      <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">Reland Raw Clock-InOut Log</span>
                    </label>
                  </div>
                  {(importMethod === 'excel' || importMethod === 'hikvision' || importMethod === 'reland') && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Excel File</label>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm"
                        onChange={handleExcelUpload}
                        ref={excelInputRef}
                      />
                      {importMethod === 'reland' && (
                        <p className="mt-2 text-xs text-slate-500">
                          Use Reland export: Dept, User ID, Name, Enroll ID, Device ID, Place, Date, Time, Att Type. First punch of the day is IN, next is OUT. Reland User ID must match attendance number.
                        </p>
                      )}
                      <button
                        className="mt-3 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg"
                        onClick={handleImportExcel}
                      >
                        Import {importMethod === 'hikvision' ? 'Hikvision Excel' : importMethod === 'reland' ? 'Reland Excel' : 'Excel'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mb-8"></div>

            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-br from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm">
              <div className="flex items-center mb-4 sm:mb-6">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800">Filter Options</h2>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-4">Filter By</label>
                <div className="flex flex-col sm:flex-row lg:flex-row gap-3">
                  <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-emerald-100 transition-colors duration-200">
                    <input
                      type="radio"
                      className="form-radio h-5 w-5 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                      checked={filterOption === 'all'}
                      onChange={() => setFilterOption('all')}
                    />
                    <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">All Fingerprints</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-emerald-100 transition-colors duration-200">
                    <input
                      type="radio"
                      className="form-radio h-5 w-5 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                      checked={filterOption === 'employee'}
                      onChange={() => setFilterOption('employee')}
                    />
                    <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">Filter by Employee</span>
                  </label>

                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {filterOption === 'employee' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Search by NIC/EPF/EMP Attendance Number</label>
                    <input
                      type="text"
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder="Enter NIC/EPF/EMP Attendance number"
                    />
                  </div>
                )}


                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">From Date</label>
                  <DatePickerInput
                    className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                    value={dateFrom}
                    onChange={e => {
                      const v = e.target.value;
                      setDateFrom(v);
                      setFilterDate('');
                      if (dateTo && v && dateTo < v) setDateTo(v);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">To Date</label>
                  <DatePickerInput
                    className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={e => {
                      setDateTo(e.target.value);
                      setFilterDate('');
                    }}
                  />
                </div>
              </div>
            </div>


            <div className="flex flex-wrap justify-end gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={handleProcess}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Process'}
              </button>
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-indigo-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={async () => {
                  if (!dateFrom || !dateTo) {
                    Swal.fire({ icon: 'warning', title: 'Select date range', text: 'From Date and To Date are required to recalculate.' });
                    return;
                  }
                  const ask = await Swal.fire({
                    title: 'Recalculate attendance?',
                    html: `Rebuild Early OUT / OUT / Late Coming using current active roster for <b>${dateFrom}</b> to <b>${dateTo}</b>.`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Yes, recalculate',
                  });
                  if (!ask.isConfirmed) return;
                  setIsLoading(true);
                  try {
                    const result = await timeCardService.recalculateAttendance({
                      from_date: dateFrom,
                      to_date: dateTo,
                    });
                    await handleProcess();
                    Swal.fire({
                      icon: 'success',
                      title: 'Recalculation complete',
                      html: `Updated <b>${result.updated ?? 0}</b> punch(es).`,
                    });
                  } catch (e) {
                    Swal.fire({
                      icon: 'error',
                      title: 'Recalculation failed',
                      text: e.response?.data?.message || e.message,
                    });
                  } finally {
                    setIsLoading(false);
                  }
                }}
                disabled={isLoading}
              >
                Recalculate
              </button>
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
                onClick={handleCancel}
              >
                Cancel
              </button>

              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={handleShowAbsentees}
              >
                Mark Absentees
              </button>
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={handleLeave}
              >
                Early OUT
              </button>
            </div>


            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
              <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">Attendance Records</h3>
                  </div>
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold shadow hover:bg-green-700 transition"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add New
                  </button>
                </div>
              </div>
              {isLoading ? (
                <div className="p-8 sm:p-12 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
                  <p className="mt-6 text-slate-600 font-medium text-sm sm:text-base">Loading attendance data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-slate-100 border-b-2 border-gray-200">
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">EMP NO</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Name</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Fingerprint Clock</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">IN</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">OUT</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Date</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Entry</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Status</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAttendance.length > 0 ? (
                        paginatedAttendance.map((record, index) => (
                          <tr key={record.id || index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} ${record.nearbyPair ? 'bg-amber-50/80 hover:bg-amber-50' : 'hover:bg-blue-50/50'} transition-colors duration-200 border-b border-gray-100`}>
                            <td className="py-4 px-3 sm:px-6 font-semibold text-slate-700 text-xs sm:text-sm lg:text-base">{record.empNo}</td>
                            <td className="py-4 px-3 sm:px-6 font-medium text-slate-800 text-xs sm:text-sm lg:text-base">{record.name}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-600 text-xs sm:text-sm lg:text-base">{record.fingerprintClock}</td>
                            <td className="py-4 px-3 sm:px-6 text-emerald-800 font-mono text-xs sm:text-sm lg:text-base">{record.inTime || '—'}</td>
                            <td className="py-4 px-3 sm:px-6 text-rose-800 font-mono text-xs sm:text-sm lg:text-base">{record.outTime || '—'}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-600 text-xs sm:text-sm lg:text-base">{record.date}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-700 font-bold text-xs sm:text-sm lg:text-base">{record.pairedOutId ? '1 / 2' : record.entry}</td>
                            <td className="py-4 px-3 sm:px-6">
                              <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-sm border ${record.status === 'Absent'
                                ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200'
                                : record.status === 'Early OUT'
                                  ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-200'
                                  : record.status === 'Late Coming'
                                    ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-200'
                                    : record.inOut === 'IN' || record.inOut === 'IN/OUT'
                                      ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200'
                                      : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200'
                                }`}>
                                {record.status}
                              </span>
                              {record.inTime && record.outTime ? (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-[10px] sm:text-xs font-semibold border ${record.nearbyPair ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                  {record.nearbyPair
                                    ? `Nearby IN+OUT · ${Math.round(record.pairMinutes)} min`
                                    : 'IN + OUT'}
                                </span>
                              ) : null}
                              </div>
                            </td>
                            <td className="py-4 px-3 sm:px-6 flex gap-2">
                              {canEdit && (
                              <button
                                className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-150 text-xs sm:text-sm font-semibold shadow-sm"
                                onClick={() => handleEdit(record, index)}
                                title="Edit"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2h2v6z" />
                                </svg>
                                Edit
                              </button>
                              )}
                              {canDelete && (
                              <button
                                className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-150 text-xs sm:text-sm font-semibold shadow-sm"
                                onClick={() => handleDelete(record)}
                                title="Delete"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Delete
                              </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="9" className="py-16 text-center text-slate-500">
                            <div className="flex flex-col items-center space-y-3">
                              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6a2 2 0 012-2h2v6z" />
                              </svg>
                              <div>
                                <p className="text-sm sm:text-base font-medium">No attendance records found</p>
                                <p className="text-xs sm:text-sm text-gray-400 mt-1">Please set your filters and click Process</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  <Pagination
                    page={attendancePage}
                    totalPages={totalAttendancePages}
                    onPageChange={setAttendancePage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEditModal && editRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
              onClick={() => setShowEditModal(false)}
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Edit Attendance Record
            </h2>


            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Employee Details</label>
              <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-sm">
                <div className="font-medium">{editRecord.name || 'Unknown Employee'}</div>
                <div className="text-gray-600">EMP: {editRecord.empNo || 'N/A'}</div>
                <div className="text-gray-600">Dept: {editRecord.department || 'N/A'}</div>
              </div>
            </div>


            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
              />
            </div>


            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select
                className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={editStatus}
                onChange={e => {
                  const status = e.target.value;
                  let entry = '';
                  if (status === 'IN') {
                    entry = '1';
                    setEditOutTime(''); // Clear out time when switching to IN
                  } else if (status === 'OUT') {
                    entry = '2';
                    setEditInTime(''); // Clear in time when switching to OUT
                    // } else if (status === 'Absent') {
                    //   entry = '0';
                  } else if (status === 'Early OUT') {
                    entry = '0'; // Leave typically uses OUT entry
                  }
                  setEditStatus(status);
                  setEditEntry(entry);
                }}
              >
                <option value="">Select Status</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
                {/* <option value="Absent">Absent</option>
                <option value="Leave">Leave</option> */}
              </select>
            </div>

            {/* Entry Code - Auto-filled based on status */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Entry Code</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                value={editEntry}
                readOnly
                placeholder="Auto-filled from Status"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Remarks <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                maxLength={255}
                className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={editRecord.remarks || ''}
                onChange={e => setEditRecord(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="e.g. Client Place - China National"
              />
            </div>


            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Time {editStatus === 'IN' ? '(Clock In)' : editStatus === 'OUT' ? '(Clock Out)' : ''}
              </label>
              {editStatus === 'Absent' ? (
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  value="N/A (Absent)"
                  readOnly
                />
              ) : (
                <input
                  type="time"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={editStatus === 'IN' ? editInTime : editStatus === 'OUT' ? editOutTime : (editInTime || editOutTime)}
                  onChange={e => {
                    if (editStatus === 'IN') {
                      setEditInTime(e.target.value);
                    } else if (editStatus === 'OUT') {
                      setEditOutTime(e.target.value);
                    } else {
                      // For other statuses, update both
                      setEditInTime(e.target.value);
                      setEditOutTime(e.target.value);
                    }
                  }}
                  placeholder="e.g. 08:45"
                />
              )}
            </div>


            <div className="flex justify-end gap-3 mt-8">
              <button
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-semibold shadow"
                onClick={handleEditSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}


      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
              onClick={handleAddModalCancel}
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add New Attendance Record
            </h2>

            {/* Employee Identification Section */}
            <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIC/ EMP Attendance Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm ${nicError ? 'border-red-500' : 'border-gray-300'}`}
                  value={nic}
                  onChange={e => setNic(e.target.value)}
                  onBlur={handleNicBlur}
                  placeholder="Enter employee NIC/ EMP Attendance number"
                />
                {nicError && <div className="text-red-500 text-xs mt-1">{nicError}</div>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Number</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-sm"
                    value={newRecord.empNo}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-sm"
                    value={newRecord.department}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>
              </div>

              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-sm"
                  value={newRecord.name}
                  readOnly
                  placeholder="Auto-filled from NIC"
                />
              </div>

              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Remarks <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={255}
                  className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                  value={newRecord.remarks || ''}
                  onChange={e => setNewRecord(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g. Client Place - China National"
                />
              </div>
            </div>


            <div className="bg-blue-50 p-3 rounded-lg mb-4 border border-blue-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <DatePickerInput
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${addErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                    value={newRecord.date}
                    onChange={e => {
                      const v = e.target.value;
                      setNewRecord({ ...newRecord, date: v });
                      setAddErrors(prev => ({ ...prev, date: v ? undefined : 'Date is required' }));
                    }}
                    onBlur={() => {
                      if (!newRecord.date) {
                        setAddErrors(prev => ({ ...prev, date: 'Date is required' }));
                      }
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    aria-invalid={!!addErrors.date}
                  />
                  {addErrors.date && <div className="text-red-500 text-xs mt-1">{addErrors.date}</div>}
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${addErrors.time ? 'border-red-500' : 'border-gray-300'}`}
                    value={newRecord.time}
                    onChange={e => {
                      const v = e.target.value;
                      setNewRecord({ ...newRecord, time: v });
                      setAddErrors(prev => ({ ...prev, time: v ? undefined : 'Time is required' }));
                    }}
                    onBlur={() => {
                      if (!newRecord.time) {
                        setAddErrors(prev => ({ ...prev, time: 'Time is required' }));
                      }
                    }}
                    aria-invalid={!!addErrors.time}
                  />
                  {addErrors.time && <div className="text-red-500 text-xs mt-1">{addErrors.time}</div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${addErrors.status ? 'border-red-500' : 'border-gray-300'}`}
                    value={newRecord.status}
                    onChange={e => {
                      const status = e.target.value;
                      let entry = '';
                      if (status === 'IN') entry = '1';
                      else if (status === 'OUT') entry = '2';
                      else if (status === 'Early OUT') entry = '0';

                      setNewRecord(prev => ({ ...prev, status, entry }));
                      setAddErrors(prev => ({
                        ...prev,
                        status: status ? undefined : 'Status is required',
                        entry: status ? undefined : 'Entry will be auto-filled after selecting a Status',
                      }));
                    }}
                    onBlur={() => {
                      if (!newRecord.status) {
                        setAddErrors(prev => ({
                          ...prev,
                          status: 'Status is required',
                          entry: 'Entry will be auto-filled after selecting a Status',
                        }));
                      }
                    }}
                    aria-invalid={!!addErrors.status}
                  >
                    <option value="">Select Status</option>
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>

                  </select>
                  {addErrors.status && <div className="text-red-500 text-xs mt-1">{addErrors.status}</div>}
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Code</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-1.5 bg-gray-100 text-sm ${addErrors.entry ? 'border-red-500' : 'border-gray-200'}`}
                    value={newRecord.entry}
                    readOnly
                    placeholder="Auto-filled"
                  />
                  {addErrors.entry && <div className="text-red-500 text-xs mt-1">{addErrors.entry}</div>}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition text-sm"
                onClick={handleAddModalCancel}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition font-semibold shadow text-sm"
                onClick={handleAddNew}
                disabled={isLoading} // allow click to trigger validation
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}


      {showAbsentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
              onClick={() => setShowAbsentModal(false)}
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Absentees List
            </h2>
            <div className="mb-4 flex gap-3">
              <input
                type="date"
                className="border border-gray-300 rounded-lg px-3 py-2"
                value={absentDate}
                onChange={handleAbsentDateChange}
              />
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Filter by NIC/EPF/EMP Attendane no"
                value={absentSearch}
                onChange={handleAbsentSearch}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-slate-100 border-b-2 border-gray-200">
                    <th className="py-3 px-4 text-left font-bold text-slate-800 text-sm">Employee Name</th>
                    <th className="py-3 px-4 text-left font-bold text-slate-800 text-sm">Absent Date</th>
                    <th className="py-3 px-4 text-left font-bold text-slate-800 text-sm">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {absentLoading ? (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500">Loading...</td>
                    </tr>
                  ) : paginatedAbsentees.length > 0 ? (
                    paginatedAbsentees.map((abs, idx) => (
                      <tr key={abs.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="py-3 px-4">{abs.employee_name || abs.name}</td>
                        <td className="py-3 px-4">{abs.date}</td>
                        <td className="py-3 px-4">{abs.reason || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500">No absentees found</td>
                    </tr>
                  )}

                </tbody>
              </table>

              <Pagination
                page={absentPage}
                totalPages={totalAbsentPages}
                onPageChange={setAbsentPage}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeCard;




/*
import React, { useState, useEffect, useRef } from 'react';
import { addTimeCard, fetchTimeCards } from '../../services/ApiDataService';
import timeCardService from '../../services/timeCardService';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

// Pagination component for better UI/UX
const Pagination = ({ page, totalPages, onPageChange }) => {
  if (totalPages <= 1) return null;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, page + 2);
  if (page <= 3) end = Math.min(5, totalPages);
  if (page >= totalPages - 2) start = Math.max(1, totalPages - 4);
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex justify-center items-center gap-1 mt-4 select-none">
      <button
        className={`px-3 py-1 rounded-lg font-semibold transition-all duration-150 ${
          page === 1
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
        }`}
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        aria-label="Previous page"
      >
        &larr; Prev
      </button>
      {start > 1 && <span className="px-2 text-gray-400">...</span>}
      {pages.map((p) => (
        <button
          key={p}
          className={`px-3 py-1 rounded-lg font-semibold transition-all duration-150 ${
            p === page
              ? 'bg-blue-600 text-white shadow'
              : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
          }`}
          onClick={() => onPageChange(p)}
          disabled={p === page}
          aria-current={p === page ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      {end < totalPages && <span className="px-2 text-gray-400">...</span>}
      <button
        className={`px-3 py-1 rounded-lg font-semibold transition-all duration-150 ${
          page === totalPages
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
        }`}
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        aria-label="Next page"
      >
        Next &rarr;
      </button>
    </div>
  );
};

const TimeCard = () => {
  // Form state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [importMethod, setImportMethod] = useState('excel');
  const [filterOption, setFilterOption] = useState('all');
  const [department, setDepartment] = useState('');
  const [nic, setNic] = useState('');
  const [nicError, setNicError] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');

  // Table data state
  const [attendanceData, setAttendanceData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [editInTime, setEditInTime] = useState('');
  const [editOutTime, setEditOutTime] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editEntry, setEditEntry] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const [showAbsentModal, setShowAbsentModal] = useState(false);
  const [absentees, setAbsentees] = useState([]);
  const [absentSearch, setAbsentSearch] = useState('');
  const [absentLoading, setAbsentLoading] = useState(false);
  const [absentDate, setAbsentDate] = useState('');

  // Pagination state for absentees modal
  const [absentPage, setAbsentPage] = useState(1);
  const rowsPerPage = 6;
  const paginatedAbsentees = absentees.slice(
    (absentPage - 1) * rowsPerPage,
    absentPage * rowsPerPage
  );
  const totalAbsentPages = Math.ceil(absentees.length / rowsPerPage);

  // Attendance table pagination state
  const [attendancePage, setAttendancePage] = useState(1);
  const attendanceRowsPerPage = 8;
  const paginatedAttendance = filteredData.slice(
    (attendancePage - 1) * attendanceRowsPerPage,
    attendancePage * attendanceRowsPerPage
  );
  const totalAttendancePages = Math.ceil(filteredData.length / attendanceRowsPerPage);

  // ADD: guard to prevent pagination reset when refreshing after edit/save
  const preventPaginationReset = useRef(false);

  useEffect(() => {
    setAbsentPage(1);
  }, [absentees]);

  // CHANGE: only reset to first page when not prevented
  useEffect(() => {
    if (preventPaginationReset.current) {
      // keep current page, then clear the guard
      preventPaginationReset.current = false;
      return;
    }
    setAttendancePage(1);
  }, [filteredData]);

  // Handler to open modal and fetch all absentees (with date filter)
  const handleShowAbsentees = async () => {
    setShowAbsentModal(true);
    setAbsentLoading(true);
    try {
      const data = await timeCardService.fetchAbsentees({ date: absentDate, search: absentSearch });
      setAbsentees(data);
    } catch {
      setAbsentees([]);
    }
    setAbsentLoading(false);
  };

  // Handler for date change
  const handleAbsentDateChange = async (e) => {
    const newDate = e.target.value;
    setAbsentDate(newDate);
    setAbsentLoading(true);
    try {
      const data = await timeCardService.fetchAbsentees({ date: newDate, search: absentSearch });
      setAbsentees(data);
    } catch {
      setAbsentees([]);
    }
    setAbsentLoading(false);
  };

  // Handler for search
  const handleAbsentSearch = async (e) => {
    const value = e.target.value;
    setAbsentSearch(value);
    setAbsentLoading(true);
    try {
      const data = await timeCardService.fetchAbsentees({ date: absentDate, search: value });
      setAbsentees(data);
    } catch {
      setAbsentees([]);
    }
    setAbsentLoading(false);
  };

  // Add new record modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRecord, setNewRecord] = useState({
    empNo: '',
    name: '',
    time: '',
    date: '',
    entry: '',
    department: '',
    status: '',
  });
  // Inline validation errors for Add New modal
  const [addErrors, setAddErrors] = useState({});

  // Import Data section toggle state
  const [showImport, setShowImport] = useState(true);

  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedToDate, setSelectedToDate] = useState('');
  const [excelFile, setExcelFile] = useState(null);
  // ref to clear the native file input after import
  const excelInputRef = useRef(null);

  // debounce ref for backend search
  const searchDebounceRef = useRef(null);

  // Fetch data from backend on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchTimeCards();
      setAttendanceData(data);
      setFilteredData(data);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Fetch companies from backend (example)
  useEffect(() => {
    const fetchCompanies = async () => {
      const data = await timeCardService.fetchCompanies();
      setCompanies(data);
    };
    fetchCompanies();
  }, []);

  // Filter helpers
  const filterAttendance = (statusFilter = null) => {
    let filtered = attendanceData;

    if (filterOption === 'employee' && employeeSearch) {
      filtered = filtered.filter(
        (rec) =>
          (rec.nic && rec.nic.toLowerCase().includes(employeeSearch.toLowerCase())) ||
          (rec.empNo && rec.empNo.toLowerCase().includes(employeeSearch.toLowerCase()))
      );
    }
    if (filterOption === 'department' && department) {
      filtered = filtered.filter((rec) => rec.department === department);
    }
    if (filterDate) {
      filtered = filtered.filter((rec) => rec.date === filterDate);
    }
    if (dateFrom) {
      filtered = filtered.filter((rec) => rec.date >= dateFrom);
    }
    if (dateTo) {
      filtered = filtered.filter((rec) => rec.date <= dateTo);
    }
    if (statusFilter) {
      filtered = filtered.filter((rec) => rec.status === statusFilter);
    }
    return filtered;
  };

  const handleProcess = async () => {
    if (!dateFrom || !dateTo) {
      Swal.fire({
        icon: 'warning',
        title: 'Select date range',
        text: 'Please select both From Date and To Date, then click Process.',
      });
      return;
    }
    if (dateFrom > dateTo) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid range',
        text: 'From Date cannot be after To Date.',
      });
      return;
    }

    setIsLoading(true);
    setFilterDate('');
    try {
      let data = await fetchTimeCards({ from_date: dateFrom, to_date: dateTo });
      if (!Array.isArray(data)) data = [];
      data = filterFirstInLastOut(data);
      setAttendanceData(data);

      let filtered = data;
      if (filterOption === 'employee' && employeeSearch) {
        const q = employeeSearch.toLowerCase();
        filtered = filtered.filter(
          (rec) =>
            (rec.nic && rec.nic.toLowerCase().includes(q)) ||
            (rec.empNo && rec.empNo.toLowerCase().includes(q)) ||
            (rec.name && rec.name.toLowerCase().includes(q))
        );
      }
      setFilteredData(filtered);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Load failed',
        text: e.response?.data?.message || e.message || 'Could not load time cards.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeave = () => {
    setFilteredData(filterAttendance('Early OUT')); // CHANGED from 'Leave'
  };

  // Cancel handler for filters
  const handleCancel = () => {
    setDateFrom('');
    setDateTo('');
    setDepartment('');
    setFilterDate('');
    // clear employee search when cancelling filters
    setEmployeeSearch('');
    setFilteredData(attendanceData);
  };

  // Handle delete - FIXED: use record.id directly instead of index
  const handleDelete = async (record) => {
    if (!record || !record.id) {
      Swal.fire({ icon: 'error', title: 'Delete failed', text: 'Record ID not found.' });
      return;
    }
    const confirm = await Swal.fire({
      title: 'Are you sure?',
      text: 'This will permanently delete the record.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
    });
    if (confirm.isConfirmed) {
      try {
        await timeCardService.deleteTimeCard(record.id);
        
        // PREVENT resetting to page 1 on this refresh
        preventPaginationReset.current = true;
        
        const updated = await fetchTimeCards();
        setAttendanceData(updated);
        setFilteredData(updated);
        
        Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1200, showConfirmButton: false });
      } catch (e) {
        Swal.fire({ icon: 'error', title: 'Delete failed', text: e.message });
      }
    }
  };


 

  // Handle edit open
  const handleEdit = (record, index) => {
    console.log('Editing record:', record); // Debug log
    
    setEditRecord({ ...record, index });
    
    // Set date - ensure proper format for date input (YYYY-MM-DD)
    const formattedDate = record.date ? new Date(record.date).toISOString().split('T')[0] : '';
    setEditDate(formattedDate);
    
    // Set entry based on record data
    setEditEntry(record.entry || '');
    
    // Set status - handle both string and numeric entry values
    let statusValue = record.status || '';
    if (!statusValue) {
      // Derive status from entry if status is missing
      if (record.entry === '1' || record.entry === 1) {
        statusValue = 'IN';
      } else if (record.entry === '2' || record.entry === 2) {
        statusValue = 'OUT';
      }
    }
    setEditStatus(statusValue);
    
    // Set time based on status and inOut field
    const timeValue = record.time || '';
    if (record.inOut === 'IN' || statusValue === 'IN') {
      setEditInTime(timeValue);
      setEditOutTime(''); // Clear out time for IN records
    } else if (record.inOut === 'OUT' || statusValue === 'OUT') {
      setEditOutTime(timeValue);
      setEditInTime(''); // Clear in time for OUT records
    } else {
      // For other statuses, set both to the same time
      setEditInTime(timeValue);
      setEditOutTime(timeValue);
    }
    
    setShowEditModal(true);
  };

  // Handle edit save
  const handleEditSave = async () => {
    try {
      // Validate required fields
      if (!editDate) {
        alert('Date is required');
        return;
      }
      if (!editStatus) {
        alert('Status is required');
        return;
      }
      
      // Determine the time to send based on status
      let timeToSend = '';
      if (editStatus === 'IN') {
        timeToSend = editInTime;
      } else if (editStatus === 'OUT' || editStatus === 'Early OUT') {
        timeToSend = editOutTime;
      } else if (editStatus === 'Absent') {
        timeToSend = '00:00:00'; // Default time for absent records
      }
      
      // Validate time for non-absent records
      if (editStatus !== 'Absent' && !timeToSend) {
        alert('Time is required for this status');
        return;
      }
      
      // Ensure time is in HH:MM:SS format
      if (timeToSend && !timeToSend.includes(':')) {
        alert('Please enter a valid time');
        return;
      }
      
      const payload = {
        date: editDate,
        time: formatTimeForBackend(timeToSend),
        entry: editEntry,
        status: editStatus,
      };
      
      console.log('Saving payload:', payload); // Debug log
      
      await timeCardService.updateTimeCard(editRecord.id, payload);
      
      // Refresh data
      const updated = await fetchTimeCards();

      // PREVENT resetting to page 1 on this refresh
      preventPaginationReset.current = true;
      setAttendanceData(updated);
      setFilteredData(updated);
      
      // Close modal
      setShowEditModal(false);
      
      // Show success message
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Attendance record updated successfully.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error('Error updating record:', e);
      const errorMessage = e.response?.data?.message || e.message || 'Failed to update attendance record';
      
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: errorMessage,
      });
    }
  };





  // Helper to sort by date, time, empNo, and entry

  const handleAddNew = async () => {
    if (!nic) {
      setNicError('NIC is required');
      return;
    }
    setIsLoading(true);
    setNicError('');
    setAddErrors({});

    // Get employee info
    let employee;
    try {
      employee = await timeCardService.fetchEmployeeByNic(nic);
    } catch {
      setNicError('Employee not found');
      setIsLoading(false);
      return;
    }

    // Validate fields
    const errs = {};
    if (!newRecord.date) errs.date = 'Date is required';
    if (!newRecord.status) errs.status = 'Status is required';
    if (!newRecord.entry) errs.entry = 'Entry will be auto-filled after selecting a Status';
    if (!newRecord.time) errs.time = 'Time is required';

    if (Object.keys(errs).length > 0) {
      setAddErrors(errs);
      setIsLoading(false);
      return;
    }

    const payload = {
      employee_id: employee.id,
      time: newRecord.time,
      date: newRecord.date,
      entry: newRecord.entry,
      status: newRecord.status,
    };

    try {
      // Add the record
      await addTimeCard(payload);
      // Get updated data
      const updated = await fetchTimeCards();
      
      // Set data first
      setAttendanceData(updated);
      setFilteredData(updated);
      
      // Find the new record with more flexible matching
      let newRecordIndex = updated.findIndex(record => {
        return (
          // Match by employee info - could be different formats
          (record.empNo === employee.attendance_employee_no || 
           record.employee_id === employee.id) &&
          // Match by date
          record.date === newRecord.date &&
          // Match by approximate time (in case of formatting differences)
          record.time?.includes(newRecord.time.substring(0, 4))
        );
      });
      
      console.log("Found new record at index:", newRecordIndex);
      
      if (newRecordIndex !== -1) {
        // Calculate which page contains the new record
        const pageWithNewRecord = Math.floor(newRecordIndex / attendanceRowsPerPage) + 1;
        console.log("Setting page to:", pageWithNewRecord);
        
        // Use setTimeout to ensure this happens after state updates
        setTimeout(() => {
          setAttendancePage(pageWithNewRecord);
        }, 10);
      }
      
      setShowAddModal(false);
      clearAddModalFields();
      
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: 'Attendance record added successfully.',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to add attendance record';
      setNicError(msg);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: msg,
      });
    }
    setIsLoading(false);
  };

  // Clear fields helper for Add New modal
  const clearAddModalFields = () => {
    setNic('');
    setNicError('');
    setAddErrors({});
    setNewRecord({
      empNo: '',
      name: '',
      time: '',
      date: '',
      entry: '',
      department: '',
      status: '',
    });
  };

  // Cancel handler for Add New modal: clear fields if any data present, then close
  const handleAddModalCancel = () => {
    const hasData =
      nic ||
      newRecord.empNo ||
      newRecord.name ||
      newRecord.time ||
      newRecord.date ||
      newRecord.entry ||
      newRecord.status;
    if (hasData) clearAddModalFields();
    setShowAddModal(false);
  };

  const handleNicBlur = async () => {
    if (!nic) return;
    setNicError('');
    try {
      const emp = await timeCardService.fetchEmployeeByNic(nic);
      if (emp && emp.attendance_employee_no && emp.full_name) {
        setNewRecord((prev) => ({
          ...prev,
          empNo: emp.attendance_employee_no,
          name: emp.full_name,
          department: emp.department || '',
        }));
      } else {
        setNicError('Employee not found for this NIC');
        setNewRecord((prev) => ({
          ...prev,
          empNo: '',
          name: '',
          department: '',
        }));
      }
    } catch {
      setNicError('Employee not found for this NIC');
      setNewRecord((prev) => ({
        ...prev,
        empNo: '',
        name: '',
        department: '',
      }));
    }
  };

  useEffect(() => {
    if (filterOption !== 'employee') setEmployeeSearch('');
  }, [filterOption]);

  useEffect(() => {
    // Only run when "Filter by Employee" is active
    if (filterOption !== 'employee') {
      // When switched away, restore attendanceData (but respect date filters)
      if (filterDate || dateFrom || dateTo) {
        let data = [...attendanceData];
        if (filterDate) data = data.filter((rec) => rec.date === filterDate);
        if (dateFrom) data = data.filter((rec) => rec.date >= dateFrom);
        if (dateTo) data = data.filter((rec) => rec.date <= dateTo);
        setFilteredData(data);
      } else {
        setFilteredData(attendanceData);
      }
      return;
    }

    const term = (employeeSearch || '').trim();

    // empty search -> show base attendance data (with date filters applied)
    if (!term) {
      let data = [...attendanceData];
      if (filterDate) data = data.filter((rec) => rec.date === filterDate);
      if (dateFrom) data = data.filter((rec) => rec.date >= dateFrom);
      if (dateTo) data = data.filter((rec) => rec.date <= dateTo);
      setFilteredData(data);
      setIsLoading(false);
      return;
    }

    // If the user types only digits, do immediate client-side filtering (instant number-by-number)
    if (/^\d+$/.test(term)) {
      setIsLoading(false);
      const filtered = attendanceData.filter((rec) => {
        const empNo = (rec.empNo || '').toString().toLowerCase();
        const epf = (rec.epf || '').toString().toLowerCase();
        const nicVal = (rec.nic || '').toLowerCase();
        return (
          empNo.includes(term.toLowerCase()) ||
          epf.includes(term.toLowerCase()) ||
          nicVal.includes(term.toLowerCase())
        );
      }).filter((rec) => {
        if (filterDate && rec.date !== filterDate) return false;
        if (dateFrom && rec.date < dateFrom) return false;
        if (dateTo && rec.date > dateTo) return false;
        return true;
      });
      setFilteredData(filtered);
      return;
    }

    // For non-numeric or mixed input, call backend but debounce requests
    setIsLoading(true);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const data = await timeCardService.searchEmployeeTimeCards(term);
        let results = Array.isArray(data) ? data : [];
        // apply local date filters if backend doesn't support them
        if (filterDate || dateFrom || dateTo) {
          results = results.filter((rec) => {
            if (filterDate && rec.date !== filterDate) return false;
            if (dateFrom && rec.date < dateFrom) return false;
            if (dateTo && rec.date > dateTo) return false;
            return true;
          });
        }
        setFilteredData(results);
      } catch {
        setFilteredData([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
    };
  }, [employeeSearch, filterOption, filterDate, dateFrom, dateTo, attendanceData]);

  const handleExcelUpload = (e) => {
    setExcelFile(e.target.files[0]);
  };

  const handleImportExcel = async () => {
    if (!excelFile) {
      Swal.fire({ icon: 'error', title: 'No file selected', text: 'Please select an Excel file.' });
      return;
    }
    if (!selectedDate) {
      Swal.fire({ icon: 'error', title: 'Missing From Date', text: 'Please select a From Date.' });
      return;
    }
    // NEW: require To Date too
    if (!selectedToDate) {
      Swal.fire({ icon: 'error', title: 'Missing To Date', text: 'Please select a To Date.' });
      return;
    }
    // Ensure To Date is not before From Date
    if (selectedToDate < selectedDate) {
      Swal.fire({ icon: 'error', title: 'Invalid Date Range', text: 'To Date cannot be before From Date.' });
      return;
    }

    setIsLoading(true);

    try {
      // Read the Excel file client-side using FileReader and SheetJS
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = e.target.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          // Skip header row and map data to structured format
          const records = jsonData.slice(1).map(row => ({
            nic: row[0]?.toString() || '',
            date: row[1]?.toString() || '',
            time: row[2]?.toString() || '',
            entry: row[3]?.toString() || '',
            status: row[4]?.toString() || '',
            reason: row[5]?.toString() || ''
          }));
          
          // Filter out empty rows
          const validRecords = records.filter(r => r.nic && (r.date || r.status === 'Absent'));
          
          if (validRecords.length === 0) {
            Swal.fire({ icon: 'error', title: 'No valid data', text: 'No valid records found in Excel file.' });
            setIsLoading(false);
            return;
          }
          
          // Build payload expected by service
          const payload = {
            company_id: selectedCompany || undefined,
            from_date: selectedDate,
            to_date: selectedToDate,
            records: validRecords,
            file: excelFile
          };

          // Use importExcelData which builds FormData on the service side
          const res = await timeCardService.importExcelData(payload);

          Swal.fire({
            icon: 'success',
            title: 'Import Completed',
            html: `
              <div>
                <p>Imported: <b>${res.imported}</b></p>
                <p>Absent: <b>${res.absent}</b></p>
                ${res.errors?.length ? `<p class="text-red-600">Errors:<br>${res.errors.join('<br>')}</p>` : ''}
              </div>
            `
          });
          
          const updated = await fetchTimeCards();
          setAttendanceData(updated);
          setFilteredData(updated);
          
          setSelectedCompany('');
          setSelectedDate('');
          setSelectedToDate('');
          setExcelFile(null);
          if (excelInputRef.current) excelInputRef.current.value = '';
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          // Prefer backend validation messages when available (422) and show them to user
          const backendMessage = error?.response?.data?.message;
          const backendErrors = error?.response?.data?.errors;
          let message = error.message || 'Import failed';
          if (backendMessage) {
            message = backendMessage;
          } else if (backendErrors) {
            if (Array.isArray(backendErrors)) message = backendErrors.join('\n');
            else if (typeof backendErrors === 'object')
              message = Object.values(backendErrors).flat().join('\n');
          }
          Swal.fire({
            icon: 'error',
            title: 'Import failed',
            text: message,
          });
        } finally {
          setIsLoading(false);
        }
      };
      
      reader.onerror = (error) => {
        console.error("File reading error:", error);
        Swal.fire({
          icon: 'error',
          title: 'Import failed',
          text: 'Error reading file: ' + error.message
        });
        setIsLoading(false);
      };
      
      // Start reading the file
      reader.readAsArrayBuffer(excelFile);
      
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Import failed',
        text: e.message || 'An unexpected error occurred'
      });
      setIsLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      await timeCardService.downloadTemplate();
    } catch (error) {
      alert(error.message);
    }
  };

  // Helper function to format time consistently
  const formatTimeForBackend = (timeStr) => {
    if (!timeStr) return '';
    
    // If already in HH:MM:SS format, return as is
    if (timeStr.split(':').length === 3) {
      return timeStr;
    }
    
    // If in HH:MM format, add seconds
    if (timeStr.split(':').length === 2) {
      return timeStr + ':00';
    }
    
    return timeStr;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-gray-100 py-4 sm:py-8">
      <div className="container mx-auto px-3 sm:px-4 max-w-7xl">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden">
          <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 sm:px-8 py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white text-center">
              Time Card Management
            </h1>
            <p className="text-slate-300 text-center mt-2 text-sm sm:text-base">
              Employee Attendance & Time Tracking System
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
           
            <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <button
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-md font-semibold shadow transition-all duration-200 ${
                    showImport
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-blue-700 hover:bg-blue-100'
                  }`}
                  onClick={() => setShowImport((v) => !v)}
                  aria-expanded={showImport}
                >
                  <svg
                    className={`w-5 h-5 transition-transform duration-200 ${showImport ? 'rotate-0' : 'rotate-180'}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                  {showImport ? 'Hide Import Data' : 'Show Import Data'}
                </button>
              </div>
              <div>
                <button
                  className="flex items-center gap-2 px-2.5 py-2 rounded-md font-semibold shadow transition-all duration-200 bg-green-600 text-white hover:bg-green-700"
                  onClick={handleDownloadTemplate}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  Export Template
                </button>
              </div>
            </div>
            {showImport && (
              <div className="mt-6 p-3 sm:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-l-4 border-blue-500 rounded-lg shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Company</label>
                    <select
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={selectedCompany}
                      onChange={e => setSelectedCompany(e.target.value)}
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">From Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">To Date <span className="text-red-500">*</span></label>
                    <input
                      type="date"
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={selectedToDate}
                      onChange={e => setSelectedToDate(e.target.value)}
                      min={selectedDate || undefined}
                      required
                    />
                  </div>
                </div>
                <div className="mt-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-4">Import Method</label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                    <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-blue-100 transition-colors duration-200">
                      <input
                        type="radio"
                        className="form-radio h-5 w-5 text-blue-600 focus:ring-blue-500 focus:ring-2"
                        checked={importMethod === 'excel'}
                        onChange={() => setImportMethod('excel')}
                      />
                      <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">Import from Excel Sheet</span>
                    </label>
                  </div>
                  {importMethod === 'excel' && (
                    <div className="mt-4">
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Upload Excel File</label>
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        className="w-full p-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 bg-white shadow-sm"
                        onChange={handleExcelUpload}
                        ref={excelInputRef}
                      />
                      <button
                        className="mt-3 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-xl hover:from-green-700 hover:to-green-800 transition-all duration-300 shadow-lg"
                        onClick={handleImportExcel}
                      >
                        Import {importMethod === 'hikvision' ? 'Hikvision Excel' : 'Excel'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            <div className="mb-8"></div>
            
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gradient-to-br from-emerald-50 to-green-50 border-l-4 border-emerald-500 rounded-lg shadow-sm">
              <div className="flex items-center mb-4 sm:mb-6">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center mr-3 shadow-md">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                </div>
                <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-800">Filter Options</h2>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-semibold text-slate-700 mb-4">Filter By</label>
                <div className="flex flex-col sm:flex-row lg:flex-row gap-3">
                  <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-emerald-100 transition-colors duration-200">
                    <input
                      type="radio"
                      className="form-radio h-5 w-5 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                      checked={filterOption === 'all'}
                      onChange={() => setFilterOption('all')}
                    />
                    <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">All Fingerprints</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer p-3 rounded-lg hover:bg-emerald-100 transition-colors duration-200">
                    <input
                      type="radio"
                      className="form-radio h-5 w-5 text-emerald-600 focus:ring-emerald-500 focus:ring-2"
                      checked={filterOption === 'employee'}
                      onChange={() => setFilterOption('employee')}
                    />
                    <span className="ml-3 text-slate-700 font-medium text-sm sm:text-base">Filter by Employee</span>
                  </label>
                 
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {filterOption === 'employee' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Search by NIC/EPF/EMP Attendance Number</label>
                    <input
                      type="text"
                      className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                      value={employeeSearch}
                      onChange={(e) => setEmployeeSearch(e.target.value)}
                      placeholder="Enter NIC/EPF/EMP Attendance number"
                    />
                  </div>
                )}
                
                
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">From Date</label>
                  <input
                    type="date"
                    className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                    value={dateFrom}
                    onChange={e => {
                      const v = e.target.value;
                      setDateFrom(v);
                      setFilterDate('');
                      if (dateTo && v && dateTo < v) setDateTo(v);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">To Date</label>
                  <input
                    type="date"
                    className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all duration-200 bg-white shadow-sm hover:shadow-md text-sm sm:text-base"
                    value={dateTo}
                    min={dateFrom || undefined}
                    onChange={e => {
                      setDateTo(e.target.value);
                      setFilterDate('');
                    }}
                  />
                </div>
              </div>
            </div>

        
            <div className="flex flex-wrap justify-end gap-3 sm:gap-4 mb-6 sm:mb-8">
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={handleProcess}
                disabled={isLoading}
              >
                {isLoading ? 'Loading...' : 'Process'}
              </button>
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-gray-600 to-gray-700 text-white font-semibold rounded-xl hover:from-gray-700 hover:to-gray-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
                onClick={handleCancel}
              >
                Cancel
              </button>
             
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold rounded-xl hover:from-red-700 hover:to-red-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={handleShowAbsentees}
              >
                Mark Absentees
              </button>
              <button
                className="px-4 sm:px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white font-semibold rounded-xl hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
                onClick={handleLeave}
              >
                Early OUT
              </button>
            </div>

           
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
              <div className="bg-gradient-to-r from-slate-800 to-gray-900 px-4 sm:px-6 py-4 sm:py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2v-6a2 2 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                      </svg>
                    </div>
                    <h3 className="text-lg sm:text-xl font-bold text-white">Attendance Records</h3>
                  </div>
                  <button
                    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold shadow hover:bg-green-700 transition"
                    onClick={() => setShowAddModal(true)}
                  >
                    Add New
                  </button>
                </div>
              </div>
              {isLoading ? (
                <div className="p-8 sm:p-12 text-center">
                  <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mx-auto"></div>
                  <p className="mt-6 text-slate-600 font-medium text-sm sm:text-base">Loading attendance data...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white">
                    <thead>
                      <tr className="bg-gradient-to-r from-gray-50 to-slate-100 border-b-2 border-gray-200">
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">EMP NO</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Name</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Fingerprint Clock</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Time</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Date</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Entry</th>
                        <th className="py-4 px-3 sm:px-6 text-left font-bold text-slate-800 text-xs sm:text-sm lg:text-base">Status</th>
                        
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAttendance.length > 0 ? (
                        paginatedAttendance.map((record, index) => (
                          <tr key={index} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100`}>
                            <td className="py-4 px-3 sm:px-6 font-semibold text-slate-700 text-xs sm:text-sm lg:text-base">{record.empNo}</td>
                            <td className="py-4 px-3 sm:px-6 font-medium text-slate-800 text-xs sm:text-sm lg:text-base">{record.name}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-600 text-xs sm:text-sm lg:text-base">{record.fingerprintClock}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-600 font-mono text-xs sm:text-sm lg:text-base">{record.time}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-600 text-xs sm:text-sm lg:text-base">{record.date}</td>
                            <td className="py-4 px-3 sm:px-6 text-slate-700 font-bold text-xs sm:text-sm lg:text-base">{record.entry}</td>
                            <td className="py-4 px-3 sm:px-6">
                           
                              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-sm border ${
  record.status === 'Absent'
    ? 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200'
    : record.status === 'Early OUT'
    ? 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 border-yellow-200'
    : record.status === 'Late Coming'
    ? 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-200'
    : record.inOut === 'IN'
    ? 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 border-emerald-200'
    : 'bg-gradient-to-r from-red-100 to-rose-100 text-red-800 border-red-200'
}`}>
  {record.status}
</span>
                            </td>
                            <td className="py-4 px-3 sm:px-6 flex gap-2">
                              {canEdit && (
                              <button
                                className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-600 hover:text-white transition-all duration-150 text-xs sm:text-sm font-semibold shadow-sm"
                                onClick={() => handleEdit(record, index)}
                                title="Edit"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6-6m2 2l-6 6m-2 2h6v2a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2h2v6z" />
                                </svg>
                                Edit
                              </button>
                              )}
                              {canDelete && (
                              <button
                                className="inline-flex items-center px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition-all duration-150 text-xs sm:text-sm font-semibold shadow-sm"
                                onClick={() => handleDelete(record)}
                                title="Delete"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Delete
                              </button>
                              )}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="9" className="py-16 text-center text-slate-500">
                            <div className="flex flex-col items-center space-y-3">
                              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2a2 2 0 01-2-2v-6a2 2 0 012-2h2v6z" />
                              </svg>
                              <div>
                                <p className="text-sm sm:text-base font-medium">No attendance records found</p>
                                <p className="text-xs sm:text-sm text-gray-400 mt-1">Please set your filters and click Process</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                 
                  <Pagination
                    page={attendancePage}
                    totalPages={totalAttendancePages}
                    onPageChange={setAttendancePage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showEditModal && editRecord && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
              onClick={() => setShowEditModal(false)}
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Edit Attendance Record
            </h2>
            
           
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Employee Details</label>
              <div className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100 text-sm">
                <div className="font-medium">{editRecord.name || 'Unknown Employee'}</div>
                <div className="text-gray-600">EMP: {editRecord.empNo || 'N/A'}</div>
                <div className="text-gray-600">Dept: {editRecord.department || 'N/A'}</div>
              </div>
            </div>
            
        
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={editDate}
                onChange={e => setEditDate(e.target.value)}
              />
            </div>
            
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
              <select
                className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={editStatus}
                onChange={e => {
                  const status = e.target.value;
                  let entry = '';
                  if (status === 'IN') {
                    entry = '1';
                    setEditOutTime(''); // Clear out time when switching to IN
                  } else if (status === 'OUT') {
                    entry = '2';
                    setEditInTime(''); // Clear in time when switching to OUT
                  // } else if (status === 'Absent') {
                  //   entry = '0';
                  } else if (status === 'Early OUT') {
                    entry = '0'; // Leave typically uses OUT entry
                  }
                  setEditStatus(status);
                  setEditEntry(entry);
                }}
              >
                <option value="">Select Status</option>
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
               
              </select>
            </div>
            
           
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">Entry Code</label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                value={editEntry}
                readOnly
                placeholder="Auto-filled from Status"
              />
            </div>
            
           
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Time {editStatus === 'IN' ? '(Clock In)' : editStatus === 'OUT' ? '(Clock Out)' : ''}
              </label>
              {editStatus === 'Absent' ? (
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-100"
                  value="N/A (Absent)"
                  readOnly
                />
              ) : (
                <input
                  type="time"
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={editStatus === 'IN' ? editInTime : editStatus === 'OUT' ? editOutTime : (editInTime || editOutTime)}
                  onChange={e => {
                    if (editStatus === 'IN') {
                      setEditInTime(e.target.value);
                    } else if (editStatus === 'OUT') {
                      setEditOutTime(e.target.value);
                    } else {
                      // For other statuses, update both
                      setEditInTime(e.target.value);
                      setEditOutTime(e.target.value);
                    }
                  }}
                  placeholder="e.g. 08:45"
                />
              )}
            </div>
            
           
            <div className="flex justify-end gap-3 mt-8">
              <button
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition font-semibold shadow"
                onClick={handleEditSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

     
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
              onClick={handleAddModalCancel}
              title="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-lg font-bold mb-4 text-slate-800 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add New Attendance Record
            </h2>
            
        
            <div className="bg-gray-50 p-3 rounded-lg mb-4 border border-gray-100">
              <div className="mb-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  NIC/ EMP Attendance Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className={`w-full border rounded-lg px-3 py-1.5 text-sm ${nicError ? 'border-red-500' : 'border-gray-300'}`}
                  value={nic}
                  onChange={e => setNic(e.target.value)}
                  onBlur={handleNicBlur}
                  placeholder="Enter employee NIC/ EMP Attendance number"
                />
                {nicError && <div className="text-red-500 text-xs mt-1">{nicError}</div>}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Number</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-sm"
                    value={newRecord.empNo}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-sm"
                    value={newRecord.department}
                    readOnly
                    placeholder="Auto-filled"
                  />
                </div>
              </div>
              
              <div className="mb-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Employee Name</label>
                <input
                  type="text"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-gray-100 text-sm"
                  value={newRecord.name}
                  readOnly
                  placeholder="Auto-filled from NIC"
                />
              </div>
            </div>
            
           
            <div className="bg-blue-50 p-3 rounded-lg mb-4 border border-blue-100">
              <div className="grid grid-cols-2 gap-3">
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${addErrors.date ? 'border-red-500' : 'border-gray-300'}`}
                    value={newRecord.date}
                    onChange={e => {
                      const v = e.target.value;
                      setNewRecord({ ...newRecord, date: v });
                      setAddErrors(prev => ({ ...prev, date: v ? undefined : 'Date is required' }));
                    }}
                    onBlur={() => {
                      if (!newRecord.date) {
                        setAddErrors(prev => ({ ...prev, date: 'Date is required' }));
                      }
                    }}
                    max={new Date().toISOString().split('T')[0]}
                    aria-invalid={!!addErrors.date}
                  />
                  {addErrors.date && <div className="text-red-500 text-xs mt-1">{addErrors.date}</div>}
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${addErrors.time ? 'border-red-500' : 'border-gray-300'}`}
                    value={newRecord.time}
                    onChange={e => {
                      const v = e.target.value;
                      setNewRecord({ ...newRecord, time: v });
                      setAddErrors(prev => ({ ...prev, time: v ? undefined : 'Time is required' }));
                    }}
                    onBlur={() => {
                      if (!newRecord.time) {
                        setAddErrors(prev => ({ ...prev, time: 'Time is required' }));
                      }
                    }}
                    aria-invalid={!!addErrors.time}
                  />
                  {addErrors.time && <div className="text-red-500 text-xs mt-1">{addErrors.time}</div>}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    className={`w-full border rounded-lg px-3 py-1.5 text-sm ${addErrors.status ? 'border-red-500' : 'border-gray-300'}`}
                    value={newRecord.status}
                    onChange={e => {
                      const status = e.target.value;
                      let entry = '';
                      if (status === 'IN') entry = '1';
                      else if (status === 'OUT') entry = '2';
                      else if (status === 'Early OUT') entry = '0';

                      setNewRecord(prev => ({ ...prev, status, entry }));
                      setAddErrors(prev => ({
                        ...prev,
                        status: status ? undefined : 'Status is required',
                        entry: status ? undefined : 'Entry will be auto-filled after selecting a Status',
                      }));
                    }}
                    onBlur={() => {
                      if (!newRecord.status) {
                        setAddErrors(prev => ({
                          ...prev,
                          status: 'Status is required',
                          entry: 'Entry will be auto-filled after selecting a Status',
                        }));
                      }
                    }}
                    aria-invalid={!!addErrors.status}
                  >
                    <option value="">Select Status</option>
                    <option value="IN">IN</option>
                    <option value="OUT">OUT</option>
                    
                  </select>
                  {addErrors.status && <div className="text-red-500 text-xs mt-1">{addErrors.status}</div>}
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Entry Code</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg px-3 py-1.5 bg-gray-100 text-sm ${addErrors.entry ? 'border-red-500' : 'border-gray-200'}`}
                    value={newRecord.entry}
                    readOnly
                    placeholder="Auto-filled"
                  />
                  {addErrors.entry && <div className="text-red-500 text-xs mt-1">{addErrors.entry}</div>}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-5">
              <button
                className="px-4 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition text-sm"
                onClick={handleAddModalCancel}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 transition font-semibold shadow text-sm"
                onClick={handleAddNew}
                disabled={isLoading} // allow click to trigger validation
              >
                Add Record
              </button>
            </div>
          </div>
        </div>
      )}

     
      {showAbsentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-2xl relative animate-fade-in">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition"
              onClick={() => setShowAbsentModal(false)}
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-6 text-slate-800 flex items-center gap-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Absentees List
            </h2>
            <div className="mb-4 flex gap-3">
              <input
                type="date"
                className="border border-gray-300 rounded-lg px-3 py-2"
                value={absentDate}
                onChange={handleAbsentDateChange}
              />
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Filter by NIC/EPF/EMP Attendane no"
                value={absentSearch}
                onChange={handleAbsentSearch}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gradient-to-r from-gray-50 to-slate-100 border-b-2 border-gray-200">
                    <th className="py-3 px-4 text-left font-bold text-slate-800 text-sm">Employee Name</th>
                    <th className="py-3 px-4 text-left font-bold text-slate-800 text-sm">Absent Date</th>
                    <th className="py-3 px-4 text-left font-bold text-slate-800 text-sm">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {absentLoading ? (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500">Loading...</td>
                    </tr>
                  ) : paginatedAbsentees.length > 0 ? (
                    paginatedAbsentees.map((abs, idx) => (
                      <tr key={abs.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="py-3 px-4">{abs.employee_name || abs.name}</td>
                        <td className="py-3 px-4">{abs.date}</td>
                        <td className="py-3 px-4">{abs.reason || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="py-8 text-center text-slate-500">No absentees found</td>
                    </tr>
                  )}
               
                </tbody>
              </table>
             
              <Pagination
                page={absentPage}
                totalPages={totalAbsentPages}
                onPageChange={setAbsentPage}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeCard;
*/
