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

const saveCoinageData = async (coinageData) => {
  const response = await axios.post(`/reports/save-coinage`, { coinage_data: coinageData });
  return response.data;
};

export default { 
  getMonthlyReportData,
  getScheduleReportData,
  saveCoinageData,
};
