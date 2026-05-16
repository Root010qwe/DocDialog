import apiClient from './client'

export interface Member {
  user_id: string
  email: string
  full_name: string | null
  role: 'owner' | 'editor' | 'viewer'
}

export const rolesApi = {
  listMembers: (collectionId: string) =>
    apiClient.get<Member[]>(`/collections/${collectionId}/members`).then(r => r.data),

  addMember: (collectionId: string, email: string, role: 'editor' | 'viewer') =>
    apiClient
      .post<Member>(`/collections/${collectionId}/members`, { email, role })
      .then(r => r.data),

  updateMember: (collectionId: string, userId: string, role: 'editor' | 'viewer' | 'owner') =>
    apiClient
      .patch<Member>(`/collections/${collectionId}/members/${userId}`, { role })
      .then(r => r.data),

  removeMember: (collectionId: string, userId: string) =>
    apiClient.delete(`/collections/${collectionId}/members/${userId}`),
}
