/**
 * Filter out online classes (ONLMCO3 rooms)
 * @param {string} room The room number to check
 * @returns {boolean} True if the room is a physical location
 */
function isPhysicalLocation(room) {
  return !room.includes('ONLMCO3');
}

/**
 * Normalize room names for consistent searching, especially for auditoriums
 * @param {string} room The room name to normalize
 * @returns {string} The normalized room name
 * @example
 * normalizeRoomName("Auditorium 1 @ Level 6") // returns "auditorium 1"
 * normalizeRoomName("Audi 2") // returns "auditorium 2"
 * normalizeRoomName("AUDI4") // returns "auditorium 4"
 */
function normalizeRoomName(room) {
  if (!room) return "";

  // Convert to lowercase and trim spaces
  let normalized = room.toLowerCase().trim();

  // Handle different Auditorium formats - standardize to "auditorium N"
  // Match various forms like: "Auditorium N", "Audi N", "AudiN"
  normalized = normalized.replace(/audi(?:torium)?\s*(\d+)/i, "auditorium $1");

  // Remove location information after @
  normalized = normalized.replace(/\s*@.*$/, "");

  // Handle other room formats here if needed
  // For example, tech labs, standard rooms like B-06-12 etc.

  // Remove extra spaces and trim
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

module.exports = {
  isPhysicalLocation,
  normalizeRoomName
};
