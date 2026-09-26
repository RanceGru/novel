// Token 服务
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenPackage } from './entities/token-package.entity';
import { TokenBalance } from './entities/token-balance.entity';
import { TokenTransaction } from './entities/token-transaction.entity';
import { TOKEN_PACKAGES } from '@novel/shared';

@Injectable()
export class TokenService {
  constructor(
    @InjectRepository(TokenPackage) private pkgRepo: Repository<TokenPackage>,
    @InjectRepository(TokenBalance) private balRepo: Repository<TokenBalance>,
    @InjectRepository(TokenTransaction) private txRepo: Repository<TokenTransaction>,
  ) {}

  /** 获取可购买的 Token 套餐 */
  async getPackages() {
    const packages = await this.pkgRepo.find({ order: { sortOrder: 'ASC' } });
    if (packages.length === 0) {
      // 种子数据
      return this.seedPackages();
    }
    return packages;
  }

  private async seedPackages() {
    for (const pkg of TOKEN_PACKAGES) {
      await this.pkgRepo.save(this.pkgRepo.create({
        name: pkg.name,
        tokenAmount: pkg.tokenAmount,
        price: pkg.price,
        discountLabel: pkg.discountLabel,
        sortOrder: pkg.sortOrder,
      }));
    }
    return this.pkgRepo.find({ order: { sortOrder: 'ASC' } });
  }

  /** 获取 Token 余额 */
  async getBalance(userId: string) {
    let balance = await this.balRepo.findOne({ where: { userId } });
    if (!balance) {
      balance = this.balRepo.create({ userId, purchasedTokensRemaining: 0 });
      await this.balRepo.save(balance);
    }
    return balance;
  }

  /** Token 消费 (先扣配额，再扣购买余额) */
  async consumeTokens(userId: string, bookId: string, chapterId: string, type: string, amount: number) {
    const balance = await this.getBalance(userId);

    // 先记录为配额消费（实际配额判断在 SubscriptionGuard 中）
    const tx = this.txRepo.create({
      userId, bookId, chapterId,
      transactionType: type,
      tokensConsumed: amount,
      source: 'quota',
    });
    await this.txRepo.save(tx);

    // 更新购买余额（如果配额不够会在外部处理）
    if (balance.purchasedTokensRemaining > 0) {
      const deduct = Math.min(balance.purchasedTokensRemaining, amount);
      balance.purchasedTokensRemaining -= deduct;
      balance.lifetimeConsumedTokens += deduct;
      await this.balRepo.save(balance);
    }
  }

  /** 购买 Token 套餐 */
  async purchase(userId: string, packageId: string) {
    const pkg = await this.pkgRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new NotFoundException('套餐不存在');

    const balance = await this.getBalance(userId);
    balance.purchasedTokensRemaining += pkg.tokenAmount;
    balance.lifetimePurchasedTokens += pkg.tokenAmount;
    await this.balRepo.save(balance);

    return { balance, message: `成功购买 ${pkg.tokenAmount.toLocaleString()} Token` };
  }

  /** 获取交易历史 */
  async getTransactions(userId: string, page = 1, limit = 20) {
    const [items, total] = await this.txRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
}
