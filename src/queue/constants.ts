export const MESSAGE_QUEUE = "message-queue";

export enum MessageStatus {
  PENDING = "PENDING",
  PROCESSING = "PROCESSING",
  REPLIED = "REPLIED",
  FAILED = "FAILED",
  SENT = "SENT",
}

export enum Direction {
  INCOMING = "INCOMING",
  OUTGOING = "OUTGOING",
}