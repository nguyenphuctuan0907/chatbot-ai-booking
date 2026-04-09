/*
  Warnings:

  - The primary key for the `intent` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `intent` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - The primary key for the `intentimage` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `intentimage` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.
  - You are about to alter the column `intentId` on the `intentimage` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Int`.

*/
-- DropForeignKey
ALTER TABLE `intentimage` DROP FOREIGN KEY `IntentImage_intentId_fkey`;

-- DropIndex
DROP INDEX `IntentImage_intentId_fkey` ON `intentimage`;

-- AlterTable
ALTER TABLE `intent` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `intentimage` DROP PRIMARY KEY,
    MODIFY `id` INTEGER NOT NULL AUTO_INCREMENT,
    MODIFY `intentId` INTEGER NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AddForeignKey
ALTER TABLE `IntentImage` ADD CONSTRAINT `IntentImage_intentId_fkey` FOREIGN KEY (`intentId`) REFERENCES `Intent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
