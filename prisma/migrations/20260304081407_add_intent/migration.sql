/*
  Warnings:

  - You are about to drop the column `createdAt` on the `intent` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `intent` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `intentimage` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `intent` DROP COLUMN `createdAt`,
    DROP COLUMN `updatedAt`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `intentimage` DROP COLUMN `createdAt`,
    ADD COLUMN `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
