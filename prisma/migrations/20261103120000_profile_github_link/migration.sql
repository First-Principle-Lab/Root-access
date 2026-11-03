-- Editable GitHub link on the profile (checkpoint 7 of docs/admin-redesign-plan.md).
ALTER TABLE "Profile" ADD COLUMN "githubLink" TEXT;

-- Backfill: the public GitHub icon pointed at this address in markup before the column existed, so
-- every profile row that has never been edited keeps resolving to the same link after the release.
UPDATE "Profile" SET "githubLink" = 'https://github.com/parththirwani'
WHERE "githubLink" IS NULL;
