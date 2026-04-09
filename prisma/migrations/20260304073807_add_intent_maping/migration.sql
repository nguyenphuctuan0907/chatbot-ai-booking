/*
  Warnings:

  - You are about to drop the `intentimage` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `intentimage` DROP FOREIGN KEY `IntentImage_intentId_fkey`;

-- DropTable
DROP TABLE `intentimage`;

-- CreateTable
CREATE TABLE `intent_image` (
    `id` VARCHAR(191) NOT NULL,
    `intentId` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `intent_image` ADD CONSTRAINT `intent_image_intentId_fkey` FOREIGN KEY (`intentId`) REFERENCES `intent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
