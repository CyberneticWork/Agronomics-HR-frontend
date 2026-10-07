import axios from "@utils/axios";

export const listAssignedAllowances = async (params = {}) => {
  const response = await axios.get("/assign/allowances", { params });
  return response.data.data || [];
};

export const assignAllowance = async (payload) => {
  const response = await axios.post("/assign/allowances", payload);
  return response.data;
};

export const deleteAssignedAllowance = async (id) => {
  const response = await axios.delete(`/assign/allowances/${id}`);
  return response.data;
};

export const updateAssignedAllowanceAmount = async (id, amount) => {
  const response = await axios.put(`/assign/allowances/${id}`, { amount });
  return response.data;
};

export const listAssignedDeductions = async (params = {}) => {
  const response = await axios.get("/assign/deductions", { params });
  return response.data.data || [];
};

export const assignDeduction = async (payload) => {
  const response = await axios.post("/assign/deductions", payload);
  return response.data;
};

export const deleteAssignedDeduction = async (id) => {
  const response = await axios.delete(`/assign/deductions/${id}`);
  return response.data;
};

export const updateAssignedDeductionAmount = async (id, amount) => {
  const response = await axios.put(`/assign/deductions/${id}`, { amount });
  return response.data;
};
