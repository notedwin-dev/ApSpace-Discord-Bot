/*
  Warnings:

  - A unique constraint covering the columns `[serverId,userId]` on the table `ServerUser` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `grouping` to the `ClassSchedule` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ClassSchedule" ADD COLUMN     "grouping" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ServerUser_serverId_userId_key" ON "ServerUser"("serverId", "userId");
