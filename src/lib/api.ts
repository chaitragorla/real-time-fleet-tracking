const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export type UserRole = 'customer' | 'superadmin';

export interface LegacyUser {
  id: number | string;
  phone_number: string;
  full_name: string;
  email?: string;
  employee_id?: string;
  role: UserRole;
  created_at?: string;
}

export interface LegacyDevice {
  id: number;
  device_code: string;
  qr_code: string;
  created_at: string;
  is_active: boolean;
  allocated_to_customer_id: number | null;
  allocated_to_customer_name: string | null;
  allocated_at: string | null;
  device_name: string | null;
  device_icon?: string | null;
  device_m2m_number?: string | null;
}

export interface GpsPoint {
  id: string | number;
  device_code: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  user_id?: number;
}

interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  count?: number;
  message?: string;
  error?: string;
  accessToken?: string;
  sessionToken?: string;
  user?: {
    id: number | string;
    phoneNumber?: string;
    email?: string;
    name?: string;
    role?: UserRole;
    employee_id?: string;
    employeeId?: string;
  };
}

export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(options.headers);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload.message || payload.error || `Request failed with status ${response.status}`);
  }

  return payload as T;
}

const withQuery = (path: string, params: Record<string, string | number | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  const qs = query.toString();
  return qs ? `${path}?${qs}` : path;
};

