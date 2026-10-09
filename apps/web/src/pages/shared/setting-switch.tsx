import { useId } from 'react';

import { InputSwitch } from '@kodinga-mono-repo/ui';

type Props = {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

/** Labelled on/off row (InputSwitch has no visible label of its own) */
function SettingSwitch({ label, description, checked, onCheckedChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <p id={`${id}-label`} className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p id={`${id}-desc`} className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      <InputSwitch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
      />
    </div>
  );
}

export default SettingSwitch;
