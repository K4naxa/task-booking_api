/*
  Warnings:

  - A unique constraint covering the columns `[id,userId]` on the table `Booking` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Booking_id_userId_key" ON "Booking"("id", "userId");
