import { IsNotEmpty, IsEnum, IsDate, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum BinanceIntervals {
  ONE_MIN = '1m',
  ONE_HOUR = '1h',
  ONE_DAY = '1d',
}

export enum CryptoSymbols {
  BTCUSDT = 'BTCUSDT',
  ETHUSDT = 'ETHUSDT',
  DOGEUSDT = 'DOGEUSDT',
}

export class FetchDataDto {
  @IsNotEmpty()
  @IsEnum(CryptoSymbols)
  symbol: CryptoSymbols;

  @IsNotEmpty()
  @Type(() => Date)
  @IsDate()
  time: Date;

  @IsNotEmpty()
  @IsEnum(BinanceIntervals)
  interval: BinanceIntervals;

  @IsNotEmpty()
  @Max(1000)
  limit: number;
}