import {Images, PanelsTopLeft, SlidersHorizontal} from 'lucide-react';

export type MobilePane = 'assets' | 'editor' | 'inspector';

interface MobileNavProps {
  activePane: MobilePane;
  onChange: (pane: MobilePane) => void;
}

const items = [
  {value: 'assets' as const, label: '素材', icon: Images},
  {value: 'editor' as const, label: '画布', icon: PanelsTopLeft},
  {value: 'inspector' as const, label: '属性', icon: SlidersHorizontal}
];

export function MobileNav({activePane, onChange}: MobileNavProps) {
  return (
    <nav className="mobile-nav" aria-label="移动端工作区">
      {items.map(({value, label, icon: Icon}) => (
        <button
          className={activePane === value ? 'active' : ''}
          type="button"
          key={value}
          aria-current={activePane === value ? 'page' : undefined}
          onClick={() => onChange(value)}
        >
          <Icon size={19} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
