import { Tag } from '../types/tag';
import { X } from 'lucide-react';

interface TagBadgeProps {
  tag: Tag; size?: 'sm' | 'md'; showCode?: boolean; onRemove?: () => void;
}

export default function TagBadge({ tag, size = 'md', showCode = false, onRemove }: TagBadgeProps) {
  if (!tag) return null;
  const text = showCode && tag.code ? tag.code : tag.name;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';
  const style = tag.color ? { backgroundColor: tag.color, color: '#ffffff' } : undefined;
  const fallbackClasses = !tag.color ? 'bg-gray-200 text-gray-700' : '';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${fallbackClasses}`} style={style} title={tag.code ? `${tag.name} (${tag.code})` : tag.name}>
      <span>{text}</span>
      {onRemove && (<button type="button" className="hover:opacity-70 transition-opacity" onClick={(e) => { e.stopPropagation(); onRemove(); }}><X size={size === 'sm' ? 12 : 14} /></button>)}
    </span>
  );
}

export { TagBadge };
