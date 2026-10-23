import { IsDateString, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export class CreateBusinessTripRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  destination: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  purpose: string;

  @IsDateString()
  startAt: string;

  @IsDateString()
  endAt: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  estimatedCost?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/)
  currency?: string;
}
