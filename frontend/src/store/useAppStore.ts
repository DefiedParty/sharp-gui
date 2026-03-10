import { create } from 'zustand';
import type { GalleryItem, Task, ModelFormat } from '@/types';

// localStorage keys for client-side preference overrides
const LOCAL_FORMAT_KEY = 'sharp-model-format';
const LOCAL_LOD_KEY = 'sharp-lod-enabled';
const LOCAL_HF_KEY = 'sharp-high-fidelity';

function getLocalFormatOverride(): ModelFormat | null {
  try {
    const v = localStorage.getItem(LOCAL_FORMAT_KEY);
    if (v === 'ply' || v === 'spz') return v;
  } catch { /* ignore */ }
  return null;
}

function getLocalLodSetting(): boolean {
  try {
    return localStorage.getItem(LOCAL_LOD_KEY) === 'true';
  } catch { /* ignore */ }
  return false;
}

function getLocalHfSetting(): boolean {
  try {
    return localStorage.getItem(LOCAL_HF_KEY) === 'true';
  } catch { /* ignore */ }
  return false;
}

interface AppState {
  // UI State
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  controlsCollapsed: boolean;
  helpPanelVisible: boolean;
  settingsModalOpen: boolean;

  // Loading State
  isLoading: boolean;
  loadingText: string;
  loadingProgress: number;

  // Boot State
  isBooting: boolean;
  bootError: string | null;

  // Gallery
  galleryItems: GalleryItem[];
  currentModelId: string | null;
  currentModelUrl: string | null;
  currentModelFormat: 'ply' | 'splat' | 'spz' | null; // Format hint for blob URLs

  // Model Format Preference
  serverModelFormat: ModelFormat;        // Host default from config.json
  localModelFormat: ModelFormat | null;  // Client override via localStorage

  // Task Queue
  tasks: Task[];
  hasActiveTasks: boolean;

  // Viewer
  isLimitsOn: boolean;
  isGyroEnabled: boolean;
  isJoystickEnabled: boolean;
  isLodEnabled: boolean;
  isHighFidelity: boolean;

  // Settings
  isLocalAccess: boolean;

  // Computed
  /** Effective format: client override > server default */
  effectiveModelFormat: () => ModelFormat;

  // Actions
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  toggleSidebarCollapsed: () => void;
  toggleControlsCollapsed: () => void;
  toggleHelpPanel: () => void;
  setSettingsModalOpen: (open: boolean) => void;

  setLoading: (loading: boolean, text?: string) => void;
  setLoadingProgress: (progress: number) => void;

  setBootComplete: () => void;
  setBootError: (error: string) => void;

  setGalleryItems: (items: GalleryItem[]) => void;
  setCurrentModel: (id: string | null, url: string | null, format?: 'ply' | 'splat' | 'spz' | null) => void;

  setServerModelFormat: (format: ModelFormat) => void;
  setLocalModelFormat: (format: ModelFormat | null) => void;
  toggleLocalModelFormat: () => void;

  setTasks: (tasks: Task[], hasActive: boolean) => void;

  toggleLimits: () => void;
  toggleGyro: () => void;
  toggleJoystick: () => void;
  toggleLod: () => void;
  toggleHighFidelity: () => void;

  setLocalAccess: (isLocal: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  sidebarOpen: false,
  sidebarCollapsed: false,
  controlsCollapsed: false,
  helpPanelVisible: false,
  settingsModalOpen: false,

  isLoading: false,
  loadingText: '',
  loadingProgress: 0,

  isBooting: true,
  bootError: null,

  galleryItems: [],
  currentModelId: null,
  currentModelUrl: null,
  currentModelFormat: null,

  // Model Format Preference
  serverModelFormat: 'spz',
  localModelFormat: getLocalFormatOverride(),

  tasks: [],
  hasActiveTasks: false,

  isLimitsOn: true,
  isGyroEnabled: false,
  isJoystickEnabled: false,
  isLodEnabled: getLocalLodSetting(),
  isHighFidelity: getLocalHfSetting(),

  isLocalAccess: false,

  // Computed: client override > server default
  effectiveModelFormat: () => {
    const state = get();
    return state.localModelFormat ?? state.serverModelFormat;
  },

  // Actions
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleControlsCollapsed: () => set((state) => ({ controlsCollapsed: !state.controlsCollapsed })),
  toggleHelpPanel: () => set((state) => ({ helpPanelVisible: !state.helpPanelVisible })),
  setSettingsModalOpen: (open) => set({ settingsModalOpen: open }),

  setLoading: (loading, text = '') => set((state) => ({
    isLoading: loading,
    loadingText: text,
    loadingProgress: loading
      ? (state.isLoading ? state.loadingProgress : 0)
      : 0,
  })),
  setLoadingProgress: (progress) => set((state) => ({
    loadingProgress: Math.max(state.loadingProgress, progress),
  })),

  setBootComplete: () => set({ isBooting: false }),
  setBootError: (error) => set({ bootError: error }),

  setGalleryItems: (items) => set({ galleryItems: items }),
  setCurrentModel: (id, url, format = null) => set({ currentModelId: id, currentModelUrl: url, currentModelFormat: format }),

  setServerModelFormat: (format) => set({ serverModelFormat: format }),
  setLocalModelFormat: (format) => {
    if (format) {
      try { localStorage.setItem(LOCAL_FORMAT_KEY, format); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(LOCAL_FORMAT_KEY); } catch { /* ignore */ }
    }
    set({ localModelFormat: format });
  },
  toggleLocalModelFormat: () => {
    const state = get();
    const current = state.localModelFormat ?? state.serverModelFormat;
    const next: ModelFormat = current === 'spz' ? 'ply' : 'spz';
    // Set as local override
    try { localStorage.setItem(LOCAL_FORMAT_KEY, next); } catch { /* ignore */ }
    set({ localModelFormat: next });
  },

  setTasks: (tasks, hasActive) => set({ tasks, hasActiveTasks: hasActive }),

  toggleLimits: () => set((state) => ({ isLimitsOn: !state.isLimitsOn })),
  toggleGyro: () => set((state) => ({ isGyroEnabled: !state.isGyroEnabled })),
  toggleJoystick: () => set((state) => ({ isJoystickEnabled: !state.isJoystickEnabled })),
  toggleLod: () => {
    const next = !get().isLodEnabled;
    try { localStorage.setItem(LOCAL_LOD_KEY, String(next)); } catch { /* ignore */ }
    set({ isLodEnabled: next });
  },
  toggleHighFidelity: () => {
    const next = !get().isHighFidelity;
    try { localStorage.setItem(LOCAL_HF_KEY, String(next)); } catch { /* ignore */ }
    set({ isHighFidelity: next });
  },

  setLocalAccess: (isLocal) => set({ isLocalAccess: isLocal }),
}));
