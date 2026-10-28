import axios from "../utils/axios";

export const getOffDayHolidayRecords = async (params = {}) => {
  const response = await axios.get("/off-day-holiday-management", { params });
  return response.data;
};

export default {
  getOffDayHolidayRecords,
};
