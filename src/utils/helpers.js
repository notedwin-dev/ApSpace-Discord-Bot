/**
 * Filter out online classes (ONLMCO3 rooms)
 * @param {string} room The room number to check
 * @returns {boolean} True if the room is a physical location
 */
function isPhysicalLocation(room) {
  return !room.includes('ONLMCO3');
}

module.exports = {
  isPhysicalLocation
};
