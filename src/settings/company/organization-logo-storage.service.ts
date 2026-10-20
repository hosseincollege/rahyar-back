import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

const LOGO_DIRECTORY = join(process.cwd(), 'uploads', 'logos');
const LOGO_URL_PREFIX = '/uploads/logos/';

@Injectable()
export class OrganizationLogoStorageService {
  async save(buffer: Buffer, mimeType: string): Promise<string> {
    if (process.env.VERCEL === '1') {
      throw new ServiceUnavailableException(
        'ذخیره فایل روی دیسک در محیط Vercel پایدار نیست؛ از نشانی آنلاین لوگو استفاده کنید.',
      );
    }

    const extension = this.validateImage(buffer, mimeType);
    await mkdir(LOGO_DIRECTORY, { recursive: true });

    const fileName = `${randomUUID()}${extension}`;
    await writeFile(join(LOGO_DIRECTORY, fileName), buffer, { flag: 'wx' });

    return `${LOGO_URL_PREFIX}${fileName}`;
  }

  async remove(url?: string | null): Promise<void> {
    if (!url?.startsWith(LOGO_URL_PREFIX)) return;

    const fileName = basename(url.slice(LOGO_URL_PREFIX.length));
    if (!fileName || fileName === '.' || fileName === '..') return;

    try {
      await unlink(join(LOGO_DIRECTORY, fileName));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  private validateImage(buffer: Buffer, mimeType: string): string {
    const isPng =
      mimeType === 'image/png' &&
      buffer
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg =
      mimeType === 'image/jpeg' &&
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    const isWebp =
      mimeType === 'image/webp' &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';

    if (isPng) return '.png';
    if (isJpeg) return '.jpg';
    if (isWebp) return '.webp';

    throw new BadRequestException(
      'فایل انتخاب‌شده تصویر PNG، JPG یا WebP معتبر نیست.',
    );
  }
}
