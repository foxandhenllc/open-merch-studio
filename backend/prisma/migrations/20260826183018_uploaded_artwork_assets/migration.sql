-- Durable ownership, provenance, and storage metadata for customer-provided artwork.
ALTER TABLE public.design_assets
  ADD COLUMN "studioSessionId" TEXT,
  ADD COLUMN "sourceType" TEXT NOT NULL DEFAULT 'generated',
  ADD COLUMN "purpose" TEXT NOT NULL DEFAULT 'print',
  ADD COLUMN "originalStoragePath" TEXT,
  ADD COLUMN "previewStoragePath" TEXT,
  ADD COLUMN "printStoragePath" TEXT,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "originalFilename" TEXT,
  ADD COLUMN "byteSize" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "hasAlpha" BOOLEAN,
  ADD COLUMN "checksumSha256" TEXT,
  ADD COLUMN "parentAssetIds" JSONB,
  ADD COLUMN "rightsConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "retentionUntil" TIMESTAMP(3);

ALTER TABLE public.design_assets
  ADD CONSTRAINT "design_assets_studioSessionId_fkey"
  FOREIGN KEY ("studioSessionId") REFERENCES public.studio_sessions(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "design_assets_studioSessionId_createdAt_idx"
  ON public.design_assets("studioSessionId", "createdAt");
CREATE INDEX "design_assets_sourceType_generationStatus_createdAt_idx"
  ON public.design_assets("sourceType", "generationStatus", "createdAt");
CREATE INDEX "design_assets_retentionUntil_idx"
  ON public.design_assets("retentionUntil");

-- Originals and inspiration images remain private. Print-ready derivatives continue
-- to use the existing public open-merch-artwork bucket because Printful must fetch them.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'open-merch-uploads',
  'open-merch-uploads',
  false,
  20971520,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Match the existing server-only Data API posture for the changed table.
ALTER TABLE public.design_assets ENABLE ROW LEVEL SECURITY;
