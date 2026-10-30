export const LevelMeter = ({ level, color, active, testId }) => {
  const bars = [0.5, 0.8, 1, 0.7, 0.4];
  return (
    <div className="flex items-end gap-[3px] h-4" data-testid={testId}>
      {bars.map((m, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full transition-[height] duration-75"
          style={{
            background: active ? color : "#334155",
            height: `${Math.max(15, active ? level * m * 100 : 15)}%`,
          }}
        />
      ))}
    </div>
  );
};
