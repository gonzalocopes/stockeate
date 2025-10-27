-- CreateIndex
CREATE INDEX "idx_remito_branchId" ON "public"."Remito"("branchId");

-- CreateIndex
CREATE INDEX "idx_remito_createdAt" ON "public"."Remito"("createdAt");

-- CreateIndex
CREATE INDEX "idx_stockmove_ref" ON "public"."StockMove"("ref");
