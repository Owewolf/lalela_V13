-- Repair migration to align the original baseline with the current Prisma schema.

-- AlterTable
ALTER TABLE "charities"
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "website" TEXT;

-- AlterTable
ALTER TABLE "communities"
ADD COLUMN     "activated_at" TIMESTAMP(3),
ADD COLUMN     "is_paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "trial_expires_at" TIMESTAMP(3);

ALTER TABLE "communities"
DROP COLUMN "license_expiry",
DROP COLUMN "license_id",
DROP COLUMN "trial_end_date";

-- AlterTable
ALTER TABLE "community_members"
ADD COLUMN     "trial_expires_at" TIMESTAMP(3);

ALTER TABLE "community_members"
DROP COLUMN "license_expiry";

-- AlterTable
ALTER TABLE "user_businesses"
ADD COLUMN     "charity_percentage" DOUBLE PRECISION,
ADD COLUMN     "subcategory" TEXT;

-- AlterTable
ALTER TABLE "users"
ADD COLUMN     "subscription_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "subscription_renewal_date" TIMESTAMP(3),
ADD COLUMN     "trial_expires_at" TIMESTAMP(3),
ALTER COLUMN "license_status" SET DEFAULT 'TRIAL';

ALTER TABLE "users"
DROP COLUMN "access_type",
DROP COLUMN "expiry_date",
DROP COLUMN "license_expiry",
DROP COLUMN "license_type",
DROP COLUMN "member_expiry_date";

-- CreateTable
CREATE TABLE "billing_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "community_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "pdf_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "billing_records_user_id_idx" ON "billing_records"("user_id");

-- CreateIndex
CREATE INDEX "billing_records_community_id_idx" ON "billing_records"("community_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_user_id_idx" ON "invoices"("user_id");

-- AddForeignKey
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_records" ADD CONSTRAINT "billing_records_community_id_fkey" FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;