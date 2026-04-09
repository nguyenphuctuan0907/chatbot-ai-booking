-- CreateTable
CREATE TABLE `messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `type` ENUM('USER_MESSAGE', 'ADMIN_REPLY', 'BOT_REPLY') NOT NULL,
    `role` ENUM('USER', 'ASSISTANT') NOT NULL,
    `message` TEXT NULL,
    `messageId` VARCHAR(100) NULL,
    `from` ENUM('MESSENGER', 'ZALO') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_userId_created_at_idx`(`userId`, `created_at`),
    INDEX `messages_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
