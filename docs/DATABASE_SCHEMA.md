# CampusGuard Database Schema

Current implementation uses SQLite through Node's built-in SQLite module. The database file defaults to:

`backend/data/campusguard.sqlite`

The current persistence layer stores application collections as JSON inside SQLite. This gives durable local persistence while keeping the project dependency-free. For cloud scale, migrate these collections into normalized PostgreSQL tables.

## Logical Entities

## users

- `id`
- `name`
- `email`
- `role`
- `passwordHash`
- `createdAt`

## refreshTokens

- `id`
- `userId`
- `tokenHash`
- `revoked`
- `createdAt`
- `expiresAt`
- `revokedAt`

## inquiries

- `id`
- `name`
- `role`
- `topic`
- `priority`
- `status`
- `city`
- `contact`
- `question`
- `ownerEmail`
- `createdAt`
- `updatedAt`

## documents

- `id`
- `ownerName`
- `ownerEmail`
- `ownerRole`
- `docName`
- `fileName`
- `storedFileName`
- `mimeType`
- `sizeBytes`
- `status`
- `createdAt`
- `updatedAt`

## content

- `id`
- `title`
- `category`
- `status`
- `updatedAt`

## knowledge

- `id`
- `title`
- `category`
- `source`
- `text`
- `status`
- `updatedAt`

## auditLogs

- `id`
- `actorEmail`
- `actorRole`
- `action`
- `resourceType`
- `resourceId`
- `details`
- `createdAt`

## officialSources

- `id`
- `title`
- `documentType`
- `academicYear`
- `sourceAuthority`
- `originalFileName`
- `storedFileName`
- `mimeType`
- `sizeBytes`
- `status`
- `extractionStatus`
- `extractedText` (review-only; never used by retrieval until publication)
- `linkedKnowledgeCount`
- `uploadedBy`
- `createdAt`
- `updatedAt`

Published knowledge records linked to an official source include `sourceDocumentId`. A republished source replaces its previous linked records atomically within the current local persistence model.

## PostgreSQL Migration Target

For production, create one table per logical entity, add foreign keys from `refreshTokens.userId` to `users.id` and `knowledge.sourceDocumentId` to `officialSources.id`, and index `documents.ownerEmail`, `inquiries.ownerEmail`, `auditLogs.createdAt`, `knowledge.category/status`, and `officialSources.documentType/academicYear/status`.
