import { colorSchemes } from "../assets/assets";

const ColorSchemeSelector = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) => {
  const selectedName = colorSchemes.find((s) => s.id === value)?.name;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-medium text-zinc-300">
          Color Palette
        </label>
        <span className="text-[11px] font-mono text-zinc-400">
          {selectedName}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {colorSchemes.map((scheme) => {
          const isSelected = value === scheme.id;
          return (
            <button
              key={scheme.id}
              type="button"
              onClick={() => onChange(scheme.id)}
              aria-label={`Color palette: ${scheme.name}`}
              className={`p-1.5 rounded-lg border transition-colors ${
                isSelected
                  ? "border-brand-400 bg-brand-500/[0.12]"
                  : "border-white/[0.08] bg-[#090a0c] hover:border-white/[0.18]"
              }`}
              title={scheme.name}
            >
              <div className="flex h-6 rounded overflow-hidden">
                {scheme.colors.map((color, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="block text-[10px] text-zinc-300 truncate mt-1 text-center">
                {scheme.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ColorSchemeSelector;
