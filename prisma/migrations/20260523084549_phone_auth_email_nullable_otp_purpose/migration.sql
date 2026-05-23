-- AlterTable
ALTER TABLE "otp_codes" ADD COLUMN     "purpose" TEXT NOT NULL DEFAULT 'login';

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "otp_codes_phone_purpose_idx" ON "otp_codes"("phone", "purpose");
