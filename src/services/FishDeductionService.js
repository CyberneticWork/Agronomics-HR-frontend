import axios from "@utils/axios";

export const fetchFishDeductions = async (params = {}) => {
  const response = await axios.get("/fish-deductions", { params });
  return response.data;
};

export const fetchFishDeduction = async (id) => {
  const response = await axios.get(`/fish-deductions/${id}`);
  return response.data;
};

export const createFishDeduction = async (data) => {
  const response = await axios.post("/fish-deductions", data);
  return response.data;
};

export const updateFishDeduction = async (id, data) => {
  const response = await axios.put(`/fish-deductions/${id}`, data);
  return response.data;
};

export const deleteFishDeduction = async (id) => {
  const response = await axios.delete(`/fish-deductions/${id}`);
  return response.data;
};

export const fetchFishDeductionSummary = async (params = {}) => {
  const response = await axios.get("/fish-deductions/summary", { params });
  return response.data;
};
