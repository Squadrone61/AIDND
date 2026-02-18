import type { ServerMessage } from "@aidnd/shared/types";
import type { DisplayMessage } from "./ChatPanel";

interface ChatMessageProps {
  message: DisplayMessage;
  onRollDice?: (checkRequestId: string) => void;
  myCharacterName?: string;
}

export function ChatMessage({ message, onRollDice, myCharacterName }: ChatMessageProps) {
  switch (message.type) {
    case "server:chat":
      return (
        <div className="flex gap-2">
          <span className="font-bold text-blue-400 shrink-0">
            {message.playerName}:
          </span>
          <span className="text-gray-200">{message.content}</span>
        </div>
      );

    case "server:ai":
      return (
        <div className="bg-purple-900/20 border-l-4 border-purple-500 p-3 rounded-r-lg">
          <div className="text-xs text-purple-400 font-semibold mb-1">
            Dungeon Master
          </div>
          <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
            {message.content}
          </div>
        </div>
      );

    case "server:system":
      return (
        <div className="text-center text-sm text-gray-500 italic py-1">
          {message.content}
        </div>
      );

    case "server:error":
      return (
        <div className="text-center text-sm text-red-400 bg-red-900/20 p-2 rounded">
          Error: {message.message}
        </div>
      );

    case "server:check_request": {
      const check = message.check;
      const isMyCheck =
        myCharacterName &&
        check.targetCharacter.toLowerCase() === myCharacterName.toLowerCase();
      const checkLabel = check.skill || check.ability || check.type.replace("_", " ");

      return (
        <div className="bg-amber-900/20 border-l-4 border-amber-500 p-3 rounded-r-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-400 text-lg">&#127922;</span>
            <span className="text-sm text-amber-300 font-semibold">
              {checkLabel}
              {check.dc !== undefined && (
                <span className="text-gray-400 font-normal"> — DC {check.dc}</span>
              )}
            </span>
          </div>
          <div className="text-xs text-gray-400 mb-2">
            <span className="text-gray-300">{check.targetCharacter}</span>
            {" — "}
            {check.reason}
          </div>
          {(check.advantage || check.disadvantage) && (
            <div className="mb-1">
              {check.advantage && (
                <span className="text-xs text-green-400 mr-2">Advantage</span>
              )}
              {check.disadvantage && (
                <span className="text-xs text-red-400 mr-2">Disadvantage</span>
              )}
            </div>
          )}
          {isMyCheck && onRollDice && (
            <button
              onClick={() => onRollDice(check.id)}
              className="mt-1 bg-amber-600 hover:bg-amber-700 text-white text-sm px-4 py-1.5
                         rounded-lg font-medium transition-colors"
            >
              Roll d20
            </button>
          )}
        </div>
      );
    }

    case "server:dice_roll": {
      const roll = message.roll;
      const isCrit = roll.criticalHit;
      const isFail = roll.criticalFail;

      return (
        <div
          className={`border-l-4 p-3 rounded-r-lg ${
            isCrit
              ? "bg-yellow-900/20 border-yellow-400"
              : isFail
                ? "bg-red-900/20 border-red-500"
                : "bg-blue-900/20 border-blue-500"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">&#127922;</span>
            <span className="text-xs font-semibold uppercase text-gray-400">
              {message.playerName} rolled
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                isCrit
                  ? "text-yellow-400"
                  : isFail
                    ? "text-red-400"
                    : "text-blue-300"
              }`}
            >
              {roll.total}
            </span>
            <span className="text-xs text-gray-500">
              [{roll.rolls.map((r) => `d${r.die}: ${r.result}`).join(", ")}
              {roll.modifier !== 0 && (
                <>{roll.modifier > 0 ? ` + ${roll.modifier}` : ` - ${Math.abs(roll.modifier)}`}</>
              )}]
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{roll.label}</div>
          {isCrit && (
            <div className="text-xs text-yellow-400 font-bold mt-1">
              CRITICAL HIT!
            </div>
          )}
          {isFail && (
            <div className="text-xs text-red-400 font-bold mt-1">
              CRITICAL FAIL!
            </div>
          )}
          {roll.advantage && (
            <span className="text-xs text-green-400">Advantage</span>
          )}
          {roll.disadvantage && (
            <span className="text-xs text-red-400">Disadvantage</span>
          )}
        </div>
      );
    }

    case "server:check_result": {
      const res = message.result;
      const success = res.success;

      return (
        <div
          className={`border-l-4 p-3 rounded-r-lg ${
            success
              ? "bg-green-900/20 border-green-500"
              : "bg-red-900/20 border-red-500"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-bold ${
                success ? "text-green-400" : "text-red-400"
              }`}
            >
              {success ? "Success!" : "Failure!"}
            </span>
            <span className="text-sm text-gray-400">
              {res.characterName} rolled {res.roll.total}
              {res.dc !== undefined && ` vs DC ${res.dc}`}
            </span>
          </div>
        </div>
      );
    }

    case "merged_check": {
      const { request, roll, result } = message;
      const success = result.success;
      const isCrit = roll.criticalHit;
      const isFail = roll.criticalFail;
      const checkLabel = request.skill || request.ability || request.type.replace("_", " ");

      const borderColor = isCrit
        ? "border-yellow-400"
        : isFail
          ? "border-red-500"
          : success
            ? "border-green-500"
            : "border-red-500";
      const bgColor = isCrit
        ? "bg-yellow-900/20"
        : isFail
          ? "bg-red-900/20"
          : success
            ? "bg-green-900/20"
            : "bg-red-900/20";

      return (
        <div className={`border-l-4 p-3 rounded-r-lg ${bgColor} ${borderColor}`}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">&#127922;</span>
              <span className="text-sm font-semibold text-gray-200">
                {checkLabel}
                {request.dc !== undefined && (
                  <span className="text-gray-400 font-normal"> — DC {request.dc}</span>
                )}
              </span>
            </div>
            <span
              className={`text-xs font-bold ${
                isCrit
                  ? "text-yellow-400"
                  : isFail
                    ? "text-red-400"
                    : success
                      ? "text-green-400"
                      : "text-red-400"
              }`}
            >
              {isCrit ? "CRITICAL!" : isFail ? "CRITICAL FAIL!" : success ? "Success" : "Failure"}
            </span>
          </div>
          <div className="text-xs text-gray-400">
            <span className="text-gray-300">{result.characterName}</span>
            {" rolled "}
            <span
              className={`font-bold ${
                isCrit
                  ? "text-yellow-400"
                  : isFail
                    ? "text-red-400"
                    : success
                      ? "text-green-300"
                      : "text-red-300"
              }`}
            >
              {roll.total}
            </span>
            <span className="text-gray-500 ml-1">
              [d20: {roll.rolls[0]?.result ?? "?"}
              {roll.modifier !== 0 && (
                <>{roll.modifier > 0 ? `, +${roll.modifier}` : `, ${roll.modifier}`}</>
              )}]
            </span>
          </div>
        </div>
      );
    }

    case "server:combat_update":
      // Combat state updates are handled at the page level,
      // not rendered inline in chat
      return null;

    default:
      return null;
  }
}
