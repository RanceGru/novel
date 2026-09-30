// 编辑器状态管理 (Zustand)
import { create } from 'zustand';
import { apiClient } from '../services/api.service';
import { useOutlineStore } from './outline.store';
import { useCharacterStore } from './character.store';
import { useWorldbuildingStore } from './worldbuilding.store';
import { useProjectStore } from './project.store';

/**
 * 可在中间编辑器里编辑的条目类型。
 * 这些条目分别挂在不同的左侧分区下，但都只有 title + content 两个可编辑字段，
 * 所以统一走同一套「选中 → 编辑 → 保存」流程。
 */
export type DocKind = 'book_outline' | 'volume_outline' | 'chapter_outline' | 'character_section' | 'world_setting';

/** 当前在中间编辑器里打开的条目 */
export interface SelectedDoc {
  kind: DocKind;
  id: string;
  title: string;
  /** 打开时的内容：编辑器据此显示内容并判断是否有未保存改动 */
  content: string;
  /** 是否允许改标题：大纲是单例，标题固定为「大纲」 */
  editableTitle: boolean;
}

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

  /** 左栏选中、正在中间编辑器里编辑的条目（与选中章节互斥） */
  selectedDoc: SelectedDoc | null;

  /**
   * 当前正在编辑的内容在书里的位置，形如：
   *   ['示例作品', '目录', '第1卷 分卷1', '第1章 章节1']
   * 中间编辑器左上角显示它，作用同文件管理器里的路径。
   */
  currentPath: string[];

  /** 设置当前位置（各左栏组件在打开内容时调用） */
  setCurrentPath: (path: string[]) => void;

  /**
   * 未保存的空白文本（「功能区 → 新建文本」创建）。
   * 它还不属于书里任何位置，保存时要由用户选择落到哪里。
   */
  draftText: string | null;
  /** 打开一块空白文本（与章节/条目互斥） */
  newDraft: () => void;
  setDraftText: (text: string) => void;
  /** 丢弃草稿（保存成功后或用户关闭时） */
  clearDraft: () => void;

  setCurrentChapter: (bookId: string, volumeId: string, chapterId: string) => void;
  setContent: (content: string) => void;
  setChapterOutline: (outline: string) => void;
  setInstruction: (instruction: string) => void;
  setGenerating: (is: boolean) => void;
  setGenerationError: (error: string | null) => void;
  setRightPanelTab: (tab: EditorState['rightPanelTab']) => void;
  toggleRightPanel: () => void;
  setZoom: (zoom: number) => void;

  /** 在中间编辑器打开某个条目（会清掉当前章节，两者互斥） */
  selectDoc: (doc: SelectedDoc) => void;
  closeDoc: () => void;
  /** 保存条目内容（按 kind 走各自的接口），成功后刷新对应左栏分区 */
  saveDoc: (content: string, title?: string) => Promise<void>;
}

/** 各类型条目的保存接口与保存后的刷新动作 */
function docOps(kind: DocKind, bookId: string, id: string) {
  switch (kind) {
    case 'book_outline':
      return {
        save: (content: string) => apiClient.patch(`/books/${bookId}/outlines/book-outline`, { content }),
        reload: () => useOutlineStore.getState().loadGroups(bookId),
      };
    case 'volume_outline':
    case 'chapter_outline':
      return {
        save: (content: string, title?: string) =>
          apiClient.patch(`/books/${bookId}/outlines/${id}`, title === undefined ? { content } : { content, title }),
        reload: () => useOutlineStore.getState().loadGroups(bookId),
      };
    case 'character_section':
      return {
        save: (content: string, title?: string) =>
          apiClient.patch(`/books/${bookId}/characters/sections/${id}`, title === undefined ? { content } : { content, title }),
        reload: () => useCharacterStore.getState().loadCharacters(bookId),
      };
    case 'world_setting':
      return {
        save: (content: string, title?: string) =>
          apiClient.patch(`/books/${bookId}/world-settings/${id}`, title === undefined ? { content } : { content, title }),
        reload: () => useWorldbuildingStore.getState().loadSettings(bookId),
      };
  }
}

/** 各类型条目在路径里的上一级名称 */
const KIND_PARENT: Record<DocKind, string> = {
  book_outline: '纲树',
  volume_outline: '细纲',
  chapter_outline: '细纲',
  character_section: '角色',
  world_setting: '世界观',
};

/** 拼出条目的路径：作品名 > 所在分区 > 条目名 */
function docPath(doc: SelectedDoc, bookTitle: string | undefined): string[] {
  const base = bookTitle ? [bookTitle] : [];
  // 大纲是单例，路径就到「纲树 > 大纲」，不再加自己的名字重复一次
  if (doc.kind === 'book_outline') return [...base, KIND_PARENT.book_outline];
  return [...base, KIND_PARENT[doc.kind], doc.title];
}

export const useEditorStore = create<EditorState>()((set, get) => ({
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
  selectedDoc: null,
  currentPath: [],
  draftText: null,

  setCurrentPath: (path) => set({ currentPath: path }),

  newDraft: () => set({
    draftText: '',
    // 与章节/条目互斥：草稿态下中间区域只显示这块空白文本
    selectedDoc: null,
    currentChapterId: null, currentVolumeId: null,
    chapterContent: '', chapterOutline: '', instruction: '',
    currentPath: ['未保存文本'],
  }),
  setDraftText: (text) => set({ draftText: text }),
  clearDraft: () => set({ draftText: null }),

  setCurrentChapter: (bookId, volumeId, chapterId) =>
    set((s) => ({
      currentBookId: bookId, currentVolumeId: volumeId, currentChapterId: chapterId,
      // 选中章节时关掉条目编辑与草稿，保证中间区域只显示一个东西
      selectedDoc: null, draftText: null,
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

  selectDoc: (doc) => set((s) => ({
    selectedDoc: doc,
    // 互斥：打开条目时清掉当前章节与草稿，避免中间区域同时有两份内容。
    // 注意 currentBookId 要保留 —— 保存条目时要用它拼接口路径。
    currentChapterId: null, currentVolumeId: null,
    chapterContent: '', chapterOutline: '', instruction: '',
    draftText: null,
    // 路径：作品名 > 所在分区 > 条目名
    currentPath: docPath(doc, useProjectStore.getState().currentBook?.title || undefined),
  })),
  closeDoc: () => set({ selectedDoc: null }),

  saveDoc: async (content, title) => {
    const { selectedDoc } = get();
    if (!selectedDoc) return;
    // bookId 优先取编辑器的当前作品；它只在「选中章节」时才被写入，
    // 所以再兜底取项目 store 的 currentBook（左栏选中作品时就会设置）。
    const bookId = get().currentBookId || useProjectStore.getState().currentBook?.id;
    if (!bookId) throw new Error('未选择作品');
    const ops = docOps(selectedDoc.kind, bookId, selectedDoc.id);
    await ops.save(content, title);
    await ops.reload();
    // 把保存后的内容/标题写回选中项：
    // 编辑器据此判断「未保存」，也保证标题栏不会显示旧名字
    set({
      selectedDoc: {
        ...selectedDoc,
        content,
        title: title !== undefined ? title : selectedDoc.title,
      },
    });
  },
}));
