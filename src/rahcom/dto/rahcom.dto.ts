import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RahcomSystemImportRowDto {
  @IsString() @MinLength(1) @MaxLength(200) systemName!: string;
  @IsString() @MinLength(1) @MaxLength(100) systemCode!: string;
  @IsOptional() @IsString() @MaxLength(120) axis?: string | null;
  @IsOptional() @IsString() @MaxLength(100) axisCode?: string | null;
  @IsOptional() @IsIn(['THEFT', 'DAMAGE', 'THEFT_AND_DAMAGE']) incidentType?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) incidentDetails?: string | null;
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-90) @Max(90) latitude!: number;
  @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-180) @Max(180) longitude!: number;
  @IsOptional() @IsString() @MaxLength(1000) details?: string | null;
  @IsOptional() @IsString() @MaxLength(120) electricityBillId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) simIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) radarIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) cameraIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) pcIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) routerIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) laptopIp?: string | null;
}

export class ImportRahcomSystemsDto {
  @IsString() @MinLength(1) @MaxLength(80) province!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10000) @ValidateNested({ each: true }) @Type(() => RahcomSystemImportRowDto)
  systems!: RahcomSystemImportRowDto[];
}

export class UpdateRahcomSystemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) systemName?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) systemCode?: string;
  @IsOptional() @IsString() @MaxLength(120) axis?: string | null;
  @IsOptional() @IsString() @MaxLength(100) axisCode?: string | null;
  @IsOptional() @IsIn(['THEFT', 'DAMAGE', 'THEFT_AND_DAMAGE']) incidentType?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) incidentDetails?: string | null;
  @IsOptional() @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @IsString() @MaxLength(1000) details?: string | null;
  @IsOptional() @IsString() @MaxLength(120) electricityBillId?: string | null;
  @IsOptional() @IsString() @MaxLength(100) simIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) radarIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) cameraIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) pcIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) routerIp?: string | null;
  @IsOptional() @IsString() @MaxLength(100) laptopIp?: string | null;
}

export class RahcomActivitiesQueryDto {
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) from?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) to?: string;
  @IsOptional() @IsString() @MaxLength(80) province?: string;
}

export class RahcomProvinceQueryDto {
  @IsOptional() @IsString() @MaxLength(80) province?: string;
}

export class CreateRahcomAxisDto {
  @IsString() @MinLength(1) @MaxLength(80) province!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}

export class UpdateRahcomAxisDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}

export class MergeRahcomAxisDto {
  @IsString() @MinLength(1) targetAxisId!: string;
}

export class CreateRahcomSolarSnapshotDto {
  @IsString() @MaxLength(80) @Matches(/^[a-z]+(?:-[a-z]+)*$/) province!: string;
  @IsString() @MaxLength(250000) downText!: string;
  @IsString() @MaxLength(250000) unreachableText!: string;
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(50) @IsString({ each: true }) equipmentColumns!: string[];
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/) capturedAt?: string;
}

export class CreateRahcomTrafficSnapshotDto {
  @IsString() @MinLength(1) @MaxLength(255) fileName!: string;
  @IsString() @MinLength(1) @MaxLength(120) sheetName!: string;
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(50) @IsString({ each: true }) headers!: string[];
  @IsArray() @ArrayMaxSize(10000) rows!: string[][];
}

export class RahcomImportedTicketRowDto {
  @IsString() @MinLength(1) @MaxLength(100) ticketCode!: string;
  @IsOptional() @IsString() @MaxLength(100) systemCode?: string;
  @IsOptional() @IsString() @MaxLength(80) province?: string | null;
  @IsOptional() @IsString() @MaxLength(10000) summary?: string;
  @IsOptional() @IsString() @MaxLength(10000) customer?: string;
  @IsOptional() @IsString() @MaxLength(10000) equipment?: string;
  @IsOptional() @IsString() @MaxLength(120) type?: string;
  @IsOptional() @IsString() @MaxLength(120) status?: string;
  @IsOptional() @IsString() @MaxLength(120) priority?: string;
  @IsOptional() @IsString() @MaxLength(200) supportTeam?: string;
  @IsOptional() @IsString() @MaxLength(120) createdOn?: string;
}

export class ImportRahcomTicketsDto {
  @IsString() @MinLength(1) @MaxLength(255) sourceFileName!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10000) @ValidateNested({ each: true }) @Type(() => RahcomImportedTicketRowDto)
  tickets!: RahcomImportedTicketRowDto[];
}

export class UpdateRahcomMemberProvinceDto {
  @IsOptional() @IsString() @MaxLength(80) province?: string | null;
}

export class UpdateRahcomSelectedProvinceDto {
  @IsString() @MinLength(1) @MaxLength(80) province!: string;
}

export class CreateRahcomActivityDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsString() @IsIn(['EMAIL_SENT', 'SYSTEM_VISIT', 'OTHER']) activityType!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity!: number;
  @IsOptional() @IsString() @MaxLength(1000) description?: string | null;
  @IsOptional() @IsString() @MaxLength(100) systemId?: string;
  @IsOptional() @IsString() @MaxLength(200) accompaniedBy?: string | null;
  @IsOptional() @IsString() @MaxLength(200) handedOverTo?: string | null;
  @IsOptional() @IsString() @MaxLength(80) province?: string | null;
}

export class CreateRahcomSystemActivityDto {
  @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
  @IsString() @MinLength(1) @MaxLength(1000) description!: string;
  @IsOptional() @IsString() @MaxLength(200) accompaniedBy?: string | null;
  @IsOptional() @IsString() @MaxLength(200) handedOverTo?: string | null;
}

export class DeleteRahcomSystemsQueryDto {
  @IsOptional() @IsString() @MaxLength(80) province?: string;
}

export class DeleteRahcomSystemsBodyDto {
  @IsOptional() @IsArray() @ArrayMaxSize(10000) @IsString({ each: true }) ids?: string[];
}
