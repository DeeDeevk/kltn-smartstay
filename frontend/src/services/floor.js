import { sampleFloors } from "./mockData";

const floorAPI = {
  async getAll() {
    return Promise.resolve({ data: sampleFloors });
  },
};

export default floorAPI;
