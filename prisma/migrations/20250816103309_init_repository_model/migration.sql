-- CreateTable
CREATE TABLE "public"."Repository" (
    "id" SERIAL NOT NULL,
    "githubId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "language" TEXT,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubId_key" ON "public"."Repository"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "public"."Repository"("fullName");
