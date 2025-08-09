-- AlterTable
ALTER TABLE "User" ADD COLUMN     "excludedModules" TEXT[] DEFAULT ARRAY[]::TEXT[];
