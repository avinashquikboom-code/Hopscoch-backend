import prisma from '../../../utils/prisma';
import { WalletTransactionType } from '@prisma/client';
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
   * Top-up wallet balance via Razorpay (Idempotent DB Transaction)
   */
  async creditWalletRazorpay(userId: number, amount: number, razorpayOrderId: string, razorpayPaymentId?: string) {
    if (amount <= 0) {
      throw new AppError('Credit amount must be greater than zero', 400);
    }

    return await prisma.$transaction(async (tx) => {
      // Idempotency check: if already processed for this razorpayOrderId, skip duplicate credit
      const existingTx = await tx.walletTransaction.findFirst({
        where: { razorpayOrderId, type: 'CREDIT_RAZORPAY' },
      });

      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, isActive: true },
        });
      }

      if (existingTx) {
        return wallet;
      }

      const currentBalance = Number(wallet.balance);
      const newBalance = currentBalance + amount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBalance,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'CREDIT_RAZORPAY',
          amount,
          balanceAfter: newBalance,
          razorpayOrderId,
          description: `Razorpay Wallet Load (ID: ${razorpayPaymentId || razorpayOrderId})`,
        },
      });

      return updatedWallet;
    });
  }

  /**
   * Debit wallet balance for an order (Atomic DB Transaction)
   */
  async debitWalletOrder(userId: number, orderId: number, amount: number, txPrisma?: any) {
    if (amount <= 0) {
      throw new AppError('Debit amount must be greater than zero', 400);
    }

    const executeDebit = async (tx: any) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || !wallet.isActive) {
        throw new AppError('Wallet not found or inactive', 404);
      }

      const currentBalance = Number(wallet.balance);
      if (currentBalance < amount) {
        throw new AppError(`Insufficient wallet balance. Available: ₹${currentBalance}, Requested: ₹${amount}`, 400);
      }

      const newBalance = currentBalance - amount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'DEBIT_ORDER',
          amount,
          balanceAfter: newBalance,
          orderId,
          description: `Wallet Payment for Order #${orderId}`,
        },
      });

      return updatedWallet;
    };

    if (txPrisma) {
      return await executeDebit(txPrisma);
    }
    return await prisma.$transaction(async (tx) => await executeDebit(tx));
  }

  /**
   * Credit wallet refund for order cancellation/return
   */
  async refundWalletOrder(userId: number, orderId: number, amount: number) {
    if (amount <= 0) {
      throw new AppError('Refund amount must be greater than zero', 400);
    }

    return await prisma.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { userId, balance: 0, isActive: true },
        });
      }

      const currentBalance = Number(wallet.balance);
      const newBalance = currentBalance + amount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'REFUND_CREDIT',
          amount,
          balanceAfter: newBalance,
          orderId,
          description: `Wallet Refund for Order #${orderId}`,
        },
      });

      return updatedWallet;
    });
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

      const currentBalance = Number(wallet.balance);
      const newBalance = currentBalance + amount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'TOPUP',
          amount,
          balanceAfter: newBalance,
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
  async debitWallet(userId: number, amount: number, type: 'PAYMENT' | 'ADMIN_DEBIT' | 'DEBIT_ORDER', referenceId?: string, description?: string) {
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

      const newBalance = currentBalance - amount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type,
          amount,
          balanceAfter: newBalance,
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
    type: 'TOPUP' | 'REFUND' | 'CASHBACK' | 'ADMIN_CREDIT' | 'CREDIT_RAZORPAY',
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

      const currentBalance = Number(wallet.balance);
      const newBalance = currentBalance + amount;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type,
          amount,
          balanceAfter: newBalance,
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
