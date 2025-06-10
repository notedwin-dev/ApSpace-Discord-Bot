const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const { normalizeRoomName } = require("../../utils/helpers");
const prisma = new PrismaClient();

/**
 * Insert class schedules in chunks to avoid transaction timeout
 * @param {Array} classes - Array of class schedules to insert
 * @param {number} chunkSize - Size of each chunk
 * @param {number} timetableId - ID of the timetable entry
 */
async function insertClassSchedulesInChunks(
  classes,
  chunkSize = 500,
  timetableId
) {
  const chunks = Math.ceil(classes.length / chunkSize);
  console.log(
    `Processing ${classes.length} classes in ${chunks} chunks of ${chunkSize}`
  );

  for (let i = 0; i < classes.length; i += chunkSize) {
    const chunk = classes.slice(i, i + chunkSize);
    const chunkNumber = Math.floor(i / chunkSize) + 1;

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.classSchedule.createMany({
            data: chunk,
          });
        },
        {
          timeout: 30000, // 30 second timeout for each chunk
        }
      );
      console.log(`Successfully processed chunk ${chunkNumber}/${chunks}`);
    } catch (error) {
      console.error(`Error processing chunk ${chunkNumber}/${chunks}:`, error);
      // If a chunk fails, clean up the timetable entry and throw
      await prisma.timetable.delete({
        where: { id: timetableId },
      });
      throw new Error(
        `Failed to process timetable chunk ${chunkNumber}: ${error.message}`
      );
    }
  }
}

/**
 * Fetches timetable data from the APU's web API and stores it in the database.
 * We should update the cached result every 24 hours.
 * @link https://s3-ap-southeast-1.amazonaws.com/open-ws/weektimetable
 * @return {Promise<Object>} - A promise that resolves to the timetable data.
 * @throws {Error} - If the fetch operation fails or the response is not valid.
 */
async function fetchAndCacheTimetable() {
  try {
    const response = await axios.get(
      "https://s3-ap-southeast-1.amazonaws.com/open-ws/weektimetable"
    );

    if (!response.data || !Array.isArray(response.data)) {
      throw new Error("Invalid timetable data received");
    }

    // Delete old timetable data first
    const oldTimetables = await prisma.timetable.findMany({
      where: {
        validUntil: {
          lt: new Date(),
        },
      },
      select: { id: true },
    });
    if (oldTimetables.length > 0) {
      console.log(`Cleaning up ${oldTimetables.length} expired timetable(s)`);
      // First delete all associated class schedules
      await prisma.classSchedule.deleteMany({
        where: {
          timetableId: {
            in: oldTimetables.map((t) => t.id),
          },
        },
      });
      // Then delete the timetable entries
      await prisma.timetable.deleteMany({
        where: {
          id: {
            in: oldTimetables.map((t) => t.id),
          },
        },
      });
    }

    // Set validity period for 24 hours
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + 24);

    // Create new timetable entry outside transaction
    const newTimetable = await prisma.timetable.create({
      data: {
        validUntil,
      },
    }); // Process class data
    const classes = response.data.map((cls) => ({
      timetableId: newTimetable.id,
      intakeCode: cls.INTAKE,
      moduleCode: cls.MODID,
      moduleName: cls.MODULE_NAME,
      roomNumber: normalizeRoomName(cls.ROOM), // Normalize room numbers when storing
      grouping: cls.GROUPING,
      startTime: new Date(cls.TIME_FROM_ISO),
      endTime: new Date(cls.TIME_TO_ISO),
      day: new Date(cls.TIME_FROM_ISO).toLocaleDateString("en-US", {
        weekday: "long",
      }),
    }));

    try {
      // Use insertClassSchedulesInChunks for better error handling and performance
      await insertClassSchedulesInChunks(classes, 500, newTimetable.id);
      console.log(`Successfully cached ${classes.length} classes`);
      return response.data;
    } catch (error) {
      // Clean up the timetable entry if class insertion fails
      await prisma.timetable.delete({
        where: { id: newTimetable.id },
      });
      console.error("Failed to cache timetable data:", error);
      throw new Error(`Failed to cache timetable data: ${error.message}`);
    }
  } catch (error) {
    console.error("Error fetching timetable:", error);
    throw error;
  }
}

/**
 * Gets the timetable for a specific intake code and date
 * @param {string} intakeCode - The intake code to fetch the timetable for
 * @param {Date} date - The date to fetch the timetable for
 * @returns {Promise<Array>} - Array of class schedules
 */
