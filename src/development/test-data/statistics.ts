import type { TestDataContext, TestDataCounts } from './context';
import { legacyProductSkus, movementReferenceNumbers, productFixtures } from './supply';
import { leadFixtureTopics } from './commerce';

/** Statistics has no write models; it reads the domain records seeded by other fixtures. */
export async function seedStatistics(ctx: TestDataContext): Promise<TestDataCounts> {
  const [invoices, leads, opportunities, employees, leaveRequests, products, movements, tickets, projects] = await Promise.all([
    ctx.db.accountingInvoice.count({ where: { organizationId: ctx.organizationId, OR: [{ documentNumber: { startsWith: 'AP-1405-' } }, { documentNumber: { startsWith: 'TEST-INV-' } }] } }),
    ctx.db.lead.count({ where: { organizationId: ctx.organizationId, OR: [
      { topic: { in: [...leadFixtureTopics] } },
      { topic: { startsWith: 'درخواست خرید تجهیزات اداری ' } },
      { topic: { startsWith: 'سرنخ آزمایشی فروش ' } },
    ] } }),
    ctx.db.opportunity.count({ where: { organizationId: ctx.organizationId, name: { in: ['تأمین تجهیزات اداری شعب', 'توسعه قرارداد پخش منطقه‌ای', 'نوسازی تجهیزات انبار', 'تأمین رایانه‌های سازمانی', 'قرارداد خدمات پس از فروش', 'توسعه فروشگاه آنلاین'] } } }),
    ctx.db.employee.count({ where: { organizationId: ctx.organizationId, employeeCode: { startsWith: 'TEST-EMP-' } } }),
    ctx.db.leaveRequest.count({ where: { organizationId: ctx.organizationId, OR: [
      { reason: { startsWith: 'مرخصی سالانه برای امور شخصی (' } },
      { reason: { startsWith: 'مراجعه پزشکی و استراحت (' } },
      { reason: { startsWith: 'رسیدگی به امور خانوادگی (' } },
      { reason: { startsWith: 'مرخصی ساعتی برای پیگیری اداری (' } },
    ] } }),
    ctx.db.product.count({ where: { organizationId: ctx.organizationId, sku: { in: [...productFixtures.map(([sku]) => sku), ...legacyProductSkus] } } }),
    ctx.db.inventoryMovement.count({ where: { organizationId: ctx.organizationId, referenceNumber: { in: [...movementReferenceNumbers, ...Array.from({ length: 12 }, (_, index) => `TEST-MOV-${String(index + 1).padStart(3, '0')}`)] } } }),
    ctx.db.ticket.count({ where: { organizationId: ctx.organizationId, project: { is: { code: { startsWith: `PRJ-${ctx.organizationId.toUpperCase()}-` } } } } }),
    ctx.db.project.count({ where: { organizationId: ctx.organizationId, code: { startsWith: `PRJ-${ctx.organizationId.toUpperCase()}-` } } }),
  ]);
  return { invoices, leads, opportunities, employees, leaveRequests, products, movements, tickets, projects };
}
