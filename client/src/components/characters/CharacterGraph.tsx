// 角色关系图可视化 — SVG 力导向图
import { useEffect, useRef, useState } from 'react';
import { useCharacterStore } from '../../stores/character.store';

interface Node {
  id: string; label: string; category: string;
  x: number; y: number; vx: number; vy: number;
}
interface Edge { source: string; target: string; type: string; }

export default function CharacterGraph() {
  const { graph, loadGraph, loading } = useCharacterStore();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);

  // 从store加载图谱数据
  useEffect(() => {
    const bookId = (window as any).__currentBookId;
    if (bookId) loadGraph(bookId);
  }, []);

  // 将API数据转换为力导向图节点
  useEffect(() => {
    if (!graph?.nodes?.length) return;

    const w = 500, h = 350;
    const cs = graph.nodes.map((n: any, i: number) => ({
      id: n.id,
      label: n.name || n.label || n.id,
      category: n.category || 'supporting',
      x: w / 2 + (Math.random() - 0.5) * 100,
      y: h / 2 + (Math.random() - 0.5) * 100,
      vx: 0, vy: 0,
    }));
    const es = graph.edges?.map((e: any) => ({
      source: e.sourceCharId || e.source,
      target: e.targetCharId || e.target,
      type: e.relationType || e.type || '关联',
    })) || [];
    setNodes(cs);
    setEdges(es);
  }, [graph]);

  // 力导向图动画
  useEffect(() => {
    if (nodes.length === 0) return;

    let running = true;
    const tick = () => {
      if (!running) return;
      setNodes(prev => {
        const next = prev.map(n => ({ ...n }));
        // 斥力
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 500 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            next[i].vx -= fx; next[i].vy -= fy;
            next[j].vx += fx; next[j].vy += fy;
          }
        }
        // 引力（边）
        for (const e of edges) {
          const src = next.find(n => n.id === e.source);
          const tgt = next.find(n => n.id === e.target);
          if (src && tgt) {
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            src.vx += dx * 0.001;
            src.vy += dy * 0.001;
            tgt.vx -= dx * 0.001;
            tgt.vy -= dy * 0.001;
          }
        }
        // 中心引力 + 阻尼
        const cx = 250, cy = 175;
        for (const n of next) {
          n.vx += (cx - n.x) * 0.001;
          n.vy += (cy - n.y) * 0.001;
          n.vx *= 0.9; n.vy *= 0.9;
          n.x += n.vx; n.y += n.vy;
          n.x = Math.max(30, Math.min(470, n.x));
          n.y = Math.max(20, Math.min(330, n.y));
        }
        return next;
      });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [nodes.length > 0, edges]);

  const catColors: Record<string, string> = {
    protagonist: '#f59e0b',
    antagonist: '#ef4444',
    supporting: '#6366f1',
    mentor: '#10b981',
    love_interest: '#ec4899',
  };

  if (!graph?.nodes?.length) {
    return (
      <div className="text-xs text-text-tertiary p-4 text-center">
        {loading ? '加载中...' : '暂无角色关系数据'}
      </div>
    );
  }

  return (
    <div className="text-xs">
      <div className="px-3 py-1.5 border-b border-border-primary font-semibold text-text-tertiary">
        🕸 角色关系图谱
      </div>
      <svg ref={svgRef} width="100%" height="350" viewBox="0 0 500 350"
        className="bg-bg-secondary">
        {/* 边 */}
        {edges.map((e, i) => {
          const src = nodes.find(n => n.id === e.source);
          const tgt = nodes.find(n => n.id === e.target);
          if (!src || !tgt) return null;
          return (
            <g key={`edge-${i}`}>
              <line x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                stroke="#4b5563" strokeWidth={1} strokeOpacity={0.5} />
              <text x={(src.x + tgt.x) / 2} y={(src.y + tgt.y) / 2 - 4}
                textAnchor="middle" fill="#9ca3af" fontSize="9">{e.type}</text>
            </g>
          );
        })}
        {/* 节点 */}
        {nodes.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.category === 'protagonist' ? 18 : 13}
              fill={catColors[n.category] || '#6b7280'}
              stroke="#1f2937" strokeWidth={2} />
            <text x={n.x} y={n.y + 4} textAnchor="middle"
              fill="#fff" fontSize="10" fontWeight="bold">{n.label.substring(0, 3)}</text>
            <text x={n.x} y={n.y + (n.category === 'protagonist' ? 28 : 22)}
              textAnchor="middle" fill="#d1d5db" fontSize="10">{n.label}</text>
          </g>
        ))}
      </svg>
      {/* 图例 */}
      <div className="flex flex-wrap gap-2 px-2 py-1.5">
        {Object.entries(catColors).map(([cat, color]) => (
          <span key={cat} className="flex items-center gap-1 text-[10px] text-text-tertiary">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {cat === 'protagonist' ? '主角' : cat === 'antagonist' ? '反派' : cat === 'supporting' ? '配角' : cat === 'mentor' ? '导师' : cat === 'love_interest' ? '恋慕' : cat}
          </span>
        ))}
      </div>
    </div>
  );
}
