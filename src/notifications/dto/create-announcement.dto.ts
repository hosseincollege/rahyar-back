import {
  IsBoolean,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const supportedLocales = [
  'fa', 'en', 'ar', 'zh-CN', 'fr', 'es', 'de', 'ru', 'ja', 'pt-BR',
];

export class CreateAnnouncementDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  summary?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(5000)
  body!: string;

  @IsIn(supportedLocales)
  locale!: string;

  @IsOptional()
  @IsIn(['general', 'operations', 'finance', 'hr', 'technical'])
  category!: string;

  @IsOptional()
  @IsIn(['normal', 'important', 'urgent'])
  priority!: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional() @IsBoolean() allowLikes?: boolean;
  @IsOptional() @IsBoolean() allowReactions?: boolean;
  @IsOptional() @IsBoolean() allowComments?: boolean;
  @IsOptional() @IsBoolean() allowMentions?: boolean;
  @IsOptional() @IsString() branchId?: string | null;
}

export class UpdateAnnouncementDto extends CreateAnnouncementDto {}

export class CreateAnnouncementCommentDto {
  @IsString() @MinLength(1) @MaxLength(2000) body!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) mentionedUserIds?: string[];
}

export class AnnouncementReactionDto {
  @IsString() @MaxLength(16) emoji!: string;
}
