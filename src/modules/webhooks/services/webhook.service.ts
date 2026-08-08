import { AppError } from '../../../middleware/errorHandler';
import { logger } from '../../../utils/logger';
import prisma from '../../../utils/prisma';
import razorpayClient from '../../payments/services/razorpay.client';
import { confirmSale, releaseReservation } from '../../inventory/services/inventory.service';
import { UnifiedNotificationService } from '../../notification/services/unified-notification.service';
import ShipmentService from '../../shipments/services/shipment.service';
import { WalletService } from '../../loyalty/services/wallet.service';
import { RewardService } from '../../loyalty/services/reward.service';

const walletService = new WalletService();
const rewardService = new RewardService();

export class WebhookService {
  /**
   * Main entry point for processing Razorpay webhook events
   */
  static async processEvent(rawBody: string | Buffer, signature: string, payload: any) {
    const startTime = Date.now();

    // 1. Verify Signature
    const isValidSignature = await razorpayClient.verifyWebhookSignature(rawBody, signature);
    if (!isValidSignature) {
      logger.warn('Razorpay webhook signature verification failed');
      throw new AppError('Invalid webhook signature', 401);
    }

    const { event } = payload || {};
    if (!event) {
      throw new AppError('Invalid webhook payload: missing event name', 400);
    }

    // 2. Extract Event ID & Entity references
    const eventId =
      payload.event_id ||
      payload.id ||
      `${event}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const eventEntity =
      payload.payload?.payment?.entity ||
      payload.payload?.refund?.entity ||
      payload.payload?.order?.entity ||
      {};

    const paymentId =
      eventEntity.id && String(eventEntity.id).startsWith('pay_')
        ? String(eventEntity.id)
        : payload.payload?.payment?.entity?.id || null;
    const razorpayOrderId =
      eventEntity.order_id || payload.payload?.order?.entity?.id || null;
    const refundId =
      eventEntity.id && String(eventEntity.id).startsWith('rfnd_')
        ? String(eventEntity.id)
        : payload.payload?.refund?.entity?.id || null;

    // 3. Idempotency Check: if event already processed successfully, skip re-execution
    const existingLog = await prisma.webhookLog.findUnique({
      where: { eventId },
    });

    if (existingLog && existingLog.status === 'SUCCESS') {
      logger.info(`Idempotent webhook skipped: eventId ${eventId} already processed.`);
      return {
        success: true,
        message: 'Event already processed',
        eventId,
        skipped: true,
      };
    }

    let status = 'SUCCESS';
    let errorMessage: string | null = null;

    try {
      logger.info(`Handling Razorpay Webhook Event [${event}] eventId=${eventId}`);

      switch (event) {
        case 'payment.captured':
        case 'order.paid':
          await this.handlePaymentCaptured(payload);
          break;
        case 'payment.authorized':
          await this.handlePaymentAuthorized(payload);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload);
          break;
        case 'refund.created':
          await this.handleRefundCreated(payload);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(payload);
          break;
        case 'refund.failed':
          await this.handleRefundFailed(payload);
          break;
        default:
          logger.info(`Unhandled Razorpay webhook event: ${event}`);
          status = 'IGNORED';
          break;
      }
    } catch (err: any) {
      status = 'FAILED';
      errorMessage = err?.message || String(err);
      logger.error(`Error processing webhook event ${event} (eventId=${eventId}): ${errorMessage}`);
    }

    const durationMs = Date.now() - startTime;

    // 4. Save Webhook Execution Log in DB
    try {
      await prisma.webhookLog.upsert({
        where: { eventId },
        update: {
          status,
          errorMessage,
          durationMs,
          payload,
        },
        create: {
          eventId,
          eventType: event,
          paymentId: paymentId || undefined,
          orderId: razorpayOrderId || undefined,
          refundId: refundId || undefined,
          status,
          payload,
          errorMessage,
          durationMs,
        },
      });
    } catch (logErr) {
      logger.warn(`Failed to save WebhookLog: ${logErr}`);
    }

    if (status === 'FAILED') {
      throw new AppError(errorMessage || 'Webhook event processing failed', 500);
    }

    return {
      success: true,
      message: `Event ${event} processed successfully`,
      eventId,
      durationMs,
    };
  }

  /**
   * Handle payment.captured / order.paid
   */
  private static async handlePaymentCaptured(payload: any) {
    const paymentEntity = payload.payload?.payment?.entity || {};
    const razorpayOrderId = paymentEntity.order_id || payload.payload?.order?.entity?.id;
    const razorpayPaymentId = paymentEntity.id;

    if (!razorpayOrderId) {
      logger.warn('payment.captured webhook missing order_id in payload');
      return;
    }

    // Find payment by razorpayOrderId or providerRef
    let payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayOrderId: String(razorpayOrderId) },
          { providerRef: String(razorpayPaymentId) },
        ],
      },
      include: { order: { include: { items: true } } },
    });

    if (!payment && razorpayOrderId) {
      const order = await prisma.order.findFirst({
        where: {
          OR: [
            { payment: { razorpayOrderId: String(razorpayOrderId) } },
            { id: isNaN(Number(razorpayOrderId)) ? -1 : Number(razorpayOrderId) },
          ],
        },
        include: { items: true },
      });

      if (order) {
        payment = await prisma.payment.upsert({
          where: { orderId: order.id },
          update: {
            status: 'PAID',
            razorpayPaymentId: String(razorpayPaymentId),
            providerRef: String(razorpayPaymentId),
            razorpayOrderId: String(razorpayOrderId),
          },
          create: {
            orderId: order.id,
            method: 'RAZORPAY',
            status: 'PAID',
            amount: order.totalAmount,
            razorpayPaymentId: String(razorpayPaymentId),
            providerRef: String(razorpayPaymentId),
            razorpayOrderId: String(razorpayOrderId),
          },
          include: { order: { include: { items: true } } },
        });
      }
    }

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          razorpayPaymentId: String(razorpayPaymentId),
          providerRef: String(razorpayPaymentId),
        },
      });

      if (payment.orderId) {
        const updatedOrder = await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'CONFIRMED',
            timeline: {
              create: {
                status: 'CONFIRMED',
                note: `Payment captured via Razorpay (Payment ID: ${razorpayPaymentId})`,
              },
            },
          },
          include: { items: true },
        });

        // Reduce/confirm Inventory
        try {
          await confirmSale(
            updatedOrder.items.map((i: any) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            })),
            String(updatedOrder.id)
          );
        } catch (invErr) {
          logger.warn(`Confirm sale inventory update warning: ${invErr}`);
        }

        // Auto-create Shiprocket Shipment if configured
        try {
          await ShipmentService.createShipment(updatedOrder.id);
        } catch (shipErr: any) {
          logger.warn(`Auto-shipment creation skipped/warned: ${shipErr?.message || shipErr}`);
        }

        // Send Customer Notifications
        if (updatedOrder.userId) {
          try {
            await UnifiedNotificationService.sendNotificationToUser(updatedOrder.userId, {
              title: 'Order Confirmed! 🎉',
              body: `Your payment of ₹${paymentEntity.amount ? paymentEntity.amount / 100 : updatedOrder.totalAmount} for Order #${updatedOrder.id} was successful!`,
              type: 'ORDER',
              data: { orderId: String(updatedOrder.id), status: 'CONFIRMED' },
            });
          } catch (notifErr) {
            logger.warn(`Notification send failed: ${notifErr}`);
          }
        }
      }
    }
  }

  /**
   * Handle payment.authorized
   */
  private static async handlePaymentAuthorized(payload: any) {
    const paymentEntity = payload.payload?.payment?.entity || {};
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;

    if (!razorpayOrderId) return;

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: String(razorpayOrderId) },
    });

    if (payment && payment.status === 'PENDING') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'AUTHORIZED',
          razorpayPaymentId: String(razorpayPaymentId),
          providerRef: String(razorpayPaymentId),
        },
      });

      if (payment.orderId) {
        await prisma.orderTimelineEvent.create({
          data: {
            orderId: payment.orderId,
            status: 'PENDING',
            note: `Payment authorized by Razorpay (Payment ID: ${razorpayPaymentId})`,
          },
        });
      }
    }
  }

  /**
   * Handle payment.failed
   */
  private static async handlePaymentFailed(payload: any) {
    const paymentEntity = payload.payload?.payment?.entity || {};
    const razorpayOrderId = paymentEntity.order_id;
    const razorpayPaymentId = paymentEntity.id;
    const errorDescription = paymentEntity.error_description || 'Payment failed on Razorpay';

    if (!razorpayOrderId) return;

    const payment = await prisma.payment.findFirst({
      where: { razorpayOrderId: String(razorpayOrderId) },
      include: { order: { include: { items: true } } },
    });

    if (payment && payment.status !== 'PAID') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
          razorpayPaymentId: String(razorpayPaymentId),
        },
      });

      if (payment.orderId) {
        const order = await prisma.order.update({
          where: { id: payment.orderId },
          data: {
            status: 'CANCELLED',
            timeline: {
              create: {
                status: 'CANCELLED',
                note: `Payment failed: ${errorDescription}`,
              },
            },
          },
          include: { items: true },
        });

        // Release inventory reservation
        try {
          await releaseReservation(
            order.items.map((i: any) => ({
              variantId: i.variantId,
              quantity: i.quantity,
            })),
            String(order.id)
          );
        } catch (invErr) {
          logger.warn(`Release inventory reservation warning: ${invErr}`);
        }

        // Notify user of payment failure
        if (order.userId) {
          try {
            await UnifiedNotificationService.sendNotificationToUser(order.userId, {
              title: 'Payment Failed ⚠️',
              body: `Payment for Order #${order.id} failed: ${errorDescription}. Please try again.`,
              type: 'ORDER',
              data: { orderId: String(order.id), status: 'FAILED' },
            });
          } catch (_) {}
        }

        // Notify Admins of payment failure
        try {
          await UnifiedNotificationService.notifyAdmins({
            title: 'Payment Failure Alert ⚠️',
            body: `Payment failed for Order #${order.orderNumber || order.id}: ${errorDescription}`,
            type: 'SYSTEM',
            data: { orderId: String(order.id), status: 'FAILED' },
          });
        } catch (_) {}
      }
    }
  }

  /**
   * Handle refund.created
   */
  private static async handleRefundCreated(payload: any) {
    const refundEntity = payload.payload?.refund?.entity || {};
    const razorpayPaymentId = refundEntity.payment_id;
    const refundId = refundEntity.id;
    const refundAmount = refundEntity.amount ? refundEntity.amount / 100 : 0; // INR

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayPaymentId: String(razorpayPaymentId) },
          { providerRef: String(razorpayPaymentId) },
        ],
      },
      include: { order: true },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundId: String(refundId),
          status: 'PARTIALLY_REFUNDED',
        },
      });

      if (payment.orderId) {
        await prisma.orderTimelineEvent.create({
          data: {
            orderId: payment.orderId,
            status: payment.order?.status || 'CONFIRMED',
            note: `Refund initiated on Razorpay: ₹${refundAmount} (Refund ID: ${refundId})`,
          },
        });

        if (payment.order?.userId) {
          try {
            await UnifiedNotificationService.sendNotificationToUser(payment.order.userId, {
              title: 'Refund Initiated 💸',
              body: `A refund of ₹${refundAmount} has been initiated for Order #${payment.orderId}.`,
              type: 'ORDER',
              data: { orderId: String(payment.orderId), refundId: String(refundId) },
            });
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Handle refund.processed
   */
  private static async handleRefundProcessed(payload: any) {
    const refundEntity = payload.payload?.refund?.entity || {};
    const razorpayPaymentId = refundEntity.payment_id;
    const refundId = refundEntity.id;
    const refundAmount = refundEntity.amount ? refundEntity.amount / 100 : 0;

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayPaymentId: String(razorpayPaymentId) },
          { providerRef: String(razorpayPaymentId) },
        ],
      },
      include: { order: true },
    });

    if (payment) {
      const currentRefunded = Number(payment.refundedAmount || 0);
      const newTotalRefunded = currentRefunded + refundAmount;
      const totalPaymentAmount = Number(payment.amount || 0);
      const isFullRefund = newTotalRefunded >= totalPaymentAmount;

      const updatedPayment = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: newTotalRefunded,
          status: isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
          refundId: String(refundId),
        },
        include: { order: true },
      });

      if (payment.orderId && payment.order) {
        if (isFullRefund) {
          await prisma.order.update({
            where: { id: payment.orderId },
            data: {
              status: 'REFUNDED',
              timeline: {
                create: {
                  status: 'REFUNDED',
                  note: `Full refund completed via Razorpay: ₹${refundAmount} (Refund ID: ${refundId})`,
                },
              },
            },
          });
        } else {
          await prisma.orderTimelineEvent.create({
            data: {
              orderId: payment.orderId,
              status: payment.order.status,
              note: `Partial refund processed: ₹${refundAmount} (Refund ID: ${refundId})`,
            },
          });
        }

        // Optional Wallet / Rewards sync if enabled
        if (payment.order.userId) {
          try {
            await walletService.topupWallet(
              payment.order.userId,
              refundAmount,
              String(refundId),
              `Refund credit for Order #${payment.orderId}`
            );
          } catch (wErr) {
            logger.info(`Wallet credit skipped/not applied: ${wErr}`);
          }

          try {
            // Reverse proportionate reward points if earned
            const pointsToDeduct = Math.floor(refundAmount / 10);
            if (pointsToDeduct > 0) {
              await rewardService.addPoints(
                payment.order.userId,
                -pointsToDeduct,
                'REVERSED',
                `Reward points reversed for refund on Order #${payment.orderId}`,
                String(payment.orderId)
              );
            }
          } catch (rErr) {
            logger.info(`Reward point reversal skipped/not applied: ${rErr}`);
          }

          try {
            await UnifiedNotificationService.sendNotificationToUser(payment.order.userId, {
              title: 'Refund Completed! ✅',
              body: `Your refund of ₹${refundAmount} for Order #${payment.orderId} has been successfully processed!`,
              type: 'ORDER',
              data: { orderId: String(payment.orderId), status: 'REFUNDED', amount: String(refundAmount) },
            });
          } catch (_) {}
        }
      }
    }
  }

  /**
   * Handle refund.failed
   */
  private static async handleRefundFailed(payload: any) {
    const refundEntity = payload.payload?.refund?.entity || {};
    const razorpayPaymentId = refundEntity.payment_id;
    const refundId = refundEntity.id;

    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayPaymentId: String(razorpayPaymentId) },
          { providerRef: String(razorpayPaymentId) },
        ],
      },
      include: { order: true },
    });

    if (payment && payment.orderId) {
      await prisma.orderTimelineEvent.create({
        data: {
          orderId: payment.orderId,
          status: payment.order?.status || 'CONFIRMED',
          note: `Refund failed on Razorpay (Refund ID: ${refundId})`,
        },
      });

      if (payment.order?.userId) {
        try {
          await UnifiedNotificationService.sendNotificationToUser(payment.order.userId, {
            title: 'Refund Issue ⚠️',
            body: `There was an issue processing your refund for Order #${payment.orderId}. Customer support has been notified.`,
            type: 'ORDER',
            data: { orderId: String(payment.orderId) },
          });
        } catch (_) {}
      }
    }
  }

  /**
   * Admin Panel: Get paginated webhook event logs
   */
  static async getWebhookLogs(params: {
    page?: number;
    limit?: number;
    eventType?: string;
    status?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.eventType) where.eventType = params.eventType;
    if (params.status) where.status = params.status;

    const [logs, total] = await Promise.all([
      prisma.webhookLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.webhookLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
