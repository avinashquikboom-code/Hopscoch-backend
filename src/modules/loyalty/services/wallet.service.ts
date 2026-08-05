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

  // ─────────────────────────────────────────────────────────────────────────
  // WITHDRAWAL METHODS
  // ─────────────────────────────────────────────────────────────────────────

  static readonly MIN_WITHDRAWAL = 100; // ₹100 minimum

  /**
   * Customer requests withdrawal — immediately reserves (debits) balance to prevent double-spending.
   * Creates WalletWithdrawal(PENDING) + WalletTransaction(WITHDRAWAL_REQUEST) atomically.
   */
  async requestWithdrawal(
    userId: number,
    amount: number,
    bankAccountName: string,
    bankAccountNumber: string,
    bankIFSC: string,
  ) {
    if (amount < WalletService.MIN_WITHDRAWAL) {
      throw new AppError(`Minimum withdrawal amount is ₹${WalletService.MIN_WITHDRAWAL}`, 400);
    }
    if (!bankAccountName?.trim() || !bankAccountNumber?.trim() || !bankIFSC?.trim()) {
      throw new AppError('Bank account name, account number, and IFSC are required', 400);
    }
    // Basic IFSC format validation: 4 alpha + 0 + 6 alphanumeric
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bankIFSC.toUpperCase())) {
      throw new AppError('Invalid IFSC code format (e.g. HDFC0001234)', 400);
    }

    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || !wallet.isActive) {
        throw new AppError('Wallet not found or inactive', 404);
      }

      const currentBalance = Number(wallet.balance);
      if (currentBalance < amount) {
        throw new AppError(
          `Insufficient balance. Available: ₹${currentBalance.toFixed(2)}, Requested: ₹${amount}`,
          400,
        );
      }

      // Reserve the amount immediately — deduct from spendable balance
      const newBalance = currentBalance - amount;
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Log reservation as WITHDRAWAL_REQUEST transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId,
          type: 'WITHDRAWAL_REQUEST',
          amount,
          balanceAfter: newBalance,
          description: `Withdrawal request of ₹${amount} (pending admin approval)`,
        },
      });

      // Create withdrawal record
      const withdrawal = await tx.walletWithdrawal.create({
        data: {
          walletId: wallet.id,
          userId,
          amount,
          bankAccountName: bankAccountName.trim(),
          bankAccountNumber: bankAccountNumber.trim(),
          bankIFSC: bankIFSC.toUpperCase().trim(),
        },
      });

      return { withdrawal, newBalance };
    });
  }

  /**
   * Customer's own withdrawal history
   */
  async getWithdrawals(userId: number) {
    return await prisma.walletWithdrawal.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  /**
   * Admin: list withdrawals, optionally filtered by status
   */
  async adminListWithdrawals(status?: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};
    const [withdrawals, total] = await Promise.all([
      prisma.walletWithdrawal.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
      prisma.walletWithdrawal.count({ where }),
    ]);
    return { withdrawals, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Admin: approve a withdrawal (acknowledges intent to process — balance already reserved)
   */
  async adminApproveWithdrawal(withdrawalId: number, adminUserId: number) {
    const withdrawal = await prisma.walletWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AppError('Withdrawal request not found', 404);
    if (withdrawal.status !== 'PENDING') {
      throw new AppError(`Cannot approve a withdrawal in ${withdrawal.status} status`, 400);
    }
    return await prisma.walletWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'APPROVED',
        processedBy: adminUserId,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Admin: mark withdrawal COMPLETED once the actual bank transfer is done
   */
  async adminCompleteWithdrawal(withdrawalId: number, adminUserId: number, adminNote?: string) {
    const withdrawal = await prisma.walletWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AppError('Withdrawal request not found', 404);
    if (withdrawal.status !== 'APPROVED') {
      throw new AppError(`Can only complete an APPROVED withdrawal, current status: ${withdrawal.status}`, 400);
    }
    return await prisma.walletWithdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'COMPLETED',
        processedBy: adminUserId,
        processedAt: new Date(),
        adminNote: adminNote?.trim() || withdrawal.adminNote,
      },
    });
  }

  /**
   * Admin: reject a withdrawal — atomically refunds reserved amount back to wallet.
   */
  async adminRejectWithdrawal(withdrawalId: number, adminUserId: number, adminNote: string) {
    if (!adminNote?.trim()) {
      throw new AppError('Rejection reason (adminNote) is required', 400);
    }
    const withdrawal = await prisma.walletWithdrawal.findUnique({ where: { id: withdrawalId } });
    if (!withdrawal) throw new AppError('Withdrawal request not found', 404);
    if (!['PENDING', 'APPROVED'].includes(withdrawal.status)) {
      throw new AppError(`Cannot reject a withdrawal in ${withdrawal.status} status`, 400);
    }

    return await prisma.$transaction(async (tx) => {
      // Refund reserved amount back to wallet
      const wallet = await tx.wallet.findUnique({ where: { id: withdrawal.walletId } });
      if (!wallet) throw new AppError('Wallet not found', 404);

      const newBalance = Number(wallet.balance) + Number(withdrawal.amount);
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: newBalance },
      });

      // Log refund as WITHDRAWAL_REJECTED transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          userId: withdrawal.userId,
          type: 'WITHDRAWAL_REJECTED',
          amount: Number(withdrawal.amount),
          balanceAfter: newBalance,
          description: `Withdrawal ₹${withdrawal.amount} rejected: ${adminNote.trim()}`,
        },
      });

      // Mark withdrawal as rejected
      const updated = await tx.walletWithdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'REJECTED',
          processedBy: adminUserId,
          processedAt: new Date(),
          adminNote: adminNote.trim(),
        },
      });

      return updated;
    });
  }
}

export default new WalletService();
