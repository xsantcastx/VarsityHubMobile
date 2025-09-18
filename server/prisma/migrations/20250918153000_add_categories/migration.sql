-- Category taxonomy tables
CREATE TABLE IF NOT EXISTS "Category" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "icon_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Category_slug_key" ON "Category"("slug");
CREATE INDEX IF NOT EXISTS "Category_created_at_idx" ON "Category"("created_at");

CREATE TABLE IF NOT EXISTS "CategoryFollow" (
  "user_id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CategoryFollow_pkey" PRIMARY KEY ("user_id", "category_id"),
  CONSTRAINT "CategoryFollow_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CategoryFollow_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CategoryFollow_category_id_idx" ON "CategoryFollow"("category_id");

CREATE TABLE IF NOT EXISTS "CategoryAssignment" (
  "id" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CategoryAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CategoryAssignment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CategoryAssignment_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CategoryAssignment_category_id_post_id_key" ON "CategoryAssignment"("category_id", "post_id");
CREATE INDEX IF NOT EXISTS "CategoryAssignment_post_id_idx" ON "CategoryAssignment"("post_id");
