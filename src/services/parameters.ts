import { PrismaClient, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export class ParametersService {
  static async saveParameters(params: Record<string, unknown>) {
    try {
      return await prisma.userParameters.upsert({
        where: {
          userId: params.userId as string,
        },
        update: {
          params: params as Prisma.InputJsonValue,
        },
        create: {
          userId: params.userId as string,
          params: params as Prisma.InputJsonValue,
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