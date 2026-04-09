/*
  Warnings:

  - You are about to alter the column `direction` on the `messages` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(3))`.
  - You are about to alter the column `status` on the `messages` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Enum(EnumId(4))`.

*/
-- AlterTable
ALTER TABLE `messages` MODIFY `direction` ENUM('INCOMING', 'OUTGOING') NOT NULL,
    MODIFY `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'REPLIED', 'FAILED') NOT NULL;

-- CreateTable
CREATE TABLE `Intent` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `replyText` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IntentImage` (
    `id` VARCHAR(191) NOT NULL,
    `intentId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `IntentImage` ADD CONSTRAINT `IntentImage_intentId_fkey` FOREIGN KEY (`intentId`) REFERENCES `Intent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
