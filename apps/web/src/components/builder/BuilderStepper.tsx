import { BUILDER_STEPS, STEP_LABELS, type BuilderStep } from "./types";
import { type BuilderState } from "./types";
import { isStepValid, isStepTouched, getStepsToSkip } from "./utils";

interface BuilderStepperProps {
  state: BuilderState;
  onStepClick: (step: BuilderStep) => void;
}

export function BuilderStepper({ state, onStepClick }: BuilderStepperProps) {
  const skip = getStepsToSkip(state);
  const visibleSteps = BUILDER_STEPS.filter((s) => !skip.has(s));

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {visibleSteps.map((step, i) => {
        const isActive = step === state.currentStep;
        const touched = isStepTouched(state, step);
        const valid = isStepValid(state, step);
        const isCompleted = !isActive && touched && valid;
        const isInvalid = !isActive && touched && !valid;

        return (
          <button
            key={step}
            onClick={() => onStepClick(step)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors hover:bg-gray-800 cursor-pointer ${
              isActive
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30"
                : isInvalid
                  ? "text-red-400"
                  : isCompleted
                    ? "text-emerald-400"
                    : "text-gray-500"
            }`}
          >
            <span
              className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${
                isActive
                  ? "bg-purple-600 text-white"
                  : isInvalid
                    ? "bg-red-600/30 text-red-400"
                    : isCompleted
                      ? "bg-emerald-600/30 text-emerald-400"
                      : "bg-gray-800 text-gray-600"
              }`}
            >
              {isInvalid ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              ) : isCompleted ? (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="hidden sm:inline">{STEP_LABELS[step]}</span>
          </button>
        );
      })}
    </div>
  );
}
