import API from './axios';

export const createPaymentOrder = async (data: {
    tournamentId: string;
    categoryId: string;
    // Saved on the order, so the entry is made even if verify never runs.
    profile: {
        firstName: string;
        lastName: string;
        age: number;
        gender: string;
        phone: string;
        skillLevel?: string;
    };
}) => {
    const response = await API.post('/payments/create-order', data);
    return response.data?.data?.data || response.data?.data;
};

export const verifyPayment = async (data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    profile: {
        firstName: string;
        lastName: string;
        age: number;
        gender: string;
        phone: string;
        skillLevel?: string;
    };
    basePrice?: number;
}) => {
    const response = await API.post('/payments/verify', data);
    return response.data?.data?.data || response.data?.data;
};

export const getMyPayments = async () => {
    const response = await API.get('/payments/my-payments');
    return response.data?.data?.data || response.data?.data;
};

export const getTournamentPayments = async (tournamentId: string) => {
    const response = await API.get(`/payments/tournaments/${tournamentId}`);
    return response.data?.data?.data || response.data?.data;
};
