/*
  Warnings:

  - The values [ASK_DATE] on the enum `conversation_state` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `conversation` ADD COLUMN `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `state` ENUM('START', 'ASK_TIME', 'ASK_PEOPLE', 'ASK_OTHER_INFO', 'CONFIRM_BOOKING', 'CONFIRM_ASK_PRICE', 'BOOKED') NOT NULL DEFAULT 'START';

-- AlterTable
ALTER TABLE `users` MODIFY `phone` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `boxpriceinterval` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NULL,
    `price_per_hour` INTEGER NOT NULL,
    `start_time` VARCHAR(191) NOT NULL,
    `end_time` VARCHAR(191) NOT NULL,
    `day_type` ENUM('NORMAL', 'WEEKEND', 'HOLIDAY') NOT NULL,
    `min_people` INTEGER NULL,
    `max_people` INTEGER NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- RenameIndex
ALTER TABLE `messages` RENAME INDEX `messages_conversationId_fkey` TO `messages_conversationId_idx`;
