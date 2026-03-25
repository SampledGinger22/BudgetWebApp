import { create } from 'zustand'

interface AuthUser {
  id: string
  email: string
  name?: string | null
}

interface AuthState {
  user: AuthUser | null
  householdId: number | null
  setUser: (user: AuthUser, householdId: number | null) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  householdId: null,
  setUser: (user, householdId) => set({ user, householdId }),
  clearUser: () => set({ user: null, householdId: null }),
}))
