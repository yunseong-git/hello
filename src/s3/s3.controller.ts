import { Controller, Post, Body, Get, Param, Query } from '@nestjs/common';
import { S3Service } from './s3.service';
import { FetchDataDto } from './dto/fetch-data.dto';

@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post()
  async uploadData(@Body() dto: FetchDataDto) {
    const data = await this.s3Service.fetchDataFromBinance(dto);
    const csv = this.s3Service.transToCSV(data, dto.symbol);
    const result = await this.s3Service.uploadToS3(csv, dto);
    return { location: result };
  }

  @Get(':interval/highest')
  getHighestPrice(
    @Param('interval') interval: 'weekly' | 'monthly',
    @Query('symbol') symbol: string,
  ) {
    return this.s3Service.getHighestPrice(interval, symbol);
  }

  @Get(':interval/top-volume')
  getTop5ByVolume(
    @Param('interval') interval: 'weekly' | 'monthly',
    @Query('symbol') symbol: string,
  ) {
    return this.s3Service.getTopVolume(interval, symbol);
  }

  @Get(':interval/top-volatile')
  getTop5ByVolatility(
    @Param('interval') interval: 'weekly' | 'monthly',
    @Query('symbol') symbol: string,
  ) {
    return this.s3Service.getTopVolatility(interval, symbol);
  }
}
