import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma/prisma.service';
import type { AuthenticatedUser } from '../core/auth/jwt.strategy';
import type {
  CreateRahcomActivityDto,
  CreateRahcomSystemDto,
  CreateRahcomSystemActivityDto,
  ImportRahcomSystemsBatchDto,
  CreateRahcomSolarSnapshotDto,
  ReplaceRahcomSolarSpecialSystemsDto,
  CreateRahcomTrafficSnapshotDto,
  ImportRahcomTicketsDto,
  ReplaceRahcomRoadListDto,
  ImportRahcomSystemsDto,
  RahcomActivitiesQueryDto,
  UpdateRahcomSystemDto,
  SaveRahcomDailyWorkflowDto,
  ReplaceRahcomBillIdentifierListDto,
  ReplaceRahcomSitesListDto,
  ReplaceRahcomMissionListDto,
  SaveRahcomMissionDefaultsDto,
  RahcomSystemImportRowDto,
  RahcomSystemLookupDto,
  CreateRahcomInventoryEntryDto,
} from './rahcom.dto';
import { isRahcomProvinceId, rahcomProvinceIdFromLabel, rahcomProvinceLabel } from './rahcom-axis';

type RahcomAccess = {
  organizationId: string;
  memberId: string | null;
  demoOnly: boolean;
  provinceViewer: boolean;
  isAdmin: boolean;
  province: string | null;
  selectedProvince: string | null;
  provinces: string[];
  hasProvinceAccess: boolean;
};

const excludedIsfahanSystemCode = '065P63087';

const initialIsfahanInvoiceHeaders = [
  'شماره سند',
  'تاریخ سند',
  'شرح',
  'کد سامانه/محور',
  'مبلغ (ریال)',
  'ذی‌نفع',
  'شماره شبا/حساب',
  'وضعیت پرداخت',
  'پیگیری‌های گروه',
  'تاریخ پیام',
];
const initialIsfahanInvoiceRows = [
  [
    '1430',
    '',
    'مراجعه به سامانه 586N13202',
    '586N13202',
    '',
    '',
    '',
    'درخواست پرداخت؛ وضعیت نهایی نامشخص',
    'شرح فاکتور در پیام بازارسال‌شده آمده؛ در ۲۷ آبان پرداخت درخواست و لینک شماره سند ارسال شد.',
    '۲ و ۲۷ آبان',
  ],
  [
    '1454',
    '405/08/25',
    'هزینه باربری؛ مناقصه 961w13201',
    'مناقصه 961w13201',
    '4000000',
    '',
    '260170000000221308469004',
    'تأیید شد',
    'درخواست تأیید در ۲۷ آبان؛ در ۳۰ آبان پاسخ «تأیید شد». عبارت «چنگانی» پیش از شماره آمده، اما نقش آن و اینکه شماره حساب است یا شبا صریح نیست.',
    '۲۷ و ۳۰ آبان',
  ],
  [
    '1455',
    '405/08/23',
    'هزینه بالابر جهت رفع خرابی محور کاشان',
    '007w14009 / 071D13004 / 071n13005 / 007e13008',
    '156000000',
    'مهدی قاسمی',
    '930190000000305911637002',
    'اعلام‌شده در گروه',
    'شروع و پایان تردد بالابر برای سند اعلام شد؛ سند دوباره در گروه ارسال شد.',
    '۴ آذر',
  ],
  [
    '1456',
    '405/08/27',
    'بارنامه ارسال انکر شابلون برای ۵ استان',
    'بدون کد سامانه (طبق پیام)',
    '16000000',
    'امیرحسین رشیدی',
    '95016000000000100242755',
    'در انتظار پیگیری',
    'درخواست پرداخت در ۱ آذر و درخواست واریز مجدد در ۱ آذر؛ درباره شبا درخواست اصلاح شد و فرستنده گفت صحیح است. در ۴ آذر گفته شد فاکتور این استان اعلام نشده است.',
    '۲۷ آبان تا ۴ آذر',
  ],
  [
    '1457',
    '405/0825',
    'هزینه بالابر جهت رفع خرابی و شستشوی پنل',
    '',
    '110500000',
    'مهدی قاسمی',
    '930190000000305911637003',
    'اعلام‌شده در گروه',
    'شروع و پایان تردد بالابر برای سند اعلام شد.',
    '۴ آذر',
  ],
  [
    '1458',
    '405/09/03',
    'هزینه بالابر؛ خرابی و بررسی سامانه‌های 586n/13201/13202/13203/13204',
    '586n / 13201 / 13202 / 13203 / 13204',
    '182000000',
    'مهدی قاسمی',
    '930190000000305911637001',
    'اعلام‌شده در گروه',
    'محور موته گلپایگان؛ شروع و پایان تردد بالابر برای سند اعلام شد.',
    '۴ آذر',
  ],
  ['1422', '405/07/11', 'هزینه جرثقیل برای نصب دکل سامانه 009E13002', '009E13002', '180000000', 'محمد دانشمند', '120190000000333811110005', 'درخواست پرداخت', 'در گروه تأیید و پرداخت درخواست شده است.', '۲ آبان'],
  ['1423', '405/07/11', 'هزینه جرثقیل برای نصب دکل سامانه 009E13002؛ تصویر سند اصلاح شد', '009E13002', '170000000', 'محمد دانشمند', '120190000000333811110005', 'درخواست پرداخت', 'برای سند ۱۴۲۳ درخواست تأیید و پرداخت شد؛ پیام اصلاحیه تصویر نیز ارسال شد.', '۲ آبان'],
  ['1424', '405/07/11', 'هزینه حمل دکل 009E13002 با جرثقیل کفی', '009E13002', '50000000', 'محمد دانشمند', '120190000000333811110005', 'درخواست پرداخت', 'برای تأیید و پرداخت درخواست شده است.', '۲ آبان'],
  ['1425', '405/07/19', 'باربری و تحویل تجهیز سامانه 007E13025', '007E13025', '7200000', 'چنگانی', '260170000000221308469004', 'پرداخت‌شده (با قرینه پیام)', 'برای پرداخت همراه ۱۴۲۹ درخواست شد؛ سپس در گروه گفته شد «این دو مورد پرداخت شد». انتساب پرداخت بر اساس همان رشته پیام است.', '۲ آبان'],
  ['1426', '405/07/25', 'کرایه جرثقیل جهت نصب تجهیزات در سامانه 586N13204', '586N13204', '85000000', 'مصطفایی', '600160000000000148050339', 'درخواست پرداخت', 'پرداخت ۱۴۲۶ و ۱۴۲۷ درخواست شد و ثبت فاکتور در سامانه تأیید شد.', '۲ آبان'],
  ['1427', '405/07/25', 'کرایه حمل تجهیزات به سامانه 586N13204', '586N13204', '25000000', 'اسفندیاری', '600180000000177023672051', 'درخواست پرداخت', 'پرداخت ۱۴۲۶ و ۱۴۲۷ درخواست شد و ثبت فاکتور در سامانه تأیید شد.', '۲ آبان'],
  ['1428', '', 'نصب پنل دوم خورشید و روشنایی ۲۰۰ سامانه 586N13204', '586N13204', '', '', '', 'درخواست تأیید و پرداخت؛ وضعیت نهایی نامشخص', 'درخواست پرداخت همراه اسناد ۱۴۲۵ و ۱۴۲۹ مطرح شد؛ مبلغ در پیام‌های قابل مشاهده نیست.', '۲ آبان'],
  [
    '1429', '', 'هزینه بارنامه سامانه 586n13204', '586n13204', '', 'چنگانی',
    '260170000000221308469004', 'پرداخت‌شده',
    'پرداخت سندهای ۱۴۲۹ و ۱۴۲۵ درخواست شد و سپس گفته شد «این دو مورد پرداخت شد». مبلغ در پیام درج نشده است.', '۲ آبان',
  ],
  [
    '1432', '', 'مراجعه به سامانه 062N13024', '062N13024', '', '', '',
    'جزئیات مبلغ و پرداخت درج نشده', 'شرح فاکتور در پیام بازارسال‌شده آمده است.', '۲ آبان',
  ],
  [
    '1434', '', 'مراجعه به سامانه 007W13029', '007W13029', '', '', '',
    'جزئیات مبلغ و پرداخت درج نشده', 'شرح فاکتور در پیام بازارسال‌شده آمده است.', '۲ آبان',
  ],
  [
    '1435', '', 'مراجعه به سامانه 007E13001', '007E13001', '', '', '',
    'جزئیات مبلغ و پرداخت درج نشده', 'شرح فاکتور در پیام بازارسال‌شده آمده است.', '۲ آبان',
  ],
  [
    '1436', '', 'مراجعه به سامانه 007E13005', '007E13005', '', '', '',
    'درخواست پرداخت', 'شرح فاکتور در پیام بازارسال‌شده آمده است؛ در ۱۸ آبان صریحاً پرداخت سند درخواست و لینک شماره ارسال شد.', '۲ و ۱۸ آبان',
  ],
  [
    '1437', '', 'مراجعه به سامانه 065E13015', '065E13015', '', '', '',
    'درخواست پرداخت', 'شرح فاکتور در پیام بازارسال‌شده آمده است؛ در ۲۴ آبان پرداخت همراه سند ۱۴۳۹ درخواست شد. ارتباط مبلغ کلی ۲۰ میلیون تومانی با هر سند روشن نیست.', '۲ و ۲۴ آبان',
  ],
  [
    '1438', '', 'مراجعه به سامانه 062S13015', '062S13015', '', '', '',
    'جزئیات مبلغ و پرداخت درج نشده', 'شرح فاکتور در پیام بازارسال‌شده آمده است.', '۲ آبان',
  ],
  [
    '1440', '', 'مراجعه به سامانه 007W13024', '007W13024', '', '', '',
    'جزئیات مبلغ و پرداخت درج نشده', 'شرح فاکتور در پیام بازارسال‌شده آمده است.', '۲ آبان',
  ],
  [
    '1441', '', 'مراجعه به سامانه 047N13002', '047N13002', '', '', '',
    'جزئیات مبلغ و پرداخت درج نشده', 'شرح فاکتور در پیام بازارسال‌شده آمده است.', '۲ آبان',
  ],
  [
    '1442', '405/07/27', 'کپی مدارک جهت وضعیت سامانه 656e13204', '656e13204', '',
    'ناصر لطیفی', '470600241670006993450001', 'مبلغ نهایی نامشخص',
    'مبلغ اولیه 2,200,000 ریال درج شد؛ درباره مبلغ سؤال شد و پاسخ «اصلاح شد» آمد، اما مبلغ اصلاح‌شده در پیام‌های قابل مشاهده نیست.',
    '۲ آبان',
  ],
  [
    '1443', '405/07/58', 'هزینه باربری انتقال تجهیزات سامانه‌های 051s13001 و 961w13002',
    '051s13001 / 961w13002', '1000000', 'حسن‌پور', '240170000000337032267005',
    'اعلام‌شده در گروه', 'تاریخ سند در پیام به‌شکل نامعتبر 405/07/58 درج شده؛ بدون اصلاح حدسی همان‌طور ثبت شد.', '۲ آبان',
  ],
  [
    '1453', '405/08/21', 'رفع خرابی',
    '062s13002 / 071e13010 / 62n13024 / 071e13030', '15600000', 'مهدی قاسمی',
    '930190000000305911637001', 'اعلام‌شده در گروه',
    'محور نایین؛ شروع و پایان تردد بالابر برای سند بازارسال شد.', '۲۱ آبان',
  ],
  [
    '1452', '405/08/18', 'رفع خرابی سامانه‌های 009w13001/047s13005/047n13005',
    '009w13001 / 047s13005 / 047n13005', '16250000', 'مهدی قاسمی',
    '930190000000350911637001', 'اعلام‌شده در گروه',
    'شروع و پایان تردد بالابر برای سند بازارسال شد.', '۱۸ آبان',
  ],
  [
    '1451', '405/08/13', 'رفع خرابی سامانه 007e13025', '007e13025', '12350000',
    'مهدی قاسمی', '930190000000350911637001', 'اعلام‌شده در گروه',
    'پیام سند در گروه با علامت ✅ نمایش داده شد؛ شروع و پایان تردد بالابر اعلام شد.', '۱۳ آبان',
  ],
  [
    '1446', '405/07/28', 'هزینه جرثقیل/بالابر برای حمل بتن و دکل روشنایی از انبار راهداری شاهین‌شهر به محور فولادشهر، نصب کابل برق پروژکتور هوایی',
    '961w13202', '150000000', 'محمد دانشمند', '120190000000333811110005',
    'تأیید شد؛ پرداخت درخواست شد',
    'مستندات ۱۴۴۶/۱۴۴۷ ارسال شد؛ مبالغ توافقی و پیش از شروع با آقای بیرانوند هماهنگ شده بود. در ۱۲ آبان درخواست پرداخت شد و در ۱۳ آبان نیکتا گفت همه فاکتورهای ارسال‌شده را تأیید کرده است؛ مبلغ بالاتر از سقف ذکر شد.',
    '۴ تا ۱۳ آبان',
  ],
  [
    '1447', '405/07/28', 'هزینه بالابر خاور؛ مراجعه از فولادشهر به سامانه کنار لایبید و رفع خرابی روتر و دوربین',
    '051s13004؛ محور 13005', '100000000', 'محمد دانشمند', '120190000000333811110005',
    'تأیید شد؛ پرداخت درخواست شد',
    'مستندات ۱۴۴۶/۱۴۴۷ ارسال شد؛ مبالغ توافقی و پیش از شروع با آقای بیرانوند هماهنگ شده بود. در ۱۲ آبان درخواست پرداخت شد و در ۱۳ آبان نیکتا گفت همه فاکتورهای ارسال‌شده را تأیید کرده است؛ مبلغ بالاتر از سقف ذکر شد.',
    '۴ تا ۱۳ آبان',
  ],
  [
    '1448', '405/08/04', 'رفع خرابی، تعویض و نظافت دوربین و تنظیم پروژکتورها؛ تحویل به آقای معصومی',
    '047n13002؛ محور 13005', '', '', '', 'جزئیات مبلغ و پرداخت درج نشده',
    'شروع و پایان بالابر برای محور خمین در ۴ آبان اعلام شد.', '۴ و ۵ آبان',
  ],
  [
    '1449', '405/08/10', 'هزینه بالابر جهت رفع خرابی سامانه‌های 062n13004 و 062s13002',
    '062n13004 / 062s13002', '71500000', 'مهدی قاسمی', '9301900000003059116337001',
    'اعلام‌شده در گروه', 'شروع و پایان تردد بالابر برای ۱۰ آبان اعلام شد.', '۱۰ آبان',
  ],
  [
    '1431', '', 'مراجعه به سامانه 062N13020', '062N13020', '', '', '',
    'جزئیات پرداخت نامشخص', 'شرح فاکتور در پیام بازارسال‌شده آمده است؛ لینک شماره سند نیز در ۲۰ آبان ارسال شد.', '۲ و ۲۰ آبان',
  ],
  [
    '1403', '', 'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.', '', '', '', '',
    'وضعیت پرداخت نامشخص',
    'در ۲۰ و ۲۳ آبان درخواست پرداخت شد؛ سپس «قبلاً پرداخت شده» گفته شد، اما فرستنده گفت رسید واریزی ندارد.',
    '۲۰ و ۲۳ آبان',
  ],
  [
    '1433', '', 'مراجعه به سامانه 051S13001', '051S13001', '', '', '',
    'جزئیات پرداخت نامشخص', 'شرح فاکتور در پیام بازارسال‌شده آمده؛ در ۲۱ آبان لینک شماره سند و پیام «ممنون» دیده شد.', '۲ و ۲۱ آبان',
  ],
  [
    '1401', '', 'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.', '', '', '', '',
    'درخواست پرداخت', 'درخواست پرداخت همراه اسناد ۱۴۴۴، ۱۴۴۵ و ۱۴۵۰؛ لینک شماره سند فرستاده شد.', '۲۳ آبان',
  ],
  [
    '1444', '405/08/03', 'هزینه باربری جهت تحویل مدارک سامانه 063D13010', '063D13010', '',
    'چنگانی', '6037997540870863', 'درخواست پرداخت؛ برای ثبت تأیید شد',
    'در ۳ آبان درباره ثبت فاکتور به نام های‌وب سؤال شد؛ پاسخ داده شد فاکتورها باید به نام رهکام باشند و اگر اشتباه صادر شده اصلاح شود. در ۲۳ آبان پرداخت درخواست شد و در ۲۵ آبان تأیید برای ثبت با ✅ اعلام شد.',
    '۳، ۲۳ و ۲۵ آبان',
  ],
  [
    '1445', '', 'هزینه کپی جهت صورت‌وضعیت سامانه توسعه', '961w13202', '5280000',
    'چنگانی', '260170000000221308469004', 'درخواست پرداخت',
    'در ۳ آبان پیام سند با ✅ نمایش داده شد؛ در ۲۳ آبان پرداخت همراه اسناد ۱۴۰۱، ۱۴۴۴ و ۱۴۵۰ درخواست شد و لینک شماره سند ارسال شد.',
    '۳ و ۲۳ آبان',
  ],
  [
    '1450', '405/08/12', 'هزینه باربری ارسال تجهیزات جهت سامانه 062n13024', '062n13024',
    '700000', 'چنگانی', '6037997540870863', 'درخواست پرداخت',
    'در ۱۲ آبان شماره سند ارسال شد؛ در ۲۳ آبان پرداخت آن همراه اسناد ۱۴۰۱، ۱۴۴۴ و ۱۴۴۵ درخواست شد.',
    '۱۲ و ۲۳ آبان',
  ],
  [
    '1439', '', 'مراجعه به سامانه 062N13013', '062N13013', '', '', '',
    'درخواست پرداخت', 'شرح فاکتور در پیام بازارسال‌شده آمده است؛ در ۲۴ آبان پرداخت همراه سند ۱۴۳۷ درخواست و لینک‌ها ارسال شد. ارتباط مبلغ کلی ۲۰ میلیون تومانی با هر سند روشن نیست.',
    '۲ و ۲۴ آبان',
  ],
  [
    '1394', '', 'بابت نصب پنل خورشیدی سامانه 586N13202', '586N13202', '', '', '',
    'درخواست پرداخت؛ تأیید نامشخص',
    'گفته شد مدت زیادی بدهکارند؛ لینک فاکتور ارسال شد و پیام با ✅ واکنش گرفت. در همان روز درخواست کلی فاکتور ۱۵ میلیون تومانی نیز مطرح شد، اما مبلغ این سند جداگانه نیامده است.',
    '۲۵ آبان',
  ],
  [
    '1392',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'درخواست پرداخت',
    'همراه اسناد ۱۴۱۰، ۱۴۱۳ و ۱۴۱۵ برای پرداخت درخواست شد؛ سپس اصلاحیه ثبت شماره شبا اعلام شد.',
    '۳۰ آبان تا ۱ آذر',
  ],
  [
    '1410',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'پرداخت‌شده',
    'در گروه صریحاً «۱۴۱۰ پرداخت شده» اعلام شد.',
    '۱ آذر',
  ],
  [
    '1413',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'درخواست پرداخت',
    'همراه اسناد ۱۳۹۲، ۱۴۱۰ و ۱۴۱۵ برای پرداخت درخواست شد.',
    '۳۰ آبان تا ۱ آذر',
  ],
  [
    '1415',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'درخواست پرداخت',
    'همراه اسناد ۱۳۹۲، ۱۴۱۰ و ۱۴۱۳ برای پرداخت درخواست شد.',
    '۳۰ آبان تا ۱ آذر',
  ],
  [
    '1393',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'درخواست واریز',
    'درخواست واریز همراه اسناد ۱۳۸۵ و ۱۴۵۶؛ شماره سند دوباره در گروه فرستاده شد.',
    '۱ آذر',
  ],
  [
    '1385',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'درخواست واریز',
    'درخواست واریز همراه اسناد ۱۳۹۳ و ۱۴۵۶؛ شماره سند دوباره در گروه فرستاده شد.',
    '۱ آذر',
  ],
  [
    '1416',
    '',
    'شرح و مبلغ در پیام‌های قابل مشاهده درج نشده است.',
    '',
    '',
    '',
    '',
    'درخواست پرداخت',
    'پس از درخواست فاکتور ۱۰ میلیون تومانی، پرداخت سند ۱۴۱۶ درخواست شد؛ ارتباط مبلغ با این سند در پیام روشن نیست.',
    '۳ و ۴ آذر',
  ],
  [
    '',
    '',
    'یادداشت کلی گروه',
    '',
    '',
    '',
    '',
    '',
    'درخواست‌های کلی اعلام فاکتور ۳۰ و ۲۰ میلیون تومانی در گروه هست؛ پیام‌ها ارتباط قطعی این مبلغ‌ها را با شماره سند مشخص نمی‌کنند.',
    '۳۰ آبان و ۱ آذر',
  ],
];