export const api = {
  auth: {
    login: (body: { email: string; password: string; role?: UserRole }) =>
      apiRequest<ApiEnvelope<unknown>>('/v1/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    register: (body: { email: string; password: string; fullName: string; role?: UserRole; phone_number?: string }) =>
      apiRequest<ApiEnvelope<unknown>>('/v1/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    profile: (sessionToken: string) => apiRequest<ApiEnvelope<unknown>>(`/v1/auth/profile/${sessionToken}`),
  },
  users: {
    list: (role?: UserRole) => apiRequest<ApiEnvelope<LegacyUser[]>>(withQuery('/v1/users', { role })),
    byPhone: (phoneNumber: string, role?: UserRole) =>
      apiRequest<ApiEnvelope<LegacyUser | null>>(withQuery(`/v1/users/by-phone/${phoneNumber}`, { role })),
    create: (body: {
      phone_number: string;
      full_name?: string;
      name?: string;
      email?: string;
      role?: UserRole;
      employee_id?: string;
    }) => apiRequest<ApiEnvelope<LegacyUser>>('/v1/users', { method: 'POST', body: JSON.stringify(body) }),
    remove: (legacyId: number | string, role?: UserRole) =>
      apiRequest<ApiEnvelope<unknown>>(withQuery(`/v1/users/${legacyId}`, { role }), { method: 'DELETE' }),
    loginLogs: (limit = 100) =>
      apiRequest<ApiEnvelope<Array<{ id: string; employee_id: string; login_time: string }>>>(
        withQuery('/v1/users/login-logs', { limit }),
      ),
    createLoginLog: (employeeId: string) =>
      apiRequest<ApiEnvelope<unknown>>('/v1/users/login-logs', {
        method: 'POST',
        body: JSON.stringify({ employee_id: employeeId }),
      }),
  },
  devices: {
    list: () => apiRequest<ApiEnvelope<LegacyDevice[]>>('/v1/devices'),
    active: () => apiRequest<{ status: string; count: number; devices: LegacyDevice[] }>('/v1/devices/active'),
    create: (body: { count?: number; devices?: Array<{ device_code: string; qr_code?: string; is_active?: boolean }> }) =>
      apiRequest<ApiEnvelope<LegacyDevice[]>>('/v1/devices', { method: 'POST', body: JSON.stringify(body) }),
    getByCode: (deviceCode: string) => apiRequest<ApiEnvelope<LegacyDevice | null>>(`/v1/devices/code/${deviceCode}`),
    byOwner: (ownerId: number | string) => apiRequest<ApiEnvelope<LegacyDevice[]>>(`/v1/devices/owner/${ownerId}`),
    received: (userId: number | string) => apiRequest<ApiEnvelope<any[]>>(`/v1/devices/received/${userId}`),
    sent: (ownerId: number | string) => apiRequest<ApiEnvelope<any[]>>(`/v1/devices/sent/${ownerId}`),
    updateByCode: (deviceCode: string, body: Partial<{
      device_name: string | null;
      device_icon: string | null;
      device_m2m_number: string | null;
      is_active: boolean;
    }>) => apiRequest<ApiEnvelope<LegacyDevice>>(`/v1/devices/${deviceCode}`, { method: 'PATCH', body: JSON.stringify(body) }),
    updateById: (legacyId: number | string, body: Partial<{
      device_name: string | null;
      device_icon: string | null;
      device_m2m_number: string | null;
      is_active: boolean;
    }>) => apiRequest<ApiEnvelope<LegacyDevice>>(`/v1/devices/id/${legacyId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    allocate: (deviceCode: string, body: {
      allocated_to_customer_id: number;
      allocated_to_customer_name: string;
      device_name?: string;
      device_icon?: string;
    }) => apiRequest<ApiEnvelope<LegacyDevice>>(`/v1/devices/${deviceCode}/allocate`, { method: 'POST', body: JSON.stringify(body) }),
    claim: (deviceCode: string, customerId: number, deviceName?: string, deviceIcon?: string) =>
      apiRequest<ApiEnvelope<LegacyDevice>>(`/v1/devices/${deviceCode}/claim`, { method: 'POST', body: JSON.stringify({ customer_id: customerId, device_name: deviceName, device_icon: deviceIcon }) }),
    share: (deviceCode: string, phoneNumber: string) =>
      apiRequest<ApiEnvelope<unknown>>(`/v1/devices/${deviceCode}/share`, {
        method: 'POST',
        body: JSON.stringify({ phone_number: phoneNumber }),
      }),
    revokeShare: (shareId: number | string) =>
      apiRequest<ApiEnvelope<unknown>>(`/v1/devices/shares/${shareId}`, { method: 'DELETE' }),
    deleteById: (legacyId: number | string) =>
      apiRequest<ApiEnvelope<unknown>>(`/v1/devices/id/${legacyId}`, { method: 'DELETE' }),
    unassign: (legacyId: number | string) =>
      apiRequest<ApiEnvelope<LegacyDevice>>(`/v1/devices/id/${legacyId}/unassign`, { method: 'POST' }),
    unassignAll: (ownerId: number | string) =>
      apiRequest<ApiEnvelope<unknown>>(`/v1/devices/owner/${ownerId}/unassign-all`, { method: 'POST' }),
  },
  gps: {
    updateLocation: (body: Record<string, unknown>) =>
      apiRequest<ApiEnvelope<unknown>>('/v1/gps-signal/update-location', { method: 'POST', body: JSON.stringify(body) }),
    deviceData: (deviceCode: string) =>
      apiRequest<ApiEnvelope<GpsPoint[]>>(`/v1/gps-signal/device/${deviceCode}/data`),
    clear: (deviceCode: string) =>
      apiRequest<{ success?: boolean; deletedCount?: number; message?: string }>(`/v1/gps-signal/device/${deviceCode}/clear`, {
        method: 'DELETE',
      }),
  },

  /**
   * Simulator REST endpoints.
   * These control the GPS simulation engine on the backend.
   * When replacing the simulator with a real GPS device,
   * only this section needs to change — the frontend (SimulatorMap) stays identical.
   */
  simulator: {
    /** Start a simulation: { vehicleId, routeId, speedMultiplier?, updateIntervalMs? } */
    start: (body: {
      vehicleId: string;
      routeId: string;
      speedMultiplier?: number;
      updateIntervalMs?: number;
    }) =>
      apiRequest<{ success: boolean; vehicle: unknown }>('/v1/simulator/start', {
        method: 'POST',
        body: JSON.stringify(body),
      }),

    /** Stop a running simulation */
    stop: (vehicleId: string) =>
      apiRequest<{ success: boolean; message: string }>(`/v1/simulator/stop/${vehicleId}`, {
        method: 'POST',
      }),

    /** Pause a running simulation (vehicle stays in memory) */
    pause: (vehicleId: string) =>
      apiRequest<{ success: boolean; vehicle: unknown }>(`/v1/simulator/pause/${vehicleId}`, {
        method: 'POST',
      }),

    /** Resume a paused simulation */
    resume: (vehicleId: string) =>
      apiRequest<{ success: boolean; vehicle: unknown }>(`/v1/simulator/resume/${vehicleId}`, {
        method: 'POST',
      }),

    /** Change speed multiplier without stopping the simulation */
    changeSpeed: (vehicleId: string, multiplier: number) =>
      apiRequest<{ success: boolean; vehicle: unknown }>(`/v1/simulator/${vehicleId}/speed`, {
        method: 'PATCH',
        body: JSON.stringify({ multiplier }),
      }),

    /** Reset the vehicle back to the beginning of its route */
    reset: (vehicleId: string) =>
      apiRequest<{ success: boolean; vehicle: unknown }>(`/v1/simulator/${vehicleId}/reset`, {
        method: 'POST',
      }),

    /** Get current telemetry for all active simulated vehicles */
    vehicles: () =>
      apiRequest<{ success: boolean; count: number; vehicles: unknown[] }>('/v1/simulator/vehicles'),

    /** Get current telemetry for a specific vehicle */
    vehicleById: (vehicleId: string) =>
      apiRequest<{ success: boolean; vehicle: unknown }>(`/v1/simulator/vehicles/${vehicleId}`),

    /** Get only the current lat/lng/status (lightweight) */
    currentLocation: (vehicleId: string) =>
      apiRequest<{ success: boolean; location: unknown }>(`/v1/simulator/vehicles/${vehicleId}/location`),

    /** Full telemetry history since the simulation started */
    history: (vehicleId: string) =>
      apiRequest<{ success: boolean; count: number; history: unknown[] }>(
        `/v1/simulator/vehicles/${vehicleId}/history`,
      ),

    /** List all available predefined routes */
    routes: () =>
      apiRequest<{ success: boolean; routes: Array<{ id: string; name: string; description: string; distanceKm: number }> }>(
        '/v1/simulator/routes',
      ),
  },
};
