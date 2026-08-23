-- 学習プラン生成の非同期化: プラン行は提出時に即作成し、AI生成の状態を別カラムで持つ
-- （既存行は生成済みなので READY を既定にする）

-- CreateEnum
CREATE TYPE "PlanGenerationStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN     "generationStatus" "PlanGenerationStatus" NOT NULL DEFAULT 'READY',
ADD COLUMN     "generationError" TEXT;
