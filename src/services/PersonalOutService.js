import axios from "@utils/axios";

const PersonalOutService = {
  async list(params) {
    const { data } = await axios.get("/personal-out", { params });
    return data?.data || [];
  },
  async employees(params) {
    const { data } = await axios.get("/personal-out/employees", { params });
    return data?.data || [];
  },
  async preview(params) {
    const { data } = await axios.get("/personal-out/preview", { params });
    return data;
  },
  async create(payload) {
    const { data } = await axios.post("/personal-out", payload);
    return data;
  },
  async remove(id) {
    const { data } = await axios.delete(`/personal-out/${id}`);
    return data;
  },
};

export default PersonalOutService;
