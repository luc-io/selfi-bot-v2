import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class ParametersService {
  static async updateUserParameters(
    userId: string,
    params: Record<string, unknown>
  ) {
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
  }

  static async getUserParameters(userId: string) {
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
  }
}