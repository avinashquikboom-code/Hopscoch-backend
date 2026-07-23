import prisma from '../../../utils/prisma';
import { AppError } from '../../../middleware/errorHandler';

export interface CreateAddressDto {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country?: string;
  type?: string; // home, work, other
  isDefault?: boolean;
}

export interface UpdateAddressDto extends Partial<CreateAddressDto> {}

export class AddressService {
  async getUserAddresses(userId: number) {
    return prisma.address.findMany({
      where: {
        userId,
        deletedAt: null,
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getAddressById(userId: number, addressId: number) {
    const address = await prisma.address.findFirst({
      where: {
        id: addressId,
        userId,
        deletedAt: null,
      },
    });

    if (!address) {
      throw new AppError('Address not found', 404);
    }

    return address;
  }

  async createAddress(userId: number, data: CreateAddressDto) {
    const existingCount = await prisma.address.count({
      where: { userId, deletedAt: null },
    });

    const isFirstAddress = existingCount === 0;
    const setAsDefault = data.isDefault || isFirstAddress;

    if (setAsDefault) {
      await prisma.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: {
        userId,
        fullName: data.fullName,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2 || '',
        city: data.city,
        state: data.state,
        pincode: data.pincode,
        country: data.country || 'India',
        label: data.type || 'home',
        isDefault: setAsDefault,
      },
    });
  }

  async updateAddress(userId: number, addressId: number, data: UpdateAddressDto) {
    await this.getAddressById(userId, addressId);

    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({
      where: { id: addressId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.line1 !== undefined && { line1: data.line1 }),
        ...(data.line2 !== undefined && { line2: data.line2 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.pincode !== undefined && { pincode: data.pincode }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.type !== undefined && { label: data.type }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
  }

  async deleteAddress(userId: number, addressId: number) {
    await this.getAddressById(userId, addressId);

    await prisma.address.update({
      where: { id: addressId },
      data: { deletedAt: new Date(), isDefault: false },
    });

    // If deleted address was default, promote another address to default
    const remaining = await prisma.address.findFirst({
      where: { userId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (remaining) {
      await prisma.address.update({
        where: { id: remaining.id },
        data: { isDefault: true },
      });
    }

    return { message: 'Address deleted successfully' };
  }

  async setDefaultAddress(userId: number, addressId: number) {
    await this.getAddressById(userId, addressId);

    await prisma.address.updateMany({
      where: { userId, deletedAt: null },
      data: { isDefault: false },
    });

    return prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  }
}

export default new AddressService();
