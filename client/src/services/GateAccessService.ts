import AxiosInstance from "./AxiosInstance";

const GateAccessService = {
    dashboardOverview: () => AxiosInstance.get("/dashboard/overview"),
    trafficChart: (period: string) => AxiosInstance.get(`/dashboard/traffic-chart?period=${period}`),
    gateStatus: () => AxiosInstance.get("/gate/status"),

    loadResidents: (page: number, search = "") => {
        const q = search ? `&search=${encodeURIComponent(search)}` : "";
        return AxiosInstance.get(`/resident/loadResidents?page=${page}${q}`);
    },
    storeResident: (data: Record<string, unknown>) => AxiosInstance.post("/resident/storeResident", data),
    updateResident: (id: number, data: Record<string, unknown>) => AxiosInstance.put(`/resident/updateResident/${id}`, data),
    destroyResident: (id: number) => AxiosInstance.delete(`/resident/destroyResident/${id}`),

    loadGateLogs: (page: number, filters: { direction?: string; status?: string; search?: string; period?: string } = {}) => {
        const params = new URLSearchParams({ page: String(page) });
        if (filters.direction) params.append("direction", filters.direction);
        if (filters.status) params.append("status", filters.status);
        if (filters.search) params.append("search", filters.search);
        if (filters.period) params.append("period", filters.period);
        return AxiosInstance.get(`/gate-log/loadGateLogs?${params}`);
    },

    loadActivityLogs: (page: number, filters: { event_type?: string; search?: string } = {}) => {
        const params = new URLSearchParams({ page: String(page) });
        if (filters.event_type) params.append("event_type", filters.event_type);
        if (filters.search) params.append("search", filters.search);
        return AxiosInstance.get(`/activity-log/loadActivityLogs?${params}`);
    },
    myGateLogs: (page: number, filters: { direction?: string; status?: string; search?: string; period?: string } = {}) => {
        const params = new URLSearchParams({ page: String(page) });
        if (filters.direction) params.append("direction", filters.direction);
        if (filters.status) params.append("status", filters.status);
        if (filters.search) params.append("search", filters.search);
        if (filters.period) params.append("period", filters.period);
        return AxiosInstance.get(`/gate-log/my-logs?${params}`);
    },
    exportCsv: (filters: { direction?: string; status?: string } = {}) => {
        const params = new URLSearchParams();
        if (filters.direction) params.append("direction", filters.direction);
        if (filters.status) params.append("status", filters.status);
        return AxiosInstance.get(`/gate-log/export/csv?${params}`, { responseType: "blob" });
    },
    exportPdf: (filters: { direction?: string; status?: string } = {}) => {
        const params = new URLSearchParams();
        if (filters.direction) params.append("direction", filters.direction);
        if (filters.status) params.append("status", filters.status);
        return AxiosInstance.get(`/gate-log/export/pdf?${params}`, { responseType: "blob" });
    },

    loadNotifications: (page: number) => AxiosInstance.get(`/notification?page=${page}`),
    markNotificationRead: (id: number) => AxiosInstance.put(`/notification/${id}/read`),
    markAllNotificationsRead: () => AxiosInstance.put("/notification/read-all"),
    deleteNotification: (id: number) => AxiosInstance.delete(`/notification/${id}`),

    loadUpdateRequests: (page: number, status?: string) => {
        const q = status ? `&status=${status}` : "";
        return AxiosInstance.get(`/update-request/loadRequests?page=${page}${q}`);
    },
    myUpdateRequests: (page: number) => AxiosInstance.get(`/update-request/my-requests?page=${page}`),
    submitUpdateRequest: (data: Record<string, unknown>) => AxiosInstance.post("/update-request/submit", data),
    reviewUpdateRequest: (id: number, data: { status: string; admin_notes?: string }) =>
        AxiosInstance.put(`/update-request/review/${id}`, data),
    toggleGate: (gate_status: string) => AxiosInstance.put("/gate/toggle", { gate_status }),
    updateSystemHealth: (data: {
        camera_status?: string;
        entrance_camera_status?: string;
        exit_camera_status?: string;
        sensor_status?: string;
        camera_stream_url?: string;
        entrance_camera_stream_url?: string;
        exit_camera_stream_url?: string;
    }) => AxiosInstance.put("/gate/system-health", data),
    verifyPlate: (data: FormData) => AxiosInstance.post("/gate/verify", data),
    checkPlate: (plate_number: string) =>
        AxiosInstance.get(`/gate/check-plate?plate_number=${encodeURIComponent(plate_number)}`),
    fetchCameraSnapshot: (location: "entrance" | "exit") =>
        AxiosInstance.get(`/gate/camera-snapshot?location=${location}`, { responseType: "blob" }),
    residentLogin: (payload: Record<string, string>) =>
        AxiosInstance.post("/auth/resident/login", payload),
    residentRegister: (data: Record<string, unknown>) => AxiosInstance.post("/auth/resident/register", data),
    updateProfile: (data: Record<string, unknown> | FormData) =>
        data instanceof FormData
            ? AxiosInstance.post("/auth/profile", data, { headers: { "Content-Type": "multipart/form-data" } })
            : AxiosInstance.put("/auth/profile", data),
    testConnection: (url: string) => AxiosInstance.post("/gate/test-connection", { url }),
};

export default GateAccessService;
