import axios from "@utils/axios";

const getMonthlyReportData = async (month, year, company_id) => {
  try {
    const params = { month, year };
    if (company_id) {
      params.company_id = company_id;
    }
    const response = await axios.get(`/reports/monthly-data`, {
      params
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching report data:", error);
    throw error;
  }
};

const getScheduleReportData = async (month, year, company_id) => {
  try {
    const params = { month, year };
    if (company_id) {
      params.company_id = company_id;
    }
    const response = await axios.get(`/reports/schedule-data`, {
      params
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching schedule report data:", error);
    throw error;
  }
};

const getLeaveSummaryData = async (month, year, company_id) => {
  try {
    const params = {};
    if (year) params.year = year;
    if (month) params.month = month;
    if (company_id) params.company_id = company_id;
    const response = await axios.get('/reports/leave-summary', { params });
    return response.data;
  } catch (error) {
    console.error("Error fetching leave summary report data:", error);
    throw error;
  }
};

const getAttendanceReportData = async (month, year, company_id) => {
  const params = { month: Number(month), year: Number(year) };
  if (company_id) params.company_id = company_id;
  const response = await axios.get('/reports/attendance-report', { params });
  return response.data;
};

const saveCoinageData = async (coinageData) => {
  const response = await axios.post(`/reports/save-coinage`, { coinage_data: coinageData });
  return response.data;
};

const saveOtCoinageData = async (coinageData) => {
  const response = await axios.post(`/reports/save-ot-coinage`, { coinage_data: coinageData, is_ot: true });
  return response.data;
};

export default { 
  getMonthlyReportData,
  getScheduleReportData,
  getLeaveSummaryData,
  getAttendanceReportData,
  saveCoinageData,
  saveOtCoinageData,
};
