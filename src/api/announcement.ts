import API from './axios';

export type AnnouncementSeverity = 'info' | 'important' | 'schedule_change';

export interface Announcement {
    _id: string;
    tournamentId: string;
    title?: string;
    message: string;
    severity: AnnouncementSeverity;
    pinned: boolean;
    authorName: string;
    authorRole: string;
    createdAt: string;
    updatedAt: string;
}

export interface AnnouncementInput {
    title?: string;
    message: string;
    severity?: AnnouncementSeverity;
    pinned?: boolean;
}

// Server envelope: res.data.data.data holds the SuccessResponse payload.
const unwrap = (res: any) => res.data?.data?.data ?? res.data?.data;

export const announcementApi = {
    list: async (tournamentId: string): Promise<Announcement[]> => {
        const res = await API.get(`/tournaments/${tournamentId}/announcements`);
        const data = unwrap(res);
        return Array.isArray(data) ? data : [];
    },
    create: (tournamentId: string, data: AnnouncementInput) =>
        API.post(`/tournaments/${tournamentId}/announcements`, data),
    update: (id: string, data: Partial<AnnouncementInput>) =>
        API.put(`/announcements/${id}`, data),
    remove: (id: string) => API.delete(`/announcements/${id}`),
};
