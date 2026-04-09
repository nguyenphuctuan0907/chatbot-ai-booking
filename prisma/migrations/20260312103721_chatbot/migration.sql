/*
  Warnings:

  - You are about to drop the column `currentConversationId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `oldConversationId` on the `users` table. All the data in the column will be lost.
  - Made the column `conversationId` on table `messages` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `messages` MODIFY `conversationId` INTEGER NOT NULL;

-- AlterTable
ALTER TABLE `users` DROP COLUMN `currentConversationId`,
    DROP COLUMN `oldConversationId`;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `state` ENUM('START', 'ASK_DATE', 'ASK_TIME', 'CONFIRM_BOOKING', 'CONFIRM_ASK_PRICE', 'BOOKED') NOT NULL DEFAULT 'START',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Conversation_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `Conversation`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
