import { WarehouseStatus } from '@prisma/client';
import prisma from '../../../utils/prisma';

export async function createWarehouse(data: {
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  country?: string;
  pincode: string;
  phone: string;
  email: string;
  shiprocketPickupName?: string;
  isDefault?: boolean;
}) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.warehouse.count();

    // First warehouse is automatically the default (single-tenant today)
    const isDefault = count === 0 ? true : !!data.isDefault;

    if (isDefault && count > 0) {
      await tx.warehouse.updateMany({ data: { isDefault: false } });
    }

    return tx.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country || 'India',
        pincode: data.pincode,
        phone: data.phone,
        email: data.email,
        shiprocketPickupName: data.shiprocketPickupName,
        isDefault,
        status: WarehouseStatus.ACTIVE,
      },
    });
  });
}

export async function updateWarehouse(
  id: number,
  data: Partial<{
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    pincode: string;
    phone: string;
    email: string;
    shiprocketPickupName: string;
    status: WarehouseStatus;
  }>
) {
  return prisma.warehouse.update({
    where: { id },
    data,
  });
}

export async function setDefaultWarehouse(id: number) {
  return prisma.$transaction(async (tx) => {
    const wh = await tx.warehouse.findUniqueOrThrow({ where: { id } });
    if (wh.status !== WarehouseStatus.ACTIVE) {
      throw new Error('Inactive warehouse cannot be default');
    }
    await tx.warehouse.updateMany({ data: { isDefault: false } });
    return tx.warehouse.update({ where: { id }, data: { isDefault: true } });
  });
}

export async function listWarehouses() {
  return prisma.warehouse.findMany({
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });
}

export async function getWarehouseById(id: number) {
  return prisma.warehouse.findUniqueOrThrow({
    where: { id },
    include: { _count: { select: { inventory: true } } },
  });
}

// ── Used by shiprocket.service — all shipments originate from default warehouse
export async function getDefaultWarehouse() {
  const wh = await prisma.warehouse.findFirst({
    where: { isDefault: true, status: WarehouseStatus.ACTIVE },
  });
  if (!wh) {
    throw new Error('No active default warehouse configured');
  }
  return wh;
}

// Pickup location nickname for Shiprocket order creation.
// Falls back to warehouse code if a nickname isn't set.
export async function getShiprocketPickupLocation(): Promise<string> {
  const wh = await getDefaultWarehouse();
  return wh.shiprocketPickupName ?? wh.code;
}
