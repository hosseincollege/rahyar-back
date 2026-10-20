INSERT INTO "permissions" ("id", "key", "name", "description")
VALUES
  ('perm_hr_read', 'hr.read', 'مشاهده منابع انسانی', 'مشاهده پرونده کارکنان و درخواست‌های مرخصی سازمان'),
  ('perm_hr_write', 'hr.write', 'مدیریت منابع انسانی', 'ایجاد و ویرایش کارکنان و بررسی درخواست‌های مرخصی'),
  ('perm_hr_employees_read', 'hr.employees.read', 'مشاهده پرونده کارکنان', 'مشاهده پرونده‌های کارکنان سازمان'),
  ('perm_hr_employees_write', 'hr.employees.write', 'مدیریت پرونده کارکنان', 'ایجاد و ویرایش پرونده کارکنان'),
  ('perm_hr_leaves_read', 'hr.leaves.read', 'مشاهده مرخصی‌ها', 'مشاهده درخواست‌های مرخصی سازمان'),
  ('perm_hr_leaves_write', 'hr.leaves.write', 'مدیریت مرخصی‌ها', 'ثبت و مدیریت درخواست‌های مرخصی'),
  ('perm_hr_leaves_approve', 'hr.leaves.approve', 'بررسی مرخصی‌ها', 'تأیید یا رد درخواست‌های مرخصی'),
  ('perm_hr_attendance_read', 'hr.attendance.read', 'مشاهده حضور و غیاب', 'مشاهده سوابق حضور و غیاب سازمان'),
  ('perm_hr_attendance_write', 'hr.attendance.write', 'مدیریت حضور و غیاب', 'ثبت و ویرایش سوابق حضور و غیاب'),
  ('perm_hr_payroll_read', 'hr.payroll.read', 'مشاهده حقوق و دستمزد', 'مشاهده اطلاعات حقوق کارکنان'),
  ('perm_hr_payroll_write', 'hr.payroll.write', 'مدیریت حقوق و دستمزد', 'ایجاد و ویرایش اطلاعات حقوق کارکنان')
ON CONFLICT ("key") DO NOTHING;
