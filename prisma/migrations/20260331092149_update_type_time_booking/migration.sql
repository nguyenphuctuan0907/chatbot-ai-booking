/*
  Warnings:

  - Added the required column `roundedEndTime` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `roundedStartTime` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `roundedEndTime` VARCHAR(191) NOT NULL,
    ADD COLUMN `roundedStartTime` VARCHAR(191) NOT NULL,
    MODIFY `startTime` VARCHAR(191) NOT NULL,
    MODIFY `endTime` VARCHAR(191) NOT NULL;
