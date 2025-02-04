import { CommandContext } from "../types/bot";

export async function handleError(ctx: CommandContext, error: unknown) {
  console.error('Error:', error);
  
  // Handle FAL API errors
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as { status: number; body?: { detail?: string } };
    
    // Handle specific API errors
    if (apiError.status === 403 && apiError.body?.detail?.includes('Exhausted balance')) {
      await ctx.reply('⚠️ The service is temporarily unavailable. Please try again later or contact @lvc_io');
      return;
    }
  }
  
  // Default error message
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  await ctx.reply(`Error: ${errorMessage}`);
}