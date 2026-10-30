import { IsString, MaxLength } from 'class-validator';

export class UpdateVisitorDeviceLabelDto {
  @IsString()
  @MaxLength(80)
  label!: string;
}
