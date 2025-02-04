import { CommandContext } from "../types/bot";

export async function handleError(ctx: CommandContext, error: unknown) {
  console.error('Error:', error);
  
  const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
  await ctx.reply(`Error: ${errorMessage}`);
}