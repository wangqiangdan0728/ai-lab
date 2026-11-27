-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "sid" TEXT;

-- CreateIndex
CREATE INDEX "Conversation_sid_idx" ON "Conversation"("sid");
