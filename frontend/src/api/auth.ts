import apiClient from './client'
import type { LoginRequest, RegisterRequest, TokenResponse, User } from '../types/auth'

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<User>('/auth/register', data).then(r => r.data),

  login: (data: LoginRequest) =>
    apiClient.post<TokenResponse>('/auth/token', data).then(r => r.data),

  getMe: () =>
    apiClient.get<User>('/users/me').then(r => r.data),
}
