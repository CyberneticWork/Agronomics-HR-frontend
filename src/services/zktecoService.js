import axios from "@utils/axios";

const zktecoService = {
  listDevices: async () => {
    const res = await axios.get("/zkteco/devices");
    return res.data?.data ?? [];
  },

  createDevice: async (payload) => {
    const res = await axios.post("/zkteco/devices", payload);
    return res.data;
  },

  updateDevice: async (id, payload) => {
    const res = await axios.put(`/zkteco/devices/${id}`, payload);
    return res.data;
  },

  deleteDevice: async (id) => {
    const res = await axios.delete(`/zkteco/devices/${id}`);
    return res.data;
  },

  getEventLogs: async (id, limit = 20) => {
    const res = await axios.get(`/zkteco/devices/${id}/logs`, { params: { limit } });
    return res.data?.data ?? [];
  },

  getSetupGuide: async () => {
    const res = await axios.get("/zkteco/setup-guide");
    return res.data?.data ?? res.data;
  },
};

export default zktecoService;