async function getByIntake(intakeCode, date) {
  try {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Get the most recent valid timetable
    const latestTimetable = await prisma.timetable.findFirst({
      where: {
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
    });

    if (!latestTimetable) {
      // If no valid timetable exists, fetch new data
      await fetchAndCacheTimetable();
      return getByIntake(intakeCode, date); // Retry with new data
    }

    // Get classes for the specific intake and date
    const classes = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
        intakeCode: intakeCode,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return classes;
  } catch (error) {
    console.error("Error getting timetable by intake:", error);
    throw error;
  }
}

/**
 * Gets the weekly timetable for a specific intake code
 * @param {string} intakeCode - The intake code to fetch the timetable for
 * @param {Date} [startDate] - Optional start date for the week
 * @param {Date} [endDate] - Optional end date for the week
 * @returns {Promise<Array>} - Array of class schedules
 */
async function getWeeklyByIntake(intakeCode, startDate, endDate) {
  try {
    // If no dates provided, default to current week
    const startOfWeek =
      startDate ||
      (() => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(
          now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1)
        );
        start.setHours(0, 0, 0, 0);
        return start;
      })();

    const endOfWeek =
      endDate ||
      (() => {
        const end = new Date(startOfWeek);
        end.setDate(startOfWeek.getDate() + 4); // Friday is 4 days after Monday
        end.setHours(23, 59, 59, 999);
        return end;
      })();

    // Get latest timetable
    const latestTimetable = await prisma.timetable.findFirst({
      where: {
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
    });

    if (!latestTimetable) {
      await fetchAndCacheTimetable();
      return getWeeklyByIntake(intakeCode, startDate, endDate); // Retry with new data
    }

    // Get classes for the entire week
    const classes = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
        intakeCode: intakeCode,
        startTime: {
          gte: startOfWeek,
          lte: endOfWeek,
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return classes;
  } catch (error) {
    console.error("Error getting weekly timetable:", error);
    throw error;
  }
}

/**
 * Gets the timetable for a specific weekday
 * @param {string} intakeCode - The intake code to fetch the timetable for
 * @param {string} weekday - The weekday to fetch (monday, tuesday, etc.)
 * @returns {Promise<Array>} - Array of class schedules
 */
async function getDailyByIntake(intakeCode, weekday) {
  try {
    const validWeekdays = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
    ];
    if (!validWeekdays.includes(weekday.toLowerCase())) {
      throw new Error("Invalid weekday");
    }

    // Get latest timetable
    const latestTimetable = await prisma.timetable.findFirst({
      where: {
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
    });

    if (!latestTimetable) {
      await fetchAndCacheTimetable();
      return getDailyByIntake(intakeCode, weekday); // Retry with new data
    }

    // Get classes for the specific weekday
    const classes = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
        intakeCode: intakeCode,
        day: {
          equals: weekday.charAt(0).toUpperCase() + weekday.slice(1),
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return classes;
  } catch (error) {
    console.error("Error getting timetable by intake:", error);
    throw error;
  }
}

/**
 * Finds empty rooms for a given time slot
 * @param {Date} date - The date to check
 * @param {[Date, Date]} timeSlot - Start and end time to check
 * @returns {Promise<string[]>} - Array of empty room numbers
 */
async function getEmptyRooms(date, [startTime, endTime]) {
  try {
    // Get the most recent valid timetable
    const latestTimetable = await prisma.timetable.findFirst({
      where: {
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
    });

    if (!latestTimetable) {
      await fetchAndCacheTimetable();
      return getEmptyRooms(date, [startTime, endTime]); // Retry with new data
    }

    // Get all rooms that have classes during the specified time
    const occupiedRooms = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
        startTime: {
          lte: endTime,
        },
        endTime: {
          gte: startTime,
        },
      },
      select: {
        roomNumber: true,
      },
      distinct: ["roomNumber"],
    }); // Get all unique room numbers from the database
    const allRooms = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
        // Filter out online rooms
        NOT: {
          roomNumber: { contains: "ONLMCO3" },
        },
      },
      select: {
        roomNumber: true,
      },
      distinct: ["roomNumber"],
    });

    // Filter out occupied rooms and normalize room numbers
    const occupiedRoomNumbers = new Set(
      occupiedRooms.map((r) => normalizeRoomName(r.roomNumber))
    );

    const emptyRooms = allRooms
      .map((r) => r.roomNumber)
      .filter((room) => !occupiedRoomNumbers.has(normalizeRoomName(room)))
      // Group similar rooms together (auditoriums, labs, etc.)
      .sort((a, b) => {
        const normA = normalizeRoomName(a);
        const normB = normalizeRoomName(b);
        return normA.localeCompare(normB);
      });

    return emptyRooms;
  } catch (error) {
    console.error("Error finding empty rooms:", error);
    throw error;
  }
}

/**
 * Gets the schedule for a specific room
 * @param {string} roomNumber - The room number to search for (e.g. B-06-12)
 * @param {Date} date - The date to fetch the schedule for
 * @returns {Promise<Array>} - Array of class schedules
 */
async function getRoomSchedule(roomNumber, date) {
  try {
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    // Get the most recent valid timetable
    const latestTimetable = await prisma.timetable.findFirst({
      where: {
        validUntil: {
          gte: new Date(),
        },
      },
      orderBy: {
        fetchedAt: "desc",
      },
    });

    if (!latestTimetable) {
      await fetchAndCacheTimetable();
      return getRoomSchedule(roomNumber, date); // Retry with new data
    } // Get classes for the specific room and date
    const normalizedRoomNumber = normalizeRoomName(roomNumber).toLowerCase();
    console.log(
      `Searching for room: "${roomNumber}" (normalized: "${normalizedRoomNumber}")`
    );

    // Get all matching rooms first to debug
    const allRooms = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
      },
      select: {
        roomNumber: true,
      },
      distinct: ["roomNumber"],
    });
    console.log(
      "Available rooms:",
      allRooms
        .map((r) => r.roomNumber)
        .filter((r) => r.toLowerCase().includes(normalizedRoomNumber))
    );
    const classes = await prisma.classSchedule.findMany({
      where: {
        timetableId: latestTimetable.id,
        AND: [
          {
            roomNumber: {
              contains: normalizedRoomNumber,
              mode: "insensitive",
            },
          },
          {
            startTime: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
      orderBy: {
        startTime: "asc",
      },
    });

    return classes;
  } catch (error) {
    console.error("Error getting room schedule:", error);
    throw error;
  }
}

module.exports = {
  getByIntake,
  getWeeklyByIntake,
  getDailyByIntake,
  getEmptyRooms,
  getRoomSchedule,
  fetchAndCacheTimetable,
  prisma // Export prisma instance for testing
};