import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateVoucherLineDto {
  @IsString() accountId: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) debit: number;
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) credit: number;
}

export class CreateVoucherDto {
  @IsDateString() date: string;
  @IsString() @MaxLength(500) description: string;
  @IsArray() @ArrayMinSize(2) @ValidateNested({ each: true }) @Type(() => CreateVoucherLineDto) lines: CreateVoucherLineDto[];
}
