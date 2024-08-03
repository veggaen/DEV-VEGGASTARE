/*
  Warnings:

  - A unique constraint covering the columns `[id,version]` on the table `Inventory` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Inventory_id_version_key" ON "Inventory"("id", "version");
