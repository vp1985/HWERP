import Tooltip from './Tooltip';

/**
 * DevTooltip - Wrapper um Tooltip für Entwickler-Hinweise
 *
 * Motivation: Zentrale Komponente für DEV-Tooltips, die technische Entscheidungen
 * und Architektur-Tradeoffs dokumentieren.
 *
 * Automatisches "DEV: "-Prefix: Text wird mit "DEV: " vorangestellt, falls nicht
 * bereits vorhanden. So ist klar, dass es sich um Entwicklerhinweise handelt.
 *
 * Für normale Benutzerhinweise: Tooltip verwenden (ohne DEV-Prefix).
 */

type Placement = 'top' | 'right' | 'bottom' | 'left';

interface DevTooltipProps {
  text: string;
  placement?: Placement;
  maxWidth?: number;
}

export default function DevTooltip({
  text,
  placement = 'top',
  maxWidth = 320
}: DevTooltipProps) {
  // Automatisch "DEV: " voranstellen, falls nicht bereits vorhanden
  const devText = text.startsWith('DEV:') ? text : `DEV: ${text}`;

  return (
    <Tooltip
      text={devText}
      placement={placement}
      maxWidth={maxWidth}
    />
  );
}
