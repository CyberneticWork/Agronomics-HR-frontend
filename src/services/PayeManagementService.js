import axios from "../utils/axios";

export const getPayeRecords = async (params = {}) => {
  const response = await axios.get("/paye-management", { params });
  return response.data;
};

export const getTaxTables = async () => {
  const response = await axios.get("/paye-management/tax-tables");
  return response.data;
};

export const saveTaxTable = async (data) => {
  const response = await axios.post("/paye-management/tax-tables", data);
  return response.data;
};

export default {
  getPayeRecords,
  getTaxTables,
  saveTaxTable,
};
