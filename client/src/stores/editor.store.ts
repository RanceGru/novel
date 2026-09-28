// 编辑器状态管理 (Zustand)
import { create } from 'zustand';

interface EditorState {
  currentBookId: string | null;
  currentVolumeId: string | null;
  currentChapterId: string | null;
  chapterContent: string;
  chapterOutline: string;
  /** 章节纲/当前章节的变化计数，纲树据此刷新「章纲有改动」状态 */
  outlineVersion: number;
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
  /** 章节纲/当前章节的变化计数，纲树据此刷新「章纲有改动」状态 */
  outlineVersion: 0,
  instruction: '',
  isGenerating: false,
  generationError: null,
  rightPanelTab: 'outline',
  showRightPanel: true,
  showChatPanel: false,
  editorZoom: 1,

  setCurrentChapter: (bookId, volumeId, chapterId) =>
    set((s) => ({
      currentBookId: bookId, currentVolumeId: volumeId, currentChapterId: chapterId,
      // 切换章节也应让纲树重新拉取（章纲快照指纹可能不同）
      outlineVersion: s.outlineVersion + 1,
    })),

  setContent: (content) => set({ chapterContent: content }),
  // 章节纲（快照）变化时递增版本号，供纲树感知并重新拉取「章纲有改动」状态
  setChapterOutline: (outline) => set((s) => ({ chapterOutline: outline, outlineVersion: s.outlineVersion + 1 })),
  setInstruction: (instruction) => set({ instruction }),
  setGenerating: (is) => set({ isGenerating: is }),
  setGenerationError: (error) => set({ generationError: error }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  toggleRightPanel: () => set((s) => ({ showRightPanel: !s.showRightPanel })),
  setZoom: (zoom) => set({ editorZoom: Math.min(1.5, Math.max(0.75, zoom)) }),
}));
