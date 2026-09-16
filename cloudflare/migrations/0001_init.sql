-- Migration number: 0001 	 2026-09-15T00:00:00.000Z

CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

CREATE TABLE "session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "expiresAt" DATETIME NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "activeOrganizationId" TEXT,
    CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");

CREATE TABLE "account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "account_userId_idx" ON "account"("userId");

CREATE TABLE "verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

CREATE TABLE "organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "createdAt" DATETIME NOT NULL,
    "metadata" TEXT,
    "website" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "organization_slug_key" ON "organization"("slug");

CREATE TABLE "member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "member_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "member_organizationId_userId_key" ON "member"("organizationId", "userId");
CREATE INDEX "member_organizationId_idx" ON "member"("organizationId");
CREATE INDEX "member_userId_idx" ON "member"("userId");

CREATE TABLE "invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviterId" TEXT NOT NULL,
    CONSTRAINT "invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "invitation_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "invitation_organizationId_idx" ON "invitation"("organizationId");
CREATE INDEX "invitation_email_idx" ON "invitation"("email");

CREATE TABLE "company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL,
    "domain" TEXT,
    "domainSearch" TEXT,
    "website" TEXT,
    "description" TEXT,
    "logoUrl" TEXT,
    "logoDarkUrl" TEXT,
    "iconUrl" TEXT,
    "iconDarkUrl" TEXT,
    "iconTone" TEXT,
    "brandColor" TEXT,
    "industry" TEXT,
    "subIndustry" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "githubUrl" TEXT,
    "pricingUrl" TEXT,
    "careersUrl" TEXT,
    "ownerId" TEXT,
    "primaryContactId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastActivityAt" DATETIME,
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "company_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "company_primaryContactId_key" ON "company"("primaryContactId");
CREATE UNIQUE INDEX "company_domain_active_key" ON "company"("domainSearch") WHERE "archivedAt" IS NULL AND "domainSearch" IS NOT NULL;
CREATE INDEX "company_ownerId_idx" ON "company"("ownerId");
CREATE INDEX "company_nameSearch_idx" ON "company"("nameSearch");
CREATE INDEX "company_domainSearch_idx" ON "company"("domainSearch");
CREATE INDEX "company_lastActivityAt_idx" ON "company"("lastActivityAt");
CREATE INDEX "company_archivedAt_idx" ON "company"("archivedAt");

CREATE TABLE "contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "nameSearch" TEXT NOT NULL,
    "email" TEXT,
    "emailSearch" TEXT,
    "phone" TEXT,
    "title" TEXT,
    "seniority" TEXT,
    "function" TEXT,
    "linkedinUrl" TEXT,
    "twitterUrl" TEXT,
    "githubUrl" TEXT,
    "imageUrl" TEXT,
    "companyId" TEXT,
    "ownerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "lastActivityAt" DATETIME,
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "contact_email_active_key" ON "contact"("emailSearch") WHERE "archivedAt" IS NULL AND "emailSearch" IS NOT NULL;
CREATE INDEX "contact_companyId_idx" ON "contact"("companyId");
CREATE INDEX "contact_ownerId_idx" ON "contact"("ownerId");
CREATE INDEX "contact_nameSearch_idx" ON "contact"("nameSearch");
CREATE INDEX "contact_emailSearch_idx" ON "contact"("emailSearch");
CREATE INDEX "contact_lastActivityAt_idx" ON "contact"("lastActivityAt");
CREATE INDEX "contact_archivedAt_idx" ON "contact"("archivedAt");

CREATE TABLE "deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nameSearch" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'DEMO_BOOKED',
    "stageChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "expectedCloseDate" DATETIME,
    "closedAt" DATETIME,
    "closedReason" TEXT,
    "baseAmount" INTEGER,
    "baseCurrency" TEXT,
    "fxRate" INTEGER,
    "fxRateAt" DATETIME,
    "lastActivityAt" DATETIME,
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "deal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "deal_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "deal_companyId_idx" ON "deal"("companyId");
CREATE INDEX "deal_ownerId_idx" ON "deal"("ownerId");
CREATE INDEX "deal_stage_idx" ON "deal"("stage");
CREATE INDEX "deal_nameSearch_idx" ON "deal"("nameSearch");
CREATE INDEX "deal_expectedCloseDate_idx" ON "deal"("expectedCloseDate");
CREATE INDEX "deal_lastActivityAt_idx" ON "deal"("lastActivityAt");
CREATE INDEX "deal_baseAmount_idx" ON "deal"("baseAmount");
CREATE INDEX "deal_currency_idx" ON "deal"("currency");
CREATE INDEX "deal_archivedAt_idx" ON "deal"("archivedAt");

