import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../core/auth/strategies/jwt.strategy';
import { ImportProjectsDto } from './dto/import-projects.dto';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.create(createProjectDto, user);
  }

  @Post('import')
  import(@Body() dto: ImportProjectsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.import(dto.projects, user);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(user);
  }

  @Get('support/accessible')
  findSupportProjects(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findSupportProjects(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findOne(id, user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateProjectDto: UpdateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.update(id, updateProjectDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.remove(id, user);
  }
}
