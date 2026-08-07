/**
 * DEV: Money formatting component with optional masking for price visibility
 */

interface MoneyProps {
  value: number;
  hidden?: boolean;
  reveal?: boolean;
}

export function Money({ value, hidden = false, reveal = false }: MoneyProps) {
  if (hidden && !reveal) {
    return <span className="text-gray-400 font-mono">•••</span>;
  }

  return (
    <span className="font-mono text-gray-900">
      {new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
      }).format(value)}
    </span>
  );
}
