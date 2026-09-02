import { DEFAULT_TYPEFACE, Typeface } from './annotation-constants';

const STACKS: Record<Typeface, string> = {
  sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  condensed: '"Arial Narrow", "Helvetica Condensed", "Segoe UI Condensed", sans-serif',
};

export function typefaceStack(typeface: string): string {
  return STACKS[typeface as Typeface] ?? STACKS[DEFAULT_TYPEFACE];
}
