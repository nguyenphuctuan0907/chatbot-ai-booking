/*
  Warnings:

  - Added the required column `day` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `day` VARCHAR(191) NOT NULL;
