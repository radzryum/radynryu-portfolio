-- Add a column to store the client's reason for requesting the document (especially for re-requests)
ALTER TABLE "public"."assessment_document_release_requests"
ADD COLUMN "client_reason" text;
