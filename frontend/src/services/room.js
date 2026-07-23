import { sampleRoomTimeline } from "./mockData";

const roomAPI = {
  async getTimeLine(roomId) {
    return Promise.resolve({
      data: {
        room_id: roomId,
        ...sampleRoomTimeline,
      },
    });
  },
};

export default roomAPI;