function cellText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}

function jsonArray(value: unknown): unknown[] {
  return Array.isArray(value) ? (value as unknown[]) : [];
}

function jsonRows(value: unknown): unknown[][] {
  return jsonArray(value).filter((row): row is unknown[] => Array.isArray(row));
}

function normalizeBillHeader(value: string): string {
  return value
    .trim()
    .normalize('NFKC')
    .toLocaleLowerCase('fa')
    .replace(/[\u064a\u0649]/g, '\u06cc')
    .replace(/\u0643/g, '\u06a9')
    .replace(/[\s\u200c\u200f/\\_-]/g, '');
}

function normalizeBillIdentifierWorkbook(province: string, headers: string[], rows: string[][]) {
  if (headers.length === 0) return { headers, rows };
  const provinceHeader = normalizeBillHeader('\u0627\u0633\u062a\u0627\u0646');
  let provinceIndex = headers.findIndex((header) => normalizeBillHeader(header) === provinceHeader);
  const normalizedHeaders = [...headers];
  if (provinceIndex < 0) {
    provinceIndex = normalizedHeaders.length;
    normalizedHeaders.push('\u0627\u0633\u062a\u0627\u0646');
  }
  const provinceName = rahcomProvinceLabel(province);
  const normalizedRows = rows.map((row) => {
    const normalizedRow = Array.from({ length: normalizedHeaders.length }, (_, index) => row[index] ?? '');
    normalizedRow[provinceIndex] = provinceName;
    return normalizedRow;
  });
  return { headers: normalizedHeaders, rows: normalizedRows };
}

function normalizeBillIdentifier(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    })
    .replace(/\s/g, '');
}

function hasMixedBillSystemFamilies(value: string): boolean {
  const families = new Set(
    value
      .split(/[;,|]/)
      .map((code) => code.trim())
      .filter(Boolean)
      .map((code) => {
        const externalType = code
          .match(/^EXTERNAL:(USO|RAHCOM|VSAT):/i)?.[1]
          ?.toUpperCase();
        return externalType && externalType !== 'RAHCOM'
          ? externalType
          : 'RAHCOM';
      }),
  );
  return families.size > 1;
}

