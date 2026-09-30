-- Character (a second Pattern Type picker on Cutting Entry) was dropped from the business
-- workflow. Only the obsolete column and its FK are removed; every cutting_entries row and its
-- patternTypeId are preserved.

-- DropForeignKey
ALTER TABLE "cutting_entries" DROP CONSTRAINT "cutting_entries_characterId_fkey";

-- AlterTable
ALTER TABLE "cutting_entries" DROP COLUMN "characterId";
