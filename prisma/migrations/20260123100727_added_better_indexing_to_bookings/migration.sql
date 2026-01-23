-- CreateIndex
CREATE INDEX "Booking_roomId_status_startTime_endTime_idx" ON "Booking"("roomId", "status", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "Booking_userId_startTime_idx" ON "Booking"("userId", "startTime");
