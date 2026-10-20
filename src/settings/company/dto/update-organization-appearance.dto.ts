import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

const accentPresets = ['blue', 'green', 'red', 'amber', 'violet', 'custom'];
const calendarSystems = ['persian', 'islamic', 'gregorian'];

export class UpdateOrganizationAppearanceDto {
  @IsString()
  @IsIn(accentPresets)
  accentPreset: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentLightColor: string;

  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  accentDarkColor: string;

  @IsString()
  @IsIn(['NAVY', 'GRAY', 'THEME'])
  backgroundStyle: string;

  @IsString()
  @MaxLength(100)
  timezone: string;

  @IsString()
  @IsIn(calendarSystems)
  calendar: string;
}
