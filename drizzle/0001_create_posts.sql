CREATE TABLE "posts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "posts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_key" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"content_hash" text GENERATED ALWAYS AS (md5(title || E'\n' || body)) STORED,
	"embedding" vector(384),
	"embedding_model" text,
	"embedded_hash" text,
	"embedded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "posts_source_key_uq" ON "posts" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "posts_embedding_hnsw" ON "posts" USING hnsw ("embedding" vector_cosine_ops);