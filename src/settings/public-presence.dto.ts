import { IsIn, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class PublicPresenceDto {
  @IsUUID()
  visitorId!: string;

  @IsUUID()
  sessionId!: string;

  @IsUUID()
  pageViewId!: string;

  @IsString()
  @MaxLength(500)
  @Matches(/^\/(?!\/)/)
  path!: string;

  @IsIn(['ENTER', 'HEARTBEAT', 'EXIT'])
  event!: 'ENTER' | 'HEARTBEAT' | 'EXIT';
}
