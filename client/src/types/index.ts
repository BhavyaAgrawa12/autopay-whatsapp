export interface User {
  email: string;
  role: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    accessToken: string;
    user: User;
  };
}

export interface HealthResponse {
  success: boolean;
  data: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    uptime: number;
    environment: string;
    version: string;
    database?: {
      mongodb: 'connected' | 'disconnected';
    };
  };
}

export type UIState = 'idle' | 'loading' | 'empty' | 'error' | 'success';
