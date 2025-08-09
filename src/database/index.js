const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

module.exports = {
  async getIntakeCodeByUserId(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { userId: userId },
        select: { intakeCode: true },
      });
      return user ? user.intakeCode : null;
    } catch (error) {
      console.error("Error fetching intake code:", error);
      throw error;
    }
  },

  async setIntakeCodeByUserId(userId, intakeCode) {
    try {
      await prisma.user.upsert({
        where: { userId: userId },
        update: { intakeCode },
        create: { userId: userId, intakeCode },
      });
    } catch (error) {
      console.error("Error setting intake code:", error);
      throw error;
    }
  },

  async setWebhookChannel(serverId, channelId) {
    try {
      await prisma.server.upsert({
        where: { serverId: serverId },
        update: { webhookChannel: channelId },
        create: { serverId: serverId, webhookChannel: channelId },
      });
    } catch (error) {
      console.error("Error setting webhook channel:", error);
      throw error;
    }
  },
  async checkCachedTimetable() {
    // Check if a cached timetable exists and is valid
    const currentDate = new Date();
    const latestTimetable = await prisma.timetable.findFirst({
      where: {
        validUntil: {
          gt: currentDate
        }
      },
      include: {
        classes: true
      },
      orderBy: { fetchedAt: 'desc' },
    });

    return latestTimetable;
  },

  async cacheTimetable(timetableData) {
    if (!timetableData || typeof timetableData !== 'object') {
      throw new Error("Invalid timetable data");
    }

    // Start a transaction to ensure data consistency
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 7); // Timetable valid for 7 days

    return await prisma.$transaction(async (tx) => {
      const timetable = await tx.timetable.create({
        data: {
          fetchedAt: new Date(),
          validUntil: validUntil,
        }
      });

      // Process and store individual class schedules
      const classCreationPromises = timetableData.map((entry) => {
        return tx.classSchedule.create({
          data: {
            intakeCode: entry.INTAKE,
            moduleCode: entry.MODULE,
            moduleName: entry.MODULE_NAME,
            roomNumber: entry.ROOM,
            startTime: new Date(entry.START_TIME),
            endTime: new Date(entry.END_TIME),
            day: entry.DAY,
            timetableId: timetable.id
          }
        });
      });

      await Promise.all(classCreationPromises);
      return timetable;
    });
  },

  async getTimetableByIntake(intakeCode, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return await prisma.classSchedule.findMany({
      where: {
        intakeCode: intakeCode,
        startTime: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });
  },

  async findEmptyRooms(date, timeSlot) {
    const [startTime, endTime] = timeSlot;
    
    // First get all rooms that are occupied during the time slot
    const occupiedRooms = await prisma.classSchedule.findMany({
      where: {
        startTime: {
          lte: endTime
        },
        endTime: {
          gte: startTime
        }
      },
      select: {
        roomNumber: true
      },
      distinct: ['roomNumber']
    });

    const occupiedRoomNumbers = occupiedRooms.map(r => r.roomNumber);

    // Then get all unique rooms and filter out the occupied ones
    const allRooms = await prisma.classSchedule.findMany({
      select: {
        roomNumber: true
      },
      distinct: ['roomNumber']
    });

    return allRooms
      .map(r => r.roomNumber)
      .filter(room => !occupiedRoomNumbers.includes(room));
  },

  async getGroupingByUserId(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { userId: userId },
        select: { grouping: true },
      });
      return user ? user.grouping : null;
    } catch (error) {
      console.error("Error fetching grouping:", error);
      throw error;
    }
  },

  async getExcludedModulesByUserId(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { userId: userId },
        select: { excludedModules: true },
      });
      return user ? (user.excludedModules || []) : [];
    } catch (error) {
      console.error("Error fetching excluded modules:", error);
      throw error;
    }
  },

  async setExcludedModulesByUserId(userId, excludedModules) {
    try {
      await prisma.user.upsert({
        where: { userId: userId },
        update: { excludedModules },
        create: { userId: userId, excludedModules },
      });
    } catch (error) {
      console.error("Error setting excluded modules:", error);
      throw error;
    }
  },
  prisma: prisma,
};
