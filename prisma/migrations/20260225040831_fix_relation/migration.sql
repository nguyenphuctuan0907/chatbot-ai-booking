/*
  Warnings:

  - A unique constraint covering the columns `[platformId]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `platformSenderId` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `platformId` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `messages` ADD COLUMN `platformSenderId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `platformId` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_platformId_key` ON `users`(`platformId`);
