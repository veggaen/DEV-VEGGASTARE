-- Paper terminal: per-user toggle for resting-order fill notifications.
ALTER TABLE "NotificationSettings" ADD COLUMN "paperOrderEnabled" BOOLEAN NOT NULL DEFAULT true;
