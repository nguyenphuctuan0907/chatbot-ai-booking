/*
  Warnings:

  - You are about to drop the column `mid` on the `messages` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `messages_mid_key` ON `messages`;

-- AlterTable
ALTER TABLE `messages` DROP COLUMN `mid`;
