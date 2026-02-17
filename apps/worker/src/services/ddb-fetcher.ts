/**
 * D&D Beyond character fetcher.
 * Extracts character IDs from URLs and fetches from the undocumented v5 API.
 */

const DDB_CHARACTER_SERVICE =
  "https://character-service.dndbeyond.com/character/v5/character";

/**
 * Extract the numeric character ID from a D&D Beyond URL.
 * Supports formats:
 *   - https://www.dndbeyond.com/characters/12345678
 *   - https://www.dndbeyond.com/characters/12345678/CharacterName
 *   - dndbeyond.com/characters/12345678
 */
export function extractDDBCharacterId(url: string): number | null {
  const match = url.match(/dndbeyond\.com\/characters\/(\d+)/i);
  if (!match) return null;
  const id = parseInt(match[1], 10);
  return isNaN(id) ? null : id;
}

/**
 * Fetch a character from D&D Beyond's character service API.
 * Note: This is an undocumented API. Server-side fetches typically return 403.
 * The function throws descriptive errors for different failure modes.
 */
export async function fetchDDBCharacter(
  characterId: number
): Promise<unknown> {
  const response = await fetch(`${DDB_CHARACTER_SERVICE}/${characterId}`);

  if (response.status === 403) {
    throw new DDBFetchError(
      "D&D Beyond blocked this request (403 Forbidden). " +
        "The API often blocks server-side requests. " +
        "Try using JSON paste instead — open your character on D&D Beyond, " +
        "use your browser's developer tools to copy the character JSON.",
      "DDB_FORBIDDEN"
    );
  }

  if (response.status === 404) {
    throw new DDBFetchError(
      "Character not found on D&D Beyond. Check the URL and make sure the character is public.",
      "DDB_NOT_FOUND"
    );
  }

  if (!response.ok) {
    throw new DDBFetchError(
      `D&D Beyond returned an error (${response.status}). Try JSON paste instead.`,
      "DDB_ERROR"
    );
  }

  const data = await response.json();
  return data;
}

export class DDBFetchError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "DDBFetchError";
    this.code = code;
  }
}
