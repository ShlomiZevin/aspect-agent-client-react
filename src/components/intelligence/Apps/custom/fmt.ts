/** Value formatting for custom screens — one place, both locales. */
import type { CellValue, OttoFormat } from '../../../../types/otto';

export function formatValue(value: CellValue, format: OttoFormat, locale: string): string {
  if (value === null || value === undefined || value === '') return '—';
  switch (format) {
    case 'money': {
      const n = Number(value);
      if (Number.isNaN(n)) return String(value);
      // Shekels with thousands separators, no needless decimals (₪1,240 not ₪1240.00).
      return `₪${n.toLocaleString(locale, { maximumFractionDigits: Math.abs(n) < 100 ? 2 : 0 })}`;
    }
    case 'int': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : Math.round(n).toLocaleString(locale);
    }
    case 'decimal': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : n.toLocaleString(locale, { maximumFractionDigits: 1 });
    }
    case 'percent': {
      const n = Number(value);
      return Number.isNaN(n) ? String(value) : `${n.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
    }
    case 'date': {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime())
        ? String(value)
        : d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    default:
      return String(value);
  }
}
