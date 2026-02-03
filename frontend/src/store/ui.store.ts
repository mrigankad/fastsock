import { create } from 'zustand';

interface UiState {
  isCreateRoomModalOpen: boolean;
  setCreateRoomModalOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCreateRoomModalOpen: false,
  setCreateRoomModalOpen: (open) => set({ isCreateRoomModalOpen: open }),
}));
