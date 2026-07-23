import { sampleShiftStats, sampleShiftSummary, sampleShifts } from "./mockData";

const shiftAPI = {
  async getShiftByID(shiftId) {
    return Promise.resolve({ data: { id: shiftId, ...sampleShiftStats } });
  },
  async endShift(shiftId, actualCash, note) {
    return Promise.resolve({
      message: "Chốt ca thành công",
      data: { shiftId, actualCash, note },
    });
  },
  async getShiftReport(shiftId) {
    return Promise.resolve({
      data: { shift_id: shiftId, ...sampleShiftSummary },
    });
  },
  async getAllShifts() {
    return Promise.resolve({ data: sampleShifts });
  },
  async startShift(payload) {
    return Promise.resolve({
      message: "Mở ca thành công",
      data: { id: Date.now(), ...payload },
    });
  },
};

export default shiftAPI;