@Injectable()
export class RahcomService {
  private readonly demoSystemPrefix = 'DEMO-RAHCOM-';
  private readonly demoActivityPrefix = 'DEMO-RAHCOM |';
  constructor(private readonly prisma: PrismaService) {}
  private async serializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: 'Serializable',
        });
      } catch (error) {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2034' ||
          attempt >= 2
        )
          throw error;
      }
    }
  }
  private organization(user: AuthenticatedUser) {
    if (!user.organizationId)
      throw new BadRequestException('No active organization is selected.');
    return user.organizationId;
  }
  private async organizationProvinces(organizationId: string) {
    const branches = await this.prisma.branch.findMany({
      where: { organizationId, isActive: true },
      select: { code: true, name: true },
    });
    const provinces = branches.flatMap(({ code, name }) => {
      const codeProvince = code.match(/^DEMO-PROVINCE-(.+)$/i)?.[1]?.toLowerCase();
      const province = codeProvince && isRahcomProvinceId(codeProvince)
        ? codeProvince
        : rahcomProvinceIdFromLabel(name);
      return province ? [province] : [];
    });
    return [...new Set(provinces)];
  }
  private async authorize(
    user: AuthenticatedUser,
    write: boolean | 'activity' = false,
    allowNoProvince = false,
  ): Promise<RahcomAccess> {
    const organizationId = this.organization(user);
    const provinces = await this.organizationProvinces(organizationId);
    if (!allowNoProvince && provinces.length === 0)
      throw new ForbiddenException(
        'Create at least one active province in organization settings before using Rahcom.',
      );
    const membership = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      select: {
        id: true,
        rahcomProvince: true,
        rahcomSelectedProvince: true,
        organization: { select: { ownerId: true } },
        roles: {
          select: {
            role: {
              select: {
                key: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!membership) {
      const ownedOrganization = await this.prisma.organization.findFirst({
        where: { id: organizationId, ownerId: user.id, status: 'ACTIVE' },
        select: { id: true },
      });
      if (!ownedOrganization)
        throw new ForbiddenException(
          'An active organization membership is required.',
        );
      const preference = await this.prisma.userPreference.findUnique({
        where: { userId: user.id },
        select: { rahcomSelectedProvince: true },
      });
      const selectedProvince = preference?.rahcomSelectedProvince ?? null;
      const hasProvinceAccess = provinces.includes(selectedProvince ?? '');
      if (!allowNoProvince && !hasProvinceAccess)
        throw new ForbiddenException(
          'Select a configured province in the Rahcom header before using Rahcom.',
        );
      return {
        organizationId,
        memberId: null,
        demoOnly: false,
        provinceViewer: false,
        isAdmin: true,
        province: null,
        selectedProvince: hasProvinceAccess ? selectedProvince : null,
        provinces,
        hasProvinceAccess,
      };
    }
    const roles = membership.roles.map(({ role }) => role);
    const demoOnly = roles.some(({ key }) => key.toUpperCase() === 'DEMO_USER');
    const provinceViewer = roles.some(
      ({ key }) => key.toUpperCase() === 'RAHCOM_VIEWER',
    );
    const isOrganizationAdmin = roles.some(({ key }) =>
      ['ADMIN', 'SUPER_ADMIN'].includes(key.toUpperCase()),
    );
    const isAdmin =
      isOrganizationAdmin || membership.organization.ownerId === user.id;
    if (
      write &&
      (demoOnly || provinceViewer || (!isAdmin && write !== 'activity'))
    )
      throw new ForbiddenException('This account has read-only Rahcom access.');
    const province = demoOnly
      ? 'isfahan'
      : provinceViewer
        ? null
        : membership.rahcomProvince;
    const assignedProvince = province && provinces.includes(province) ? province : null;
    const requestedSelection = membership.rahcomSelectedProvince;
    const selectedProvince = demoOnly
      ? 'isfahan'
      : requestedSelection && requestedSelection !== 'all' && provinces.includes(requestedSelection)
        ? requestedSelection
        : assignedProvince;
    const hasProvinceAccess = demoOnly
      ? provinces.includes('isfahan')
      : Boolean(selectedProvince);
    if (!allowNoProvince && !hasProvinceAccess)
      throw new ForbiddenException(
        'Select a configured province in the Rahcom header or ask an administrator to assign your province.',
      );
    return {
      organizationId,
      memberId: membership.id,
      demoOnly,
      provinceViewer,
      isAdmin,
      province: assignedProvince,
      provinces,
      selectedProvince,
      hasProvinceAccess,
    };
  }
  private scopedProvince(access: RahcomAccess, requested?: string | null) {
    const province = String(
      requested ?? (access.isAdmin || access.provinceViewer ? access.selectedProvince : '') ?? '',
    ).trim();
    if (access.demoOnly) {
      if (!access.provinces.includes('isfahan'))
        throw new ForbiddenException('Isfahan must exist in organization settings before using Rahcom.');
      if (province && province !== 'isfahan')
        throw new ForbiddenException(
          'Demo accounts can only access Isfahan Rahcom data.',
        );
      return 'isfahan';
    }
    if (province && province !== 'all' && !isRahcomProvinceId(province))
      throw new BadRequestException('Choose a supported province.');
    if (province && province !== 'all' && !access.provinces.includes(province))
      throw new ForbiddenException('Choose a province configured in organization settings.');
    if (access.provinceViewer)
      return !province || province === 'all' ? undefined : province;
    if (access.isAdmin)
      return !province || province === 'all' ? access.province ?? undefined : province;
    if (province && province !== access.province)
      throw new ForbiddenException(
        'You can only access Rahcom data for your assigned province.',
      );
    return access.province;
  }
  async listSites(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const lists = await this.prisma.rahcomSitesList.findMany({
      where: { organizationId: access.organizationId, ...(province ? { province } : {}) },
      orderBy: { province: 'asc' },
      select: { headers: true, rows: true },
    });
    if (!lists.length) return [];
    const headers = jsonArray(lists[0].headers).map(cellText);
    let typeIndex = headers.findIndex((header) => normalizeBillHeader(header) === normalizeBillHeader('\u0646\u0648\u0639 \u0633\u0627\u06cc\u062a'));
    if (typeIndex < 0) {
      typeIndex = headers.length;
      headers.push('\u0646\u0648\u0639 \u0633\u0627\u06cc\u062a');
    }
    const rows = lists.flatMap((list) => {
      const sourceHeaders = jsonArray(list.headers).map(cellText);
      const sourceHeaderIndexes = headers.map((header) =>
        sourceHeaders.findIndex((sourceHeader) => normalizeBillHeader(sourceHeader) === normalizeBillHeader(header)),
      );
      return jsonRows(list.rows).map((value) => {
        const row = sourceHeaderIndexes.map((sourceIndex) => sourceIndex < 0 ? '' : cellText(value[sourceIndex]));
        if (!row[typeIndex]) row[typeIndex] = 'USO';
        return row;
      });
    });
    return [{ name: 'All Sites', rows: [headers, ...rows] }];
  }
  async replaceSites(user: AuthenticatedUser, body: ReplaceRahcomSitesListDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province) throw new BadRequestException('Select a single province to save sites.');
    if (body.headers.length < 2 || body.headers.some((header) => !header.trim() || header.length > 120))
      throw new BadRequestException('Site headers are invalid.');
    if (body.rows.some((row) => !Array.isArray(row) || row.length > body.headers.length || row.some((value) => typeof value !== 'string' || value.length > 2000)))
      throw new BadRequestException('Site rows must contain text values within the column count.');
    const normalizedHeaders = body.headers.map(normalizeBillHeader);
    if (new Set(normalizedHeaders).size !== normalizedHeaders.length)
      throw new BadRequestException('Site headers must be unique.');
    const serializedSize = Buffer.byteLength(JSON.stringify({ headers: body.headers, rows: body.rows }), 'utf8');
    if (serializedSize > 10 * 1024 * 1024) throw new BadRequestException('Site list exceeds the 10 MB limit.');
    const saved = await this.prisma.rahcomSitesList.upsert({
      where: { organizationId_province: { organizationId: access.organizationId, province } },
      create: { organizationId: access.organizationId, province, headers: body.headers, rows: body.rows, updatedById: user.id },
      update: { headers: body.headers, rows: body.rows, updatedById: user.id },
      select: { updatedAt: true },
    });
    return { saved: true, province, updatedAt: saved.updatedAt };
  }
  async listMissions(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    if (!province) throw new BadRequestException('Select a single province to view missions.');
    return this.prisma.rahcomMissionList.findUnique({
      where: { organizationId_province: { organizationId: access.organizationId, province } },
      select: { province: true, fileName: true, sheetName: true, headers: true, rows: true, rowCount: true, updatedAt: true },
    });
  }
  async replaceMissions(user: AuthenticatedUser, body: ReplaceRahcomMissionListDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province) throw new BadRequestException('Select a single province to save missions.');
    if (body.headers.length < 2 || body.headers.some((header) => !header.trim() || header.length > 120))
      throw new BadRequestException('Mission headers are invalid.');
    const normalizedHeaders = body.headers.map(normalizeBillHeader);
    if (new Set(normalizedHeaders).size !== normalizedHeaders.length)
      throw new BadRequestException('Mission headers must be unique.');
    if (body.rows.some((row) => !Array.isArray(row) || row.length !== body.headers.length || row.some((value) => typeof value !== 'string' || value.length > 10000)))
      throw new BadRequestException('Mission rows must contain text values matching the column count.');
    const provinceIndex = normalizedHeaders.findIndex((header) => header === normalizeBillHeader('استان') || header === 'province');
    if (provinceIndex < 0 || body.rows.some((row) => !['اصفهان', 'isfahan'].includes(normalizeBillHeader(row[provinceIndex]))))
      throw new BadRequestException('Every mission row must belong to Isfahan.');
    const serializedSize = Buffer.byteLength(JSON.stringify({ headers: body.headers, rows: body.rows }), 'utf8');
    if (serializedSize > 10 * 1024 * 1024) throw new BadRequestException('Mission list exceeds the 10 MB limit.');
    const saved = await this.prisma.rahcomMissionList.upsert({
      where: { organizationId_province: { organizationId: access.organizationId, province } },
      create: { organizationId: access.organizationId, province, fileName: body.fileName, sheetName: body.sheetName, headers: body.headers, rows: body.rows, rowCount: body.rows.length, updatedById: user.id },
      update: { fileName: body.fileName, sheetName: body.sheetName, headers: body.headers, rows: body.rows, rowCount: body.rows.length, updatedById: user.id },
      select: { updatedAt: true },
    });
    return { saved: true, province, rowCount: body.rows.length, updatedAt: saved.updatedAt };
  }
  async getMissionDefaults(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    if (!province) throw new BadRequestException('Select a single province to view mission defaults.');
    return this.prisma.rahcomMissionDefaults.findUnique({
      where: { organizationId_province: { organizationId: access.organizationId, province } },
      select: { province: true, requestType: true, provincialManager: true, missionField: true, provincialOfficeSupervisor: true, provincialOperationsExpert: true, updatedAt: true },
    });
  }
  async saveMissionDefaults(user: AuthenticatedUser, body: SaveRahcomMissionDefaultsDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province) throw new BadRequestException('Select a single province to save mission defaults.');
    return this.prisma.rahcomMissionDefaults.upsert({
      where: { organizationId_province: { organizationId: access.organizationId, province } },
      create: { organizationId: access.organizationId, province, requestType: body.requestType.trim(), provincialManager: body.provincialManager.trim(), missionField: body.missionField.trim(), provincialOfficeSupervisor: body.provincialOfficeSupervisor.trim(), provincialOperationsExpert: body.provincialOperationsExpert.trim(), updatedById: user.id },
      update: { requestType: body.requestType.trim(), provincialManager: body.provincialManager.trim(), missionField: body.missionField.trim(), provincialOfficeSupervisor: body.provincialOfficeSupervisor.trim(), provincialOperationsExpert: body.provincialOperationsExpert.trim(), updatedById: user.id },
      select: { province: true, requestType: true, provincialManager: true, missionField: true, provincialOfficeSupervisor: true, provincialOperationsExpert: true, updatedAt: true },
    });
  }
  async getRahcomAccess(user: AuthenticatedUser) {
    const access = await this.authorize(user, false, true);
    return {
      memberId: access.memberId,
      province: access.province,
      selectedProvince:
        access.isAdmin || access.provinceViewer
          ? access.selectedProvince
          : access.province,
      isAdmin: access.isAdmin,
      canSwitchProvince: access.isAdmin || access.provinceViewer,
      canManageAssignments:
        access.isAdmin && !access.demoOnly && !access.provinceViewer,
      canRecordActivities:
        !access.demoOnly &&
        !access.provinceViewer &&
        (access.isAdmin || Boolean(access.province || access.selectedProvince)),
      provinces: access.provinces,
      hasProvinceAccess: access.hasProvinceAccess,
    };
  }
  async updateSelectedProvince(user: AuthenticatedUser, province: string) {
    const access = await this.authorize(user, false, true);
    if (
      (!access.isAdmin && !access.provinceViewer) ||
      access.demoOnly
    )
      throw new ForbiddenException(
        'This account cannot choose the Rahcom province view.',
      );
    const normalized = String(province ?? '').trim();
    if (normalized !== 'all' && !isRahcomProvinceId(normalized))
      throw new BadRequestException('Choose a supported province.');
    if (normalized !== 'all' && !access.provinces.includes(normalized))
      throw new ForbiddenException('Choose a province configured in organization settings.');
    if (!access.memberId) {
      await this.prisma.userPreference.upsert({
        where: { userId: user.id },
        create: { userId: user.id, rahcomSelectedProvince: normalized === 'all' ? null : normalized },
        update: { rahcomSelectedProvince: normalized === 'all' ? null : normalized },
      });
      return { rahcomSelectedProvince: normalized };
    }
    const updated = await this.prisma.organizationMember.updateMany({
      where: {
        id: access.memberId,
        organizationId: access.organizationId,
        status: 'ACTIVE',
      },
      data: { rahcomSelectedProvince: normalized },
    });
    if (!updated.count)
      throw new ConflictException(
        'Your active organization membership changed. Refresh and try again.',
      );
    return { rahcomSelectedProvince: normalized };
  }
  private validDate(value: unknown) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
      throw new BadRequestException('Date must use YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Invalid date.');
    return date;
  }
  private tehranDateRange(value: string) {
    const start = this.validDate(value);
    const offset = 210 * 60_000;
    return {
      gte: new Date(start.getTime() - offset),
      lt: new Date(start.getTime() + 86_400_000 - offset),
    };
  }
  async listInventory(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    return this.prisma.rahcomInventoryEntry.findMany({
      where: { organizationId: access.organizationId, ...(province ? { province } : {}) },
      orderBy: [{ usageDate: 'desc' }, { createdAt: 'desc' }],
    });
  }
  async createInventory(user: AuthenticatedUser, body: CreateRahcomInventoryEntryDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province) throw new BadRequestException('Select a province.');
    const system = await this.prisma.rahcomSystem.findFirst({
      where: { id: body.systemId, organizationId: access.organizationId, province },
      select: { id: true, systemName: true, systemCode: true },
    });
    if (!system) throw new NotFoundException('Rahcom system not found in this province.');
    const usageDate = new Date(`${body.usageDate}T00:00:00.000Z`);
    if (Number.isNaN(usageDate.getTime()) || usageDate.toISOString().slice(0, 10) !== body.usageDate)
      throw new BadRequestException('Invalid usage date.');
    return this.prisma.rahcomInventoryEntry.create({ data: {
      organizationId: access.organizationId, createdById: user.id, province,
      equipmentName: body.equipmentName.trim(), systemId: system.id,
      systemNameSnapshot: system.systemName, systemCodeSnapshot: system.systemCode, usageDate,
    } });
  }
  async deleteInventory(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, true);
    const entry = await this.prisma.rahcomInventoryEntry.findFirst({ where: { id, organizationId: access.organizationId } });
    if (!entry) throw new NotFoundException('Inventory entry not found.');
    this.scopedProvince(access, entry.province);
    await this.prisma.rahcomInventoryEntry.delete({ where: { id } });
    return { deleted: true };
  }
  async listSystems(user: AuthenticatedUser, province?: string) {
    const access = await this.authorize(user);
    const selectedProvince = this.scopedProvince(access, province);
    return this.prisma.rahcomSystem.findMany({
      where: {
        organizationId: access.organizationId,
        ...(access.demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
        ...(selectedProvince ? { province: selectedProvince } : {}),
        ...(selectedProvince === 'isfahan'
          ? { NOT: { systemCode: { equals: excludedIsfahanSystemCode, mode: 'insensitive' as const } } }
          : {}),
      },
      orderBy: [{ province: 'asc' }, { systemName: 'asc' }],
    });
  }
  async searchSystems(
    user: AuthenticatedUser,
    requestedProvince: string | undefined,
    requestedQuery: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const query = String(requestedQuery ?? '').trim();
    if (!query) return [];
    const normalizedQuery = query
      .normalize('NFKC')
      .toLocaleLowerCase('fa')
      .replace(/[\u06f0-\u06f9\u0660-\u0669]/g, (digit) => {
        const code = digit.charCodeAt(0);
        return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
      })
      .replace(/[\u064a\u0649]/g, '\u06cc')
      .replace(/\u0643/g, '\u06a9')
      .replace(/[\u064b-\u065f\u0670\u200c\u200e\u200f]/g, '');
    const queryVariants = [
      ...new Set([
        query,
        normalizedQuery,
        normalizedQuery
          .replace(/\u06cc/g, '\u064a')
          .replace(/\u06a9/g, '\u0643'),
      ]),
    ];
    return this.prisma.rahcomSystem.findMany({
      where: {
        organizationId: access.organizationId,
        ...(access.demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
        ...(province ? { province } : {}),
        ...(province === 'isfahan'
          ? { NOT: { systemCode: { equals: excludedIsfahanSystemCode, mode: 'insensitive' as const } } }
          : {}),
        OR: queryVariants.flatMap((variant) => [
          { systemName: { contains: variant, mode: 'insensitive' } },
          { systemCode: { contains: variant, mode: 'insensitive' } },
        ]),
      },
      orderBy: [{ province: 'asc' }, { systemName: 'asc' }],
      take: 8,
    });
  }
  async lookupSystems(user: AuthenticatedUser, body: RahcomSystemLookupDto) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, body.province);
    if (!province || !isRahcomProvinceId(province))
      throw new BadRequestException('Choose one supported province.');
    const ids = [
      ...new Set((body.ids ?? []).map((id) => id.trim()).filter(Boolean)),
    ];
    const codes = [
      ...new Set((body.codes ?? []).map((code) => code.trim()).filter(Boolean)),
    ];
    if (ids.length + codes.length > 500)
      throw new BadRequestException(
        'Look up at most 500 saved system references at once.',
      );
    if (!ids.length && !codes.length) return [];
    const references: Prisma.RahcomSystemWhereInput[] = [];
    if (ids.length) references.push({ id: { in: ids } });
    if (codes.length)
      references.push({
        systemCode: { in: codes, mode: 'insensitive' },
      });
    return this.prisma.rahcomSystem.findMany({
      where: {
        organizationId: access.organizationId,
        province,
        ...(access.demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
        ...(province === 'isfahan'
          ? { NOT: { systemCode: { equals: excludedIsfahanSystemCode, mode: 'insensitive' as const } } }
          : {}),
        OR: references,
      },
      select: {
        id: true,
        systemName: true,
        systemCode: true,
        province: true,
        announcedAxis: true,
      },
      orderBy: { systemName: 'asc' },
    });
  }
  async getBillIdentifiers(
    user: AuthenticatedUser,
    requestedProvince?: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(
      access,
      requestedProvince ?? 'isfahan',
    );
    if (!province)
      throw new BadRequestException(
        'Select a single province to read bill identifiers.',
      );
    const list = await this.prisma.rahcomBillIdentifierList.findUnique({
      where: {
        organizationId_province: {
          organizationId: access.organizationId,
          province,
        },
      },
      select: { headers: true, rows: true, updatedAt: true },
    });
    if (!list) return { headers: [], rows: [], updatedAt: null };
    const normalized = normalizeBillIdentifierWorkbook(
      province,
      jsonArray(list.headers).map(cellText),
      jsonRows(list.rows).map((row) => row.map(cellText)),
    );
    return { ...normalized, updatedAt: list.updatedAt };
  }
  async getInvoices(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    if (!province)
      throw new BadRequestException('Select a single province to read invoices.');
    const organization = await this.prisma.organization.findUnique({
      where: { id: access.organizationId },
      select: { slug: true },
    });
    const invoiceSeedOrganizationSlug =
      process.env.RAHCOM_INVOICE_SEED_ORGANIZATION_SLUG?.trim() || 'rahyar';
    const seedIsfahanInvoices =
      province === 'isfahan' && organization?.slug === invoiceSeedOrganizationSlug;
    const list = await this.prisma.rahcomInvoiceList.upsert({
      where: { organizationId_province: { organizationId: access.organizationId, province } },
      create: {
        organizationId: access.organizationId,
        province,
        headers: seedIsfahanInvoices ? initialIsfahanInvoiceHeaders : [],
        rows: seedIsfahanInvoices ? initialIsfahanInvoiceRows : [],
        updatedById: user.id,
      },
      update: {},
      select: { headers: true, rows: true, updatedAt: true },
    });
    return {
      headers: jsonArray(list.headers).map(cellText),
      rows: jsonRows(list.rows).map((row) => row.map(cellText)),
      updatedAt: list.updatedAt,
    };
  }
  async getInvoiceAttachments(user: AuthenticatedUser, requestedProvince?: string) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    if (!province)
      throw new BadRequestException('Select a single province to read invoice attachments.');
    return this.prisma.rahcomInvoiceAttachment.findMany({
      where: { organizationId: access.organizationId, province },
      orderBy: [{ invoiceNumber: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        invoiceNumber: true,
        category: true,
        originalName: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }
  async uploadInvoiceAttachment(
    user: AuthenticatedUser,
    input: { province?: string; invoiceNumber?: string; category?: string },
    file?: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, input.province);
    if (!province)
      throw new BadRequestException('Select a single province to save invoice attachments.');
    const invoiceNumber = String(input.invoiceNumber ?? '')
      .trim()
      .normalize('NFKC')
      .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
      .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
    if (!/^[A-Za-z0-9][A-Za-z0-9./_-]{0,79}$/.test(invoiceNumber))
      throw new BadRequestException('A valid invoice number is required.');
    const categories = ['INVOICE', 'PAYMENT_RECEIPT', 'START_PHOTO', 'END_PHOTO', 'OTHER'];
    const category = String(input.category ?? '');
    if (!categories.includes(category))
      throw new BadRequestException('Select a valid invoice attachment category.');
    if (!file?.buffer?.length || file.size !== file.buffer.length)
      throw new BadRequestException('Select an image file to upload.');
    const imageType = this.invoiceAttachmentImageType(file.buffer, file.mimetype);
    const originalName = String(file.originalname || 'attachment')
      .replace(/[\\/\u0000-\u001f]/g, '_')
      .slice(-255);
    const provinceCode = this.invoiceAttachmentProvinceCode(province);
    const categoryFolder = this.invoiceAttachmentCategoryFolder(category);
    const safeInvoiceNumber = invoiceNumber.replace(/[^A-Za-z0-9_-]/g, '-');
    const originalStem = path.basename(originalName, path.extname(originalName))
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'image';
    const extension = imageType === 'image/png' ? '.png' : imageType === 'image/webp' ? '.webp' : '.jpg';
    const fileName = `${safeInvoiceNumber}_${category.toLowerCase()}_${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID().slice(0, 8)}_${originalStem}${extension}`;
    const storagePath = path.posix.join(provinceCode, categoryFolder, fileName);
    const absolutePath = this.invoiceAttachmentAbsolutePath(storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });
    try {
      return await this.prisma.rahcomInvoiceAttachment.create({
        data: {
          organizationId: access.organizationId,
          province,
          invoiceNumber,
          category,
          originalName: originalName || 'attachment',
          mimeType: imageType,
          size: file.buffer.length,
          storagePath,
          createdById: user.id,
        },
        select: {
          id: true,
          invoiceNumber: true,
          category: true,
          originalName: true,
          mimeType: true,
          size: true,
          createdAt: true,
        },
      });
    } catch (error) {
      await rm(absolutePath, { force: true });
      throw error;
    }
  }
  async getInvoiceAttachmentFile(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user);
    const attachment = await this.prisma.rahcomInvoiceAttachment.findFirst({
      where: { id, organizationId: access.organizationId },
      select: { province: true, originalName: true, mimeType: true, content: true, storagePath: true },
    });
    if (!attachment) throw new NotFoundException('Invoice attachment not found.');
    const province = this.scopedProvince(access, attachment.province);
    if (!province) throw new NotFoundException('Invoice attachment not found.');
    if (attachment.storagePath) {
      try {
        return { ...attachment, content: await readFile(this.invoiceAttachmentAbsolutePath(attachment.storagePath)) };
      } catch {
        throw new NotFoundException('Invoice attachment file is missing from Rahyar Storage.');
      }
    }
    if (attachment.content) {
      return { ...attachment, content: Buffer.from(attachment.content) };
    }
    throw new NotFoundException('Invoice attachment file is missing from Rahyar Storage.');
  }
  private invoiceAttachmentAbsolutePath(storagePath: string): string {
    const root = path.resolve(
      process.env.RAHYAR_STORAGE_ROOT || path.resolve(process.cwd(), '..', 'Rahyar Storage'),
    );
    const absolutePath = path.resolve(root, ...storagePath.split(/[\\/]/));
    const relative = path.relative(root, absolutePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BadRequestException('Invalid invoice attachment storage path.');
    }
    return absolutePath;
  }
  private invoiceAttachmentProvinceCode(province: string): string {
    const codes: Record<string, string> = {
      isfahan: 'ESF', tehran: 'THR', 'east-azerbaijan': 'AZE', 'west-azerbaijan': 'AZW',
      ardabil: 'ARD', alborz: 'ALB', ilam: 'ILA', bushehr: 'BUS',
      'charmahal-bakhtiari': 'CHB', 'south-khorasan': 'KHS', 'razavi-khorasan': 'KHR',
      'north-khorasan': 'KHN', khuzestan: 'KHZ', zanjan: 'ZAN', semnan: 'SEM',
      'sistan-baluchestan': 'SIB', fars: 'FAR', qazvin: 'QAZ', qom: 'QOM', kurdistan: 'KOR',
      kerman: 'KER', kermanshah: 'KSH', 'kohgiluyeh-boyerahmad': 'KOB', golestan: 'GOL',
      gilan: 'GIL', lorestan: 'LOR', mazandaran: 'MAZ', markazi: 'MRK', hormozgan: 'HOR',
      hamadan: 'HAM', yazd: 'YAZ',
    };
    return codes[province] || province.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  }
  private invoiceAttachmentCategoryFolder(category: string): string {
    const folders: Record<string, string> = {
      INVOICE: 'Invoices', PAYMENT_RECEIPT: 'Payment Receipts',
      START_PHOTO: 'Work Start', END_PHOTO: 'Work End', OTHER: 'Other',
    };
    return folders[category] || 'Other';
  }
  private invoiceAttachmentImageType(buffer: Buffer, mimeType: string): string {
    if (
      mimeType === 'image/png' &&
      buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ) return 'image/png';
    if (
      mimeType === 'image/jpeg' &&
      buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    ) return 'image/jpeg';
    if (
      mimeType === 'image/webp' &&
      buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP'
    ) return 'image/webp';
    throw new BadRequestException('Only valid PNG, JPEG, or WebP images can be attached.');
  }
  async replaceBillIdentifiers(
    user: AuthenticatedUser,
    body: ReplaceRahcomBillIdentifierListDto,
  ) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province)
      throw new BadRequestException(
        'Select a single province to save bill identifiers.',
      );
    if (
      body.rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length > body.headers.length ||
          row.some(
            (value) => typeof value !== 'string' || value.length > 10000,
          ),
      )
    ) {
      throw new BadRequestException(
        'Bill identifier rows must contain text values within the column count.',
      );
    }
    const normalizedWorkbook = normalizeBillIdentifierWorkbook(
      province,
      body.headers.map((header) => header.trim()),
      body.rows,
    );
    const rows = normalizedWorkbook.rows;
    const headers = normalizedWorkbook.headers;
    if (headers.length > 100 || headers.some((header) => !header || header.length > 120))
      throw new BadRequestException('Bill identifier headers are invalid.');
    const normalizedHeaders = headers.map(normalizeBillHeader);
    if (new Set(normalizedHeaders).size !== normalizedHeaders.length)
      throw new BadRequestException('Bill identifier headers must be unique.');
    const systemCodeColumn = normalizedHeaders.findIndex((header) => ['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f\u0633\u06cc\u0633\u062a\u0645'].includes(header));
    if (
      systemCodeColumn >= 0 &&
      rows.some((row) =>
        hasMixedBillSystemFamilies(row[systemCodeColumn] ?? ''),
      )
    )
      throw new BadRequestException(
        'A bill can only be assigned to one system family.',
      );
    const billIdentifierColumn = normalizedHeaders.findIndex((header) => ['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642'].includes(header));
    if (billIdentifierColumn < 0)
      throw new BadRequestException('A bill identifier column is required.');
    const seenBillIdentifiers = new Set<string>();
    for (const row of rows) {
      const billIdentifier = normalizeBillIdentifier(
        row[billIdentifierColumn] ?? '',
      );
      if (!billIdentifier) continue;
      if (seenBillIdentifiers.has(billIdentifier))
        throw new ConflictException('Bill identifiers must be unique.');
      seenBillIdentifiers.add(billIdentifier);
    }
    const linkedBillBySystem = new Map<string, string>();
    const relatedSystemCodes = new Set<string>();
    if (systemCodeColumn >= 0) {
      for (const row of rows) {
        const billId = normalizeBillIdentifier(row[billIdentifierColumn] ?? '');
        for (const code of (row[systemCodeColumn] ?? '').split(/[;,|]/).map((item) => item.trim()).filter(Boolean)) {
          if (/^EXTERNAL:/i.test(code)) continue;
          const normalizedCode = code.toUpperCase();
          relatedSystemCodes.add(normalizedCode);
          if (billId && !linkedBillBySystem.has(normalizedCode)) linkedBillBySystem.set(normalizedCode, row[billIdentifierColumn]!.trim());
        }
      }
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const previous = await tx.rahcomBillIdentifierList.findUnique({
        where: { organizationId_province: { organizationId: access.organizationId, province } },
        select: { headers: true, rows: true },
      });
      if (previous) {
        const previousHeaders = jsonArray(previous.headers).map(cellText).map(normalizeBillHeader);
        const currentSystemHeader = systemCodeColumn >= 0 ? normalizeBillHeader(headers[systemCodeColumn]) : '';
        const previousSystemIndex = previousHeaders.findIndex((header) => header === currentSystemHeader);
        if (previousSystemIndex >= 0) {
          for (const row of jsonRows(previous.rows)) {
            for (const code of cellText(row[previousSystemIndex]).split(/[;,|]/).map((item) => item.trim()).filter(Boolean)) {
              if (!/^EXTERNAL:/i.test(code)) relatedSystemCodes.add(code.toUpperCase());
            }
          }
        }
      }
      const saved = await tx.rahcomBillIdentifierList.upsert({
        where: { organizationId_province: { organizationId: access.organizationId, province } },
        create: { organizationId: access.organizationId, province, headers, rows, updatedById: user.id },
        update: { headers, rows, updatedById: user.id },
        select: { headers: true, rows: true, updatedAt: true },
      });
      for (const systemCode of relatedSystemCodes) {
        await tx.rahcomSystem.updateMany({
          where: { organizationId: access.organizationId, province, systemCode: { equals: systemCode, mode: 'insensitive' } },
          data: { electricityBillId: linkedBillBySystem.get(systemCode) ?? null },
        });
      }
      return saved;
    });
    return { ...updated, saved: true };
  }
  async listImportedTickets(
    user: AuthenticatedUser,
    requestedProvince?: string,
    requestedDate?: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const listDate = requestedDate ? this.validDate(requestedDate) : undefined;
    let legacyCodes: string[] = [];
    if (province) {
      const legacyCodeGroups = await this.prisma.rahcomImportedTicket.groupBy({
        by: ['systemCode'],
        where: {
          organizationId: access.organizationId,
          province: null,
          ...(listDate ? { listDate } : {}),
          ...(access.demoOnly
            ? { systemCode: { startsWith: this.demoSystemPrefix } }
            : {}),
        },
      });
      const candidateCodes = [
        ...new Set(legacyCodeGroups.map(({ systemCode }) => systemCode)),
      ];
      const matchingSystems = candidateCodes.length
        ? await this.prisma.rahcomSystem.findMany({
            where: {
              organizationId: access.organizationId,
              systemCode: { in: candidateCodes },
            },
            select: { systemCode: true, province: true },
          })
        : [];
      const provincesByCode = new Map<string, Set<string>>();
      for (const system of matchingSystems) {
        const provinces =
          provincesByCode.get(system.systemCode) ?? new Set<string>();
        provinces.add(system.province);
        provincesByCode.set(system.systemCode, provinces);
      }
      legacyCodes = candidateCodes.filter(
        (code) =>
          provincesByCode.get(code)?.size === 1 &&
          provincesByCode.get(code)?.has(province),
      );
    }
    const tickets = await this.prisma.rahcomImportedTicket.findMany({
      where: {
        organizationId: access.organizationId,
        ...(listDate ? { listDate } : {}),
        ...(access.demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
        ...(province
          ? {
              OR: [
                { province },
                ...(legacyCodes.length
                  ? [{ province: null, systemCode: { in: legacyCodes } }]
                  : []),
              ],
            }
          : {}),
      },
      orderBy: [{ importedAt: 'desc' }, { ticketCode: 'asc' }],
    });
    const ticketCodes = [
      ...new Set(
        tickets.map(({ systemCode }) => systemCode.trim()).filter(Boolean),
      ),
    ];
    const relatedSystems = ticketCodes.length
      ? await this.prisma.rahcomSystem.findMany({
          where: {
            organizationId: access.organizationId,
            systemCode: {
              in: ticketCodes,
              mode: 'insensitive',
              ...(access.demoOnly ? { startsWith: this.demoSystemPrefix } : {}),
            },
            ...(province ? { province } : {}),
          },
        })
      : [];
    const systemsByCode = new Map<string, typeof relatedSystems>();
    for (const system of relatedSystems) {
      const key = system.systemCode.trim().toUpperCase();
      systemsByCode.set(key, [...(systemsByCode.get(key) ?? []), system]);
    }
    return tickets.map((ticket) => {
      const candidates =
        systemsByCode.get(ticket.systemCode.trim().toUpperCase()) ?? [];
      const targetProvince = ticket.province ?? province;
      const system = targetProvince
        ? candidates.find((candidate) => candidate.province === targetProvince)
        : candidates.length === 1
          ? candidates[0]
          : null;
      return { ...ticket, system: system ?? null };
    });
  }
  async listImportedTicketDates(
    user: AuthenticatedUser,
    requestedProvince: string | undefined,
    fromValue: string,
    toValue: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const from = this.validDate(fromValue);
    const to = this.validDate(toValue);
    if (from > to) throw new BadRequestException('The date range is invalid.');
    if (to.getTime() - from.getTime() > 62 * 86_400_000)
      throw new BadRequestException(
        'Choose a date range of no more than 62 days.',
      );
    const where = {
      organizationId: access.organizationId,
      listDate: { gte: from, lte: to },
      ...(access.demoOnly
        ? { systemCode: { startsWith: this.demoSystemPrefix } }
        : {}),
    };
    if (!province) {
      const dates = await this.prisma.rahcomImportedTicket.groupBy({
        by: ['listDate'],
        where,
        orderBy: { listDate: 'asc' },
      });
      return dates.map(({ listDate }) => listDate.toISOString().slice(0, 10));
    }

    const [directDates, legacyTickets] = await Promise.all([
      this.prisma.rahcomImportedTicket.groupBy({
        by: ['listDate'],
        where: { ...where, province },
        orderBy: { listDate: 'asc' },
      }),
      this.prisma.rahcomImportedTicket.groupBy({
        by: ['listDate', 'systemCode'],
        where: { ...where, province: null },
      }),
    ]);
    const legacyCodes = [
      ...new Set(
        legacyTickets
          .map(({ systemCode }) => systemCode.trim())
          .filter(Boolean),
      ),
    ];
    const legacySystems = legacyCodes.length
      ? await this.prisma.rahcomSystem.findMany({
          where: {
            organizationId: access.organizationId,
            systemCode: {
              in: legacyCodes,
              ...(access.demoOnly ? { startsWith: this.demoSystemPrefix } : {}),
            },
          },
          select: { systemCode: true, province: true },
        })
      : [];
    const provincesByCode = new Map<string, Set<string>>();
    for (const system of legacySystems) {
      const code = system.systemCode;
      const provinces = provincesByCode.get(code) ?? new Set<string>();
      provinces.add(system.province);
      provincesByCode.set(code, provinces);
    }
    const dateKeys = new Set(
      directDates.map(({ listDate }) => listDate.toISOString().slice(0, 10)),
    );
    for (const ticket of legacyTickets) {
      const matchingProvinces = provincesByCode.get(ticket.systemCode.trim());
      if (matchingProvinces?.size === 1 && matchingProvinces.has(province))
        dateKeys.add(ticket.listDate.toISOString().slice(0, 10));
    }
    return [...dateKeys].sort();
  }
  async updateImportedTicketDescription(
    user: AuthenticatedUser,
    id: string,
    description: string,
  ) {
    const access = await this.authorize(user, true);
    const ticket = await this.prisma.rahcomImportedTicket.findFirst({
      where: { id, organizationId: access.organizationId },
      select: { id: true, systemCode: true, province: true },
    });
    if (!ticket) throw new NotFoundException('Ticket was not found.');
    if (!access.isAdmin) {
      const province = this.scopedProvince(access, ticket.province);
      if (!province) throw new NotFoundException('Ticket was not found.');
      if (ticket.province !== province) {
        const systemCode = String(ticket.systemCode ?? '').trim();
        const matchingSystem = systemCode
          ? await this.prisma.rahcomSystem.findFirst({
              where: {
                organizationId: access.organizationId,
                province,
                systemCode: { equals: systemCode, mode: 'insensitive' },
              },
              select: { id: true },
            })
          : null;
        if (!matchingSystem)
          throw new NotFoundException('Ticket was not found.');
      }
    }
    return this.prisma.rahcomImportedTicket.update({
      where: { id: ticket.id },
      data: { description: description.trim() },
    });
  }
  async importTickets(user: AuthenticatedUser, body: ImportRahcomTicketsDto) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province)
      throw new BadRequestException(
        'Select one province before importing tickets.',
      );
    const listDate = this.validDate(body.listDate);
    const sourceFileName = body.sourceFileName.trim();
    const requestedCodes = [
      ...new Set(
        body.tickets
          .map((row) => row.systemCode?.trim().toUpperCase())
          .filter((code): code is string => Boolean(code)),
      ),
    ];
    const systems = requestedCodes.length
      ? await this.prisma.rahcomSystem.findMany({
          where: {
            organizationId: access.organizationId,
            systemCode: { in: requestedCodes, mode: 'insensitive' },
          },
          select: { systemCode: true, province: true },
        })
      : [];
    const provincesByCode = new Map<string, Set<string>>();
    for (const system of systems) {
      const provinces =
        provincesByCode.get(system.systemCode.toUpperCase()) ??
        new Set<string>();
      provinces.add(system.province);
      provincesByCode.set(system.systemCode.toUpperCase(), provinces);
    }
    for (const row of body.tickets) {
      const requestedProvince = province;
      if (requestedProvince && !isRahcomProvinceId(requestedProvince))
        throw new BadRequestException(
          'Choose a supported province for each imported ticket.',
        );
      if (
        (!access.isAdmin || access.demoOnly) &&
        requestedProvince &&
        requestedProvince !== access.province
      ) {
        throw new ForbiddenException(
          'You can only import tickets for your assigned province.',
        );
      }
      const systemCode = row.systemCode?.trim().toUpperCase() ?? '';
      const knownProvinces = provincesByCode.get(systemCode);
      if (
        knownProvinces?.size &&
        requestedProvince &&
        !knownProvinces.has(requestedProvince)
      ) {
        throw new BadRequestException(
          `Ticket ${row.ticketCode} province does not match its system.`,
        );
      }
      if (knownProvinces && knownProvinces.size > 1 && !requestedProvince) {
        throw new BadRequestException(
          `Choose a province for ticket ${row.ticketCode}; its system code is used in multiple provinces.`,
        );
      }
      if (
        (!access.isAdmin || access.demoOnly) &&
        knownProvinces?.size &&
        !knownProvinces.has(access.province ?? '')
      ) {
        throw new ForbiddenException(
          `Ticket ${row.ticketCode} belongs to a different province.`,
        );
      }
    }
    const savedDescriptions = await this.prisma.rahcomImportedTicket.findMany({
      where: { organizationId: access.organizationId, province, listDate },
      select: { ticketCode: true, description: true },
    });
    const descriptionsByTicket = new Map(
      savedDescriptions.map(({ ticketCode, description }) => [
        ticketCode,
        description,
      ]),
    );
    const rows = body.tickets.map((row) => ({
      organizationId: access.organizationId,
      ticketCode: row.ticketCode.trim(),
      systemCode: row.systemCode?.trim().toUpperCase() ?? '',
      province,
      listDate,
      summary: row.summary?.trim() ?? '',
      description:
        row.description?.trim() ||
        descriptionsByTicket.get(row.ticketCode.trim()) ||
        '',
      customer: row.customer?.trim() ?? '',
      equipment: row.equipment?.trim() ?? '',
      type: row.type?.trim() ?? '',
      status: row.status?.trim() ?? '',
      priority: row.priority?.trim() ?? '',
      supportTeam: row.supportTeam?.trim() ?? '',
      createdOn: row.createdOn?.trim() ?? '',
      sourceFileName,
      importedAt: new Date(),
    }));
    if (rows.some(({ province }) => province && !isRahcomProvinceId(province)))
      throw new BadRequestException(
        'Choose a supported province for each imported ticket.',
      );
    if (new Set(rows.map(({ ticketCode }) => ticketCode)).size !== rows.length)
      throw new BadRequestException(
        'Ticket codes must be unique within an import.',
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.rahcomImportedTicket.deleteMany({
        where: { organizationId: access.organizationId, province, listDate },
      });
      if (rows.length) await tx.rahcomImportedTicket.createMany({ data: rows });
    });
    return { imported: rows.length };
  }
  async getRoadList(
    user: AuthenticatedUser,
    requestedProvince?: string,
    requestedDate?: string,
  ) {
    const access = await this.authorize(user);
    if (access.demoOnly) return null;
    const province = this.scopedProvince(access, requestedProvince);
    if (!province)
      throw new BadRequestException(
        'Select one province to view its road list.',
      );
    const listDate = requestedDate
      ? this.validDate(requestedDate)
      : this.validDate(new Date().toISOString().slice(0, 10));
    return this.prisma.rahcomRoadList.findUnique({
      where: {
        organizationId_province_listDate: {
          organizationId: access.organizationId,
          province,
          listDate,
        },
      },
    });
  }
  async listRoadListDates(
    user: AuthenticatedUser,
    requestedProvince: string | undefined,
    fromValue: string,
    toValue: string,
  ) {
    const access = await this.authorize(user);
    if (access.demoOnly) return [];
    const province = this.scopedProvince(access, requestedProvince);
    if (!province)
      throw new BadRequestException(
        'Select one province to view road-list dates.',
      );
    const from = this.validDate(fromValue);
    const to = this.validDate(toValue);
    if (from > to) throw new BadRequestException('The date range is invalid.');
    const snapshots = await this.prisma.rahcomRoadList.findMany({
      where: {
        organizationId: access.organizationId,
        province,
        listDate: { gte: from, lte: to },
      },
      orderBy: { listDate: 'asc' },
      select: { listDate: true },
    });
    return [
      ...new Set(
        snapshots.map(({ listDate }) => listDate.toISOString().slice(0, 10)),
      ),
    ];
  }
  async replaceRoadList(
    user: AuthenticatedUser,
    body: ReplaceRahcomRoadListDto,
  ) {
    const access = await this.authorize(user, true);
    if (access.demoOnly)
      throw new ForbiddenException('Demo accounts cannot upload road lists.');
    const province = this.scopedProvince(access, body.province);
    if (!province)
      throw new BadRequestException(
        'Select one province to upload its road list.',
      );
    const listDate = this.validDate(body.listDate);

    const headers = body.headers.map((header) => String(header ?? '').trim());
    const normalizeHeader = (value: string) =>
      value
        .normalize('NFKC')
        .toLocaleLowerCase('fa')
        .replace(/[\u064a\u0649]/g, '\u06cc')
        .replace(/\u0643/g, '\u06a9')
        .replace(/[\u200c\s_\-./()]/g, '');
    const provinceColumn = headers.findIndex((header) => {
      const normalized = normalizeHeader(header);
      return (
        normalized.includes('\u0627\u0633\u062a\u0627\u0646') ||
        normalized === 'province'
      );
    });
    if (provinceColumn < 0)
      throw new BadRequestException(
        'The workbook must include a province column.',
      );
    if (headers.some((header) => !header || header.length > 120))
      throw new BadRequestException(
        'Column names must be between 1 and 120 characters.',
      );

    let totalCharacters = headers.reduce(
      (sum, header) => sum + header.length,
      0,
    );
    const rows = body.rows.map((row, index) => {
      if (!Array.isArray(row) || row.length !== headers.length)
        throw new BadRequestException(
          `Row ${index + 1} does not match the workbook columns.`,
        );
      const values = row.map((cell) => String(cell ?? '').trim());
      if (values.some((cell) => cell.length > 5000))
        throw new BadRequestException(
          `A value in row ${index + 1} is too long.`,
        );
      totalCharacters += values.reduce((sum, cell) => sum + cell.length, 0);
      const provinceValue = values[provinceColumn];
      const rowProvince = isRahcomProvinceId(provinceValue)
        ? provinceValue
        : rahcomProvinceIdFromLabel(provinceValue);
      if (!rowProvince)
        throw new BadRequestException(
          `Province is missing or unsupported in row ${index + 1}.`,
        );
      if (rowProvince !== province)
        throw new ForbiddenException(
          `Row ${index + 1} belongs to a different province.`,
        );
      return values;
    });
    if (totalCharacters > 5_000_000)
      throw new BadRequestException('The workbook data is too large to save.');

    const now = new Date();
    return this.prisma.rahcomRoadList.upsert({
      where: {
        organizationId_province_listDate: {
          organizationId: access.organizationId,
          province,
          listDate,
        },
      },
      create: {
        organizationId: access.organizationId,
        createdById: user.id,
        province,
        listDate,
        fileName: body.fileName.trim(),
        sheetName: body.sheetName.trim(),
        headers,
        rows,
        rowCount: rows.length,
        importedAt: now,
      },
      update: {
        createdById: user.id,
        fileName: body.fileName.trim(),
        sheetName: body.sheetName.trim(),
        headers,
        rows,
        rowCount: rows.length,
        importedAt: now,
      },
    });
  }
  async listProvinceAssignments(user: AuthenticatedUser) {
    const access = await this.authorize(user);
    if (!access.isAdmin || access.demoOnly)
      throw new ForbiddenException(
        'Only organization administrators can manage Rahcom province assignments.',
      );
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: access.organizationId, status: 'ACTIVE' },
      select: {
        id: true,
        rahcomProvince: true,
        user: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
      orderBy: [{ user: { lastName: 'asc' } }, { user: { firstName: 'asc' } }],
    });
    return members.map(({ id, rahcomProvince, user: member }) => ({
      id,
      userId: member.id,
      username: member.username,
      name: `${member.firstName} ${member.lastName}`.trim(),
      province: rahcomProvince,
    }));
  }
  async updateProvinceAssignment(
    user: AuthenticatedUser,
    memberId: string,
    province: string | null,
  ) {
    const access = await this.authorize(user, true);
    if (!access.isAdmin || access.demoOnly)
      throw new ForbiddenException(
        'Only organization administrators can manage Rahcom province assignments.',
      );
    const normalized = String(province ?? '').trim() || null;
    if (normalized && !isRahcomProvinceId(normalized))
      throw new BadRequestException('Choose a supported province.');
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        id: memberId,
        organizationId: access.organizationId,
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    if (!member)
      throw new NotFoundException('Active organization member not found.');
    const updated = await this.prisma.organizationMember.updateMany({
      where: {
        id: member.id,
        organizationId: access.organizationId,
        status: 'ACTIVE',
      },
      data: { rahcomProvince: normalized },
    });
    if (!updated.count)
      throw new ConflictException(
        'The active organization membership changed. Refresh and try again.',
      );
    return { id: member.id, rahcomProvince: normalized };
  }
  async listSolarSnapshots(
    user: AuthenticatedUser,
    requestedProvince?: string,
    requestedDate?: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const capturedAt = requestedDate
      ? this.tehranDateRange(requestedDate)
      : undefined;
    return this.prisma.rahcomSolarSnapshot.findMany({
      where: {
        organizationId: access.organizationId,
        ...(province ? { province } : {}),
        ...(capturedAt ? { capturedAt } : {}),
        ...(access.demoOnly ? { createdById: user.id } : {}),
      },
      orderBy: { capturedAt: 'desc' },
      take: 100,
    });
  }
  async listSolarSnapshotDates(
    user: AuthenticatedUser,
    requestedProvince: string | undefined,
    fromValue: string,
    toValue: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const from = this.tehranDateRange(fromValue).gte;
    const to = this.tehranDateRange(toValue).lt;
    if (from > to || to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Choose a valid date range of no more than 62 days.',
      );
    }
    const provinceFilter = province
      ? Prisma.sql`AND province = ${province}`
      : Prisma.empty;
    const creatorFilter = access.demoOnly
      ? Prisma.sql`AND "createdById" = ${user.id}`
      : Prisma.empty;
    const rows = await this.prisma.$queryRaw<
      Array<{ dateKey: string }>
    >(Prisma.sql`
      SELECT to_char(("capturedAt" AT TIME ZONE 'Asia/Tehran')::date, 'YYYY-MM-DD') AS "dateKey"
      FROM "rahcom_solar_snapshots"
      WHERE "organizationId" = ${access.organizationId}
        AND "capturedAt" >= ${from}
        AND "capturedAt" < ${to}
        ${provinceFilter}
        ${creatorFilter}
      GROUP BY 1
      ORDER BY 1
    `);
    return rows.map(({ dateKey }) => dateKey);
  }
  async createSolarSnapshot(
    user: AuthenticatedUser,
    body: CreateRahcomSolarSnapshotDto,
  ) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province || !isRahcomProvinceId(province))
      throw new BadRequestException(
        'Choose one supported province before saving a solar status snapshot.',
      );
    const text = `${body.downText}\n${body.unreachableText}`;
    const codes = [
      ...new Set(
        Array.from(text.matchAll(/\d{3}[A-Z]\d{5}/gi), ([code]) =>
          code.toUpperCase(),
        ),
      ),
    ];
    const systems = codes.length
      ? await this.prisma.rahcomSystem.findMany({
          where: {
            organizationId: access.organizationId,
            systemCode: { in: codes, mode: 'insensitive' },
          },
          select: { systemCode: true, province: true },
        })
      : [];
    const knownCodes = new Set(
      systems.map((system) => system.systemCode.toUpperCase()),
    );
    const provinceCodes = new Set(
      systems
        .filter((system) => system.province === province)
        .map((system) => system.systemCode.toUpperCase()),
    );
    if (
      codes.some((code) => knownCodes.has(code) && !provinceCodes.has(code)) ||
      (province !== 'isfahan' &&
        /Rahcom\s*\([^)]*(?:-ESF(?:-|\))|ISFAHAN)/i.test(text))
    ) {
      throw new BadRequestException(
        'The solar report contains systems from another province. Split the report by province before saving.',
      );
    }
    const capturedAt = body.capturedAt ? new Date(body.capturedAt) : new Date();
    if (Number.isNaN(capturedAt.getTime()))
      throw new BadRequestException('Invalid snapshot date and time.');
    return this.prisma.rahcomSolarSnapshot.create({
      data: {
        organizationId: access.organizationId,
        createdById: user.id,
        province,
        capturedAt,
        downText: body.downText,
        unreachableText: body.unreachableText,
        equipmentColumns: [
          ...new Set(
            body.equipmentColumns.map((item) => item.trim()).filter(Boolean),
          ),
        ],
      },
    });
  }
  async updateSolarSnapshot(
    user: AuthenticatedUser,
    id: string,
    body: CreateRahcomSolarSnapshotDto,
  ) {
    const access = await this.authorize(user, true);
    const existing = await this.prisma.rahcomSolarSnapshot.findFirst({
      where: { id, organizationId: access.organizationId },
    });
    if (!existing) throw new NotFoundException('Solar status was not found.');
    this.scopedProvince(access, existing.province);
    const province = this.scopedProvince(access, body.province);
    if (province !== existing.province)
      throw new BadRequestException(
        'A saved solar status cannot be moved to another province.',
      );
    const capturedAt = body.capturedAt
      ? new Date(body.capturedAt)
      : existing.capturedAt;
    if (Number.isNaN(capturedAt.getTime()))
      throw new BadRequestException('Invalid snapshot date and time.');
    const text = `${body.downText}\n${body.unreachableText}`;
    const codes = [
      ...new Set(
        Array.from(text.matchAll(/\d{3}[A-Z]\d{5}/gi), ([code]) =>
          code.toUpperCase(),
        ),
      ),
    ];
    if (codes.length) {
      const systems = await this.prisma.rahcomSystem.findMany({
        where: {
          organizationId: access.organizationId,
          systemCode: { in: codes, mode: 'insensitive' },
        },
        select: { systemCode: true, province: true },
      });
      const knownCodes = new Set(
        systems.map((system) => system.systemCode.toUpperCase()),
      );
      const provinceCodes = new Set(
        systems
          .filter((system) => system.province === existing.province)
          .map((system) => system.systemCode.toUpperCase()),
      );
      if (
        codes.some(
          (code) => knownCodes.has(code) && !provinceCodes.has(code),
        ) ||
        (existing.province !== 'isfahan' &&
          /Rahcom\s*\([^)]*(?:-ESF(?:-|\))|ISFAHAN)/i.test(text))
      ) {
        throw new BadRequestException(
          'The solar report contains systems from another province. Split the report by province before saving.',
        );
      }
    }
    return this.prisma.rahcomSolarSnapshot.update({
      where: { id: existing.id },
      data: {
        capturedAt,
        downText: body.downText,
        unreachableText: body.unreachableText,
        equipmentColumns: [
          ...new Set(
            body.equipmentColumns.map((item) => item.trim()).filter(Boolean),
          ),
        ],
      },
    });
  }
  async deleteSolarSnapshot(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, true);
    const existing = await this.prisma.rahcomSolarSnapshot.findFirst({
      where: { id, organizationId: access.organizationId },
    });
    if (!existing) throw new NotFoundException('Solar status was not found.');
    this.scopedProvince(access, existing.province);
    await this.prisma.rahcomSolarSnapshot.delete({
      where: { id: existing.id },
    });
    return { deleted: true };
  }
  async listSolarSpecialSystems(
    user: AuthenticatedUser,
    requestedProvince?: string,
  ) {
    const access = await this.authorize(user);
    const province = this.scopedProvince(access, requestedProvince);
    const demoCodes = access.demoOnly
      ? (
          await this.prisma.rahcomSystem.findMany({
            where: {
              organizationId: access.organizationId,
              province: 'isfahan',
              systemCode: { startsWith: this.demoSystemPrefix },
            },
            select: { systemCode: true },
          })
        ).map(({ systemCode }) => systemCode)
      : null;
    return this.prisma.rahcomSolarSpecialSystem.findMany({
      where: {
        organizationId: access.organizationId,
        ...(province ? { province } : {}),
        ...(demoCodes ? { systemCode: { in: demoCodes } } : {}),
      },
      orderBy: [{ province: 'asc' }, { systemCode: 'asc' }],
    });
  }
  async replaceSolarSpecialSystems(
    user: AuthenticatedUser,
    body: ReplaceRahcomSolarSpecialSystemsDto,
  ) {
    const access = await this.authorize(user, true);
    const province = this.scopedProvince(access, body.province);
    if (!province || !isRahcomProvinceId(province))
      throw new BadRequestException(
        'Choose a supported province for the special system list.',
      );
    const systems = [
      ...new Map(
        body.systems.map((item) => [
          item.systemCode.trim().toUpperCase(),
          item.category,
        ]),
      ).entries(),
    ];
    const codes = systems.map(([systemCode]) => systemCode);
    if (codes.length) {
      const knownSystems = await this.prisma.rahcomSystem.findMany({
        where: {
          organizationId: access.organizationId,
          systemCode: { in: codes, mode: 'insensitive' },
        },
        select: { systemCode: true, province: true },
      });
      const knownCodes = new Set(
        knownSystems.map(({ systemCode }) => systemCode.toUpperCase()),
      );
      const provinceCodes = new Set(
        knownSystems
          .filter((system) => system.province === province)
          .map(({ systemCode }) => systemCode.toUpperCase()),
      );
      if (
        codes.some((code) => knownCodes.has(code) && !provinceCodes.has(code))
      ) {
        throw new BadRequestException(
          'The special system list contains a code assigned to another province.',
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.rahcomSolarSpecialSystem.deleteMany({
        where: { organizationId: access.organizationId, province },
      });
      if (systems.length)
        await tx.rahcomSolarSpecialSystem.createMany({
          data: systems.map(([systemCode, category]) => ({
            organizationId: access.organizationId,
            province,
            systemCode,
            category,
          })),
        });
    });
    return this.prisma.rahcomSolarSpecialSystem.findMany({
      where: { organizationId: access.organizationId, province },
      orderBy: { systemCode: 'asc' },
    });
  }
  async listTrafficSnapshot(
    user: AuthenticatedUser,
    requestedProvince?: string,
    requestedDate?: string,
  ) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const snapshotDate = requestedDate
      ? this.validDate(requestedDate)
      : this.validDate(new Date().toISOString().slice(0, 10));
    const snapshot = await this.prisma.rahcomTrafficSnapshot.findFirst({
      where: {
        organizationId,
        snapshotDate,
        ...(demoOnly ? { createdById: user.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    const province = this.scopedProvince(access, requestedProvince);
    if (!snapshot || !province) return snapshot;
    const headers = Array.isArray(snapshot.headers)
      ? snapshot.headers.map(String)
      : [];
    const normalizeHeader = (value: string) =>
      value.replace(/[\s\u200c_./-]/g, '').toLocaleLowerCase();
    const normalizedHeaders = headers.map(normalizeHeader);
    const provinceIndex = normalizedHeaders.findIndex(
      (header) =>
        header.includes('province') ||
        header.includes('\u0627\u0633\u062a\u0627\u0646'),
    );
    const codeIndex = normalizedHeaders.findIndex(
      (header) =>
        header.includes('systemcode') ||
        header.includes('\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647'),
    );
    const systems =
      codeIndex >= 0
        ? await this.prisma.rahcomSystem.findMany({
            where: {
              organizationId,
              province,
              ...(demoOnly
                ? { systemCode: { startsWith: this.demoSystemPrefix } }
                : {}),
            },
            select: { systemCode: true },
          })
        : [];
    const candidateCodes = [
      ...new Set(
        systems.map(({ systemCode }) => systemCode.trim().toLocaleUpperCase()),
      ),
    ];
    const allSystems = candidateCodes.length
      ? await this.prisma.rahcomSystem.findMany({
          where: { organizationId, systemCode: { in: candidateCodes } },
          select: { systemCode: true, province: true },
        })
      : [];
    const provincesByCode = new Map<string, Set<string>>();
    for (const system of allSystems) {
      const code = system.systemCode.trim().toLocaleUpperCase();
      const provinces = provincesByCode.get(code) ?? new Set<string>();
      provinces.add(system.province);
      provincesByCode.set(code, provinces);
    }
    const allowedCodes = new Set(
      candidateCodes.filter((code) => provincesByCode.get(code)?.size === 1),
    );
    const rows = Array.isArray(snapshot.rows)
      ? (snapshot.rows as unknown[]).filter((candidate) => {
          if (!Array.isArray(candidate)) return false;
          const row = candidate.map((cell) => String(cell ?? ''));
          const rawProvince =
            provinceIndex >= 0 ? (row[provinceIndex] ?? '').trim() : '';
          if (rawProvince)
            return rahcomProvinceIdFromLabel(rawProvince) === province;
          return (
            codeIndex >= 0 &&
            allowedCodes.has((row[codeIndex] ?? '').trim().toLocaleUpperCase())
          );
        })
      : [];
    return { ...snapshot, rows, rowCount: rows.length };
  }

  async listTrafficSnapshotDates(
    user: AuthenticatedUser,
    requestedProvince: string | undefined,
    fromValue: string,
    toValue: string,
  ) {
    const access = await this.authorize(user);
    this.scopedProvince(access, requestedProvince);
    const from = this.validDate(fromValue);
    const to = this.validDate(toValue);
    if (from > to || to.getTime() - from.getTime() > 40 * 24 * 60 * 60 * 1000) {
      throw new BadRequestException(
        'Choose a valid date range of no more than 41 days.',
      );
    }
    const snapshots = await this.prisma.rahcomTrafficSnapshot.findMany({
      where: {
        organizationId: access.organizationId,
        snapshotDate: { gte: from, lte: to },
        ...(access.demoOnly ? { createdById: user.id } : {}),
      },
      orderBy: [{ snapshotDate: 'asc' }, { createdAt: 'desc' }],
      select: { snapshotDate: true },
    });
    return [
      ...new Set(
        snapshots.map(({ snapshotDate }) =>
          snapshotDate.toISOString().slice(0, 10),
        ),
      ),
    ];
  }

  async listTrafficSystemHistory(
    user: AuthenticatedUser,
    requestedCode: string,
    requestedDate?: string,
  ) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const systemCode = String(requestedCode ?? '')
      .trim()
      .toUpperCase();
    if (!systemCode || systemCode.length > 100)
      throw new BadRequestException('Provide a valid system code.');
    const province = this.scopedProvince(access);
    let codeBelongsOnlyToRequestedProvince = false;
    if (province) {
      const systems = await this.prisma.rahcomSystem.findMany({
        where: {
          organizationId,
          systemCode,
          province,
          ...(demoOnly
            ? {
                systemCode: {
                  startsWith: this.demoSystemPrefix,
                  equals: systemCode,
                },
              }
            : {}),
        },
        select: { id: true },
      });
      if (!systems.length)
        throw new NotFoundException(
          'System not found in the selected province.',
        );
      const allMatchingSystems = await this.prisma.rahcomSystem.findMany({
        where: {
          organizationId,
          systemCode,
          ...(demoOnly
            ? {
                systemCode: {
                  startsWith: this.demoSystemPrefix,
                  equals: systemCode,
                },
              }
            : {}),
        },
        select: { province: true },
      });
      codeBelongsOnlyToRequestedProvince =
        new Set(
          allMatchingSystems.map(({ province: itemProvince }) => itemProvince),
        ).size === 1;
    }
    const snapshots = await this.prisma.rahcomTrafficSnapshot.findMany({
      where: {
        organizationId,
        ...(requestedDate
          ? { snapshotDate: this.validDate(requestedDate) }
          : {}),
        ...(demoOnly ? { createdById: user.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        fileName: true,
        sheetName: true,
        headers: true,
        rows: true,
        rowCount: true,
        createdAt: true,
      },
    });
    return snapshots.flatMap((snapshot) => {
      const headers = jsonArray(snapshot.headers).map(cellText);
      const codeIndex = headers.findIndex(
        (header) =>
          header
            .replace(/[\s\u200c]/g, '')
            .toLocaleLowerCase()
            .includes('کدسامانه') ||
          header.toLocaleLowerCase().includes('systemcode'),
      );
      const sourceRows = jsonRows(snapshot.rows);
      if (codeIndex < 0 || sourceRows.length === 0) return [];
      const provinceIndex = headers.findIndex(
        (header) =>
          header
            .replace(/[\s\u200c_./-]/g, '')
            .toLocaleLowerCase()
            .includes('province') ||
          header.includes('\u0627\u0633\u062a\u0627\u0646'),
      );
      const rows = sourceRows.filter((candidate): candidate is unknown[] => {
        if (
          !Array.isArray(candidate) ||
          cellText(candidate[codeIndex]).trim().toUpperCase() !== systemCode
        )
          return false;
        if (!province) return true;
        if (provinceIndex < 0) return codeBelongsOnlyToRequestedProvince;
        const rawProvince = cellText(candidate[provinceIndex]).trim();
        if (!rawProvince) return codeBelongsOnlyToRequestedProvince;
        return (
          rawProvince === province ||
          rahcomProvinceIdFromLabel(rawProvince) === province
        );
      });
      return rows.map((row) => ({
        id: snapshot.id,
        fileName: snapshot.fileName,
        sheetName: snapshot.sheetName,
        rowCount: snapshot.rowCount,
        createdAt: snapshot.createdAt,
        headers,
        row: row.map(cellText),
      }));
    });
  }
  async createTrafficSnapshot(
    user: AuthenticatedUser,
    body: CreateRahcomTrafficSnapshotDto,
  ) {
    const { organizationId, isAdmin } = await this.authorize(user, true);
    if (!isAdmin)
      throw new ForbiddenException(
        'Only organization administrators can upload the national traffic list.',
      );
    const fileName = String(body.fileName ?? '')
      .trim()
      .slice(0, 255);
    const sheetName = String(body.sheetName ?? '')
      .trim()
      .slice(0, 120);
    const headers = Array.isArray(body.headers)
      ? body.headers.map((value) =>
          String(value ?? '')
            .trim()
            .slice(0, 120),
        )
      : [];
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (
      !fileName ||
      !sheetName ||
      headers.length < 2 ||
      headers.length > 50 ||
      rows.length > 10000
    )
      throw new BadRequestException('Provide a valid Excel traffic list.');
    if (
      rows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== headers.length ||
          row.some((value) => typeof value !== 'string' || value.length > 2000),
      )
    ) {
      throw new BadRequestException(
        'Traffic rows must match the Excel header columns.',
      );
    }
    const serialized = JSON.stringify({ headers, rows });
    if (Buffer.byteLength(serialized, 'utf8') > 8 * 1024 * 1024)
      throw new BadRequestException(
        'The parsed traffic list is too large to save.',
      );
    const normalizedHeader = (value: string) =>
      value
        .trim()
        .normalize('NFKC')
        .toLocaleLowerCase('fa')
        .replace(/[\u064a\u0649]/g, '\u06cc')
        .replace(/\u0643/g, '\u06a9')
        .replace(/[\u200c\s_./()-]/g, '');
    if (
      !headers.some((value) => {
        const key = normalizedHeader(value);
        return (
          key.includes('کدسامانه') ||
          key.includes('systemcode') ||
          key === 'code' ||
          key === 'sitecode'
        );
      }) ||
      !headers.some((value) => {
        const key = normalizedHeader(value);
        return key.includes('استان') || key.includes('province');
      })
    ) {
      throw new BadRequestException(
        'The selected worksheet must include system code and province columns.',
      );
    }
    return this.prisma.rahcomTrafficSnapshot.create({
      data: {
        organizationId,
        createdById: user.id,
        snapshotDate: this.validDate(body.snapshotDate),
        fileName,
        sheetName,
        headers,
        rows,
        rowCount: rows.length,
      },
    });
  }
  async applyTrafficAxes(user: AuthenticatedUser, requestedDate?: string) {
    const { organizationId, demoOnly, isAdmin } = await this.authorize(
      user,
      true,
    );
    if (!isAdmin)
      throw new ForbiddenException(
        'Only organization administrators can apply the national traffic list.',
      );
    const snapshot = await this.prisma.rahcomTrafficSnapshot.findFirst({
      where: {
        organizationId,
        snapshotDate: requestedDate
          ? this.validDate(requestedDate)
          : this.validDate(new Date().toISOString().slice(0, 10)),
        ...(demoOnly ? { createdById: user.id } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!snapshot)
      throw new NotFoundException('No traffic list has been registered yet.');

    const normalizeHeader = (value: string) =>
      value
        .trim()
        .normalize('NFKC')
        .toLocaleLowerCase('fa')
        .replace(/[\u064a\u0649]/g, '\u06cc')
        .replace(/\u0643/g, '\u06a9')
        .replace(/[\u200c\s_./()-]/g, '');
    const headers = jsonArray(snapshot.headers).map(cellText);
    const rows = jsonRows(snapshot.rows);
    const normalizedHeaders = headers.map(normalizeHeader);
    const codeIndex = normalizedHeaders.findIndex(
      (value) =>
        value.includes('کدسامانه') ||
        value.includes('systemcode') ||
        value === 'code' ||
        value === 'sitecode',
    );
    const provinceIndex = normalizedHeaders.findIndex(
      (value) => value.includes('استان') || value.includes('province'),
    );
    const axisCodeIndex = normalizedHeaders.findIndex(
      (value) =>
        value.includes('کدمحور') ||
        value.includes('axiscode') ||
        value.includes('routecode') ||
        value === 'axis',
    );
    const axisNameIndex = normalizedHeaders.findIndex(
      (value) =>
        value.includes('ناممحور') ||
        value.includes('axisname') ||
        value.includes('routename'),
    );
    const stationNameIndex = normalizedHeaders.findIndex(
      (value) => value.includes('نامایستگاه') || value.includes('stationname'),
    );
    const aggregationCodeIndex = normalizedHeaders.findIndex(
      (value) => value.includes('کدتجمیع') || value.includes('aggregationcode'),
    );
    if ([codeIndex, provinceIndex, axisCodeIndex].some((index) => index < 0)) {
      throw new BadRequestException(
        'The registered traffic list must include system code, province and axis code columns.',
      );
    }

    const axisAssignmentsBySystem = new Map<
      string,
      { province: string; systemCode: string; axisCode: string; name: string }
    >();
    const listedSystems = new Set<string>();
    const staticMetadataByKey = new Map<
      string,
      {
        province: string;
        systemCode: string;
        stationName: string;
        aggregationCode: string;
      }
    >();
    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const province = rahcomProvinceIdFromLabel(cellText(row[provinceIndex]));
      const systemCode = cellText(row[codeIndex]).trim();
      const axisCode = cellText(row[axisCodeIndex]).trim();
      const axisLabel =
        axisNameIndex >= 0 ? cellText(row[axisNameIndex]).trim() : '';
      if (!province || !systemCode) continue;
      const systemKey = `${province}\u0000${systemCode
        .normalize('NFKC')
        .toLocaleUpperCase()}`;
      listedSystems.add(systemKey);
      if (stationNameIndex >= 0 || aggregationCodeIndex >= 0) {
        const metadataKey = systemKey;
        staticMetadataByKey.set(metadataKey, {
          province,
          systemCode,
          stationName:
            stationNameIndex >= 0
              ? cellText(row[stationNameIndex]).trim().slice(0, 200)
              : '',
          aggregationCode:
            aggregationCodeIndex >= 0
              ? cellText(row[aggregationCodeIndex]).trim().slice(0, 100)
              : '',
        });
      }
      if (!axisCode) continue;
      const current = axisAssignmentsBySystem.get(systemKey);
      if (
        current &&
        (current.axisCode !== axisCode ||
          (current.name && axisLabel && current.name !== axisLabel))
      ) {
        throw new BadRequestException(
          `The traffic list contains conflicting axis data for system ${systemCode}.`,
        );
      }
      axisAssignmentsBySystem.set(systemKey, {
        province,
        systemCode,
        axisCode,
        name: axisLabel || current?.name || '',
      });
    }
    if (!axisAssignmentsBySystem.size)
      throw new BadRequestException(
        'No rows with a valid province, system code and axis code were found.',
      );

    const assignments = new Map<
      string,
      { province: string; axisCode: string; name: string; codes: Set<string> }
    >();
    for (const systemAssignment of axisAssignmentsBySystem.values()) {
      const name = systemAssignment.name || `محور ${systemAssignment.axisCode}`;
      const assignmentKey = `${systemAssignment.province}\u0000${systemAssignment.axisCode}\u0000${name}`;
      const axisGroupAssignment = assignments.get(assignmentKey) ?? {
        province: systemAssignment.province,
        axisCode: systemAssignment.axisCode,
        name,
        codes: new Set<string>(),
      };
      axisGroupAssignment.codes.add(systemAssignment.systemCode);
      assignments.set(assignmentKey, axisGroupAssignment);
    }

    const updatedSystems = await this.prisma.$transaction(
      async (tx) => {
        const results = await Promise.all(
          [...assignments.values()].map(({ province, name, axisCode, codes }) =>
            tx.rahcomSystem.updateMany({
              where: {
                organizationId,
                province,
                ...(demoOnly
                  ? {
                      systemCode: {
                        startsWith: this.demoSystemPrefix,
                        in: [...codes],
                        mode: 'insensitive',
                      },
                    }
                  : { systemCode: { in: [...codes], mode: 'insensitive' } }),
              },
              data: { announcedAxis: name, axisCode },
            }),
          ),
        );
        const count = results.reduce(
          (total, result) => total + result.count,
          0,
        );
        if (staticMetadataByKey.size) {
          const metadataRows = [...staticMetadataByKey.values()];
          const demoConstraint = demoOnly
            ? Prisma.sql`AND system."systemCode" LIKE ${`${this.demoSystemPrefix}%`}`
            : Prisma.empty;
          for (let offset = 0; offset < metadataRows.length; offset += 500) {
            const batch = metadataRows.slice(offset, offset + 500);
            const values = Prisma.join(
              batch.map(
                (row) =>
                  Prisma.sql`(${row.province}, ${row.systemCode}, ${row.stationName}, ${row.aggregationCode})`,
              ),
            );
            await tx.$executeRaw(Prisma.sql`
              UPDATE "rahcom_systems" AS system
              SET "station_name" = CASE WHEN ${stationNameIndex >= 0} THEN input.station_name ELSE system."station_name" END,
                  "aggregation_code" = CASE WHEN ${aggregationCodeIndex >= 0} THEN input.aggregation_code ELSE system."aggregation_code" END
              FROM (VALUES ${values}) AS input(province, system_code, station_name, aggregation_code)
              WHERE system."organizationId" = ${organizationId}
                AND system."province" = input.province
                AND UPPER(system."systemCode") = UPPER(input.system_code)
                ${demoConstraint}
            `);
          }
        }
        return count;
      },
      { maxWait: 10_000, timeout: 30_000 },
    );
    return {
      updatedSystems,
      unmatchedSystems: Math.max(0, listedSystems.size - updatedSystems),
      axisGroups: assignments.size,
    };
  }
  async createSystem(user: AuthenticatedUser, body: CreateRahcomSystemDto) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const province =
      this.scopedProvince(access, String(body?.province ?? '').trim()) ?? '';
    const systemName = String(body?.systemName ?? '').trim();
    const systemCode = String(body?.systemCode ?? '')
      .trim()
      .toUpperCase();
    const axisCode = String(body?.axisCode ?? '').trim();
    const announcedAxis = String(body?.announcedAxis ?? '').trim();
    const hasLatitude = body?.latitude !== undefined;
    const hasLongitude = body?.longitude !== undefined;
    const latitude = hasLatitude ? Number(body.latitude) : null;
    const longitude = hasLongitude ? Number(body.longitude) : null;
    if (!province || !systemName || !systemCode || !axisCode || !announcedAxis)
      throw new BadRequestException(
        'Province, system name, system code, axis name and axis code are required.',
      );
    if (
      hasLatitude !== hasLongitude ||
      (latitude !== null &&
        (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null &&
        (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      throw new BadRequestException(
        'Enter both valid coordinates, or leave both empty.',
      );
    }
    if (demoOnly && !systemCode.startsWith(this.demoSystemPrefix))
      throw new ForbiddenException(
        'Demo accounts can only create demo Rahcom systems.',
      );
    const existing = await this.prisma.rahcomSystem.findFirst({
      where: {
        organizationId,
        province,
        systemCode: { equals: systemCode, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException(
        'A system with this code already exists in the selected province.',
      );
    const electricityBillId = this.optionalText(body.electricityBillId, 120);
    let billListReplacement: { headers: string[]; rows: string[][] } | null = null;
    if (electricityBillId) {
      const list = await this.prisma.rahcomBillIdentifierList.findUnique({
        where: { organizationId_province: { organizationId, province } },
        select: { headers: true, rows: true },
      });
      if (!list) throw new BadRequestException('The electricity bill identifier is not in the bill list.');
      const headers = jsonArray(list.headers).map(cellText);
      const normalized = headers.map(normalizeBillHeader);
      const billIndex = normalized.findIndex((header) => ['\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636', '\u0634\u0646\u0627\u0633\u0647\u0642\u0628\u0636\u0628\u0631\u0642'].includes(header));
      const systemIndex = normalized.findIndex((header) => ['\u06a9\u062f\u0633\u0627\u0645\u0627\u0646\u0647', '\u06a9\u062f\u0633\u06cc\u0633\u062a\u0645'].includes(header));
      const rows = jsonRows(list.rows).map((row) => row.map(cellText));
      const target = billIndex >= 0 ? rows.find((row) => normalizeBillIdentifier(row[billIndex] ?? '') === normalizeBillIdentifier(electricityBillId)) : undefined;
      if (billIndex < 0 || systemIndex < 0 || !target)
        throw new BadRequestException('The electricity bill identifier is not in the bill list.');
      target[systemIndex] = systemCode;
      billListReplacement = { headers, rows };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.rahcomSystem.create({
          data: { organizationId, province, systemName, systemCode, axisCode, announcedAxis, latitude, longitude, electricityBillId },
        });
        if (billListReplacement) {
          await tx.rahcomBillIdentifierList.update({
            where: { organizationId_province: { organizationId, province } },
            data: { headers: billListReplacement.headers, rows: billListReplacement.rows, updatedById: user.id },
          });
        }
        return created;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A system with this code already exists in the selected province.',
        );
      throw error;
    }
  }
  async importSystems(
    user: AuthenticatedUser,
    body: ImportRahcomSystemsDto | ImportRahcomSystemsBatchDto,
  ) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const hasOneProvince = 'province' in body;
    const requestedProvince = hasOneProvince
      ? this.scopedProvince(access, String(body.province ?? '').trim())
      : undefined;
    const inputSystems: Array<
      RahcomSystemImportRowDto & { province?: string }
    > = body.systems;
    if (
      (hasOneProvince && !requestedProvince) ||
      !Array.isArray(inputSystems) ||
      inputSystems.length > 10000
    )
      throw new BadRequestException(
        'Select valid provinces and provide at most 10,000 rows.',
      );
    const rows = inputSystems.map(
      (
        raw,
        index,
      ): {
        organizationId: string;
        province: string;
        systemName: string;
        systemCode: string;
        latitude: number | null;
        longitude: number | null;
        axisCode?: string | null;
        announcedAxis?: string | null;
        stationName?: string | null;
        aggregationCode?: string | null;
        details?: string | null;
        electricityBillId?: string | null;
        simIp?: string | null;
        radarIp?: string | null;
        cameraIp?: string | null;
        pcIp?: string | null;
        routerIp?: string | null;
        laptopIp?: string | null;
        incidentType?: string | null;
        incidentDetails?: string | null;
        longOutage?: boolean;
        longOutageReason?: string | null;
        longOutageDetails?: string | null;
      } => {
        const row = raw;
        const province = hasOneProvince
          ? requestedProvince
          : this.scopedProvince(access, String(row.province ?? '').trim());
        if (!province || province.length > 80)
          throw new BadRequestException(
            `Select a valid province for system row ${index + 1}.`,
          );
        const systemName = String(row.systemName ?? '').trim();
        const systemCode = String(row.systemCode ?? '')
          .trim()
          .toUpperCase();
        const hasLatitude = row.latitude !== undefined && row.latitude !== null;
        const hasLongitude =
          row.longitude !== undefined && row.longitude !== null;
        const latitude = hasLatitude ? Number(row.latitude) : null;
        const longitude = hasLongitude ? Number(row.longitude) : null;
        if (
          !systemName ||
          !systemCode ||
          hasLatitude !== hasLongitude ||
          (latitude !== null &&
            (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
          (longitude !== null &&
            (!Number.isFinite(longitude) ||
              longitude < -180 ||
              longitude > 180))
        )
          throw new BadRequestException(
            `Invalid system row ${index + 1}. Enter both valid coordinates, or leave both empty.`,
          );
        if (demoOnly && !systemCode.startsWith(this.demoSystemPrefix))
          throw new ForbiddenException(
            'Demo accounts can only import demo Rahcom systems.',
          );
        const optionalData = {
          ...(row.stationName !== undefined
            ? { stationName: this.optionalText(row.stationName, 200) }
            : {}),
          ...(row.aggregationCode !== undefined
            ? { aggregationCode: this.optionalText(row.aggregationCode, 100) }
            : {}),
          ...(row.details !== undefined
            ? { details: this.optionalText(row.details, 1000) }
            : {}),
          ...(row.axisCode !== undefined
            ? { axisCode: this.optionalText(row.axisCode, 100) }
            : {}),
          ...(row.announcedAxis !== undefined
            ? { announcedAxis: this.optionalText(row.announcedAxis, 120) }
            : {}),
          ...(row.longOutage !== undefined
            ? { longOutage: row.longOutage }
            : {}),
          ...(row.longOutageReason !== undefined
            ? { longOutageReason: row.longOutageReason }
            : {}),
          ...(row.longOutageDetails !== undefined
            ? {
                longOutageDetails: this.optionalText(
                  row.longOutageDetails,
                  1000,
                ),
              }
            : {}),
          ...(row.incidentType !== undefined
            ? { incidentType: row.incidentType }
            : {}),
          ...(row.incidentDetails !== undefined
            ? { incidentDetails: this.optionalText(row.incidentDetails, 1000) }
            : {}),
          ...(row.electricityBillId !== undefined
            ? {
                electricityBillId: this.optionalText(
                  row.electricityBillId,
                  120,
                ),
              }
            : {}),
          ...(row.simIp !== undefined
            ? { simIp: this.optionalText(row.simIp, 100) }
            : {}),
          ...(row.radarIp !== undefined
            ? { radarIp: this.optionalText(row.radarIp, 100) }
            : {}),
          ...(row.cameraIp !== undefined
            ? { cameraIp: this.optionalText(row.cameraIp, 100) }
            : {}),
          ...(row.pcIp !== undefined
            ? { pcIp: this.optionalText(row.pcIp, 100) }
            : {}),
          ...(row.routerIp !== undefined
            ? { routerIp: this.optionalText(row.routerIp, 100) }
            : {}),
          ...(row.laptopIp !== undefined
            ? { laptopIp: this.optionalText(row.laptopIp, 100) }
            : {}),
        };
        return {
          organizationId,
          province,
          systemName,
          systemCode,
          latitude,
          longitude,
          ...optionalData,
        };
      },
    );
    const codes = new Set<string>();
    for (const row of rows) {
      const normalizedCode = `${row.province}\u0000${row.systemCode.toUpperCase()}`;
      if (codes.has(normalizedCode))
        throw new BadRequestException(
          `Duplicate system code: ${row.systemCode}`,
        );
      codes.add(normalizedCode);
    }
    const existingSystems = await this.prisma.rahcomSystem.findMany({
      where: {
        organizationId,
        province: { in: [...new Set(rows.map((row) => row.province))] },
        systemCode: {
          in: rows.map((row) => row.systemCode),
          mode: 'insensitive',
        },
      },
      select: { id: true, systemCode: true, province: true },
    });
    const existingByCode = new Map<string, (typeof existingSystems)[number]>();
    for (const system of existingSystems) {
      const normalizedCode = `${system.province}\u0000${system.systemCode.toUpperCase()}`;
      if (existingByCode.has(normalizedCode)) {
        throw new ConflictException(
          `Multiple existing systems use code ${system.systemCode} with different casing in ${system.province}. Resolve those duplicate records before importing.`,
        );
      }
      existingByCode.set(normalizedCode, system);
    }
    const systemWrites = rows.map((row) => {
      const {
        details,
        stationName,
        aggregationCode,
        axisCode,
        announcedAxis,
        longOutage,
        longOutageReason,
        longOutageDetails,
        electricityBillId,
        simIp,
        radarIp,
        cameraIp,
        pcIp,
        routerIp,
        laptopIp,
        incidentType,
        incidentDetails,
        ...required
      } = row;
      const optionalData = {
        details,
        stationName,
        aggregationCode,
        axisCode,
        announcedAxis,
        longOutage,
        longOutageReason,
        longOutageDetails,
        electricityBillId,
        simIp,
        radarIp,
        cameraIp,
        pcIp,
        routerIp,
        laptopIp,
        incidentType,
        incidentDetails,
      };
      const existing = existingByCode.get(
        `${row.province}\u0000${row.systemCode.toUpperCase()}`,
      );
      if (existing) {
        return this.prisma.rahcomSystem.update({
          where: { id: existing.id },
          data: {
            ...required,
            ...Object.fromEntries(
              Object.entries(optionalData).filter(
                ([, value]) => value !== undefined,
              ),
            ),
          },
        });
      }
      return this.prisma.rahcomSystem.upsert({
        where: {
          organizationId_province_systemCode: {
            organizationId,
            province: row.province,
            systemCode: row.systemCode,
          },
        },
        update: {
          ...required,
          ...Object.fromEntries(
            Object.entries(optionalData).filter(
              ([, value]) => value !== undefined,
            ),
          ),
        },
        create: {
          ...required,
          details: details ?? null,
          stationName: stationName ?? null,
          aggregationCode: aggregationCode ?? null,
          axisCode: axisCode ?? null,
          announcedAxis: announcedAxis ?? null,
          longOutage: longOutage ?? Boolean(longOutageReason),
          longOutageReason: longOutageReason ?? null,
          longOutageDetails: longOutageDetails ?? null,
          electricityBillId: electricityBillId ?? null,
          simIp: simIp ?? null,
          radarIp: radarIp ?? null,
          cameraIp: cameraIp ?? null,
          pcIp: pcIp ?? null,
          routerIp: routerIp ?? null,
          laptopIp: laptopIp ?? null,
          incidentType: incidentType ?? null,
          incidentDetails: incidentDetails ?? null,
        },
      });
    });
    try {
      await this.prisma.$transaction(systemWrites);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A system with this code already exists in the selected province.',
        );
      }
      throw error;
    }
    return { imported: rows.length };
  }
  async updateSystem(
    user: AuthenticatedUser,
    id: string,
    body: UpdateRahcomSystemDto,
  ) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    if (Object.keys(body).length === 0)
      throw new BadRequestException(
        'Provide at least one system field to update.',
      );
    const existing = await this.prisma.rahcomSystem.findFirst({
      where: {
        id,
        organizationId,
        ...(demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
      },
    });
    if (!existing) throw new NotFoundException('System not found.');
    this.scopedProvince(access, existing.province);
    const systemName =
      body.systemName === undefined
        ? existing.systemName
        : String(body.systemName ?? '').trim();
    const systemCode =
      body.systemCode === undefined
        ? existing.systemCode.toUpperCase()
        : String(body.systemCode ?? '')
            .trim()
            .toUpperCase();
    const latitude =
      body.latitude === undefined
        ? existing.latitude
        : body.latitude === null
          ? null
          : Number(body.latitude);
    const longitude =
      body.longitude === undefined
        ? existing.longitude
        : body.longitude === null
          ? null
          : Number(body.longitude);
    if (
      !systemName ||
      !systemCode ||
      (latitude === null) !== (longitude === null) ||
      (latitude !== null &&
        (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude !== null &&
        (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    )
      throw new BadRequestException(
        'Enter both valid coordinates, or leave both empty.',
      );
    if (demoOnly && !systemCode.startsWith(this.demoSystemPrefix))
      throw new ForbiddenException(
        'Demo accounts cannot move systems outside the demo dataset.',
      );
    if (systemCode !== existing.systemCode) {
      const codeConflict = await this.prisma.rahcomSystem.findFirst({
        where: {
          organizationId,
          province: existing.province,
          systemCode: { equals: systemCode, mode: 'insensitive' },
          id: { not: existing.id },
        },
        select: { id: true },
      });
      if (codeConflict)
        throw new ConflictException(
          'A system with this code already exists in the selected province.',
        );
    }
    const optionalData = {
      ...(body.stationName !== undefined
        ? { stationName: this.optionalText(body.stationName, 200) }
        : {}),
      ...(body.aggregationCode !== undefined
        ? { aggregationCode: this.optionalText(body.aggregationCode, 100) }
        : {}),
      ...(body.details !== undefined
        ? { details: this.optionalText(body.details, 1000) }
        : {}),
      ...(body.axisCode !== undefined
        ? { axisCode: this.optionalText(body.axisCode, 100) }
        : {}),
      ...(body.announcedAxis !== undefined
        ? { announcedAxis: this.optionalText(body.announcedAxis, 120) }
        : {}),
      ...(body.longOutage !== undefined ? { longOutage: body.longOutage } : {}),
      ...(body.longOutageReason !== undefined
        ? {
            longOutageReason: body.longOutageReason,
            longOutage: Boolean(body.longOutageReason),
          }
        : {}),
      ...(body.longOutageDetails !== undefined
        ? { longOutageDetails: this.optionalText(body.longOutageDetails, 1000) }
        : {}),
      ...(body.incidentType !== undefined
        ? { incidentType: body.incidentType }
        : {}),
      ...(body.incidentDetails !== undefined
        ? { incidentDetails: this.optionalText(body.incidentDetails, 1000) }
        : {}),
      ...(body.electricityBillId !== undefined
        ? { electricityBillId: this.optionalText(body.electricityBillId, 120) }
        : {}),
      ...(body.simIp !== undefined
        ? { simIp: this.optionalText(body.simIp, 100) }
        : {}),
      ...(body.radarIp !== undefined
        ? { radarIp: this.optionalText(body.radarIp, 100) }
        : {}),
      ...(body.cameraIp !== undefined
        ? { cameraIp: this.optionalText(body.cameraIp, 100) }
        : {}),
      ...(body.pcIp !== undefined
        ? { pcIp: this.optionalText(body.pcIp, 100) }
        : {}),
      ...(body.routerIp !== undefined
        ? { routerIp: this.optionalText(body.routerIp, 100) }
        : {}),
      ...(body.laptopIp !== undefined
        ? { laptopIp: this.optionalText(body.laptopIp, 100) }
        : {}),
    };
    let billListReplacement: { headers: string[]; rows: string[][]; touchedSystemCodes: Set<string>; billIndex: number; systemIndex: number } | null = null;
    if (body.electricityBillId !== undefined || systemCode !== existing.systemCode) {
      const nextBillId = body.electricityBillId !== undefined
        ? this.optionalText(body.electricityBillId, 120)
        : existing.electricityBillId;
      const billList = await this.prisma.rahcomBillIdentifierList.findUnique({
        where: { organizationId_province: { organizationId, province: existing.province } },
        select: { headers: true, rows: true },
      });
      if (nextBillId && !billList)
        throw new BadRequestException('The electricity bill identifier is not in the bill list.');
      if (billList) {
        const headers = jsonArray(billList.headers).map(cellText);
        const normalized = headers.map(normalizeBillHeader);
        const billIdColumn = normalized.findIndex((header) => ['شناسهقبض', 'شناسهقبضبرق'].includes(header));
        const systemCodeColumn = normalized.findIndex((header) => ['کدسامانه', 'کدسیستم'].includes(header));
        const rows = jsonRows(billList.rows).map((row) => row.map(cellText));
        if (billIdColumn >= 0 && systemCodeColumn >= 0) {
          const touchedSystemCodes = new Set([existing.systemCode.toUpperCase(), systemCode.toUpperCase()]);
          const nextKey = nextBillId ? normalizeBillIdentifier(nextBillId) : '';
          const oldKey = existing.electricityBillId ? normalizeBillIdentifier(existing.electricityBillId) : '';
          const nextRow = nextKey ? rows.find((row) => normalizeBillIdentifier(row[billIdColumn] ?? '') === nextKey) : undefined;
          if (nextBillId && !nextRow)
            throw new BadRequestException('The electricity bill identifier is not in the bill list.');
          for (const row of rows) {
            const rowKey = normalizeBillIdentifier(row[billIdColumn] ?? '');
            if (oldKey && rowKey === oldKey) {
              row[systemCodeColumn] = (row[systemCodeColumn] ?? '').split(/[;,|]/).map((code) => code.trim())
                .filter((code) => code && code.toUpperCase() !== existing.systemCode.toUpperCase()).join('; ');
            }
          }
          if (nextRow && nextBillId) {
            for (const code of (nextRow[systemCodeColumn] ?? '').split(/[;,|]/).map((value) => value.trim()).filter(Boolean)) {
              if (!/^EXTERNAL:/i.test(code)) touchedSystemCodes.add(code.toUpperCase());
            }
            nextRow[systemCodeColumn] = systemCode;
          }
          billListReplacement = { headers, rows, touchedSystemCodes, billIndex: billIdColumn, systemIndex: systemCodeColumn };
        }
      }
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (billListReplacement) {
          await tx.rahcomBillIdentifierList.update({
            where: { organizationId_province: { organizationId, province: existing.province } },
            data: { headers: billListReplacement.headers, rows: billListReplacement.rows, updatedById: user.id },
          });
          const linkedBillBySystem = new Map<string, string>();
          for (const row of billListReplacement.rows) {
            const billId = row[billListReplacement.billIndex]?.trim();
            for (const code of (row[billListReplacement.systemIndex] ?? '').split(/[;,|]/).map((value) => value.trim()).filter((value) => value && !/^EXTERNAL:/i.test(value))) {
              const key = code.toUpperCase();
              if (billId && !linkedBillBySystem.has(key)) linkedBillBySystem.set(key, billId);
            }
          }
          for (const code of billListReplacement.touchedSystemCodes) {
            await tx.rahcomSystem.updateMany({
              where: { organizationId, province: existing.province, systemCode: { equals: code, mode: 'insensitive' } },
              data: { electricityBillId: linkedBillBySystem.get(code) ?? null },
            });
          }
        }
        return tx.rahcomSystem.update({
          where: { id },
          data: { systemName, systemCode, latitude, longitude, ...optionalData },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'A system with this code already exists in the selected province.',
        );
      throw error;
    }
  }
  private optionalText(value: unknown, maxLength: number): string | null {
    const text = cellText(value).trim();
    return text ? text.slice(0, maxLength) : null;
  }
  async deleteSystem(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const existing = await this.prisma.rahcomSystem.findFirst({
      where: {
        id,
        organizationId,
        ...(demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
      },
      select: { province: true },
    });
    if (!existing) throw new NotFoundException('System not found.');
    this.scopedProvince(access, existing.province);
    const result = await this.prisma.rahcomSystem.deleteMany({
      where: {
        id,
        organizationId,
        province: existing.province,
        ...(demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
      },
    });
    if (!result.count) throw new NotFoundException('System not found.');
    return { deleted: true };
  }
  async deleteSystems(
    user: AuthenticatedUser,
    input: { province?: string; ids?: string[] },
  ) {
    const access = await this.authorize(user, true);
    const { organizationId, demoOnly } = access;
    const province =
      this.scopedProvince(access, String(input.province ?? '').trim()) ?? '';
    const ids = Array.isArray(input.ids)
      ? [
          ...new Set(
            input.ids
              .filter((id) => typeof id === 'string' && id.trim())
              .map((id) => id.trim()),
          ),
        ]
      : [];
    if ((!province && !ids.length) || ids.length > 10000)
      throw new BadRequestException(
        'Select a province or provide up to 10,000 system IDs.',
      );
    const result = await this.prisma.rahcomSystem.deleteMany({
      where: {
        organizationId,
        ...(demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
        ...(province
          ? { province, ...(ids.length ? { id: { in: ids } } : {}) }
          : { id: { in: ids } }),
      },
    });
    return { deleted: result.count };
  }
  async listActivities(
    user: AuthenticatedUser,
    query: RahcomActivitiesQueryDto,
  ) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const province = this.scopedProvince(access, query.province);
    if (!query.date && !query.from && !query.to)
      throw new BadRequestException('Provide a date or a date range.');
    if (query.date && (query.from || query.to))
      throw new BadRequestException(
        'Use either a single date or a date range.',
      );
    const activityDate = query.date ? this.validDate(query.date) : undefined;
    const from = query.from ? this.validDate(query.from) : undefined;
    const to = query.to ? this.validDate(query.to) : undefined;
    if (Boolean(from) !== Boolean(to))
      throw new BadRequestException(
        'Both from and to dates are required for a range.',
      );
    if (from && to && from > to)
      throw new BadRequestException(
        'The start date must be before the end date.',
      );
    const range =
      from && to
        ? { gte: from, lt: new Date(to.getTime() + 86_400_000) }
        : undefined;
    return this.prisma.rahcomActivity.findMany({
      where: {
        organizationId,
        ...(range
          ? { activityDate: range }
          : activityDate
            ? { activityDate }
            : {}),
        ...(demoOnly
          ? { description: { startsWith: this.demoActivityPrefix } }
          : {}),
        ...(province
          ? {
              OR: [
                { system: { province } },
                { systemId: null, provinceSnapshot: province },
              ],
            }
          : {}),
      },
      include: {
        system: {
          select: {
            id: true,
            systemName: true,
            systemCode: true,
            province: true,
          },
        },
      },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
    });
  }
  createActivity(user: AuthenticatedUser, body: CreateRahcomActivityDto) {
    return this.createAuthorizedActivity(user, body);
  }
  async saveDailyWorkflow(
    user: AuthenticatedUser,
    body: SaveRahcomDailyWorkflowDto,
  ) {
    const access = await this.authorize(user, 'activity');
    const { organizationId } = access;
    const province = this.scopedProvince(access, body.province);
    if (!province)
      throw new BadRequestException(
        'Select one province before saving the daily workflow.',
      );
    const activityDate = this.validDate(body.date);
    const systemCodes = (body.systemCodes ?? '')
      .split(/[\s,;|]+/)
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    if (
      systemCodes.length > 250 ||
      systemCodes.some((code) => !/^\d{3}[A-Z]\d{5}$/.test(code))
    )
      throw new BadRequestException(
        'The daily workflow has invalid system codes.',
      );

    const actionSystemIds = new Set<string>();
    const legacyActionCodes: string[] = [];
    const actionsData = (body.actionsData ?? '').trim();
    if (actionsData) {
      let parsedActions: unknown;
      try {
        parsedActions = JSON.parse(actionsData) as unknown;
      } catch {
        // Older daily records stored system codes as plain text.
        legacyActionCodes.push(
          ...actionsData
            .split(/[\s,;|]+/)
            .map((code) => code.trim().toUpperCase())
            .filter(Boolean),
        );
      }
      if (Array.isArray(parsedActions)) {
        if (parsedActions.length > 250)
          throw new BadRequestException(
            'A daily workflow cannot include more than 250 systems.',
          );
        for (const item of parsedActions) {
          if (!item || typeof item !== 'object' || Array.isArray(item))
            throw new BadRequestException(
              'The daily workflow contains an invalid system entry.',
            );
          const entry = item as Record<string, unknown>;
          if (
            Object.keys(entry).some(
              (key) => !['systemId', 'issue', 'visitType'].includes(key),
            ) ||
            typeof entry.systemId !== 'string' ||
            !entry.systemId.trim() ||
            entry.systemId.length > 100 ||
            (entry.issue !== '' &&
              entry.issue !== 'radar' &&
              entry.issue !== 'system') ||
            (entry.visitType !== '' &&
              entry.visitType !== 'local' &&
              entry.visitType !== 'no_lift' &&
              entry.visitType !== 'with_lift') ||
            actionSystemIds.has(entry.systemId)
          )
            throw new BadRequestException(
              'The daily workflow contains an invalid or duplicate system entry.',
            );
          actionSystemIds.add(entry.systemId);
        }
      } else if (parsedActions !== undefined) {
        throw new BadRequestException(
          'The daily workflow data must be a list of system entries.',
        );
      }
    }
    const referencedCodes = [
      ...new Set([...systemCodes, ...legacyActionCodes]),
    ];
    if (
      referencedCodes.length > 250 ||
      referencedCodes.some((code) => !/^\d{3}[A-Z]\d{5}$/.test(code))
    )
      throw new BadRequestException(
        'The daily workflow has invalid system codes.',
      );

    const stages: Array<[string, string | null]> = [
      [
        'SYSTEM_CODES',
        String(body.systemCodes ?? '')
          .trim()
          .slice(0, 10000) || null,
      ],
      [
        'VISIT_PLAN',
        String(body.visitPlan ?? '')
          .trim()
          .slice(0, 10000) || null,
      ],
      [
        'COMPLETION_REPORT',
        String(body.completionReport ?? '')
          .trim()
          .slice(0, 10000) || null,
      ],
      [
        'DAILY_NOTE',
        String(body.dailyNote ?? '')
          .trim()
          .slice(0, 10000) || null,
      ],
      [
        'ACTIONS_DATA',
        String(body.actionsData ?? '')
          .trim()
          .slice(0, 10000) || null,
      ],
      [
        'EXCEL_UPDATE',
        body.excelUpdated
          ? String(body.excelFileName ?? '')
              .trim()
              .slice(0, 255) || '__COMPLETED__'
          : null,
      ],
    ];
    await this.serializableTransaction(async (tx) => {
      if (actionSystemIds.size || referencedCodes.length) {
        const systems = await tx.rahcomSystem.findMany({
          where: {
            organizationId,
            province,
            OR: [
              ...(actionSystemIds.size
                ? [{ id: { in: [...actionSystemIds] } }]
                : []),
              ...(referencedCodes.length
                ? [
                    {
                      systemCode: {
                        in: referencedCodes,
                        mode: 'insensitive' as const,
                      },
                    },
                  ]
                : []),
            ],
          },
          select: { id: true, systemCode: true },
        });
        const foundIds = new Set(systems.map((system) => system.id));
        const foundCodes = new Set(
          systems.map((system) => system.systemCode.toUpperCase()),
        );
        if (
          [...actionSystemIds].some((id) => !foundIds.has(id)) ||
          referencedCodes.some((code) => !foundCodes.has(code))
        )
          throw new BadRequestException(
            'The daily workflow contains a system that is unavailable in the selected province.',
          );
      }
      for (const [activityType, description] of stages) {
        const where = {
          organizationId,
          activityDate,
          activityType,
          systemId: null,
          provinceSnapshot: province,
        };
        const existing = await tx.rahcomActivity.findFirst({
          where,
          select: { id: true },
        });
        if (!description) {
          await tx.rahcomActivity.deleteMany({ where });
        } else if (existing) {
          await tx.rahcomActivity.update({
            where: { id: existing.id },
            data: {
              description,
              performedBy:
                `${user.firstName} ${user.lastName}`.trim() || user.username,
            },
          });
        } else {
          await tx.rahcomActivity.create({
            data: {
              ...where,
              createdById: user.id,
              performedBy:
                `${user.firstName} ${user.lastName}`.trim() || user.username,
              quantity: 1,
              description,
            },
          });
        }
      }
    });
    return { saved: true };
  }
  private async createAuthorizedActivity(
    user: AuthenticatedUser,
    body: CreateRahcomActivityDto,
  ) {
    const access = await this.authorize(user, 'activity');
    const { organizationId, demoOnly } = access;
    const province = this.scopedProvince(access, body.province);
    const activityType = String(body.activityType ?? '').trim();
    const quantity = Number(body.quantity);
    const allowed = ['EMAIL_SENT', 'SYSTEM_VISIT', 'OTHER'];
    if (
      !allowed.includes(activityType) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100000
    )
      throw new BadRequestException('Invalid activity type or quantity.');
    const systemId = body.systemId ? String(body.systemId).trim() : null;
    if (systemId)
      return this.createVisitRecord(user, access, systemId, body, province);
    if (!province)
      throw new BadRequestException(
        'Select one province before recording an activity.',
      );
    const description = body.description
      ? String(body.description).slice(0, 1000)
      : null;
    return this.prisma.rahcomActivity.create({
      data: {
        organizationId,
        createdById: user.id,
        performedBy:
          `${user.firstName} ${user.lastName}`.trim() || user.username,
        activityDate: this.validDate(body.date),
        activityType,
        quantity,
        provinceSnapshot: province,
        description:
          demoOnly && description
            ? `${this.demoActivityPrefix} ${description}`
            : description,
      },
    });
  }
  async listSystemActivities(
    user: AuthenticatedUser,
    systemId: string,
    requestedDate?: string,
  ) {
    const access = await this.authorize(user);
    const { organizationId, demoOnly } = access;
    const system = await this.prisma.rahcomSystem.findFirst({
      where: {
        id: systemId,
        organizationId,
        ...(demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
      },
      select: { id: true, province: true },
    });
    if (!system) throw new NotFoundException('System not found.');
    this.scopedProvince(access, system.province);
    return this.prisma.rahcomActivity.findMany({
      where: {
        organizationId,
        systemId,
        ...(requestedDate
          ? { activityDate: this.validDate(requestedDate) }
          : {}),
        ...(demoOnly
          ? { description: { startsWith: this.demoActivityPrefix } }
          : {}),
      },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
    });
  }
  async createSystemActivity(
    user: AuthenticatedUser,
    systemId: string,
    body: CreateRahcomSystemActivityDto,
  ) {
    const access = await this.authorize(user, 'activity');
    return this.createVisitRecord(user, access, systemId, body);
  }
  private async createVisitRecord(
    user: AuthenticatedUser,
    access: RahcomAccess,
    systemId: string,
    body: CreateRahcomActivityDto | CreateRahcomSystemActivityDto,
    requestedProvince?: string | null,
  ) {
    const { organizationId, demoOnly } = access;
    const system = await this.prisma.rahcomSystem.findFirst({
      where: {
        id: systemId,
        organizationId,
        ...(demoOnly
          ? { systemCode: { startsWith: this.demoSystemPrefix } }
          : {}),
      },
    });
    if (!system) throw new NotFoundException('System not found.');
    this.scopedProvince(access, system.province);
    if (requestedProvince && requestedProvince !== system.province)
      throw new BadRequestException(
        'The selected activity province must match the system province.',
      );
    const description = String(body.description ?? '').trim();
    if (!description)
      throw new BadRequestException('Describe the work performed.');
    const activityDate = this.validDate(body.date);
    const optional = (value: unknown, max: number) => {
      const text = cellText(value).trim();
      return text ? text.slice(0, max) : null;
    };
    return this.prisma.rahcomActivity.create({
      data: {
        organizationId,
        createdById: user.id,
        performedBy:
          `${user.firstName} ${user.lastName}`.trim() || user.username,
        systemId: system.id,
        systemNameSnapshot: system.systemName,
        systemCodeSnapshot: system.systemCode,
        provinceSnapshot: system.province,
        activityDate,
        activityType: 'SYSTEM_VISIT',
        quantity: 1,
        description: demoOnly
          ? `${this.demoActivityPrefix} ${description}`.slice(0, 1000)
          : description.slice(0, 1000),
        accompaniedBy: optional(body.accompaniedBy, 200),
        handedOverTo: optional(body.handedOverTo, 200),
      },
    });
  }
  async deleteActivity(user: AuthenticatedUser, id: string) {
    const access = await this.authorize(user, 'activity');
    const { organizationId, demoOnly } = access;
    const activity = await this.prisma.rahcomActivity.findFirst({
      where: {
        id,
        organizationId,
        ...(demoOnly
          ? { description: { startsWith: this.demoActivityPrefix } }
          : {}),
      },
      select: {
        systemId: true,
        createdById: true,
        provinceSnapshot: true,
        system: { select: { province: true } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found.');
    let assignedProvince: string | null = null;
    if (!access.isAdmin) {
      if (activity.createdById !== user.id)
        throw new ForbiddenException(
          'You can only manage your own province activity records.',
        );
      const province = activity.system?.province ?? activity.provinceSnapshot;
      if (!province)
        throw new ForbiddenException('This activity has no assigned province.');
      assignedProvince = this.scopedProvince(access, province) ?? null;
    }
    const result = await this.prisma.rahcomActivity.deleteMany({
      where: {
        id,
        organizationId,
        ...(!access.isAdmin
          ? {
              createdById: user.id,
              OR: [
                ...(activity.systemId && assignedProvince
                  ? [{ system: { province: assignedProvince } }]
                  : []),
                ...(!activity.systemId && assignedProvince
                  ? [{ provinceSnapshot: assignedProvince }]
                  : []),
              ],
            }
          : {}),
        ...(demoOnly
          ? { description: { startsWith: this.demoActivityPrefix } }
          : {}),
      },
    });
    if (!result.count) throw new NotFoundException('Activity not found.');
    return { deleted: true };
  }
}
