CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED');
CREATE TYPE "DisqualifyReason" AS ENUM ('NOT_INTERESTED', 'NO_BUDGET', 'UNRESPONSIVE', 'LOST_TO_COMPETITOR', 'OTHER');
CREATE TYPE "OpportunityState" AS ENUM ('OPEN', 'WON', 'LOST');
CREATE TYPE "SalesStage" AS ENUM ('QUALIFY', 'DEVELOP', 'PROPOSE', 'CLOSE');
CREATE TYPE "StakeholderRole" AS ENUM ('DECISION_MAKER', 'INFLUENCER', 'BUYER', 'TECHNICAL_EVALUATOR', 'OTHER');
CREATE TYPE "ActivityType" AS ENUM ('TASK', 'PHONE_CALL', 'EMAIL', 'APPOINTMENT', 'NOTE');
CREATE TYPE "ActivityStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "CaseStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESEARCHING', 'RESOLVED', 'CANCELLED');

CREATE TABLE "crm_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "email" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "country" TEXT,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_contacts" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "accountId" TEXT,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT NOT NULL,
    "companyName" TEXT,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "estimatedRevenue" DECIMAL(12,2),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "disqualifyReason" "DisqualifyReason",
    "disqualifyNotes" TEXT,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "convertedAccountId" TEXT,
    "convertedContactId" TEXT,
    "convertedOppId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_opportunities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "estimatedRevenue" DECIMAL(12,2),
    "actualRevenue" DECIMAL(12,2),
    "estimatedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "state" "OpportunityState" NOT NULL DEFAULT 'OPEN',
    "stage" "SalesStage" NOT NULL DEFAULT 'QUALIFY',
    "closeReason" TEXT,
    "accountId" TEXT,
    "contactId" TEXT,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_stakeholders" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" "StakeholderRole" NOT NULL DEFAULT 'DECISION_MAKER',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_stakeholders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_quotes" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_quote_line_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "crm_quote_line_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_cases" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "CasePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CaseStatus" NOT NULL DEFAULT 'NEW',
    "resolution" TEXT,
    "billableHours" DECIMAL(5,2),
    "targetResolveAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "accountId" TEXT,
    "contactId" TEXT,
    "parentCaseId" TEXT,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_cases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "crm_activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "accountId" TEXT,
    "contactId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "caseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crm_stakeholders_opportunityId_contactId_key" ON "crm_stakeholders"("opportunityId", "contactId");
CREATE UNIQUE INDEX "crm_quotes_quoteNumber_key" ON "crm_quotes"("quoteNumber");
CREATE UNIQUE INDEX "crm_cases_ticketNumber_key" ON "crm_cases"("ticketNumber");
CREATE INDEX "crm_accounts_organizationId_createdAt_idx" ON "crm_accounts"("organizationId", "createdAt");
CREATE INDEX "crm_contacts_organizationId_accountId_idx" ON "crm_contacts"("organizationId", "accountId");
CREATE INDEX "crm_leads_organizationId_status_createdAt_idx" ON "crm_leads"("organizationId", "status", "createdAt");
CREATE INDEX "crm_opportunities_organizationId_state_stage_idx" ON "crm_opportunities"("organizationId", "state", "stage");

ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_opportunities" ADD CONSTRAINT "crm_opportunities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_stakeholders" ADD CONSTRAINT "crm_stakeholders_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_stakeholders" ADD CONSTRAINT "crm_stakeholders_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_quotes" ADD CONSTRAINT "crm_quotes_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_quote_line_items" ADD CONSTRAINT "crm_quote_line_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "crm_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_cases" ADD CONSTRAINT "crm_cases_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "crm_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_cases" ADD CONSTRAINT "crm_cases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_cases" ADD CONSTRAINT "crm_cases_parentCaseId_fkey" FOREIGN KEY ("parentCaseId") REFERENCES "crm_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "crm_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "crm_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "crm_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
