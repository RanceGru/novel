import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TokenPackage } from './entities/token-package.entity';
import { TokenBalance } from './entities/token-balance.entity';
import { TokenTransaction } from './entities/token-transaction.entity';
import { TokenService } from './token.service';
import { TokenController } from './token.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TokenPackage, TokenBalance, TokenTransaction])],
  controllers: [TokenController],
  providers: [TokenService],
  exports: [TokenService],
})
export class TokenModule {}
