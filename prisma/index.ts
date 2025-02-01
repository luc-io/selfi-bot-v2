import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  // Increase transaction timeout to 10 seconds
  transactionOptions: {
    maxWait: 10000, // maximum time to wait for transaction
    timeout: 10000   // maximum time for transaction to complete
  }
})

export default prisma