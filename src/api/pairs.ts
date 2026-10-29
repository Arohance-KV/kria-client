import API from './axios';
import type { PairingState } from '@/lib/pairs';

// Every pairing route answers with the category's whole pairing state.
const state = (res: any): PairingState => res.data?.data?.data ?? res.data?.data;

export const getPairs = async (categoryId: string) =>
    state(await API.get(`/registrations/categories/${categoryId}/pairs`));

export const pairPlayers = async (categoryId: string, a: string, b: string) =>
    state(await API.post(`/registrations/categories/${categoryId}/pairs`, { registrationIds: [a, b] }));

export const unpairPlayer = async (registrationId: string) =>
    state(await API.delete(`/registrations/${registrationId}/partner`));

export const changePartner = async (registrationId: string, partnerRegistrationId: string) =>
    state(await API.put(`/registrations/${registrationId}/partner`, { partnerRegistrationId }));
