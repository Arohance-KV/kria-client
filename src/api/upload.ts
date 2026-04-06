import API from './axios';

export const uploadImage = async (file: File, folder: string): Promise<string> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await API.post(`/upload/image?folder=${folder}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    const url = response.data?.data?.data?.url || response.data?.data?.url;
    if (!url) throw new Error('Upload failed: no URL returned');
    return url;
};
