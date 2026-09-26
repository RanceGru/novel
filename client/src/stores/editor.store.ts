// 编辑器状态管理 (Zustand)
import { create } from 'zustand';

interface EditorState {
  currentBookId: string | null;
  currentVolumeId: string | null;
  currentChapterId: string | null;
  chapterContent: string;
  chapterOutline: string;
  instruction: string;
  isGenerating: boolean;
  generationError: string | null;
  rightPanelTab: 'outline' | 'instruction' | 'review' | 'memory' | 'settings';
  showRightPanel: boolean;
  showChatPanel: boolean;
  editorZoom: number;

  setCurrentChapter: (bookId: string, volumeId: string, chapterId: string) => void;
  setContent: (content: string) => void;
  setChapterOutline: (outline: string) => void;
  setInstruction: (instruction: string) => void;
  setGenerating: (is: boolean) => void;
  setGenerationError: (error: string | null) => void;
  setRightPanelTab: (tab: EditorState['rightPanelTab']) => void;
  toggleRightPanel: () => void;
  setZoom: (zoom: number) => void;
}

export const useEditorStore = create<EditorState>()((set) => ({
  currentBookId: null,
  currentVolumeId: null,
  currentChapterId: null,
  chapterContent: '',
  chapterOutline: '',
  instruction: '',
  isGenerating: false,
  generationError: null,
  rightPanelTab: 'outline',
  showRightPanel: true,
  showChatPanel: false,
  editorZoom: 1,

  setCurrentChapter: (bookId, volumeId, chapterId) =>
    set({ currentBookId: bookId, currentVolumeId: volumeId, currentChapterId: chapterId }),

  setContent: (content) => set({ chapterContent: content }),
  setChapterOutline: (outline) => set({ chapterOutline: outline }),
  setInstruction: (instruction) => set({ instruction }),
  setGenerating: (is) => set({ isGenerating: is }),
  setGenerationError: (error) => set({ generationError: error }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  toggleRightPanel: () => set((s) => ({ showRightPanel: !s.showRightPanel })),
  setZoom: (zoom) => set({ editorZoom: Math.min(1.5, Math.max(0.75, zoom)) }),
}));
