import { BaseEntity } from '../lib/repository';

export type TagContext = 'ASSETS' | 'MATERIALS' | 'SERVICES' | 'CALC_ITEMS' | 'CONTACTS' | 'LOCATIONS';

export interface Tag extends BaseEntity {
  name: string;
  code?: string;
  color?: string;
  suggestedContexts: TagContext[];
  blockedContexts: TagContext[];
}

export const TAG_COLORS = [
  { hex: '#3B82F6', name: 'Blau', bg: 'bg-blue-500', text: 'text-white' },
  { hex: '#10B981', name: 'Grün', bg: 'bg-green-500', text: 'text-white' },
  { hex: '#F59E0B', name: 'Orange', bg: 'bg-amber-500', text: 'text-white' },
  { hex: '#EF4444', name: 'Rot', bg: 'bg-red-500', text: 'text-white' },
  { hex: '#8B5CF6', name: 'Lila', bg: 'bg-violet-500', text: 'text-white' },
  { hex: '#EC4899', name: 'Pink', bg: 'bg-pink-500', text: 'text-white' },
  { hex: '#14B8A6', name: 'Türkis', bg: 'bg-teal-500', text: 'text-white' },
  { hex: '#F97316', name: 'Orange-Rot', bg: 'bg-orange-500', text: 'text-white' },
  { hex: '#06B6D4', name: 'Cyan', bg: 'bg-cyan-500', text: 'text-white' },
  { hex: '#84CC16', name: 'Limette', bg: 'bg-lime-500', text: 'text-white' },
  { hex: '#6366F1', name: 'Indigo', bg: 'bg-indigo-500', text: 'text-white' },
  { hex: '#64748B', name: 'Grau', bg: 'bg-slate-500', text: 'text-white' },
] as const;
