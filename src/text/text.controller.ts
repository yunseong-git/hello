import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { TextService } from './text.service';
import { CreateTextDto } from './dto/create-text.dto';
import { UpdateTextDto } from './dto/update-text.dto';

@Controller('text')
export class TextController {
  constructor(private readonly textService: TextService) {}

  @Get()
  findAll() {
    return this.textService.findAll();
  }

}
