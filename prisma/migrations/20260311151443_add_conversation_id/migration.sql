-- AlterTable
ALTER TABLE `messages` ADD COLUMN `conversationId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `currentConversationId` VARCHAR(191) NULL;
