import {
  Controller,
  Body,
  Get,
  Param,
  Patch,
  Delete,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import type { AuthenticatedUser } from '../core/auth/strategies/jwt.strategy';
import { NotificationsService } from './notifications.service';
import { AnnouncementReactionDto, CreateAnnouncementCommentDto, CreateAnnouncementDto, UpdateAnnouncementDto } from './dto/create-announcement.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('filter') filter?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notificationsService.list(user, {
      unreadOnly: filter === 'unread',
      limit: limit ? Number(limit) : undefined,
      cursor,
    });
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getSummary(user);
  }

  @Get('announcements/access')
  getAnnouncementAccess(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.getAnnouncementAccess(user);
  }

  @Get('announcements')
  listAnnouncements(@CurrentUser() user: AuthenticatedUser, @Query('management') management?: string) {
    return this.notificationsService.listAnnouncements(user, management === 'true');
  }

  @Post('announcements')
  createAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.notificationsService.createAnnouncement(user, dto);
  }

  @Patch('announcements/:id/archive')
  archiveAnnouncement(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.archiveAnnouncement(user, id);
  }

  @Patch('announcements/:id')
  updateAnnouncement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateAnnouncementDto) {
    return this.notificationsService.updateAnnouncement(user, id, dto);
  }

  @Post('announcements/:id/reactions')
  toggleReaction(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: AnnouncementReactionDto) {
    return this.notificationsService.toggleReaction(user, id, dto.emoji);
  }

  @Post('announcements/:id/comments')
  addComment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateAnnouncementCommentDto) {
    return this.notificationsService.addComment(user, id, dto);
  }

  @Delete('announcements/:id/comments/:commentId')
  deleteComment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('commentId') commentId: string) {
    return this.notificationsService.deleteComment(user, id, commentId);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user);
  }

  @Patch(':id/read')
  markRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.notificationsService.markRead(user, id);
  }
}
