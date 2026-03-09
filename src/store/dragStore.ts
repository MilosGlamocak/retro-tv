import { create } from 'zustand'

interface DragStore {
  isDragging: boolean
  setDragging: (v: boolean) => void
}

export const useDragStore = create<DragStore>((set) => ({
  isDragging: false,
  setDragging: (v) => set({ isDragging: v }),
}))