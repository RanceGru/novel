// 右侧面板 — 写作指令编辑 & AI 生成控制
//
// 说明：章纲已不再在右栏以「快照」形式编辑，权威源统一在纲树的「章纲」（outlines.content）。
// 生成正文时使用的章纲副本由 editor.store 的 chapterOutline 提供（选中章节时载入），
// 章纲改动后只在纲树侧提示「章纲有改动」，由用户决定是否重新生成。
import { useState } from 'react';
import { useEditorStore } from '../../stores/editor.store';
import { useAuthStore } from '../../stores/auth.store';
import { Send, Loader2 } from 'lucide-react';
import VersionHistory from '../version/VersionHistory';
import AgentPanel from '../subscription/AgentPanel';

export default function RightPanel() {
  const {
    chapterOutline,
    instruction,
    setInstruction,
    isGenerating,
    setGenerating,
    setContent,
    setGenerationError,
    rightPanelTab,
    currentBookId,
    currentChapterId,
  } = useEditorStore();
  const accessToken = useAuthStore((s) => s.accessToken);

  const [targetWordCount, setTargetWordCount] = useState(2000);

  /** 发起 SSE 流式生成请求 */
  const handleGenerate = async () => {
    if (!currentBookId || !currentChapterId) return;

    setGenerating(true);
    setGenerationError(null);
    setContent(''); // 清空当前编辑器内容

    try {
      const response = await fetch('/api/v1/ai/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          bookId: currentBookId,
          chapterId: currentChapterId,
          chapterOutline,
          instruction,
          targetWordCount,
        }),
      });

      if (!response.ok) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('无法读取响应流');

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const raw = line.slice(6).trim();
            if (!raw) continue;

            try {
              const event = JSON.parse(raw);

              if (event.type === 'token') {
                accumulatedText += event.text;
                setContent(accumulatedText); // 实时更新编辑器
              } else if (event.type === 'complete') {
                // 完成后确保编辑器有完整内容
                setContent(event.fullText || accumulatedText);
                setGenerating(false);
              } else if (event.type === 'error') {
                setGenerationError(event.message);
                setGenerating(false);
              }
            } catch {
              // 忽略 JSON 解析错误（可能是 chunked 数据）
            }
          }
        }
      }
    } catch (err: any) {
      setGenerationError(err.message || '生成失败');
      setGenerating(false);
    }
  };

  return (
    <aside data-role="right-panel" className="w-80 bg-bg-secondary border-l border-border-primary flex flex-col shrink-0 overflow-hidden">
      {/* Tab 切换 */}
      <div className="flex border-b border-border-primary text-xs">
        {([
          { key: 'instruction', label: '📋 指令' },
          { key: 'review', label: '🔍 审查' },
          { key: 'memory', label: '🧠 记忆' },
          { key: 'settings', label: '⚙ 设定' },
        ] as const).map(({ key, label }) => (
          <button key={key} data-role="right-panel-tab" data-tab={key}
            className={`flex-1 py-2 text-center transition-colors ${rightPanelTab === key ? 'text-brand-primary border-b-2 border-brand-primary font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
            onClick={() => useEditorStore.getState().setRightPanelTab(key)}
          >{label}</button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {rightPanelTab === 'instruction' && (
          <>
            <label className="text-xs font-medium text-text-secondary">写作指令</label>
            <textarea
              className="w-full h-40 p-2 text-sm border border-border-primary rounded bg-bg-primary text-text-primary resize-none focus:outline-none focus:border-brand-primary"
              placeholder="对 AI 的具体写作指令...&#10;&#10;例如：&#10;- 文风要简洁有力，避免过度描写&#10;- 重点刻画主角的心理活动&#10;- 打斗场景要快速，3段以内结束"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
            />
          </>
        )}

        {rightPanelTab === 'review' && <VersionHistory />}
        {rightPanelTab === 'memory' && <AgentPanel />}
        {rightPanelTab === 'settings' && (
          <div className="text-xs space-y-2">
            <p className="font-medium text-text-secondary">⚙ 生成参数</p>
            <div className="space-y-1">
              <label className="text-text-tertiary">创造力 (temperature)</label>
              <input type="range" min="0.1" max="1.5" step="0.1" defaultValue="0.8" className="w-full" />
            </div>
            <div className="space-y-1">
              <label className="text-text-tertiary">最大字数</label>
              <input type="number" defaultValue={4096} className="w-full p-1 border rounded text-xs" />
            </div>
          </div>
        )}

        {/* 目标字数 */}
        <div>
          <label className="text-xs font-medium text-text-secondary">目标字数</label>
          <input
            type="number"
            className="w-full mt-1 p-1.5 text-sm border border-border-primary rounded bg-bg-primary text-text-primary focus:outline-none focus:border-brand-primary"
            value={targetWordCount}
            onChange={(e) => setTargetWordCount(Number(e.target.value))}
            min={500}
            max={10000}
            step={500}
          />
        </div>
      </div>

      {/* 生成按钮 */}
      <div className="p-3 border-t border-border-primary">
        {isGenerating ? (
          <button
            disabled
            className="w-full py-2 bg-brand-primary/50 text-brand-text rounded text-sm flex items-center justify-center gap-2 cursor-not-allowed"
          >
            <Loader2 size={16} className="animate-spin" />
            AI 正在生成中...
          </button>
        ) : (
          <button
            data-role="generate-content"
            className="w-full py-2 bg-brand-primary text-brand-text rounded text-sm hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
            onClick={handleGenerate}
          >
            <Send size={16} />
            生成正文
          </button>
        )}

        {/* 错误信息 */}
        {useEditorStore((s) => s.generationError) && (
          <p className="mt-2 text-xs text-error text-center">
            {useEditorStore((s) => s.generationError)}
          </p>
        )}
      </div>
    </aside>
  );
}
