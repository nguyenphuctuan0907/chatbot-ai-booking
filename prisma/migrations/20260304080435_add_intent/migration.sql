/*
  Warnings:

  - You are about to drop the `intent_image` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `intent_image` DROP FOREIGN KEY `intent_image_intentId_fkey`;

-- DropTable
DROP TABLE `intent_image`;

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
