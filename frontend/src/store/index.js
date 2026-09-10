import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { authApi } from '../services/auth';
import { userApi } from '../services/user';
import { availabilityApi } from '../services/availability';
import { extraServiceApi } from '../services/extraService';
import { roomTypeApi } from '../services/roomType';
import { adminRoomApi } from '../services/adminRoom';
import { bookingApi } from '../services/booking';
import { paymentApi } from '../services/payment';
import { chatApi } from '../services/chat';
import { reviewApi } from '../services/review';
import { shiftTypeApi } from '../services/shiftType';
import { shiftAssignmentApi } from '../services/shiftAssignment';

export const store = configureStore({
    reducer: {
        // Add the generated reducer as a specific top-level slice
        [authApi.reducerPath]: authApi.reducer,
        [userApi.reducerPath]: userApi.reducer,
        [availabilityApi.reducerPath]: availabilityApi.reducer,
        [extraServiceApi.reducerPath]: extraServiceApi.reducer,
        [roomTypeApi.reducerPath]: roomTypeApi.reducer,
        [adminRoomApi.reducerPath]: adminRoomApi.reducer,
        [bookingApi.reducerPath]: bookingApi.reducer,
        [paymentApi.reducerPath]: paymentApi.reducer,
        [chatApi.reducerPath]: chatApi.reducer,
        [reviewApi.reducerPath]: reviewApi.reducer,
        [shiftTypeApi.reducerPath]: shiftTypeApi.reducer,
        [shiftAssignmentApi.reducerPath]: shiftAssignmentApi.reducer,
    },
    // Adding the api middleware enables caching, invalidation, polling,
    // and other useful features of `rtk-query`.
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware().concat(
            authApi.middleware,
            userApi.middleware,
            availabilityApi.middleware,
            extraServiceApi.middleware,
            roomTypeApi.middleware,
            adminRoomApi.middleware,
            bookingApi.middleware,
            paymentApi.middleware,
            chatApi.middleware,
            reviewApi.middleware,
            shiftTypeApi.middleware,
            shiftAssignmentApi.middleware
        ),
});

// optional, but required for refetchOnFocus/refetchOnReconnect behaviors
// see `setupListeners` docs - takes an optional callback as the 2nd arg for customization
setupListeners(store.dispatch);
