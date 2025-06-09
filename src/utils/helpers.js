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
 * normalizeRoomName("Auditorium 1 @ Level 6") // returns "audi 1"
 * normalizeRoomName("Audi 2") // returns "audi 2"
 */
function normalizeRoomName(room) {
  if (!room) return '';
  
  // Convert to lowercase for case-insensitive matching
  const normalized = room.toLowerCase()
    // Replace "auditorium" with "audi"
    .replace(/auditorium/, 'audi')
    // Remove location information after @
    .replace(/\s*@.*$/, '')
    // Remove extra spaces
    .trim();

  return normalized;
}

module.exports = {
  isPhysicalLocation,
  normalizeRoomName
};
