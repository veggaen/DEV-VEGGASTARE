/** @fileOverview Scoped message mutations share one transactional authorization boundary. @stability active */
import { writeMessage } from '@/lib/message-writes';
type Context = { params: Promise<{ messageId: string }> };
export async function PATCH(request: Request, { params }: Context) {
  return writeMessage(request, 'edit', (await params).messageId);
}
export async function DELETE(request: Request, { params }: Context) {
  return writeMessage(request, 'delete', (await params).messageId);
}
