import { create } from 'zustand';

/**
 * Global UI/session snapshot (mirrors auth profile for fast access outside React tree).
 * Source of truth for login remains AuthContext + httpOnly cookies.
 */
export const useAppStore = create((set) => ({
  user: null,
  /** Derived flags for conditional UI without prop drilling */
  permissions: {
    isAdmin: false,
    isInstructor: false,
    isStudent: false,
  },
  /** App preferences (expand as needed) */
  preferences: {
    locale: typeof navigator !== 'undefined' ? navigator.language : 'tr',
  },

  setSession: (user) => {
    const role = user?.role;
    set({
      user,
      permissions: {
        isAdmin: role === 'admin',
        isInstructor: role === 'instructor',
        isStudent: role === 'student',
      },
    });
  },

  clearSession: () => set({
    user: null,
    permissions: { isAdmin: false, isInstructor: false, isStudent: false },
  }),

  setPreference: (key, value) => set((state) => ({
    preferences: { ...state.preferences, [key]: value },
  })),
}));
