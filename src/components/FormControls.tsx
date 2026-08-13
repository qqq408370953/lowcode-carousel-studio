interface RangeFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}

export function RangeField({label, value, min, max, step = 1, onChange}: RangeFieldProps) {
  return (
    <label>
      <span className="field-label"><span>{label}</span><output>{Number(value).toFixed(step < 1 ? 2 : 0)}</output></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}
