import { PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

export const updateUserParameters = async (
  userId: string,
  params: Record<string, unknown>
) => {
  try {
    return await prisma.userParameters.upsert({
      where: {
        userId,
      },
      update: {
        params: params as Prisma.JsonValue,
      },
      create: {
        userId,
        params: params as Prisma.JsonValue,
      },
    });
  } catch (error) {
    console.error('Error updating user parameters:', error);
    throw error;
  }
};

export const getUserParameters = async (userId: string) => {
  try {
    return await prisma.userParameters.findUnique({
      where: {
        userId,
      },
    });
  } catch (error) {
    console.error('Error getting user parameters:', error);
    throw error;
  }
};