/**
 * Filter row editor. Each filter targets a dimension with an operator and
 * value(s). Text-dimension values are fetched on demand from the server
 * (distinct-value picker); numeric/date dimensions get a free-text input.
 */
import { useEffect, useState } from 'react';
import type { Dimension, Filter, FilterOp } from '../../../types/bi';
import { biService } from '../../../services/biService';
import styles from './FilterEditor.module.css';

const OPS_BY_TYPE: Record<string, { op: FilterOp; label: string }[]> = {
  text: [
    { op: 'in', label: 'is any of' },
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'contains', label: 'contains' },
    { op: 'not_null', label: 'is set' },
  ],
  number: [
    { op: 'eq', label: '=' }, { op: 'gte', label: '≥' }, { op: 'lte', label: '≤' },
    { op: 'between', label: 'between' },
  ],
  date: [
    { op: 'gte', label: 'on or after' }, { op: 'lte', label: 'on or before' },
    { op: 'between', label: 'between' },
  ],
};

interface Props {
  datasetId: string;
  dimensions: Dimension[];
  filters: Filter[];
  onChange: (filters: Filter[]) => void;
}

export function FilterEditor({ datasetId, dimensions, filters, onChange }: Props) {
  const [adding, setAdding] = useState(false);

  const addFilter = (fieldId: string) => {
    const dim = dimensions.find(d => d.id === fieldId);
    if (!dim) return;
    const op = OPS_BY_TYPE[dim.type][0].op;
    onChange([...filters, { field: fieldId, op, values: [] }]);
    setAdding(false);
  };

  const update = (i: number, patch: Partial<Filter>) => {
    onChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  };
  const remove = (i: number) => onChange(filters.filter((_, idx) => idx !== i));

  return (
    <div className={styles.bar}>
      {filters.map((f, i) => {
        const dim = dimensions.find(d => d.id === f.field);
        if (!dim) return null;
        return (
          <FilterChip
            key={i}
            datasetId={datasetId}
            dim={dim}
            filter={f}
            onUpdate={patch => update(i, patch)}
            onRemove={() => remove(i)}
          />
        );
      })}

      {adding ? (
        <select className={styles.addSelect} autoFocus defaultValue=""
          onChange={e => e.target.value && addFilter(e.target.value)}
          onBlur={() => setAdding(false)}>
          <option value="" disabled>Choose field…</option>
          {dimensions.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
        </select>
      ) : (
        <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Filter</button>
      )}
    </div>
  );
}

function FilterChip({ datasetId, dim, filter, onUpdate, onRemove }: {
  datasetId: string; dim: Dimension; filter: Filter;
  onUpdate: (patch: Partial<Filter>) => void; onRemove: () => void;
}) {
  const ops = OPS_BY_TYPE[dim.type] || OPS_BY_TYPE.text;
  const needsValue = !['is_null', 'not_null'].includes(filter.op);
  const multi = filter.op === 'in' || filter.op === 'not_in';

  return (
    <div className={styles.chip}>
      <span className={styles.field}>{dim.label}</span>
      <select className={styles.op} value={filter.op}
        onChange={e => onUpdate({ op: e.target.value as FilterOp, values: [] })}>
        {ops.map(o => <option key={o.op} value={o.op}>{o.label}</option>)}
      </select>

      {needsValue && (dim.type === 'text' && multi
        ? <ValuePicker datasetId={datasetId} fieldId={dim.id} values={filter.values as string[]}
            onChange={values => onUpdate({ values })} />
        : filter.op === 'between'
          ? <>
              <input className={styles.input} placeholder="from" value={String(filter.values[0] ?? '')}
                onChange={e => onUpdate({ values: [e.target.value, filter.values[1] ?? ''] })} />
              <input className={styles.input} placeholder="to" value={String(filter.values[1] ?? '')}
                onChange={e => onUpdate({ values: [filter.values[0] ?? '', e.target.value] })} />
            </>
          : dim.type === 'text'
            ? <ValuePicker datasetId={datasetId} fieldId={dim.id} single values={filter.values as string[]}
                onChange={values => onUpdate({ values })} />
            : <input className={styles.input} placeholder="value" value={String(filter.values[0] ?? '')}
                onChange={e => onUpdate({ values: [e.target.value] })} />
      )}

      <button className={styles.remove} onClick={onRemove} title="Remove filter">×</button>
    </div>
  );
}

/** Distinct-value picker backed by /datasets/:id/values/:field. */
function ValuePicker({ datasetId, fieldId, values, single, onChange }: {
  datasetId: string; fieldId: string; values: string[]; single?: boolean;
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      biService.fieldValues(datasetId, fieldId, search || undefined)
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, search, datasetId, fieldId]);

  const toggle = (v: string) => {
    if (single) { onChange([v]); setOpen(false); return; }
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v]);
  };

  const label = values.length === 0 ? 'any' : values.length === 1 ? values[0] : `${values.length} selected`;

  return (
    <div className={styles.picker}>
      <button className={styles.pickerBtn} onClick={() => setOpen(o => !o)}>{label} ▾</button>
      {open && (
        <div className={styles.dropdown}>
          <input className={styles.search} autoFocus placeholder="Search…" value={search}
            onChange={e => setSearch(e.target.value)} />
          <div className={styles.options}>
            {loading && <div className={styles.hint}>Loading…</div>}
            {!loading && options.length === 0 && <div className={styles.hint}>No values</div>}
            {options.map(o => (
              <label key={o} className={styles.option}>
                <input type={single ? 'radio' : 'checkbox'} checked={values.includes(o)} onChange={() => toggle(o)} />
                <span>{o}</span>
              </label>
            ))}
          </div>
          <button className={styles.done} onClick={() => setOpen(false)}>Done</button>
        </div>
      )}
    </div>
  );
}
