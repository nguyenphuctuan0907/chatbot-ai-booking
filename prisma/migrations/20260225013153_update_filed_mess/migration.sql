/*
  Warnings:

  - A unique constraint covering the columns `[mid]` on the table `messages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `direction` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mid` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timestamp_ms` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `messages` ADD COLUMN `direction` VARCHAR(191) NOT NULL,
    ADD COLUMN `mid` VARCHAR(191) NOT NULL,
    ADD COLUMN `processingBy` VARCHAR(191) NULL,
    ADD COLUMN `status` VARCHAR(191) NOT NULL,
    ADD COLUMN `timestamp_ms` BIGINT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `messages_mid_key` ON `messages`(`mid`);
