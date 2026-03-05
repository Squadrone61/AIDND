"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChatMessage } from "./ChatMessage";
import type { ServerMessage, CheckRequest, CheckResult, RollResult } from "@aidnd/shared/types";
import type { ConnectionState } from "@/hooks/useWebSocket";

// Merged check: replaces 3 messages (check_request, dice_roll, check_result) with one
export interface MergedCheckMessage {
  type: "merged_check";
  request: CheckRequest;
  roll: RollResult;
  result: CheckResult;
  playerName: string;
  timestamp: number;
}

export type DisplayMessage = ServerMessage | MergedCheckMessage;

/**
 * Post-process messages to merge resolved check sequences.
 * When a check_result is found, look backward for its matching dice_roll
 * and check_request by requestId. Replace all three with a single merged_check.
 * Unresolved check_requests are left as-is (still show "Roll d20" button).
 */
function mergeCheckMessages(messages: ServerMessage[]): DisplayMessage[] {
  // Collect resolved requestIds first
  const resolvedIds = new Set<string>();
  for (const msg of messages) {
    if (msg.type === "server:check_result") {
      resolvedIds.add(msg.result.requestId);
    }
  }

  if (resolvedIds.size === 0) return messages;

  // Build index of check_requests and dice_rolls by requestId
  const requestMap = new Map<string, ServerMessage>();
  const rollMap = new Map<string, ServerMessage>();

  for (const msg of messages) {
    if (msg.type === "server:check_request" && resolvedIds.has(msg.check.id)) {
      requestMap.set(msg.check.id, msg);
    }
    // dice_roll doesn't have requestId directly, but it appears right before check_result
    // We match by looking at sequential order
  }

  // Walk messages, building merged output
  const result: DisplayMessage[] = [];
  const consumed = new Set<number>(); // indices to skip

  for (let i = 0; i < messages.length; i++) {
    if (consumed.has(i)) continue;
    const msg = messages[i];

    if (msg.type === "server:check_result") {
      const requestId = msg.result.requestId;

      // Find matching check_request (look backward)
      let requestIdx = -1;
      let rollIdx = -1;
      for (let j = i - 1; j >= 0; j--) {
        const prev = messages[j];
        if (prev.type === "server:dice_roll" && rollIdx === -1) {
          rollIdx = j;
        }
        if (prev.type === "server:check_request" && prev.check.id === requestId) {
          requestIdx = j;
          break;
        }
      }

      if (requestIdx >= 0 && rollIdx >= 0) {
        const reqMsg = messages[requestIdx] as Extract<ServerMessage, { type: "server:check_request" }>;
        const rollMsg = messages[rollIdx] as Extract<ServerMessage, { type: "server:dice_roll" }>;

        consumed.add(requestIdx);
        consumed.add(rollIdx);
        consumed.add(i);

        result.push({
          type: "merged_check",
          request: reqMsg.check,
          roll: rollMsg.roll,
          result: msg.result,
          playerName: rollMsg.playerName,
          timestamp: msg.timestamp,
        });
        continue;
      }
    }

    // Skip already-consumed messages (check_request/dice_roll that were merged)
    if (consumed.has(i)) continue;

    result.push(msg);
  }

  return result;
}

interface ChatPanelProps {
  messages: ServerMessage[];
  onSend: (content: string) => void;
  connectionState: ConnectionState;
  onRollDice?: (checkRequestId: string) => void;
  myCharacterName?: string;
  isMyTurn?: boolean;
  onEndTurn?: () => void;
}

export function ChatPanel({ messages, onSend, connectionState, onRollDice, myCharacterName, isMyTurn, onEndTurn }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const displayMessages = useMemo(() => mergeCheckMessages(messages), [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && connectionState === "connected") {
      onSend(input.trim());
      setInput("");
    }
  };

  const isConnected = connectionState === "connected";

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="border-b border-gray-700 p-4 flex items-center gap-3 shrink-0">
        <h2 className="text-lg font-semibold text-purple-400">
          AI Dungeon Master
        </h2>
        <div className="flex items-center gap-1.5 ml-auto">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionState === "connected"
                ? "bg-green-500"
                : connectionState === "reconnecting"
                  ? "bg-yellow-500 animate-pulse"
                  : connectionState === "connecting"
                    ? "bg-yellow-500 animate-pulse"
                    : "bg-red-500"
            }`}
          />
          <span className="text-sm text-gray-400">
            {connectionState === "connected"
              ? "Connected"
              : connectionState === "reconnecting"
                ? "Reconnecting..."
                : connectionState === "connecting"
                  ? "Connecting..."
                  : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {displayMessages.length === 0 && (
          <div className="text-center text-gray-600 mt-8">
            <p className="text-lg mb-1">Waiting for the adventure to begin...</p>
            <p className="text-sm">
              Make sure someone has configured an AI provider.
            </p>
          </div>
        )}
        {displayMessages.map((msg, i) => (
          <ChatMessage key={i} message={msg} onRollDice={onRollDice} myCharacterName={myCharacterName} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-gray-700 p-4 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isConnected ? "What do you do?" : "Connecting..."}
            disabled={!isConnected}
            maxLength={2000}
            className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5
                       text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2
                       focus:ring-purple-500 disabled:opacity-50"
          />
          {isMyTurn && onEndTurn && (
            <button
              type="button"
              onClick={onEndTurn}
              className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg
                         font-medium transition-colors whitespace-nowrap"
            >
              End Turn
            </button>
          )}
          <button
            type="submit"
            disabled={!isConnected || !input.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700
                       disabled:text-gray-500 text-white px-6 py-2.5 rounded-lg
                       font-medium transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
