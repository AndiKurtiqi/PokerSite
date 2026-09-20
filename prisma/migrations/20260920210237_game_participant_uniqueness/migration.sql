-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_userId_key" ON "GameParticipant"("gameId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GameParticipant_gameId_guestId_key" ON "GameParticipant"("gameId", "guestId");
