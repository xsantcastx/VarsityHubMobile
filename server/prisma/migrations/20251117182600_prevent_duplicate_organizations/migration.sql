/*
  Warnings:

  - A unique constraint covering the columns `[name,zip_code]` on the table `Organization` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_zip_code_key" ON "Organization"("name", "zip_code");
