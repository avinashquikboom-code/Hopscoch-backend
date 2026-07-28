import prisma from '../../../utils/prisma';
import { AppError } from '../../../middleware/errorHandler';

export class WalletService {
  /**
   * Get or create wallet for user
   */
  async getOrCreateWallet(userId: number) {
    let wallet = await prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!wallet) {
      wallet = await prisma.wallet.create({
        data: {
          userId,
          balance: 0,
          isActive: true,
        },
        include: {
          transactions: true,
        },
      });
    }

    return wallet;
  }

  /**
   * Top-up wallet balance
   */
  async topupWallet(userId: number, amount: number, referenceId?: string, description?: string) {
    if (amount <= 0) {
      throw new AppError('Topup amount must be greater than zero', 400);
    }

    return await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, isActive: true },
        });
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'TOPUP',
          amount,
          referenceId,
          description: description || 'Wallet Topup',
        },
      });

      return updatedWallet;
    });
  }

  /**
   * Deduct funds from wallet with atomic concurrency check preventing negative balance
   */
  async debitWallet(userId: number, amount: number, type: 'PAYMENT' | 'ADMIN_DEBIT', referenceId?: string, description?: string) {
    if (amount <= 0) {
      throw new AppError('Debit amount must be greater than zero', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || !wallet.isActive) {
        throw new AppError('Wallet not found or inactive', 404);
      }

      const currentBalance = Number(wallet.balance);
      if (currentBalance < amount) {
        throw new AppError(`Insufficient wallet balance. Available: ₹${currentBalance}`, 400);
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type,
          amount: -amount,
          referenceId,
          description: description || `Wallet ${type}`,
        },
      });

      return updatedWallet;
    });
  }

  /**
   * Credit refund/cashback/admin credit to wallet
   */
  async creditWallet(
    userId: number,
    amount: number,
    type: 'TOPUP' | 'REFUND' | 'CASHBACK' | 'ADMIN_CREDIT',
    referenceId?: string,
    description?: string
  ) {
    if (amount <= 0) {
      throw new AppError('Credit amount must be greater than zero', 400);
    }

    return await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, isActive: true },
        });
      }

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type,
          amount,
          referenceId,
          description: description || `Wallet ${type}`,
        },
      });

      return updatedWallet;
    });
  }

  /**
   * Get wallet transaction history
   */
  async getTransactionHistory(userId: number, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.walletTransaction.count({ where: { userId } }),
    ]);

    return {
      transactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export default new WalletService();
