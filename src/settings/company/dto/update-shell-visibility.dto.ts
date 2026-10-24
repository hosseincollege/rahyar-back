import { IsObject, IsOptional } from 'class-validator';

export class UpdateShellVisibilityDto {
  @IsOptional()
  @IsObject()
  shellVisibility?: Record<string, unknown>;
}
