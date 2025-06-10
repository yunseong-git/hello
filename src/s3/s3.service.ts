import { Inject, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { FetchDataDto, BinanceIntervals } from './dto/fetch-data.dto';
import axios from 'axios';

import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryResultsCommand,
} from '@aws-sdk/client-athena';

@Injectable()
export class S3Service {
  private readonly bucket: string;
  private readonly database = 'crypto_db';
  private readonly outputLocation = 's3://jysawsbucket/query-result/';

  private readonly athena = new AthenaClient({
    region: 'ap-southeast-2',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY!,
      secretAccessKey: process.env.AWS_SECRET_KEY!,
    },
  });

  constructor(
    @Inject('S3_CLIENT') private readonly s3: S3Client,
    private readonly configService: ConfigService,
  ) {
    const bucket = this.configService.get<string>('AWS_BUCKET_NAME');
    if (!bucket) throw new Error('missing bucket name in .env');
    this.bucket = bucket;
  }

  async fetchDataFromBinance(dto: FetchDataDto) {
    const { symbol, time, interval, limit } = dto;
    const endTime = time.getTime(); // 밀리초
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}&endTime=${endTime}`;
    const res = await axios.get(url);
    return res.data;
  }

  transToCSV(data: any[], symbol: string): string {
    const rows = data.map((row) => {
      return `${new Date(row[0]).toISOString()},${row[1]},${row[2]},${row[3]},${row[4]},${row[5]}`;
    });
    return `date,open,high,low,close,volume\n${rows.join('\n')}`;
  }

  async uploadToS3(csv: string, dto: FetchDataDto) {
    const { symbol, time, interval } = dto;

    // 기본 세팅
    let level = '';
    let partitionType = '';
    let partitionValue = '';

    const yyyy = time.getFullYear();
    const mm = String(time.getMonth() + 1).padStart(2, '0');
    const dd = String(time.getDate()).padStart(2, '0');

    switch (interval) {
      case BinanceIntervals.ONE_MIN:
        level = 'daily';
        partitionType = 'date';
        partitionValue = `${yyyy}-${mm}-${dd}`;
        break;

      case BinanceIntervals.ONE_HOUR:
        level = 'weekly';
        partitionType = 'week';
        // 월 기준 주차 계산 (ex. 2024-06-1)
        const firstDay = new Date(yyyy, time.getMonth(), 1).getDay();
        const offset = time.getDate() + firstDay - 1;
        const weekIndex = Math.floor(offset / 7) + 1;
        partitionValue = `${yyyy}-${mm}-${weekIndex}`;
        break;

      case BinanceIntervals.ONE_DAY:
        level = 'monthly';
        partitionType = 'month';
        partitionValue = `${yyyy}-${mm}`;
        break;

      default:
        throw new Error(`Unsupported interval: ${interval}`);
    }

    const key = `crypto/level=${level}/symbol=${symbol.toLowerCase()}/${partitionType}=${partitionValue}/${symbol}.csv`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: csv,
        ContentType: 'text/csv',
      }),
    );

    return `s3://${this.bucket}/${key}`;
  }

  private async executeAthenaQuery(query: string) {
    const startCommand = new StartQueryExecutionCommand({
      QueryString: query,
      QueryExecutionContext: { Database: this.database },
      ResultConfiguration: { OutputLocation: this.outputLocation },
    });

    const startResult = await this.athena.send(startCommand);
    const queryExecutionId = startResult.QueryExecutionId!;

    // Wait for result (간단화를 위해 polling 생략)
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const resultCommand = new GetQueryResultsCommand({
      QueryExecutionId: queryExecutionId,
    });

    const result = await this.athena.send(resultCommand);
    return result.ResultSet?.Rows?.slice(1); // Skip header
  }

  async getHighestPrice(interval: string, symbol: string) {
    const table = `crypto_level_${interval}`;
    const query = `
      SELECT date, high
      FROM ${table}
      WHERE symbol = '${symbol}'
      ORDER BY CAST(high AS DOUBLE) DESC
      LIMIT 1;
    `;
    return await this.executeAthenaQuery(query);
  }

  async getTopVolume(interval: string, symbol: string) {
    const table = `crypto_level_${interval}`;
    const query = `
      SELECT date, volume
      FROM ${table}
      WHERE symbol = '${symbol}'
      ORDER BY CAST(volume AS DOUBLE) DESC
      LIMIT 5;
    `;
    return await this.executeAthenaQuery(query);
  }

  async getTopVolatility(interval: string, symbol: string) {
    const table = `crypto_level_${interval}`;
    const query = `
      SELECT date, CAST(high AS DOUBLE) - CAST(low AS DOUBLE) AS volatility
      FROM ${table}
      WHERE symbol = '${symbol}'
      ORDER BY volatility DESC
      LIMIT 5;
    `;
    return await this.executeAthenaQuery(query);
  }
}
