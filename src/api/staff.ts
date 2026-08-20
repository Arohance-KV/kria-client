import API from './axios';

export interface StaffMember {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    isActive: boolean;
    role: string;
}

export const staffApi = {
    list: async (): Promise<StaffMember[]> => {
        const res = await API.get('/organizer/auth/staff');
        return res.data?.data?.data ?? [];
    },

    create: async (data: { firstName: string; lastName: string; email: string; phone: string }): Promise<StaffMember> => {
        const res = await API.post('/organizer/auth/staff', data);
        return res.data?.data?.data;
    },

    deactivate: (staffId: string) => API.delete(`/organizer/auth/staff/${staffId}`),
};
