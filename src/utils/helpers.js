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
 * @returns {string} The normalized room name with proper capitalization
 * @example
 * normalizeRoomName("Auditorium 1 @ Level 6") // returns "Auditorium 1"
 * normalizeRoomName("Audi 2") // returns "Auditorium 2"
 * normalizeRoomName("AUDI4") // returns "Auditorium 4"
 * normalizeRoomName("b-06-05") // returns "B-06-05"
 */
function normalizeRoomName(room) {
  if (!room) return "";

  // Trim spaces first
  let normalized = room.trim();

  // Handle different Auditorium formats - standardize to "Auditorium N"
  // Match various forms like: "Auditorium N", "Audi N", "AudiN"
  normalized = normalized.replace(/audi(?:torium)?\s*(\d+)/i, "Auditorium $1");

  // Remove location information after @
  normalized = normalized.replace(/\s*@.*$/, "");

  // Handle standard room formats like B-06-12, capitalize properly
  if (normalized.match(/^[a-z]-\d{2}-\d{2}$/i)) {
    normalized = normalized.toUpperCase();
  } else if (!normalized.match(/^Auditorium \d+$/)) {
    // For non-auditorium, non-standard room formats, apply proper capitalization
    normalized = capitalizeRoomName(normalized);
  }

  // Remove extra spaces and trim
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Filter out excluded modules from class list
 * @param {Array} classes Array of class objects
 * @param {Array} excludedModules Array of module codes to exclude
 * @returns {Array} Filtered classes array
 */
function filterExcludedModules(classes, excludedModules = []) {
  if (!excludedModules || excludedModules.length === 0) {
    return classes;
  }
  return classes.filter(classItem => !excludedModules.includes(classItem.moduleCode));
}

/**
 * Function to capitalize room name for display
 * @param {string} roomName The room name to capitalize
 * @returns {string} The capitalized room name
 */
function capitalizeRoomName(roomName) {
  return roomName
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

/**
 * Format room name for display with proper capitalization
 * @param {string} room The room name to format for display
 * @returns {string} The properly formatted room name
 * @example
 * displayRoomName("auditorium 1") // returns "Auditorium 1"
 * displayRoomName("b-06-05") // returns "B-06-05"
 * displayRoomName("tech lab 6-04") // returns "Tech Lab 6-04"
 */
function displayRoomName(room) {
  if (!room) return "";

  // Handle specific patterns

  // Standard room format like B-06-05
  if (room.match(/^[a-z]-\d{2}-\d{2}$/i)) {
    return room.toUpperCase();
  }

  // Auditorium format
  if (room.match(/^auditorium \d+$/i)) {
    return room.replace(/^auditorium (\d+)$/i, "Auditorium $1");
  }

  // Tech lab format
  if (room.match(/^tech lab/i)) {
    return room.replace(/^tech lab/i, "Tech Lab");
  }

  // Default: capitalize each word
  return capitalizeRoomName(room);
}

module.exports = {
  isPhysicalLocation,
  normalizeRoomName,
  filterExcludedModules,
  capitalizeRoomName,
  displayRoomName
};