CREATE TABLE "dealContact" (
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT,
    PRIMARY KEY ("dealId", "contactId"),
    CONSTRAINT "dealContact_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "dealContact_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "dealContact_contactId_idx" ON "dealContact"("contactId");

CREATE TABLE "exchangeRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "baseCurrency" TEXT NOT NULL,
    "quoteCurrency" TEXT NOT NULL,
    "rate" INTEGER NOT NULL,
    "asOf" DATETIME NOT NULL,
    "source" TEXT NOT NULL,
    "provider" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "exchangeRate_baseCurrency_quoteCurrency_source_key" ON "exchangeRate"("baseCurrency", "quoteCurrency", "source");
CREATE INDEX "exchangeRate_baseCurrency_quoteCurrency_idx" ON "exchangeRate"("baseCurrency", "quoteCurrency");

CREATE TABLE "fieldDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "showOnSheet" BOOLEAN NOT NULL DEFAULT true,
    "showOnTable" BOOLEAN NOT NULL DEFAULT false,
    "showOnFilter" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "archivedAt" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "fieldDefinition_entity_key_key" ON "fieldDefinition"("entity", "key");
CREATE INDEX "fieldDefinition_entity_position_idx" ON "fieldDefinition"("entity", "position");

CREATE TABLE "fieldOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "archivedAt" DATETIME,
    CONSTRAINT "fieldOption_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "fieldOption_fieldId_position_idx" ON "fieldOption"("fieldId", "position");

CREATE TABLE "fieldValue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fieldId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "text" TEXT,
    "number" REAL,
    "date" DATETIME,
    "bool" BOOLEAN,
    "optionId" TEXT,
    "userId" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "fieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "fieldOption" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fieldValue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "fieldValue_fieldId_companyId_key" ON "fieldValue"("fieldId", "companyId");
CREATE UNIQUE INDEX "fieldValue_fieldId_contactId_key" ON "fieldValue"("fieldId", "contactId");
CREATE UNIQUE INDEX "fieldValue_fieldId_dealId_key" ON "fieldValue"("fieldId", "dealId");
CREATE INDEX "fieldValue_fieldId_text_idx" ON "fieldValue"("fieldId", "text");
CREATE INDEX "fieldValue_companyId_idx" ON "fieldValue"("companyId");
CREATE INDEX "fieldValue_contactId_idx" ON "fieldValue"("contactId");
CREATE INDEX "fieldValue_dealId_idx" ON "fieldValue"("dealId");

CREATE TABLE "savedView" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "filters" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "savedView_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "savedView_entity_ownerId_name_key" ON "savedView"("entity", "ownerId", "name");
CREATE INDEX "savedView_entity_shared_idx" ON "savedView"("entity", "shared");

CREATE TABLE "activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "occurredAt" DATETIME,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "companyId" TEXT,
    "contactId" TEXT,
    "dealId" TEXT,
    "createdById" TEXT NOT NULL,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "activity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "activity_companyId_createdAt_idx" ON "activity"("companyId", "createdAt");
CREATE INDEX "activity_dealId_createdAt_idx" ON "activity"("dealId", "createdAt");
CREATE INDEX "activity_contactId_createdAt_idx" ON "activity"("contactId", "createdAt");
CREATE INDEX "activity_dueAt_idx" ON "activity"("dueAt");
CREATE INDEX "activity_createdById_idx" ON "activity"("createdById");

CREATE TABLE "suppressedDomain" (
    "domain" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "suppressedContact" (
    "email" TEXT NOT NULL PRIMARY KEY,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "appSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reportingCurrency" TEXT,
    "ratesRefreshedAt" DATETIME,
    "archiveRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "updatedAt" DATETIME NOT NULL
);
