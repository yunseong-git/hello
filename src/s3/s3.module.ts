import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { S3Controller } from './s3.controller';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';

@Module({
  imports:[ConfigModule],
  controllers: [S3Controller],
  providers: [
    {
      provide: 'S3_CLIENT',
      useFactory: (configService: ConfigService) => {
        const accessKeyId = configService.get<string>('AWS_ACCESS_KEY');
        const secretAccessKey = configService.get<string>('AWS_SECRET_KEY');
        const region = configService.get<string>('AWS_REGION');

        if (!accessKeyId || !secretAccessKey || !region) {
          throw new Error('missing aws config in .env');
        }
        return new S3Client({
          region,
          credentials: { accessKeyId, secretAccessKey },
        });
      },
      inject: [ConfigService],
    },
    S3Service,
  ],
})
export class S3Module {}
