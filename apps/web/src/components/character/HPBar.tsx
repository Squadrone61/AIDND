"use client";

interface HPBarProps {
  current: number;
  max: number;
  temp?: number;
}

export function HPBar({ current, max, temp = 0 }: HPBarProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const tempPercentage = max > 0 ? Math.min((temp / max) * 100, 100 - percentage) : 0;

  // Color based on HP percentage
  const barColor =
    percentage > 50
      ? "bg-green-500"
      : percentage > 25
      ? "bg-yellow-500"
      : "bg-red-500";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-gray-400">HP</span>
        <span className="text-sm font-medium text-gray-200">
          {current}/{max}
          {temp > 0 && (
            <span className="text-blue-400 text-xs ml-1">(+{temp})</span>
          )}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className="flex h-full">
          <div
            className={`${barColor} transition-all duration-300`}
            style={{ width: `${percentage}%` }}
          />
          {temp > 0 && (
            <div
              className="bg-blue-500/60 transition-all duration-300"
              style={{ width: `${tempPercentage}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
