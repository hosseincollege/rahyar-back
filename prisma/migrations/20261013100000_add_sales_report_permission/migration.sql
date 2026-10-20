INSERT INTO "permissions" ("id", "key", "name", "description")
VALUES (
  'perm_reports_sales_read',
  'reports.sales.read',
  'مشاهده گزارش‌های فروش',
  'مشاهده شاخص‌های سرنخ‌ها و فرصت‌های فروش سازمان'
)
ON CONFLICT ("key") DO NOTHING;
